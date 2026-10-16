/**
 * 计划解析器：把「计划模式的 markdown」翻译成结构化绘本数据。
 *
 * 设计原则（对应计划里的 S1）：
 *  - **纯函数、无副作用、无依赖** —— 可离线单测（本机没有浏览器控制，逻辑必须能在 Node 里验）。
 *  - **永不返回空**：没按骨架写的旧计划也要能成卡（兜底按段落切），否则页面会白屏。
 *  - **有界**：raw/步骤数/字段长度都封顶，避免投影状态无限膨胀。
 *
 * 骨架（写作约定见技能 `plan-book`，提案式）：
 *   # 标题
 *   > 一句话目标
 *   ## 现状                 ← 提案四节之一（不再当成步骤）
 *   ## 1. 短标题
 *   图: 钥匙            ← 可选；不写就按标题自动选图（确定性）
 *   做: 一句话
 *   因: 为什么现在做
 *   碰: 文件A、文件B
 *   险: 最坏会怎样 + 怎么退回
 *   验收: 这一步做完怎么看出成了   ← 可选
 *   细节: 术语原文
 *   ## 分五步（每步单独验收、可单独回滚）  ← **不是步骤**：整组步骤的总起句，内容并进下一步/上一步的细节
 *   ## 为什么不选别的        ← 提案四节之一
 *   ## 代价与退路            ← 提案四节之一
 *   ## 怎么算成功            ← 提案四节之一
 *   ## 要你定的
 *   - 决策点
 */

export const LIMITS = { raw: 20000, steps: 12, field: 200, oneLine: 90, title: 80, section: 500 };

/** 关键词 → 图形名。渲染器按这个名字画内联 SVG 小图（确定性、不联网、不调生图 API）。 */
const GLYPHS = [
	[/(备份|快照|回滚|退回|恢复)/u, "shield"],
	[/(重启|服务|启动|进程)/u, "power"],
	[/(界面|页面|面板|样式|视觉|绘本|图画)/u, "palette"],
	[/(记忆|知识|沉淀|总结)/u, "book"],
	[/(计划|方案|步骤|流程)/u, "map"],
	[/(测试|验收|断言|检查|体检)/u, "check"],
	[/(文件|配置|补丁|插件|代码|脚本)/u, "file"],
	[/(搜索|检索|查找|查询)/u, "search"],
	[/(用户|你|对话|交互|按钮)/u, "person"],
	[/(数据|投影|状态|同步)/u, "database"],
	[/(风险|坑|危险|失败)/u, "warning"],
	[/(时间|周期|轮|每日|定时)/u, "clock"],
	[/(钥匙|开锁|上锁)/u, "key"],
	[/(灯|点亮|照亮)/u, "lamp"],
	[/(笔|写|草稿|绘制|画)/u, "pen"],
	[/(箱子|盒子|收纳|整理)/u, "box"],
	[/(眼睛|看见|观察|盯着)/u, "eye"],
	[/(房子|家|工作台|工作区)/u, "house"],
	[/(齿轮|机器|引擎|机制)/u, "gear"]
];

/** 按句子内容挑一个小图形名（确定性：同样的字永远给同一个图）。 */
export function glyphFor(text) {
	const source = String(text ?? "");
	for (const [pattern, glyph] of GLYPHS) if (pattern.test(source)) return glyph;
	return "dot";
}

/** 字段别名：中文/英文、冒号全角半角、加粗与否都认。 */
const FIELD_KEYS = [
	["glyph", /^(?:\*\*)?(图|图形|插画|glyph)(?:\*\*)?\s*[:：]/iu],
	["do", /^(?:\*\*)?(做|做什么|目标|行动)(?:\*\*)?\s*[:：]/iu],
	["why", /^(?:\*\*)?(因|因为|为什么)(?:\*\*)?\s*[:：]/iu],
	["files", /^(?:\*\*)?(碰|会碰|影响|文件|改哪)(?:\*\*)?\s*[:：]/iu],
	["risk", /^(?:\*\*)?(险|万一|风险|回滚|退路)(?:\*\*)?\s*[:：]/iu],
	["accept", /^(?:\*\*)?(验收|验收标准|怎么验收|accept)(?:\*\*)?\s*[:：]/iu],
	["detail", /^(?:\*\*)?(细节|备注|术语|原文|detail)(?:\*\*)?\s*[:：]/iu]
];

/**
 * 提案四节（写作骨架见技能 `plan-book`）：现状 / 为什么不选别的 / 代价与退路 / 怎么算成功。
 * 这几个 `##` 以前会被当成「章节式步骤」混进步骤列表 —— 现在单独收进 `sections`。
 */
const SECTION_KEYS = [
	["status", /^(现状|现状与问题|现在的现状|目前的情况|当前情况)/u],
	["alternatives", /^(为什么不选别的|为什么不选|为什么不用别的|备选方案|替代方案|其它方案|其他方案)/u],
	["cost", /^(代价与退路|代价和退路|成本与退路|代价|成本)/u],
	["success", /^(怎么算成功|如何算成功|怎样算成功|成功判据|算成功的标准)/u]
];

/** 编号步骤标题（**既有规则，别动**）：`## 1. 写解析器` / `## 1、写解析器` / `## 1)`。 */
const NUMBERED = /^(\d+)\s*[.、)]\s*(.*)$/u;

/**
 * 预扫：这份计划里有没有「编号步骤」？决定非编号 `## X` 算不算步骤。
 *  - 有编号步骤＝规范骨架 → 非编号 `##` **不是**步骤（内容并入相邻步骤的细节，见主循环里的 newRule）；
 *  - 一个编号都没有＝章节式计划 → 沿用旧行为，每个 `##` 都当步骤（**这条别破坏**）。
 * 只扫 `##`/`###`，并且跳过代码围栏（围栏里的 `##` 从来不算标题）。
 * @param lines - 计划正文按行切开后的数组。
 * @returns 有编号步骤就 true。
 */
const hasNumberedStep = (lines) => {
	let inFence = false;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^(```|~~~)/u.test(trimmed)) { inFence = !inFence; continue; }
		if (inFence) continue;
		const heading = /^#{2,3}\s+(.*)$/u.exec(trimmed);
		if (heading !== null && NUMBERED.test(plain(heading[1]))) return true;
	}
	return false;
};

const clamp = (text, max) => {
	const value = String(text ?? "").trim();
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
};

/** 去掉行内加粗/代码标记，保留可读文字。 */
const plain = (text) => String(text ?? "").replace(/\*\*(.+?)\*\*/gu, "$1").replace(/`([^`]+)`/gu, "$1").trim();

/** 四节标题的归一化：去加粗、去括号补充（「现状（带证据）」）、去尾部标点与空白。 */
const normalizeHead = (text) =>
	plain(text)
		.replace(/[（(][^）)]*[）)]/gu, "")
		.replace(/[\s:：。.、，,；;！!]+$/u, "")
		.trim();

/**
 * 认出提案四节里的哪一节。
 * @param text - 小节标题原文。
 * @returns 四节的键（status/alternatives/cost/success），不是四节就返回 undefined。
 */
const matchSection = (text) => {
	const head = normalizeHead(text);
	if (head === "") return undefined;
	const hit = SECTION_KEYS.find(([, pattern]) => pattern.test(head));
	return hit === undefined ? undefined : hit[0];
};

const DECISION_HEADS = /^(要你定的|要你决定|需要你决定|决策点|需要你拍板)/u;

/**
 * 解析计划 markdown。
 * @param markdown - `exit_plan_mode` 里的 plan 原文。
 * @returns 结构化绘本数据（永远返回对象，绝不抛错）。
 */
export function parsePlan(markdown) {
	const raw = String(markdown ?? "");
	const truncatedRaw = raw.length > LIMITS.raw;
	const lines = (truncatedRaw ? raw.slice(0, LIMITS.raw) : raw).split(/\r?\n/u);

	let title = "";
	let oneLine = "";
	const steps = [];
	const decisions = [];
	const sections = { status: "", alternatives: "", cost: "", success: "" };
	let section = null;          // 当前步骤对象；null = 还没进任何步骤
	let activeSection = null;    // 正在读的提案四节；null = 不在四节里
	let sectionOverflow = false; // 四节里有没有被限长截断的
	let inDecisions = false;
	let inFence = false;
	let sawSections = false;         // 是否真的用过骨架（## 小节）
	let fallbackBuffer = [];
	let inMergedHead = false;        // 正在读「非编号 ## 的正文」——这些正文一律进细节，不覆盖字段
	let pendingLead = "";            // 还出现在任何步骤之前的非编号 ## 及其正文（暂存，挂到第一步的细节上）

	/** 把兜底缓冲里的段落变成步骤（没按骨架写时用）。 */
	const flushFallback = () => {
		for (const paragraph of fallbackBuffer) {
			const text = paragraph.join(" ").trim();
			if (text === "") continue;
			const first = text.split(/[。；;!！?？]/u)[0] ?? text;
			steps.push({
				n: steps.length + 1,
				title: clamp(plain(first), 24) || `第 ${steps.length + 1} 步`,
				glyph: glyphFor(text),
				glyphWord: "",
				do: clamp(plain(first), LIMITS.field),
				why: "",
				files: "",
				risk: "",
				accept: "",
				detail: clamp(plain(text), LIMITS.field)
			});
		}
		fallbackBuffer = [];
	};

	/** 往当前容器里追加一段正文：在四节里就进那一节，否则进当前步骤的细节。 */
	const appendBody = (text) => {
		if (text === "") return;
		if (activeSection !== null) {
			sections[activeSection] = sections[activeSection] === "" ? text : `${sections[activeSection]}\n${text}`;
			return;
		}
		if (section !== null) section.detail = clamp(`${section.detail} ${text}`, LIMITS.field);
	};

	const hasNumbered = hasNumberedStep(lines);   // 规范骨架？决定非编号 ## 算不算步骤

	for (const line of lines) {
		const trimmed = line.trim();
		if (/^(```|~~~)/u.test(trimmed)) { inFence = !inFence; continue; }   // 代码块里的 ## 不算标题
		if (inFence) { appendBody(trimmed); continue; }

		const heading = /^(#{1,3})\s+(.*)$/u.exec(trimmed);
		if (heading !== null) {
			const level = heading[1].length;
			const text = plain(heading[2]);
			inMergedHead = false;
			if (level === 1) { if (title === "") title = clamp(text, LIMITS.title); continue; }
			if (DECISION_HEADS.test(text)) { inDecisions = true; section = null; activeSection = null; continue; }
			inDecisions = false;
			const numbered = NUMBERED.exec(text);
			// 提案四节：带编号的照样算步骤（「## 3. 代价」不该被吃成小节）
			const sectionKey = numbered === null ? matchSection(text) : undefined;
			if (sectionKey !== undefined) {
				activeSection = sectionKey;
				section = null;
				sawSections = true;
				continue;
			}
			activeSection = null;
			// 【newRule】非编号 `##` 的归属：有编号步骤＝规范骨架 → 它不是步骤，标题与正文并入相邻步骤的细节，
			//   绝不产生「没有『做什么』的空壳步骤」（真实缺陷：「## 分五步（每步单独验收、可单独回滚）」
			//   被当成第 1 步，do/detail 全空 ✗）。
			//   · 已经有上一步 → 并入**上一步**的细节（就近归属，不丢信息）；
			//   · 还在任何步骤之前 → 暂存，整组挂到它统领的**第一步**的细节上（真实日志里那份计划正是这种形状）；
			//   · 章节式计划（一个编号都没有，见 hasNumbered）保持旧行为：每个 `##` 都当步骤 ✗ 别破坏。
			if (numbered === null && hasNumbered) {
				const target = section ?? (steps.length > 0 ? steps[steps.length - 1] : null);
				if (target === null) pendingLead = clamp(`${pendingLead} ${text}`.trim(), LIMITS.field);
				else {
					target.detail = clamp(`${target.detail} ${text}`.trim(), LIMITS.field);
					section = target;        // 它的正文接下来也进这一步的细节
				}
				inMergedHead = true;
				continue;
			}
			section = {
				n: numbered !== null ? Number(numbered[1]) : steps.length + 1,
				title: clamp(numbered !== null ? plain(numbered[2]) : text, 40) || `第 ${steps.length + 1} 步`,
				glyph: "", glyphWord: "", do: "", why: "", files: "", risk: "", accept: "", detail: ""
			};
			sawSections = true;
			steps.push(section);
			continue;
		}

		if (trimmed === "") { flushFallback(); continue; }                     // 段落结束
		if (trimmed.startsWith(">") && oneLine === "" && steps.length === 0 && activeSection === null && !Object.values(sections).some((value) => value !== "")) {
			oneLine = clamp(plain(trimmed.replace(/^>\s*/u, "")), LIMITS.oneLine);
			continue;
		}

		if (inDecisions) {
			const bullet = /^[-*]\s+(.*)$/u.exec(trimmed);
			if (bullet !== null) decisions.push({ q: clamp(plain(bullet[1]), LIMITS.field), options: [] });
			else if (decisions.length > 0) decisions[decisions.length - 1].q = clamp(`${decisions[decisions.length - 1].q} ${plain(trimmed)}`, LIMITS.field);
			continue;
		}

		// 四节正文：每行一段（去掉行首项目符号，渲染时按行分开）
		if (activeSection !== null) {
			appendBody(plain(trimmed.replace(/^[-*+]\s+/u, "").replace(/^\d+\s*[.、)]\s+/u, "")));
			continue;
		}

		// 非编号 `##` 的正文：一律进「细节」（不覆盖上一步的 做/因/碰/险 —— 那是另一步的字段）
		if (inMergedHead) {
			const body = plain(trimmed.replace(/^[-*+]\s+/u, "").replace(/^\d+\s*[.、)]\s+/u, ""));
			if (body === "") continue;
			if (section !== null) section.detail = clamp(`${section.detail} ${body}`.trim(), LIMITS.field);
			else pendingLead = clamp(`${pendingLead} ${body}`.trim(), LIMITS.field);
			continue;
		}

		const matched = FIELD_KEYS.find(([, pattern]) => pattern.test(trimmed));
		const target = section;
		if (target !== null) {
			if (matched !== undefined) {
				const value = clamp(plain(trimmed.replace(matched[1], "")), LIMITS.field);
				if (matched[0] === "glyph") { target.glyphWord = value; target.glyph = glyphFor(value) === "dot" ? glyphFor(`${value} ${target.title}`) : glyphFor(value); }
				else target[matched[0]] = value;
			}
			else target.detail = clamp(`${target.detail} ${trimmed}`.trim(), LIMITS.field);
			continue;
		}
		// 还没进任何步骤：先攒着，成段后兜底
		if (fallbackBuffer.length === 0) fallbackBuffer.push([]);
		fallbackBuffer[fallbackBuffer.length - 1].push(trimmed);
	}
	flushFallback();

	// 收尾 ⓪：步骤之前的非编号 ## 及其正文（pendingLead）挂到它统领的第一步的细节上 —— 内容不丢，也不当步骤。
	//         整份计划最终没有任何步骤时（理论上不会，兜底）并进「一句话」，绝不静默丢弃 ✗。
	if (pendingLead !== "") {
		if (steps.length > 0) steps[0].detail = clamp(`${steps[0].detail} ${pendingLead}`.trim(), LIMITS.field);
		else oneLine = clamp(`${oneLine} ${pendingLead}`.trim(), LIMITS.oneLine);
	}

	// 收尾 ①：没有"做"的步骤，把细节的第一句提上来当一句话（旧格式/按章节写的计划也能看懂）
	for (const step of steps) {
		if (step.do === "" && step.detail !== "") {
			const first = step.detail.split(/[。；;!！?？]/u)[0] ?? step.detail;
			step.do = clamp(plain(first), LIMITS.field);
		}
	}
	// 收尾 ②：表格不适合当"一句话"（实测：旧格式计划的表格被原样倒到卡片上，很难看）
	//          → 换成一句诚实的说明，原文仍在「术语原文」里
	const TABLE_LIKE = /^\s*\||\|\s*-{2,}/u;
	for (const step of steps) {
		if (TABLE_LIKE.test(step.do) || TABLE_LIKE.test(step.detail.slice(0, 40))) {
			step.do = "（一张折起的对照表，点开看原文）";
		}
	}
	// 收尾 ③：图形名兜底（按标题+正文自动挑），保证每步都有图
	for (const step of steps) if (step.glyph === "") step.glyph = glyphFor(`${step.title} ${step.do} ${step.detail}`);
	if (oneLine === "" && steps.length > 0) oneLine = clamp(steps[0].do || steps[0].title, LIMITS.oneLine);

	// 收尾 ④：提案四节各自限长（超了截断，并让 truncated 语义带上这层）
	const keptSections = {};
	for (const [key, value] of Object.entries(sections)) {
		const text = value.trim();
		if (text.length > LIMITS.section) sectionOverflow = true;
		keptSections[key] = text.length <= LIMITS.section ? text : `${text.slice(0, LIMITS.section - 1)}…`;
	}

	const overSteps = steps.length > LIMITS.steps;
	const kept = overSteps ? steps.slice(0, LIMITS.steps) : steps;
	if (overSteps) {
		const last = kept[kept.length - 1];
		last.detail = clamp(`${last.detail} （还有 ${steps.length - LIMITS.steps} 步未展示）`, LIMITS.field);
	}
	return {
		title: title || "未命名计划",
		oneLine,
		steps: kept,
		decisions,
		sections: keptSections,
		sectionsTruncated: sectionOverflow,
		raw: truncatedRaw ? `${raw.slice(0, LIMITS.raw)}\n…（原文过长已截断）` : raw,
		truncated: truncatedRaw || overSteps || sectionOverflow,
		parsed: sawSections ? "skeleton" : "fallback",
		stepCount: steps.length
	};
}

export default parsePlan;

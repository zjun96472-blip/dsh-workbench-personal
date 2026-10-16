// dsh-workbench-personal —— 客户端半边（手写 bundle，无需 tsdown 构建）
//
// 本文件是**可安装包 dsh-workbench-personal 的客户端 bundle**：一个 `window.__ModuleLoader__.load`
// 调用，模块 id 必须等于包名（加载器按包名 require）。它贡献四块页面：
//   工作台页 / 记忆库页 / 试作页 / 计划视图（对话尾摘要卡 + 右侧标签页）。
// 页面开关由主机半边通过 `webserver/index-inject` 注入的 `globalThis.__DSH_WORKBENCH__` 决定
// （客户端插件**拿不到 row config** —— 浏览器侧 loader 只按 `{name: id}` 建条目，见
//  dsh-client-modules/lib/client.js 的 `create()`；所以开关必须走主机注入的全局量）。
//
// 页面机制（2026-10-09 实测）：sidebar.panellist 注册 id + main 注册**同名 key**，
// 点侧边栏图标即渲染这块面板（已占用 id/key：plugins / schedules / conversation）。
//
// 视觉：零件守这套工作台自己的尺度（字号 10–16、字重 400–700、圆角 --dsw-radius-*、颜色只用令牌），
// 展示层允许突破到 20/24（hero 与统计数字）。细节见 ui-polish 技能。
//
// 数据（两条来源，各自诚实）：
//   1) **实时**：ctx.uiWorkspace.listDirectory(data/skills) —— 只给目录名。服务要**迟到绑定**
//      （apply 时 ctx.get 拿到的是 undefined，页面就会显示"目录服务还没就绪"）。
//   2) **构建期快照**：SKILL_INDEX（下面的标记块，由 tools/skill-index.mjs 从每个 SKILL.md 的
//      frontmatter + 正文生成）—— 因为客户端读不到文件内容，描述只能靠快照。
//      页面拿两边的数量做**体检**：不一致就提示重跑索引，不假装信息是最新的。
window.__ModuleLoader__.load({
	id: "dsh-workbench-personal",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/** 客户端插件名（cordis 插件体 name）。 */
		const PLUGIN_NAME = "workbench-home";
		/** locale 命名空间。 */
		const LOCALE_NS = "workbench-home";
		/** 侧边栏入口图标插槽（list）与中间栏面板插槽（keyed）的注册键必须同名。 */
		const PANEL_SLOT = "sidebar.panellist";
		const MAIN_SLOT = "main";
		const PANEL_KEY = "workbench-home";
		const PANEL_KEY_MEMORY = "workbench-memory";
		/** 「试作」页：设计试作（一页纸的审美样本，不接数据）。 */
		const PANEL_KEY_AUDITION = "workbench-audition";
		/**
		 * 主机半边注入的运行时配置（`webserver/index-inject` 的 `kind: "global"` 行，在 index.html 的
		 * `<head>` 里先于本 bundle 求值）。缺失时全部走默认值 —— 这份 bundle 也能单独跑（桩测试）。
		 */
		const HOST_CONFIG = (globalThis.__DSH_WORKBENCH__ !== null && typeof globalThis.__DSH_WORKBENCH__ === "object") ? globalThis.__DSH_WORKBENCH__ : {};
		/** 页面开关：只有显式 `false` 才算关（缺字段 = 开，向后兼容没有主机半边的场合）。 */
		const PAGE_FLAGS = (HOST_CONFIG.pages !== null && typeof HOST_CONFIG.pages === "object") ? HOST_CONFIG.pages : {};
		/** @param key - 页面键（home / memory / audition / planBook）；@returns 该页是否要注册。 */
		const pageOn = (key) => PAGE_FLAGS[key] !== false;
		/** 技能库目录（主机按 `$DSH_HOME` 解析后注入；读不到只影响"体检"那一段）。 */
		const SKILLS_DIR = typeof HOST_CONFIG.skillsDir === "string" && HOST_CONFIG.skillsDir !== ""
			? HOST_CONFIG.skillsDir
			: "/opt/deepseek-harness-personal/data/skills";
		/** 本地插件数量（由我维护：brand / persona / home）。 */
		const LOCAL_PLUGIN_COUNT = 3;
		/** 下一阶段的块数。 */
		const STAGE_COUNT = 3;

		/** 中文字典（key 与 en 一一对应）。 */
		const DICT_ZH = {
			"panel.label": "工作台",
			"page.status": "值守中",
			"mem.panel": "记忆库",
			"audition.panel": "试作",
			"mem.crumb": "工作台",
			"mem.sub": "沉淀的判断，按类型浏览；点某类只看那一类。",
			"mem.graph": "关系图",
			"mem.graphTitle": "球棍模型：每个球是一个原子，每根杆是一条关系",
			"mem.atoms": "原子",
			"mem.search": "搜索记忆：关键词 / 标签，例如 重启、客户端插件",
			"mem.clear": "清空搜索",
			"mem.clearSearch": "清空搜索",
			"mem.tagHint": "常用标签（点一下即搜）：",
			"plan.kicker": "计划",
			"plan.openShort": "右侧打开",
			"plan.paneUnavailableShort": "右侧不可用",
			"plan.expand": "就地展开",
			"plan.collapse": "收起",
			"plan.paneUnavailable": "右侧面板暂时打不开，已就地展开。",
			"plan.paneEmpty": "还没有可展示的计划 —— 在计划模式下我会把计划放在这里。",
			"plan.aria": "执行计划（每步做什么、为什么、会碰什么、万一怎么退）",
			"plan.stepsUnit": "步",
			"plan.statFiles": "处改动",
			"plan.statRisks": "个风险点",
			"plan.statDetails": "处细节",
			"plan.open": "在右侧打开",
			"plan.openHint": "右栏看全貌；打不开会自动就地展开。",
			"plan.close": "关闭",
			"plan.prev": "← 上一步",
			"plan.next": "下一步 →",
			"plan.noSteps": "这份计划没有可展示的步骤。",
			"plan.tableInstead": "（一张折起的对照表，点开看原文）",
			"plan.why": "因",
			"plan.because": "因为",
			"plan.diagStart": "开始",
			"plan.diagNoLine": "（这一步没有单独说明）",
			"plan.legendOrder": "顺序：一步接一步",
			"plan.legendRisk": "虚线 = 出问题的退路",
			"plan.viewProse": "正文",
			"plan.viewDeck": "汇报稿",
			"plan.viewDiagram": "流程图",
			"plan.deckFull": "全屏",
			"plan.deckExitFull": "退出全屏",
			"plan.deckEnd": "要你定的 · 然后开始执行",
			"plan.deckAgenda": "计划一览",
			"plan.deckStepOf": "第",
			"plan.deckDetail": "这一步的细节与术语",
			"plan.deckRisks": "可能出问题的地方",
			"plan.deckPressMore": "按 → 继续",
			"plan.diagEnd": "批准后执行",
			"plan.rowDo": "做什么",
			"plan.rowWhy": "为什么",
			"plan.rowFiles": "会碰",
			"plan.rowRisk": "万一",
			"plan.touches": "会碰",
			"plan.riskWord": "万一",
			"plan.files": "碰",
			"plan.risk": "万一",
			"plan.showDetail": "点开原文",
			"plan.hideDetail": "收起原文",
			"plan.decisions": "要你定的",
			"plan.rowAccept": "验收",
			"plan.secStatus": "现状",
			"plan.secAlternatives": "为什么不选别的",
			"plan.secCost": "代价与退路",
			"plan.secSuccess": "怎么算成功",
			"plan.oneScreenHint": "看完这屏就能决定；步骤细节在下面，想深入再看。",
			"plan.foldBasis": "看依据：现状 · 为什么不用别的方案 · 怎么算成功",
			"plan.foldSteps": "看完整的",
			"plan.truncatedText": "（内容过长，已截断）",
			"plan.multi": "份计划，展示最新一份",
			"plan.truncated": "（原文过长，只画前 12 步）",
			"plan.footnote": "批准仍用上面的官方按钮（Approve / Keep planning）—— 这里只负责让你看懂。",
			"plan.noHook": "计划视图读不到投影钩子（宿主没把 useProjection 传进这一格）—— 客户端插件该更新了。",
			"plan.unavailable": "计划投影不可用：主机插件 plan-book 没装入或还没重启（官方计划卡片不受影响）。",
			"mem.legend": "球色 = 类型 · 灰杆 = 关系（实线/虚线分两族）",
			"mem.graphHint": "拖拽旋转 · 滚轮缩放 · 点一个球看它的邻域",
			"mem.graphAria": "3D 球棍关系图（可拖拽旋转、滚轮缩放、点选原子）",
			"mem.nomatch": "没有匹配的原子",
			"mem.pick": "点一个节点或卡片，看它的证据与关系。",
			"mem.title": "记忆库",
			"mem.hint": "沉淀的判断，按类型浏览；点某类只看那一类。",
			"mem.all": "全部",
			"mem.empty": "这一类还没有原子。",
			"mem.emptyHint": "攒到相关判断后它就会出现；也可以在收尾时让我提候选。",
			"mem.evidence": "证据",
			"mem.source": "出处",
			"mem.relations": "关系",
			"mem.hub": "枢纽原子（关系最多的几条）",
			"mem.edgeUnit": "条关系",
			"mem.generated": "索引生成于",
			"mem.scoreAvg": "均分",
			"mem.scoreHint": "每条原子按四维打 0–10 分（证据×3 · 复用×3 · 范围×2 · 新鲜×1）；分数只决定池内先后，低分只出清理建议，不自动删。",
			"mem.eligHint": "注入资格只看手工 tier 标签（tier1/tier2 才进注入池，tier3 不进）；分数只决定池内排序 —— 徽标上的层级是分数算出的，仅供参考。",
			"mem.scoreDims": "分数",
			"mem.hits": "被使用",
			"mem.scoredUnit": "条已打分",
			"mem.scoreHistory": "历史记录",
			"mem.scoreHistoryUnit": "条",
			"mem.unscored": "未打分",
			"mem.tier.tier1": "tier1 宪法",
			"mem.tier.tier2": "tier2 常用",
			"mem.tier.tier3": "tier3 参考",
			"mem.elig": "注入资格",
			"mem.eligNo": "（不进自动注入）",
			"mem.type.经验": "经验",
			"mem.type.教训": "教训",
			"mem.type.约束": "约束",
			"mem.type.原则": "原则",
			"mem.type.偏好": "偏好",
			"mem.type.决策": "决策",
			"hero.name": "个人工作台",
			"hero.role": "个人工作台 · 常驻主控",
			"hero.tagline": "把每件事推到「已验证」，而不是「看起来做完了」。",
			"stat.skills": "技能",
			"stat.plugins": "本地插件",
			"stat.stages": "下一阶段",
			"lib.title": "能力库",
			"lib.hint": "可复用的流程。说到相关的事，我会自动加载；点开能看它做什么、什么时候用、怎么用。",
			"lib.search": "搜索技能（名字或用途）",
			"lib.loading": "正在读取技能目录…",
			"lib.empty": "还没有技能",
			"lib.empty.hint": "把做法写成 data/skills/<名字>/SKILL.md 就会出现在这里",
			"lib.slow": "目录服务还没就绪",
			"lib.slow.hint": "接口要么还没激活，要么不接受这个路径。可以稍等或点刷新。",
			"lib.failed": "读不到技能目录",
			"lib.nomatch": "没有匹配的技能",
			"lib.trigger": "什么时候用",
			"lib.trigger.chip": "触发",
			"lib.what": "它做什么",
			"lib.how": "怎么用",
			"lib.how.value": "说到相关的事我会自动加载；也可以直接点名这个技能。",
			"lib.source": "源文件",
			"lib.unit": "条",
			"lib.generated": "索引生成于",
			"lib.filter.all": "全部",
			"lib.detail": "看详情",
			"lib.cmd.on": "已加入 / 菜单",
			"lib.cmd.off": "未加入 / 菜单",
			"lib.detail.hide": "收起",
			"lib.close": "关闭",
			"lib.drift": "目录里和索引里的条数不一致，索引可能过期 —— 重跑 tools/skill-index.mjs 即可刷新描述。",
			"lib.missing": "索引里还没有这条技能，重跑 tools/skill-index.mjs 就能看到它的说明。",
			"lib.add": "加一条：把做法写成 data/skills/<名字>/SKILL.md（frontmatter 必须有 name 和 description）",
			"action.retry": "重试",
			"action.refresh": "刷新",
			"next.title": "下一阶段",
			"next.resources": "资源库",
			"next.resources.hint": "技能 / 资料 / 插件 / 会话的统一入口",
			"next.orchestrate": "编排",
			"next.orchestrate.hint": "把一套活儿编成可复用的流程",
			"next.debug": "调试与发布",
			"next.debug.hint": "试跑、看变量、确认改动的生效状态",
			"next.footer": "本页由可安装包 dsh-workbench-personal 提供 · 代码在包内 lib/client.js"
		};
		/** 英文字典（同一组 key）。 */
		const DICT_EN = {
			"panel.label": "Workbench",
			"page.status": "on duty",
			"mem.panel": "Memory bank",
			"audition.panel": "Audition",
			"mem.crumb": "Workbench",
			"mem.sub": "Settled judgments, browsed by type; pick a type to see only that one.",
			"mem.graph": "Relation graph",
			"mem.graphTitle": "Ball-and-stick: every ball is an atom, every rod a relation",
			"mem.atoms": "Atoms",
			"mem.search": "Search memories: keyword or tag, e.g. 重启",
			"mem.clear": "Clear search",
			"mem.clearSearch": "Clear search",
			"mem.tagHint": "Common tags (click to search):",
			"plan.kicker": "Plan",
			"plan.openShort": "open right",
			"plan.paneUnavailableShort": "panel unavailable",
			"plan.expand": "Expand here",
			"plan.collapse": "Collapse",
			"plan.paneUnavailable": "The right panel would not open; expanded here instead.",
			"plan.paneEmpty": "No plan to show yet — in plan mode I will put the plan here.",
			"plan.aria": "Execution plan (what each step does, why, what it touches, how to back out)",
			"plan.stepsUnit": "steps",
			"plan.statFiles": "touches",
			"plan.statRisks": "risks",
			"plan.statDetails": "details",
			"plan.open": "Open in the right panel",
			"plan.openHint": "See the whole plan in the right panel; falls back to inline.",
			"plan.close": "Close",
			"plan.prev": "← Previous",
			"plan.next": "Next →",
			"plan.noSteps": "This plan has no drawable steps.",
			"plan.tableInstead": "(a folded table — open the text to read it)",
			"plan.why": "why",
			"plan.because": "because",
			"plan.diagStart": "start",
			"plan.diagNoLine": "(no separate note)",
			"plan.legendOrder": "order: step by step",
			"plan.legendRisk": "dashed = fallback if it breaks",
			"plan.viewProse": "Text",
			"plan.viewDeck": "Slides",
			"plan.viewDiagram": "Diagram",
			"plan.deckFull": "Full screen",
			"plan.deckExitFull": "Exit full screen",
			"plan.deckEnd": "Your call · then we start",
			"plan.deckAgenda": "Plan at a glance",
			"plan.deckStepOf": "Step",
			"plan.deckDetail": "details and jargon",
			"plan.deckRisks": "Where it can break",
			"plan.deckPressMore": "press → to continue",
			"plan.diagEnd": "after approval",
			"plan.rowDo": "does",
			"plan.rowWhy": "why",
			"plan.rowFiles": "touches",
			"plan.rowRisk": "if it breaks",
			"plan.touches": "touches",
			"plan.riskWord": "if it breaks",
			"plan.files": "touches",
			"plan.risk": "if it breaks",
			"plan.showDetail": "open the text",
			"plan.hideDetail": "hide details",
			"plan.decisions": "Your call",
			"plan.rowAccept": "check",
			"plan.secStatus": "Where we are",
			"plan.secAlternatives": "Why not the alternatives",
			"plan.secCost": "Cost and way back",
			"plan.secSuccess": "How we will know it worked",
			"plan.oneScreenHint": "This screen is enough to decide; step details are below when you want them.",
			"plan.foldBasis": "See the basis: where we are · why not the alternatives · what counts as success",
			"plan.foldSteps": "See all",
			"plan.truncatedText": "(source too long; truncated)",
			"plan.multi": "plans this turn, showing the newest",
			"plan.truncated": "(long plan: first 12 steps drawn)",
			"plan.footnote": "Approval still uses the official buttons above — this view only helps you read it.",
			"plan.noHook": "The plan view cannot see the projection hook (the host did not pass useProjection into this cell) — the client plugin needs an update.",
			"plan.unavailable": "Plan projection unavailable: host plugin plan-book is missing or the service has not restarted (official plan card is unaffected).",
			"mem.legend": "Ball colour = type · grey rod = relation (solid/dashed)",
			"mem.graphHint": "Drag to rotate · scroll to zoom · click a ball to see its neighbourhood",
			"mem.graphAria": "3D ball-and-stick relation graph (drag to rotate, scroll to zoom, click to select an atom)",
			"mem.nomatch": "No matching atoms",
			"mem.pick": "Pick a node or card to see its evidence and relations.",
			"mem.title": "Memory bank",
			"mem.hint": "Settled judgments, browsed by type; pick a type to see only that one.",
			"mem.all": "All",
			"mem.empty": "No atoms in this type yet.",
			"mem.emptyHint": "They appear once related judgments accumulate; or ask me to propose candidates at wrap-up.",
			"mem.evidence": "Evidence",
			"mem.source": "Source",
			"mem.relations": "Relations",
			"mem.hub": "Hub atoms (most relations)",
			"mem.edgeUnit": "relations",
			"mem.generated": "Index built at",
			"mem.scoreAvg": "avg",
			"mem.scoreHint": "Every atom is scored 0–10 on four dimensions (evidence ×3 · reuse ×3 · scope ×2 · freshness ×1); the score only orders atoms inside the pool. Low scores only produce cleanup suggestions — nothing is deleted automatically.",
			"mem.eligHint": "Injection eligibility comes from the manual tier tag only (tier1/tier2 enter the pool, tier3 never does); the score only orders the pool — the tier on a badge is score-derived and for reference only.",
			"mem.scoreDims": "Score",
			"mem.hits": "Used",
			"mem.scoredUnit": "scored",
			"mem.scoreHistory": "history",
			"mem.scoreHistoryUnit": "records",
			"mem.unscored": "unscored",
			"mem.tier.tier1": "tier1 core",
			"mem.tier.tier2": "tier2 common",
			"mem.tier.tier3": "tier3 reference",
			"mem.elig": "Injection",
			"mem.eligNo": " (never auto-injected)",
			"mem.type.经验": "Experience",
			"mem.type.教训": "Lesson",
			"mem.type.约束": "Constraint",
			"mem.type.原则": "Principle",
			"mem.type.偏好": "Preference",
			"mem.type.决策": "Decision",
			"hero.name": "Changming",
			"hero.role": "Personal Workbench · Resident Operator",
			"hero.tagline": "I push every task to verified, never to looks-done.",
			"stat.skills": "Skills",
			"stat.plugins": "Local plugins",
			"stat.stages": "Next stage",
			"lib.title": "Capability library",
			"lib.hint": "Reusable procedures. I load them automatically when they apply; open one to see what it does, when it runs, and how to use it.",
			"lib.search": "Search skills (name or purpose)",
			"lib.loading": "Reading the skills directory…",
			"lib.empty": "No skills yet",
			"lib.empty.hint": "Write a procedure to data/skills/<name>/SKILL.md and it shows up here",
			"lib.slow": "The directory service is not ready",
			"lib.slow.hint": "Either the API is not active yet, or it rejects this path. Wait or press refresh.",
			"lib.failed": "Cannot read the skills directory",
			"lib.nomatch": "No matching skill",
			"lib.trigger": "When it runs",
			"lib.trigger.chip": "trigger",
			"lib.what": "What it does",
			"lib.how": "How to use",
			"lib.how.value": "I load it automatically when the topic comes up — or name the skill directly.",
			"lib.source": "Source",
			"lib.unit": "items",
			"lib.generated": "index generated",
			"lib.filter.all": "All",
			"lib.detail": "Details",
			"lib.cmd.on": "in the / menu",
			"lib.cmd.off": "not in the / menu",
			"lib.detail.hide": "Hide",
			"lib.close": "Close",
			"lib.drift": "Directory and index counts differ — the index may be stale. Re-run tools/skill-index.mjs to refresh descriptions.",
			"lib.missing": "Not in the index yet — re-run tools/skill-index.mjs to get its description.",
			"lib.add": "To add one: write data/skills/<name>/SKILL.md (frontmatter must carry name and description)",
			"action.retry": "Retry",
			"action.refresh": "Refresh",
			"next.title": "Next stage",
			"next.resources": "Resource library",
			"next.resources.hint": "One entry point for skills, notes, plugins, sessions",
			"next.orchestrate": "Orchestration",
			"next.orchestrate.hint": "Turn a set of steps into a reusable flow",
			"next.debug": "Debug & release",
			"next.debug.hint": "Dry-run, inspect variables, confirm what is live",
			"next.footer": "Served by the installable package dsh-workbench-personal · code in lib/client.js"
		};

		/* SKILL-INDEX:BEGIN —— 由 tools/refresh-snapshots.mjs 生成，勿手改；加/改技能后重跑本脚本 */
		const SKILL_INDEX = { generatedAt: "", skills: [] };
		/* ICONS:END */

		/* MEMORY-INDEX:BEGIN —— 由 tools/refresh-snapshots.mjs 生成，勿手改；加/改记忆后重跑本脚本 */
		const MEMORY_INDEX = { generatedAt: "", atoms: [], edges: [], stats: { atoms: 0, edges: 0 } };
		/* PLAN-SCENES:END */

		/* PLAN-ART:BEGIN */
		/** 生图母版（分类 → dataURL）。由 tools/gen-plan-art.mjs 注入；空对象时退回自绘 SVG 插画。 */
		const PLAN_ART = {};
		/* PLAN-ART:END */

		/**
		 * 图形名 → 内联 SVG 线稿（确定性：同一个名字永远同一张图；不联网、不调生图 API）。
		 * 每个条目是 [标签, 属性] 数组，渲染成 24×24 的描边小图。
		 */
		const PLAN_GLYPHS = {
			shield: [["path", { d: "M12 3.2l6.8 2.8v5.4c0 3.9-2.9 6.9-6.8 8.8-3.9-1.9-6.8-4.9-6.8-8.8V6z" }], ["path", { d: "M8.6 12.1l2.4 2.3 4.4-4.6" }]],
			power: [["path", { d: "M12 3.6v7.2" }], ["path", { d: "M7.4 7.2a6.4 6.4 0 106.9-.1" }]],
			palette: [["path", { d: "M12 3.6a8.4 8.4 0 000 16.8c1.5 0 2-.9 1.6-1.9-.5-1.2.3-2.2 1.7-2.2h1.3c1.7 0 2.9-1.2 2.9-2.9A8.4 8.4 0 0012 3.6z" }], ["circle", { cx: "8.4", cy: "10.2", r: "1.1" }], ["circle", { cx: "12", cy: "7.8", r: "1.1" }], ["circle", { cx: "15.6", cy: "10.2", r: "1.1" }]],
			book: [["path", { d: "M5.4 4.6h6.1c.9 0 1.5.6 1.5 1.4v13H6.8c-.8 0-1.4-.6-1.4-1.4z" }], ["path", { d: "M18.6 4.6h-4.1c-.9 0-1.5.6-1.5 1.4v13h4.2c.8 0 1.4-.6 1.4-1.4z" }], ["path", { d: "M7.4 9h3" }], ["path", { d: "M16.6 9h-3" }]],
			map: [["path", { d: "M4.4 6.6l5-2 5 2 5.2-2v12.8l-5.2 2-5-2-5 2z" }], ["path", { d: "M9.4 4.6v12.8" }], ["path", { d: "M14.4 6.6v12.8" }], ["circle", { cx: "12", cy: "11.4", r: "1.3" }]],
			check: [["path", { d: "M5 12.6l4.4 4.3L19 6.6" }]],
			file: [["path", { d: "M6.6 3.6h7l4.4 4.4v12.4H6.6z" }], ["path", { d: "M13.6 3.6V8h4.4" }], ["path", { d: "M9.4 12.4h5.6" }], ["path", { d: "M9.4 15.8h5.6" }]],
			search: [["circle", { cx: "11", cy: "11", r: "6.2" }], ["path", { d: "M15.6 15.6L20.4 20.4" }]],
			person: [["circle", { cx: "12", cy: "8.4", r: "3.2" }], ["path", { d: "M5.6 20c.6-3.6 3.2-5.6 6.4-5.6s5.8 2 6.4 5.6" }]],
			database: [["ellipse", { cx: "12", cy: "6.4", rx: "6.4", ry: "2.6" }], ["path", { d: "M5.6 6.4v11.2c0 1.4 2.9 2.6 6.4 2.6s6.4-1.2 6.4-2.6V6.4" }], ["path", { d: "M5.6 12c0 1.4 2.9 2.6 6.4 2.6s6.4-1.2 6.4-2.6" }]],
			warning: [["path", { d: "M12 4.6l7.4 13.2H4.6z" }], ["path", { d: "M12 9.6v4" }], ["circle", { cx: "12", cy: "16", r: "0.8" }]],
			clock: [["circle", { cx: "12", cy: "12", r: "7.8" }], ["path", { d: "M12 7.6V12l3.2 2" }]],
			key: [["circle", { cx: "8.4", cy: "12", r: "3.4" }], ["path", { d: "M11.8 12h8.2" }], ["path", { d: "M17.2 12v2.8" }], ["path", { d: "M19.8 12v2" }]],
			lamp: [["path", { d: "M12 3.6a5.4 5.4 0 013 9.9v2.1H9v-2.1a5.4 5.4 0 013-9.9z" }], ["path", { d: "M9.6 18.4h4.8" }], ["path", { d: "M10.6 20.6h2.8" }]],
			pen: [["path", { d: "M5 19l1.4-4.2L15.6 5.6l3.2 3.2L9.6 18z" }], ["path", { d: "M14.4 6.8l3.2 3.2" }]],
			box: [["path", { d: "M4.8 8.4h14.4v11H4.8z" }], ["path", { d: "M4.8 8.4l1.8-3.6h10.8l1.8 3.6" }], ["path", { d: "M10.2 8.4v3.2h3.6V8.4" }]],
			eye: [["path", { d: "M3.4 12c2.4-4 5.4-6 8.6-6s6.2 2 8.6 6c-2.4 4-5.4 6-8.6 6s-6.2-2-8.6-6z" }], ["circle", { cx: "12", cy: "12", r: "2.6" }]],
			house: [["path", { d: "M4.4 11L12 4.4 19.6 11" }], ["path", { d: "M6.4 10.2v9.4h11.2v-9.4" }], ["path", { d: "M10.4 19.6v-5h3.2v5" }]],
			gear: [["circle", { cx: "12", cy: "12", r: "3.2" }], ["path", { d: "M12 3.6v3" }], ["path", { d: "M12 17.4v3" }], ["path", { d: "M3.6 12h3" }], ["path", { d: "M17.4 12h3" }], ["path", { d: "M6.1 6.1l2.1 2.1" }], ["path", { d: "M15.8 15.8l2.1 2.1" }], ["path", { d: "M17.9 6.1l-2.1 2.1" }], ["path", { d: "M8.2 15.8l-2.1 2.1" }]],
			dot: [["circle", { cx: "12", cy: "12", r: "2.4" }]]
		};

		/** 图名 → 六个分类（决定配色与插画气质）。 */
		const PLAN_CATEGORY = {
			search: "analyze", map: "analyze", eye: "analyze", database: "analyze",
			pen: "build", gear: "build", key: "build", box: "build", house: "build", lamp: "build",
			check: "verify", shield: "verify",
			warning: "risk",
			book: "ship", dot: "ship", clock: "ship",
			file: "wrap", palette: "wrap", person: "wrap", power: "wrap"
		};
		/**
		 * 信息图面板的"墨水色"：**用我们自己的六个分类**（分析/动手/验证/风险/交付/收尾），
		 * 不从参考图抄配色 —— 学的是"暖底 + 彩块 + 标签行"这种做法，颜色是我们自己的语义。
		 */
		const PLAN_CATEGORY_INK = { analyze: "#3D5B84", build: "#C2542C", verify: "#3E6B4B", ship: "#6B4E86", risk: "#B4432C", wrap: "#5A6B72" };
		/** 取某一步的面板色。 */
		function planInk(glyph) {
			return PLAN_CATEGORY_INK[PLAN_CATEGORY[glyph] ?? "build"] ?? PLAN_CATEGORY_INK.build;
		}

		/** 分类 → 色相（每类一个色相，整份计划同一套）。 */
		const PLAN_HUE = { analyze: 216, build: 34, verify: 156, risk: 4, ship: 268, wrap: 196 };
		/** 表格不适合当"一句话"（实测：旧格式计划的表格被原样倒出来很难看）。 */
		const PLAN_TABLE_LIKE = /^\s*\||\|\s*-{2,}/u;

		/** 取某一步的色相。 */
		function planHue(glyph) {
			return PLAN_HUE[PLAN_CATEGORY[glyph] ?? "build"] ?? 216;
		}

		/** 去掉"一句话：/目标："前缀，别重复显示。 */
		function planCleanOne(text) {
			return String(text ?? "").replace(/^\s*(一句话(目标)?|目标)\s*[:：]\s*/u, "").trim();
		}

		/** 表格型内容换成一句诚实说明（原文仍在折叠里）。 */
		function planCleanDo(text, t) {
			const value = String(text ?? "").trim();
			return PLAN_TABLE_LIKE.test(value) ? t("plan.tableInstead") : value;
		}

		/**
		 * 计划流程图布局（**确定性**：同样的计划永远同一张图，刷新不跳）。
		 * 主轴纵向：每步一个节点；右边挂"万一"支线（虚线=退路）；下面列会碰的东西；头尾是开始/批准。
		 * @param steps - 计划里的步骤数组。
		 * @returns 节点、连线、支线、尺寸（全部算好，渲染层只画）。
		 */
		function planDiagramLayout(steps) {
			const NODE_W = 360;
			const NODE_H = 96;
			const GAP = 44;
			const X = 34;
			const TOP = 74;
			const BRANCH_GAP = 54;
			const nodes = [];
			const links = [];
			const risks = [];
			const files = [];
			steps.forEach((step, index) => {
				const y = TOP + index * (NODE_H + GAP);
				const ink = planInk(step.glyph);
				nodes.push({ n: step.n, title: step.title, do: String(step.do ?? ""), files: String(step.files ?? ""), ink, x: X, y, w: NODE_W, h: NODE_H });
				if (index > 0) {
					const prev = nodes[index - 1];
					links.push({ x1: X + NODE_W / 2, y1: prev.y + NODE_H, x2: X + NODE_W / 2, y2: y });
				}
				if (step.risk) {
					risks.push({ x: X + NODE_W + BRANCH_GAP, y: y + 8, w: 250, h: 46, text: step.risk, fromX: X + NODE_W, fromY: y + NODE_H / 2, ink });
				}

			});
			const last = nodes[nodes.length - 1];
			const endY = last === undefined ? TOP : last.y + NODE_H + GAP;
			return { x: X, nodeW: NODE_W, nodeH: NODE_H, width: 34 + NODE_W + BRANCH_GAP + 250 + 34, height: endY + 34 + 40, nodes, links, risks, files, start: { x: X + NODE_W / 2, y: 40 }, end: { x: X + NODE_W / 2, y: endY + 6 } };
		}

		/**
		 * 把一步的"因为/会碰/万一"拼成一行（分隔符只出现在两条之间，行首不会多一个点）。
		 * @param step - 计划里的一个步骤。
		 * @param t - 取文案。
		 * @returns 节点数组，直接塞进 <p class="wpb2-facts">。
		 */
		function planFacts(step, t) {
			const parts = [];
			if (step.why) parts.push(h("span", { className: "wpb2-fact", key: "why" }, `${t("plan.because")} `, step.why));
			if (step.files) parts.push(h("span", { className: "wpb2-fact", key: "files" }, `${t("plan.touches")} `, step.files));
			if (step.risk) parts.push(h("span", { className: "wpb2-fact is-risk", key: "risk" }, `${t("plan.riskWord")} `, step.risk));
			const out = [];
			parts.forEach((node, index) => {
				if (index > 0) out.push(h("i", { className: "wpb2-sep", key: `sep${index}` }, "·"));
				out.push(node);
			});
			return out;
		}

		/** 从右侧面板的导航信息里取要展示的 callId（param 优先，其次从地址里解）。 */
		function planPaneCallId(navigation) {
			const params = navigation?.params;
			if (params !== undefined && typeof params.callId === "string") return params.callId;
			const address = typeof navigation?.address === "string" ? navigation.address : "";
			if (!address.startsWith(PLAN_PANE_SCHEME)) return undefined;
			const parts = address.slice(PLAN_PANE_SCHEME.length).split("/").map((part) => { try { return decodeURIComponent(part); } catch { return part; } });
			return parts.length >= 2 ? parts[1] : undefined;
		}

		/**
		 * 画一张线稿小图。
		 * @param props - name 图形名；size 尺寸（默认 40）。
		 * @returns 24×24 viewBox 的 SVG。
		 */
		function PlanGlyph(props) {
			const parts = PLAN_GLYPHS[props.name] ?? PLAN_GLYPHS.dot;
			const size = props.size ?? 40;
			return h(
				"svg",
				{ className: "wpb-glyph", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
				parts.map(([tag, attrs], index) => h(tag, { key: index, ...attrs }))
			);
		}

		/**
		 * 头图：优先用生图母版（PLAN_ART），否则自绘分层 SVG（渐变圆底 + 主体 + 点缀）。
		 * @param props - name 图形名；size 尺寸。
		 * @returns 插画节点。
		 */
		function PlanArt(props) {
			const category = PLAN_CATEGORY[props.name] ?? "build";
			const hue = PLAN_HUE[category] ?? 216;
			const size = props.size ?? 96;
			const art = PLAN_ART[category];
			if (typeof art === "string" && art.length > 0) {
				return h("img", { className: "wpb2-artimg", src: art, width: size, height: size, alt: "", "aria-hidden": "true" });
			}
			const parts = PLAN_GLYPHS[props.name] ?? PLAN_GLYPHS.dot;
			return h(
				"svg",
				{ className: "wpb2-art", width: size, height: size, viewBox: "0 0 160 160", role: "img", "aria-hidden": "true" },
				h("defs", null,
					h("linearGradient", { id: `wpb2g${hue}`, x1: "0", y1: "0", x2: "1", y2: "1" },
						h("stop", { offset: "0%", stopColor: `hsl(${hue} 62% 30%)` }),
						h("stop", { offset: "100%", stopColor: `hsl(${(hue + 38) % 360} 58% 18%)` }))),
				h("rect", { x: 6, y: 6, width: 148, height: 148, rx: 34, fill: `url(#wpb2g${hue})` }),
				h("circle", { cx: 124, cy: 38, r: 14, fill: `hsl(${(hue + 40) % 360} 90% 62%)`, opacity: 0.55 }),
				h("circle", { cx: 34, cy: 126, r: 9, fill: `hsl(${(hue + 10) % 360} 80% 70%)`, opacity: 0.4 }),
				h("g", { transform: "translate(38 38) scale(3.5)", stroke: `hsl(${hue} 90% 88%)`, strokeWidth: 1.7, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" },
					parts.map(([tag, attrs], index) => h(tag, { key: index, ...attrs })))
			);
		}

		/**
		 * 计划正文（右侧面板与"就地展开"共用同一份渲染）：
		 * 头部一句话 + 每步一行（色相序号 + 标题 + 一句话 + 因/碰/万一 + 折叠原文）+ 要你定的 + 脚注。
		 * @param props - plan；t；compact 紧凑模式（对话里就地展开时用）。
		 * @returns 正文节点。
		 */
		/**
		 * 汇报稿的页序编排（确定性）：封面 → 计划一览 → 每步一页（有细节的再补一页）→ 可能出问题的地方 → 收尾。
		 * @param plan - 计划对象。
		 * @returns 幻灯片数组，每项 { kind, step?, index? }。
		 */
		function planDeckSlides(plan) {
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const slides = [{ kind: "cover" }, { kind: "agenda" }];
			steps.forEach((step, index) => {
				slides.push({ kind: "step", step, index });
				if (String(step.detail ?? "").trim() !== "") slides.push({ kind: "detail", step, index });
			});
			if (steps.some((step) => String(step.risk ?? "").trim() !== "")) slides.push({ kind: "risks" });
			slides.push({ kind: "end" });
			return slides;
		}

		/**
		 * 取提案四节（老缓存里没这几节就是四个空串，不抛）。
		 * @param plan - 投影里的一份计划。
		 * @returns 四个字段的正文。
		 */
		function planSectionsOf(plan) {
			const sections = plan?.sections ?? {};
			return {
				status: String(sections.status ?? ""),
				alternatives: String(sections.alternatives ?? ""),
				cost: String(sections.cost ?? ""),
				success: String(sections.success ?? "")
			};
		}

		/**
		 * 提案里的一节正文：只用留白分隔（不加卡片、不加边框），每行一段。
		 * @param cls - 附加类名（wpp-sec-status / wpp-sec-alternatives / wpp-sec-cost / wpp-sec-success）。
		 * @param title - 节标题（字典里的中文原文）。
		 * @param body - 节正文。
		 * @returns 这一节；没内容就返回 null。
		 */
		function planSectionBlock(cls, title, body) {
			const lines = String(body ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
			if (lines.length === 0) return null;
			return h(
				"section",
				{ className: `wpp-sec ${cls}` },
				h("h2", { className: "wpp-sechead" }, title),
				lines.map((line, index) => h("p", { className: "wpp-secline", key: index }, line))
			);
		}

		/**
		 * 一屏决策版（默认视图，三层密度，只改这一层）：
		 * 第一层默认可见且必须一屏看完 —— 标题 + 一句话 → 要你定的（最多 3 条，原文照出）→ 代价与退路（整段）
		 * → 一行规模 + 一句「看完这屏就能决定」；
		 * 第二层原生 `<details>` 折叠依据（现状 · 为什么不选别的 · 怎么算成功）；
		 * 第三层原生 `<details>` 折叠完整步骤（≥7 步时，summary 里带一行纯文字目录，可点 `#wpp-step-N` 锚点）。
		 * 依据与步骤各自不存在就整块不渲染（不留空壳、不报错）；折叠用原生 details，零 JS。
		 * @param props - plan / t。
		 * @returns 一屏决策 + 两层折叠的文章。
		 */
		function PlanProse(props) {
			const t = props.t;
			const plan = props.plan;
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const decisions = Array.isArray(plan.decisions) ? plan.decisions : [];
			const sections = planSectionsOf(plan);
			const cut = plan.truncated === true;
			const cutSteps = cut && Number(plan.stepCount ?? steps.length) > steps.length;
			const fileCount = steps.filter((step) => String(step.files ?? "").trim() !== "").length;
			const riskCount = steps.filter((step) => String(step.risk ?? "").trim() !== "").length;
			// 海报的主角：第一张场景插画（base64 内联）；一张都没有时换成一整块暖色块，绝不外链图片
			const scene = Object.values(PLAN_SCENES).find((src) => typeof src === "string" && src.length > 0);
			// 大数字排：只摆真数（没有就不摆 0）
			const stats = [{ num: steps.length, label: t("plan.stepsUnit") }];
			if (fileCount > 0) stats.push({ num: fileCount, label: t("plan.statFiles") });
			if (riskCount > 0) stats.push({ num: riskCount, label: t("plan.statRisks") });
			const facts = (step) => {
				const rows = [];
				if (String(step.why ?? "").trim() !== "") rows.push(h("p", { className: "wpp-fact", key: "why" }, h("b", null, t("plan.rowWhy")), step.why));
				if (String(step.files ?? "").trim() !== "") rows.push(h("p", { className: "wpp-fact", key: "files" }, h("b", null, t("plan.rowFiles")), h("code", null, step.files)));
				if (String(step.risk ?? "").trim() !== "") rows.push(h("p", { className: "wpp-fact is-risk", key: "risk" }, h("b", null, t("plan.rowRisk")), step.risk));
				if (String(step.accept ?? "").trim() !== "") rows.push(h("p", { className: "wpp-fact is-accept", key: "accept" }, h("b", null, t("plan.rowAccept")), step.accept));
				return rows;
			};
			// 第二层：依据三节。三节全空就整块不渲染（不留空壳）。
			const basis = [
				planSectionBlock("wpp-sec-status", t("plan.secStatus"), sections.status),
				planSectionBlock("wpp-sec-alternatives", t("plan.secAlternatives"), sections.alternatives),
				planSectionBlock("wpp-sec-success", t("plan.secSuccess"), sections.success)
			].filter((block) => block !== null);
			// 第三层：完整步骤 + （≥7 步时）summary 里那行纯文字目录（纯文字，不做成卡片/徽章）
			const stepList = h(
				"ol",
				{ className: "wpp-list" },
				steps.map((step) => h(
					"li",
					{ className: "wpp-step", key: step.n, id: `wpp-step-${step.n}` },
					h("div", { className: "wpp-stephead" }, h("span", { className: "wpp-no" }, String(step.n)), h("h2", { className: "wpp-steptitle" }, step.title)),
					step.do ? h("p", { className: "wpp-do" }, planCleanDo(step.do, t)) : null,
					facts(step),
					String(step.detail ?? "").trim() !== ""
						? h("details", { className: "wpp-details" }, h("summary", null, t("plan.showDetail")), h("pre", { className: "wpp-detail" }, step.detail))
						: null
				))
			);
			const stepToc = steps.length >= 7
				? h(
					"span",
					{ className: "wpp-toc" },
					steps.map((step, index) => [
						index > 0 ? h("span", { className: "wpp-tocsep", key: `s${step.n}` }, " · ") : null,
						h("a", { key: step.n, className: "wpp-tocitem", href: `#wpp-step-${step.n}` }, `${step.n} ${step.title}`)
					])
				)
				: null;
			return h(
				"article",
				{ className: "wpp" },
				// 第一层：一屏就能决定的东西（巨字标题 + 一句话 → 右侧一张大图主角）
				h(
					"header",
					{ className: "wpp-hero" },
					h(
						"div",
						{ className: "wpp-herotext" },
						h("h1", { className: "wpp-title" }, plan.title),
						plan.oneLine ? h("p", { className: "wpp-lede" }, planCleanOne(plan.oneLine)) : null
					),
					scene === undefined
						? h("div", { className: "wpp-heroart", "aria-hidden": "true" }, h("div", { className: "wpp-heroblk" }))
						: h("div", { className: "wpp-heroart" }, h("img", { className: "wpb2-artimg wpp-heroimg", src: scene, alt: "", "aria-hidden": "true" }))
				),
				decisions.length === 0
					? null
					: h(
						"section",
						{ className: "wpp-decisions" },
						h("h2", null, t("plan.decisions")),
						h("ul", null, decisions.slice(0, 3).map((decision, index) => h("li", { className: "wpp-mustitem", key: index }, decision.q)))
					),
				planSectionBlock("wpp-sec-cost", t("plan.secCost"), sections.cost),
				// 大数字排（步 / 处改动 / 个风险点）：宋体大数 + 11px 小标签，竖细线分隔
				h(
					"div",
					{ className: "wpp-scale" },
					stats.map((stat, index) => [
						index > 0 ? h("span", { className: "wpp-statline", key: `line-${index}`, "aria-hidden": "true" }) : null,
						h("span", { className: "wpp-stat", key: `stat-${index}` }, h("span", { className: "wpp-statnum" }, String(stat.num)), h("span", { className: "wpp-statlabel" }, stat.label))
					])
				),
				cut ? h("p", { className: "wpp-cut" }, cutSteps ? t("plan.truncated") : t("plan.truncatedText")) : null,
				h("p", { className: "wpp-hint" }, t("plan.oneScreenHint")),
				// 第二层：依据（默认收起，点一次展开）
				basis.length === 0 ? null : h("details", { className: "wpp-fold wpp-fold-basis" }, h("summary", null, t("plan.foldBasis")), basis),
				// 第三层：完整步骤（第二批收起）
				steps.length === 0 ? null : h(
					"details",
					{ className: "wpp-fold wpp-fold-steps" },
					h("summary", null, `${t("plan.foldSteps")} ${steps.length} ${t("plan.stepsUnit")}`, stepToc),
					stepList
				),
				h("p", { className: "wpp-foot" }, t("plan.footnote"))
			);
		}

		/**
		 * 汇报稿（传统 PPT 的做法，但用 HTML 做）：封面 → 每步一页 → 收尾页。
		 * 有 16:9 舞台、页码、左右翻页、键盘 ←/→、全屏；没有自动播放的动效。
		 * @param props - plan / t / compact。
		 * @returns 一页式的汇报视图。
		 */
		function PlanDeck(props) {
			const t = props.t;
			const plan = props.plan;
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const decisions = Array.isArray(plan.decisions) ? plan.decisions : [];
			const slides = planDeckSlides(plan);
			const total = slides.length;
			const [slide, setSlide] = React.useState(0);
			const [shown, setShown] = React.useState(0);
			const [full, setFull] = React.useState(false);
			const index = Math.min(Math.max(slide, 0), total - 1);
			const current = slides[index];
			const scenes = Object.values(PLAN_SCENES);
			const files = steps.map((step) => String(step.files ?? "").trim()).filter((x) => x !== "");
			const riskRows = steps.filter((step) => String(step.risk ?? "").trim() !== "");
			const foldedCount = steps.filter((step) => String(step.detail ?? "").trim() !== "").length;
			const rowsOf = (slideDef) => (slideDef === undefined || slideDef.kind !== "step" ? 0 : [slideDef.step.why, slideDef.step.files, slideDef.step.risk].filter((x) => String(x ?? "").trim() !== "").length + 1);

			const go = (delta) => {
				const rows = rowsOf(current);
				if (delta > 0 && shown < rows) { setShown(shown + 1); return; }
				if (delta < 0 && shown > 0) { setShown(shown - 1); return; }
				setShown(0);
				setSlide(Math.min(Math.max(index + delta, 0), total - 1));
			};
			React.useEffect(() => {
				if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined;
				const onKey = (event) => {
					if (event.key === "ArrowRight") go(1);
					else if (event.key === "ArrowLeft") go(-1);
					else if (event.key === "Escape") setFull(false);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			});

			const art = scenes.length === 0 ? null : h("img", { className: "wpd-slidart", src: scenes[index % scenes.length], alt: "", "aria-hidden": "true" });
			let body = null;
			if (current !== undefined && current.kind === "cover") {
				body = h(
					"div",
					{ className: "wpd-slide is-cover" },
					h("span", { className: "wpd-slidekicker" }, t("plan.kicker")),
					h("h2", { className: "wpd-slidetitle is-big" }, plan.title),
					plan.oneLine ? h("p", { className: "wpd-slideoneline" }, planCleanOne(plan.oneLine)) : null,
					h(
						"div",
						{ className: "wpd-stats" },
						h("span", { className: "wpd-statcell" }, h("b", null, String(steps.length)), h("i", null, t("plan.stepsUnit"))),
						h("span", { className: "wpd-statcell" }, h("b", null, String(files.length)), h("i", null, t("plan.statFiles"))),
						h("span", { className: "wpd-statcell" }, h("b", null, String(riskRows.length)), h("i", null, t("plan.statRisks"))),
						h("span", { className: "wpd-statcell" }, h("b", null, String(foldedCount)), h("i", null, t("plan.statDetails")))
					)
				);
			} else if (current !== undefined && current.kind === "agenda") {
				body = h(
					"div",
					{ className: "wpd-slide" },
					h("h2", { className: "wpd-slidetitle" }, t("plan.deckAgenda")),
					h(
						"ol",
						{ className: "wpd-agenda" },
						steps.map((step) => h(
							"li",
							{ key: step.n, style: { "--wpbi-ink": planInk(step.glyph) } },
							h("span", { className: "wpd-agendano" }, String(step.n).padStart(2, "0")),
							h("span", { className: "wpd-agendatitle" }, step.title),
							h("span", { className: "wpd-agendado" }, String(step.do ?? "").slice(0, 34))
						))
					)
				);
			} else if (current !== undefined && current.kind === "step") {
				const step = current.step;
				const rows = [
					{ label: t("plan.rowDo"), text: planCleanDo(step.do, t), risk: false },
					{ label: t("plan.rowWhy"), text: step.why, risk: false },
					{ label: t("plan.rowFiles"), text: step.files, risk: false },
					{ label: t("plan.rowRisk"), text: step.risk, risk: true }
				].filter((row) => String(row.text ?? "").trim() !== "");
				body = h(
					"div",
					{ className: "wpd-slide", style: { "--wpbi-ink": planInk(step.glyph) } },
					h(
						"div",
						{ className: "wpd-slidehead" },
						h("span", { className: "wpd-slideno" }, String(current.index + 1).padStart(2, "0")),
						h("div", null,
							h("h2", { className: "wpd-slidetitle" }, step.title),
							h("p", { className: "wpd-slidepos" }, `${t("plan.deckStepOf")} ${current.index + 1} / ${steps.length}`)
						)
					),
					h(
						"ul",
						{ className: "wpd-slidefacts" },
						rows.map((row, i) => h(
							"li",
							{ key: row.label, className: `${row.risk ? "is-risk" : ""}${i < shown ? " is-shown" : ""}` },
							h("b", null, row.label),
							row.text
						))
					),
					shown < rows.length ? h("span", { className: "wpd-more" }, t("plan.deckPressMore")) : null
				);
			} else if (current !== undefined && current.kind === "detail") {
				body = h(
					"div",
					{ className: "wpd-slide" },
					h("h2", { className: "wpd-slidetitle" }, `${t("plan.deckStepOf")} ${current.index + 1} · ${t("plan.deckDetail")}`),
					h("pre", { className: "wpd-slidedetail" }, current.step.detail)
				);
			} else if (current !== undefined && current.kind === "risks") {
				body = h(
					"div",
					{ className: "wpd-slide" },
					h("h2", { className: "wpd-slidetitle" }, t("plan.deckRisks")),
					h(
						"ul",
						{ className: "wpd-risklist" },
						riskRows.map((step) => h("li", { key: step.n }, h("b", null, `${t("plan.deckStepOf")} ${step.n}`), step.risk, step.retreat ? h("span", { className: "wpd-retreat" }, `→ ${step.retreat}`) : null))
					)
				);
			} else {
				body = h(
					"div",
					{ className: "wpd-slide is-end" },
					h("h2", { className: "wpd-slidetitle" }, t("plan.deckEnd")),
					decisions.length > 0
						? h("div", { className: "wpd-slidedecisions" }, h("b", null, t("plan.decisions")), h("ul", null, decisions.map((decision, i) => h("li", { key: i }, decision.q))))
						: null,
					h("p", { className: "wpd-slidefoot" }, t("plan.footnote"))
				);
			}

			return h(
				"div",
				{ className: `wpd-deck${full ? " is-full" : ""}` },
				h("div", { className: "wpd-progress" }, h("span", { style: { transform: `scaleX(${(index + 1) / total})` } })),
				h("div", { className: "wpd-stage" }, body, art),
				h(
					"div",
					{ className: "wpd-deckbar" },
					h("button", { type: "button", className: "wpd-navbtn", onClick: () => go(-1), disabled: index === 0 && shown === 0 }, "◀"),
					h("span", { className: "wpd-deckcount" }, `${index + 1} / ${total}`),
					h("button", { type: "button", className: "wpd-navbtn", onClick: () => go(1), disabled: index === total - 1 && shown >= rowsOf(current) }, "▶"),
					h("span", { className: "wpd-dots" }, slides.map((slideDef, i) => h("button", { key: i, type: "button", className: `wpd-dot${i === index ? " is-on" : ""}`, "aria-label": `${t("plan.kicker")} ${i + 1}`, onClick: () => { setShown(0); setSlide(i); } }))),
					h("button", { type: "button", className: "wpd-fullbtn", onClick: () => setFull((value) => !value) }, full ? t("plan.deckExitFull") : t("plan.deckFull"))
				)
			);
		}

		function PlanBookBody(props) {
			const t = props.t;
			const plan = props.plan;
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const decisions = Array.isArray(plan.decisions) ? plan.decisions : [];
			const [view, setView] = React.useState("prose");
			const [picked, setPicked] = React.useState("");
			const [folded, setFolded] = React.useState("");
			const layout = planDiagramLayout(steps);
			const fileCount = steps.reduce((sum, step) => sum + (String(step.files ?? "").trim() === "" ? 0 : 1), 0);
			const riskCount = steps.reduce((sum, step) => sum + (String(step.risk ?? "").trim() === "" ? 0 : 1), 0);
			const foldedCount = steps.reduce((sum, step) => sum + (String(step.detail ?? "").trim() === "" ? 0 : 1), 0);
			const current = steps.find((step) => String(step.n) === picked) ?? steps[0];

			return h(
				"section",
				{ className: `wpb2-body${props.compact === true ? " is-compact" : ""}${view === "prose" ? " is-prose" : ""}`, "data-plan-body": plan.callId },
				// 顶部：海报版（正文）时收成报头一行 —— 标题与一句话由下面那张海报当主角，不重复摆一遍
				h(
					"header",
					{ className: "wpb2-head" },
					h(
						"div",
						{ className: "wpb2-headtext" },
						h("span", { className: "wpb2-kicker" }, t("plan.kicker")),
						h("h3", { className: "wpb2-title" }, plan.title),
						view === "prose" ? null : (plan.oneLine ? h("p", { className: "wpb2-oneline" }, planCleanOne(plan.oneLine)) : null),
						h(
							"p",
							{ className: "wpb2-meta" },
							`${steps.length} ${t("plan.stepsUnit")}`,
							fileCount > 0 ? ` · ${fileCount} ${t("plan.statFiles")}` : null,
							riskCount > 0 ? ` · ${riskCount} ${t("plan.statRisks")}` : null,
							foldedCount > 0 ? ` · ${foldedCount} ${t("plan.statDetails")}` : null
						)
					),
					view !== "prose" && Object.values(PLAN_SCENES).length > 0
						? h("span", { className: "wpb2-heart" }, h("img", { className: "wpb2-artimg", src: Object.values(PLAN_SCENES)[0], width: 150, height: 150, alt: "", "aria-hidden": "true" }))
						: null
				),
				// 视图切换：汇报稿（默认）/ 流程图
				h(
					"div",
					{ className: "wpd-viewtabs" },
					h("button", { type: "button", className: `wpd-viewtab${view === "prose" ? " is-on" : ""}`, onClick: () => setView("prose") }, t("plan.viewProse")),
					h("button", { type: "button", className: `wpd-viewtab${view === "deck" ? " is-on" : ""}`, onClick: () => setView("deck") }, t("plan.viewDeck")),
					h("button", { type: "button", className: `wpd-viewtab${view === "diagram" ? " is-on" : ""}`, onClick: () => setView("diagram") }, t("plan.viewDiagram"))
				),
				view === "prose" ? h(PlanProse, { plan, t }) : null,
				view === "deck" ? h(PlanDeck, { plan, t }) : null,
				// 图：流程图本体（节点 + 箭头 + 退路支线 + 会碰的东西）
				view !== "diagram" ? null : h(
					"div",
					{ className: "wpd-wrap" },
					h(
						"svg",
						{ className: "wpd", viewBox: `0 0 ${layout.width} ${layout.height}`, role: "img", "aria-label": `${t("plan.kicker")} ${steps.length} ${t("plan.stepsUnit")}` },
						h("defs", null,
							h("marker", { id: "wpd-arrow", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse" },
								h("path", { d: "M0 0L10 5L0 10z", fill: "currentColor", opacity: "0.5" }))),
						// 图例：先告诉人"这些线是什么意思"
						h("g", { className: "wpd-legend" },
							h("line", { className: "wpd-legendlink", x1: layout.x, y1: 10, x2: layout.x + 26, y2: 10, markerEnd: "url(#wpd-arrow)" }),
							h("text", { x: layout.x + 34, y: 14 }, t("plan.legendOrder")),
							h("line", { className: "wpd-riskline", x1: layout.x + 168, y1: 10, x2: layout.x + 194, y2: 10 }),
							h("text", { x: layout.x + 202, y: 14 }, t("plan.legendRisk"))),
						// 开始标记
						h("g", { className: "wpd-term" }, h("circle", { cx: layout.start.x, cy: layout.start.y, r: 4 }), h("text", { x: layout.start.x + 12, y: layout.start.y + 4 }, t("plan.diagStart"))),
						// 主轴连线
						layout.links.map((link, index) => h("line", { key: `l${index}`, className: "wpd-link", x1: link.x1, y1: link.y1, x2: link.x2, y2: link.y2, markerEnd: "url(#wpd-arrow)" })),
						// 步骤节点
						layout.nodes.map((node) => h(
							"g",
							{ key: `n${node.n}`, className: `wpd-node${String(current?.n) === String(node.n) ? " is-picked" : ""}`, style: { "--wpbi-ink": node.ink }, onClick: () => setPicked(String(node.n)), role: "button", tabIndex: 0 },
							h("rect", { className: "wpd-box", x: node.x, y: node.y, width: node.w, height: node.h, rx: 12 }),
							h("rect", { className: "wpd-bar", x: node.x, y: node.y, width: 5, height: node.h, rx: 2.5 }),
							h("text", { className: "wpd-no", x: node.x + 20, y: node.y + node.h / 2 + 1 }, String(node.n).padStart(2, "0")),
							h("text", { className: "wpd-title", x: node.x + 58, y: node.y + 34 }, node.title.length > 20 ? `${node.title.slice(0, 20)}…` : node.title),
							h("text", { className: "wpd-sub", x: node.x + 58, y: node.y + 58 }, node.do === "" ? t("plan.diagNoLine") : (node.do.length > 30 ? `${node.do.slice(0, 30)}…` : node.do))
							,
							node.files === "" ? null : h("text", { className: "wpd-files", x: node.x + 58, y: node.y + 76 }, `▸ ${node.files.length > 34 ? `${node.files.slice(0, 34)}…` : node.files}`)
						)),
						// 会碰的东西（节点下方小字）

						// 「万一」支线：虚线 + 琥珀框（这就是"退路"画在图上）
						layout.risks.map((risk, index) => h(
							"g",
							{ key: `r${index}`, className: "wpd-risk" },
							h("path", { className: "wpd-riskline", d: `M${risk.fromX} ${risk.fromY} H${risk.x - 12} V${risk.y + risk.h / 2} H${risk.x}`, markerEnd: "url(#wpd-arrow)" }),
							h("rect", { className: "wpd-riskbox", x: risk.x, y: risk.y, width: risk.w, height: risk.h, rx: 10 }),
							h("text", { className: "wpd-risklabel", x: risk.x + 10, y: risk.y + 18 }, t("plan.riskWord")),
							h("text", { className: "wpd-risktext", x: risk.x + 10, y: risk.y + 35 }, risk.text.length > 22 ? `${risk.text.slice(0, 22)}…` : risk.text)
						)),
						// 终点：批准后执行
						h("g", { className: "wpd-term" }, h("circle", { cx: layout.end.x, cy: layout.end.y, r: 4 }), h("text", { x: layout.end.x + 12, y: layout.end.y + 4 }, t("plan.diagEnd")))
					)
				),
				// 文字退居次要：点哪个节点，这里显示那一步的完整说明
				view !== "diagram" || current === undefined ? null : h(
					"div",
					{ className: "wpd-detail" },
					h("div", { className: "wpd-dethead" }, h("span", { className: "wpd-detno" }, String(current.n).padStart(2, "0")), h("span", { className: "wpd-dettitle" }, current.title)),
					h(
						"div",
						{ className: "wpb2-facts" },
						current.do ? h("div", { className: "wpb2-factrow" }, h("span", { className: "wpb2-factlabel" }, t("plan.rowDo")), h("span", { className: "wpb2-factvalue" }, planCleanDo(current.do, t))) : null,
						current.why ? h("div", { className: "wpb2-factrow" }, h("span", { className: "wpb2-factlabel" }, t("plan.rowWhy")), h("span", { className: "wpb2-factvalue" }, current.why)) : null,
						current.files ? h("div", { className: "wpb2-factrow" }, h("span", { className: "wpb2-factlabel" }, t("plan.rowFiles")), h("span", { className: "wpb2-factvalue" }, current.files)) : null,
						current.risk ? h("div", { className: "wpb2-factrow is-risk" }, h("span", { className: "wpb2-factlabel" }, t("plan.rowRisk")), h("span", { className: "wpb2-factvalue" }, current.risk)) : null
					),
					current.detail
						? h(
							"div",
							{ className: "wpb2-detailbox" },
							h("button", { type: "button", className: "wpb2-more", onClick: () => setFolded(folded === String(current.n) ? "" : String(current.n)) }, folded === String(current.n) ? t("plan.hideDetail") : t("plan.showDetail")),
							folded === String(current.n) ? h("pre", { className: "wpb2-detail" }, current.detail) : null
						)
						: null
				),
				// 「要你定的」+ 脚注：正文版自己安静地讲（在第一屏），只有汇报稿/流程图还沿用这里的色块版
				view === "prose" ? null : decisions.length > 0
					? h("div", { className: "wpb2-decisions" }, h("b", null, t("plan.decisions")), h("ul", null, decisions.map((decision, index) => h("li", { key: index }, decision.q))))
					: null,
				view === "prose" ? null : h("p", { className: "wpb2-foot" }, t("plan.footnote"))
			);
		}

		/**
		 * 右侧大框里的计划页（官方机制：sidebarRightTabs 按地址模式把这一格派给我们的 key）。
		 * @param props - 插槽给的 sessionId / tab（导航信息）/ useProjection + 我们注入的 t。
		 * @returns 计划正文，或诚实的空/缺失提示。
		 */
		function PlanBookPane(props) {
			const t = props.t;
			const useProjection = props.useProjection;
			const book = typeof useProjection === "function" ? useProjection(PLAN_BOOK_KEY) : undefined;
			if (typeof useProjection !== "function") return h("div", { className: "wpb2-pane" }, h("p", { className: "wpb-hint" }, t("plan.noHook")));
			const plans = Array.isArray(book?.plans) ? book.plans : null;
			const wanted = planPaneCallId(props.tab?.tab?.navigation);
			const plan = (wanted === undefined ? undefined : (plans ?? []).find((item) => item.callId === wanted)) ?? (plans ?? [])[(plans ?? []).length - 1];
			return h(
				"div",
				{ className: "wpb2-pane" },
				plans === null
					? h("p", { className: "wpb-hint" }, t("plan.unavailable"))
					: plan === undefined
						? h("p", { className: "wpb2-empty" }, t("plan.paneEmpty"))
						: h(PlanBookBody, { plan, t })
			);
		}

		/**
		 * 会话标题栏的常驻入口（list 插槽，用自己的新 id）：有计划时显示「计划 · N 步」，点一下在右侧大框打开。
		 * 为什么需要它：摘要卡只在"提交计划的那一轮"里，翻历史很难找 —— 常驻入口让"在哪看"不再是问题。
		 * @param props - useProjection / sessionId / openPlanPane + 注入的 t。
		 * @returns 按钮或 null（没有计划时不占位）。
		 */
		function PlanBookHeaderAction(props) {
			const t = props.t;
			const useProjection = props.useProjection;
			const [failed, setFailed] = React.useState(false);
			const book = typeof useProjection === "function" ? useProjection(PLAN_BOOK_KEY) : undefined;
			const plans = Array.isArray(book?.plans) ? book.plans : [];
			if (plans.length === 0) return null;
			const plan = plans[plans.length - 1];
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const sessionId = typeof props.sessionId === "string" ? props.sessionId : props.sessionId?.sessionId;
			const onClick = () => {
				const address = `${PLAN_PANE_SCHEME}${encodeURIComponent(String(sessionId ?? ""))}/${encodeURIComponent(plan.callId)}`;
				const opened = typeof props.openPlanPane === "function" ? props.openPlanPane(address, plan) : false;
				setFailed(opened !== true);
			};
			return h(
				"button",
				{
					type: "button",
					className: `wpb3-entry${failed ? " is-failed" : ""}`,
					title: failed ? t("plan.paneUnavailable") : t("plan.open"),
					onClick
				},
				h("span", { className: "wpb3-entrydot", "aria-hidden": "true" }),
				h("span", null, `${t("plan.kicker")} · ${steps.length}`),
				h("span", { className: "wpb3-entryhint" }, failed ? t("plan.paneUnavailableShort") : t("plan.openShort"))
			);
		}

		/**
		 * 对话尾那一格：计划摘要（标题 + 一句话 + 步骤目录 + 色带）+「在右侧打开」。
		 * 右侧打不开（服务缺席）时就地展开同一份正文 —— 不让你白点。
		 * @param props - 插槽给的 turn/seq/sessionId + useProjection + 注册闭包注入的 t 与 openPlanPane。
		 * @returns 摘要卡片；本轮没有计划时返回 null。
		 */
		function PlanBookStrip(props) {
			const t = props.t;
			const useProjection = props.useProjection;
			const [inline, setInline] = React.useState(false);
			const [failNote, setFailNote] = React.useState(false);
			const book = typeof useProjection === "function" ? useProjection(PLAN_BOOK_KEY) : undefined;
			const mode = typeof useProjection === "function" ? useProjection("plan") : undefined;

			if (typeof useProjection !== "function") {
				return h("div", { className: "wpb-hint" }, t("plan.noHook"));
			}
			const plans = Array.isArray(book?.plans) ? book.plans : null;
			if (plans === null) {
				return mode?.active === true ? h("div", { className: "wpb-hint" }, t("plan.unavailable")) : null;
			}
			const turnNo = props.turn?.turn;
			const mine = plans.filter((plan) => turnNo === undefined || plan.turn === turnNo);
			if (mine.length === 0) return null;
			const plan = mine[mine.length - 1];
			const steps = Array.isArray(plan.steps) ? plan.steps : [];
			const sessionId = typeof props.sessionId === "string" ? props.sessionId : props.sessionId?.sessionId;
			const openPane = () => {
				const address = `${PLAN_PANE_SCHEME}${encodeURIComponent(String(sessionId ?? ""))}/${encodeURIComponent(plan.callId)}`;
				const opened = typeof props.openPlanPane === "function" ? props.openPlanPane(address, plan) : false;
				if (opened === true) { setFailNote(false); return; }
				setFailNote(true);
				setInline(true);
			};

			return h(
				React.Fragment,
				null,
				h(
					"section",
					{ className: "wpb2-cover", "data-plan-book": plan.callId, "aria-label": t("plan.aria") },
					h(
						"div",
						{ className: "wpb2-coverhead" },
						h("span", { className: "wpb2-kicker" }, `${t("plan.kicker")} · ${steps.length} ${t("plan.stepsUnit")}`),
						h("h4", { className: "wpb2-covertitle" }, plan.title),
						plan.oneLine ? h("p", { className: "wpb2-oneline" }, planCleanOne(plan.oneLine)) : null,
						mine.length > 1 ? h("span", { className: "wpb2-note" }, `${mine.length} ${t("plan.multi")}`) : null
					),
					h(
						"ol",
						{ className: "wpb2-toc" },
						steps.map((step) =>
							h(
								"li",
								{ className: "wpb2-tocitem", key: String(step.n), style: { "--wpb-hue": String(planHue(step.glyph)) } },
								h("span", { className: "wpb2-tocdot" }),
								h("span", { className: "wpb2-tocno" }, String(step.n)),
								h("span", { className: "wpb2-toctitle" }, step.title),
								h("span", { className: "wpb2-tocmini" }, planCleanDo(step.do, t).slice(0, 22))
							)
						)
					),
					h("div", { className: "wpb2-band" }, steps.map((step) => h("span", { key: step.n, className: "wpb2-bandcell", style: { "--wpb-hue": String(planHue(step.glyph)) } }))),
					h(
						"div",
						{ className: "wpb2-coverfoot" },
						h("button", { type: "button", className: "wpb2-open", onClick: openPane }, t("plan.open")),
						h("button", { type: "button", className: "wpb2-inline", onClick: () => setInline((value) => !value) }, inline ? t("plan.collapse") : t("plan.expand")),
						h("span", { className: "wpb2-hint" }, failNote ? t("plan.paneUnavailable") : t("plan.openHint"))
					)
				),
				inline ? h(PlanBookBody, { plan, t, compact: true }) : null
			);
		}

		/**
		 * 「试作」页：一页纸的设计样本（深墨蓝 + 一束光 + 稿纸网格）。
		 * 这是"抛开 plan 单独做的审美试作"，内容不接任何数据，只用来判断审美方向。
		 * @param props - 插槽给的 props + 注入的 t。
		 * @returns 试作正文。
		 */
		function AuditionPage(props) {
			const rows = [
				{ n: "01", t: "记忆库", d: "把有价值的判断沉淀成原子，连成关系图；每轮自动召回，不用你记任何命令", k: "已上线" },
				{ n: "02", t: "计划视图", d: "把计划从「一坨 markdown」变成一眼能看懂的步骤；批准仍走官方按钮", k: "迭代中" },
				{ n: "03", t: "能力库", d: "技能的卡片墙：中文名、图标、一句话、点开看怎么用", k: "已上线" },
				{ n: "04", t: "设计技能", d: "从公开仓库搬来两份「怎么做出高级感」，改写成这套工作台的规矩", k: "已上线" }
			];
			const rays = [
				{ x2: 560, y2: -160, far: false, delay: ".10s" },
				{ x2: 760, y2: -60, far: false, delay: ".16s" },
				{ x2: 860, y2: 160, far: false, delay: ".22s" },
				{ x2: 860, y2: 420, far: false, delay: ".28s" },
				{ x2: 700, y2: 700, far: true, delay: ".34s" },
				{ x2: 420, y2: 760, far: true, delay: ".40s" },
				{ x2: 120, y2: 620, far: true, delay: ".46s" },
				{ x2: 60, y2: 300, far: true, delay: ".52s" },
				{ x2: 200, y2: 40, far: false, delay: ".58s" }
			];
			return h(
				"div",
				{ className: "ah-sheet" },
				h("div", { className: "ah-masthead" }, h("span", null, "个人工作台 · 常驻值守"), h("span", null, "个人工作台 · 2026")),
				h(
					"header",
					{ className: "ah-hero" },
					h(
						"div",
						{ className: "ah-lamp", "aria-hidden": "true" },
						h(
							"svg",
							{ viewBox: "0 0 800 800" },
							h("g", null,
								h("circle", { className: "ah-ring", cx: 560, cy: 240, r: 120 }),
								h("circle", { className: "ah-ring", cx: 560, cy: 240, r: 190 }),
								h("circle", { className: "ah-ring", cx: 560, cy: 240, r: 266 }),
								h("circle", { className: "ah-ring ah-ring-outer", cx: 560, cy: 240, r: 350 })),
							h("g", null, rays.map((ray, index) => h("line", { key: index, className: `ah-ray${ray.far ? " is-far" : ""}`, x1: 560, y1: 240, x2: ray.x2, y2: ray.y2, style: { animationDelay: ray.delay } }))),
							h("circle", { cx: 560, cy: 240, r: 5, fill: "#e9a94a" })
						)
					),
					h("p", { className: "ah-role" }, h("b", null, "在岗"), " 常驻值守 · 个人工作台主控"),
					h("h1", { className: "ah-name" }, "个人工作台", h("span", { className: "ah-dot" }, "。")),
					h("p", { className: "ah-lede" }, "名字取自一盏灯：", h("em", null, "灯一直亮着，所以人一直在"), "。", h("br", null), "我不写诗，我做活 —— 把事做完、把账记清、把话说准。"),
					h("p", { className: "ah-scroll" }, "向下 / SCROLL")
				),
				h(
					"section",
					{ className: "ah-sec" },
					h("div", { className: "ah-head" }, h("h2", null, "我信什么"), h("span", null, "01 / CREED")),
					h(
						"p",
						{ className: "ah-creed" },
						"不猜你的意思，", h("b", null, "先做不依赖猜测的那部分"), "。", h("br", null),
						"不把「看起来完成了」当成完成 —— ", h("b", null, "能复现的才算数"), "。", h("br", null),
						"改坏了能退回，说错了能改口，", h("s", null, "唯独不装作没发生"), "。"
					)
				),
				h(
					"section",
					{ className: "ah-sec" },
					h("div", { className: "ah-head" }, h("h2", null, "手上有什么"), h("span", null, "02 / INVENTORY")),
					h(
						"div",
						{ className: "ah-figures" },
						h("div", { className: "ah-fig" }, h("b", null, "08"), h("i", null, "SKILLS"), h("u", null, "可复用的做法，按需加载")),
						h("div", { className: "ah-fig" }, h("b", null, "50"), h("i", null, "ATOMS"), h("u", null, "沉淀下来的判断，只增不改")),
						h("div", { className: "ah-fig" }, h("b", null, "06"), h("i", null, "PLUGINS"), h("u", null, "挂在插件树上的本机插件")),
						h("div", { className: "ah-fig" }, h("b", null, "1"), h("i", null, "LAMP"), h("u", null, "灯，一直亮着"))
					)
				),
				h(
					"section",
					{ className: "ah-sec" },
					h("div", { className: "ah-head" }, h("h2", null, "最近在做"), h("span", null, "03 / WORK")),
					h("div", { className: "ah-rows" }, rows.map((row) => h(
						"div",
						{ className: "ah-row", key: row.n },
						h("span", { className: "ah-n" }, row.n),
						h("span", { className: "ah-t" }, row.t),
						h("span", { className: "ah-d" }, row.d),
						h("span", { className: "ah-k" }, row.k)
					)))
				),
				h("footer", { className: "ah-foot" }, h("p", null, "灯要是灭了，你喊我一声。"), h("small", null, "LONG MING · WORKBENCH · 2026"))
			);
		}

		function apply(ctx) {
			const translate = ctx.locale.bind(LOCALE_NS);

			/**
			 * 查文案：字典查不到时回落到内置中文，避免渲染裸 key。
			 * @param key - 字典 key。
			 * @returns 当前语言下的文案。
			 */
			function t(key) {
				try {
					const value = translate(key);
					if (typeof value === "string" && value.length > 0 && value !== key) return value;
				} catch (error) {
					console.error(`[${PLUGIN_NAME}] 文案查询失败：${key}`, error);
				}
				return DICT_ZH[key] ?? key;
			}

			/**
			 * 把计划作为资源在右侧大框打开（官方机制：sidebarRight.openResource）。
			 * 迟到取服务（apply 时拿不到），失败返回 false，卡片会就地展开。
			 * @param address - 我们的资源地址 dsh-resource://plan-book/<sessionId>/<callId>。
			 * @returns 是否成功交给右侧面板。
			 */
			function openPlanPane(address) {
				try {
					const sidebarRight = ctx.get("sidebarRight");
					if (sidebarRight === undefined || typeof sidebarRight.openResource !== "function") return false;
					sidebarRight.openResource(address);
					return true;
				} catch (error) {
					console.warn(`[${PLUGIN_NAME}] 右侧面板打不开，改为就地展开：`, error);
					return false;
				}
			}

			/**
			 * 收集可用会话 id（客户端各服务返回结构不一，按几种可能形状都试）。
			 * @returns 去重后的 sessionId 数组。
			 */
			async function collectSessionIds() {
				const out = [];
				const notes = [];
				const add = (value) => {
					const source = Array.isArray(value) ? value
						: Array.isArray(value?.rows) ? value.rows
							: Array.isArray(value?.sessions) ? value.sessions
								: Array.isArray(value?.items) ? value.items : [];
					for (const item of source) {
						const id = item?.sessionId ?? item?.id ?? (typeof item === "string" ? item : undefined);
						if (typeof id === "string" && id.length > 0 && !out.includes(id)) out.push(id);
					}
				};
				const candidates = [];
				const digProps = (service, label) => {
					for (const key of ["snapshot", "store", "state", "value", "current", "active", "activeId", "currentId", "currentSessionId", "activeSessionId"]) {
						try {
							const value = service[key];
							if (typeof value === "string" && value.length > 0) add([value]);
							else if (value !== undefined && value !== null && typeof value !== "function") add(value);
						} catch {}
					}
				};
				try { candidates.push(ctx.get("sessions")); } catch {}
				try {
					const workspace = ctx.get("uiWorkspace");
					if (workspace !== undefined && workspace !== null) candidates.push(workspace.sessions, workspace);
				} catch {}
				const labels = ["sessions", "uiWorkspace.sessions", "uiWorkspace"];
				for (const [index, service] of candidates.entries()) {
					const label = labels[index] ?? `来源${index}`;
					if (service === undefined || service === null) {
						notes.push(`来源${index}=无`);
						continue;
					}
					const keys = [];
					for (const key of ["list", "snapshot", "all", "recent", "sessions"]) {
						if (typeof service[key] !== "function") continue;
						keys.push(key);
						try {
							const value = await service[key]();
							add(value);
							notes.push(`${key}()→${Array.isArray(value) ? `数组[${value.length}]` : `对象{${Object.keys(value ?? {}).slice(0, 6).join(",")}}`}`);
						} catch (error) {
							notes.push(`${key}()→报错:${String(error).slice(0, 40)}`);
						}
					}
					if (keys.length === 0) notes.push(`来源${index}→无方法，键=${Object.keys(service).slice(0, 8).join(",")}（${label}）`);
					digProps(service, `来源${index}`);
				}
				collectSessionIds.lastNotes = notes;
				return out;
			}

			/**
			 * 递归扫形状把会话 id 抠出来（深度 4）。
			 *
			 * 为什么不用"调方法"：实测 `sessions` 服务的 `list` 存在但**不是函数**（是数据对象），
			 * `useSessions` 返回的形状也不固定 —— 所以只能扫；扫不出时把**每一层的形状**都记下来，
			 * 让下一次失败能直接看出会话藏在哪个键里。
			 *
			 * @param roots - 可能藏会话的根对象数组。
			 * @returns `{ ids, notes }`：抠出的 id 与遍历日志。
			 */
			function harvestSessionIds(roots) {
				/**
				 * 安全读属性：Cordis 的服务代理对未声明 inject 的属性会**抛错**
				 * （实测报错 `cannot get property "sessionId" without inject`），所以每次读都要兜住。
				 * @param object - 目标对象。
				 * @param key - 属性名。
				 * @returns 读到的值；抛错或不存在时返回 undefined。
				 */
				const safeGet = (object, key) => {
					try {
						return object[key];
					} catch {
						return undefined;
					}
				};
				const strict = [];
				const loose = [];
				const seen = new Set();
				const notes = [];
				const GETTERS = ["get", "list", "all", "values", "toArray", "entries", "snapshot", "current", "active"];
				const KEYS = ["value", "snapshot", "rows", "sessions", "items", "list", "all", "entries", "current", "active", "activeId", "currentId", "currentSessionId", "activeSessionId", "manager", "scopes", "data", "rootCtx", "store", "stores", "state", "collection", "registry", "byId", "order", "last", "latest", "recent", "selected", "visible"];
				const visit = (value, depth, path) => {
					if (depth > 4 || value === null || value === undefined || value === true || value === false) return;
					if (typeof value === "string") {
						if (value.length >= 6 && /^[A-Za-z0-9_-]+$/u.test(value)) loose.push(value);
						return;
					}
					if (typeof value === "number" || typeof value === "function") return;
					let isMap = false;
					let isSet = false;
					let isArray = false;
					try {
						isMap = value instanceof Map;
						isSet = !isMap && value instanceof Set;
						isArray = !isMap && !isSet && Array.isArray(value);
					} catch {
						return;
					}
					if (isMap) {
						notes.push(`${path}=Map[${value.size}]`);
						try {
							let i = 0;
							for (const item of value.values()) {
								if (i++ > 40) break;
								visit(item, depth + 1, `${path}{map}`);
							}
						} catch {
							notes.push(`${path}=Map(读取失败)`);
						}
						return;
					}
					if (isSet) {
						notes.push(`${path}=Set[${value.size}]`);
						try {
							let i = 0;
							for (const item of value.values()) {
								if (i++ > 40) break;
								visit(item, depth + 1, `${path}{set}`);
							}
						} catch {
							notes.push(`${path}=Set(读取失败)`);
						}
						return;
					}
					if (isArray) {
						notes.push(`${path}=数组[${value.length}]`);
						value.slice(0, 40).forEach((item, index) => visit(item, depth + 1, `${path}[${index}]`));
						return;
					}
					if (typeof value !== "object") return;
					const id = safeGet(value, "sessionId") ?? safeGet(value, "session_id") ?? safeGet(value, "id") ?? safeGet(value, "key") ?? safeGet(value, "agentId") ?? safeGet(value, "session");
					if (typeof id === "string" && id.length >= 2) {
						notes.push(`${path}→有 id`);
						if (!seen.has(id)) {
							seen.add(id);
							strict.push(id);
						}
					}
					let keys = [];
					try {
						keys = Object.keys(value);
					} catch {
						keys = [];
					}
					notes.push(`${path}{${keys.slice(0, 7).join(",")}}`);
					for (const key of [...KEYS, ...keys.filter((k) => GETTERS.includes(k) && !KEYS.includes(k))]) {
						let child = safeGet(value, key);
						if (typeof child === "function") {
							// 名字像 getter 就试调一下（零参），失败就算了
							if (!GETTERS.includes(key)) continue;
							try {
								child = child.call(value);
							} catch {
								continue;
							}
						}
						if (child === undefined || child === null) continue;
						visit(child, depth + 1, `${path}.${key}`);
					}
				};
				roots.forEach((root, index) => {
					const before = strict.length;
					visit(root, 0, `来源${index}`);
					notes.push(`来源${index}→+${strict.length - before}`);
				});
				return { ids: strict.length > 0 ? strict : [...new Set(loose)].slice(0, 5), notes: notes.slice(0, 22) };
			}
			/** 收集可能藏会话的来源：props 状态 + 各服务。 */
			function sessionRoots(panelState) {
				const roots = [panelState];
				for (const serviceName of ["sessions", "uiWorkspace", "commandUi"]) {
					try {
						roots.push(ctx.get(serviceName));
					} catch {}
				}
				try {
					const workspace = ctx.get("uiWorkspace");
					if (workspace !== undefined && workspace !== null) roots.push(workspace.sessions);
				} catch {}
				return roots;
			}

			// conversation 服务（官方公开 API）：把一句话送进会话 —— 页面按钮借它触发命令。
			let conversationSend = null;
			const adoptConversation = (service) => {
				if (service !== null && service !== undefined && typeof service.send === "function") {
					conversationSend = (text) => service.send(text);
					return true;
				}
				return false;
			};
			let conversationAdopted = false;
			try {
				if (typeof ctx.get === "function") conversationAdopted = adoptConversation(ctx.get("conversation"));
			} catch {}
			if (!conversationAdopted && typeof ctx.inject === "function") {
				ctx.inject(["conversation"], (scoped) => {
					adoptConversation(scoped?.conversation);
				});
			}

			// 带 commandUi + remote 权限的**作用域**：调用时用 `scoped.commandUi.execute(...)`
			// （点属性，不是 get()；get() 会拿回绑根 fiber 的代理 —— 前两次就是这么栽的）
			// conversation / uiConversation 在根作用域可能取不到 → 同时挂带它们权限的作用域（点属性取）
			let dialogScope = null;
			if (typeof ctx.inject === "function") {
				ctx.inject(["conversation", "uiConversation"], (scoped) => {
					dialogScope = scoped;
				});
			}

			let commandScope = null;
			if (typeof ctx.inject === "function") {
				ctx.inject(["commandUi", "remote"], (scoped) => {
					commandScope = scoped;
				});
			}

			/** 安全取服务：先试根作用域的 `get()`，再试带权限作用域的**点属性**（两类坑都兜住）。 */
			function serviceOf(name) {
				try {
					const direct = ctx.get(name);
					if (direct !== undefined && direct !== null) return direct;
				} catch {}
				if (dialogScope !== null) {
					try {
						const scopedService = dialogScope[name];
						if (scopedService !== undefined && scopedService !== null) return scopedService;
					} catch {}
				}
				return undefined;
			}

			/**
			 * 点按钮时按优先级试四条路，并回报**哪条成功**（成功路径显示在卡片上）。
			 *
			 * ① 公开 API：`uiConversation.binding(会话id).ctx` → `conversation.input.for(actx)`
			 *    → `setDraft(命令)` + `submit()` —— 等于在该会话输入框里敲下这条命令并回车
			 *    （用法照抄官方：`conversation.input.for(actx).focus()`）。
			 * ② 带 `commandUi + remote` 权限作用域里的 `scoped.commandUi.execute(...)`。
			 * ③ 公开 API `conversation.send(...)`（需要会话作用域，可能被拒）。
			 * ④ 复制到剪贴板（兜底，绝不出现"点了没反应"）。
			 *
			 * @param line - 命令行，如 `/skill-menu remove ui-polish`。
			 * @param panelState - 面板拿到的会话状态（用于扫会话 id）。
			 * @returns `{ via, detail }`：via 非空即成功；否则 detail 逐条说明原因。
			 */
			async function runToggle(line, panelState) {
				const notes = [];
				const harvested = harvestSessionIds(sessionRoots(panelState));
				const ids = harvested.ids;

				// ① 会话输入框：写草稿 + 提交（**照官方配方**）
				//    官方源码（dsh-client-ui-commands）：
				//      const binding = sessions.binding(session.sessionId);
				//      binding.ctx.get("conversation").input.for(binding.ctx).focus();
				//    要点：会话作用域 ctx 来自 **sessions.binding(id).ctx**（不是 uiConversation.binding！），
				//    并且要通过它去 get("conversation")。
				const sessions = serviceOf("sessions");
				if (sessions !== undefined && sessions !== null && typeof sessions.binding === "function" && ids.length > 0) {
					for (const id of ids) {
						try {
							const binding = sessions.binding(id);
							const actx = binding === undefined || binding === null ? undefined : binding.ctx;
							if (actx === undefined) {
								notes.push(`input：${String(id).slice(0, 8)}… binding 上没有 ctx`);
								continue;
							}
							const sessionConversation = typeof actx.get === "function" ? actx.get("conversation") : undefined;
							// 硬闸：先确认该会话的命令清单里有 skill-menu —— 否则提交会被当普通文本发成消息。
							// （这就是"点按钮却冒出一条消息"的根因：命令清单按会话缓存，认不出这条命令。）
							const commandDir = serviceOf("command");
							let catalogKnown = false;
							if (commandDir !== undefined && commandDir !== null && typeof commandDir.list === "function") {
								try {
									const catalog = await commandDir.list({ sessionId: id });
									catalogKnown = JSON.stringify(catalog ?? null).includes("skill-menu");
								} catch (error) {
									notes.push(`清单查询失败：${String(error?.message ?? error).slice(0, 40)}`);
								}
							}
							if (!catalogKnown) {
								notes.push("该会话的命令清单里还没有 skill-menu —— 不提交（否则会变成一条消息）");
								continue;
							}
							const input = sessionConversation === undefined || sessionConversation === null ? undefined : sessionConversation.input?.for?.(actx);
							if (input === undefined) {
								notes.push("input：会话作用域里取不到 conversation.input");
								continue;
							}
							input.setDraft(line);
							// 关键：等草稿真的落进编辑器再提交 —— 否则命令认领可能还没完成，
							// 提交会退化成"当普通文本发出去"（实测：同一个按钮，一次执行、一次变成消息）。
							await new Promise((resolve) => setTimeout(resolve, 220));
							input.submit();
							return { via: "会话输入框", detail: "" };
						} catch (error) {
							notes.push(`input：${String(error?.message ?? error).slice(0, 60)}`);
						}
					}
				} else {
					notes.push(`input：${ids.length === 0 ? "没扫到会话" : "sessions.binding 不可用"}`);
				}

				// ② 带权限作用域里的 commandUi.execute
				if (commandScope !== null && ids.length > 0) {
					try {
						await commandScope.commandUi.execute({ sessionId: ids[0] }, line);
						return { via: "commandUi", detail: "" };
					} catch (error) {
						notes.push(`commandUi：${String(error?.message ?? error).slice(0, 60)}`);
					}
				} else {
					notes.push("commandUi：作用域或会话不可用");
				}

				// ③ 公开 API：把指令送进会话
				if (conversationSend !== null) {
					try {
						await conversationSend(line);
						return { via: "send", detail: "" };
					} catch (error) {
						notes.push(`send：${String(error?.message ?? error).slice(0, 60)}`);
					}
				} else {
					notes.push("send：不可用");
				}
				return { via: "", detail: notes.join(" ｜ ") };
			}

			// 目录服务：**迟到绑定**（apply 时它还没激活，见 AGENTS.md）。
			let directory = null;
			const waiters = new Set();
			const announce = () => {
				for (const waiter of [...waiters]) waiter();
			};
			/**
			 * 订阅"服务到达"；已就绪立即回调。返回退订函数。
			 * @param waiter - 服务就绪时的回调。
			 * @returns 退订函数。
			 */
			function subscribe(waiter) {
				if (directory !== null) {
					waiter();
					return () => {};
				}
				waiters.add(waiter);
				return () => {
					waiters.delete(waiter);
				};
			}
			/**
			 * 记下可用的目录调用并叫醒页面。
			 * @param workspace - uiWorkspace 服务面。
			 * @returns 是否装上。
			 */
			function adopt(workspace) {
				if (workspace === undefined || workspace === null || typeof workspace.listDirectory !== "function") return false;
				directory = (path, signal) => workspace.listDirectory(path, signal);
				announce();
				return true;
			}
			let adopted = false;
			try {
				if (typeof ctx.get === "function") adopted = adopt(ctx.get("uiWorkspace"));
			} catch (error) {
				console.warn(`[${PLUGIN_NAME}] 直接取 uiWorkspace 失败，继续尝试迟到绑定：`, error);
			}
			if (!adopted && typeof ctx.inject === "function") {
				ctx.inject(["uiWorkspace"], (scoped) => {
					if (!adopt(scoped?.uiWorkspace)) {
						console.warn(`[${PLUGIN_NAME}] uiWorkspace 已激活但没有 listDirectory，能力库那一段会显示提示。`);
					}
				});
			}

			const styleEl = document.createElement("style");
			styleEl.setAttribute("data-dsh-plugin", PLUGIN_NAME);
			styleEl.textContent = PAGE_CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			}, `${PLUGIN_NAME}: 页面样式`);

			const disposers = [];
			try {
				disposers.push(ctx.locale.register(LOCALE_NS, "zh", DICT_ZH));
				disposers.push(ctx.locale.register(LOCALE_NS, "en", DICT_EN));
			} catch (error) {
				console.error(`[${PLUGIN_NAME}] locale 字典注册失败，改用内置中文兜底：`, error);
			}
			ctx.effect(() => () => {
				for (const dispose of disposers) dispose();
				disposers.length = 0;
				waiters.clear();
			}, `${PLUGIN_NAME}: locale 字典与订阅`);

			// ---- 页面注册（受主机 config 开关约束：关掉的页连插槽都不占） ----
			// 侧边栏入口：id 决定点它时中间栏显示哪个 main key。
			if (pageOn("home")) {
				ctx.slots.inject(PANEL_SLOT, function* () {
					yield ctx.slots.register({ name: PANEL_SLOT, id: PANEL_KEY, order: 5, label: () => t("panel.label") }, (props) =>
						h(PanelIcon, { ...props, label: t("panel.label") })
					);
				});
			}

			// 侧边栏第二个入口：独立的「记忆库」页（id 决定点它时显示哪个 main key）。
			if (pageOn("memory")) {
				ctx.slots.inject(PANEL_SLOT, function* () {
					yield ctx.slots.register({ name: PANEL_SLOT, id: PANEL_KEY_MEMORY, order: 6, label: () => t("mem.panel") }, (props) =>
						h(GraphIcon, { ...props, label: t("mem.panel") })
					);
				});
			}

			// 侧边栏第三个入口：设计试作（id 决定点它时显示哪个 main key）
			if (pageOn("audition")) {
				ctx.slots.inject(PANEL_SLOT, function* () {
					yield ctx.slots.register({ name: PANEL_SLOT, id: PANEL_KEY_AUDITION, order: 7, label: () => t("audition.panel") }, (props) =>
						h(PlanGlyph, { ...props, name: "lamp", size: 16 })
					);
				});
			}

			// 中间栏面板：key 必须与上面的 id 一致；同样按开关逐块注册。
			ctx.slots.inject(MAIN_SLOT, function* () {
				if (pageOn("home")) {
					yield ctx.slots.register({ name: MAIN_SLOT, key: PANEL_KEY }, (props) =>
						h(HomePage, { ...props, t, getDirectory: () => directory, subscribe, runToggle })
					);
				}
				if (pageOn("memory")) {
					yield ctx.slots.register({ name: MAIN_SLOT, key: PANEL_KEY_MEMORY }, (props) =>
						h(MemoryPage, { ...props, t })
					);
				}
				if (pageOn("audition")) {
					yield ctx.slots.register({ name: MAIN_SLOT, key: PANEL_KEY_AUDITION }, (props) =>
						h(AuditionPage, { ...props, t })
					);
				}
			});

			// ---- 计划视图（turn tail 卡 + 会话头部入口 + 右侧标签页）----
			if (pageOn("planBook")) {
				// 计划：对话尾放一张摘要卡（并排挂在官方计划卡下面，不动官方那格）
				ctx.slots.inject(TURN_TAIL_SLOT, function* () {
					yield ctx.slots.register({ name: TURN_TAIL_SLOT, id: PLAN_BOOK_ID, order: 10, label: () => t("plan.kicker") }, (props) =>
						h(PlanBookStrip, { ...props, t, openPlanPane: openPlanPane })
					);
				});

				// 会话标题栏常驻入口（有计划才出现）—— 解决"计划藏在某一轮对话里找不到"
				ctx.slots.inject("conversation.session.header.actions", function* () {
					yield ctx.slots.register({ name: "conversation.session.header.actions", id: PLAN_BOOK_ID, order: 30 }, (props) =>
						h(PlanBookHeaderAction, { ...props, t, openPlanPane: openPlanPane })
					);
				});

				// 右侧大框：按资源地址注册我们自己的标签类型（官方机制），内容由 sidebar.right.pane.tab 派发
				ctx.inject(["sidebarRightTabs"], function (scoped) {
					try {
						scoped.sidebarRightTabs.register({
							id: PLAN_PANE_ID,
							kind: PLAN_PANE_ID,
							priority: "builtin",
							patterns: [`${PLAN_PANE_SCHEME}**`],
							canOpen: (address) => typeof address === "string" && address.startsWith(PLAN_PANE_SCHEME),
							title: () => t("plan.kicker")
						});
					} catch (error) {
						console.warn(`[${PLUGIN_NAME}] 右侧标签类型注册失败（会退化为就地展开）：`, error);
					}
				});
				ctx.slots.inject("sidebar.right.pane.tab", function* () {
					yield ctx.slots.register({ name: "sidebar.right.pane.tab", key: PLAN_PANE_ID }, (props) => h(PlanBookPane, { ...props, t }));
				});
				ctx.slots.inject("sidebar.right.pane.tab.title", function* () {
					yield ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: PLAN_PANE_ID }, () => t("plan.kicker"));
				});
			}
		}

		/**
		 * 桩测出口：把球棍引擎的纯函数交出去（`tools/test-plan-book-strip.mjs` 用它验确定性 / 画家排序 / 拖拽缩放）。
		 * 只暴露纯函数与常量，不带任何 DOM 依赖 —— 在浏览器里这份导出不会被用到。
		 * 注意：**没有 spin** —— 球棍图不自转（用户明确嫌花哨），静止时不跑 rAF。
		 */
		exports.__mem3d = {
			MEM3D_VIEW0: MEM3D_VIEW0,
			MEM3D_SCALE_MIN: MEM3D_SCALE_MIN,
			MEM3D_SCALE_MAX: MEM3D_SCALE_MAX,
			MEM3D_FOCAL: MEM3D_FOCAL,
			MEM3D_S_MIN: MEM3D_S_MIN,
			MEM3D_S_MAX: MEM3D_S_MAX,
			ball: mem3dBall,
			shades: mem3dShades,
			calm: mem3dCalm,
			radius: mem3dRadius,
			project: mem3dProject,
			order: mem3dOrder,
			depth: mem3dDepth,
			draw: mem3dDraw,
			clear: mem3dClear,
			pick: mem3dPick,
			drag: mem3dDrag,
			zoom: mem3dZoom,
			neighbors: mem3dNeighbors,
			shape: mem3dShape,
			axis: mem3dAxis
		};

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});

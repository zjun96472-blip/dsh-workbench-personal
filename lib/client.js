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
		/** 「能力库」独立页的插槽 id / main key（与合集包里它是工作台页内的一个板块不同：本页只放技能卡片墙）。 */
		const PANEL_KEY_LIBRARY = "workbench-skill-library";
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
			"hero.name": "Personal workbench",
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
		/* 空壳快照：本包不含任何个人技能内容；装好后跑 tools/refresh-snapshots.mjs 灌自己的 */
		const SKILL_INDEX = { generatedAt: "", skills: [] };
		/* SKILL-INDEX:END */

		/* ICONS:BEGIN —— 由 tools/gen-icons.mjs 生成（生图 → 96px WebP → base64），勿手改 */
		/* 空壳快照：技能图标 Base64 已清空，卡片退回自绘线稿 */
		const SKILL_ICONS = {};
		/* ICONS:END */

		/* MEMORY-INDEX:BEGIN —— 由 tools/refresh-snapshots.mjs 生成，勿手改；加/改记忆后重跑本脚本 */
		/* 空壳快照：本包不含任何个人记忆内容；装好后跑 tools/refresh-snapshots.mjs 灌自己的 */
		const MEMORY_INDEX = { generatedAt: "", atoms: [], edges: [], stats: { atoms: 0, edges: 0 } };
		/* MEMORY-INDEX:END */

		/** 页面样式。类名 wbh 前缀；圆角/颜色走令牌，正文守 app 尺度，hero 与统计用展示级字号。 */
		const PAGE_CSS = [
			"@keyframes wbh-rise{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}",
			"@keyframes wbh-pulse{0%{box-shadow:0 0 0 0 rgba(63,180,120,.5)}70%{box-shadow:0 0 0 6px rgba(63,180,120,0)}100%{box-shadow:0 0 0 0 rgba(63,180,120,0)}}",
			"@keyframes wbh-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}",
			".wbh-page{height:100%;overflow:auto;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,inherit);font-size:13px;line-height:1.5}",
			".wbh-inner{max-width:940px;margin:0 auto;padding:22px 24px 44px}",

			".wbh-heroframe{border-radius:var(--dsw-radius-panel,16px);padding:1px;background:linear-gradient(135deg,var(--dsw-alias-brand-primary) 0%,rgba(127,127,127,.22) 46%,rgba(255,184,92,.55) 100%);box-shadow:0 1px 2px rgba(0,0,0,.05),0 18px 48px -20px rgba(0,0,0,.28);animation:wbh-rise .32s cubic-bezier(.22,.8,.3,1)}",
			".wbh-hero{border-radius:calc(var(--dsw-radius-panel,16px) - 1px);padding:22px 26px;display:flex;align-items:center;gap:20px;position:relative;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}",
			".wbh-hero::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.22;background:radial-gradient(520px 220px at 8% -10%,var(--dsw-alias-brand-primary),transparent 70%),radial-gradient(420px 220px at 96% 118%,rgba(255,184,92,.9),transparent 72%)}",
			".wbh-hero::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.7;background:repeating-linear-gradient(0deg,rgba(127,127,127,.06) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(127,127,127,.06) 0 1px,transparent 1px 34px)}",
			".wbh-herotext{min-width:0;position:relative;z-index:1}",
			".wbh-name{margin:0;font-size:24px;font-weight:700;letter-spacing:-.01em;line-height:1.15;color:var(--dsw-alias-label-primary)}",
			"@supports (-webkit-background-clip:text){.wbh-name{background:linear-gradient(120deg,var(--dsw-alias-label-primary) 20%,var(--dsw-alias-brand-primary));-webkit-background-clip:text;background-clip:text;color:transparent}}",
			".wbh-role{margin:5px 0 0;font-size:12px;font-weight:500;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}",
			".wbh-tagline{margin:9px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:52ch}",
			".wbh-status{margin-left:auto;align-self:flex-start;flex:none;display:inline-flex;align-items:center;gap:7px;padding:4px 11px;border-radius:999px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border:1px solid var(--dsw-alias-border-l1);position:relative;z-index:1}",
			".wbh-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);flex:none;animation:wbh-pulse 2.6s ease-out infinite}",

			".wbh-stats{display:flex;margin-top:18px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-layer-1);overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04),0 12px 32px -18px rgba(0,0,0,.22);animation:wbh-rise .34s cubic-bezier(.22,.8,.3,1) .04s both}",
			".wbh-stat{flex:1 1 0;padding:14px 18px;border-left:1px solid var(--dsw-alias-border-l1)}",
			".wbh-stat:first-child{border-left:none}",
			".wbh-statnum{font-size:22px;font-weight:700;letter-spacing:-.01em;line-height:1.15}",
			".wbh-statlbl{margin-top:3px;font-size:11px;color:var(--dsw-alias-label-secondary)}",

			".wbh-card{margin-top:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(0,0,0,.04),0 14px 36px -22px rgba(0,0,0,.24);animation:wbh-rise .34s cubic-bezier(.22,.8,.3,1) .06s both}",
			".wbh-cardhead{display:flex;align-items:center;gap:8px;padding:13px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".wbh-cardicon{flex:none;color:var(--dsw-alias-brand-primary);display:flex}",
			".wbh-cardtitle{font-size:13px;font-weight:600}",
			".wbh-badge{font-size:11px;color:var(--dsw-alias-label-secondary);padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border:1px solid var(--dsw-alias-border-l1)}",
			".wbh-spacer{margin-left:auto}",
			".wbh-search{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,4px);padding:4px 8px;min-width:180px;outline:none}",
			".wbh-search::placeholder{color:var(--dsw-alias-label-secondary);opacity:.75}",
			".wbh-search:focus{border-color:var(--dsw-alias-brand-primary)}",
			".wbh-ghost{font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,4px);padding:4px 10px;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}",
			".wbh-ghost:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary)}",
			".wbh-cardbody{padding:14px 18px 16px}",
			".wbh-hint{margin:0 0 12px;font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary)}",

			".wbh-skill.is-open .wbh-desc{-webkit-line-clamp:99}",
			".wbh-field{font-size:11px;line-height:1.65;color:var(--dsw-alias-label-secondary)}",
			".wbh-field b{color:var(--dsw-alias-label-primary);font-weight:600;display:block;margin-bottom:2px;font-size:10px;letter-spacing:.04em}",
			".wbh-path{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10.5px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}",
			".wbh-note{margin-top:12px;font-size:10.5px;line-height:1.6;color:var(--dsw-alias-label-secondary);opacity:.9}",
			/* ── 记忆库独立页（宽松排版：正文 12/13，展示级 20/28；留白 20–34） ── */
			".wbm-page{height:100%;overflow:auto;box-sizing:border-box;padding:34px 38px 56px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang SC\",sans-serif)}",
			".wbm-hero{position:relative;display:flex;gap:28px;align-items:flex-start;justify-content:space-between;padding:26px 28px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-panel,16px);background:linear-gradient(135deg,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06)),transparent 62%);box-shadow:0 1px 2px rgba(0,0,0,.04),0 20px 52px -26px rgba(0,0,0,.3)}",
			".wbm-heroMain{min-width:0}",
			".wbm-crumb{font-size:11px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}",
			".wbm-titlerow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px}",
			".wbm-title{margin:0;font-size:28px;font-weight:700;letter-spacing:-.01em;line-height:1.15}",
			".wbm-count{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 10px}",
			// 打分系统 v1：分数徽标与层级胶囊（浅深色都用同一个品牌色，不新造色板）
			".wbm-scorebadge{font-size:11px;font-weight:600;color:var(--dsw-alias-brand-primary);border:1px solid var(--dsw-alias-brand-primary);border-radius:999px;padding:3px 10px}",
			".wbm-tierpill{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 10px}",
			".wbm-tierpill-tier1{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
			".wbm-scorehint{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".wbm-score{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;border-radius:999px;padding:2px 9px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08))}",
			".wbm-score-tier1{color:var(--dsw-alias-brand-primary)}",
			".wbm-score-tier3{opacity:.72}",
			".wbm-sub{margin:12px 0 0;max-width:58ch;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary)}",
			".wbm-stats{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}",
			".wbm-stat{display:flex;flex-direction:column;gap:2px;align-items:flex-start;min-width:76px;padding:11px 15px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06));cursor:pointer;transition:border-color 170ms cubic-bezier(.22,.8,.3,1),transform 170ms cubic-bezier(.22,.8,.3,1)}",
			".wbm-stat:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-2px)}",
			".wbm-stat.is-on{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}",
			".wbm-statdot{width:6px;height:6px;border-radius:50%}",
			".wbm-statnum{font-size:20px;font-weight:700;line-height:1.1}",
			".wbm-statlabel{font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 20px}",
			".wbm-spacer{flex:1;min-width:8px}",
			".wbm-chip{font:inherit;font-size:11px;font-weight:500;display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:5px 12px;cursor:pointer;transition:border-color 170ms,color 170ms}",
			".wbm-chip:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".wbm-chip.is-on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".wbm-chipdot{width:6px;height:6px;border-radius:50%}",
			".wbm-searchbar{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin:26px 0 14px}",
			".wbm-searchwrap{display:flex;align-items:center;gap:8px;width:min(560px,100%);padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1,transparent)}",
			".wbm-searchwrap:focus-within{border-color:var(--dsw-alias-brand-primary)}",
			".wbm-searchicon{flex:none;color:var(--dsw-alias-label-secondary)}",
			".wbm-hits{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary);white-space:nowrap}",
			".wbm-searchclear{flex:none;font:inherit;font-size:14px;line-height:1;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);background:transparent;border:0;border-radius:50%;cursor:pointer}",
			".wbm-searchclear:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary)}",
			".wbm-tagrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0}",
			".wbm-tagrowlabel{font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm-tagchip{font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px dashed var(--dsw-alias-border-l1);border-radius:999px;padding:3px 10px;cursor:pointer;transition:border-color 160ms,color 160ms}",
			".wbm-tagchip:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".wbm-tagchip.is-on{border-style:solid;border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".wbm-emptyhint{margin-top:6px}",
			".wpb-hint{font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;padding:12px 14px;margin:10px 0}",
			/* 信息图：暖米纸底 + 彩色圆角面板 + 大粗宋体标题 + 彩色标签行 */
			".wpb2-pane{display:flex;flex-direction:column;gap:16px;padding:20px 22px 34px;height:100%;box-sizing:border-box;overflow:auto}",
			".wpb2-body{position:relative;display:flex;flex-direction:column;gap:0;max-width:1180px;margin:0 auto;width:100%;padding:30px clamp(18px,3vw,38px) 26px;border-radius:18px;background:color-mix(in srgb,#FBF6EC 55%,var(--dsw-alias-bg-layer-1))}",
			/* 头部：大粗衬线标题 + 副题 + 角落插画 + 手写感小注 */
			".wpb2-head{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:start;padding-bottom:22px}",
			".wpb2-heart{order:2;flex:none;display:inline-flex;border-radius:16px;overflow:hidden;transform:rotate(-1.2deg);box-shadow:0 16px 34px -20px hsl(28 40% 30% / .45)}",
			".wpb2-headtext{order:1;display:flex;flex-direction:column;gap:10px;min-width:0}",
			".wpb2-kicker{font-size:11px;letter-spacing:.34em;color:color-mix(in srgb,#8A6A45 85%,var(--dsw-alias-label-secondary))}",
			".wpb2-title,.wpb2-covertitle{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;margin:0;color:var(--dsw-alias-label-primary);letter-spacing:.01em}",
			".wpb2-title{font-size:clamp(27px,3.3vw,42px);line-height:1.28}",
			".wpb2-covertitle{font-size:21px;line-height:1.4}",
			".wpb2-oneline{margin:0;font-size:14.5px;line-height:1.8;color:color-mix(in srgb,#6B5B49 80%,var(--dsw-alias-label-secondary));max-width:52ch}",
			".wpb2-meta{margin:2px 0 0;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary)}",
			".wpb2-note{font-size:11.5px;color:var(--dsw-alias-label-secondary)}",
			/* 海报版（正文页）时，顶上那条收成「报头一行」：巨字与大图交给下面的海报区，不把同一句话摆两遍 */
			".wpb2-body.is-prose .wpb2-head{padding-bottom:0;align-items:center}",
			".wpb2-body.is-prose .wpb2-title{font-size:15px;font-weight:600;line-height:1.5;letter-spacing:.04em}",
			/* 面板栅格（参考图那种并排彩块） */
			/* ── 流程图（把计划本身画出来：节点 + 箭头 + 退路支线 + 会碰的东西）── */
			/* ── 中文字体：引外网（思源宋体 = Noto Serif SC，OFL 许可，jsdelivr 国内一般可达）──
			     能连上就换成真宋体；连不上/超时自动回落系统字体（font-display:swap，不白屏、不阻塞） */
			'@font-face{font-family:\'WPB Song\';font-style:normal;font-weight:400;font-display:swap;src:url(https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5/files/noto-serif-sc-chinese-simplified-400-normal.woff2) format("woff2")}',
			'@font-face{font-family:\'WPB Song\';font-style:normal;font-weight:700;font-display:swap;src:url(https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5/files/noto-serif-sc-chinese-simplified-700-normal.woff2) format("woff2")}',
			/* ── 海报版（默认视图）：一页一张海报 —— 巨字标题 + 一张大图主角 + 一块琥珀 + 一排大数字；
			     只换视觉语言：三层信息结构（一屏决策 / 依据 / 完整步骤）一个字没动 ── */
			".wpp{max-width:min(100%,860px);margin:0 auto;display:block}",
			/* 首屏：巨字标题 + 一句话，右侧一张大图（没有插画时用一块暖色块顶上；绝不外链图片） */
			".wpp-hero{display:grid;grid-template-columns:minmax(0,1fr) min(40%,clamp(160px,22vw,280px));gap:clamp(18px,3vw,40px);align-items:start;margin:28px 0 36px}",
			".wpp-herotext{display:flex;flex-direction:column;gap:14px;min-width:0}",
			".wpp-title{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;font-size:clamp(30px,4.6vw,56px);line-height:1.2;letter-spacing:-.01em;margin:0;color:var(--dsw-alias-label-primary)}",
			".wpp-lede{margin:0;max-width:34em;font-size:19px;line-height:1.8;color:var(--dsw-alias-label-primary);font-weight:500}",
			".wpp-heroart{flex:none;width:100%;max-width:280px;border-radius:18px;overflow:hidden;transform:rotate(-1.2deg);animation:wppHeroIn 240ms cubic-bezier(.22,.8,.3,1) both}",
			".wpp .wpp-heroimg{display:block;width:100%;height:auto;border-radius:0}",
			".wpp-heroblk{display:block;width:100%;aspect-ratio:1;background:linear-gradient(135deg,color-mix(in srgb,#FBF6EC 72%,var(--dsw-alias-bg-layer-1)),color-mix(in srgb,#E9A94A 28%,var(--dsw-alias-bg-layer-1)))}",
			'@keyframes wppHeroIn{from{opacity:0;transform:translateY(12px) rotate(-1.2deg)}to{opacity:1;transform:translateY(0) rotate(-1.2deg)}}',
			"@media (prefers-reduced-motion:reduce){.wpp-heroart{animation:none}}",
			"@media (max-width:820px){.wpp-hero{grid-template-columns:minmax(0,1fr)}.wpp-heroart{width:min(100%,280px)}}",
			/* 紧凑（对话里就地展开）那一路：大图收一档，别把窄栏挤爆 */
			".wpb2-body.is-compact .wpp-hero{grid-template-columns:minmax(0,1fr) min(34%,clamp(140px,18vw,200px))}",
			".wpb2-body.is-compact .wpp-title{font-size:clamp(26px,3.4vw,40px)}",
			".wpp-toc{display:block;margin:7px 0 0;font-size:12.5px;line-height:1.85;color:var(--dsw-alias-label-secondary)}",
			".wpp-tocitem{color:var(--dsw-alias-label-secondary);text-decoration:none}",
			".wpp-tocitem:hover{color:var(--dsw-alias-label-primary)}",
			".wpp-tocsep{color:var(--dsw-alias-label-secondary)}",
			".wpp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:40px}",
			".wpp-stephead{display:flex;align-items:baseline;gap:14px;margin-bottom:8px}",
			".wpp-no{flex:none;min-width:32px;font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;font-size:26px;line-height:1;color:#B57F24;font-variant-numeric:tabular-nums}",
			".wpp-steptitle{margin:0;font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:21px;font-weight:700;line-height:1.45;color:var(--dsw-alias-label-primary)}",
			".wpp-do{margin:0 0 8px;max-width:34em;font-size:15px;line-height:1.9;color:var(--dsw-alias-label-primary)}",
			".wpp-fact{margin:4px 0 0;max-width:34em;font-size:14px;line-height:1.9;color:var(--dsw-alias-label-secondary)}",
			".wpp-fact b{font-weight:600;color:var(--dsw-alias-label-primary);margin-right:8px}",
			".wpp-fact code{font-family:var(--dsw-font-mono,ui-monospace,monospace);font-size:12.5px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform,#f5f6f7);padding:1px 6px;border-radius:4px}",
			".wpp-fact.is-risk,.wpp-fact.is-risk b{color:#8A4A16}",
			".wpp-details{margin-top:9px}",
			".wpp-details summary{cursor:pointer;font-size:12.5px;color:var(--dsw-alias-label-secondary);list-style:none}",
			".wpp-details summary::-webkit-details-marker{display:none}",
			".wpp-details summary::before{content:'▸ ';color:#B57F24}",
			".wpp-details[open] summary::before{content:'▾ '}",
			".wpp-details summary:hover{color:var(--dsw-alias-label-primary)}",
			".wpp-detail{margin:9px 0 0;padding:13px 15px;font-size:12.5px;line-height:1.85;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-module-platform,#f5f6f7);border-left:2px solid color-mix(in srgb,#B57F24 60%,transparent);border-radius:0 8px 8px 0}",
			/* 块面：要你定的 = 琥珀浅块 + 左侧 4px 实心条；代价与退路 = 中性浅块（海报的两块色，不是卡片墙） */
			".wpp-decisions{margin:44px 0 0;padding:24px 26px 24px 22px;border-left:4px solid #E9A94A;border-radius:14px;background:color-mix(in srgb,#E9A94A 13%,var(--dsw-alias-bg-layer-1))}",
			".wpp-decisions h2{margin:0 0 12px;font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:16px;font-weight:700;line-height:1.5;color:#B57F24}",
			".wpp-decisions ul{margin:0;padding-left:20px;max-width:34em;font-size:15px;line-height:1.9;color:var(--dsw-alias-label-primary)}",
			/* 大数字排：三四个数字用竖细线分隔（不是卡片、不加底色） */
			".wpp-scale{display:flex;align-items:center;flex-wrap:wrap;margin:48px 0 0}",
			".wpp-stat{display:inline-flex;align-items:baseline;gap:8px}",
			".wpp-statnum{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;font-size:clamp(30px,3.6vw,44px);line-height:1;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
			".wpp-statlabel{font-size:11px;letter-spacing:.06em;color:var(--dsw-alias-label-secondary)}",
			".wpp-statline{align-self:center;flex:none;width:1px;height:34px;margin:0 clamp(16px,2.4vw,30px);background:var(--dsw-alias-border-l2)}",
			".wpp-cut{margin:16px 0 0;font-size:11px;line-height:1.8;color:color-mix(in srgb,#B57F24 78%,var(--dsw-alias-label-secondary))}",
			/* 一屏决策版：一句提示（第一层的收尾） */
			".wpp-hint{margin:16px 0 0;max-width:34em;font-size:12.5px;line-height:1.9;color:var(--dsw-alias-label-secondary)}",
			/* 第二三层：原生 details 折叠（零 JS）；两个 summary 是「翻页口令」，没有底色/边框/阴影 */
			".wpp-fold{margin:48px 0 0}",
			".wpp-fold+.wpp-fold{margin-top:32px}",
			".wpp-fold>summary{cursor:pointer;list-style:none;font-size:13px;line-height:1.9;color:var(--dsw-alias-label-secondary)}",
			".wpp-fold>summary::-webkit-details-marker{display:none}",
			".wpp-fold>summary::before{content:'▸ ';color:#B57F24}",
			".wpp-fold[open]>summary::before{content:'▾ '}",
			".wpp-fold>summary:hover{color:var(--dsw-alias-label-primary)}",
			/* 提案四节（现状 / 为什么不选别的 / 代价与退路 / 怎么算成功）：第二节在第一层是中性色块，其余只用留白分隔 */
			".wpp-sec{margin:40px 0 0}",
			".wpp-sec-cost{margin:44px 0 0;padding:24px 26px;border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,var(--dsw-alias-bg-layer-1))}",
			".wpp-sechead{margin:0 0 12px;font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:16px;font-weight:700;line-height:1.5;color:var(--dsw-alias-label-primary)}",
			".wpp-secline{margin:0 0 10px;max-width:34em;font-size:15px;line-height:1.9;color:var(--dsw-alias-label-secondary)}",
			".wpp-secline:last-child{margin-bottom:0}",
			".wpp-fact.is-accept{color:var(--dsw-alias-label-secondary)}",
			".wpp-foot{margin:32px 0 0;max-width:34em;font-size:11.5px;line-height:1.75;color:var(--dsw-alias-label-secondary)}",
			/* ── 汇报稿（网页 PPT）：16:9 舞台 + 页码 + 翻页 + 全屏 ── */
			".wpd-viewtabs{display:flex;gap:8px;margin-top:16px}",
			".wpd-viewtab{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);padding:5px 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;cursor:pointer}",
			".wpd-viewtab.is-on{color:var(--dsw-alias-label-primary);border-color:color-mix(in srgb,#B57F24 55%,transparent);background:color-mix(in srgb,#E9A94A 12%,var(--dsw-alias-bg-layer-1))}",
			".wpd-deck{display:flex;flex-direction:column}",
			".wpd-deck.is-full{position:fixed;inset:0;z-index:70;padding:26px;background:color-mix(in srgb,#FBF6EC 88%,#fff);justify-content:center}",
			".wpd-stage{position:relative;aspect-ratio:16 / 9;max-height:60vh;min-height:320px;padding:clamp(18px,3vw,42px);border-radius:16px;overflow:hidden;display:flex;align-items:center;background:linear-gradient(150deg,color-mix(in srgb,#FBF6EC 80%,var(--dsw-alias-bg-layer-1)),color-mix(in srgb,#F3E7D6 55%,var(--dsw-alias-bg-layer-1)));border:1px solid color-mix(in srgb,#B57F24 22%,transparent);box-shadow:0 22px 50px -34px hsl(28 40% 30% / .5)}",
			".wpd-deck.is-full .wpd-stage{max-height:78vh}",
			".wpd-slide{position:relative;width:100%;display:flex;flex-direction:column;gap:14px;padding-right:clamp(0px,14vw,150px)}",
			".wpd-slide.is-cover,.wpd-slide.is-end{align-items:flex-start;justify-content:center;min-height:100%}",
			".wpd-slidekicker{font-size:11px;letter-spacing:.34em;color:color-mix(in srgb,#8A6A45 85%,var(--dsw-alias-label-secondary))}",
			".wpd-slidetitle{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;margin:0;color:var(--dsw-alias-label-primary);font-size:clamp(19px,2.3vw,30px);line-height:1.32}",
			".wpd-slidetitle.is-big{font-size:clamp(26px,3.4vw,46px)}",
			".wpd-slideoneline{margin:0;font-size:clamp(13px,1.3vw,16px);line-height:1.8;color:color-mix(in srgb,#6B5B49 80%,var(--dsw-alias-label-secondary));max-width:46ch}",
			".wpd-slidestats{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidehead{display:flex;align-items:flex-start;gap:16px}",
			".wpd-slideno{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;font-size:clamp(34px,4.6vw,58px);line-height:.9;color:color-mix(in srgb,var(--wpbi-ink) 82%,#000);font-variant-numeric:tabular-nums}",
			".wpd-slidedo{margin:6px 0 0;font-size:clamp(13px,1.35vw,16px);line-height:1.7;color:var(--dsw-alias-label-primary)}",
			".wpd-slidefacts{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:7px;max-width:60ch}",
			".wpd-slidefacts li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;font-size:clamp(12px,1.2vw,13.5px);line-height:1.7;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidefacts b{font-weight:600;color:color-mix(in srgb,var(--wpbi-ink) 80%,#000);letter-spacing:.04em}",
			".wpd-slidefacts li.is-risk b{color:#8A4A16}",
			".wpd-slidefacts li.is-risk{color:color-mix(in srgb,#8A4A16 82%,var(--dsw-alias-label-primary))}",
			".wpd-slidart{position:absolute;right:0;bottom:0;width:clamp(120px,17vw,210px);border-radius:14px;transform:rotate(-1.5deg)}",
			".wpd-slidedecisions{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidedecisions b{color:var(--dsw-alias-label-primary)}",
			".wpd-slidedecisions ul{margin:0;padding-left:18px;line-height:1.8}",
			".wpd-slidefoot{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}",
			".wpd-progress{height:2px;border-radius:2px;background:color-mix(in srgb,#B57F24 16%,transparent);overflow:hidden;margin-bottom:10px}",
			".wpd-progress span{display:block;height:100%;background:#B57F24;transform-origin:left;transition:transform .4s cubic-bezier(.26,.86,.44,.985)}",
			".wpd-stats{display:flex;gap:0;margin-top:6px;border-top:1px solid color-mix(in srgb,#B57F24 22%,transparent)}",
			".wpd-statcell{display:flex;flex-direction:column;gap:2px;padding:10px 22px 4px;border-right:1px solid color-mix(in srgb,#B57F24 18%,transparent)}",
			".wpd-statcell:first-child{padding-left:0}",
			".wpd-statcell:last-child{border-right:0}",
			".wpd-statcell b{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:clamp(20px,2.4vw,30px);font-weight:700;line-height:1;color:#B57F24;font-variant-numeric:tabular-nums}",
			".wpd-statcell i{font-style:normal;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".wpd-agenda{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px 22px}",
			".wpd-agenda li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px 10px;align-items:baseline;padding:6px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 80%,transparent)}",
			".wpd-agendano{font-family:var(--dsw-font-mono,monospace);font-size:12px;font-weight:700;color:color-mix(in srgb,var(--wpbi-ink) 85%,#000);font-variant-numeric:tabular-nums}",
			".wpd-agendatitle{font-size:13.5px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".wpd-agendado{grid-column:2;font-size:11.5px;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidepos{margin:2px 0 0;font-size:11px;letter-spacing:.1em;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidefacts li{opacity:.22;transform:translateX(-4px);transition:opacity .32s cubic-bezier(.26,.86,.44,.985),transform .32s cubic-bezier(.26,.86,.44,.985)}",
			".wpd-slidefacts li.is-shown{opacity:1;transform:none}",
			".wpd-more{position:absolute;left:0;bottom:2px;font-size:11px;letter-spacing:.12em;color:var(--dsw-alias-label-secondary)}",
			".wpd-slidedetail{margin:6px 0 0;padding:14px 16px;font-size:12.5px;line-height:1.8;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,#FBF6EC 60%,var(--dsw-alias-bg-layer-1));border-left:2px solid #B57F24;border-radius:8px;max-height:46vh;overflow:auto}",
			".wpd-risklist{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}",
			".wpd-risklist li{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;font-size:13px;line-height:1.7;color:color-mix(in srgb,#8A4A16 82%,var(--dsw-alias-label-primary))}",
			".wpd-risklist b{font-weight:600;color:#8A4A16}",
			".wpd-retreat{font-size:12px;color:var(--dsw-alias-label-secondary)}",
			".wpd-deckbar{display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap}",
			".wpd-navbtn{font:inherit;font-size:13px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-primary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:50%;cursor:pointer}",
			".wpd-navbtn:disabled{opacity:.35;cursor:default}",
			".wpd-deckcount{font-family:var(--dsw-font-mono,monospace);font-size:12px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
			".wpd-dots{display:flex;align-items:center;gap:5px;flex:1}",
			".wpd-dot{width:6px;height:6px;padding:0;border:0;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 20%,transparent);cursor:pointer;transition:width 160ms ease,background 160ms ease}",
			".wpd-dot.is-on{width:16px;background:#B57F24}",
			".wpd-fullbtn{font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);padding:5px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:transparent;cursor:pointer}",
			".wpd-wrap{margin-top:18px;padding:8px 4px;border-radius:14px;background:color-mix(in srgb,#FBF6EC 42%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,#B57F24 16%,transparent);overflow:auto}",
			".wpd{display:block;width:100%;min-width:620px;height:auto;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family)}",
			".wpd-link{stroke:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);stroke-width:1.5}",
			".wpd-term circle{fill:color-mix(in srgb,#B57F24 85%,transparent)}",
			".wpd-term text{font-size:11px;fill:var(--dsw-alias-label-secondary)}",
			".wpd-node{cursor:pointer}",
			".wpd-box{fill:var(--dsw-alias-bg-layer-1);stroke:color-mix(in srgb,var(--wpbi-ink) 28%,transparent);stroke-width:1}",
			".wpd-node:hover .wpd-box{stroke-width:2}",
			".wpd-node.is-picked .wpd-box{stroke:var(--wpbi-ink);stroke-width:2;fill:color-mix(in srgb,var(--wpbi-ink) 8%,var(--dsw-alias-bg-layer-1))}",
			".wpd-bar{fill:var(--wpbi-ink)}",
			".wpd-no{font-size:13px;font-weight:700;fill:color-mix(in srgb,var(--wpbi-ink) 88%,#000);font-family:var(--dsw-font-mono,monospace)}",
			".wpd-title{font-size:14.5px;font-weight:600;fill:var(--dsw-alias-label-primary)}",
			".wpd-files{font-size:10.5px;fill:var(--dsw-alias-label-secondary)}",
			".wpd-sub{font-size:11.5px;fill:var(--dsw-alias-label-secondary)}",
			".wpd-legend text{font-size:10.5px;fill:var(--dsw-alias-label-secondary)}",
			".wpd-legendlink{stroke:color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);stroke-width:1.5}",
			".wpd-riskline{fill:none;stroke:color-mix(in srgb,#B57F24 70%,transparent);stroke-width:1.2;stroke-dasharray:4 3}",
			".wpd-riskbox{fill:color-mix(in srgb,#E9A94A 15%,var(--dsw-alias-bg-layer-1));stroke:color-mix(in srgb,#B57F24 42%,transparent)}",
			".wpd-risklabel{font-size:10.5px;font-weight:700;fill:#8A4A16}",
			".wpd-risktext{font-size:11px;fill:var(--dsw-alias-label-secondary)}",
			".wpd-detail{margin-top:16px;padding:16px 18px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1)}",
			".wpd-dethead{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}",
			".wpd-detno{font-family:var(--dsw-font-mono,monospace);font-size:13px;font-weight:700;color:#B57F24}",
			".wpd-dettitle{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:17px;font-weight:700;color:var(--dsw-alias-label-primary)}",
			".wpb2-facts{display:flex;flex-direction:column;gap:7px;margin-top:2px}",
			".wpb2-factrow{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start}",
			".wpb2-factlabel{display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:.04em;color:color-mix(in srgb,var(--wpbi-ink) 82%,#000);background:color-mix(in srgb,var(--wpbi-ink) 17%,var(--dsw-alias-bg-layer-1))}",
			".wpb2-factvalue{font-size:12.5px;line-height:1.75;color:var(--dsw-alias-label-secondary);padding-top:2px}",
			".wpb2-factrow.is-risk .wpb2-factlabel{color:#8A4A16;background:color-mix(in srgb,#E08A2E 26%,var(--dsw-alias-bg-layer-1))}",
			".wpb2-factrow.is-risk .wpb2-factvalue{color:color-mix(in srgb,#8A4A16 85%,var(--dsw-alias-label-primary))}",
			".wpb2-detailbox{display:flex;flex-direction:column;gap:8px;align-items:flex-start;margin-top:4px}",
			".wpb2-more{font:inherit;font-size:11.5px;color:color-mix(in srgb,var(--wpbi-ink) 70%,var(--dsw-alias-label-secondary));background:transparent;border:0;border-bottom:1px dashed color-mix(in srgb,var(--wpbi-ink) 40%,transparent);padding:1px 0;cursor:pointer}",
			".wpb2-more:hover{color:var(--dsw-alias-label-primary)}",
			".wpb2-detail{width:100%;margin:0;padding:12px 14px;font-size:12px;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--wpbi-ink) 7%,var(--dsw-alias-bg-layer-1));border-radius:10px}",
			/* 底部一句话横条（参考图那条"最小起点"） */
			".wpb2-decisions{display:flex;flex-direction:column;gap:6px;margin-top:20px;padding:16px 18px;border-radius:12px;background:color-mix(in srgb,#3E6B4B 10%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,#3E6B4B 22%,transparent);font-size:13px;color:var(--dsw-alias-label-secondary)}",
			".wpb2-decisions b{font-weight:700;color:color-mix(in srgb,#2F5A3C 80%,var(--dsw-alias-label-primary))}",
			".wpb2-decisions ul{margin:2px 0 0;padding-left:18px;line-height:1.9}",
			".wpb2-foot{margin:18px 0 0;padding:13px 18px;border-radius:12px;background:color-mix(in srgb,#E9A94A 14%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,#E9A94A 34%,transparent);font-size:12.5px;line-height:1.7;color:color-mix(in srgb,#7A5638 85%,var(--dsw-alias-label-secondary));text-align:center}",
			".wpb2-empty{font-size:13.5px;line-height:1.8;color:var(--dsw-alias-label-secondary);padding:20px 0}",
			".wpb2-art,.wpb2-artimg{border-radius:16px;display:block}",
			/* 摘要卡：同一套信息图语言 */
			".wpb2-cover{position:relative;margin:16px 0 6px;padding:20px 22px 16px;border-radius:14px;background:color-mix(in srgb,#FBF6EC 50%,var(--dsw-alias-bg-layer-1));border:1px solid color-mix(in srgb,#E9A94A 30%,transparent);display:flex;flex-direction:column;gap:14px}",
			".wpb2-coverhead{display:flex;flex-direction:column;gap:6px}",
			".wpb2-toc{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px 14px}",
			".wpb2-tocitem{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:baseline}",
			".wpb2-tocdot{display:none}",
			".wpb2-tocno{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-weight:700;font-size:12.5px;color:#B57F24;font-variant-numeric:tabular-nums}",
			".wpb2-toctitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".wpb2-tocmini{display:none}",
			".wpb2-band{display:none}",
			".wpb2-coverfoot{display:flex;align-items:center;gap:14px;flex-wrap:wrap}",
			".wpb2-open{font:inherit;font-size:13px;font-weight:600;color:#fff;padding:9px 18px;border:0;border-radius:999px;cursor:pointer;background:#1F2937;transition:background-color 140ms ease}",
			".wpb2-open:hover{background:#111827}",
			".wpb2-inline{font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary);padding:8px 0;background:transparent;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);cursor:pointer}",
			".wpb2-inline:hover{color:var(--dsw-alias-label-primary)}",
			".wpb2-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary)}",
			".wpb3-entry{display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);padding:5px 12px;border:1px solid color-mix(in srgb,#B57F24 34%,transparent);border-radius:999px;background:color-mix(in srgb,#FBF6EC 45%,var(--dsw-alias-bg-layer-1));cursor:pointer;transition:border-color 140ms ease}",
			".wpb3-entry:hover{border-color:#B57F24}",
			".wpb3-entry.is-failed{cursor:default;color:var(--dsw-alias-label-secondary)}",
			".wpb3-entrydot{width:6px;height:6px;border-radius:50%;background:#E9A94A}",
			".wpb3-entryhint{font-size:11px;color:var(--dsw-alias-label-secondary)}",
			"@media (max-width:900px){.wpd-slidart{display:none}.wpd-stage{max-height:none;min-height:0;aspect-ratio:auto}.wpb2-pane{padding:14px 12px 26px}.wpb2-head{grid-template-columns:minmax(0,1fr);gap:14px}.wpb2-heart{order:0}.wpb2-steps{grid-template-columns:minmax(0,1fr)}.wpb2-body{padding:20px 14px 18px;border-radius:14px}}",
			".ah-sheet{--ah-ink:#070b11;--ah-lift:#0d131c;--ah-paper:#e9eef4;--ah-dim:#a3b0c0;--ah-faint:#6d7a89;--ah-lamp:#e9a94a;--ah-lamp-soft:#f0c680;--ah-rule:rgba(233,238,244,.13);--ah-rule-strong:rgba(233,238,244,.26);--ah-serif:\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",\"Source Han Serif SC\",serif;--ah-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--ah-ink);color:var(--ah-paper);min-height:100%;border-radius:var(--dsw-radius-lg,14px);overflow:hidden;font-size:15px;line-height:1.75}",
			".ah-sheet ::selection{background:var(--ah-lamp);color:var(--ah-ink)}",
			".ah-sheet .ah-masthead{display:flex;justify-content:space-between;align-items:baseline;padding:22px clamp(20px,4.6vw,72px) 16px;font-family:var(--ah-mono);font-size:10px;letter-spacing:.2em;color:var(--ah-faint);border-bottom:1px solid var(--ah-rule)}",
			".ah-sheet .ah-hero{position:relative;padding:7vh clamp(20px,4.6vw,72px) 8vh;overflow:hidden}",
			".ah-sheet .ah-lamp{position:absolute;top:50%;right:-6%;width:min(96%,900px);aspect-ratio:1;transform:translateY(-46%);pointer-events:none}",
			".ah-sheet .ah-lamp svg{width:100%;height:100%;display:block}",
			".ah-sheet .ah-ring{fill:none;stroke:var(--ah-lamp);stroke-width:1.1;opacity:.38}",
			".ah-sheet .ah-ring-outer{opacity:.2}",
			".ah-sheet .ah-ray{stroke:var(--ah-lamp);stroke-width:1;opacity:.22;animation:ah-ray-in 1.1s cubic-bezier(.2,.7,.3,1) both}",
			".ah-sheet .ah-ray.is-far{opacity:.1}",
			"@keyframes ah-ray-in{from{opacity:0;stroke-dashoffset:40}to{opacity:.22;stroke-dashoffset:0}}",
			".ah-sheet .ah-role{position:relative;margin:0 0 22px;font-family:var(--ah-mono);font-size:11px;letter-spacing:.2em;color:var(--ah-dim);display:flex;gap:10px;align-items:center}",
			".ah-sheet .ah-role b{color:var(--ah-lamp);font-weight:400;letter-spacing:.2em}",
			".ah-sheet .ah-name{position:relative;font-family:var(--ah-serif);font-weight:400;margin:0;font-size:clamp(56px,9vw,150px);line-height:1;letter-spacing:.05em;text-indent:.05em;color:var(--ah-paper)}",
			".ah-sheet .ah-dot{color:var(--ah-lamp)}",
			".ah-sheet .ah-lede{position:relative;margin:28px 0 0;max-width:46ch;font-size:clamp(14px,1.2vw,17px);line-height:1.95}",
			".ah-sheet .ah-lede em{font-style:normal;color:var(--ah-lamp-soft);border-bottom:1px solid rgba(233,169,74,.4);padding-bottom:1px}",
			".ah-sheet .ah-scroll{position:relative;margin:48px 0 0;font-family:var(--ah-mono);font-size:10px;letter-spacing:.2em;color:var(--ah-faint)}",
			".ah-sheet .ah-sec{padding:72px clamp(20px,4.6vw,72px) 0}",
			".ah-sheet .ah-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:baseline;gap:24px;border-top:1px solid var(--ah-rule-strong);padding-top:14px}",
			".ah-sheet .ah-head h2{font-family:var(--ah-serif);font-weight:400;font-size:clamp(22px,2.6vw,36px);letter-spacing:.04em;margin:0}",
			".ah-sheet .ah-head span{font-family:var(--ah-mono);font-size:10px;letter-spacing:.2em;color:var(--ah-faint)}",
			".ah-sheet .ah-creed{margin:40px 0 0;font-family:var(--ah-serif);font-size:clamp(19px,2.4vw,34px);line-height:1.6;letter-spacing:.03em}",
			".ah-sheet .ah-creed b{font-weight:400;color:var(--ah-lamp)}",
			".ah-sheet .ah-creed s{text-decoration:none;color:var(--ah-faint)}",
			".ah-sheet .ah-figures{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:44px 0 0;border-top:1px solid var(--ah-rule);border-bottom:1px solid var(--ah-rule)}",
			".ah-sheet .ah-fig{padding:24px 22px 22px;border-left:1px solid var(--ah-rule)}",
			".ah-sheet .ah-fig:first-child{border-left:0;padding-left:0}",
			".ah-sheet .ah-fig b{display:block;font-family:var(--ah-serif);font-weight:400;font-size:clamp(32px,3.6vw,54px);line-height:1;font-variant-numeric:tabular-nums}",
			".ah-sheet .ah-fig i{display:block;margin-top:10px;font-style:normal;font-family:var(--ah-mono);font-size:10px;letter-spacing:.18em;color:var(--ah-dim)}",
			".ah-sheet .ah-fig u{display:block;margin-top:8px;text-decoration:none;font-size:12.5px;color:var(--ah-faint)}",
			".ah-sheet .ah-rows{margin:34px 0 0;border-top:1px solid var(--ah-rule)}",
			".ah-sheet .ah-row{position:relative;display:grid;grid-template-columns:26px minmax(0,1.05fr) minmax(0,1.5fr) auto;gap:20px;align-items:baseline;padding:18px 4px 18px 14px;border-bottom:1px solid var(--ah-rule);transition:background-color .18s ease}",
			".ah-sheet .ah-row::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:2px;background:var(--ah-lamp);transform:scaleY(0);transform-origin:top;transition:transform .2s ease}",
			".ah-sheet .ah-row:hover{background:var(--ah-lift)}",
			".ah-sheet .ah-row:hover::before{transform:scaleY(1)}",
			".ah-sheet .ah-n{font-family:var(--ah-mono);font-size:10px;color:var(--ah-faint);letter-spacing:.12em}",
			".ah-sheet .ah-t{font-family:var(--ah-serif);font-size:clamp(16px,1.5vw,21px);letter-spacing:.03em}",
			".ah-sheet .ah-d{font-size:13.5px;color:var(--ah-dim)}",
			".ah-sheet .ah-k{font-family:var(--ah-mono);font-size:10px;letter-spacing:.16em;color:var(--ah-faint);white-space:nowrap}",
			".ah-sheet .ah-foot{margin-top:80px;padding:22px clamp(20px,4.6vw,72px) 48px;border-top:1px solid var(--ah-rule-strong);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:baseline}",
			".ah-sheet .ah-foot p{margin:0;font-family:var(--ah-serif);font-size:clamp(15px,1.4vw,19px);letter-spacing:.04em}",
			".ah-sheet .ah-foot small{font-family:var(--ah-mono);font-size:10px;letter-spacing:.18em;color:var(--ah-faint)}",
			"@media (max-width:900px){.ah-sheet .ah-figures{grid-template-columns:repeat(2,minmax(0,1fr))}.ah-sheet .ah-fig{padding:20px 16px}.ah-sheet .ah-fig:nth-child(odd){border-left:0;padding-left:0}.ah-sheet .ah-fig:nth-child(n+3){border-top:1px solid var(--ah-rule)}.ah-sheet .ah-row{grid-template-columns:22px minmax(0,1fr);gap:8px 14px}.ah-sheet .ah-d,.ah-sheet .ah-k{grid-column:2}.ah-sheet .ah-lamp{opacity:.6;right:-18%}}",
			"@media (prefers-reduced-motion:reduce){.ah-sheet .ah-ray{animation:none;opacity:.2}.ah-sheet .ah-row,.ah-sheet .ah-row::before{transition:none}}",
			".wpb3-entry{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);padding:5px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-module-platform,#f5f6f7);cursor:pointer;transition:border-color 140ms ease}",
			".wpb3-entry:hover{border-color:var(--dsw-alias-border-l2,var(--dsw-alias-border-l1))}",
			".wpb3-entry.is-failed{cursor:default;color:var(--dsw-alias-label-secondary)}",
			".wpb3-entrydot{width:6px;height:6px;border-radius:50%;background:hsl(216 68% 50%)}",
			".wpb3-entryhint{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary)}",
			"@media (prefers-reduced-motion:reduce){.wpb2-step:hover,.wpb2-step:focus-within{animation:none}}",
			".wbm-search{font:inherit;font-size:12px;flex:1;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:7px 11px}",
			".wbm-graph{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-panel,16px);padding:20px 22px 10px;background:var(--dsw-alias-bg-layer-1,transparent);box-shadow:0 1px 2px rgba(0,0,0,.03),0 16px 40px -28px rgba(0,0,0,.26)}",
			".wbm-graphtop{display:flex;flex-direction:column;align-items:flex-start;gap:3px}",
			".wbm-graphtoprow{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
			".wbm-listtop{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
			".wbm-sectiontitle{font-size:12px;font-weight:600}",
			".wbm-graphtitle{font-family:'WPB Song',\"Songti SC\",\"STSong\",\"Noto Serif CJK SC\",var(--dsw-font-family,sans-serif);font-size:16px;font-weight:700;line-height:1.4;color:var(--dsw-alias-label-primary)}",
			".wbm-legend{font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm3d-stage{position:relative;margin-top:10px;border:1px solid var(--dsw-alias-border-l2,var(--dsw-alias-border-l1));border-radius:var(--dsw-radius-lg,12px);overflow:hidden;background:var(--dsw-alias-bg-module-platform,#f5f6f7)}",
			".wbm3d-canvas{display:block;width:100%;height:min(64vh,600px);touch-action:none;cursor:grab;outline:none}",
			".wbm3d-stage.is-drag .wbm3d-canvas{cursor:grabbing}",
			".wbm3d-canvas:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary)}",
			".wbm3d-hint{position:absolute;left:14px;bottom:11px;font-size:11px;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);pointer-events:none}",
			".wbm3d-keys{position:absolute;right:14px;top:12px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px 12px;max-width:52%;font-size:11px;color:var(--dsw-alias-label-secondary);pointer-events:none}",
			".wbm3d-key{display:inline-flex;align-items:center;gap:5px}",
			".wbm3d-keydot{width:7px;height:7px;border-radius:50%;flex:none;background-image:radial-gradient(circle at 32% 30%,rgba(255,255,255,.75),rgba(255,255,255,0) 62%);box-shadow:inset 0 0 0 .5px rgba(0,0,0,.22)}",
			".wbm-list{margin-top:26px}",
			".wbm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start;margin-top:14px}",
			".wbm-card{border:1px solid var(--dsw-alias-border-l1);border-left:3px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);padding:15px 17px;background:var(--dsw-alias-bg-layer-1,transparent);cursor:pointer;transition:border-color 170ms cubic-bezier(.22,.8,.3,1),transform 170ms cubic-bezier(.22,.8,.3,1),box-shadow 170ms}",
			".wbm-card:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-2px);box-shadow:0 1px 2px rgba(0,0,0,.04),0 18px 44px -26px rgba(0,0,0,.3)}",
			".wbm-card.is-on{border-color:var(--dsw-alias-brand-primary);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}",
			".wbm-cardhead{display:flex;align-items:center;gap:8px;justify-content:space-between}",
			".wbm-type{font-size:10px;font-weight:600;border:1px solid currentColor;border-radius:999px;padding:1px 8px}",
			".wbm-rel{font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm-claim{margin:10px 0 0;font-size:13px;line-height:1.6;overflow-wrap:anywhere}",
			".wbm-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:11px;font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm-tag{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 7px}",
			".wbm-state{margin-left:auto}",
			".wbm-detail{display:flex;flex-direction:column;gap:7px;margin-top:13px;padding-top:13px;border-top:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}",
			".wbm-reltitle{font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".wbm-relrow{display:flex;gap:8px;align-items:baseline;text-align:left;font:inherit;font-size:12px;background:transparent;border:0;padding:4px 0;cursor:pointer;color:var(--dsw-alias-label-primary)}",
			".wbm-relrow:hover{text-decoration:underline}",
			".wbm-relkind{flex:none;font-size:10px;font-weight:600}",
			".wbm-relclaim{overflow-wrap:anywhere}",
			".wbm-hubs{display:flex;flex-direction:column;gap:5px;margin-top:26px;padding-top:18px;border-top:1px dashed var(--dsw-alias-border-l1)}",
			".wbm-hubrow{display:flex;gap:9px;align-items:baseline;text-align:left;font:inherit;font-size:12px;line-height:1.6;background:transparent;border:0;padding:3px 0;cursor:pointer;color:var(--dsw-alias-label-primary)}",
			".wbm-hubrow:hover{text-decoration:underline}",
			".wbm-hubdeg{flex:none;font-size:10px;color:var(--dsw-alias-label-secondary)}",
			".wbm-empty{margin-top:14px;padding:40px 22px;text-align:center;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary);border:1px dashed var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px)}",
			".wbm-note{margin-top:20px;font-size:10px;color:var(--dsw-alias-label-secondary)}",
			"@media (max-width:960px){.wbm-page{padding:22px 18px 40px}.wbm-hero{flex-direction:column;gap:18px}.wbm-stats{justify-content:flex-start}.wbm-grid{grid-template-columns:1fr}}",
			"@media (prefers-reduced-motion:reduce){.wbm-stat,.wbm-card,.wbm-chip{transition:none}.wbm-stat:hover,.wbm-card:hover{transform:none}}",
			".wbh-noteinline{position:relative;margin:0;text-align:right;flex:1;min-width:0;overflow-wrap:anywhere}",
			".wbh-atoms{position:relative;display:flex;flex-direction:column;gap:6px;margin-top:10px}",
			".wbh-atom{position:relative;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,12px);padding:9px 11px;cursor:pointer;transition:border-color 160ms cubic-bezier(.22,.8,.3,1),transform 160ms cubic-bezier(.22,.8,.3,1)}",
			".wbh-atom:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-1px)}",
			".wbh-atom.is-open{border-color:var(--dsw-alias-brand-primary)}",
			".wbh-atomhead{position:relative;display:flex;align-items:baseline;gap:8px}",
			".wbh-atomtype{flex:none;font-size:10px;font-weight:600;padding:1px 6px;border-radius:999px;color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}",
			".wbh-atomclaim{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}",
			".wbh-atommeta{position:relative;display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap}",
			".wbh-atomstate{flex:none}",
			".wbh-tag{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 5px;font-size:10px}",
			".wbh-atomrel{margin-left:auto;flex:none}",
			".wbh-atombody{position:relative;margin-top:9px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l1);font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary);display:flex;flex-direction:column;gap:5px;overflow-wrap:anywhere}",
			".wbh-rels{display:flex;flex-direction:column;gap:3px}",
			".wbh-rel{display:flex;gap:6px}",
			".wbh-relclaim{color:var(--dsw-alias-label-primary)}",
			".wbh-hubs{position:relative;margin-top:12px;padding-top:10px;border-top:1px dashed var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:4px}",
			".wbh-hubtitle{font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".wbh-hub{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}",
			".wbh-warnmargin{margin:0 0 10px}",

			".wbh-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}",
			".wbh-chip{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:11px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 10px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}",
			".wbh-chip:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
			".wbh-chip.is-on{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}",
			".wbh-chipdot{width:6px;height:6px;border-radius:50%;flex:none}",
			".wbh-libgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:12px;align-items:start}",
			".wbh-libcard{position:relative;overflow:hidden;text-align:left;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);padding:14px;cursor:pointer;transition:transform .18s cubic-bezier(.22,.8,.3,1),border-color .18s ease,box-shadow .18s ease}",
			".wbh-libcard:hover{transform:translateY(-3px);border-color:var(--dsw-alias-border-l2);box-shadow:0 14px 34px -18px rgba(0,0,0,.35)}",
			".wbh-libcard.is-open{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary) inset}",
			".wbh-libcard::before{content:'';position:absolute;inset:-40% -10% auto -10%;height:120px;pointer-events:none;opacity:.5;background:radial-gradient(60% 80% at 20% 0%,var(--wbh-tint,transparent),transparent 70%)}",
			".wbh-libtile.is-image{background:none;border:none;width:40px;height:40px;padding:0}",
			".wbh-libtile{position:relative;width:38px;height:38px;border-radius:var(--dsw-radius-md,8px);display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border:1px solid var(--dsw-alias-border-l1)}",
			".wbh-libtop{position:relative;display:flex;align-items:center;gap:10px}",
			".wbh-libname{display:block;font-size:13px;font-weight:600;line-height:1.35}",
			".wbh-libid{display:block;margin-top:2px;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10px;line-height:1.3;color:var(--dsw-alias-label-secondary);opacity:.75;word-break:break-all}",
			".wbh-libshort{position:relative;margin:11px 0 0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary);opacity:.92}",
			".wbh-cmd{position:relative;display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace)}",
			".wbh-cmd.is-on{color:var(--dsw-alias-brand-primary)}",
			".wbh-cmddot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.75;flex:none}",
			".wbh-cardbtns{position:relative;display:flex;align-items:center;gap:8px;margin-top:10px}",
			".wbh-btn{font:inherit;font-size:11px;font-weight:500;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,4px);padding:4px 12px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}",
			".wbh-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}",
			".wbh-btn:disabled{opacity:.6;cursor:default}",
			".wbh-btn.is-on{color:var(--dsw-alias-label-secondary);background:transparent}",
			".wbh-cmdline{position:relative;display:flex;align-items:center;gap:8px;margin-top:8px}",
			".wbh-cmdtext{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-radius:var(--dsw-radius-sm,4px);padding:2px 6px;overflow-wrap:anywhere}",
			".wbh-result{font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}",
			".wbh-libmore{position:relative;margin:9px 0 0;display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--dsw-alias-label-secondary)}",
			"@keyframes wbh-fade{0%{opacity:0}100%{opacity:1}}",
			"@keyframes wbh-pop{0%{opacity:0;transform:translateY(8px) scale(.985)}100%{opacity:1;transform:translateY(0) scale(1)}}",
			".wbh-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,8,18,.5);animation:wbh-fade .16s ease-out}",
			".wbh-dialog{width:100%;max-width:600px;max-height:78vh;overflow:auto;box-sizing:border-box;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-panel,16px);box-shadow:0 24px 60px -18px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.12);animation:wbh-pop .2s cubic-bezier(.22,.8,.3,1);color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,inherit)}",
			".wbh-dialoghead{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".wbh-dialogicon{flex:none;display:flex}",
			".wbh-dialogtitle{display:block;font-size:15px;font-weight:600;line-height:1.3}",
			".wbh-dialoggroup{display:block;margin-top:3px;font-size:10px;letter-spacing:.05em;color:var(--dsw-alias-label-secondary)}",
			".wbh-close{flex:none;margin-left:auto;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--dsw-radius-sm,4px);border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}",
			".wbh-close:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}",
			".wbh-dialogbody{padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px}",
			".wbh-skel{display:flex;flex-direction:column;gap:8px}",
			".wbh-skelline{height:26px;border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));background-image:linear-gradient(90deg,transparent,rgba(127,127,127,.18),transparent);background-size:200px 100%;animation:wbh-shimmer 1.4s linear infinite}",
			".wbh-notice{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:var(--dsw-radius-md,8px);border:1px dashed var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06));font-size:11px;line-height:1.6;color:var(--dsw-alias-label-secondary)}",
			".wbh-notice b{font-weight:600;color:var(--dsw-alias-label-primary)}",

			".wbh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}",
			".wbh-next{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);padding:13px 14px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.04));transition:border-color .16s ease,transform .16s cubic-bezier(.22,.8,.3,1)}",
			".wbh-next:hover{border-color:var(--dsw-alias-brand-primary);transform:translateY(-2px)}",
			".wbh-nexticon{color:var(--dsw-alias-brand-primary);display:flex;margin-bottom:7px}",
			".wbh-nexttitle{font-size:12px;font-weight:600;margin-bottom:3px}",
			".wbh-nexthint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary)}",
			".wbh-foot{margin:20px 0 0;font-size:10px;line-height:1.6;color:var(--dsw-alias-label-secondary);opacity:.75}",
			".wbh-page :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;border-radius:var(--dsw-radius-sm,4px)}",
			"@media (prefers-reduced-motion:reduce){.wbh-heroframe,.wbh-stats,.wbh-card,.wbh-dot,.wbh-skelline,.wbh-backdrop,.wbh-dialog{animation:none !important;transition:none !important}}"
		].join("\n");

		/** 侧边栏入口图标：一块"面板"抽象，与官方条目同为线性风格。 */
		function PanelIcon(props) {
			const s = typeof props?.size === "number" && props.size > 0 ? props.size : 20;
			return h(
				"svg",
				{ width: s, height: s, viewBox: "0 0 24 24", fill: "none", role: "img", "aria-label": props?.label, style: { display: "block", flex: "none" } },
				h("rect", { x: "2.75", y: "3.75", width: "18.5", height: "16.5", rx: "4", stroke: "currentColor", strokeWidth: "1.6" }),
				h("path", { d: "M9.5 3.9v16.2", stroke: "currentColor", strokeWidth: "1.6" }),
				h("path", { d: "M5.4 8.2h1.6M5.4 11.6h1.6", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", opacity: "0.7" }),
				h("path", { d: "M12.6 8.4h5.2M12.6 11.9h5.2M12.6 15.4h3.2", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", opacity: "0.55" })
			);
		}

		/** 卡片小图标：书（能力库）。 */
		/** 图标：记忆库（节点 + 连线）。 */
		function GraphIcon(props) {
			// 侧边栏会传 size（与官方图标一致）；页面内图标默认 16。
			const size = props !== undefined && typeof props.size === "number" ? props.size : 16;
			return h(
				"svg",
				{ width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block" } },
				h("circle", { cx: "12", cy: "6.2", r: "2.6", fill: "none", stroke: "currentColor", strokeWidth: "1.6" }),
				h("circle", { cx: "6.4", cy: "17.2", r: "2.4", fill: "none", stroke: "currentColor", strokeWidth: "1.6" }),
				h("circle", { cx: "17.6", cy: "17.2", r: "2.4", fill: "none", stroke: "currentColor", strokeWidth: "1.6" }),
				h("path", { d: "M10.9 8.5l-2.8 6.3M13.1 8.5l2.8 6.3M8.8 17.2h6.4", fill: "none", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })
			);
		}

		function BookIcon() {
			return h(
				"svg",
				{ width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block" } },
				h("path", { d: "M4 4.6h6.2c1 0 1.8.8 1.8 1.8v13c0-1-.8-1.8-1.8-1.8H4z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }),
				h("path", { d: "M20 4.6h-6.2c-1 0-1.8.8-1.8 1.8v13c0-1 .8-1.8 1.8-1.8H20z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round", opacity: "0.7" })
			);
		}

		/** 分类小图标：按技能前缀给一个形状，卡片靠图形而不是文字被识别。 */
		function CategoryGlyph(props) {
			const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block" } };
			if (props.kind === "workbench") {
				return h("svg", common, h("path", { d: "M4 8.4h16v10.2H4z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }), h("path", { d: "M9 8.4V6.8A1.8 1.8 0 0 1 10.8 5h2.4A1.8 1.8 0 0 1 15 6.8v1.6", stroke: "currentColor", strokeWidth: "1.6" }), h("path", { d: "M4 12.6h16", stroke: "currentColor", strokeWidth: "1.4", opacity: "0.6" }));
			}
			if (props.kind === "personal") {
				return h("svg", common, h("path", { d: "M12 3.6l8 4.2-8 4.2-8-4.2z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }), h("path", { d: "M4 12.4l8 4.2 8-4.2", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round", opacity: "0.7" }), h("path", { d: "M4 16.6l8 4.2 8-4.2", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round", opacity: "0.4" }));
			}
			if (props.kind === "ui") {
				return h("svg", common, h("circle", { cx: "12", cy: "12", r: "8.2", stroke: "currentColor", strokeWidth: "1.6" }), h("circle", { cx: "9.4", cy: "10" , r: "1.3", fill: "currentColor" }), h("circle", { cx: "14.2", cy: "9.4", r: "1.3", fill: "currentColor", opacity: "0.7" }), h("circle", { cx: "12.4", cy: "14.6", r: "1.3", fill: "currentColor", opacity: "0.45" }));
			}
			return h("svg", common, h("circle", { cx: "12", cy: "12", r: "3", stroke: "currentColor", strokeWidth: "1.6" }), h("path", { d: "M12 3.4v3M12 17.6v3M3.4 12h3M17.6 12h3", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", opacity: "0.6" }));
		}

		/** 关闭图标（弹窗右上角）。 */
		function CloseIcon() {
			return h(
				"svg",
				{ width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block" } },
				h("path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })
			);
		}

		/**
		 * 技能详情弹窗：卡片本身完全不动，详情在这里有足够空间。
		 * 交互：Esc / 点遮罩 / 点右上角 × 关闭；打开时把焦点移到关闭按钮；`prefers-reduced-motion` 下不动画。
		 *
		 * @param props - `skill` 选中的技能行；`t` 文案；`onClose` 关闭回调。
		 */
		function SkillDialog(props) {
			const skill = props.skill;
			const t = props.t;
			const onClose = props.onClose;
			const closeRef = React.useRef(null);
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKeyDown);
				if (closeRef.current !== null && typeof closeRef.current.focus === "function") closeRef.current.focus();
				return () => document.removeEventListener("keydown", onKeyDown);
			}, []);
			const icon = SKILL_ICONS[skill.dir];
			return h(
				"div",
				{ className: "wbh-backdrop", role: "presentation", onClick: onClose },
				h(
					"div",
					{
						className: "wbh-dialog",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": skill.title ?? skill.name,
						onClick: (event) => event.stopPropagation()
					},
					h(
						"div",
						{ className: "wbh-dialoghead" },
						h(
							"span",
							{ className: "wbh-dialogicon" },
							icon
								? h("img", { src: icon, alt: "", width: 46, height: 46, style: { display: "block", borderRadius: "var(--dsw-radius-md,8px)" } })
								: h(CategoryGlyph, { kind: skill.tone })
						),
						h(
							"span",
							{ style: { minWidth: 0, flex: "1 1 auto" } },
							h("span", { className: "wbh-dialogtitle" }, skill.title ?? skill.name),
							h("span", { className: "wbh-libid" }, skill.name),
							h("span", { className: "wbh-dialoggroup" }, skill.group)
						),
						h("button", { ref: closeRef, type: "button", className: "wbh-close", "aria-label": t("lib.close"), title: t("lib.close"), onClick: onClose }, h(CloseIcon, null))
					),
					h(
						"div",
						{ className: "wbh-dialogbody" },
						skill.whenToUse ? h("div", { className: "wbh-field" }, h("b", null, t("lib.trigger")), skill.whenToUse) : null,
						h("div", { className: "wbh-field" }, h("b", null, t("lib.what")), skill.indexed ? skill.description : t("lib.missing")),
						h(
							"div",
							{ className: "wbh-field" },
							h("b", null, t("lib.how")),
							t("lib.how.value"),
							skill.command ? h("span", { className: "wbh-path" }, `　在输入框敲 /${skill.command} 可以直接调用（当前已${t("lib.cmd.on")}）。`) : `　当前${t("lib.cmd.off")}，说一声就加。`
						),
						h("div", { className: "wbh-field" }, h("b", null, t("lib.source")), h("span", { className: "wbh-path" }, skill.path))
					)
				)
			);
		}

		/** 下一阶段的三枚图标。 */
		function StageIcon(props) {
			const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block" } };
			if (props.kind === "resources") {
				return h("svg", common, h("path", { d: "M12 3.4l8 4.3-8 4.3-8-4.3z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }), h("path", { d: "M4 12.4l8 4.3 8-4.3", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round", opacity: "0.7" }), h("path", { d: "M4 16.9l8 4.3 8-4.3", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round", opacity: "0.4" }));
			}
			if (props.kind === "orchestrate") {
				return h("svg", common, h("circle", { cx: "6", cy: "6.5", r: "2.4", stroke: "currentColor", strokeWidth: "1.6" }), h("circle", { cx: "18", cy: "12", r: "2.4", stroke: "currentColor", strokeWidth: "1.6" }), h("circle", { cx: "6", cy: "17.5", r: "2.4", stroke: "currentColor", strokeWidth: "1.6" }), h("path", { d: "M8.2 7.6l7.6 3.2M15.8 13.2l-7.6 3.2", stroke: "currentColor", strokeWidth: "1.5", opacity: "0.7" }));
			}
			return h("svg", common, h("path", { d: "M14.5 3.2c-5.6.4-9.3 3.6-9.8 9.4-.1 1.6 1.2 2.9 2.8 2.8 5.8-.5 9-4.2 9.4-9.8z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }), h("path", { d: "M9 15l-3.6 3.6M13.6 10.4l3.2-3.2", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", opacity: "0.75" }));
		}

		/**
		 * 把列目录的返回值里能用的名字抠出来（返回结构未见确切类型定义，故防御式解析）。
		 * @param listing - listDirectory 的返回值。
		 * @returns 排序去重后的条目名数组。
		 */
		function namesOf(listing) {
			const raw = Array.isArray(listing)
				? listing
				: Array.isArray(listing?.entries)
					? listing.entries
					: Array.isArray(listing?.items)
						? listing.items
						: [];
			const names = raw
				.map((entry) => (typeof entry === "string" ? entry : entry?.name ?? entry?.basename ?? entry?.path ?? ""))
				.map((value) => String(value).replace(/\/+$/, "").split("/").pop() ?? "")
				.filter((value) => value.length > 0 && !value.startsWith("."));
			return [...new Set(names)].sort((a, b) => a.localeCompare(b));
		}

		/**
		 * 把"索引快照 + 实时目录"合成页面要的行：
		 * 索引里有描述的用富行；目录里有但索引没记的用简行（并提示重跑索引）。
		 * @param liveNames - 实时目录里的名字（null = 目录读不到）。
		 * @returns 行数组，按分组与名字排序。
		 */
		function rowsOf(liveNames) {
			// 形状防御：目录服务返回非数组时按"读不到目录"处理（原本会让整页抛错白屏）
			const live = Array.isArray(liveNames) ? new Set(liveNames) : null;
			const rows = SKILL_INDEX.skills
				.filter((skill) => live === null || live.has(skill.name) || live.has(skill.dir))
				.map((skill) => ({ ...skill, indexed: true }));
			if (live !== null) {
				const known = new Set(SKILL_INDEX.skills.flatMap((skill) => [skill.name, skill.dir]));
				for (const liveName of liveNames) {
					if (!known.has(liveName)) {
						rows.push({ name: liveName, dir: liveName, group: "其它", description: "", whenToUse: "", excerpt: "", path: `data/skills/${liveName}/SKILL.md`, indexed: false });
					}
				}
			}
			return rows.sort((a, b) => String(a.group).localeCompare(String(b.group), "zh") || String(a.name).localeCompare(String(b.name)));
		}

		/** 类型配色（低饱和、与官方令牌不冲突）。 */
		const MEM_TYPE_COLORS = { "经验": "#5b8def", "教训": "#e4794c", "约束": "#c4553d", "原则": "#6e7bd9", "偏好": "#3fa98a", "决策": "#a66bd4" };
		/** 关系配色。 */
		const MEM_REL_COLORS = { "同构": "#7c8b9c", "先例": "#3fa98a", "相斥": "#c4553d", "因果": "#e4794c", "通则": "#5b8def", "联想": "#a66bd4", "取代": "#8a8f98" };
		const memTypeColor = (type) => MEM_TYPE_COLORS[type] ?? "#7c8b9c";
		const memRelColor = (rel) => MEM_REL_COLORS[rel] ?? "#7c8b9c";

		/* MEM3D:BEGIN —— 关系图的「球棍模型」引擎（纯函数 + 一块 canvas；零依赖，可整段切片复用）
		 * 为什么自己写：本工作台不许装包 / 不许引 CDN（AGENTS.md），而 DOM 逐点定位在 260+ 个点上会卡，
		 * 所以走 canvas 2D 自投影 —— 每帧只改数字、不动 DOM。
		 * 观感目标（用户验收标准）：像化学课本里的球棍图 —— 实心球 + 直杆键 + 纸面底；**不是**星空。
		 * 明确不要：深空背景 / 雾 / 光晕 / 霓虹 / 自转 / 拿微小散点当星空纹理。
		 * 这段是**自包含**的（只依赖 Math 与入参）：tools/preview-memory-3d.mjs 会把这段原样切下来
		 * 塞进离线预览页截图自审 —— 改这里就等于改预览，两边不会漂移。
		 */

		/** 焦距（世界单位，整体半径约 0.95）：越大越"平"，越小越"广角"。 */
		const MEM3D_FOCAL = 3.4;
		/**
		 * 透视缩放 s 的硬夹取区间（s = focal/(focal − z)，世界半径归一化到 1 时真实值是 0.79–1.31）。
		 * 为什么要夹：s 是**屏幕坐标的乘数**，一旦 z 靠近 focal（或数据被换成没归一化的野值），
		 * s 会爆掉/变负 → 坐标飞到画布外 → 满屏飞线。夹取之后最坏情况只是"某个球大小不对"，
		 * 而不是"整张图被一条线拉穿"。
		 */
		const MEM3D_S_MIN = 0.5;
		const MEM3D_S_MAX = 2.0;
		/** 相机空间深度上限：把 z 归一化成 0..1 的"远近"（只用来分档变暗，不做雾）。 */
		const MEM3D_DEPTH = 1.45;
		/** 初始视角（确定性）。 */
		const MEM3D_VIEW0 = { rotX: -0.24, rotY: 0.72, scale: 1 };
		/** 缩放夹持范围（别让人把球转丢）。 */
		const MEM3D_SCALE_MIN = 0.55;
		const MEM3D_SCALE_MAX = 2.6;
		/** canvas 里取不到 CSS 变量，这里写与 --dsw-font-family 同一套兜底栈。 */
		const MEM3D_FONT = "'PingFang SC','Microsoft YaHei',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

		/** 球的半径分级：有连接的明显更大（度数越高越大），孤立的也在 5px 上下 —— 看得出是个球，不是尘埃。 */
		function mem3dRadius(degree) {
			const d = degree > 0 ? degree : 0;
			return (3.2 + Math.min(d, 6) * 1.15) * (d === 0 ? 1.06 : 1);
		}

		/** "#rrggbb" → [r,g,b]；非法色值退回中性灰。 */
		function mem3dRgb(color) {
			const text = String(color === undefined || color === null ? "" : color);
			if (/^#[0-9a-fA-F]{6}$/.test(text)) {
				return [parseInt(text.slice(1, 3), 16), parseInt(text.slice(3, 5), 16), parseInt(text.slice(5, 7), 16)];
			}
			return [134, 144, 156];
		}

		/** 往中性灰降饱和（浅色主题上不刺眼；六色仍是六色，只是不再荧光）。 */
		function mem3dCalm(color) {
			const base = mem3dRgb(color);
			const mix = [126, 130, 138];
			const k = 0.26;
			const v = [0, 1, 2].map((i) => Math.round(base[i] + (mix[i] - base[i]) * k));
			return [v[0], v[1], v[2]];
		}

		/**
		 * 球面明暗：基色 → 8 档（暗 → 本色 → 亮 → 高光）。
		 * 只往白里调，不往黑里去 —— 浅色主题上"压黑"会把球糊成一团墨点。
		 * @param base - 降饱和后的 `[r,g,b]`。
		 */
		function mem3dShades(base) {
			const out = new Array(8);
			const ink = [0, 1, 2].map((i) => Math.round(base[i] * 0.74));
			for (let band = 0; band < 8; band++) {
				let v = null;
				if (band <= 2) {
					const k = (2 - band) / 2;
					v = [0, 1, 2].map((i) => Math.round(base[i] + (ink[i] - base[i]) * k));
				} else {
					const k = (band - 3) / 4;
					const lit = 0.2 + 0.28 * (band === 7 ? 1 : k);
					v = [0, 1, 2].map((i) => Math.round(base[i] + (255 - base[i]) * lit));
				}
				out[band] = "rgb(" + v[0] + "," + v[1] + "," + v[2] + ")";
			}
			return out;
		}

		/**
		 * 六个类型的轴向（确定性、写死的一张表）：
		 * 上下各一个 + 赤道平面上按 72° 均匀摆五个（含 36° 错位）——**三个轴都有分量**，
		 * 所以整朵结构有厚度，不是一张平面圆环，也不会有一半类型挤在同一个平面上。
		 */
		function mem3dAxis(i) {
			const TAN = 0.7265425;   // tan36°，赤道环的轻微倾斜
			const axes = [
				[0, 0, 1],
				[0, 0, -1],
				[Math.sin(0.6283185307), Math.cos(0.6283185307), TAN],
				[Math.sin(1.2566370614), Math.cos(1.2566370614), -TAN],
				[Math.sin(1.8849555922), Math.cos(1.8849555922), TAN],
				[Math.sin(2.5132741229), Math.cos(2.5132741229), -TAN]
			];
			const a = axes[Math.abs(Math.round(i)) % axes.length];
			const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1;
			return { x: a[0] / len, y: a[1] / len, z: a[2] / len };
		}

		/** 确定性散列 0..1（替代随机数：同一份数据每次都长一样，刷新不跳）。 */
		function mem3dHash(n, salt) {
			const x = Math.sin(n * 12.9898 + salt * 78.233 + 4.14) * 43758.5453;
			return x - Math.floor(x);
		}

		/**
		 * 确定性 3D 球棍布局：**按类型分簇的实心分子团**。
		 * 每条边把两端往中间拉 → 有连接的原子自己聚成分子；类型心撑开 → 跨类边连成更大的结构；
		 * 孤立原子往簇心收成小团（不是撒成星空）。全程无随机（只有确定性散列）→ 刷新不跳（本仓库铁律）。
		 * @param atoms - 原子数组（当前筛选后的）。
		 * @param edges - 边数组（两端都在 atoms 里）。
		 * @param colorOf - `(atom) => "#rrggbb"`（由调用方注入，避免两处配色漂移）。
		 * @param relColorOf - `(rel) => "#rrggbb"`（球棍模型的杆是中性灰，这里只用来分粗细）。
		 * @returns 模型：定长类型化数组（**只在这里分配一次，之后每帧复用**）。
		 */
		function mem3dBall(atoms, edges, colorOf, relColorOf) {
			const count = atoms.length;
			const edgeCount = edges.length;
			const idIndex = new Map();
			const ids = new Array(count);
			const base = new Float32Array(count);
			const deg = new Int16Array(count);
			const rgb = new Float32Array(count * 3);
			const shades = new Array(count);
			const xs = new Float32Array(count);
			const ys = new Float32Array(count);
			const zs = new Float32Array(count);
			const eFrom = new Int32Array(edgeCount);
			const eTo = new Int32Array(edgeCount);
			const eWidth = new Float32Array(edgeCount);
			const eDash = new Uint8Array(edgeCount);
			atoms.forEach((atom, i) => {
				idIndex.set(atom.id, i);
				ids[i] = atom.id;
				const calm = mem3dCalm(colorOf(atom));
				rgb[i * 3] = calm[0];
				rgb[i * 3 + 1] = calm[1];
				rgb[i * 3 + 2] = calm[2];
				shades[i] = mem3dShades(calm);
			});
			edges.forEach((edge, j) => {
				const a = idIndex.has(edge.from) ? idIndex.get(edge.from) : -1;
				const b = idIndex.has(edge.to) ? idIndex.get(edge.to) : -1;
				eFrom[j] = a;
				eTo[j] = b;
				if (a >= 0 && b >= 0) {
					deg[a] += 1;
					deg[b] += 1;
				}
				// 杆是中性灰（不用关系的彩虹色），只按关系类型分**两族**：粗实线（结构性的关系）
				// 与细虚线（弱连接）。relColorOf 仍然叫一次，是为了保持调用方注入配色的契约不变。
				void relColorOf(edge.rel);
				const weak = edge.rel === "相斥" || edge.rel === "取代" || edge.rel === "联想";
				eWidth[j] = weak ? 1.6 : 2.4;
				eDash[j] = weak ? 1 : 0;
			});
						// —— 布点：**按类型分锥**（一个类型 = 一根从中心往外辐射的锥），不是按连通分量分团 ——
			// 为什么改：这份数据里 327 条边把 264 个原子连成**一个**连通分量，其中 188 条是跨类型的。
			// 老写法"一个连通分量 = 一个分子、一个分子占一个锥位"于是退化成"全体共用一根锥"：类型信息在布点
			// 阶段就丢了，接着的弹簧松弛再把六类揉进同一小团（实测最小质心夹角 2.2°、同类/全体均距 0.979、
			// 质心半径只剩 0.08–0.27，六类成了一坨）。新写法把**类型放回第一位**：原子落在哪根锥里由它的类型定。
			// 关键性质：键要短，跨类型的两端**各自沿自己那根锥往里收**就够了 —— 不必跑到别的类型的地盘上。
			// 于是"键短"与"类型分得开"在这里不打架（老写法里二者不可能同时成立：一个分子只有一根锥）。
			const groups = new Map();
			atoms.forEach((atom, i) => {
				if (!groups.has(atom.type)) groups.set(atom.type, []);
				groups.get(atom.type).push(i);
			});
			const typeNames = [...groups.keys()];
			const typeCount = Math.max(1, typeNames.length);
			// —— 类型 → 方向：按"关系密度"分配 ——
			// 跨类型的键要短，那么**关系最密的两个类型就该摆在夹角最小的两根轴上**（否则它们的键会横穿整朵结构）。
			// 六个方向只有 720 种摆法：全枚举，取"按边数加权的夹角和"最小的那一种。纯算术、确定性（不随刷新变）。
			const typeIndex = new Map(typeNames.map((type, ti) => [type, ti]));
			const affinity = typeNames.map(() => new Float64Array(typeCount));
			for (let j = 0; j < edgeCount; j++) {
				const a = eFrom[j];
				const b = eTo[j];
				if (a < 0 || b < 0) continue;
				const ia = typeIndex.get(atoms[a].type);
				const ib = typeIndex.get(atoms[b].type);
				if (ia === ib) continue;
				affinity[ia][ib] += 1;
				affinity[ib][ia] += 1;
			}
			const axisDirs = [];
			for (let i = 0; i < typeCount; i++) axisDirs.push(mem3dAxis(i));
			const angleOf = (p, q) => Math.acos(Math.max(-1, Math.min(1, p.x * q.x + p.y * q.y + p.z * q.z)));
			const slots = [];
			for (let i = 0; i < typeCount; i++) slots.push(i);
			let bestOrder = slots.slice();
			let bestCost = Infinity;
			const walk = (k) => {
				if (k === slots.length) {
					let cost = 0;
					for (let i = 0; i < slots.length; i++) {
						for (let j = i + 1; j < slots.length; j++) cost += affinity[i][j] * angleOf(axisDirs[slots[i]], axisDirs[slots[j]]);
					}
					if (cost < bestCost - 1e-9) {
						bestCost = cost;
						bestOrder = slots.slice();
					}
					return;
				}
				for (let i = k; i < slots.length; i++) {
					const held = slots[k];
					slots[k] = slots[i];
					slots[i] = held;
					walk(k + 1);
					const back = slots[k];
					slots[k] = slots[i];
					slots[i] = back;
				}
			};
			walk(0);
			// 密度 → 形状参数（纯函数，便于自审与量尺）：边越多，锥越"硬"（收拢力越大），类与类也拉得越开
			const shape = mem3dShape(edgeCount, count);
			const axisX = new Float32Array(count);
			const axisY = new Float32Array(count);
			const axisZ = new Float32Array(count);
			const homeRho = new Float32Array(count);
			/** 把"绕 +Z 轴的锥面点"旋到某个类型的轴向：罗德里格斯公式（纯算术，无随机）。 */
			const tilt = (dir, ux, uy, uz) => {
				const d = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z) || 1;
				const ax = dir.x / d;
				const ay = dir.y / d;
				const az = dir.z / d;
				// +Z → ax,ay,az 轴的旋转矩阵（az = −1 的退化情形单独处理）
				if (az < -0.999999) return { x: ux, y: -uy, z: -uz };
				const k = 1 / (1 + az);
				return {
					x: ax * uz + (1 - ax * ax * k) * ux - ax * uy,
					y: ay * uz - ay * ax * k * ux + (1 - ay * ay * k) * uy,
					z: (1 - az * az * k) * uz - az * ax * k * ux - az * ay * k * uy
				};
			};
			typeNames.forEach((type, ti) => {
				const dir = typeCount === 1 ? { x: 0, y: 0, z: 1 } : axisDirs[bestOrder[ti]];
				// 度数高的先摆：枢纽落在锥的"脊"上（靠近轴 → 也靠近中心，跨类型的键最容易在这里接上），
				// 叶子铺到锥的外缘。排序确定性（度数降序、同度按下标）→ 刷新不跳。
				const members = groups.get(type).slice().sort((a, b) => deg[b] - deg[a] || a - b);
				// 锥的半角按这一类的份额定（大类占宽一点、小类收窄），但绝不宽到吃掉邻居的方向。
				// 太窄（细射线）：点云被拉成"六根射线"，中位点对距离掉下来、键就相对变长（实测中位只有 0.75）；
				// 太宽（大扇面）：同类摊得太散，"同类比"又上去了。下面这个 sqrt 份额是量尺扫出来的平衡点。
				const cone = Math.min(shape.coneMax, shape.coneMin + shape.coneScale * Math.pow(members.length / Math.max(1, count), shape.conePow));
				members.forEach((i, k) => {
					const ring = Math.sqrt((k + 0.5) / members.length);       // 0..1：锥心 → 锥缘（面积均匀）
					const phi = k * 2.3999632297 + ti * 0.7853981634;         // 黄金角：同类内部不扎堆
					const cw = Math.cos(cone * ring);
					const sw = Math.sin(cone * ring);
					const local = { x: Math.cos(phi) * sw, y: Math.sin(phi) * sw, z: cw };
					const turned = tilt(dir, local.x, local.y, local.z);
					// 半径：一半按"度数序"（枢纽靠近锥心 → 也靠近全图中心，跨类型的键在这里接得上），
					// 一半按与角度**去相关**的低差异序列（锥铺满 → 有厚度、不是一层空壳）。
					const u = (k * 0.7548776662466927 + ti * 0.3183098862 + 0.5) % 1;
					const rad = shape.radMix * ((k + 0.5) / members.length) + (1 - shape.radMix) * u;
					const rho = shape.inner + (shape.outer - shape.inner) * (0.12 + 0.88 * rad);
					xs[i] = turned.x * rho;
					ys[i] = turned.y * rho;
					zs[i] = turned.z * rho;
					axisX[i] = dir.x;
					axisY[i] = dir.y;
					axisZ[i] = dir.z;
					homeRho[i] = rho;
				});
			});
			// —— 松开：确定性的"球不相撞"松弛 ——
			// 布点只保证"类型在正确的锥里"；球与球还叠着，杆会看不见。这里用**网格近邻**（不是 O(n²) 全配对）
			// 做几轮互相推开，同时让键把两端拉近、让类型收拢力把原子按回自己的锥 —— 三股力都是纯算术、无随机
			// → 同一份数据每次得到同一朵结构，刷新不跳。
			const gaps = new Float32Array(count);
			for (let i = 0; i < count; i++) gaps[i] = deg[i] > 0 ? shape.gapLinked : shape.gapLone;
			const crossEdge = new Uint8Array(edgeCount);
			for (let j = 0; j < edgeCount; j++) {
				const a = eFrom[j];
				const b = eTo[j];
				crossEdge[j] = a >= 0 && b >= 0 && atoms[a].type !== atoms[b].type ? 1 : 0;
			}
			const CELL = 0.24;
			const grid = new Map();
			const cellOf = (v) => Math.floor(v / CELL);
			// 网格键用**整数**而不是字符串：每轮要重建 count 次、每点再查 27 格，字符串拼键是这里最大的一笔开销。
			// 整数键让同样的 160+ 轮松弛比老写法（140 轮 + 字符串键）还快（见 tools/measure-memory-3d.mjs 的耗时）。
			// 进制要够宽：每维给 4096 档（±2048 格 = ±490 世界单位，远超构图半径），否则会撞键
			const keyOf = (a, b, c) => (a + 2048) * 16777216 + (b + 2048) * 4096 + (c + 2048);
			for (let pass = 0; pass < shape.passes; pass++) {
				grid.clear();
				for (let i = 0; i < count; i++) {
					const key = keyOf(cellOf(xs[i]), cellOf(ys[i]), cellOf(zs[i]));
					const held = grid.get(key);
					if (held === undefined) grid.set(key, [i]);
					else held.push(i);
				}
				const fx = new Float32Array(count);
				const fy = new Float32Array(count);
				const fz = new Float32Array(count);
				for (let i = 0; i < count; i++) {
					const gx = cellOf(xs[i]);
					const gy = cellOf(ys[i]);
					const gz = cellOf(zs[i]);
					for (let a = -1; a <= 1; a++) {
						for (let b = -1; b <= 1; b++) {
							for (let c = -1; c <= 1; c++) {
								const held = grid.get(keyOf(gx + a, gy + b, gz + c));
								if (held === undefined) continue;
								for (const j of held) {
									if (j <= i) continue;
									const want = (gaps[i] + gaps[j]) * 0.78;
									const dx = xs[j] - xs[i];
									const dy = ys[j] - ys[i];
									const dz = zs[j] - zs[i];
									const dist2 = dx * dx + dy * dy + dz * dz;
									if (dist2 >= want * want || dist2 < 1e-9) continue;
									const dist = Math.sqrt(dist2);
									const push = ((want - dist) / dist) * 0.5;
									fx[i] -= dx * push;
									fy[i] -= dy * push;
									fz[i] -= dz * push;
									fx[j] += dx * push;
									fy[j] += dy * push;
									fz[j] += dz * push;
								}
							}
						}
					}
				}
				// 键的两端互相吸引（杆的长短决定分子的形状；但别短到把球叠起来）。
				// **同类型**的键走常规弹簧（两端对拉，锥内更紧）。
				// **跨类型**的键也拉，但拉得**轻**（shape.cross）：它一边把键拉短，一边被"按回自己那根锥轴"的
				// 收拢力顶住 —— 两股力的大小都随边密度缩放（见 mem3dShape），所以边越密，类型结构反而**越稳**。
				// （试过"跨类型只沿各自锥轴往里收、完全不施加拉力"的写法：不动的方向守住了，但键短不下来，
				//   实测超过中位数的边从 8 条涨到 64 条 —— 所以这里选"轻拉 + 硬收拢"这条更稳的路。）
				for (let j = 0; j < edgeCount; j++) {
					const a = eFrom[j];
					const b = eTo[j];
					if (a < 0 || b < 0) continue;
					const want = (gaps[a] + gaps[b]) * shape.link;
					const dx = xs[b] - xs[a];
					const dy = ys[b] - ys[a];
					const dz = zs[b] - zs[a];
					const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
					const pull = Math.max(-shape.pullCap, Math.min(shape.pullCap, (dist - want) * shape.spring * (crossEdge[j] === 1 ? shape.cross : 1)));
					fx[a] += (dx / dist) * pull;
					fy[a] += (dy / dist) * pull;
					fz[a] += (dz / dist) * pull;
					fx[b] -= (dx / dist) * pull;
					fy[b] -= (dy / dist) * pull;
					fz[b] -= (dz / dist) * pull;
				}
				// 每轮每个原子最多走 shape.step 这么远（**阻尼**）。为什么不直接全量走：球的互斥力在"两球快贴上"时
				// 会突然变得极大（push ∝ 1/距离），全量走会让整个系统在几十轮之后**一直抖**（实测 500 轮后每轮总位移
				// 仍在 65–75 之间来回，永不收敛）—— 那样"跑多少轮"就决定最终形状，同一份数据换个轮数就换一朵结构。
				// 夹住步长后系统会真的停下来，收敛判定才有意义，轮数也不再是形状的隐藏参数。
				let moved = 0;
				for (let i = 0; i < count; i++) {
					const ax = axisX[i];
					const ay = axisY[i];
					const az = axisZ[i];
					// ① 方向：偏离锥轴的**垂直分量**按回去（管"类型分不分得开"，随密度变硬）
					const along = xs[i] * ax + ys[i] * ay + zs[i] * az;
					// ② 半径：沿轴按回"本垒半径"（**故意比 ① 弱** —— 跨类型的键要靠沿轴滑动把键拉短）
					const backR = (homeRho[i] - along) * shape.rho;
					let dx = fx[i] - (xs[i] - along * ax) * shape.cohere + ax * backR;
					let dy = fy[i] - (ys[i] - along * ay) * shape.cohere + ay * backR;
					let dz = fz[i] - (zs[i] - along * az) * shape.cohere + az * backR;
					const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (mag > shape.step) {
						const cut = shape.step / mag;
						dx *= cut;
						dy *= cut;
						dz *= cut;
					}
					xs[i] += dx;
					ys[i] += dy;
					zs[i] += dz;
					moved += (dx < 0 ? -dx : dx) + (dy < 0 ? -dy : dy) + (dz < 0 ? -dz : dz);
				}
				if (moved < count * 0.0008) break;
			}
		
			// 构图居中（减去质心）→ 旋转是绕自己的中心转；再归一化到半径约 1（投影视野与数据规模无关）
			let mx = 0;
			let my = 0;
			let mz = 0;
			for (let i = 0; i < count; i++) {
				mx += xs[i];
				my += ys[i];
				mz += zs[i];
			}
			mx /= Math.max(1, count);
			my /= Math.max(1, count);
			mz /= Math.max(1, count);
			let reach = 0.0001;
			for (let i = 0; i < count; i++) {
				const x = xs[i] - mx;
				const y = ys[i] - my;
				const z = zs[i] - mz;
				reach = Math.max(reach, Math.sqrt(x * x + y * y + z * z));
			}
			const fit = 1 / reach;
			for (let i = 0; i < count; i++) {
				xs[i] = (xs[i] - mx) * fit;
				ys[i] = (ys[i] - my) * fit;
				zs[i] = (zs[i] - mz) * fit;
				base[i] = mem3dRadius(deg[i]);
			}
			// 帧缓冲：投影结果 + 画家排序 + 球面/杆的渐变缓存，都在这里一次分配、每帧复用。
			// ok 默认全 1：没投影过就按"都有效"处理（与老行为一致，不会因为漏调 project 而白屏）。
			const frame = {
				sx: new Float32Array(count),
				sy: new Float32Array(count),
				r: new Float32Array(count),
				z: new Float32Array(count),
				s: new Float32Array(count),
				ok: new Uint8Array(count).fill(1),
				key: new Float32Array(count + edgeCount),
				order: new Int32Array(count + edgeCount),
				sphere: new Array(count),
				rod: null
			};
			return { count, edgeCount, ids, xs, ys, zs, base, deg, rgb, shades, eFrom, eTo, eWidth, eDash, frame };
		}

		/**
		* 边密度 → 形状参数（纯函数，便于自审与量尺）。
		* `dens` = 每个原子摊到的边数（本快照 327 / 264 = 1.24；旧世界 27 / 256 ≈ 0.11）。
		* 边越多，三样东西一起变硬 —— 这就是"布局随边密度缩放"的落点：
		*   · cone  —— 每根锥的半角（类型之间在方向上留出空档）
		*   · cohere—— 把原子按回**自己那根锥轴**的力（管类型分不分得开）
		*   · rho   —— 沿轴按回"本垒半径"的力（管锥的长短与厚度）
		* 关键是 cohere 比 rho 硬得多：方向被钉住、半径可以滑。跨类型的键于是只能把两端**沿各自的锥**往里收，
		* 既把键拉短、又不会把两类拽成一团 —— "键短"与"类型分得开"因此能同时成立。
		* 密度低时它几乎不介入（27 条边的旧世界照旧由弹簧主导），密度高时类型结构由它兜住。
		*/
		function mem3dShape(edgeCount, count) {
			const dens = Math.min(3, edgeCount / Math.max(1, count));
			const hard = 1 + Math.min(1.5, dens * 0.62);
				const ramp = Math.min(90, Math.round(dens * 42));      // 1.00（稀疏）→ 1.77（本快照）
			return {
				dens: dens,
				inner: 0.15,
				outer: 1.00,
				coneMin: 0.25,
				coneMax: 1.45,
				coneScale: 1.02,
				conePow: 1.15,
				radMix: 0.55,
				gapLinked: 0.22,
				gapLone: 0.24,
				link: 0.9,
				spring: 0.35,
				pullCap: 0.2,
				step: 0.22,
				cross: 1.0,
				cohere: 0.085 * hard,
				rho: 0.03 * hard,
				passes: 96 + ramp
			};
		}
	


		/** 相机旋转（先偏航后俯仰）+ 透视投影：写进复用缓冲，不分配。z 越大越近。 */
		function mem3dProject(model, view, width, height) {
			const cosY = Math.cos(view.rotY);
			const sinY = Math.sin(view.rotY);
			const cosX = Math.cos(view.rotX);
			const sinX = Math.sin(view.rotX);
			// 视野：归一化后整体半径约 1、透视最大放大约 1.2×，乘这两个系数后整朵球棍留在画布内（不切边）
			const spread = Math.min(width * 0.47, height * 0.44) * view.scale;
			const ox = width / 2;
			const oy = height / 2;
			const frame = model.frame;
			for (let i = 0; i < model.count; i++) {
				const x = model.xs[i];
				const y = model.ys[i];
				const z = model.zs[i];
				const ax = x * cosY + z * sinY;
				const az = z * cosY - x * sinY;
				const ay = y * cosX - az * sinX;
				const bz = az * cosX + y * sinX;
				// 夹取（NaN 比不出大小 → 原样漏到下面的有限性检查里被判无效，不会伪装成正常点）
				let s = MEM3D_FOCAL / (MEM3D_FOCAL - bz);
				if (s < MEM3D_S_MIN) s = MEM3D_S_MIN;
				else if (s > MEM3D_S_MAX) s = MEM3D_S_MAX;
				frame.sx[i] = ox + ax * s * spread;
				frame.sy[i] = oy + ay * s * spread;
				frame.s[i] = s;
				frame.z[i] = bz;
				frame.r[i] = model.base[i] * s;
					if (!Number.isFinite(frame.sx[i]) || !Number.isFinite(frame.sy[i])) {
						frame.sx[i] = -1e6; frame.sy[i] = -1e6; frame.r[i] = 0;   // 兜底：非有限坐标踢出画面
					}
				// 兜底：非有限值、或**超出画布 3 倍**的点一律标成"无效"——绘制与命中都会跳过它们。
				// （只把坐标推到 -1e6 是不够的：杆会从 -1e6 拉回画布，闭合成一条穿屏的斜线。）
				frame.ok[i] = frame.sx[i] > -3 * width && frame.sx[i] < 3 * width && frame.sy[i] > -3 * height && frame.sy[i] < 3 * height ? 1 : 0;
			}
		}

		/** 画家算法：节点与杆合成一条按深度升序（远的先画）的序列，写进复用缓冲。 */
		function mem3dOrder(model) {
			const frame = model.frame;
			const count = model.count;
			for (let i = 0; i < count; i++) {
				frame.order[i] = i;
				frame.key[i] = frame.z[i];
			}
			for (let j = 0; j < model.edgeCount; j++) {
				const code = count + j;
				frame.order[code] = code;
				const a = model.eFrom[j];
				const b = model.eTo[j];
				// 端点缺失或端点被判无效（非有限/飞出画布 3 倍）的杆：沉到最底、且绘制时会被跳过
				frame.key[code] = a < 0 || b < 0 || frame.ok[a] === 0 || frame.ok[b] === 0 ? -9 : (frame.z[a] + frame.z[b]) / 2;
			}
			frame.order.sort((a, b) => frame.key[a] - frame.key[b]);
			return frame.order;
		}

		/** 深度 0（最远）..1（最近）。 */
		function mem3dDepth(frame, index) {
			const raw = (frame.z[index] + MEM3D_DEPTH) / (MEM3D_DEPTH * 2);
			return raw < 0 ? 0 : raw > 1 ? 1 : raw;
		}

		/** 屏幕命中测试：最近的那个球赢（"被遮住"的球不该被点中），没有则空串。 */
		function mem3dPick(model, x, y, scale) {
			const frame = model.frame;
			const px = Math.pow(scale, 0.72);
			let best = "";
			let bestDepth = -Infinity;
			for (let i = 0; i < model.count; i++) {
				if (frame.ok[i] === 0) continue;   // 无效点（非有限/飞出画布 3 倍）不参与命中
				const dx = frame.sx[i] - x;
				const dy = frame.sy[i] - y;
				const reach = Math.max(2.2, frame.r[i] * px) + 3;
				if (dx * dx + dy * dy > reach * reach) continue;
				if (frame.z[i] > bestDepth) {
					bestDepth = frame.z[i];
					best = model.ids[i];
				}
			}
			return best;
		}

		/** 拖拽 → 新视角（纯函数，便于桩测）。rotX 夹在 ±1.35，免得翻过头。 */
		function mem3dDrag(view, dx, dy) {
			const rotX = view.rotX + dy * 0.0055;
			return { rotX: rotX < -1.35 ? -1.35 : rotX > 1.35 ? 1.35 : rotX, rotY: view.rotY + dx * 0.0055, scale: view.scale };
		}

		/** 缩放夹持（纯函数）。 */
		function mem3dScore(scale) {
			return scale < MEM3D_SCALE_MIN ? MEM3D_SCALE_MIN : scale > MEM3D_SCALE_MAX ? MEM3D_SCALE_MAX : scale;
		}

		/** 滚轮 → 新缩放（纯函数）：指数缩放 + 夹到合理范围。 */
		function mem3dZoom(view, deltaY) {
			return { rotX: view.rotX, rotY: view.rotY, scale: mem3dScore(view.scale * Math.exp(-deltaY * 0.0012)) };
		}

		/** 清空画布（纯函数；没有背景色 —— 底色交给 CSS 的宿主令牌，深浅主题都对）。 */
		function mem3dClear(ctx, width, height, dpr = 1) {
			// 画布落在设备像素上（width×dpr）：必须先擦满整块，否则每帧只擦掉左上四分之一，
			// 历史帧会一帧帧叠上去（真机表现为「下面堆积一大团线条轨迹」）。
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, width * dpr, height * dpr);
			// 擦完恢复 DPR 变换：之后绘制与命中都用 CSS 像素坐标（与指针事件同一套）。
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}

		/** 选中节点的邻居 id 集合（高亮邻域用）。 */
		function mem3dNeighbors(picked, edges) {
			const out = new Set();
			if (picked === "") return out;
			for (const edge of edges) {
				if (edge.from === picked) out.add(edge.to);
				else if (edge.to === picked) out.add(edge.from);
			}
			return out;
		}

		/** 球面渐变缓存（按 ctx 认领：换画布后旧梯度不可再用）。 */
		const MEM3D_INK = new WeakMap();
		/**
		 * 球的径向渐变：单位圆 + `ctx.scale(r)`，可以按 8 档明暗缓存复用。
		 * 高光只在浅档出现（暗档给个很淡的底光）——这一条就是"实心球"和"发光点"的分界。
		 */
		function mem3dSphereInk(ctx, model, i, band, down) {
			const list = MEM3D_INK.get(ctx);
			const held = list === undefined ? undefined : list.sphere[i];
			if (held !== undefined && held.band === band && held.down === down) return held.grad;
			const shades = model.shades[i];
			const at = Math.max(0, Math.min(shades.length - 1, band));
			const base = shades[at];
			const light = shades[down ? Math.min(7, at + 1) : Math.min(7, at + 3)];
			const spot = down ? 0.42 : 0.32;
			const grad = ctx.createRadialGradient(-spot, -spot, 0.06, 0, 0, 1.02);
			grad.addColorStop(0, light);
			grad.addColorStop(0.5, base);
			grad.addColorStop(1, shades[Math.max(0, at - 2)]);
			const box = list === undefined ? { sphere: [], rod: null } : list;
			box.sphere[i] = { band: band, down: down, grad: grad };
			MEM3D_INK.set(ctx, box);
			return grad;
		}

		/** 球面高光的渐变（每张画布缓存一份：白色 → 透明，与球的颜色无关）。 */
		function mem3dGlintInk(ctx) {
			const list = MEM3D_INK.get(ctx);
			if (list !== undefined && list.glint !== null && list.glint !== undefined) return list.glint;
			const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
			grad.addColorStop(0, "rgba(255,255,255,.95)");
			grad.addColorStop(0.6, "rgba(255,255,255,.35)");
			grad.addColorStop(1, "rgba(255,255,255,0)");
			const box = list === undefined ? { sphere: [], rod: null, glint: grad } : list;
			box.glint = grad;
			MEM3D_INK.set(ctx, box);
			return grad;
		}

		/** 杆的高亮渐变（选中时给它的键）：中性灰两端淡、中间实。 */
		function mem3dRodInk(ctx) {
			const list = MEM3D_INK.get(ctx);
			if (list !== undefined && list.rod !== null && list.rod !== undefined) return list.rod;
			const grad = ctx.createLinearGradient(0, 0, 1, 0);
			grad.addColorStop(0, "rgba(92,99,110,.12)");
			grad.addColorStop(0.5, "rgba(78,85,96,.92)");
			grad.addColorStop(1, "rgba(92,99,110,.12)");
			const box = list === undefined ? { sphere: [], rod: grad } : list;
			box.rod = grad;
			MEM3D_INK.set(ctx, box);
			return grad;
		}

		/**
		 * 画一帧。顺序 = 先杆后球：**杆的两端被球盖住**，不会露出接头（化学键是插进球里的）。
		 * 深度线索只做两件：近大远小（r×s）、远处略暗（球面明暗降档）—— 没有雾、没有光晕、没有星星。
		 * 选中 = 该球描边加粗 + 它的杆高亮；标签只给选中/邻居/悬停，其余一律安静。
		 * @param ctx - CanvasRenderingContext2D（已按 dpr 设好 transform）。
		 * 注意：投影由**调用方**先做（），draw 只消费 frame —— 组件每帧的顺序是 project → draw。
		 * @param model - mem3dBall 的返回值。
		 * @param view - `{rotX, rotY, scale}`。
		 * @param width/height - CSS 像素尺寸。
		 * @param opts - `{picked, hovered, neighbors, labelOf, progress}`。
		 */
		function mem3dDraw(ctx, model, view, width, height, opts) {
			const options = opts === undefined || opts === null ? {} : opts;
			const picked = options.picked === undefined || options.picked === null ? "" : options.picked;
			const hovered = options.hovered === undefined || options.hovered === null ? "" : options.hovered;
			const near = options.neighbors === undefined || options.neighbors === null ? null : options.neighbors;
			const labelOf = typeof options.labelOf === "function" ? options.labelOf : null;
			const raw = options.progress === undefined || options.progress === null ? 1 : options.progress;
			const fade = raw < 0 ? 0 : raw > 1 ? 1 : raw;
			const frame = model.frame;
			const order = mem3dOrder(model);
			const px = Math.pow(view.scale, 0.72);
			const twoPi = Math.PI * 2;
			mem3dClear(ctx, width, height, (opts && opts.dpr) || 1);
			// —— 杆：直杆（不是曲线）。两端各缩进球半径的 0.86，插进球里 ——
			for (let k = 0; k < order.length; k++) {
				const code = order[k];
				if (code < model.count) continue;
				const j = code - model.count;
				const a = model.eFrom[j];
				const b = model.eTo[j];
				if (a < 0 || b < 0) continue;
				// 端点无效（非有限值 / 飞出画布 3 倍）的杆整根跳过 —— 否则它会从画面外向画面内拉一条穿屏长线
				if (frame.ok[a] === 0 || frame.ok[b] === 0) continue;
				const depth = mem3dDepth(frame, a) * 0.5 + mem3dDepth(frame, b) * 0.5;
				const touch = picked !== "" && (model.ids[a] === picked || model.ids[b] === picked);
				const nearEdge = picked !== "" && near !== null && near.has(model.ids[a]) && near.has(model.ids[b]);
				const dx = frame.sx[b] - frame.sx[a];
				const dy = frame.sy[b] - frame.sy[a];
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const trimA = Math.min(len * 0.38, model.base[a] * frame.s[a] * px * 0.78);
				const trimB = Math.min(len * 0.38, model.base[b] * frame.s[b] * px * 0.78);
				if (len - trimA - trimB < 1.5) continue;
				const x1 = frame.sx[a] + (dx / len) * trimA;
				const y1 = frame.sy[a] + (dy / len) * trimA;
				const x2 = frame.sx[b] - (dx / len) * trimB;
				const y2 = frame.sy[b] - (dy / len) * trimB;
				ctx.globalAlpha = (picked === "" ? 0.55 + 0.34 * depth : touch ? 0.82 + 0.18 * depth : nearEdge ? 0.32 : 0.12) * fade;
				ctx.strokeStyle = touch ? mem3dRodInk(ctx) : "rgba(88,95,106,.86)";
				ctx.lineWidth = touch ? 2.6 : model.eWidth[j];
				if (model.eDash[j] === 1) ctx.setLineDash([5, 4]);
				else ctx.setLineDash([]);
				ctx.beginPath();
				ctx.moveTo(x1, y1);
				ctx.lineTo(x2, y2);
				ctx.stroke();
			}
			ctx.setLineDash([]);
			// —— 球：实心（球面明暗梯度），不是发光点 ——
			for (let k = 0; k < order.length; k++) {
				const code = order[k];
				if (code >= model.count) continue;
				const i = code;
				if (frame.ok[i] === 0) continue;   // 无效点不画（宁可少一个球，也不画一个飞到画布外的球）
				const depth = mem3dDepth(frame, i);
				const id = model.ids[i];
				const isPicked = picked !== "" && id === picked;
				const isNear = picked !== "" && near !== null && near.has(id);
				const isHover = hovered !== "" && id === hovered;
				const dim = picked !== "" && !isPicked && !isNear;
				const x = frame.sx[i];
				const y = frame.sy[i];
				const r = Math.max(2.2, frame.r[i] * px);
				const band = Math.max(0, Math.min(7, Math.round(depth * 5) + 1));
				const down = depth < 0.34;
				// 远的球更薄（不是雾：不做颜色混合，只让远的稍微退后半步，近的仍然是实心球）
				const alpha = (dim ? 0.52 : 0.42 + 0.58 * Math.pow(depth, 1.15)) * fade;
				// 邻居/悬停：脚下垫一圈冷灰（"被指着"的提示，不是发光）
				if (isHover || isNear) {
					ctx.globalAlpha = 0.4 * alpha;
					ctx.fillStyle = "rgba(96,104,116,.5)";
					ctx.beginPath();
					ctx.arc(x, y, r + 2.2, 0, twoPi);
					ctx.fill();
				}
				ctx.globalAlpha = alpha;
				ctx.fillStyle = mem3dSphereInk(ctx, model, i, band, down);
				ctx.beginPath();
				ctx.arc(x, y, r, 0, twoPi);
				ctx.fill();
				// 球面高光：一小块柔和的亮斑（径向渐变，不是发光点/不是光晕）
				if (r > 3) {
					ctx.globalAlpha = (dim ? 0.18 : 0.72) * fade;
					ctx.fillStyle = mem3dGlintInk(ctx);
					ctx.save();
					ctx.translate(x - r * 0.32, y - r * 0.34);
					ctx.scale(r * 0.4, r * 0.4);
					ctx.beginPath();
					ctx.arc(0, 0, 1, 0, twoPi);
					ctx.fill();
					ctx.restore();
				}
				// 轮廓：往里一圈极淡的暗描边（球体的边）——光晕是往外的，这条是往里的
				if (!dim && r > 4.2) {
					ctx.globalAlpha = 0.22 * alpha;
					ctx.strokeStyle = "rgba(24,28,34,.9)";
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.arc(x, y, r - 0.4, 0, twoPi);
					ctx.stroke();
				}
				// 选中 = 描边加粗（不是光晕）：外圈先垫一道极淡的纸色，让描边在任何底色上都清楚
				if (isPicked) {
					ctx.globalAlpha = 0.22;
					ctx.fillStyle = "rgba(252,252,250,.95)";
					ctx.beginPath();
					ctx.arc(x, y, r + 3.6, 0, twoPi);
					ctx.fill();
					ctx.globalAlpha = 0.92 * fade;
					ctx.strokeStyle = "rgba(52,58,68,.95)";
					ctx.lineWidth = 2.2;
					ctx.beginPath();
					ctx.arc(x, y, r + 3.6, 0, twoPi);
					ctx.stroke();
				} else if (isHover || isNear) {
					ctx.globalAlpha = 0.55 * alpha;
					ctx.strokeStyle = "rgba(110,118,130,.85)";
					ctx.lineWidth = 1.2;
					ctx.beginPath();
					ctx.arc(x, y, r + 2.6, 0, twoPi);
					ctx.stroke();
				}
			}
			// —— 标签：只给选中 / 邻居 / 悬停（260+ 个标签全显示=灾难）；互相压住的邻居标签直接不画，
			//    但选中/悬停那个必须画（它最后画，永远在最上面） ——
			if (labelOf !== null && (picked !== "" || hovered !== "")) {
				ctx.globalAlpha = fade;
				ctx.font = "11px " + MEM3D_FONT;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				const boxes = [];
				const clash = (box) => {
					for (let b = 0; b < boxes.length; b++) {
						const other = boxes[b];
						if (box.x0 < other.x1 && box.x1 > other.x0 && box.y0 < other.y1 && box.y1 > other.y0) return true;
					}
					return false;
				};
				const label = (code, primary) => {
					const id = model.ids[code];
					const value = labelOf(id);
					const full = String(value === undefined || value === null ? id : value);
					const limit = primary ? 18 : 10;
					const text = full.length > limit ? full.slice(0, limit) + "…" : full;
					const wide = ctx.measureText(text).width;
					const radius = Math.max(2.2, frame.r[code] * px);
					// 夹在画布内，别把字切掉
					const x = Math.max(wide / 2 + 7, Math.min(width - wide / 2 - 7, frame.sx[code]));
					const y = Math.max(11, Math.min(height - 11, frame.sy[code] - radius - 10));
					const box = { x0: x - wide / 2 - 4, x1: x + wide / 2 + 4, y0: y - 8, y1: y + 8 };
					if (!primary && clash(box)) return;
					boxes.push(box);
					// 纸色小牌（不是深空黑条）：浅色主题下也清楚，也不像霓虹标
					ctx.globalAlpha = 0.92 * fade;
					ctx.fillStyle = "rgba(250,250,248,.94)";
					ctx.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
					ctx.globalAlpha = (primary ? 0.98 : 0.72) * fade;
					ctx.fillStyle = "rgba(30,34,40,.95)";
					ctx.fillText(text, x, y);
				};
				for (let k = order.length - 1; k >= 0; k--) {
					const code = order[k];
					if (code >= model.count) continue;
					const id = model.ids[code];
					if (id === picked || id === hovered) continue;
					if (picked !== "" && near !== null && near.has(id)) label(code, false);
				}
				for (let i = 0; i < model.count; i++) {
					if (model.ids[i] === picked || model.ids[i] === hovered) {
						if (frame.ok[i] === 0) continue;   // 无效点不画标签
						label(i, true);
					}
				}
			}
			ctx.globalAlpha = 1;
		}

		/* MEM3D:END */


				/**
		 * 关系图的球棍模型：一块 canvas + 自投影 + 拖拽旋转 + 滚轮缩放 + 点选。
		 * 交互状态（角度 / 缩放 / 悬停 / 淡入进度）全放 ref：拖拽**不触发 React 重渲**，只改下一帧要画的数字。
		 * **静止**：没有自转、没有常驻 rAF —— 只有交互（拖拽/滚轮/键盘/悬停/选中/resize）才重画一帧，
		 * 所以 reduced-motion 下天然"完全静止"，其它情况下也不烧 CPU。
		 * @param props - `{atoms, edges, picked, neighbors, onPick, t}`。
		 */
		function MemoryGraph3D(props) {
			const atoms = props.atoms;
			const edges = props.edges;
			const picked = props.picked;
			const neighbors = props.neighbors;
			const onPick = props.onPick;
			const t = props.t;
			const holderRef = React.useRef(null);
			const canvasRef = React.useRef(null);
			const modelRef = React.useRef(null);
			const fadeRef = React.useRef(1);
			const viewRef = React.useRef({ rotX: MEM3D_VIEW0.rotX, rotY: MEM3D_VIEW0.rotY, scale: MEM3D_VIEW0.scale });
			const hoverRef = React.useRef("");
			const liveRef = React.useRef({ picked: picked, neighbors: neighbors, onPick: onPick, labelOf: null });
			liveRef.current.picked = picked;
			liveRef.current.neighbors = neighbors;
			liveRef.current.onPick = onPick;
			const labels = new Map();
			for (const atom of atoms) labels.set(atom.id, atom.claim);
			liveRef.current.labelOf = (id) => (labels.has(id) ? labels.get(id) : id);
			// 数据没变就复用同一朵球棍（确定性布局；每帧更不会重建数组）
			const signature = atoms.length + "|" + edges.length + "|" + (atoms.length > 0 ? atoms[0].id : "") + "|" + (atoms.length > 0 ? atoms[atoms.length - 1].id : "") + "|" + (edges.length > 0 ? edges[0].from + edges[0].rel + edges[0].to : "");
			const cached = modelRef.current;
			const model = cached !== null && cached !== undefined && cached.signature === signature
				? cached.model
				: mem3dBall(atoms, edges, (atom) => memTypeColor(atom.type), (rel) => memRelColor(rel));
			modelRef.current = { signature: signature, model: model };
			React.useEffect(() => {
				const canvas = canvasRef.current;
				const holder = holderRef.current;
				if (canvas === null || canvas === undefined || holder === null || holder === undefined) return undefined;
				if (typeof canvas.getContext !== "function") return undefined;
				let ctx = null;
				try {
					ctx = canvas.getContext("2d");
				} catch (error) {
					ctx = null;
				}
				if (ctx === null) return undefined;
				const view = viewRef.current;
				const live = liveRef.current;
				const nowMs = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());
				const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
				// 状态变化的淡入（约 130ms）：不是"装饰动效"，是让人看清"状态变了"。
				// reduced-motion 下把时长压到 0 —— 状态差异（描边/加粗/高亮）仍然保留，只是不渐变。
				const FADE_MS = reduced ? 0 : 130;
				let running = false;
				let raf = 0;
				let fadeStart = 0;
				let visible = true;
				let onScreen = true;
				let needPaint = true;
				let dragging = false;
				let moved = 0;
				let lastX = 0;
				let lastY = 0;
				let size = { w: 900, h: 520, dpr: 1 };
				const measure = () => {
					const rect = typeof holder.getBoundingClientRect === "function" ? holder.getBoundingClientRect() : null;
					const w = Math.max(240, Math.round(rect !== null && rect.width > 0 ? rect.width : 900));
					const h = Math.max(220, Math.round(rect !== null && rect.height > 0 ? rect.height : 520));
					const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
					size = { w: w, h: h, dpr: dpr };
					const pw = Math.round(w * dpr);
					const ph = Math.round(h * dpr);
					if (canvas.width !== pw || canvas.height !== ph) {
						canvas.width = pw;
						canvas.height = ph;
					}
				};
				const paint = () => {
					measure();
					ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
					mem3dProject(model, view, size.w, size.h);
					mem3dDraw(ctx, model, view, size.w, size.h, {
						dpr: size.dpr,
						picked: live.picked,
						hovered: hoverRef.current,
						neighbors: live.neighbors,
						labelOf: live.labelOf,
						progress: fadeRef.current
					});
					fadeRef.current = 1;
					needPaint = false;
				};
				// 只在"刚变更"的这几帧里跑 rAF；淡入走完就停（**没有自转**，静止时一帧都不画）
				const tick = (now) => {
					running = false;
					if (!visible || !onScreen) return;
					const stamp = typeof now === "number" ? now : 0;
					if (reduced || FADE_MS === 0) fadeRef.current = 1;
					else fadeRef.current = Math.min(1, Math.max(0, (stamp - fadeStart) / FADE_MS));
					paint();
					if (fadeRef.current < 1 && !running) {
						running = true;
						raf = window.requestAnimationFrame(tick);
					}
				};
				const start = () => {
					// 注意：这里**不许**再"首帧画过就提前 return"（老写法是 `fadeRef.current >= 1 && !needPaint` 就退出）。
					// 那句会让"首帧之后的所有状态变化"（悬停、选中、容器尺寸变化）**一帧都不重画**：
					// 点一个球，state 变了、画布却还是旧的一帧 —— 真机上就被读成「点不了」。
					needPaint = true;
					if (reduced || FADE_MS === 0) {
						fadeRef.current = 1;
						paint();
						return;
					}
					if (fadeRef.current >= 1) {
						fadeRef.current = 0;
						fadeStart = nowMs();
					}
					if (running || !visible || !onScreen) return;
					if (typeof window.requestAnimationFrame !== "function") {
						fadeRef.current = 1;
						paint();
						return;
					}
					running = true;
					raf = window.requestAnimationFrame(tick);
				};
				const stop = () => {
					running = false;
					if (raf !== 0) {
						window.cancelAnimationFrame(raf);
						raf = 0;
					}
				};
				const local = (event) => {
					const rect = canvas.getBoundingClientRect();
					return { x: event.clientX - rect.left, y: event.clientY - rect.top };
				};
				/** 立刻重画一帧（不淡入）：给"选中/邻居变了、容器尺寸变了"这类外部状态用。 */
				const repaint = () => {
					fadeRef.current = 1;
					needPaint = true;
					paint();
				};
				live.repaint = repaint;
				/**
				 * 命中之前先对齐尺寸：容器尺寸变了（侧栏拖动 / 窗口缩放 / 首屏布局落定）但还没重画时，
				 * frame 里存的是**旧尺寸**下算出来的屏幕坐标；拿它做命中就会"差一截"——
				 * 宽高比差得越多偏得越远（3:1 宽画布上能偏掉半个画布）。量到尺寸真变了就顺手重画一帧，
				 * 保证"屏幕上看到的球"和"点中的球"用的是同一套坐标。
				 */
				const syncSize = () => {
					const before = size.w + "x" + size.h + "@" + size.dpr;
					measure();
					const after = size.w + "x" + size.h + "@" + size.dpr;
					if (before !== after) {
						repaint();
						return true;
					}
					return false;
				};
				const onDown = (event) => {
					if (typeof event.button === "number" && event.button !== 0) return;
					dragging = true;
					moved = 0;
					lastX = event.clientX;
					lastY = event.clientY;
					if (typeof canvas.setPointerCapture === "function" && typeof event.pointerId === "number") {
						try {
							canvas.setPointerCapture(event.pointerId);
						} catch (error) {
							// 抓不到指针也无所谓：只是拖出画布会断
						}
					}
					if (holder.classList !== undefined) holder.classList.add("is-drag");
					event.preventDefault();
				};
				const onMove = (event) => {
					if (dragging) {
						const dx = event.clientX - lastX;
						const dy = event.clientY - lastY;
						lastX = event.clientX;
						lastY = event.clientY;
						moved += Math.abs(dx) + Math.abs(dy);
						const turned = mem3dDrag(view, dx, dy);
						view.rotX = turned.rotX;
						view.rotY = turned.rotY;
						// 拖拽中不淡入：跟着手指立刻重画
						fadeRef.current = 1;
						needPaint = true;
						paint();
						return;
					}
					const at = local(event);
					const hit = mem3dPick(model, at.x, at.y, view.scale);
					if (hit !== hoverRef.current) {
						hoverRef.current = hit;
						canvas.style.cursor = hit === "" ? "grab" : "pointer";
						start();
					}
				};
				const onUp = (event) => {
					if (holder.classList !== undefined) holder.classList.remove("is-drag");
					if (!dragging) return;
					dragging = false;
					if (moved > 5) return;
					syncSize();   // 先让"画出来的"和"要命中的"是同一套坐标（尺寸变过就顺手重画）
					const at = local(event);
					const hit = mem3dPick(model, at.x, at.y, view.scale);
					if (typeof live.onPick === "function") live.onPick(hit === live.picked ? "" : hit);
				};
				const onLeave = () => {
					hoverRef.current = "";
					canvas.style.cursor = "grab";
					start();
				};
				const onWheel = (event) => {
					event.preventDefault();
					const zoomed = mem3dZoom(view, event.deltaY);
					view.scale = zoomed.scale;
					fadeRef.current = 1;
					needPaint = true;
					paint();
				};
				const onKey = (event) => {
					const dx = event.key === "ArrowLeft" ? -18 : event.key === "ArrowRight" ? 18 : 0;
					const dy = event.key === "ArrowUp" ? -14 : event.key === "ArrowDown" ? 14 : 0;
					if (dx === 0 && dy === 0) return;
					event.preventDefault();
					const turned = mem3dDrag(view, dx, dy);
					view.rotX = turned.rotX;
					view.rotY = turned.rotY;
					fadeRef.current = 1;
					needPaint = true;
					paint();
				};
				const onVisibility = () => {
					visible = document.visibilityState !== "hidden";
					if (!visible) stop();
					else if (needPaint || fadeRef.current < 1) start();
				};
				canvas.addEventListener("pointerdown", onDown);
				canvas.addEventListener("pointermove", onMove);
				canvas.addEventListener("pointerup", onUp);
				canvas.addEventListener("pointercancel", onUp);
				canvas.addEventListener("pointerleave", onLeave);
				canvas.addEventListener("wheel", onWheel, { passive: false });
				canvas.addEventListener("keydown", onKey);
				document.addEventListener("visibilitychange", onVisibility);
				let watcher = null;
				if (typeof IntersectionObserver === "function") {
					watcher = new IntersectionObserver((entries) => {
						for (const entry of entries) onScreen = entry.isIntersecting;
						if (!onScreen) stop();
						else if (needPaint || fadeRef.current < 1) start();
					});
					try {
						watcher.observe(canvas);
					} catch (error) {
						watcher = null;
					}
				}
				// 尺寸变化（侧栏拖动 / 窗口缩放）要重画：这里只标脏，不立刻量布局
				let resizer = null;
				if (typeof ResizeObserver === "function") {
					resizer = new ResizeObserver(() => {
						if (reduced || FADE_MS === 0) {
							fadeRef.current = 1;
							needPaint = true;
							paint();
							return;
						}
						start();
					});
					try {
						resizer.observe(holder);
					} catch (error) {
						resizer = null;
					}
				}
				fadeRef.current = 1;
				needPaint = true;
				paint();
				return () => {
					stop();
					live.repaint = null;
					canvas.removeEventListener("pointerdown", onDown);
					canvas.removeEventListener("pointermove", onMove);
					canvas.removeEventListener("pointerup", onUp);
					canvas.removeEventListener("pointercancel", onUp);
					canvas.removeEventListener("pointerleave", onLeave);
					canvas.removeEventListener("wheel", onWheel);
					canvas.removeEventListener("keydown", onKey);
					document.removeEventListener("visibilitychange", onVisibility);
					if (watcher !== null) watcher.disconnect();
					if (resizer !== null) resizer.disconnect();
				};
			}, [model]);
			// 选中 / 邻居变了要**重画一帧**：主 effect 只依赖 model（数据没变就不重建），
			// 少了这一条，点球只改 state、画布却纹丝不动 —— 真机上就是「点了没反应 / 点不了」。
			const nearKey = neighbors === null || neighbors === undefined ? -1 : neighbors.size;
			React.useEffect(() => {
				const live = liveRef.current;
				if (typeof live.repaint === "function") live.repaint();
			}, [picked, nearKey]);
			const typeList = [];
			for (const atom of atoms) if (!typeList.includes(atom.type)) typeList.push(atom.type);
			return h(
				"div",
				{ className: "wbm3d-stage", ref: holderRef },
				h("canvas", {
					ref: canvasRef,
					className: "wbm3d-canvas",
					role: "img",
					tabIndex: 0,
					"aria-label": t("mem.graphAria") + "：" + atoms.length + " " + t("lib.unit") + " · " + edges.length + " " + t("mem.edgeUnit")
				}),
				h(
					"span",
					{ className: "wbm3d-keys" },
					typeList.map((name) => h("span", { key: name, className: "wbm3d-key" }, h("i", { className: "wbm3d-keydot", style: { background: memTypeColor(name) } }), t("mem.type." + name)))
				),
				h("span", { className: "wbm3d-hint" }, t("mem.graphHint"))
			);
		}


/**
		 * 「记忆库」独立页：hero（标题/计数/副标题/分类分布）+ 关系图 + 类型筛选与搜索 + 原子卡片 + 详情。
		 * 数据来自构建期快照 `MEMORY_INDEX`（客户端读不到 data/memory —— 见 AGENTS.md）。
		 * @param props - `t` 文案函数。
		 */
		function MemoryPage(props) {
			const t = props.t;
			const index = typeof MEMORY_INDEX === "undefined" ? null : MEMORY_INDEX;
			const [type, setType] = React.useState("");
			const [query, setQuery] = React.useState("");
			const [picked, setPicked] = React.useState("");
			if (index === null || !Array.isArray(index.atoms) || index.atoms.length === 0) {
				return h(
					"div",
					{ className: "wbm-page" },
					h(
						"div",
						{ className: "wbm-hero" },
						h("div", { className: "wbm-crumb" }, `${t("mem.crumb")} › ${t("mem.title")}`),
						h("h1", { className: "wbm-title" }, t("mem.title")),
						h("p", { className: "wbm-sub" }, t("mem.pick"))
					)
				);
			}
			const allAtoms = index.atoms;
			const allEdges = Array.isArray(index.edges) ? index.edges : [];
			const types = Array.isArray(index.types) && index.types.length > 0 ? index.types : [...new Set(allAtoms.map((atom) => atom.type))];
			// 打分系统 v1（2026-10-14）：分数来自快照（口径只在 data/memory/tools/memory.mjs 里定义一次）。
			// 页面展示的是"最新一条打分为准"的分数与由它算出的 tier —— 手工 tier 标签留在 tags 里，不丢。
			const scoreSummary = index.scoreSummary ?? null;
			const tierLabel = (tier) => t(`mem.tier.${tier}`);
			const scoreText = (atom) => (typeof atom.score === "number" ? atom.score.toFixed(1) : t("mem.unscored"));
			const needle = query.trim().toLowerCase();
			const shown = allAtoms.filter((atom) => {
				if (type !== "" && atom.type !== type) return false;
				if (needle === "") return true;
				return [atom.claim, atom.evidence, atom.source, (atom.tags ?? []).join(" ")].join(" ").toLowerCase().includes(needle);
			});
			const visible = new Set(shown.map((atom) => atom.id));
			const edges = allEdges.filter((edge) => visible.has(edge.from) && visible.has(edge.to));
			const degreeOf = (id) => allEdges.filter((edge) => edge.from === id || edge.to === id).length;
			const neighborsOf = (id) =>
				allEdges.filter((edge) => edge.from === id || edge.to === id).map((edge) => {
					const outgoing = edge.from === id;
					const otherId = outgoing ? edge.to : edge.from;
					const other = allAtoms.find((atom) => atom.id === otherId);
					return { key: `${edge.rel}-${otherId}`, rel: edge.rel, dir: outgoing ? "→" : "←", otherId, text: other === undefined ? otherId : other.claim };
				});
			const neighborIds = new Set(neighborsOf(picked).map((n) => n.otherId));
			const hubs = [...allAtoms].filter((atom) => degreeOf(atom.id) >= 2).sort((x, y) => degreeOf(y.id) - degreeOf(x.id));
			// 常用标签：出现次数最多的前 8 个 —— 点一下就等于搜它，不用猜该输什么词
			const tagCount = new Map();
			for (const atom of allAtoms) for (const tag of atom.tags ?? []) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
			const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);
			return h(
				"div",
				{ className: "wbm-page" },
				h(
					"header",
					{ className: "wbm-hero" },
					h(
						"div",
						{ className: "wbm-heroMain" },
						h("div", { className: "wbm-crumb" }, `${t("mem.crumb")} › ${t("mem.title")}`),
						h("div", { className: "wbm-titlerow" }, h("h1", { className: "wbm-title" }, t("mem.title")), h("span", { className: "wbm-count" }, `${index.count} ${t("lib.unit")} · ${index.edgeCount} ${t("mem.edgeUnit")}`),
							scoreSummary === null || scoreSummary.avg === null ? null : h("span", { className: "wbm-scorebadge" }, `${t("mem.scoreAvg")} ${scoreSummary.avg}`),
							scoreSummary === null || !Array.isArray(scoreSummary.byTier) ? null : scoreSummary.byTier.map(([tier, n]) => h("span", { key: tier, className: `wbm-tierpill wbm-tierpill-${tier}` }, `${tierLabel(tier)} ${n}`))),
						h("p", { className: "wbm-sub" }, t("mem.sub")),
						scoreSummary === null ? null : h("p", { className: "wbm-scorehint" }, `${t("mem.scoreHint")}（${scoreSummary.scored}/${index.count} ${t("mem.scoredUnit")} · ${t("mem.scoreHistory")} ${scoreSummary.history} ${t("mem.scoreHistoryUnit")}）`),
						h("p", { className: "wbm-scorehint" }, t("mem.eligHint"))
					),
					h(
						"div",
						{ className: "wbm-stats" },
						types.map((name) =>
							h(
								"button",
								{ key: name, type: "button", className: `wbm-stat${type === name ? " is-on" : ""}`, onClick: () => setType(type === name ? "" : name) },
								h("span", { className: "wbm-statdot", style: { background: memTypeColor(name) } }),
								h("span", { className: "wbm-statnum" }, String(allAtoms.filter((atom) => atom.type === name).length)),
								h("span", { className: "wbm-statlabel" }, t(`mem.type.${name}`))
							)
						)
					)
				),
				h(
					"div",
					{ className: "wbm-searchbar" },
					h(
						"label",
						{ className: "wbm-searchwrap" },
						h("svg", { className: "wbm-searchicon", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
							h("circle", { cx: "11", cy: "11", r: "6.4", stroke: "currentColor", strokeWidth: "1.8" }),
							h("path", { d: "M15.8 15.8L21 21", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })),
						h("input", { className: "wbm-search", type: "search", value: query, placeholder: t("mem.search"), "aria-label": t("mem.search"), onChange: (event) => setQuery(event.target.value) }),
						query === "" ? null : h("span", { className: "wbm-hits" }, `${shown.length} / ${allAtoms.length}`),
						query === "" ? null : h("button", { type: "button", className: "wbm-searchclear", onClick: () => setQuery(""), title: t("mem.clear") }, "×")
					),
					h(
						"div",
						{ className: "wbm-tagrow" },
						h("span", { className: "wbm-tagrowlabel" }, t("mem.tagHint")),
						topTags.map((tag) => h("button", { key: tag, type: "button", className: `wbm-tagchip${query === tag ? " is-on" : ""}`, onClick: () => setQuery(query === tag ? "" : tag) }, tag))
					)
				),
				h(
					"div",
					{ className: "wbm-bar" },
					h("button", { type: "button", className: `wbm-chip${type === "" ? " is-on" : ""}`, onClick: () => setType("") }, `${t("mem.all")} ${index.count}`),
					types.map((name) =>
						h(
							"button",
							{ key: name, type: "button", className: `wbm-chip${type === name ? " is-on" : ""}`, onClick: () => setType(type === name ? "" : name) },
							h("span", { className: "wbm-chipdot", style: { background: memTypeColor(name) } }),
							`${t(`mem.type.${name}`)} ${allAtoms.filter((atom) => atom.type === name).length}`
						)
					)
				),
				h(
					"section",
					{ className: "wbm-graph" },
					h(
						"div",
						{ className: "wbm-graphtop" },
						h("div", { className: "wbm-graphtoprow" }, h("span", { className: "wbm-sectiontitle" }, t("mem.graph")), h("span", { className: "wbm-legend" }, t("mem.legend"))),
						h("h2", { className: "wbm-graphtitle" }, t("mem.graphTitle"))
					),
					shown.length === 0
						? h(
									"div",
									{ className: "wbm-empty" },
									h("div", null, h("b", null, t("mem.nomatch"))),
									h("div", { className: "wbm-emptyhint" }, t("mem.emptyHint")),
									query === "" ? null : h("button", { type: "button", className: "wbm-chip", onClick: () => setQuery("") }, t("mem.clearSearch"))
								)
						: h(MemoryGraph3D, { atoms: shown, edges: edges, picked: picked, neighbors: neighborIds, onPick: setPicked, t: t })
				),
				h(
					"section",
					{ className: "wbm-list" },
					h(
						"div",
						{ className: "wbm-listtop" },
						h("span", { className: "wbm-sectiontitle" }, t("mem.atoms")),
						h("span", { className: "wbm-legend" }, `${shown.length} / ${index.count}`),
						h("span", { className: "wbm-spacer" }),
						picked === "" ? h("span", { className: "wbm-legend" }, t("mem.pick")) : h("button", { type: "button", className: "wbm-chip", onClick: () => setPicked("") }, t("lib.close"))
					),
					shown.length === 0
						? h("div", { className: "wbm-empty" }, h("b", null, type === "" ? t("mem.nomatch") : t("mem.empty")), " · ", t("mem.emptyHint"))
						: h(
								"div",
								{ className: "wbm-grid" },
								shown.map((atom) =>
									h(
										"article",
										{
											key: atom.id,
											className: `wbm-card${picked === atom.id ? " is-on" : ""}`,
											style: { borderLeftColor: memTypeColor(atom.type) },
											onClick: () => setPicked(picked === atom.id ? "" : atom.id)
										},
										h("div", { className: "wbm-cardhead" }, h("span", { className: "wbm-type", style: { color: memTypeColor(atom.type), borderColor: memTypeColor(atom.type) } }, t(`mem.type.${atom.type}`)),
											h("span", { className: `wbm-score wbm-score-${atom.tier ?? "tier2"}` }, `${scoreText(atom)} · ${tierLabel(atom.tier ?? "tier2")}`),
											h("span", { className: `wbm-tierpill wbm-tierpill-${atom.manualTier ?? "tier2"}` }, `${t("mem.elig")} ${tierLabel(atom.manualTier ?? "tier2")}`),
											h("span", { className: "wbm-rel" }, `${t("mem.relations")} ${degreeOf(atom.id)}`)),
										h("p", { className: "wbm-claim" }, atom.claim),
										h(
										"div",
										{ className: "wbm-meta" },
										(atom.tags ?? []).map((tag) => h("span", { key: tag, className: "wbm-tag" }, tag)),
										h("span", { className: "wbm-state" }, `${atom.confidence} · ${atom.status}`)
									),
									picked === atom.id
										? h(
												"div",
												{ className: "wbm-detail" },
												h("div", null, h("b", null, `${t("mem.evidence")}：`), atom.evidence),
												h("div", null, h("b", null, `${t("mem.source")}：`), atom.source),
												atom.dims === null || atom.dims === undefined ? null : h("div", null, h("b", null, `${t("mem.scoreDims")}：`), `${scoreText(atom)} / 10 · ${tierLabel(atom.tier ?? "tier2")} · ${t("mem.hits")} ${atom.hits ?? 0}（证据 ${atom.dims.evidence}/3 · 复用 ${atom.dims.reuse}/3 · 范围 ${atom.dims.scope}/2 · 新鲜 ${atom.dims.fresh}/2）`),
											h("div", null, h("b", null, `${t("mem.elig")}：`), `${tierLabel(atom.manualTier ?? "tier2")}${(atom.manualTier ?? "tier2") === "tier3" ? t("mem.eligNo") : ""}`),
												h("div", { className: "wbm-reltitle" }, t("mem.relations")),
												neighborsOf(atom.id).length === 0 ? h("div", { className: "wbm-legend" }, "（暂无关系）") : null,
												neighborsOf(atom.id).map((n) =>
													h(
														"button",
														{ key: n.key, type: "button", className: "wbm-relrow", onClick: (event) => { event.stopPropagation(); setPicked(n.otherId); } },
														h("span", { className: "wbm-relkind", style: { color: memRelColor(n.rel) } }, `${n.dir} ${n.rel}`),
														h("span", { className: "wbm-relclaim" }, n.text)
													)
												)
											  )
											: null
									)
								)
						  ),
					hubs.length === 0 ? null : h("div", { className: "wbm-hubs" }, h("div", { className: "wbm-sectiontitle" }, t("mem.hub")), hubs.slice(0, 5).map((hub) => h("button", { key: hub.id, type: "button", className: "wbm-hubrow", onClick: () => setPicked(hub.id) }, h("span", { className: "wbm-hubdeg" }, `[${degreeOf(hub.id)}]`), h("span", null, hub.claim)))),
					h("p", { className: "wbm-note" }, `${t("mem.generated")} ${index.generatedAt ?? ""}`)
				)
			);
		}

		/**
		 * 「工作台」页面：hero + 统计 + 能力库 + 下一阶段。
		 * @param props - `t` 文案；`getDirectory` 取目录调用（未就绪返回 null）；`subscribe` 订阅服务到达。
		 */
		function HomePage(props) {
			const t = props.t;
			/** 能力库独立页用：只渲染技能卡片墙那一块（其余版块置 null，不新增任何组件）。 */
			const onlyLibrary = props.only === "library";
			const getDirectory = props.getDirectory;
			const [attempt, setAttempt] = React.useState(0);
			const [skills, setSkills] = React.useState({ status: "loading", names: null });
			const [query, setQuery] = React.useState("");
			const [open, setOpen] = React.useState("");
			const [tone, setTone] = React.useState("");
			const [copied, setCopied] = React.useState("");
			const [busy, setBusy] = React.useState("");

			// 面板 props 里的 useSessions（官方 hook）：面板自身没有 session，靠它拿会话状态
			const useSessionsHook = typeof props.useSessions === "function" ? props.useSessions : null;
			let panelSessionsState = null;
			try {
				panelSessionsState = useSessionsHook === null ? null : useSessionsHook((state) => state);
			} catch {
				panelSessionsState = null;
			}
			const [notice, setNotice] = React.useState("");
			const [overrides, setOverrides] = React.useState({});

			// 服务迟到绑定：apply 时它可能还没激活，到了就叫醒本页。
			React.useEffect(() => {
				if (getDirectory() !== null) return undefined;
				const notify = () => setAttempt((n) => n + 1);
				return props.subscribe(notify);
			}, []);

			React.useEffect(() => {
				const list = getDirectory();
				if (list === null) {
					setSkills({ status: "slow", names: null });
					return undefined;
				}
				let cancelled = false;
				setSkills({ status: "loading", names: null });
				Promise.resolve()
					.then(() => list(SKILLS_DIR))
					.then((listing) => {
						if (cancelled) return;
						const names = namesOf(listing);
						setSkills({ status: names.length === 0 ? "empty" : "ready", names });
					})
					.catch((error) => {
						if (cancelled) return;
						console.warn(`[${PLUGIN_NAME}] 读取技能目录失败：`, error);
						setSkills({ status: "failed", names: null });
					});
				return () => {
					cancelled = true;
				};
			}, [attempt]);

			const allRows = rowsOf(skills.names);
			const q = query.trim().toLowerCase();
			const rows = q.length === 0 ? allRows : allRows.filter((row) => `${row.title ?? ""} ${row.name} ${row.description} ${row.whenToUse}`.toLowerCase().includes(q));
			const groups = [];
			for (const row of rows) {
				const last = groups[groups.length - 1];
				if (last !== undefined && last.label === row.group) last.rows.push(row);
				else groups.push({ label: row.group, rows: [row] });
			}
			// 类别的配色序号（稳定的哈希 → 4 个色相），让卡片有颜色但不需要读字
			const TONES = ["rgba(96,140,255,.5)", "rgba(140,110,255,.5)", "rgba(255,170,90,.5)", "rgba(80,200,160,.5)"];
			const toneOf = (label) => {
				let sum = 0;
				for (let i = 0; i < label.length; i++) sum = (sum * 31 + label.charCodeAt(i)) % 997;
				return TONES[sum % TONES.length];
			};
			const toneNames = [...new Set(allRows.map((row) => row.group))];
			const shown = tone.length === 0 ? rows : rows.filter((row) => row.group === tone);
			const groups2 = [];
			for (const row of shown) {
				const last = groups2[groups2.length - 1];
				if (last !== undefined && last.label === row.group) last.rows.push(row);
				else groups2.push({ label: row.group, rows: [row] });
			}
			const selected = allRows.find((row) => row.name === open) ?? null;
			const drift = skills.names !== null && SKILL_INDEX.skills.length > 0 && skills.names.length !== SKILL_INDEX.skills.length;
			const stats = [
				{ value: skills.status === "ready" ? String(skills.names.length) : "—", label: t("stat.skills") },
				{ value: String(LOCAL_PLUGIN_COUNT), label: t("stat.plugins") },
				{ value: String(STAGE_COUNT), label: t("stat.stages") }
			];

			/** 这条技能当前的菜单状态（乐观覆盖优先，否则用索引里的快照）。 */
			function commandOf(row) {
				return overrides[row.name] !== undefined ? overrides[row.name] : row.command ?? "";
			}

			/**
			 * 复制一行到剪贴板。
			 * @param line - 要复制的文本。
			 * @param rowName - 哪一行技能（用来显示"已复制"）。
			 * @returns 是否复制成功。
			 */
			async function copyLine(line, rowName) {
				try {
					if (typeof navigator !== "undefined" && navigator.clipboard !== undefined) {
						await navigator.clipboard.writeText(line);
						setCopied(rowName);
						setTimeout(() => setCopied(""), 2500);
						return true;
					}
				} catch {}
				return false;
			}

			/**
			 * 点「加入 / 移出 菜单」：先试把命令送进会话（官方 conversation.send）；
			 * 送不进去就**自动复制**该命令并提示粘贴 —— 无论哪条路，按钮都不会白点。
			 * @param row - 技能行。
			 */
			async function onToggleMenu(row) {
				const current = commandOf(row);
				const line = `/skill-menu ${current ? "remove" : "add"} ${row.name}`;
				setBusy(row.name);
				setNotice("");
				let outcome = { via: "", detail: "" };
				try {
					outcome = await props.runToggle(line, panelSessionsState);
				} catch (error) {
					outcome = { via: "", detail: String(error).slice(0, 80) };
				}
				if (outcome.via !== "") {
					setOverrides((previous) => ({ ...previous, [row.name]: current ? "" : row.name }));
					setNotice(`已发出${current ? "移出" : "加入"}指令（经 ${outcome.via}）。提醒：如果输入框"没把它认成命令"，它会作为一条消息出现在会话里 —— 那种情况下菜单不会变，再点一次。`);
				} else {
					const copied = await copyLine(line, row.name);
					const head = copied ? "四条路都没通，已复制命令，粘到输入框回车即可" : "请手动输入";
					setNotice(`${head}：${line}　（原因：${outcome.detail}）`);
				}
				setBusy("");
			}

			/**
			 * 展开/收起一条技能。
			 * @param skillName - 技能名。
			 */
			function toggle(skillName) {
				// 手风琴：一次只开一张——点开新的会收起旧的，网格不会被撑出一堆高度
				setOpen((current) => (current === skillName ? "" : skillName));
			}

			let body;
			if (skills.status === "ready" || (skills.status === "empty" && SKILL_INDEX.skills.length > 0)) {
				body =
					shown.length === 0
						? h("div", { className: "wbh-notice" }, h("span", null, h("b", null, t("lib.nomatch"))))
						: h(
								"div",
								{ className: "wbh-libgrid" },
								shown.map((row) => {
									const isOpen = open === row.name;
									return h(
										"div",
										{
											key: row.name,
											role: "button",
											tabIndex: 0,
											className: `wbh-libcard${isOpen ? " is-open" : ""}`,
											style: { "--wbh-tint": toneOf(row.group) },
											"aria-expanded": isOpen,
											onClick: () => toggle(row.name),
											onKeyDown: (event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													toggle(row.name);
												}
											}
										},
										h(
											"span",
											{ className: "wbh-libtop" },
											h(
												"span",
												{ className: `wbh-libtile${SKILL_ICONS[row.dir] ? " is-image" : ""}` },
												SKILL_ICONS[row.dir]
													? h("img", { src: SKILL_ICONS[row.dir], alt: "", width: 40, height: 40, style: { display: "block", borderRadius: "var(--dsw-radius-md,8px)" } })
													: h(CategoryGlyph, { kind: row.tone })
											),
											h(
												"span",
												{ style: { minWidth: 0 } },
												h("span", { className: "wbh-libname" }, row.indexed ? row.title ?? row.name : row.name),
												h("span", { className: "wbh-libid" }, row.name)
											)
										),
										h("span", { className: "wbh-libshort" }, row.indexed ? row.short : t("lib.missing")),
										h(
											"span",
											{
												className: `wbh-cmd${row.command ? " is-on" : ""}`,
												title: row.command ? `在输入框敲 /${row.command} 就能直接调用它` : "还没加进 / 菜单（跟工作台说一声就加）"
											},
											h("span", { className: "wbh-cmddot", "aria-hidden": "true" }),
											row.command ? `${t("lib.cmd.on")} · /${row.command}` : t("lib.cmd.off")
										),
										h(
											"span",
											{ className: "wbh-cardbtns" },
												h(
													"button",
													{
														type: "button",
														className: `wbh-btn${commandOf(row) ? " is-on" : ""}`,
														disabled: busy === row.name,
														onClick: (event) => {
															event.stopPropagation();
															onToggleMenu(row);
														}
													},
													busy === row.name ? "处理中…" : commandOf(row) ? "移出 / 菜单" : "加入 / 菜单"
												),
										),
										h(
											"span",
											{ className: "wbh-cmdline" },
											h("code", { className: "wbh-cmdtext" }, `/skill-menu ${commandOf(row) ? "remove" : "add"} ${row.name}`),
											notice !== "" ? h("span", { className: "wbh-result" }, notice) : null
										),
										h("span", { className: "wbh-libmore" }, t("lib.detail"))
									);
								})
							);
			} else if (skills.status === "loading") {
				body = h(
					"div",
					{ className: "wbh-skel", role: "status", "aria-label": t("lib.loading") },
					h("div", { className: "wbh-skelline" }),
					h("div", { className: "wbh-skelline", style: { width: "74%" } }),
					h("div", { className: "wbh-skelline", style: { width: "58%" } })
				);
			} else if (skills.status === "empty") {
				body = h("div", { className: "wbh-notice" }, h("span", null, h("b", null, t("lib.empty")), " · ", t("lib.empty.hint")));
			} else if (skills.status === "failed") {
				body = h(
					"div",
					{ className: "wbh-notice" },
					h("span", null, h("b", null, t("lib.failed"))),
					h("span", { className: "wbh-spacer" }),
					h("button", { type: "button", className: "wbh-ghost", onClick: () => setAttempt((n) => n + 1) }, t("action.retry"))
				);
			} else {
				body = h("div", { className: "wbh-notice" }, h("span", null, h("b", null, t("lib.slow")), " · ", t("lib.slow.hint")));
			}

			return h(
				"div",
				{ className: "wbh-page" },
				h(
					"div",
					{ className: "wbh-inner" },
					onlyLibrary ? null : h(
						"div",
						{ className: "wbh-heroframe" },
						h(
							"div",
							{ className: "wbh-hero" },
							h(
								"div",
								{ className: "wbh-herotext" },
								h("h1", { className: "wbh-name" }, t("hero.name")),
								h("p", { className: "wbh-role" }, t("hero.role")),
								h("p", { className: "wbh-tagline" }, t("hero.tagline"))
							),
							h("div", { className: "wbh-status" }, h("span", { className: "wbh-dot", "aria-hidden": "true" }), t("page.status"))
						)
					),
					onlyLibrary ? null : h(
						"div",
						{ className: "wbh-stats" },
						stats.map((stat) => h("div", { className: "wbh-stat", key: stat.label }, h("div", { className: "wbh-statnum" }, stat.value), h("div", { className: "wbh-statlbl" }, stat.label)))
					),
					h(
						"section",
						{ className: "wbh-card" },
						h(
							"div",
							{ className: "wbh-cardhead" },
							h("span", { className: "wbh-cardicon" }, h(BookIcon, null)),
							h("span", { className: "wbh-cardtitle" }, t("lib.title")),
							skills.status === "ready" ? h("span", { className: "wbh-badge" }, `${skills.names.length} ${t("lib.unit")}`) : null,
							h("span", { className: "wbh-spacer" }),
							h("input", {
								className: "wbh-search",
								type: "search",
								value: query,
								placeholder: t("lib.search"),
								"aria-label": t("lib.search"),
								onChange: (event) => setQuery(event.target.value)
							}),
							h("button", { type: "button", className: "wbh-ghost", onClick: () => setAttempt((n) => n + 1) }, t("action.refresh"))
						),
						h(
							"div",
							{ className: "wbh-cardbody" },
							h("p", { className: "wbh-hint" }, t("lib.hint")),
							toneNames.length > 1
								? h(
										"div",
										{ className: "wbh-filters" },
										h(
											"button",
											{ type: "button", className: `wbh-chip${tone === "" ? " is-on" : ""}`, onClick: () => setTone("") },
											t("lib.filter.all")
										),
										toneNames.map((label) =>
											h(
												"button",
												{
													key: label,
													type: "button",
													className: `wbh-chip${tone === label ? " is-on" : ""}`,
													onClick: () => setTone(tone === label ? "" : label)
												},
												h("span", { className: "wbh-chipdot", style: { background: toneOf(label) } }),
												label
											)
										)
									)
								: null,
							drift
								? h("div", { className: "wbh-notice wbh-warnmargin" }, h("span", null, h("b", null, `${skills.names.length} / ${SKILL_INDEX.skills.length}`), " · ", t("lib.drift")))
								: null,
							body,
							h(
								"p",
								{ className: "wbh-note" },
								t("lib.add"),
								SKILL_INDEX.generatedAt && SKILL_INDEX.generatedAt !== "(未生成)" ? ` · ${t("lib.generated")} ${SKILL_INDEX.generatedAt}` : ""
							)
						)
					),
					onlyLibrary ? null : h(
						"section",
						{ className: "wbh-card" },
						h("div", { className: "wbh-cardhead" }, h("span", { className: "wbh-cardtitle" }, t("next.title"))),
						h(
							"div",
							{ className: "wbh-cardbody" },
							h(
								"div",
								{ className: "wbh-grid" },
								h(
									"div",
									{ className: "wbh-next" },
									h("div", { className: "wbh-nexticon" }, h(StageIcon, { kind: "resources" })),
									h("div", { className: "wbh-nexttitle" }, t("next.resources")),
									h("div", { className: "wbh-nexthint" }, t("next.resources.hint"))
								),
								h(
									"div",
									{ className: "wbh-next" },
									h("div", { className: "wbh-nexticon" }, h(StageIcon, { kind: "orchestrate" })),
									h("div", { className: "wbh-nexttitle" }, t("next.orchestrate")),
									h("div", { className: "wbh-nexthint" }, t("next.orchestrate.hint"))
								),
								h(
									"div",
									{ className: "wbh-next" },
									h("div", { className: "wbh-nexticon" }, h(StageIcon, { kind: "debug" })),
									h("div", { className: "wbh-nexttitle" }, t("next.debug")),
									h("div", { className: "wbh-nexthint" }, t("next.debug.hint"))
								)
							)
						)
					),
					selected !== null ? h(SkillDialog, { skill: selected, t, onClose: () => setOpen("") }) : null,
					onlyLibrary ? null : h("p", { className: "wbh-foot" }, t("next.footer")),
				)
			);
		}

		const name = PLUGIN_NAME;
		/** 必需的客户端服务：插槽注册表 + 语言字典。uiWorkspace 走迟到绑定，不进 inject。 */
		const inject = ["slots", "locale"];

		/**
		 * 客户端插件体：注入样式与字典、占"侧边栏入口 + 中间栏面板"，并迟到绑定目录服务。
		 * @param ctx - 客户端根上下文。
		 */
		/** 计划摘要挂在对话尾的哪一格（list 插槽：用自己的新 id = 并排新增一格）。 */
		const TURN_TAIL_SLOT = "conversation.chat.turnTail";
		/** 我们这一格的 id。 */
		const PLAN_BOOK_ID = "workbench-plan-book";
		/** 主机投影的 key（由 data/profiles/web/plugins/dsh-plan-book 注册）。 */
		const PLAN_BOOK_KEY = "plan-book";
		/** 右侧面板的标签类型 id（同时是 pane 插槽的 key）。 */
		const PLAN_PANE_ID = "dsh-workbench-home/plan-book";
		/** 右侧面板按这个地址前缀打开（官方机制：sidebarRightTabs 按 patterns 认领标签类型）。 */
		const PLAN_PANE_SCHEME = "dsh-resource://plan-book/";

		/* PLAN-SCENES:BEGIN */
		/** 信息图场景插画（按步序循环）。由 tools/gen-infographic-art.mjs 注入；空对象时面板不配插画。 */
		const PLAN_SCENES = {
			doing: "data:image/webp;base64,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",
			memory: "data:image/webp;base64,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",
			methods: "data:image/webp;base64,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",
			pipeline: "data:image/webp;base64,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",
			newtask: "data:image/webp;base64,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"
		};
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
				h("footer", { className: "ah-foot" }, h("p", null, "灯要是灭了，你喊我一声。"), h("small", null, "WORKBENCH · PERSONAL · 2026"))
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

			// 侧边栏第四个入口：能力库（技能卡片墙独立成页；id 决定点它时显示哪个 main key）
			if (pageOn("skillLibrary")) {
				ctx.slots.inject(PANEL_SLOT, function* () {
					yield ctx.slots.register({ name: PANEL_SLOT, id: PANEL_KEY_LIBRARY, order: 8, label: () => t("lib.title") }, (props) =>
						h(BookIcon, { ...props, label: t("lib.title") })
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
				if (pageOn("skillLibrary")) {
					yield ctx.slots.register({ name: MAIN_SLOT, key: PANEL_KEY_LIBRARY }, (props) =>
						h(HomePage, { ...props, t, getDirectory: () => directory, subscribe, runToggle, only: "library" })
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

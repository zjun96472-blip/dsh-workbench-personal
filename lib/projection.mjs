/**
 * 主机投影 `plan-book`：把「计划模式下提交的计划」折叠成给客户端读的绘本数据。
 *
 * 为什么用投影（而不是自己 hook 事件 + 另存文件）：
 *  - 官方 `dsh-plan-mode` 就是用投影把计划状态传给客户端的（`key: "plan"`）—— 这是**支持的通道**；
 *  - 投影由注册表统一驱动、可持久化、可回放，客户端用 `useProjection("plan-book")` 直接读；
 *  - `apply` 必须是**纯函数且不改旧引用**（注册表按 `Object.is` 判断变化），所以这里一律返回新对象。
 *
 * 本模块不依赖 zod：schema 由调用方注入（`createPlanBookProjection(z)`），便于离线单测。
 */
import { parsePlan, LIMITS as PARSE_LIMITS } from "./parse-plan.mjs";

export const PLAN_BOOK_KEY = "plan-book";
export const PLAN_BOOK_STATE_VERSION = 5;   // v4：非编号 `##` 不再混进步骤（有编号步骤时并入相邻步骤细节）→ 结果会变，再提高版本强制旧单元重算
                                            // v3：新增提案四节（sections）与每步「验收」（accept）→ 提高版本强制旧单元重算
export const PLAN_BOOK_LIMITS = { plans: 5, rawBytes: 40000 };

/** 四节的空值（老缓存 / 没写这几节时用，避免客户端拿到 undefined）。 */
const EMPTY_SECTIONS = { status: "", alternatives: "", cost: "", success: "" };

/** 宽容地把四节补齐（缺失就是空串，不抛）。 */
const tolerantSections = (value) => {
	const sections = value ?? EMPTY_SECTIONS;
	return {
		status: String(sections.status ?? ""),
		alternatives: String(sections.alternatives ?? ""),
		cost: String(sections.cost ?? ""),
		success: String(sections.success ?? "")
	};
};

/** 宽容地把一份计划补齐成 viewSchema 的形状（只补新字段，不动老字段）。 */
const tolerantPlan = (plan) => ({
	...plan,
	steps: (Array.isArray(plan?.steps) ? plan.steps : []).map((step) => ({ ...step, accept: String(step?.accept ?? "") })),
	sections: tolerantSections(plan?.sections),
	sectionsTruncated: plan?.sectionsTruncated === true
});

/**
 * 造一个投影定义。
 * @param z - zod 实例（由插件入口按绝对路径 import 后注入）。
 * @returns `ProjectionDefinition`：key / stateSchema / init / apply / wire / stateVersion。
 */
export function createPlanBookProjection(z) {
	const stepSchema = z.object({
		n: z.number(),
		title: z.string(),
		glyph: z.string(),
		glyphWord: z.string(),
		do: z.string(),
		why: z.string(),
		files: z.string(),
		risk: z.string(),
		accept: z.string(),
		detail: z.string()
	});
	const sectionSchema = z.object({
		status: z.string(),
		alternatives: z.string(),
		cost: z.string(),
		success: z.string()
	});
	const decisionSchema = z.object({ q: z.string(), options: z.array(z.string()) });
	const planSchema = z.object({
		callId: z.string(),
		title: z.string(),
		oneLine: z.string(),
		steps: z.array(stepSchema),
		decisions: z.array(decisionSchema),
		sections: sectionSchema,
		sectionsTruncated: z.boolean(),
		stepCount: z.number(),
		truncated: z.boolean(),
		parsed: z.string(),
		turn: z.number(),
		step: z.number(),
		at: z.number()
	});
	const stateSchema = z.object({ plans: z.array(planSchema) });

	return {
		key: PLAN_BOOK_KEY,
		stateVersion: PLAN_BOOK_STATE_VERSION,
		stateSchema,
		/** 初始状态：还没人提交过计划。 */
		init: () => ({ plans: [] }),
		/**
		 * 折叠一条会话事件。只关心 `tool/call` 且工具名是 `exit_plan_mode`。
		 * @param state - 上一状态（不修改它）。
		 * @param event - 会话事件。
		 * @returns 新状态（无变化时**原样返回**，让注册表按引用判断"没变"）。
		 */
		apply: (state, event) => {
			if (event?.type !== "tool/call") return state;
			if (event.data?.name !== "exit_plan_mode") return state;
			const rawArguments = event.data.arguments;
			if (typeof rawArguments !== "string" || rawArguments.length > PLAN_BOOK_LIMITS.rawBytes) return state;
			let args;
			try { args = JSON.parse(rawArguments); } catch { return state; }
			const markdown = typeof args?.plan === "string" ? args.plan : "";
			if (markdown.trim() === "") return state;

			const parsed = parsePlan(markdown);
			const entry = {
				callId: String(event.data.callId ?? ""),
				title: parsed.title,
				oneLine: parsed.oneLine,
				steps: parsed.steps,
				decisions: parsed.decisions,
				sections: parsed.sections,
				sectionsTruncated: parsed.sectionsTruncated === true,
				stepCount: parsed.stepCount,
				truncated: parsed.truncated,
				parsed: parsed.parsed,
				turn: Number(event.data.turn ?? 0),
				step: Number(event.data.step ?? 0),
				at: Number(event.time ?? Date.now())
			};
			// 同一个 callId 再来一次＝PTC 结算/重放：覆盖那一条，位置保持
			const others = state.plans.filter((plan) => plan.callId !== entry.callId);
			const merged = [...others, entry].slice(-PLAN_BOOK_LIMITS.plans);
			return { ...state, plans: merged };
		},
		wire: {
			viewSchema: stateSchema,
			/**
			 * 客户端读到的内容（有界：最多 5 份计划、每份最多 12 步）。
			 * 宽容：老缓存里缺 `sections`/`accept` 就补空，不抛也不白屏。
			 */
			view: (state) => ({ plans: (Array.isArray(state?.plans) ? state.plans : []).map(tolerantPlan) })
		}
	};
}

export { PARSE_LIMITS };

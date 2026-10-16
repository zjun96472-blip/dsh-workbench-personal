/**
 * dsh-workbench-personal —— 主机入口（这一个包把三件事收在一处）
 *
 *   ① 记忆自动注入：每轮有界召回 `$DSH_HOME/memory` 并把结果作为「历史数据、非指令」注入上下文；
 *   ② 计划投影：注册 session 投影 `plan-book`，把 `exit_plan_mode` 的 markdown 折成结构化计划；
 *   ③ 页面开关的**下发**：把 config 里的 `pages.*` 与解析出来的 `skillsDir` 通过
 *      `webserver/index-inject` 注入页面全局量 `__DSH_WORKBENCH__`，客户端 bundle 据此决定注册哪些页。
 *
 * 为什么 ③ 要绕这一圈（实测结论，别改成"客户端读 ctx.config"）：
 *   浏览器侧的 ClientModuleLoader 建条目时只传 `{ name: id }`
 *   （`@deepseek-ai/dsh-client-modules/lib/client.js` 的 `create()`），row config **到不了客户端**；
 *   官方 `dsh-client-shortcuts` 就是这么把配置送进页面的（同一个 `webserver/index-inject` 事件）。
 *
 * 入口形状照官方插件抄：`export function apply(ctx, config)` + 可选的 `export const Config`。
 * 不导出 `inject`：这样即使某个 profile 没有 `sessionProjections`，记忆注入与页面开关照样活着
 * （投影那边用 `ctx.inject(...)` 做**可选依赖**，缺了只警告）。
 */
import { createPlanBookProjection, PLAN_BOOK_KEY } from "./projection.mjs";
import { registerMemoryInjection, debug } from "./memory.mjs";
import { resolveWorkbenchPaths } from "./workbench-paths.mjs";
import { loadSchemastery, loadZod } from "./official.mjs";

/** 插件名（cordis 的行名 / 日志前缀）。 */
export const name = "workbench-personal";

/** 注入给页面的全局量名（客户端 bundle 读它）。 */
export const CLIENT_CONFIG_GLOBAL = "__DSH_WORKBENCH__";

/** 页面开关的默认值：全开（缺字段 = 开，向后兼容没有主机半边的场合）。 */
const DEFAULT_PAGES = { home: true, memory: true, audition: true, planBook: true };

/**
 * 组 config schema。schemastery 拿不到时返回 undefined —— Loader 就不做校验，
 * 仍然把原始 config 交给 apply（我们用同一个归一化函数读，行为一致）。
 * @returns schemastery `z.object(...)`，或 undefined。
 */
function buildConfig() {
	try {
		const z = loadSchemastery();
		return z.object({
			dshHome: z.string().default(""),
			memory: z.object({
				enabled: z.boolean().default(true),
				budget: z.number().default(1200)
			}),
			planBook: z.object({
				enabled: z.boolean().default(true)
			}),
			pages: z.object({
				home: z.boolean().default(true),
				memory: z.boolean().default(true),
				audition: z.boolean().default(true),
				planBook: z.boolean().default(true)
			})
		});
	} catch (error) {
		// 校验层缺席不影响功能：config 原样传进来，归一化时用同样的默认值
		debug(`schemastery 不可用（Config 留空）：${String(error?.message ?? error).slice(0, 160)}`);
		return undefined;
	}
}

/** Loader 在激活本行前按它校验 row config。 */
export const Config = buildConfig();

/**
 * 把（可能来自手写 patch、也可能来自校验器的）config 归一化成我们内部用的形状。
 * @param config - row config（可能 undefined / 缺字段 / 字段类型不对）。
 * @returns `{ dshHome, memory: {enabled, budget}, planBook: {enabled}, pages }`。
 */
export function normalizeConfig(config) {
	const raw = config !== null && typeof config === "object" ? config : {};
	const memory = raw.memory !== null && typeof raw.memory === "object" ? raw.memory : {};
	const planBook = raw.planBook !== null && typeof raw.planBook === "object" ? raw.planBook : {};
	const pages = raw.pages !== null && typeof raw.pages === "object" ? raw.pages : {};
	const page = (key) => (typeof pages[key] === "boolean" ? pages[key] : DEFAULT_PAGES[key]);
	const budget = Number(memory.budget);
	return {
		dshHome: typeof raw.dshHome === "string" ? raw.dshHome : "",
		memory: {
			enabled: typeof memory.enabled === "boolean" ? memory.enabled : true,
			budget: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 1200
		},
		planBook: { enabled: typeof planBook.enabled === "boolean" ? planBook.enabled : true },
		pages: {
			home: page("home"),
			memory: page("memory"),
			audition: page("audition"),
			planBook: page("planBook")
		}
	};
}

/**
 * 主机插件体。
 * @param ctx - 主机侧上下文。
 * @param config - 本行的 config。
 * @returns 无（资源都挂在 ctx 的生命周期上）。
 */
export function apply(ctx, config) {
	const settings = normalizeConfig(config);
	const paths = resolveWorkbenchPaths(settings.dshHome, ctx.logger);
	debug(`apply：config=${JSON.stringify(settings)} paths=${JSON.stringify(paths)}`);

	// ① 记忆自动注入（没有记忆库时静默跳过，绝不报错、绝不阻塞对话）
	if (settings.memory.enabled) {
		registerMemoryInjection(ctx, paths, { enabled: true, budget: settings.memory.budget });
	} else {
		debug("记忆注入按 config 关闭");
	}

	// ② 计划投影（要真 zod：投影注册表内部会调 stateSchema.parse）
	if (settings.planBook.enabled) {
		try {
			const projection = createPlanBookProjection(loadZod());
			ctx.inject(["sessionProjections"], (scoped) => {
				scoped.sessionProjections.register(projection);
				ctx.logger?.info?.(`[${name}] 已注册投影 ${PLAN_BOOK_KEY}（stateVersion ${projection.stateVersion}）`);
			});
		} catch (error) {
			// 注册失败不能拖垮整个 profile：客户端会显示"投影不可用"
			ctx.logger?.warn?.(`[${name}] 计划投影不可用：${String(error?.message ?? error).slice(0, 200)}`);
		}
	}

	// ③ 把页面开关与真实路径下发到页面（客户端拿不到 row config，只能用这个官方通道）
	ctx.on("webserver/index-inject", (table) => {
		table.push({
			kind: "global",
			name: CLIENT_CONFIG_GLOBAL,
			value: {
				version: 1,
				skillsDir: paths.skillsDir,
				memoryDir: paths.memoryDir,
				pages: settings.pages
			}
		});
	});

	ctx.effect(() => () => {
		// 钩子与 index-inject 订阅都由 ctx.on 的生命周期管理，这里没有额外要释放的东西
	}, `${name}: 钩子`);
}

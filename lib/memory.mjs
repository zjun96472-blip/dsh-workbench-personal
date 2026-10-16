/**
 * 记忆自动注入 —— 每轮**有界召回**并注入上下文（从本地插件 dsh-workbench-memory 搬进本包）。
 *
 * 只做一件事：在 `agent/pre-step` 里把相关记忆作为一条 user-role 消息插进本轮上下文，
 * 让「记得读记忆」不再依赖模型自觉。工程约束照抄业界（MemOS 的 DSH 适配器）：
 * 硬超时 3s、字符上限、失败静默降级、注入块**明确标注为历史数据而非指令**
 * （否则记忆库会变成提示注入通道）。
 *
 * 两个「不碰」：不注册任何 `/` 命令（用户不想记命令）；没有记忆库就**什么都不做**，不报错。
 */
import { execFile } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { importOfficial } from "./official.mjs";

/** 注入块的字符预算上限（默认值；config 可覆盖）。 */
const DEFAULT_BUDGET = 1200;
/** CLI 硬超时。 */
const CLI_TIMEOUT_MS = 3000;
/** 注入标记：用来去重，也用来在上下文里认领这一段。 */
const MARK = "<memory_context";

/** 调试日志：只在 DSH_WORKBENCH_DEBUG=1 时写 /tmp/dsh-workbench-debug.log。 */
export function debug(line) {
	if (process.env.DSH_WORKBENCH_DEBUG !== "1") return;
	try {
		appendFileSync("/tmp/dsh-workbench-debug.log", `${new Date().toISOString()} ${line}\n`);
	} catch { /* 日志失败不影响功能 */ }
}

/**
 * 跑记忆库 CLI（有硬超时；任何失败都返回 null —— 静默降级，绝不阻塞对话）。
 * @param node - node 可执行文件。
 * @param cli - memory.mjs 路径。
 * @param args - 传给 memory.mjs 的参数。
 * @returns stdout 文本，失败或超时为 null。
 */
function runCli(node, cli, args) {
	return new Promise((resolvePromise) => {
		execFile(node, [cli, ...args], { timeout: CLI_TIMEOUT_MS, maxBuffer: 1 << 20 }, (error, stdout) => {
			resolvePromise(error ? null : String(stdout).trim());
		});
	});
}

/**
 * 取本轮「真人」消息的文本（`source.kind === "user"` 的最后一条），用来做召回查询。
 * @param messages - 本轮消息数组。
 * @returns 查询文本（截断到 2000 字），找不到返回 ""。
 */
function lastUserText(messages) {
	if (!Array.isArray(messages)) return "";
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message === null || typeof message !== "object") continue;
		if (message.role !== "user") continue;
		if (message.source !== undefined && message.source !== null && message.source.kind !== "user") continue;
		const text = (Array.isArray(message.content) ? message.content : [])
			.filter((part) => part !== null && typeof part === "object" && part.type === "text")
			.map((part) => String(part.text ?? ""))
			.join(" ")
			.trim();
		if (text !== "") return text.slice(0, 2000);
	}
	return "";
}

/**
 * 注册记忆注入钩子。
 * @param ctx - 主机侧上下文。
 * @param paths - `resolveWorkbenchPaths()` 的结果。
 * @param options - `{ enabled, budget }`。
 * @returns 无。
 */
export function registerMemoryInjection(ctx, paths, options) {
	const enabled = options?.enabled !== false;
	const budget = Number.isFinite(options?.budget) && options.budget > 0 ? Math.floor(options.budget) : DEFAULT_BUDGET;
	const node = process.execPath;
	// 没有记忆库就别挂钩子：省掉每轮一次必然失败的子进程调用（这是"没有记忆库也能装"的关键）
	if (!existsSync(paths.memoryCli)) {
		debug(`记忆库 CLI 不存在（${paths.memoryCli}）：跳过记忆注入注册`);
		ctx.logger?.info?.(`[workbench-personal] 未发现记忆库（${paths.memoryCli}），跳过记忆注入 —— 这是正常的，其余功能不受影响`);
		return;
	}
	if (!enabled) {
		debug("记忆注入按 config 关闭");
		return;
	}
	/** 懒解析并缓存官方 `createUserMessage`（解析失败只记一次，且永远不再拖慢对话）。 */
	let userMessageFactory;
	let userMessageFailure;
	const factory = async () => {
		if (userMessageFactory !== undefined) return userMessageFactory;
		if (userMessageFailure !== undefined) return undefined;
		try {
			const mod = await importOfficial("@deepseek-ai/dsh-llm");
			userMessageFactory = mod.createUserMessage;
			return userMessageFactory;
		} catch (error) {
			userMessageFailure = error;
			ctx.logger?.warn?.(`[workbench-personal] 记忆注入停用：拿不到官方 createUserMessage（${String(error?.message ?? error).slice(0, 160)}）`);
			return undefined;
		}
	};

	ctx.on("agent/pre-step", async ({ messages, step, signal }, next) => {
		const decision = await next();
		try {
			if (decision === undefined || decision === null || decision.kind === "reject") return decision;
			if (!enabled) return decision;
			if (step !== 1) return decision;                                  // 每轮只注入一次（第一步）
			if (signal !== undefined && signal.aborted === true) return decision;
			const live = decision.messages ?? messages;
			const query = lastUserText(live);
			if (query === "") return decision;
			// 去重：只扫文本片段里有没有注入标记（不去 JSON.stringify 整个消息图）
			const alreadyInjected = (live ?? []).some((message) =>
				Array.isArray(message?.content) && message.content.some((part) => typeof part?.text === "string" && part.text.includes(MARK))
			);
			if (alreadyInjected) return decision;
			const block = await runCli(node, paths.memoryCli, ["inject", query, "--budget", String(budget)]);
			debug(`记忆召回：query=「${query.slice(0, 40)}」→ ${block === null ? "CLI 失败/超时/没有记忆库" : `${block.length} 字符`}`);
			if (block === null || block.trim() === "") return decision;
			const createUserMessage = await factory();
			if (createUserMessage === undefined) return decision;
			const injected = createUserMessage({
				content: [{ type: "text", text: block }],
				source: { kind: "workbench-memory" }                        // 自定义来源：便于识别这是注入的历史数据
			});
			const at = live.findLastIndex((message) => message?.role === "user");
			const where = at < 0 ? live.length : at + 1;
			return { ...decision, messages: live.toSpliced(where, 0, injected) };
		} catch (error) {
			// 召回失败绝不阻塞主任务（静默降级）—— 但调试模式要能看见
			debug(`记忆注入流程抛错（已忽略）：${String(error?.stack ?? error).slice(0, 300)}`);
			ctx.logger?.warn?.(`[workbench-personal] 记忆注入失败（已忽略）：${String(error?.message ?? error).slice(0, 120)}`);
			return decision;
		}
	});
	debug(`记忆注入钩子已注册（enabled=${enabled} budget=${budget} cli=${paths.memoryCli}）`);
}

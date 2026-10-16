/**
 * 路径解析：把「用户数据在哪」这个问题从写死的绝对路径改成运行时算出来。
 *
 * 官方口径（`@deepseek-ai/dsh-home-paths` 的 `resolveDshHome`）：配置 > `$DSH_HOME` > `~/.dsh`。
 * 这里多一条**本工作台布局**的兜底：`$DSH_HOME` 没设但 `<安装根>/data` 存在（就是这份工作台的样子）时用它，
 * 免得用户在 shell 里忘了 export 就整套页面找不到数据。选了哪条会写进日志，不静默。
 *
 * 目录约定（与官方/本工作台一致）：技能 `$DSH_HOME/skills`、记忆 `$DSH_HOME/memory`、
 * 技能菜单配置 `$DSH_HOME/skill-commands.json`、全局指令 `$DSH_HOME/AGENTS.md`。
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { nodeModulesRoots } from "./official.mjs";

/** 展开 `~` / `~/` 前缀（照官方 `expandHomePath` 的语义）。 */
function expandHome(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}

/**
 * 取安装根：`<root>/app/node_modules` 这样的候选根往上两级。
 * @returns 安装根绝对路径；判断不出时 undefined。
 */
function installationRoot() {
	for (const root of nodeModulesRoots()) {
		if (existsSync(join(root, "@deepseek-ai", "dsh", "package.json"))) return dirname(dirname(root));
	}
	return undefined;
}

/**
 * 解析这份工作台要用的所有路径。
 * @param configuredHome - 插件 config 里的 `dshHome`（最高优先级，留空则忽略）。
 * @param logger - 可选：用来把"最终选了哪个 DSH_HOME"记下来。
 * @returns `{ dshHome, skillsDir, memoryDir, memoryCli, skillCommandsFile, source }`。
 */
export function resolveWorkbenchPaths(configuredHome, logger) {
	const explicit = typeof configuredHome === "string" && configuredHome.trim() !== "" ? configuredHome : undefined;
	const fromEnv = process.env.DSH_HOME !== undefined && process.env.DSH_HOME.trim() !== "" ? process.env.DSH_HOME : undefined;
	const installed = installationRoot();
	const localData = installed === undefined ? undefined : join(installed, "data");

	let home;
	let source;
	if (explicit !== undefined) [home, source] = [resolve(expandHome(explicit)), "插件 config 的 dshHome"];
	else if (fromEnv !== undefined) [home, source] = [resolve(expandHome(fromEnv)), "$DSH_HOME"];
	else if (localData !== undefined && existsSync(localData)) [home, source] = [resolve(localData), "<安装根>/data（本工作台布局兜底）"];
	else [home, source] = [join(homedir(), ".dsh"), "~/.dsh（官方默认）"];

	const memoryDir = join(home, "memory");
	const paths = {
		dshHome: home,
		source,
		skillsDir: join(home, "skills"),
		memoryDir,
		memoryCli: join(memoryDir, "tools", "memory.mjs"),
		skillCommandsFile: join(home, "skill-commands.json")
	};
	try {
		logger?.info?.(`[workbench-personal] DSH_HOME = ${home}（来自 ${source}）`);
	} catch { /* 日志失败不影响功能 */ }
	return paths;
}

/**
 * 官方包的解析 —— 「可移植」这件事的关键一环。
 *
 * 背景（实测）：本地插件过去靠**绝对路径** import 官方包
 * （`import { createUserMessage } from "/opt/deepseek-harness-personal/app/node_modules/@deepseek-ai/dsh-llm/lib/index.js"`），
 * 理由是「profile 目录没有 node_modules」。**一旦做成可安装的 npm 包，这条就不成立了** ——
 * 别人的安装根不叫 `/opt/deepseek-harness-personal`，写死的绝对路径必然 ERR_MODULE_NOT_FOUND。
 *
 * 所以这里改成**两级解析**：
 *   1. 先按**裸包名**解析（`import("zod")` / `require("zod")`）。这是官方形状：跑在 profile 里时，
 *      `dsh-app-boot` 的运行时解析拦截（`createRuntimeResolution` + ESM 路由）会把 installation-owned
 *      的包名接到安装根上；profile 自己的 `node_modules` 也在 Node 的常规查找链里。
 *   2. 裸包名失败时，逐个候选 node_modules 根显式解析（并列出一路上试过什么，报错不装哑巴）。
 *
 * 同步 / 异步两条路都要有：
 *   · `requireOfficial` —— 给 `Config`（模块求值期就要是 schemastery 实例）和 zod（投影注册要用 `.parse`）用；
 *   · `importOfficial` —— 给 `dsh-llm` 这种纯 ESM 包用。
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** 本文件自己的 require（CJS 解析链）。 */
const ownRequire = createRequire(import.meta.url);

/** 报错里只放一句人话，别把整个 stack 塞进去。 */
function reason(error) {
	return String(error?.message ?? error).split("\n")[0].slice(0, 160);
}

/**
 * 从某个起点向上找最近的 `node_modules` 目录。
 * @param start - 起点目录。
 * @returns `node_modules` 的绝对路径，找不到返回 undefined。
 */
function nodeModulesAbove(start) {
	let dir = resolve(start);
	while (true) {
		if (basename(dir) === "node_modules") return dir;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

/**
 * 候选 node_modules 根，按尝试顺序。
 * 第 0 个是「我们自己所在的那棵树」—— 也就是运行中的 profile。
 * @returns 去重后的绝对路径列表。
 */
export function nodeModulesRoots() {
	const roots = [];
	const add = (path) => {
		if (typeof path !== "string" || path === "") return;
		const abs = resolve(path);
		if (!roots.includes(abs)) roots.push(abs);
	};
	// ① 本文件所在的树（profile 的 node_modules 或安装根的 node_modules）
	add(nodeModulesAbove(dirname(fileURLToPath(import.meta.url))));
	// ② 跑起来的那个 dsh 入口所在树：<install>/app/node_modules/@deepseek-ai/dsh/lib/bin.js
	if (typeof process.argv[1] === "string" && process.argv[1] !== "") add(nodeModulesAbove(process.argv[1]));
	// ③ 显式逃生口（文档里写着的那个变量）
	add(process.env.DSH_INSTALL_NODE_MODULES);
	// ④ 本工作台的布局：<install>/app/node_modules 与 <DSH_HOME>/../app/node_modules
	if (typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.trim() !== "") {
		add(join(process.env.DSH_HOME, "..", "app", "node_modules"));
		add(join(process.env.DSH_HOME, "node_modules"));
	}
	return roots;
}

/**
 * 同步解析一个官方包（CJS 语义）。
 * @param specifier - 包名，例如 `@deepseek-ai/schemastery`。
 * @returns 该包的导出对象。
 * @throws 两级都失败时抛错，错误里带上每一次尝试的原因。
 */
export function requireOfficial(specifier) {
	const tried = [];
	try {
		return ownRequire(specifier);
	} catch (error) {
		tried.push(`裸包名：${reason(error)}`);
	}
	for (const root of nodeModulesRoots()) {
		if (!existsSync(join(root, specifier, "package.json"))) continue;
		try {
			return createRequire(join(root, "__dsh_workbench_resolver.cjs"))(specifier);
		} catch (error) {
			tried.push(`${root}：${reason(error)}`);
		}
	}
	throw new Error(`dsh-workbench-personal: 解析不到官方包 ${specifier}（候选根 ${nodeModulesRoots().join(", ") || "无"}）。${tried.join(" | ")}`);
}

/**
 * 异步解析一个官方包（ESM 语义；纯 ESM 包必须走这条）。
 * @param specifier - 包名，例如 `@deepseek-ai/dsh-llm`。
 * @returns 该包的模块命名空间。
 * @throws 两级都失败时抛错，错误里带上每一次尝试的原因。
 */
export async function importOfficial(specifier) {
	const tried = [];
	try {
		return await import(specifier);
	} catch (error) {
		tried.push(`裸包名：${reason(error)}`);
	}
	for (const root of nodeModulesRoots()) {
		if (!existsSync(join(root, specifier, "package.json"))) continue;
		try {
			const file = createRequire(join(root, "__dsh_workbench_resolver.cjs")).resolve(specifier);
			return await import(pathToFileURL(file).href);
		} catch (error) {
			tried.push(`${root}：${reason(error)}`);
		}
	}
	throw new Error(`dsh-workbench-personal: 解析不到官方包 ${specifier}（候选根 ${nodeModulesRoots().join(", ") || "无"}）。${tried.join(" | ")}`);
}

/** 在几种可能的导出形状里挑出真正那一层（要求带 `.object`）。 */
function pickNamespace(mod) {
	for (const candidate of [mod, mod?.z, mod?.default]) {
		if (candidate !== undefined && candidate !== null && typeof candidate.object === "function") return candidate;
	}
	return mod?.default ?? mod;
}

/**
 * 取 zod（投影注册要 `stateSchema.parse`，所以必须真 zod，不能用别的 schema 库顶替）。
 * @returns zod 命名空间（有 `.object` 的那一层）。
 */
export function loadZod() {
	return pickNamespace(requireOfficial("zod"));
}

/**
 * 取 schemastery（`Config` 声明要用它，cordis Loader 按 schemastery 校验 row config）。
 * @returns 默认导出的 `z`。
 */
export function loadSchemastery() {
	return pickNamespace(requireOfficial("@deepseek-ai/schemastery"));
}

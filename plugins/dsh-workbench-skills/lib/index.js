// 个人工作台「技能命令」插件 —— **主机侧**半边。
//
// 做什么：把 data/skills 下的每条技能注册成一个 `/` 命令，于是输入框的 `/` 菜单里
// 就能直接点名调用（和 `/compact`、`/model` 并列），选中即把这件事交给我去做。
//
// 机制（2026-10-10 源码实测，不是猜的）：
//   · `/` 菜单的条目来自**主机侧的命令目录**：`dsh-commands` 的 `commands` 服务持有定义，
//     客户端只是 `command.list()` 显示出来 —— 所以要让技能进菜单，必须写这个主机插件。
//   · 命令名规则 `/^[a-z][a-z0-9_-]*$/`（`dsh-commands/lib/index.js` 的 COMMAND_NAME）：
//     **只能 ASCII 小写**，中文名会被拒；所以中文名放 `description`（菜单里跟名字一起显示）。
//   · handler 里用 `invocation.agent.followup(createUserMessage(...))` 把话交给模型
//     （官方 `/goal` 就是这么实现的）—— 这才让"点了命令＝我真的去执行"成立，
//     否则只能返回一句提示文字。
//   · **官方包必须绝对路径 import**：profile 目录下没有 node_modules，裸包名会
//     ERR_MODULE_NOT_FOUND（本机实测）。
//   · 技能目录用 fs.watch 盯着：加/删技能后自动重注册命令，**不需要重启**。
//     注意：改**本文件**（插件代码）或补丁层仍然要重启。
import { readFileSync, writeFileSync, readdirSync, existsSync, watch } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkbenchPaths } from "../../../lib/workbench-paths.mjs";
import { importOfficial } from "../../../lib/official.mjs";
import { debug as workbenchDebug } from "../../../lib/memory.mjs";

/** 插件名。 */
const name = "workbench-skills";
/** 依赖的命令注册表服务（缺了就别激活，免得抛错）。 */
const inject = ["commands"];
/** 这台机器上的真实路径：技能目录与菜单配置都从 `$DSH_HOME` 算（不再写死安装路径）。 */
const PATHS = resolveWorkbenchPaths(undefined, undefined);
/** 页面快照生成器：本包自带（菜单成员变动后跑一次，免得「工作台」页上的徽章过期）。 */
const INDEX_TOOL = fileURLToPath(new URL("../../../tools/refresh-snapshots.mjs", import.meta.url));
/** 执行脚本用的 node：就用当前这个进程的可执行文件（不写死安装根下的 node/bin）。 */
const NODE_BIN = process.execPath;
/** 命令名规则：与 dsh-commands 的校验保持一致，不合格的技能名会被跳过并记一条警告。 */
const COMMAND_NAME = /^[a-z][a-z0-9_-]*$/;
/** 目录变更的防抖窗口（毫秒）。 */
const WATCH_DEBOUNCE_MS = 400;
/** 描述里带的一句话短标签最长多少字。 */
const SHORT_LIMIT = 26;

/**
 * 解析 SKILL.md 的 frontmatter（只认简单的 `key: value`，够用且不引依赖）。
 * @param text - 文件全文。
 * @returns `{ data, body }`：键值对与去掉 frontmatter 的正文。
 */
function parseFrontmatter(text) {
	if (!text.startsWith("---")) return { data: {}, body: text };
	const end = text.indexOf("\n---", 3);
	if (end < 0) return { data: {}, body: text };
	const data = {};
	for (const line of text.slice(3, end).split("\n")) {
		const i = line.indexOf(":");
		if (i <= 0) continue;
		const key = line.slice(0, i).trim();
		let value = line.slice(i + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (key.length > 0) data[key] = value;
	}
	return { data, body: text.slice(end + 4) };
}

/**
 * 取描述的第一个句读当短标签（菜单里一行放得下）。
 * @param description - 完整描述。
 * @returns 短标签；描述为空时给一句兜底。
 */
function shortLabel(description) {
	const full = typeof description === "string" ? description.trim() : "";
	if (full.length === 0) return "（这条技能还没写 description）";
	const first = full.split(/[。；;—\n]/)[0].trim();
	const picked = first.length >= 4 ? first : full;
	return picked.length > SHORT_LIMIT ? `${picked.slice(0, SHORT_LIMIT)}…` : picked;
}

/**
 * 扫描技能目录，产出可注册的命令描述。
 * @param dir - 技能根目录。
 * @returns `{ skills, skipped }`：可注册项与因命名不合法被跳过的目录名。
 */
function scanSkills(dir) {
	const skills = [];
	const skipped = [];
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch (error) {
		return { skills, skipped, error };
	}
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const file = path.join(dir, entry.name, "SKILL.md");
		if (!existsSync(file)) continue;
		const { data } = parseFrontmatter(readFileSync(file, "utf8"));
		const commandName = data.name ?? entry.name;
		if (!COMMAND_NAME.test(commandName)) {
			skipped.push(commandName);
			continue;
		}
		skills.push({
			commandName,
			title: data.title ?? commandName,
			summary: shortLabel(data.description),
			dir: entry.name,
			relPath: `data/skills/${entry.name}/SKILL.md`
		});
	}
	return { skills, skipped };
}

/**
 * 读菜单配置，决定哪些技能进 `/` 菜单。
 * @param file - 配置文件路径。
 * @returns `Set<技能目录名>`；文件缺失或损坏时返回 null，表示"全部注册"（退回旧行为）。
 */
function readMenuConfig(file) {
	try {
		const parsed = JSON.parse(readFileSync(file, "utf8"));
		if (!Array.isArray(parsed?.inMenu)) return null;
		return new Set(parsed.inMenu.map((value) => String(value)));
	} catch {
		return null;
	}
}

/**
 * 插件体：注册命令、盯着技能目录、把每次调用变成交给我的一句指令。
 * @param ctx - 主机根上下文。
 * @param config - 可选配置：`{ dir, configFile }` 覆盖技能目录 / 菜单配置。
 */
function apply(ctx, config) {
	const skillsDir = typeof config?.dir === "string" && config.dir.length > 0 ? config.dir : PATHS.skillsDir;
	const configFile = typeof config?.configFile === "string" && config.configFile.length > 0 ? config.configFile : PATHS.skillCommandsFile;
	/** 官方 `createUserMessage`：**迟到绑定**（本地包解析官方包要两级尝试，失败只影响本插件）。 */
	let userMessage;
	importOfficial("@deepseek-ai/dsh-llm").then((mod) => {
		userMessage = mod.createUserMessage;
	}).catch((error) => {
		workbenchDebug(`技能命令拿不到 createUserMessage：${String(error?.message ?? error).slice(0, 160)}`);
		ctx.logger?.warn?.(`[${name}] 拿不到官方 createUserMessage，技能命令点了不会有反应：${String(error?.message ?? error).slice(0, 160)}`);
	});
	/** 当前已注册命令的注销器。 */
	let disposers = [];
	/** 防抖定时器。 */
	let timer = null;

	/** 注销当前全部命令。 */
	function unregisterAll() {
		for (const dispose of disposers) {
			try {
				dispose();
			} catch (error) {
				ctx.logger?.warn?.(`[${name}] 注销命令失败：${String(error)}`);
			}
		}
		disposers = [];
	}

	/** 重新扫描并注册（启动时一次，之后每次目录变更一次）。 */
	function resync() {
		unregisterAll();
		const { skills: allSkills, skipped, error } = scanSkills(skillsDir);
		if (error !== undefined) {
			ctx.logger?.warn?.(`[${name}] 读不到技能目录 ${skillsDir}：${String(error)}`);
			return;
		}
		// 只有列在菜单配置里的技能才注册成命令：菜单不会被技能数量拖长
		const menu = readMenuConfig(configFile);
		const skills = menu === null ? allSkills : allSkills.filter((skill) => menu.has(skill.dir) || menu.has(skill.commandName));
		for (const skill of skills) {
			disposers.push(
				ctx.commands.register({
					name: skill.commandName,
					description: `${skill.title} · ${skill.summary}`,
					input: { hint: "[要它做什么…，可留空]" },
					handler: (invocation) => {
						const ask = invocation.rawInput.trim();
						if (typeof userMessage !== "function") {
							// 官方包还没解析出来（或解析失败）——**不假装成功**，也不把消息发出去
							return { kind: "error", text: "官方消息构造函数还没就绪（看启动日志里的 workbench-skills 警告），请稍后再试。" };
						}
						const text = [
							`使用「${skill.commandName}」这个技能来做事：先用 skill 工具加载它（技能文件 ${skill.relPath}），再按它的步骤和验收标准执行。`,
							ask.length > 0 ? `具体要求：${ask}` : "没有额外要求：把它擅长的那件事按技能里的做法做一遍，并说明结论。"
						].join("\n");
						invocation.agent.followup(userMessage({ content: [{ type: "text", text }], source: { kind: "user" } }));
						return { kind: "success", text: `已交给个人工作台执行：${skill.title}` };
					}
				})
			);
		}
		if (skipped.length > 0) {
			ctx.logger?.warn?.(`[${name}] 这些技能名不符合命令规则（只能小写字母数字与 - _），未注册：${skipped.join(", ")}`);
		}
		ctx.logger?.info?.(
			`[${name}] 已注册 ${skills.length}/${allSkills.length} 条技能命令：${skills.map((s) => `/${s.commandName}`).join(" ")}` +
				(menu === null ? "（没读到菜单配置，退回全部注册）" : `（菜单配置：${configFile}）`)
		);
	}

	/**
	 * 自我管理命令 `/skill-menu`：让用户**自己**把技能放进 / 拿出菜单，不用每次都找个人工作台。
	 * 客户端插件写不了文件（已实测），所以这个开关只能住在主机侧。
	 */
	function registerMenuCommand() {
		return ctx.commands.register({
			name: "skill-menu",
			description: "管理 / 菜单里的技能命令：list / add <技能> / remove <技能>",
			input: { hint: "[list | add <技能名或中文名> | remove <技能>]" },
			handler: (invocation) => {
				const raw = invocation.rawInput.trim();
				const space = raw.search(/\s/u);
				const verb = (space < 0 ? raw : raw.slice(0, space)).toLowerCase();
				const arg = space < 0 ? "" : raw.slice(space + 1).trim();
				const { skills: all } = scanSkills(skillsDir);
				const current = readMenuConfig(configFile);
				const names = current === null ? all.map((skill) => skill.dir) : [...current];
				/** 按目录名 / 命令名 / 中文名找一条技能。 */
				const find = (query) =>
					all.find((skill) => skill.dir === query || skill.commandName === query || skill.title === query) ??
					all.find((skill) => skill.title.includes(query) || skill.commandName.includes(query));
				/** 写回配置（写文件会触发监视 → 立即重注册 + 同步页面快照）。 */
				const save = (list) => {
					writeFileSync(configFile, `${JSON.stringify({ _说明: "列在 inMenu 里的技能会注册成 / 命令。可用 /skill-menu add|remove|list 自己管理。", inMenu: list, updatedAt: new Date().toISOString() }, null, 2)}\n`);
					refreshPageSnapshot();
				};
				if (verb === "list" || verb === "") {
					const titles = names.map((dir) => all.find((skill) => skill.dir === dir)?.title ?? dir);
					return { kind: "success", text: names.length === 0 ? "现在 / 菜单里没有技能命令。" : `现在 / 菜单里有 ${names.length} 条：${titles.join("、")}` };
				}
				if (verb === "add" || verb === "remove") {
					if (arg.length === 0) return { kind: "error", text: `用法：/skill-menu ${verb} <技能名或中文名>` };
					const hit = find(arg);
					if (hit === undefined) return { kind: "error", text: `找不到技能「${arg}」。现有：${all.map((skill) => `${skill.title}（${skill.commandName}）`).join("、")}` };
					const has = names.includes(hit.dir);
					if (verb === "add") {
						if (has) return { kind: "success", text: `「${hit.title}」已经在 / 菜单里了。` };
						save([...names, hit.dir]);
						return { kind: "success", text: `已把「${hit.title}」加入 / 菜单：刷新后敲 /${hit.commandName} 就能用。` };
					}
					if (!has) return { kind: "success", text: `「${hit.title}」本来就不在 / 菜单里。` };
					save(names.filter((dir) => dir !== hit.dir));
					return { kind: "success", text: `已把「${hit.title}」从 / 菜单移出。` };
				}
				return { kind: "success", text: "用法：/skill-menu list ｜ /skill-menu add <技能> ｜ /skill-menu remove <技能>" };
			}
		});
	}

	/** 菜单成员变了就重建页面快照（失败只记警告：徽章晚一点更新而已，不影响命令）。 */
	function refreshPageSnapshot() {
		try {
			execFile(NODE_BIN, [INDEX_TOOL, "--skills"], { timeout: 15000 }, (error) => {
				if (error) ctx.logger?.warn?.(`[${name}] 重建页面快照失败（不影响命令）：${String(error)}`);
			});
		} catch (error) {
			ctx.logger?.warn?.(`[${name}] 无法调用页面快照生成器：${String(error)}`);
		}
	}

	resync();
	disposers.push(registerMenuCommand());

	// 目录变更即重注册：以后加/删技能，`/` 菜单立刻跟上，不需要重启。
	try {
		const watcher = watch(skillsDir, { persistent: false }, () => {
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				resync();
			}, WATCH_DEBOUNCE_MS);
		});
		ctx.effect(() => () => {
			watcher.close();
			if (timer !== null) clearTimeout(timer);
			unregisterAll();
		}, `${name}: 技能目录监视`);
	} catch (error) {
		ctx.logger?.warn?.(`[${name}] 无法监视技能目录，新增技能后需要重启才出现在菜单里：${String(error)}`);
		ctx.effect(() => () => unregisterAll(), `${name}: 命令注销`);
	}

	// 菜单配置改了也要立即生效（改 data/skill-commands.json 不用重启）
	try {
		const cfgWatcher = watch(configFile, { persistent: false }, () => {
			if (timer !== null) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = null;
				resync();
			}, WATCH_DEBOUNCE_MS);
		});
		ctx.effect(() => () => {
			cfgWatcher.close();
		}, `${name}: 菜单配置监视`);
	} catch {
		ctx.logger?.warn?.(`[${name}] 没能监视菜单配置 ${configFile}（不影响现有命令）`);
	}
}

export { apply, inject, name };

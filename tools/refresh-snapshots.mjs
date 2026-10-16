#!/usr/bin/env node
/**
 * 刷新客户端页面快照 —— 把「技能库」与「记忆库」烘进本包的 `lib/client.js`。
 *
 * 为什么必须烘快照（不是偷懒）：客户端插件**读不到文件内容**
 * （`workspaceFiles.read` 被限制在会话工作区内 —— 本工作台的实测结论），
 * 页面能拿到的只有目录名。所以「这个技能是干什么的」只能构建期注入；
 * 页面再用**实时目录列表**跟快照做体检，数量不一致就提示重跑本脚本，不假装信息是最新的。
 *
 * 用法（在**本包目录**下跑，或直接 node <本文件>）：
 *   node tools/refresh-snapshots.mjs            # 技能 + 记忆都快照
 *   node tools/refresh-snapshots.mjs --skills   # 只刷技能
 *   node tools/refresh-snapshots.mjs --memory   # 只刷记忆
 *   DSH_HOME=/path/to/data node tools/refresh-snapshots.mjs
 *
 * 数据来源（都可移植，不写死安装路径）：`$DSH_HOME/skills`、`$DSH_HOME/memory`、
 * 技能菜单配置 `$DSH_HOME/skill-commands.json`。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveWorkbenchPaths } from "../lib/workbench-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..");
const TARGET = join(PACKAGE_ROOT, "lib", "client.js");
const PATHS = resolveWorkbenchPaths(undefined, undefined);

// 标记块：**只按前缀认**（BEGIN 后面那截说明文字是上一代生成器写的，不动它也能替换）
const SKILL_BEGIN = "/* SKILL-INDEX:BEGIN";
const SKILL_END = "/* SKILL-INDEX:END */";
const MEM_BEGIN = "/* MEMORY-INDEX:BEGIN";
const MEM_END = "/* MEMORY-INDEX:END */";

/** 前缀 → 中文分组名（技能不支持子目录，分类只能靠命名前缀）。 */
const GROUPS = {
	workbench: "工作台自身",
	ui: "界面与视觉",
	personal: "技能库与流程",
	research: "外部调研"
};

/** 解析 `key: value` 形式的 frontmatter（够用且不引依赖）。 */
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
		if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
		if (key.length > 0) data[key] = value;
	}
	return { data, body: text.slice(end + 4) };
}

/** 把正文压成一段能看懂的摘要：去掉 markdown 记号、跳过表格与代码块，取前几段。 */
function excerptOf(body, limit = 260) {
	const lines = body.split("\n").map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith("|") && !line.startsWith("```") && !line.startsWith("#"));
	const text = lines.join(" ").replace(/[*`>]/g, "").replace(/\s+/g, " ").trim();
	return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

/**
 * 换掉 client.js 里的一对标记块（整块替换，含原来那行 BEGIN 说明）。
 * @param beginPrefix - BEGIN 标记前缀（不要求整行相同）。
 * @param endMarker - END 标记（整行）。
 * @param beginLine - 写回去的新 BEGIN 行。
 * @param inner - 新的块内容（不含 BEGIN/END）。
 */
function spliceBlock(beginPrefix, endMarker, beginLine, inner) {
	const text = readFileSync(TARGET, "utf8");
	const i = text.indexOf(beginPrefix);
	const j = text.indexOf(endMarker);
	if (i < 0 || j < 0 || j < i) throw new Error(`目标 ${TARGET} 里没有 ${beginPrefix} … ${endMarker} 这对标记块，请先放一对 BEGIN/END 标记`);
	writeFileSync(TARGET, text.slice(0, i) + beginLine + inner + endMarker + text.slice(j + endMarker.length));
}

/** 读「哪些技能进了 / 菜单」。 */
function readMenu() {
	try {
		const parsed = JSON.parse(readFileSync(PATHS.skillCommandsFile, "utf8"));
		return Array.isArray(parsed?.inMenu) ? new Set(parsed.inMenu.map(String)) : null;
	} catch {
		return null;
	}
}

/** 刷新技能快照（SKILL-INDEX）。 */
function refreshSkills() {
	if (!existsSync(PATHS.skillsDir)) throw new Error(`技能目录不存在：${PATHS.skillsDir}（用 DSH_HOME 指到正确的位置）`);
	const menu = readMenu();
	if (menu === null) console.warn(`  提示：没读到 ${PATHS.skillCommandsFile}，卡片上会显示「未加入 / 菜单」`);
	const skills = readdirSync(PATHS.skillsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const file = join(PATHS.skillsDir, entry.name, "SKILL.md");
			if (!existsSync(file)) return null;
			const raw = readFileSync(file, "utf8");
			const { data, body } = parseFrontmatter(raw);
			const skillName = data.name ?? entry.name;
			const full = data.description ?? "";
			// 没有 description 的文件会被 harness **静默忽略** —— 宁可吵，不许静默丢
			if (full.trim() === "") throw new Error(`技能 ${skillName} 的 frontmatter 缺 description —— harness 会静默忽略它，先修文件再跑本脚本`);
			const shortLabel = full.split(/[。；;—\n]/)[0].trim().slice(0, 30);
			return {
				name: skillName,
				title: data.title ?? skillName,
				dir: entry.name,
				tone: skillName.split("-")[0],
				group: GROUPS[skillName.split("-")[0]] ?? "其它",
				short: shortLabel.length >= 6 ? shortLabel : full.slice(0, 30),
				description: full,
				whenToUse: data.whenToUse ?? "",
				excerpt: excerptOf(body),
				command: menu !== null && (menu.has(entry.name) || menu.has(skillName)) ? skillName : "",
				// 页面只拿它当"这个技能在哪"的提示 —— 写成可移植的相对路径，别把安装根烘进 bundle
				path: `skills/${entry.name}/SKILL.md`,
				lines: raw.split("\n").length
			};
		})
		.filter(Boolean)
		.sort((a, b) => a.group.localeCompare(b.group, "zh") || a.name.localeCompare(b.name));
	const payload = { generatedAt: `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`, skills };
	spliceBlock(
		SKILL_BEGIN,
		SKILL_END,
		"/* SKILL-INDEX:BEGIN —— 由 tools/refresh-snapshots.mjs 生成，勿手改；加/改技能后重跑本脚本 */",
		`\n\t\tconst SKILL_INDEX = ${JSON.stringify(payload, null, "\t\t")};\n\t\t`
	);
	console.log(`技能快照：${skills.length} 条 → 已注入 ${TARGET}`);
}

/** 读 jsonl（跳过坏行）。 */
function readJsonl(file) {
	if (!existsSync(file)) return [];
	return readFileSync(file, "utf8").split("\n").flatMap((line) => {
		const text = line.trim();
		if (text === "") return [];
		try { return [JSON.parse(text)]; } catch { return []; }
	});
}

/** 刷新记忆快照（MEMORY-INDEX）。没有记忆库就直接说，不写假数据。 */
async function refreshMemory() {
	const atomsFile = process.env.MEMORY_ATOMS ?? join(PATHS.memoryDir, "atoms.jsonl");
	const edgesFile = join(PATHS.memoryDir, "edges.jsonl");
	const scoresFile = process.env.MEMORY_SCORES ?? join(PATHS.memoryDir, "scores.jsonl");
	if (!existsSync(atomsFile)) {
		console.warn(`记忆快照：跳过 —— 找不到 ${atomsFile}（没有记忆库的机器上这是正常的）`);
		return;
	}
	// 打分口径只定义一次（在用户自己的 memory.mjs 里）；拿不到就**不写分数**，而不是自己算一套
	let scoring;
	try {
		scoring = await import(pathToFileURL(join(PATHS.memoryDir, "tools", "memory.mjs")).href);
	} catch (error) {
		console.warn(`记忆快照：读不到 ${join(PATHS.memoryDir, "tools", "memory.mjs")}，本次不写分数（${String(error?.message ?? error).slice(0, 120)}）`);
	}
	const atoms = readJsonl(atomsFile).filter((a) => a.status !== "已废弃");
	const ids = new Set(atoms.map((a) => a.id));
	const edges = readJsonl(edgesFile).filter((e) => ids.has(e.from) && ids.has(e.to));
	const scoreRows = readJsonl(scoresFile);
	const scoreById = scoring !== undefined && typeof scoring.latestScores === "function" ? scoring.latestScores(scoreRows) : new Map();
	const latest = [...scoreById.values()];
	const effectiveTier = scoring?.effectiveTier;
	const manualTierOf = scoring?.manualTierOf;
	const types = [...new Set(atoms.map((a) => a.type))];
	const payload = {
		generatedAt: `${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`,
		count: atoms.length,
		edgeCount: edges.length,
		types,
		scoreSummary: scoring === undefined ? null : {
			scored: atoms.filter((a) => scoreById.has(a.id)).length,
			avg: latest.length === 0 ? null : Math.round((latest.reduce((sum, row) => sum + row.score, 0) / latest.length) * 100) / 100,
			maxHits: latest.reduce((max, row) => Math.max(max, row.hits ?? 0), 0),
			byTier: ["tier1", "tier2", "tier3"].map((tier) => [tier, atoms.filter((a) => effectiveTier?.(a, scoreById.get(a.id)?.score) === tier).length]),
			byManualTier: ["tier1", "tier2", "tier3"].map((tier) => [tier, atoms.filter((a) => manualTierOf?.(a) === tier).length]),
			history: scoreRows.length
		},
		atoms: atoms.map((a) => {
			const row = scoreById.get(a.id);
			return {
				id: a.id, type: a.type, claim: a.claim, tags: a.tags ?? [], confidence: a.confidence, status: a.status,
				scope: a.scope ?? "", evidence: a.evidence ?? "", source: a.source ?? "", at: a.at ?? 0,
				score: row?.score ?? null, dims: row?.dims ?? null, hits: row?.hits ?? 0,
				tier: effectiveTier?.(a, row?.score) ?? null,
				manualTier: manualTierOf?.(a) ?? null
			};
		}),
		edges: edges.map((e) => ({ from: e.from, to: e.to, rel: e.rel, note: e.note ?? "" }))
	};
	spliceBlock(
		MEM_BEGIN,
		MEM_END,
		"/* MEMORY-INDEX:BEGIN —— 由 tools/refresh-snapshots.mjs 生成，勿手改；加/改记忆后重跑本脚本 */",
		`\n\t\tconst MEMORY_INDEX = ${JSON.stringify(payload, null, "\t\t")};\n\t\t`
	);
	console.log(`记忆快照：${atoms.length} 条原子 / ${edges.length} 条关系 / ${types.length} 个类型 → 已注入 ${TARGET}`);
}

const args = new Set(process.argv.slice(2));
const onlySkills = args.has("--skills") && !args.has("--memory");
const onlyMemory = args.has("--memory") && !args.has("--skills");
console.log(`DSH_HOME = ${PATHS.dshHome}（来自 ${PATHS.source}）`);
if (!onlyMemory) refreshSkills();
if (!onlySkills) await refreshMemory();

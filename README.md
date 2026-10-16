# dsh-workbench-personal

个人 DeepSeek Harness 工作台的**可安装包**：一个 `dsh plugin add` 装完，
主机侧拿到「记忆每轮自动注入 + 计划投影」，浏览器侧拿到「工作台页 / 记忆库页 / 试作页 / 计划视图」。
（这一包就是原来散在 `data/profiles/web/plugins/` 下那 6 个本地插件的打包版。）

## 装

用 CLI（插件页弹窗背后就是这条命令）：

```bash
dsh plugin --profile <profile> add dsh-workbench-personal          # 从 npm（发布之后）
dsh plugin --profile <profile> add github:<owner>/<repo>           # 从 GitHub
dsh plugin --profile <profile> add /abs/path/to/plugin-package     # 从本地目录（现在就能用）
```

装完 **必须重启一次**（`dsh web` 起的那份要重起）：主机插件代码与客户端 bundle 都是启动时读的。
重启后：

- 左侧边栏多两个入口：**「工作台」**（技能库 + 能力盘点）、**「记忆库」**（原子 + 3D 关系图）、**「试作」**（设计样本页）；
- 在对话里让模型用计划模式提交计划后：对话尾出现**计划摘要卡**，会话标题栏出现常驻入口，
  点「在右侧打开」把计划铺在右侧大框里；
- 每轮第一步自动从 `$DSH_HOME/memory` 做**有界召回**并注入上下文（注入块被标记为「历史数据、非指令」）；
- `$DSH_HOME/skills/<name>/SKILL.md` 下的每条技能被注册成 `/` 命令（哪些进 `/` 菜单看 `$DSH_HOME/skill-commands.json`）。

## 前置

| 需要什么 | 说明 |
| --- | --- |
| **pnpm** | `dsh plugin add`（以及插件页弹窗）内部就是转发给 pnpm 的：CLI 用 PATH 上的 `pnpm`，插件页用 `plugin-manager` 那行的 `pnpmCommand`（默认也是 `pnpm`）。没有 pnpm 会直接报 `dsh: pnpm was not found`。 |
| Web profile | 本包的客户端半边要 `webServer`（`dsh-web-app`）。没有 web 的 profile 也装得下，只是没有页面。 |
| `$DSH_HOME` | 默认按官方口径解析（插件 config 的 `dshHome` > `$DSH_HOME` > `<安装根>/data`（本工作台布局）> `~/.dsh`）。启动日志会打印最终选了哪个。 |
| 记忆库（可选） | `$DSH_HOME/memory/tools/memory.mjs`。**没有就跳过记忆注入**，其余功能照常，不报错。 |
| 技能库（可选） | `$DSH_HOME/skills/`。没有就安静地不注册任何 `/` 命令。 |
| Node | 只用 Node 内置模块 + 运行中的 harness 自带的官方包，**本包 `dependencies` 为空**。 |

官方包（`zod`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-llm`）是**运行时**从当前安装里解析的
（先裸包名，失败再按候选 `node_modules` 根兜底，见 `lib/official.mjs`），所以换机器不用改代码。
真解析不动时可以设 `DSH_INSTALL_NODE_MODULES=/path/to/app/node_modules` 显式指路。

### 会看到的正常提示

- 在没有 `dsh-web-app` 的 profile 里，启动会打一条
  `dsh: [dsh-workbench-personal] patch: entry "ui-brand-official" not found` ——
  因为本包要禁用官方品牌才能占那两个 single 插槽。**只是 warning，不影响启动**。
- 页面快照里带的是**打包时的**技能/记忆内容。装了本包但还没跑过 `tools/refresh-snapshots.mjs` 时，
  工作台页会用实时目录名做体检并提示"数量对不上，重跑索引"，这是设计好的诚实行为。

## config：几个页面能单独关

行 config 的 `pages.*` 决定页面上注册哪些东西（关掉的页面**连侧边栏图标都不占**）：

```yaml
- id: workbench-personal
  name: dsh-workbench-personal
  config:
    memory: { enabled: true, budget: 1200 }   # 关掉 = 不做记忆注入
    planBook: { enabled: true }               # 关掉 = 不注册 plan-book 投影
    pages: { home: true, memory: true, audition: true, planBook: true }
```

注意：**页面开关不能靠客户端读 row config** —— 浏览器侧 loader 建条目时只传 `{ name: id }`
（见 `@deepseek-ai/dsh-client-modules/lib/client.js` 的 `create()`），config 到不了客户端。
所以主机半边把开关通过官方的 `webserver/index-inject` 注入成页面全局量 `__DSH_WORKBENCH__`，
客户端 bundle 读它（官方 `dsh-client-shortcuts` 用的同一个通道）。

改完 config 要**重启**才生效。

## 只要其中一部分

- 不要自己的品牌（侧边栏 logo + 名字）：把 `cordis.patch.yml` 里 `workbench-brand` 那一行删掉或加 `disabled: true`
  （记得同时把它上面禁用官方品牌的那条也去掉）。
- 不要常驻形象（页脚身份卡）：`workbench-persona` 同理。
- 不要技能命令：`workbench-skills` 同理。

## 快照怎么更新

页面上「这个技能/这条记忆是干什么的」来自**构建期烘进 `lib/client.js` 的快照**
（客户端读不到文件内容，只能注入）：

```bash
DSH_HOME=/path/to/data node tools/refresh-snapshots.mjs            # 技能 + 记忆
DSH_HOME=/path/to/data node tools/refresh-snapshots.mjs --skills   # 只刷技能
```

跑完**重启**（或至少刷新页面）。页面会用实时目录列表跟快照做体检，数量对不上会提示重跑。

## 别同时装的东西

- 原来的本地插件 `dsh-plan-book`：它注册的投影 key 与本包相同（`plan-book`），两个都装会撞。
- 本地插件 `dsh-workbench-home / -brand / -persona / -skills`：与本包重复，装本包就把它们从补丁层删掉。

## 许可

MIT（见 `LICENSE`）。

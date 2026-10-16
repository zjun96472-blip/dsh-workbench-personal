// 个人工作台品牌插件 —— 客户端半边（手写 bundle，无需 tsdown 构建）
//
// 协议（照 @deepseek-ai/dsh-client-ui-brand-official 的形状写）：
//   1. 载入时调用 window.__ModuleLoader__.load({ id, factory })
//   2. factory 只注册导出的 apply / inject，不做副作用
//   3. apply(ctx) 里通过 ctx.slots.register 占用插槽
//
// 占用的是 sidebar 声明的两个 kind: "single" 插槽：
//   sidebar.brand.mark <- { size: 24 }
//   sidebar.brand.name <- {}
// single 插槽已有占用者时再注册会抛错，所以官方品牌插件
// (@deepseek-ai/dsh-client-ui-brand-official) 必须在补丁层被禁用。
window.__ModuleLoader__.load({
	id: "dsh-workbench-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/** 工作台标识：终端窗口 + 输入提示行的抽象标记。 */
		function WorkbenchMark({ size }) {
			const s = typeof size === "number" && size > 0 ? size : 24;
			return h(
				"svg",
				{
					width: s,
					height: s,
					viewBox: "0 0 24 24",
					fill: "none",
					role: "img",
					"aria-label": "个人工作台",
					style: { display: "block", flex: "none" }
				},
				h("rect", {
					x: "2.75",
					y: "3.75",
					width: "18.5",
					height: "16.5",
					rx: "4.25",
					stroke: "currentColor",
					strokeWidth: "1.6"
				}),
				h("path", {
					d: "M2.75 8.5h18.5",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round",
					opacity: "0.55"
				}),
				h("path", {
					d: "M7 12.5l2.6 2.1L7 16.7",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				}),
				h("path", {
					d: "M12.4 16.9h4.2",
					stroke: "currentColor",
					strokeWidth: "1.7",
					strokeLinecap: "round"
				})
			);
		}

		/** 工作台名称：主名 + 一行极小的副标，用于自我指认。 */
		function WorkbenchName() {
			return h(
				"span",
				{
					style: {
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						lineHeight: 1.1,
						minWidth: 0
					}
				},
				h(
					"span",
					{
						style: {
							fontSize: "13px",
							fontWeight: 600,
							letterSpacing: "0.01em",
							whiteSpace: "nowrap"
						}
					},
					"个人工作台"
				),
				h(
					"span",
					{
						style: {
							fontSize: "9px",
							fontWeight: 500,
							letterSpacing: "0.06em",
							opacity: 0.5,
							whiteSpace: "nowrap"
						}
					},
					"PERSONAL WORKBENCH"
				)
			);
		}

		const name = "workbench-brand";
		/** 必需的客户端服务：UI 插槽注册表。 */
		const inject = ["slots"];

		/**
		 * 等待侧边栏声明两个插槽，再按声明生命周期注册品牌。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
			ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", function* () {
				yield ctx.slots.register({ name: "sidebar.brand.mark" }, WorkbenchMark);
				yield ctx.slots.register({ name: "sidebar.brand.name" }, WorkbenchName);
			}));
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});

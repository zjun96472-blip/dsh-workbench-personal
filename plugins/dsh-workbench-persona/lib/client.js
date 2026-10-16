// 个人工作台「身份」插件 —— 客户端半边（手写 bundle，无需 tsdown 构建）
//
// 历史：本插件先做过「形象」，再做「桌宠」（浮层可拖动 / 像素精灵 / 动漫同人画）。
// 2026-10-09 用户明确要求 **把桌宠这一块去掉、别再折腾形象**，因此：
//   · 不再注册 shell.overlay（整帧浮层的桌宠）—— 该席位现在是空的
//   · 不再注册 conversation.hero.brand.mark（原来用它挂形象）—— 该席位也空着
//   · 不再有任何人物美术稿（assets/ 与生成工具一并删除）
// 现在只留**最小的一块**：侧边栏页脚一个按钮 + 一张身份卡（我是谁、什么状态、名字取意）。
// 这是"我是个人工作台"这件事的最短表达：不占界面、不抢业务。
//
// 协议：载入时只 window.__ModuleLoader__.load({ id, factory })；副作用全在 apply(ctx) 内；
// factory 里只 require 冻结平台表（这里只有 react）。
window.__ModuleLoader__.load({
	id: "dsh-workbench-persona",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/** 客户端插件名（cordis 插件体 name）。 */
		const PLUGIN_NAME = "workbench-persona";
		/** locale 命名空间。 */
		const LOCALE_NS = "workbench-persona";
		/** 唯一占用的插槽：侧边栏页脚动作列表（kind: "list"，可与其他条目共存）。 */
		const FOOTER_SLOT = "sidebar.footer.action";
		/** 本插件在页脚里的注册 id。 */
		const FOOTER_ID = "workbench-persona";
		/** 身份卡宽度（像素）。 */
		const CARD_WIDTH = 268;

		/** 中文字典（key 与 en 一一对应）。 */
		const DICT_ZH = {
			"action.label": "个人工作台",
			"action.title": "个人工作台 · 身份卡",
			"mark.alt": "个人工作台",
			"card.title": "个人工作台",
			"card.role": "PERSONAL WORKBENCH · RESIDENT OPERATOR",
			"card.standing": "值守中",
			"card.name": "名字取意：灯一直亮着，我就一直在。"
		};
		/** 英文字典（同一组 key）。 */
		const DICT_EN = {
			"action.label": "Changming",
			"action.title": "Changming · identity card",
			"mark.alt": "Changming",
			"card.title": "Changming",
			"card.role": "PERSONAL WORKBENCH · RESIDENT OPERATOR",
			"card.standing": "on duty",
			"card.name": "The name means: while the lamp stays lit, I'm here."
		};

		/** 身份卡样式。类名 wpi 前缀；尺度与颜色都走这套工作台自己的令牌（见 ui-polish 技能）。 */
		const CARD_CSS = [
			".wpi-btn:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}",
			".wpi-card :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}"
		].join("\n");

		/** 页脚按钮的小标记：一盏灯（线性，跟随 currentColor）。 */
		function MarkGlyph() {
			return h(
				"svg",
				{ width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", style: { display: "block", flex: "none" } },
				h("path", { d: "M12 3v3.2", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round", opacity: "0.7" }),
				h("path", { d: "M8.8 6.2h6.4", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" }),
				h("path", { d: "M9.5 8.4h5l1.4 4v6H8.1v-6z", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }),
				h("circle", { cx: "12", cy: "14.4", r: "1.9", fill: "currentColor", opacity: "0.9" })
			);
		}

		/**
		 * 计算身份卡位置：贴着页脚按钮上方弹出，并夹在视口内。
		 * @param button - 页脚按钮元素（可能尚未挂载）。
		 * @returns `{ left, bottom, width }`；拿不到元素时返回 null（此时卡片不渲染）。
		 */
		function anchorOf(button) {
			if (button === null || typeof button.getBoundingClientRect !== "function") return null;
			const rect = button.getBoundingClientRect();
			const maxLeft = Math.max(8, window.innerWidth - CARD_WIDTH - 8);
			return {
				left: Math.min(Math.max(8, rect.left), maxLeft),
				bottom: Math.max(8, window.innerHeight - rect.top + 10),
				width: CARD_WIDTH
			};
		}

		/**
		 * 身份卡：我是谁 + 值守状态 + 名字取意。纯展示，不带任何可写能力。
		 * @param props - `anchor` 定位结果；`t` 文案查询。
		 */
		function IdentityCard(props) {
			const { anchor, t } = props;
			if (anchor === null) return null;
			return h(
				"div",
				{
					className: "wpi-card",
					role: "dialog",
					"aria-label": t("card.title"),
					style: {
						position: "fixed",
						left: `${anchor.left}px`,
						bottom: `${anchor.bottom}px`,
						width: `${anchor.width}px`,
						zIndex: 60,
						boxSizing: "border-box",
						padding: "14px",
						borderRadius: "var(--dsw-radius-lg,10px)",
						background: "var(--dsw-alias-bg-overlay)",
						border: "1px solid var(--dsw-alias-border-l1)",
						boxShadow: "0 10px 28px rgba(0,0,0,.18)",
						color: "var(--dsw-alias-label-primary)",
						font: "inherit"
					}
				},
				h(
					"div",
					{ style: { display: "flex", alignItems: "center", gap: "10px" } },
					h("span", { style: { color: "var(--dsw-alias-brand-primary)", display: "flex" } }, h(MarkGlyph, null)),
					h("span", { style: { fontSize: "13px", fontWeight: 600, lineHeight: 1.3 } }, t("card.title"))
				),
				h(
					"div",
					{ style: { marginTop: "4px", fontSize: "9px", fontWeight: 500, letterSpacing: ".06em", opacity: 0.55, lineHeight: 1.4 } },
					t("card.role")
				),
				h(
					"div",
					{ style: { marginTop: "9px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--dsw-alias-label-secondary)" } },
					h("span", { "aria-hidden": "true", style: { width: "6px", height: "6px", borderRadius: "50%", background: "var(--dsw-alias-state-success-primary)", flex: "none" } }),
					t("card.standing")
				),
				h(
					"div",
					{
						style: {
							marginTop: "12px",
							paddingTop: "10px",
							borderTop: "1px solid var(--dsw-alias-border-l1)",
							fontSize: "11px",
							lineHeight: 1.6,
							color: "var(--dsw-alias-label-secondary)"
						}
					},
					t("card.name")
				)
			);
		}

		/**
		 * 侧边栏页脚的「个人工作台」按钮 + 身份卡。
		 * 交互自持：Escape / 点击外部 / 滚动 / 缩放都会收起卡片；监听器在 useEffect 清理函数里摘除。
		 *
		 * @param props - 页脚插槽 owner props（`wide` 表示侧边栏是否为宽栏）；`t` 文案查询。
		 */
		function PersonaAction(props) {
			const wide = props?.wide === true;
			const t = props.t;
			const [open, setOpen] = React.useState(false);
			const [hover, setHover] = React.useState(false);
			const [anchor, setAnchor] = React.useState(null);
			const buttonRef = React.useRef(null);
			const cardRef = React.useRef(null);

			React.useEffect(() => {
				if (!open) return undefined;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				const onPointerDown = (event) => {
					const target = event.target;
					const inCard = cardRef.current !== null && cardRef.current.contains(target);
					const inButton = buttonRef.current !== null && buttonRef.current.contains(target);
					if (!inCard && !inButton) setOpen(false);
				};
				const onReflow = () => setAnchor(anchorOf(buttonRef.current));
				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("mousedown", onPointerDown, true);
				window.addEventListener("resize", onReflow);
				window.addEventListener("scroll", onReflow, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("mousedown", onPointerDown, true);
					window.removeEventListener("resize", onReflow);
					window.removeEventListener("scroll", onReflow, true);
				};
			}, [open]);

			/** 展开时先量一次按钮位置；收起时清掉，避免留下过期坐标。 */
			function toggle() {
				if (open) {
					setOpen(false);
					return;
				}
				setAnchor(anchorOf(buttonRef.current));
				setOpen(true);
			}

			const label = t("action.label");
			const title = t("action.title");
			return h(
				"span",
				{ style: { display: "inline-flex", flex: wide ? "1 1 auto" : "none", minWidth: 0 } },
				h(
					"button",
					{
						ref: buttonRef,
						type: "button",
						className: "wpi-btn",
						title,
						"aria-label": title,
						"aria-haspopup": "dialog",
						"aria-expanded": open,
						onClick: toggle,
						onMouseEnter: () => setHover(true),
						onMouseLeave: () => setHover(false),
						style: {
							display: "inline-flex",
							alignItems: "center",
							justifyContent: wide ? "flex-start" : "center",
							gap: "7px",
							width: wide ? "100%" : "auto",
							minWidth: 0,
							padding: wide ? "4px 8px" : "3px",
							border: "1px solid transparent",
							borderRadius: "var(--dsw-radius-sm,4px)",
							background: open || hover ? "var(--dsw-alias-bg-layer-2)" : "transparent",
							color: "var(--dsw-alias-label-secondary)",
							font: "inherit",
							fontSize: "12px",
							cursor: "pointer",
							transition: "background 120ms ease"
						}
					},
					h(MarkGlyph, null),
					wide ? h("span", { style: { whiteSpace: "nowrap", overflow: "hidden" } }, label) : null
				),
				open ? h("span", { ref: cardRef, style: { display: "contents" } }, h(IdentityCard, { anchor, t })) : null
			);
		}

		const name = PLUGIN_NAME;
		/** 必需的客户端服务：插槽注册表 + 语言字典。 */
		const inject = ["slots", "locale"];

		/**
		 * 客户端插件体：注入样式与字典，只占页脚一个位置。
		 * @param ctx - 客户端根上下文。
		 */
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

			const styleEl = document.createElement("style");
			styleEl.setAttribute("data-dsh-plugin", PLUGIN_NAME);
			styleEl.textContent = CARD_CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			}, `${PLUGIN_NAME}: 样式`);

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
			}, `${PLUGIN_NAME}: locale 字典`);

			// 侧边栏页脚：list 插槽；label 用 thunk 以便跟随语言切换。
			ctx.slots.inject(FOOTER_SLOT, function* () {
				yield ctx.slots.register({ name: FOOTER_SLOT, id: FOOTER_ID, order: 12, label: () => t("action.label") }, (props) =>
					h(PersonaAction, { ...props, t })
				);
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;
		return module.exports;
	}
});

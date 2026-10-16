// 个人工作台「形象」插件 —— 服务端半边。
//
// 空 apply：本包只贡献浏览器端呈现（形象本体 + 两个插槽注册），Node 半边仅需给 Loader
// 提供一个可挂载的条目；浏览器半边通过 exports["./client"] 提供（与 dsh-workbench-brand 同构）。
/** 宿主插件体 —— 本包只提供浏览器端呈现。 */
function apply() {}

export { apply };

# 主节点全空白：离线排查与恢复补丁

日期：2026-11-02（Asia/Shanghai）

版本：v0.4.35。以下为发布前离线排查记录；验证期间 ComfyUI 保持关闭，没有加载或运行用户工作流。

## 现象与判断边界

粉丝截图中节点外框及输入/输出端口存在，但主面板的按钮、提示词框和 LoRA 区全部缺失。这符合“自定义前端面板未正常挂载”的故障类别，不是单纯没安装 LoRA 或没有 WebUI 数据。

仅有截图，没有粉丝的运行环境和浏览器异常信息，因此不能认定其具体触发因素一定是某个 ComfyUI 版本、浏览器或其他插件。以下问题是在仓库代码中独立复现的缺陷，能造成相同的空白/无法恢复状态；不将本地故障注入结果冒充为在粉丝机器上的复现。

## 已复现的代码缺陷

1. `installWebUIPanel` 在调用 `node.addDOMWidget` 前隐藏原生输入控件。DOM API 缺失或抛错时，原生控件已不可见，后面的异常又不在 `buildPanel` 的 try/catch 范围内，留下空框。
2. `isBridgePanelUsable` 与复用分支只检查元素引用和内部子节点，不检查 `isConnected`。DOM 已脱离页面时，仍被判断为健康，复用同一个不可见元素。
3. `removeBridgeDomWidgets` 只移除元素和 widgets 数组项，不调用 DOM widget 的 `onRemove`。本机已安装前端包 1.43.18 的 DOM widget `onRemove` 包含 unregisterWidget，漏掉该清理会保留旧的宿主登记。

原始代码离线执行结果：

```json
{"missingDomApiLeavesNativeHidden":true,"detachedPanelReportedUsable":true,"staleWidgetUnregisterCalls":0}
```

修复后相同检查：

```json
{"missingDomApiLeavesNativeHidden":false,"detachedPanelReportedUsable":false,"staleWidgetUnregisterCalls":1}
```

## v0.4.35 修复

- DOM 控件创建并返回有效面板后，才隐藏原生输入。
- 保存并恢复原生 widget 的原始类型、大小计算、绘制函数、隐藏状态、样式及高度选项；不回滚用户当前的提示词值。
- 新建/工作流加载两条安装路径均捕获异常。失败时清理已创建 DOM、恢复原生输入，并显示不依赖 DOM 的“Bridge 面板加载失败（点此重试）”按钮。
- 错误状态停止自动重复安装；用户点击重试可重新安装，临时按钮不写入工作流参数。
- 已脱离页面的面板不再视为健康或直接复用。异步挂载保留 2 秒宽限，允许一次重建；可见节点持续挂载失败时转原生降级，不无限空白重试。折叠节点不触发这条健康修复。
- 清理 DOM 控件时调用 `onRemove`，解除宿主登记。

## 验证

- `node tools/test_panel_lifecycle.mjs`：正常安装、DOM API 缺失/抛错/返回 null、同步及延后安装、隐藏后的异常恢复、文本值和样式保留、挂载宽限和有界重试、手动恢复、脱离宿主后的重建与注销。
- 拖拽、输入事务及控件批处理专项回归继续通过。
- 35 项 Python 单元测试通过；JavaScript 语法及 Git 差异格式检查通过。
- 未运行完整 ComfyUI 前端/真实工作流，也未在粉丝机器上验证；宿主主题样式或其他插件的独立故障仍属未知。

## 本机依赖核验（静态，不是运行时复现）

- 本机前端包：`comfyui_frontend_package-1.43.18.dist-info`。
- `static/scripts/domWidget.js` 为公开 API 转发 shim；`assets/dialogService-DSBgqcNn.js` 中 `addDOMWidget` 返回带 element 的 DOMWidgetImpl，`onRemove` 调用宿主 unregisterWidget。
- 依赖核验仅覆盖相关局部实现，属于静态证据，未执行整个前端；不据此推断粉丝所用版本或运行轨迹。

v0.4.35 包含本次恢复逻辑。v0.4.34 及更早版本不含此补丁；请先更新节点，启动/重启 ComfyUI，再按 Ctrl+F5 刷新浏览器。不保证解决独立的宿主主题或第三方插件冲突。

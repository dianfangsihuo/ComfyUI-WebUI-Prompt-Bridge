# ComfyUI WebUI Prompt Bridge v0.3.1

这是 `v0.3.0` 之后的提示词面板布局补丁，重点修复节点高度拖拽和 LoRA 卡片区贴底行为。

## 更新内容

- 修复默认布局里 LoRA / Extra Networks 卡片区会挤占提示词区域的问题。默认状态会露出正向 Prompt、正向标签和反向 Prompt，并把 LoRA 卡片区压缩到只露出一行卡片。
- 修复拖动 `提示词 / LoRA` 分隔条时，LoRA 区域会突然跳成“上方一行卡片、下方大片空白”的问题。
- LoRA 区域现在固定贴合节点底部；外壳被拖大时，左侧分类树和右侧卡片网格会同步撑满高度并在内部滚动。
- 优化提示词框拖拽：Prompt 文本框、已输入 tag 区、正向/反向标签区和底部 LoRA 区的分隔条会更稳定地分配高度，双击分隔条仍可恢复默认。
- 反向提示词折叠按钮改成更醒目的 `折叠反向` / `展开反向`。
- 区域控制新增画布尺寸自动跟随/手动填写入口，区域预览比例会跟随工作流里的 latent / image 尺寸。
- 同步更新示例工作流里的 Bridge 节点输入和默认 checkpoint 名称，减少新版本打开时的缺字段和陈旧模型名。
- 更新布局缓存版本，刷新页面后会清理旧的异常高度缓存。

## Comfy Registry

本版本将 `pyproject.toml` 版本更新为 `0.3.1`，并保留现有 `[tool.comfy]` 注册元数据。推送到 `main` 后，仓库中的 `Publish to Comfy Registry` GitHub Action 会触发 Comfy Registry 发布。

## 验证

- Python 编译检查通过：`python -m py_compile nodes.py`
- 前端 ES module 语法检查通过：`node --check web/webui_prompt_bridge.js`
- 工作树内容检查通过：`git diff --check`

## 升级提示

更新后请重启 ComfyUI，并强制刷新浏览器页面，确保前端扩展脚本和新的布局缓存版本生效。

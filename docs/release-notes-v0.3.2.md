# ComfyUI WebUI Prompt Bridge v0.3.2

这是 `v0.3.1` 之后的节点缩放补丁，重点修复右下角 `↘` 箭头拖动和 LoRA 卡片区联动。

## 更新内容

- 修复右下角 `↘` 节点缩放手柄只改变节点外壳、LoRA 卡片区不跟随变高的问题。
- 拖动右下角箭头现在会缩放整个 Bridge 节点，并同步调整 LoRA / Extra Networks 区域高度。
- 右下角缩放手柄改成更大的蓝色高亮按钮，带明显角标和 hover 状态，更容易看到和抓取。
- 节点整体缩放会按当前 ComfyUI 画布缩放比例换算，画布不是 100% 时拖动距离也更接近鼠标手感。
- 节点最大高度限制调整为 `3200`，既允许手动拉成长节点浏览 LoRA，也避免大量 LoRA 自动把节点撑到极端高度。
- 保留 LoRA 卡片区最小一行高度、底部锚定和内部滚动行为，防止再次出现底部大片空白。

## Comfy Registry

本版本将 `pyproject.toml` 版本更新为 `0.3.2`，并保留现有 `[tool.comfy]` 注册元数据。推送到 `main` 后，仓库中的 `Publish to Comfy Registry` GitHub Action 会触发 Comfy Registry 发布。

## 验证

- Python 编译检查通过：`python -m py_compile nodes.py`
- 前端 ES module 语法检查通过：`node --check web/webui_prompt_bridge.js`
- 工作树内容检查通过：`git diff --check`

## 升级提示

更新后请重启 ComfyUI，并强制刷新浏览器页面，确保前端扩展脚本和新的布局缓存版本生效。

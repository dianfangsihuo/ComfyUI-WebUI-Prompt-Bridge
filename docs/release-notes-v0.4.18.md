# ComfyUI WebUI Prompt Bridge v0.4.18

本次更新继续修复 Bridge 面板布局恢复和本地缓存冲突问题，建议所有 v0.4.x 用户更新。

## 更新内容

- 修复 workflow 已保存展开布局时，被旧 localStorage 折叠状态覆盖，导致反向提示词折叠、LoRA 区上移的问题。
- 用户在当前 workflow 里刚调整过的折叠状态、分区高度和侧栏状态，刷新页面后仍会保留。
- `恢复尺寸` / `默认尺寸` 会重新套用当前布局预设的内部高度分配，避免节点恢复到 1180 高后底部留下大空白。
- 增加真实浏览器回归检查，覆盖旧本地折叠状态不能覆盖 workflow 保存布局的场景。

## 验证

- `node --check web/webui_prompt_bridge.js`
- `node --check tools/verify_frontend_compat.mjs`
- `D:/ai/ComfyUI-aki-v1.6/ComfyUI-aki-v1.6/python/python.exe -m py_compile nodes.py`
- `node tools/verify_frontend_compat.mjs --url=http://127.0.0.1:8188`
- `git diff --check`

## 升级说明

更新后请重启 ComfyUI，并强制刷新浏览器页面。

本版本会同步发布到 ComfyUI Registry，包版本为 `0.4.18`。

# ComfyUI WebUI Prompt Bridge v0.4.27

本次更新先完成三项与收藏性能无关的修复：

- 模型下拉现在可以选择 `diffusion_models` 中的分体 UNET。切换时只修改当前 Bridge 能唯一定位的 `UNETLoader`，不会自动替换 Text Encoder、VAE、节点或连线。
- 主节点新增从 PNG/JPEG/WebP 读取 Prompt 的入口。ComfyUI 图片可读回 Bridge 正反 Prompt，A1111 parameters 可作为回退；确认前不会覆盖当前内容。
- 多行 Tag 可按实际视觉行精确拖放，主节点支持 Ctrl 多选整体移动，主节点和提示词小节点都支持前移/后移按钮及 `Alt+←/→`。

本版本不包含收藏分页、索引缓存或收藏列表性能改写，现有收藏文件格式保持不变。

仓库同时新增中文贡献指南、Bug/性能/功能 Issue 模板、PR 检查清单和基础自动测试，方便社区提交范围清楚、可复现并可回归验证的修复。

更新后请重启 ComfyUI，并在浏览器中按 `Ctrl+F5` 强制刷新。分体 UNET 会沿用当前 Text Encoder/VAE，请自行确认三者架构兼容。

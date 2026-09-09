# v0.4.31｜Anima 区域控制兼容修复

把 WebUI 式提示词体验带进 ComfyUI：中文翻译、Tag 自动补全、LoRA 管理和区域提示词控制，都放在一个工作台里。

## 这次修复了什么？

如果普通生成正常，但一开区域控制，KSampler 就报 `tuple index out of range`，这次更新就是针对这个问题。

Bridge 现在会根据模型自动生成对应维度的区域参数，适配 Anima 的三维 latent，并保留 SDXL 原有的二维逻辑。正、负区域提示词都已处理，不需要增加节点或修改接线。

## 已做哪些验证？

- Anima：横分区、网格分区、Base 提示词、四图批量、1.5 倍放大后二采。
- SDXL：区域生成和二次采样。
- FaceDetailer：实际检测并精修两张人脸，再接 SeedVR2 3B 放大至 1024。
- 裁剪图重新编码、DifferentialDiffusion 采样。
- 24 项单元测试，以及 ComfyUI 0.33.0 区域解析函数测试。

以上生图测试使用本地 ComfyUI 0.20.1 和 Anima baseV10，并非所有模型与插件组合均已测试。WAI-ANIMA 的具体权重、完整 ComfyUI 0.33.0 环境及 SeedVR2 7B 高分辨率链路仍需各自环境验证。

## 怎么更新？

通过 ComfyUI Manager 更新本插件，或在插件目录执行 `git pull`。更新后**重启 ComfyUI**，并按 `Ctrl+F5` 刷新页面，再运行原工作流。

注意：区域之间的明显接缝不是本次修复范围；Anima 也需要搭配对应架构的 LoRA，不能靠此更新解决不匹配的 LoRA 权重。

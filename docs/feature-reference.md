# WebUI Prompt Bridge 完整功能说明

这份文档按用户实际能看到和使用的功能整理 `WebUI Prompt Bridge`。插件当前包含一个提示词主工作台、两个提示词小节点、一个图片输入节点，以及一组用于 ControlNet、ADetailer、Inpaint、Mask 和放大的辅助节点。

## 1. 提示词编辑工作台

- 正向、反向 Prompt 使用页签切换，也可以折叠反向区域。
- 支持普通文本和 WebUI 式 Tag 分块编辑。
- Tag 可点击编辑、删除、禁用、复制、收藏和单独中译英。
- 可用括号、方括号、数值框或 `±0.1` 调整权重。
- 保留原 Prompt 的换行；换行会显示为可操作的“换行符”卡片。
- 支持多行二维拖放定位、`Ctrl` 多选整体移动，以及按钮或 `Alt+←/→` 前后微调。
- Prompt 工具提供清空、正反交换、完整大编辑器和推荐词补全。
- 可从剪贴板解析 A1111 / WebUI generation parameters。
- 提交生成前会检查空数字参数、正反 Prompt 放反、LoRA 模型链路未连接和常见悬空连接。

## 2. 自动补全和翻译

- 安装包自带完整 Danbooru 主 Tag、中文解释和热度，离线且没有 WebUI 时也能补全。
- 可接入 TagComplete，并通过“全库搜索”查询大词库，不需要把十几万条 Tag 全部渲染到页面。
- 补全结果可显示英文 Tag、中文解释、热度和 Tag 类型。
- 支持关键词翻译和整段 Prompt 翻译。
- 翻译来源支持自动选择、WebUI Prompt All in One、在线翻译、AI 接口和内置词库。
- AI 翻译支持 OpenAI 兼容接口，可配置 Base URL、模型、API Key 和系统提示，能读取上游 `/models` 并执行保存/测试。

## 3. 分类词库、历史、收藏和市场

- 支持 Prompt All in One 一级/二级分类、分类内搜索和全库搜索。
- 正向、反向 Prompt 各自保存历史，可读取最近历史和清空历史。
- 收藏支持父分类、子分类、分类排序、重命名、删除和拖放归类。
- 支持把多选 Tag 批量收藏或批量移入分类。
- 2000 条以上收藏仍会先全库搜索再分页；每页显示 100 条。
- 可手动新增、修改和删除自定义 Tag，也可导入 JSON、CSV、TSV。
- “清空自定义/市场”只删除本地导入和市场词，不删除 WebUI 原词库及收藏。
- 主节点与正向/反向提示词小节点共用词库，修改后会刷新已展开的词库面板。
- 提示词市场提供 Prompt All in One、Danbooru、Danbooru + e621、e621 SFW、Derpibooru、质量词、画风/媒介、Krea 艺术与摄影案例等可导入来源，并提供 PromptHero、Civitai、Lexica、OpenArt、DiffusionDB 等案例入口。

## 4. Styles 起手式

- 读取和写入 WebUI `styles.csv`。
- 可把 Style 套入当前正反 Prompt。
- 可从当前 Prompt 识别并提取已套用的 Style。
- 支持新建、编辑、覆盖和删除 Style，并兼容 `{prompt}` 占位符。

## 5. LoRA / LyCORIS

- 识别 `<lora:name:weight>`、`<lyco:name:weight>`，也支持分别填写 model/CLIP 权重。
- 后端会真正调用 ComfyUI LoRA 加载逻辑，并从最终送入文本编码器的 Prompt 中移除 LoRA 标签。
- 检测上游已经加载的 LoRA，避免重复加载。
- 可选择 LoRA 缺失时停止生成，并会提示 Bridge 的 `model` 输出是否真正进入采样器链路。
- 显示 LoRA 已匹配、缺失或可能与当前模型家族不兼容。
- 可读取触发词并快速加入 Prompt。
- LoRA/LyCORIS 卡片库支持名称搜索、文件夹、分类、模型版本、整理状态、路径/名称/日期排序、分页和批量加入正向 Prompt。
- 可读取 safetensors metadata、训练 Tag、模型版本、说明、触发词、推荐权重、正反辅助词和备注。
- 可编辑 LoRA 用户 metadata、手动分类并替换预览图。

> LoRA 要影响出图，必须让 Bridge 输出的 `model` 进入采样器实际使用的模型链路。只看到“LoRA 已匹配”不代表采样器一定用了它。

## 6. 加入图片并读取图片提示词

主节点顶部的 **“读图提示词”** 用于从以前生成的图片中找回 Prompt：

1. 点击“读图提示词”，选择一张 PNG、JPEG 或 WebP 图片。
2. Bridge 读取图片原始 metadata，而不是根据文件名猜测。
3. 图片中有多个 Bridge 或提示词小节点时，会保留多个候选供选择。
4. 可以只覆盖正向、只覆盖反向，或同时覆盖两者。
5. 选择候选和覆盖方向后还要确认，当前 Prompt 不会被静默替换。

支持读取 ComfyUI workflow/prompt metadata 中的 Bridge 正反 Prompt，也兼容 A1111 / WebUI `parameters` 回退。空反向 Prompt 会被原样保留。

这个功能只恢复提示词，**不会恢复模型、Seed、采样器、工作流节点或连线**。

### 和图生图的区别

- **读图提示词**：读取图片 metadata，把其中的正反 Prompt 找回来；不需要连接 VAE Encode 或 KSampler。
- **图生图 / 局部重绘**：把图片像素作为生成输入；必须把 Bridge 的 image/mask 接入采样 latent 链路，或使用“一键接入图生图链路”。

## 7. 模型切换和生成参数

- 模型列表同时显示整合 Checkpoint 和 `diffusion_models` / UNET。
- 切换整合 Checkpoint 时使用 `CheckpointLoaderSimple` 链路。
- 切换分体 UNET 时，只修改当前 Bridge 能安全定位的唯一 `UNETLoader.unet_name`；Text Encoder、VAE、节点和连线保持不变。
- 无法唯一定位 UNETLoader 时会拒绝切换，不会批量修改工作流。
- 提供 Anima“极速模式”和“纯模型质量”快捷配置。
- 生成参数面板可分别接管宽高、Steps、Seed 和固定/递增/递减/随机 Seed 模式。
- 读取/应用参数时会优先处理真实上游常量；没有上游常量时使用 Bridge 内置值。

## 8. 区域提示词

- 支持用 `BREAK` 组织 Matrix 区域 Prompt。
- 支持竖向、横向和网格切分，自定义区域比例、Base、Common、Base 比例和区域强度。
- 可自动检测工作流画布尺寸，也可以手动设置区域画布宽高并查看预览。
- 区域表格可编辑并回写 `BREAK` 文本。
- Negative Common 可合并到每个反向区域。
- 支持区域顺序/比例翻转，以及区域 Preset 保存和加载。
- 可把可选 `MASK` 输入写入 conditioning，并设置强度和采样边界。

## 9. 图生图和局部重绘

- 可在主节点侧栏或独立 `WebUI Bridge Image Input` 节点上传 PNG、JPEG、WebP。
- 支持独立 Mask、原图 Alpha Mask、`img2img` / `inpaint` 模式和 denoise。
- 内置涂抹 Mask 编辑器，可清空或保存 Mask。
- 主节点输出 `image`、`mask`、`img2img_denoise` 和 `img2img_mode`。
- “一键接入图生图链路”会尝试创建/连接 VAE Encode 或 Inpaint Conditioning，并把 latent 接到 KSampler。

> 只上传图片不会自动影响生成。请检查 KSampler 的 `latent_image` 是否已经由 VAE Encode、VAE Encode For Inpaint 或相应 Bridge 辅助节点接管。

## 10. 高级模块

### ADetailer

- 配置脸、手、人物检测模型、置信度、重绘强度、Mask 模糊、循环次数和仅重绘 Mask 区域。
- 独立设置细节修复正反 Prompt，并提供脸部、手部模板。
- `WebUI Bridge Apply ADetailer` 会调用 Impact Pack `FaceDetailer` 真正输出修复图和 Mask。
- 支持一键构建节点、自动连接已知 Bridge 输出和还原上次构建。

### ControlNet

- 保存预处理器、模型、权重、起止区间、Resize、控制模式和 Pixel Perfect 参数。
- 提供 Canny、OpenPose 模板。
- `WebUI Bridge Apply ControlNet` 会把控制信息真正写入正反 conditioning。
- 一键构建后，CONTROL_NET 模型和控制图仍需要由工作流提供。

### SAM / Inpaint

- 保存 SAM 模型、提示模式、置信度、Mask 模糊/扩张、重绘强度、范围和 Padding。
- 可构建 Set Latent Mask 和 Inpaint Conditioning 接入节点。
- 不会猜测或自动创建第三方 SAM Loader/分割节点；应先由已安装的 SAM 插件输出 MASK。

### 放大 / Hires.fix

- 支持 Hires.fix、Latent Upscale、Ultimate SD Upscale 和 Tile 参数模式。
- 可设置倍率、算法、二次采样步数、denoise、Tile 宽高及 overlap。
- 内置 Image Upscale、Latent Upscale 节点，并可构建 Latent Upscale + 二次 KSampler 链路。
- Ultimate/Tiled 选项只保存参数，不会伪装成已连接完成的第三方分块放大流程。

### 区域 LoRA 审计

- 统计区域 Prompt 中出现的全局 LoRA。
- 它不会把 LoRA 隔离到单独区域；严格区域 LoRA 需要多分支、Mask 和最终合成。

## 11. 布局和新手引导

- 侧栏分为模型、生成、图生图、模块四个页签，可隐藏侧栏露出 ComfyUI 端口。
- 支持拖拽或数值调整节点宽高，Prompt、Tag、反向词、词库和 LoRA 区域高度均可独立调整，分隔条双击可恢复默认。
- 提供默认、紧凑、宽松、正向撰写优先、极简 LoRA 五种布局。
- 提供起步、推荐、全部三种显示方案，也可逐项隐藏顶部按钮、Styles、区域和高级模块。
- 可调整 Tag 显示、LoRA 卡片大小、字体和低缩放摘要阈值。
- 布局、折叠状态和区域高度会随工作流或本地设置恢复。
- 提供首次启动向导和首次/每次/关闭三种新建节点教程模式。

## 12. WebUI 接入和资源管理

- 没有 WebUI 时可直接使用随包内置词库，也可下载本地完整数据包。
- 可自动检测 WebUI 根目录，或从 `models/Lora` 等子目录反推根目录。
- 一键接入 Prompt All in One、TagComplete、`styles.csv`、LoRA、Checkpoint、UNET、VAE、Embedding、ControlNet、放大模型和 Hypernetwork 路径。
- 可按需补齐 WebUI 扩展，也可按卡片安装 Impact Pack、Impact Subpack、ControlNet Aux、SAM 和 Ultimate SD Upscale。
- 高级模块状态会区分可用、部分可用、缺少资产和仅审计，不会把预处理器误报成 ControlNet 模型。

## 13. 全部节点

| 节点 | 用途 |
| --- | --- |
| `WebUI Prompt Bridge` | 主提示词工作台、LoRA、区域 conditioning、图片和模块配置输出 |
| `WebUI Bridge Positive Prompt` | 正向提示词小工作台；可选连接 model/clip 后真正加载 LoRA |
| `WebUI Bridge Negative Prompt` | 反向提示词小工作台和字符串输出 |
| `WebUI Bridge Image Input` | 上传图片/Mask，输出图生图或局部重绘参数 |
| `WebUI Bridge ADetailer Config` | 从 `module_config` 提取 ADetailer 设置 |
| `WebUI Bridge ControlNet Config` | 从 `module_config` 提取 ControlNet 设置 |
| `WebUI Bridge SAM/Inpaint Config` | 从 `module_config` 提取 SAM/Inpaint 设置 |
| `WebUI Bridge Upscale Config` | 从 `module_config` 提取放大设置 |
| `WebUI Bridge Apply ControlNet` | 将 ControlNet 应用到正反 conditioning |
| `WebUI Bridge Image Upscale` | 按 Bridge 放大设置缩放 IMAGE |
| `WebUI Bridge Latent Upscale` | 按 Bridge 放大设置缩放 LATENT |
| `WebUI Bridge Set Latent Mask` | 把 Mask 写入 LATENT noise mask |
| `WebUI Bridge ADetailer Conditioning` | 为细节修复准备独立正反 conditioning |
| `WebUI Bridge Apply ADetailer` | 调用 Impact Pack 执行目标区域细节修复 |
| `WebUI Bridge Inpaint Conditioning` | 准备 Inpaint conditioning、latent 和 denoise |

## 14. 一键构建的能力边界

1. 显示高级模块面板不等于模块已经启用，也不等于依赖和模型已经安装。
2. 一键构建只连接 Bridge 能确定的输出；图片、VAE、Mask、CONTROL_NET 模型等工作流专属输入可能仍需手动连接。
3. 已被占用的输入不会被静默覆盖，构建结果会报告已创建节点、已连接线路和待接输入。
4. 构建后可以使用“还原上次构建”删除新建节点并尽量恢复原连线。

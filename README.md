# ComfyUI WebUI Prompt Bridge

![ComfyUI WebUI Prompt Bridge workflow](docs/images/webui-prompt-bridge-workflow.png)

## 中文介绍

**ComfyUI WebUI Prompt Bridge** 是一个给 ComfyUI 使用的 WebUI 式提示词工作台。它把 WebUI 里顺手的提示词输入、Tag 编辑、中文翻译、自动补全、收藏、负面词管理、LoRA 浏览/加载、Styles 和区域提示词控制搬进 ComfyUI，让复杂工作流也能拥有接近 WebUI 的提示词操作体验。

很多人用 ComfyUI 时会遇到两个问题：

- ComfyUI 的普通文本框适合连接节点，但不适合大量编辑 Tag。
- WebUI 的提示词体验很好，但工作流能力不如 ComfyUI 灵活。

这个节点就是把两边的优点合到一起：**ComfyUI 负责工作流，WebUI Prompt Bridge 负责提示词、LoRA、区域控制和常用生成助手**。

从 v0.4.0 开始，Bridge 默认界面会保持更干净：基础提示词、模型切换、尺寸快捷、布局预设和 LoRA 浏览区会直接显示；区域控制、Styles、ADetailer、ControlNet、SAM/Inpaint、Mask 和放大修复等功能可以在 `设置` 里按需显示。需要高级链路时，侧栏会提供 `一键构建...节点` 按钮，自动创建对应外置节点并连接 Bridge 已知输出。

新用户可以先从中文最小工作流教程开始：`docs/tutorial-minimal-workflows.md`。教程分别演示 Anima 分体模型、XL 整合 checkpoint 和 XL 图生图的最小接线，并配有截图和可直接拖入 ComfyUI 的 JSON 工作流。

## v0.4.4 补丁更新

这一版主要修复节点界面稳定性，适合所有已经升级到 v0.4.x 的用户直接更新。

- 修复在 ComfyUI `设置 - 布局/显示` 里切换布局尺寸后，WebUI Prompt Bridge 主节点可能不停闪烁的问题。
- 切换 `默认 / 紧凑 / 宽松 / 正向聚焦 / 极简 LoRA` 布局时，节点尺寸会更稳定，不再反复自动重排。
- 优化节点操作手感：顶部按钮、尺寸快捷、布局预设和拖拽分隔条更容易点击，右下角整体缩放手柄拖动反馈更明显。
- 布局预设按钮在窄侧栏里会自动换行，避免文字和按钮挤在一起。
- 更新后请重启 ComfyUI，并强制刷新浏览器页面，让新的前端脚本生效。

## v0.4.2 补丁更新

这一版主要修复多人提示词编辑时的换行格式问题，适合已经升级到 v0.4.x 的用户直接更新。

- 提示词 tag 编辑现在会保留原来的换行/空行分隔，删除、拖拽、改权重后不会把多人提示词压成一行。
- tag 分块里会把换行显示成独立的 `↵ / 换行符` 分块，方便看清提示词结构。
- 点击 `换行符` 分块可以删除该换行；tag 工具条里的 `↵` 按钮会真正把当前位置改成换行分隔。
- 已实测通过 `WebUIPromptBridge` 节点提交多组带真实换行的多人提示词，ComfyUI 历史记录中 `positive_prompt` 保留 `\n`，并成功生成多人图。

## v0.4.1 补丁更新

这一版主要修复高级放大修复的实际使用体验，适合已经升级到 v0.4.0 的用户直接更新。

- 修复一键构建放大节点后“能放大但画面变糊”的问题：Hires.fix 现在会自动插入第二个 KSampler，对放大后的 latent 做二次采样。
- 放大修复默认改为更清晰的参数：`nearest-exact`、`steps = 18`、`denoise = 0.48`。
- 如果检测到旧版偏糊的 Hires.fix 默认值，一键构建会自动升级为清晰优先参数。
- 高级模块的一键构建增加“还原上次构建”，不用高级功能时可以删除自动创建的外置节点并恢复原来的连接。
- 构建失败或无法自动接线时，会提示应该手动连接的位置，避免用户以为功能已经生效。

如果你的旧工作流已经保存过旧版放大节点，建议先点 `还原上次构建`，或手动删除旧的 `Latent Upscale / Hires.fix KSampler` 后重新构建。

## v0.4.0 更新说明

这一版是一次较大的功能更新，重点是把 Bridge 从“提示词编辑节点”升级成更完整的“功能助手侧栏 + 提示词工作台”。

- 默认界面更清爽，只保留基础生成、模型切换、尺寸快捷、布局预设和 LoRA 浏览区。
- 设置窗口改为更宽、更清楚的分组设置中心，可以控制每个侧栏功能是否显示。
- 区域提示词、区域 conditioning、负向 Common、区域翻转和区域 Preset 变成主节点内置能力。
- ADetailer、ControlNet、SAM/Inpaint、Mask 区域和放大修复作为高级模块按需显示，并支持一键构建外置节点。
- 一键构建会提示自动连接数量；遇到接口被占用、节点缺失或后端未加载时，会给出明确原因。
- 推荐工作流和 3 个最小实例工作流已经同步到新版 Bridge 节点结构。

升级后请重启 ComfyUI，并强制刷新浏览器页面，让新的前端脚本、节点搜索别名和布局缓存生效。

完整更新记录见 `CHANGELOG.md`。

## 节点特写

![WebUI Prompt Bridge node close-up](docs/images/webui-prompt-bridge-node-panel.png)

这个节点不是普通的大文本框，而是一个完整的提示词操作面板。新版面板把 Prompt、反向词、模型切换、LoRA 卡片库、布局预设、区域控制入口和高级模块助手集中到一个节点里：

- 可以直接输入中文自然语言，并自动翻译成更适合模型的英文提示词。
- 可以把提示词拆成一个个标签块，方便编辑、删除、禁用、复制、加权和拖拽排序。
- 可以像 WebUI 一样浏览分类标签，例如人物、服饰、表情、动作、画面、环境、负面词等。
- 可以收藏常用提示词，也可以读取历史记录。
- 可以读取 WebUI 的 `styles.csv` 样式。
- 可以接入 WebUI 的 Prompt All in One 和 TagComplete 数据。
- 可以识别 `<lora:name:weight>`，检查 LoRA 是否存在，并真正应用到 ComfyUI 的 model / clip 链路里。
- 可以在节点内直接浏览 LoRA / LyCORIS 卡片库，按文件夹、分类、模型版本和整理状态过滤。
- 可以读取 LoRA 预览图、训练 metadata、触发词、推荐权重、说明和手动分类，并在卡片里快速插入。
- 可以在面板右侧切换分体 Anima/Qwen 或整合 checkpoint，并在提交生成前做常见参数检查。
- 可以按需显示区域表格、负向 Common、区域翻转和区域 Preset，不需要先额外添加一串区域控制节点。
- 可以按需显示 ADetailer、ControlNet、SAM/Inpaint、Mask 和放大修复模块，并一键构建可接入工作流的外置节点。

## 主要功能

- **中文自动翻译**：输入中文后可以转成英文提示词，适合不想手写英文 Tag 的用户。
- **WebUI 式标签编辑**：提示词以标签块显示，可视化操作比纯文本更直观。
- **自动补全**：输入字母时可以根据 TagComplete 词库提示可用 Tag。
- **收藏提示词**：常用角色、服装、画风、表情、动作可以收藏起来反复使用。
- **负面词管理**：正向提示词和反向提示词都可以分块编辑。
- **LoRA 真实加载**：不是只把 LoRA 文本塞进 prompt，而是解析 LoRA 标签后调用 ComfyUI 的 LoRA 加载逻辑。
- **LoRA 缺失提醒**：找不到 LoRA 时可以直接报错，避免你以为 LoRA 生效了但其实没用。
- **LoRA 卡片管理**：读取本地 LoRA 预览图和 safetensors metadata，支持搜索、分类、整理状态、触发词和推荐权重。
- **模型快速切换**：在 Bridge 面板里选择分体 Anima/Qwen 或任意整合 checkpoint，减少在复杂工作流里来回找节点。
- **区域控制内置**：区域提示词、区域 conditioning、区域表格、负向 Common、区域翻转和区域 Preset 都在主节点里配置，不需要先额外添加一串模块节点。
- **样式和布局内置**：尺寸快捷、布局预设和显示/隐藏设置默认放在主节点侧栏里；Styles 起手式可在设置里按需显示。
- **生成前检查**：提交前检查空数字参数、Prompt/Negative 放反、悬空连接等常见问题，并尽量自动修复。
- **WebUI 数据桥接**：可以复用本机 WebUI 扩展里的标签、收藏、翻译配置和样式。

## 推荐工作流

仓库里已经带了一个推荐工作流：

```text
workflows/anima-webui-prompt-bridge.json
```

这个工作流是围绕 Anima / Qwen 图像模型整理的完整生图工作流，不只是一个单节点示例。它把提示词编辑、模型加载、LoRA、高清放大、脸部修复、手部修复、姿势控制、参考图控制和多种输出方式放在了一张图里。

如果你只想学习节点的最小接线，可以先看中文教程：

```text
docs/tutorial-minimal-workflows.md
```

教程里提供了三个最小工作流：

- `workflows/tutorial-minimal-anima-webui-prompt-bridge.json`：Anima 分体模型示例。
- `workflows/tutorial-minimal-xl-webui-prompt-bridge.json`：XL 整合 checkpoint 示例。
- `workflows/xl-img2img-webui-prompt-bridge.json`：最小图生图示例，使用 `LoadImage -> VAEEncode -> KSampler`，默认 `denoise = 0.45`，适合在保留原图构图的同时按 Prompt Bridge 提示词重绘。

### 工作流包含什么

- **提示词主控节点**：用 WebUI Prompt Bridge 管理正向词、反向词、翻译、收藏、样式和 LoRA。
- **Anima 分体模型加载**：默认使用 `UNET + CLIP + VAE` 的 Anima/Qwen 分体结构。
- **整合模型切换**：也可以切到 `CheckpointLoaderSimple`，使用普通整合 checkpoint。
- **高清重绘**：支持 latent 放大后二次采样。
- **面部修复**：可选开启 Face Detailer。
- **手部修复**：可选开启 Hand Detailer，并且可以调检测阈值。
- **模型超分**：支持 RealESRGAN 等超分模型。
- **后期尺寸控制**：支持倍率缩放、目标总像素、固定宽高输出。
- **参考图控制**：可以接入参考图，引导画面风格或构图。
- **姿势控制**：支持 DWPose / OpenPose / Canny / Lineart 等预处理分支。

## 模型切换说明

![Anima workflow model switch](docs/images/anima-model-switch-panel.png)

工作流里有一个模型模式开关：

```text
模型模式：分体Anima/Qwen ON，关闭=整合Checkpoint
```

它的含义是：

- **开关 ON**：使用 Anima/Qwen 分体模型，也就是 `UNET + CLIP + VAE`。这是推荐默认模式，适合当前 Anima 工作流。
- **开关 OFF**：使用普通整合 checkpoint，也就是 `CheckpointLoaderSimple`。适合 SD1.5、SDXL、Pony、Illustrious、Qwen-Rapid-AIO 这类整合模型。

已验证：

- 分体 Anima/Qwen 模式可以正常生成。
- 整合 Checkpoint 模式可以用 `waiANINSFWPONYXL_v60.safetensors` 正常生成。
- 从分体 Anima/Qwen 切回整合 XL 后再次生成也正常。

注意：切到普通 SDXL / Pony / Illustrious checkpoint 时，需要关闭参考图、Qwen Union 姿势控制等 Qwen 专用分支，避免编码器或模型结构不兼容。

## 需要准备的模型

推荐工作流默认会用到这些文件名：

- `anima_baseV10.safetensors`
- `anima_baseV10_txt.safetensors`
- `qwen_image_vae.safetensors`
- `RealESRGAN_x4plus_anime_6B.pth`
- 可选整合模型：`Qwen-Rapid-AIO-NSFW-v16.safetensors`
- 可选姿势 LoRA：`qwen_image_union_diffsynth_lora.safetensors`
- 可选 DWPose 检测器：`yolox_l.torchscript.pt`

仓库**不包含任何模型、LoRA、VAE、放大模型或检测器文件**。你需要自己下载并放到 ComfyUI 对应模型目录里。发布或分享工作流时也要注意每个模型自己的授权协议。

## 安全注意事项

这个节点会读取本机 WebUI/ComfyUI 的样式、提示词词库、LoRA metadata 和预览图，也会在用户主动操作时写入 `config.local.json`、`styles.csv`、Prompt-All-in-One storage 以及 LoRA 旁边的 metadata/preview 文件。请只接入你信任的 WebUI 目录，不要把未加认证的 ComfyUI 暴露到公网或不可信局域网。

后端接口会拒绝跨来源写请求，并限制上传图片类型、预览图大小和文本字段长度；如果你通过反向代理部署 ComfyUI，请确保代理正确传递 `Host`、`Origin` 或 `Referer` 头。

## 安装方法

### 方法一：ComfyUI-Manager 安装

本节点已经注册到 Comfy Registry，节点 ID 为：

```text
comfyui-webui-prompt-bridge
```

在 ComfyUI-Manager 中搜索下面任意关键词：

```text
ComfyUI WebUI Prompt Bridge
```

```text
comfyui-webui-prompt-bridge
```

点击安装并重启 ComfyUI。

### 方法二：通过 Git URL 安装

如果 ComfyUI-Manager 的本地索引还没有刷新，可以在 Manager 里使用 `Install via Git URL`，填入：

```text
https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge.git
```

安装完成后重启 ComfyUI。

### 方法三：手动安装

把仓库克隆到 `ComfyUI/custom_nodes`：

```bash
git clone https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge.git
```

如果你的 ComfyUI 环境缺依赖，再安装：

```bash
pip install -r ComfyUI-WebUI-Prompt-Bridge/requirements.txt
```

重启 ComfyUI 后，在节点菜单里添加：

```text
conditioning/webui -> WebUI Prompt Bridge
```

Registry 页面：

```text
https://registry.comfy.org/nodes/comfyui-webui-prompt-bridge
```

## 推荐使用步骤

1. 安装这个自定义节点。
2. 在 ComfyUI 里导入 `workflows/anima-webui-prompt-bridge.json`。可以直接把 JSON 拖进 ComfyUI 页面，也可以用菜单里的 `Load` 打开。
3. 按上面的模型列表放好模型文件。
4. 先保持模型模式开关为 ON，跑默认 Anima/Qwen 分体模式。
5. 在 WebUI Prompt Bridge 节点里输入中文或英文提示词。
6. 使用翻译、标签补全、收藏和分类标签整理提示词。
7. 如果提示词里写了 `<lora:name:weight>`，确认 LoRA 名字能被匹配到。
8. 需要一次移动多个提示词标签时，按住 `Ctrl` 点选多个标签，再拖动其中一个被选中的标签即可一起排序。
9. 需要更高清时再开启 HiRes、Face Detail、Hand Detail、Model Upscale。
10. 需要姿势或参考图时再打开对应开关。
11. 如果想换普通 checkpoint，把模型模式开关关掉，然后在备用整合模型节点里选择 checkpoint。

## 接入本机 WebUI 数据

没有本机 WebUI 也可以先使用节点。首次打开时可以在启动向导里选择 `使用内置数据`，节点会提供基础提示词分类、补全、常用反向词和简单中英映射；也可以选择 `导入词库`，从 JSON / CSV / TSV 导入自己的 tag 映射。

如果你没有 WebUI，但想要更完整的 Prompt All in One / TagComplete 词库，可以在节点右侧点 `设置` -> `下载本地数据包`。节点会把配套数据下载到本插件自己的 `data` 目录，并自动切到可用的数据来源，不需要安装 A1111 或 Forge。

默认情况下，Bridge 主节点只显示基础提示词操作、模型切换、尺寸快捷、布局预设和 LoRA 浏览区，侧栏会尽量保持清爽。Styles、区域控制、区域表格、负向 Common、区域翻转和区域 Preset 都是主节点内置能力，不需要额外添加模块节点；需要时可以在 `设置` 里打开显示。ADetailer、ControlNet、SAM、Ultimate SD Upscale 这类会涉及图片、Mask 或二次处理链路的功能仍作为高级扩展按需打开和下载。

高级扩展模块打开显示后，侧栏里会出现 `一键构建...节点` 按钮。点击后会在 Bridge 主节点右侧自动创建对应外置节点，并连接 `module_config`、`positive`、`negative`、`model`、`clip` 等 Bridge 已知输出。图片、VAE、Mask、ControlNet 模型这类必须由工作流提供的输入，仍需要按当前工作流手动接上。

如果你想要更接近 WebUI 的体验，可以连接你本机的 AUTOMATIC1111 WebUI 目录。推荐安装这两个 WebUI 扩展：

- `sd-webui-prompt-all-in-one`
- `a1111-sd-webui-tagcomplete`

最简单的方法：在节点右侧点击 `一键接入 WebUI`，只选择或填写 WebUI 根目录，例如 `H:/sd-webui-aki-v4.9`。节点会自动接入 `styles.csv`、Prompt All in One、TagComplete、LoRA、checkpoint、VAE、embeddings、ControlNet 等常用数据，不需要用户自己找 CSV 或复制多个路径。

如果你已经有 WebUI，并且 WebUI 里已经装了这两个扩展，不需要下载任何东西，直接 `一键接入 WebUI` 即可。只有 WebUI 缺少扩展时，才需要在 `一键接入 WebUI` 窗口点 `补齐缺失扩展`，或在 `设置` 里点 `补齐 WebUI 扩展`。节点会下载缺失项：

- `https://github.com/Physton/sd-webui-prompt-all-in-one`
- `https://github.com/DominikDoom/a1111-sd-webui-tagcomplete`

已存在的扩展会自动跳过，不会重复下载。安装到 WebUI 的 `extensions` 后，Bridge 会立即刷新可用词库；如果也想在 WebUI 页面里使用这些扩展，重启一次 WebUI。

如果你想在 ComfyUI 里用上修脸、修手、局部重绘、ControlNet、SAM 或放大修复这些能力，也可以在 `设置` 里按卡片单独下载对应扩展：`Impact Pack`、`Impact Subpack`、`ControlNet Aux`、`SAM`、`Ultimate SD Upscale`。这些扩展也是按需下载，不会默认一次全装；装完后重启 ComfyUI，就能继续使用对应功能。`ADetailer` 主要用于脸部、手部和人物局部修复，属于常见的细节增强工具。

![One-click WebUI auto detection](docs/images/webui-one-click-auto-detect-success.png)

看到 `WebUI: ... (9/9)` 就表示接入成功。接入后会立即刷新提示词、样式、LoRA 和模型列表。如果按钮提示“后端接口未加载”，重启一次 ComfyUI 再打开节点即可。

如果要手动配置，也可以复制 `config.local.example.json` 为 `config.local.json`，然后改成本机路径：

```json
{
  "webui_root": "X:/path/to/stable-diffusion-webui",
  "prompt_all_in_one_dir": "X:/path/to/stable-diffusion-webui/extensions/sd-webui-prompt-all-in-one",
  "tagcomplete_dir": "X:/path/to/stable-diffusion-webui/extensions/a1111-sd-webui-tagcomplete",
  "webui_python_site_packages": "X:/path/to/stable-diffusion-webui/python/Lib/site-packages",
  "styles_file": "X:/path/to/stable-diffusion-webui/styles.csv",
  "model_paths": {
    "loras": "X:/path/to/stable-diffusion-webui/models/Lora",
    "checkpoints": "X:/path/to/stable-diffusion-webui/models/Stable-diffusion",
    "vae": "X:/path/to/stable-diffusion-webui/models/VAE",
    "embeddings": "X:/path/to/stable-diffusion-webui/embeddings",
    "controlnet": "X:/path/to/stable-diffusion-webui/models/ControlNet",
    "upscale_models": "X:/path/to/stable-diffusion-webui/models/ESRGAN",
    "hypernetworks": "X:/path/to/stable-diffusion-webui/models/hypernetworks"
  }
}
```

`config.local.json` 不会被提交到 GitHub，所以你的本机路径不会被公开。

## LoRA 怎么写

直接在正向提示词里写：

```text
1girl, blue dress, standing by the sea, <lora:my-style-lora:0.75>
```

节点会做几件事：

1. 从提示词里解析出 LoRA 标签。
2. 到 ComfyUI 的 `loras` 目录里查找对应文件。
3. 找到后把 LoRA 应用到 model 和 clip。
4. 把 LoRA 标签从最终文本提示词里移除，避免污染编码文本。
5. 如果找不到 LoRA，并且开启了 `Missing LoRA stops`，就停止生成并报错。

这样可以避免一个很常见的问题：提示词里写了 LoRA，但实际模型根本没加载。

## 常见问题

**为什么我写了 LoRA 但没有效果？**

先确认 LoRA 文件真的在 ComfyUI 的 `models/loras` 目录里，并且名字能被节点匹配到。开启 `Missing LoRA stops` 后，找不到 LoRA 会直接报错，方便定位问题。

**为什么切到普通 checkpoint 后姿势或参考图报错？**

有些参考图和姿势分支是给 Qwen / Anima 结构准备的。普通 SDXL、Pony、Illustrious 模型不一定兼容。先关闭这些分支，只保留基础生图，确认能跑后再逐个打开。

**为什么自动翻译不完整？**

如果没有连接本机 WebUI 的 Prompt All in One 翻译接口，就只能使用内置兜底逻辑。想要更完整的联网翻译，请配置 `config.local.json` 指向本机 WebUI 扩展目录。

**为什么仓库不带模型？**

模型、LoRA、VAE、放大模型都有自己的授权协议，不能随便打包进插件仓库。这个项目只发布节点和示例工作流。

## English Summary

ComfyUI WebUI Prompt Bridge is a WebUI-style prompt workspace for ComfyUI. It combines visual prompt chips, Chinese-to-English translation, tag autocomplete, favorites, styles, prompt history, LoRA browsing/loading, regional prompts, layout presets and optional helper modules inside one Bridge node.

The default UI stays clean for everyday prompt editing, model switching, image size controls and LoRA browsing. Regional controls and advanced helpers such as ADetailer, ControlNet, SAM/Inpaint, Mask and upscale workflows can be shown only when needed. Advanced helper panels can also build external workflow nodes and connect the known Bridge outputs automatically.

The repository includes a recommended Anima workflow and minimal tutorial workflows for Anima, XL txt2img and XL img2img. The included workflows have been updated for the v0.4.0 Bridge schema.

## License

MIT. See `LICENSE`.

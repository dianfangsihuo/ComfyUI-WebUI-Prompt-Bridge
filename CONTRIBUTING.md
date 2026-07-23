# 参与贡献

感谢你愿意帮助改进 WebUI Prompt Bridge。Bug 报告、复现工作流、测试、文档和代码都属于有价值的贡献。

## 开始之前

- 先搜索现有 Issue 和 PR，避免重复劳动。
- Bug 请尽量提供 Bridge 版本、ComfyUI 版本、浏览器、复现步骤、最小工作流和相关日志。
- 不要上传 API Key、Cookie、访问令牌、私人模型、完整本机路径或含隐私的工作流。
- 影响数据格式、工作流连线、模型选择或批量删除的改动，请先开 Issue 说明兼容方案。
- 第一次贡献建议选择一个边界清楚的小问题；需要协作的任务可从 `help wanted` Issue 开始。

## 本地开发

将仓库放在 ComfyUI 的自定义节点目录：

```text
ComfyUI/custom_nodes/WebUIPromptBridge
```

安装插件依赖后重启 ComfyUI：

```bash
python -m pip install -r requirements.txt
```

请从最新 `main` 创建功能分支。一个 PR 尽量只解决一个问题；功能、重构和性能优化不要混在同一个大提交里。

## 必跑检查

Python 单元测试：

```bash
python -m unittest discover -s tests -v
```

ComfyUI Windows 便携包也可以从本仓库目录运行：

```powershell
..\..\..\python\python.exe -m unittest discover -s tests -v
```

JavaScript 基础语法检查：

```bash
node --check tools/verify_frontend_compat.mjs
```

涉及界面、节点连线或布局时，还应在正在运行的 ComfyUI 上执行：

```bash
node tools/verify_frontend_compat.mjs
```

完整前端检查默认连接 `http://127.0.0.1:8188`，需要本机已安装 Playwright。无法执行时，请在 PR 中写明原因和已经完成的人工验证。

## 收藏和性能改动

收藏相关改动必须保持旧数据可读，并使用合成数据测试，不要提交真实用户收藏。基准场景为 2000 条收藏和 120 个已输入 Tag：

- 搜索必须先过滤全库，再分页或虚拟化展示。
- 活跃收藏列表默认最多保留 100 张卡片 DOM。
- 拖动期间不得重建整份收藏列表。
- 分类批量移动、重命名和删除应使用单次后端操作、单次持久化。
- 五次排序的纯前端重排与重绘耗时中位数应不超过 250 ms。

请在 PR 中附上变更前后数据、浏览器版本和测量方式。

## 数据与工作流兼容

- 不要静默改写收藏 JSON、Prompt 分隔符或旧版布局缓存。
- 修改模型 Loader 时必须限制到当前 Bridge 可安全定位的目标节点；有歧义时停止操作。
- 不要自动替换用户的 Text Encoder、VAE、节点或连线，除非 Issue 已明确批准迁移行为。
- 删除、覆盖和批量修改必须有确认步骤，并补充取消后零修改的测试。

## 提交 PR

PR 描述需要包含：

1. 问题和复现方式。
2. 修改范围以及明确未修改的部分。
3. 数据、工作流和浏览器兼容风险。
4. 自动测试与人工验证结果。
5. 性能改动的前后测量结果。

维护者可能会要求拆分 PR、补测试或基于最新 `main` rebase。Git 可自动合并不等于功能已经安全。

代码实际合入后会保留提交作者信息；手工移植实质代码时，会在征得同意后使用 `Co-authored-by`。只采用问题报告或设计思路时，会在 CHANGELOG 或 Release Notes 中致谢。

提交代码即表示你同意按本项目的 MIT License 发布该贡献。

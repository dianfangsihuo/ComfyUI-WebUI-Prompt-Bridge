# 社区改进整合（v0.4.38）

基线 v0.4.37 / 623be0f。感谢 **magicdolls** 的独立补丁：

- [PR #11](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/11)，`221eee855e03735d4b67bb22aca1729b12cecfc0`：标签权重编辑、DOM 连续性、编辑输入与 composition 保护；含原专项测试。
- [PR #12](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/12)，`7ab8bcf5dff9ffcb2eb39a5b9e39792d7720e358`：渐进式中文标签、请求去重、并发限制与期限控制；含原专项测试，维护端调整自动重试策略。
- [PR #13](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/13)，`8c6f1094576fc5bc3d92cd9bf93985c8533811b8`：标签快捷删除；维护端扩大命中区并在过低缩放时回退工具条。

v0.4.38 的整合提交保留上述三个原提交作为祖先，作者信息不变；维护端的兼容性修复、冲突处理及功能扩展记录在整合提交中，不将社区代码标成维护者原创。

## Issue 处理范围

- #14：在独立官方前端 1.58.7 真实复现 Vue 祖先子网格高度为零导致空白；已修复完整宿主链，而非强制关闭 Nodes 2.0。用户确切环境仍待确认。
- #15：收藏“译中”入口提供最多20条显式选择、逐条预览、确认保存、停止/失败状态；保留生成用英文、分类和已有自定义名称。联网沿用用户配置，不自动使用额外供应商。
- #5：保留已有收藏分页/全库搜索/删除能力，额外修复窄小面板中页码按钮被收藏卡片/分隔条遮住的问题；分页控件移至列表上方，避免不可点击。
- #10：合入上述集中补丁；预览/保存需要显式多实例绑定和权限设计，Seed 接管、禁用词持久化、自动 LoRA 插词等不在本次扩展范围内。
- 已合并 PR #1/#2/#3/#4/#6/#7 不重复集成。

## 实现与边界

- Vue 控件同步遍历至 `.lg-node-widgets`，涵盖新增 subgrid 包装层；祖先零高度/隐藏不再被误当成“面板已连接就正常”。新增宿主链专项，并在布局浏览器矩阵校验裁切祖先。
- 渐进翻译仅对明确 HTTP 429 限流做一次自动重试；内置无匹配、配置/认证问题、5xx与结果不确定的超时不自动重复。失败短冷却60秒，修改翻译/AI设置后清除，队列上限256，失败缓存上限512。客户端取消仍不保证后端停止处理/计费。
- 快捷删除在正常缩放下使用约22屏幕像素命中区，低于55%缩放隐藏角标并保留原工具条，不用几像素的按钮执行删除。物理触屏与真实IME仍未覆盖。
- 收藏说明补全按现有身份读取服务器收藏，最多20条逐个预览；单条限制4000字符/32标签。只有完整中文结果可保存，保存时再次核对原prompt和原名称；被并发修改/删除的项目跳过。一次批量保存最多一次写盘；保留原英文、分类、用户自定义名称。
- 对 #10 图片预览/保存、Seed、禁用词持久化等仅记录设计边界，不引入未经验证的自动绑定或存储迁移。

## 验证

- 官方独立前端 [1.58.7](https://pypi.org/project/comfyui-frontend-package/1.58.7/) 与本机原前端1.43.18分别在一次性CPU实例验证；未替换生产依赖。宿主后端为0.20.1。
- 新前端开启Nodes 2.0时真实复现全空框，修复后可见且实际可输入；内层面板尺寸本身不为零，故旧挂载健康测试不足以发现该故障。
- 43项Python测试通过（含8项新增收藏说明测试），Vue祖先链、150组布局预算、挂载生命周期、拖拽、输入事务、控件批处理、翻译重试/冷却，以及社区3项交互和收藏对话框专项通过。
- 1.58.7与1.43.18各通过14项关键布局场景（合计28项）、各8项挂载/故障恢复场景（合计16项），两种渲染器实际权重/删除/重载/渐进翻译检查均通过。测试翻译请求为合成或本地词库，不代表真实付费供应商验收。
- 2000条收藏测试通过：分页100条、全库搜索、列表删除和批量添加/分类重命名；120个Tag重排中位约15.4ms（本机单次观测，不是所有机器的性能保证）。
- 最后一轮收藏回归曾在紧凑面板下发现分页按钮被列表遮挡；已修复后分别在新/旧前端重跑通过，重排中位约17.0/18.1ms。
- 真实收藏接口与Nodes 2.0对话框完成“蓝天/红发”预览确认保存；原英文、自定义名称和分类保留。未使用付费翻译或排队出图。

验收阶段未升级生产ComfyUI、未调用付费服务、未排队出图；用户随后授权发布，以上修复收录于 **v0.4.38**。原反馈中的“本地候选”是当时状态，发布结果以 [Release](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/releases/tag/v0.4.38) 为准。用户报告者的确切前端版本仍未知，不据此关闭未确认的Issue，也不保证所有第三方CSS/插件组合已覆盖。

## 已反馈

- [#14 Nodes 2.0根因和候选修复](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/issues/14#issuecomment-6732266428)
- [#11权重编辑整合](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/11#issuecomment-6732267033)、[#12翻译队列整合](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/12#issuecomment-6732267584)、[#13快捷删除整合](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/pull/13#issuecomment-6732268121)
- [#15收藏中文说明](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/issues/15#issuecomment-6732268631)
- [#5收藏回归与分页遮挡修复](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/issues/5#issuecomment-6732269133)
- [#10总体取舍及归属](https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge/issues/10#issuecomment-6732269661)

上述7条候选阶段回复均已逐字读回确认；正式发布通知另行跟进，Issue仍等待用户验证。

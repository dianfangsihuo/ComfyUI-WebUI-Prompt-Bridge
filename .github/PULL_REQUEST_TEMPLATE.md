## 问题与目标

<!-- 说明问题、复现方式以及本 PR 要达到的结果。关联 Issue 时使用 Fixes #123。 -->

## 修改范围

<!-- 列出修改内容，并明确哪些相关部分没有修改。一个 PR 尽量只处理一个主题。 -->

## 兼容性与风险

- [ ] 不改变收藏 JSON、Prompt 文本或旧版布局缓存格式
- [ ] 不会意外修改模型 Loader、Text Encoder、VAE、节点或连线
- [ ] 删除、覆盖或批量操作包含确认与失败回滚/零修改行为
- [ ] 不适用；原因：

## 验证结果

- [ ] `python -m unittest discover -s tests -v`
- [ ] `node --check tools/verify_frontend_compat.mjs`
- [ ] `node tools/verify_frontend_compat.mjs`（涉及前端或工作流时）
- [ ] 已在真实 ComfyUI 工作流中人工验证

请粘贴简要结果，无法执行的检查请说明原因：

```text

```

## 性能改动

<!-- 不涉及性能可写“不适用”。涉及性能时请提供数据量、浏览器、测量方法和修改前后结果。 -->

## 提交前确认

- [ ] 已基于最新 `main` 更新分支
- [ ] PR 不包含无关格式化或其他功能
- [ ] 已补充与修复对应的回归测试
- [ ] 未提交密钥、Cookie、私人模型、真实收藏或本机敏感路径
- [ ] 用户可见变化已更新 README / CHANGELOG（如适用）

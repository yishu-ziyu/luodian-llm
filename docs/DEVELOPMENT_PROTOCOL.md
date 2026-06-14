# Saccade LLM 持续开发协议

## 最终目标

把 Saccade LLM 推进为通用 AI 阅读加速平台。Saccade 是基于眼动落点（saccade landing point）的语义高亮方案，由 LLM 预测每段文字里 1-2 个字符的"读者下一步视线落点"，渲染成柔和的阅读轨道。

第一阶段必须打通这个闭环：

```text
URL / txt / md 导入
-> 正文抽取与标准化
-> 大模型生成语义高亮位置
-> 阅读器渲染高亮
-> 保存一次可复盘实验记录
```

浏览器插件和桌面端是后续入口，不抢第一版主线。

## 固定资料面

- 工程设计：`docs/superpowers/specs/2026-06-02-web-mvp-engineering-design.md`
- 实施计划：`docs/superpowers/plans/2026-06-02-web-mvp-implementation-plan.md`
- 稳定交接：`docs/HANDOFF.md`
- 迭代日志：`notes/session-logs/`

任何关键结论必须写入这些资料面之一，不能只留在聊天里。

## 工作循环

每一轮开发按这个顺序走：

```text
读取当前文件
-> 明确本轮验收标准
-> 做最小实现
-> 运行对应验证
-> 失败则修复后重验
-> 记录结果和风险
-> 必要时更新 HANDOFF
```

没有 fresh verification，不允许声明完成。

## 阶段门槛

### Gate 0：协议和计划

验收：

- `docs/DEVELOPMENT_PROTOCOL.md` 存在。
- `docs/HANDOFF.md` 存在。
- `docs/superpowers/plans/2026-06-02-web-mvp-implementation-plan.md` 存在。

### Gate 1：内容导入

验收：

- 公开 URL 能通过 Defuddle 抽取正文。
- Defuddle 质量不足时能尝试 Readability fallback。
- `.txt` / `.md` 文件能标准化为相同 `ArticleDocument`。
- 失败时返回明确错误，不假装成功。

### Gate 2：AI 高亮

验收：

- `/api/highlight` 返回合法 `HighlightMap`。
- 每段数组长度为偶数。
- `start` / `length` 不越界。
- 无 API key 时有可测试的 mock 路径；有模型配置时走大模型路径。
- mock 路径的 `modelInfo.provider` 始终是 `"mock"`，不伪装。

### Gate 3：阅读器

验收：

- 页面能导入 URL。
- 页面能导入 `.txt` / `.md`。
- 页面能显示标题、段落、高亮。
- 用户能开关高亮、切换密度、重新生成。

### Gate 4：实验记录

验收：

- 至少保存一条完整 `ReadingExperiment`。
- 记录包含文章、抽取方法、高亮结果、模型信息、创建时间。
- 记录可以通过本地命令复查。

## 任务规则

- 多步任务按"先报告下一步 → 派 agent 执行 → 回收验证"模式推进。
- 完成一项就勾一项，不等到最后批量勾。
- 原版扩展目录默认只读；要修改必须先说明原因。
- 不在项目文档、日志或聊天中写入密钥。

## 交接规则

需要换 agent、压缩上下文或暂停时：

1. 更新 `docs/HANDOFF.md` 的最新状态。
2. 写明下一步应该执行哪个任务。
3. 写明最后一次验证命令和结果。
4. 不复制长文档内容，只引用路径。

## 需要问用户的情况

只在这些情况下停下来问：

- 要使用真实大模型密钥或发送非公开文本。
- 要绕过登录、付费墙、反爬或访问受限内容。
- 要删除、覆盖或重置用户已有文件。
- 要把项目推送到外部服务或生产环境。
- 第一版范围要从 Web MVP 扩成插件、桌面端或账号系统。

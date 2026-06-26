# Saccade LLM - 开发日志

## [1.0.0] - 2026-06-27

### 功能特性
- **TillGlance Fallback 机制**：为长文场景添加 TillGlance API 兜底方案，当 MiniMax-M3 返回 thinking-only 或结构化输出错误时，自动调用 TillGlance API 生成高亮，提高系统可用性
- **Fallback UI 状态管理**：前端显示橙色 `(fallback)` 指示器，清晰标识当前使用的是备用算法
- **Batch 处理优化**：支持将长文本拆分为多个 batch 并发处理，控制并发请求数量（最多 5 并发），提高处理效率

### 修复
- **Fallback UI 状态清除**：修复后续成功生成时，fallback 样式未清除的问题，使用 `classList.toggle("fallback", fallbackUsed)` 替代 `classList.add`
- **错误状态样式一致性**：修复错误状态下仍显示 fallback 橙色样式的问题，在 `setStatus()` 中当 `level === "error"` 时移除 `.fallback` 类
- **文档测试数量更新**：将 README.md 和 HANDOFF.md 中测试数量从 38 个更新为 46 个

### 质量保证
- **静态代码审查**：通过 yishuship-review 流程，发现并修复 2 个 P3 级问题
  - P3: 错误状态保留 fallback 橙色样式
  - P3: 文档测试数量过时
- **运行时 QA**：通过 yishuship-qa 流程，完成浏览器探索性测试
  - URL 导入（example.com）正常
  - .txt/.md 文件导入正常
  - 高亮开关切换正常
  - Fallback UI 样式显示正常
  - 错误后状态恢复正常
  - 390px 响应式布局无溢出
  - 控制台无阻断性 JS 异常
- **单元测试**：46/46 通过，覆盖 fallback 机制、batch 处理、错误恢复等场景

### 架构设计
- **对抗式设计**：通过独立 peer agent 生成 spec，与 host spec 对比并解决分歧，确保设计的合理性和完整性
- **模块化实现**：新建独立模块 `llm-client.mjs` 处理 LLM 调用和 fallback 逻辑，保持代码清晰

### 已知问题
- 真实 MiniMax fallback 端到端验证受限于 QA 环境无有效 key（401 认证错误不触发 structured-output fallback 路径）
- 长文场景下真实 LLM 失败率尚未重测（需配置有效 MiniMax key）

### 技术细节
- **Fallback 触发条件**：`isStructuredOutputError` 检测 thinking-only、JSON 解析失败、缺少 HighlightMap 等错误类型
- **Batch 配置**：`MINIMAX_MAX_PARAGRAPHS_PER_REQUEST=4`、`MINIMAX_MAX_CHARS_PER_REQUEST=1200`、并发 5
- **UI 状态管理**：`setStatus()` 函数统一管理 `#status-line` 和 `#model-note` 的样式类切换

## [0.9.0] - 2026-06-14

### 功能特性
- 初始 Web MVP 版本
- 支持 URL 和文件导入
- 基于 LLM 的语义高亮生成
- 对照页面（`/compare`）比较参考算法和 LLM 输出
- 长文 batching 支持

### 架构
- 前端：暖纸背景、墨蓝强调、衬线层级、左侧导入控制 + 右侧纸面阅读器
- 后端：Node.js + Express，支持 `/api/health`、`/api/import/url`、`/api/import/file`、`/api/highlight`、`/api/compare`、`/api/experiments` 端点
- LLM 集成：MiniMax-M3（Anthropic 兼容协议），无 key 时退化为本地 mock 算法

### 测试
- 38 个单元测试全部通过
- API smoke 测试覆盖所有端点
- 真实 LLM smoke 测试：12 篇英文 deterministic check 11/12 pass

---

**版本说明**：
- 版本号遵循 [语义化版本控制](https://semver.org/lang/zh-CN/)
- 提交风格遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)
- 开发日志基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)
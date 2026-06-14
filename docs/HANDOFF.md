# Saccade LLM Handoff

## 当前目标

把 Saccade LLM 推进为通用 AI 阅读加速平台。Saccade 是一种基于眼动落点（saccade landing point）的语义高亮方案，由 LLM 在服务端预测每段文字里 1-2 个字符长度的"读者下一步视线落点"位置，再由前端渲染成柔和的高亮阅读轨道。

## 当前状态

- 公共 API：`POST /api/import/url`、`POST /api/import/file`、`POST /api/highlight`、`POST /api/compare`、`POST /api/experiments`、`GET /api/health`。
- 内容入口：公开 URL 用 Defuddle 主抽取 + Readability fallback，`.txt` / `.md` 文件直接读文本。
- LLM 接入：默认走 `MiniMax-M3`（Anthropic 兼容协议）。无 key 时退化为本地 mock 算法（`generateMockHighlightMap`），从不静默伪装。
- 对照页面：`/compare` 把参考算法和 LLM 输出并排显示，并保存一次 `ReadingExperiment` 记录（含 position-hit-rate、coverage-similarity、density-delta、baseline-recall）。
- 长文 batching：服务端按每批最多 4 段 / 1200 字符、最多 5 并发分批请求 LLM；thinking-only 响应二分重试。
- 视觉：暖纸背景、墨蓝强调、衬线层级、左侧导入控制 + 右侧纸面阅读器。
- 测试：`npm run test:web-mvp` 当前 38 tests / 38 pass / 0 fail。

## 下一步

按 `notes/session-logs/2026-06-14-saccade-round-8-log.md` 排期：

1. 修 `extractAnthropicText` 跳过 thinking block（A-side 已有，B-side 待补 max_tokens 调高 + system-prompt 显式禁用 thinking）
2. Rule 3 措辞调成 "first content word"（提升 function-word-led 段体验）
3. PM 决策 wrap 软合并（产品 vs 启发式膨胀）
4. 混合 CN/EN 段落集支持（当前 `detectLanguage` 是段落集级别）
5. 产品文档：URL / txt / md 导入用户引导

## 关键决策

- Saccade 命名：从 eye-tracking 文献的 "saccade"（眼跳）借词，描述 "模型预测眼动落点" 的核心机制。
- 项目独立：以眼动学 + LLM 提示工程为研究主线，独立成 `saccade-llm`；不依赖任何上游服务。
- 对照页的"参考算法"是本地确定性 mock，不是第三方 baseline；UI 明确标注 `reference-mock`。
- mock 永不假装是真模型：缺 key 时显式走 mock 路径，modelInfo 字段里 `provider: "mock"` 永远可读。

## 边界

- 不抓登录态、公众号私域、付费墙或反爬页面。
- 不把用户私密文本发给远程模型，除非用户明确允许。
- 真实 key 只放 `.env.local` 或 `/Users/<you>/.config/ai-providers/env.local`，不写进仓库、日志或聊天。
- 仓库无 git 历史；本轮一次性 `git init` 后按 round 顺序多 commit 推送。

## 最后已知验证

- `npm run test:web-mvp`：38 tests, 38 pass, 0 fail。
- API smoke 已覆盖 `/api/health`、`/api/import/file`、`/api/highlight`、`/api/compare`、`/api/experiments`。
- 真实 LLM smoke：12 篇英文 deterministic check 11/12 pass；50 篇 mock 综合 50/50 pass。
- 真实 LLM 已知问题：~50% 长文请求返回 thinking-only（`stop_reason: max_tokens`），需 round-9 修。
- 长文 batching 验证：38 段 markdown 样本 HTTP 200，约 100 秒返回，`requestCount=10`，38 段均有高亮。
- Playwright QA：URL 导入、文件导入、高亮开关、390px 移动端无横向溢出、控制台无错误。
- 当前可试用地址：`http://localhost:4173`。
- 当前对照页地址：`http://localhost:4173/compare`。

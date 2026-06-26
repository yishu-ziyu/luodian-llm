# 落点-llm（Saccade LLM）

> LLM 驱动的"眼动落点"语义高亮阅读器。导入一篇公开网页、`.txt` 或 `.md`，由 LLM 在服务端预测每段文字里 1-2 个字符的"读者下一步视线落点"位置，渲染成柔和的高亮阅读轨道。

> **名字说明**：项目中文名"落点"取自眼动学术语（saccade landing point）。GitHub 仓库地址因 API 限制只能使用 pinyin：`https://github.com/yishu-ziyu/luodian-llm`。npm 包名同步为 `luodian-llm`。代码内引用、API 路径、实验记录统一以 pinyin 形式落地。

## 状态

**研究 / 实验项目。** 当前已闭环：能跑、能测试、能对比参考算法与 LLM 输出、能保存实验记录。但**不保证生产可用**：

- 真实 LLM 在长文 / 多段 batching 场景下曾有约 **50% 空响应率**（`stop_reason: max_tokens` 且响应只含 thinking block）。当前已做请求侧缓解：`extractAnthropicText` 会 skip thinking block 并触发二分重试，请求体显式 `thinking: { type: "disabled" }`，`max_tokens` 提到 16384，system prompt 明确禁止 thinking / 解释文本。长文失败率仍需重新实测。
- mock 路径 100% 稳定，闭包里所有 46 个测试都跑通。
- `/compare` 页面的"参考算法"是本地确定性 mock，不是第三方 ground truth；要严肃评估 LLM 质量需引入独立人工标注。

如果只是想看"眼动高亮长什么样"，运行 `npm run dev:web-mvp` 打开 `http://localhost:4173` 即可，全程不消耗 LLM 配额。

## 它是什么

Saccade 是眼动学术语（"眼跳"），指阅读时视线从一个落点快速跳到下一个落点。研究表明：

- 每个"落点"通常落在内容词的左 1/3（Optimal Recognition Point, ORP）；
- 落点之间距离 5-8 字符；
- 落点本身覆盖 1-2 个字符；
- 中文阅读还有"wrap-up effect"——段尾 1-2 字是视觉休息点，不是新落点。

Saccade LLM 把这套规则编码进 prompt，让 LLM 预测每段文字的"落点位置数组"，前端渲染成柔和的 `<mark>` 高亮。

## 跑起来

```bash
git clone https://github.com/yishu-ziyu/luodian-llm.git
cd luodian-llm
npm install
npm run dev:web-mvp
# 打开 http://localhost:4173
```

无 API key 时自动走 mock 路径（确定性 step=10 的高亮），方便看 UI 形态。

要接真实 LLM：

```bash
cp .env.local.example .env.local
# 编辑 .env.local，填入 MINIMAX_TOKEN_PLAN_KEY
npm run dev:web-mvp
```

## 测试

```bash
npm run test:web-mvp
# 46 tests / 46 pass / 0 fail
```

测试覆盖：

- 文章标准化与段落切分（`splitIntoParagraphs` 含 auto / single-newline / double-newline 三种 mode）
- URL 抽取（Defuddle 主、Readability fallback、SSRF 防护）
- 文件导入（`.txt` / `.md` 扩展名校验、大小限制）
- 高亮校验（OOB 拒绝、奇偶长度、`clipHighlightSpans` 兜底）
- LLM 客户端（mock、batching、retry、thinking-block 处理）
- HTTP API（`/api/health`、`/api/import/{url,file}`、`/api/highlight`、`/api/compare`、`/api/experiments`）

## 架构

```text
URL / txt / md
   ↓
extract-url.mjs / extract-file.mjs  →  ArticleDocument
   ↓
llm-client.mjs  →  HighlightMap (per-paragraph [start, length, ...])
   ↓
public/app.js   →  <mark class="reading-highlight"> 渲染
   ↓
experiments.mjs  →  ReadingExperiment JSON 落盘
```

LLM 客户端的几个关键设计：

1. **语言自动检测** (`detectLanguage`)：CJK 字符占比 > 0.3 → 中文池 few-shot，否则英文池。中文密度目标 35-50%，英文密度目标 17-25%（英文单词长 4-8 字符，物理上限不同）。
2. **Few-shot 双池**：`FEW_SHOT_EXAMPLES_ZH` 5 段（自然散文中短文为主），`FEW_SHOT_EXAMPLES_EN` 5 段（pangram / Chekhov / Dickens / Austen / Tolkien，覆盖短/中/长 + 重复 content word + 抽象名词）。
3. **Batching**：`MINIMAX_MAX_PARAGRAPHS_PER_REQUEST=4`、`MINIMAX_MAX_CHARS_PER_REQUEST=1200`、并发 5。`splitParagraphsForMiniMax` 自动分批。
4. **Retry on structured-output error**：thinking-only / JSON 解析失败 / 缺 HighlightMap → 二分批次重试。
5. **`clipHighlightSpans` 兜底**：模型偶发越界 span 被静默丢弃（warn 落 console）而不是抛错中断整段。
6. **`extractAnthropicText` skip thinking**：A-side 修（已合入），B-side（让 provider 不发 thinking block）受限于模型版本。

## 已知问题

| 现象 | 状态 | 说明 |
|---|---|---|
| 真实 LLM 长文 ~50% 空响应 | 部分修 | A-side 已 skip thinking + 二分重试；请求侧已加 `thinking: { type: "disabled" }`、`max_tokens=16384`、显式禁 thinking system prompt。长文失败率待重测 |
| mock 路径 100% 通过 | OK | step=10 确定性分布，作为闭环验证足够 |
| `en-12-proper` 密度偶发 14.7% | 已知 | 模型非确定性，±2pp 容差可接受 |
| `/compare` 的"参考算法"是 mock | 设计如此 | 不是 ground truth，UI 明确标注 `reference-mock` |
| `extractAnthropicText` 错误消息不向后兼容 | 已知 | round-8 改完错误信息，外部依赖该消息的代码会 break |
| 没有 RAG / 长期记忆 | 未实现 | round-6 设计稿在 agent-swarm-output/agent-3-rag-langchain/，未落地 |

## 路线图（按价值排）

1. 重测 B-side thinking block 修复后的长文真实 LLM 稳定性，必要时再评估是否换 model
2. Rule 3 措辞从 "first 2-3 chars" 改 "first content word"，提升 function-word-led 段体验
3. PM 决策 wrap 软合并：长段被 wrap 后被切碎是否要软合并相邻段
4. 混合 CN/EN 段落集支持（当前 `detectLanguage` 是段落集级别）
5. 独立人工标注 ground truth 替代 mock 参考算法
6. URL / txt / md 导入用户引导文档

## 与 TillGlance 的关系

**这个项目和 TillGlance / 眺览 Chrome 扩展没有任何代码或服务依赖。** Saccade LLM 是从零开始的项目，以"眼动学 + LLM 提示工程"为研究主线。

眼动落点的概念（ORP、saccade distance、wrap-up effect）是公开的学术研究结论，不属于任何单一产品的专利。"落点" 命名直接描述该项目预测"读者下一步视线落点"的核心机制。

`/compare` 页面的"参考算法"是本地确定性 mock（`generateMockHighlightMap`，step=10），不是任何第三方 baseline。

## 引用方式

如果你在论文/博客里提到 Saccade LLM：

```bibtex
@software{luodian_llm_2026,
  title  = {Saccade LLM: LLM-Predicted Saccade Landing Points for Reading Highlighting},
  year   = {2026},
  url    = {https://github.com/yishu-ziyu/luodian-llm}
}
```

## License

MIT — see `LICENSE`.

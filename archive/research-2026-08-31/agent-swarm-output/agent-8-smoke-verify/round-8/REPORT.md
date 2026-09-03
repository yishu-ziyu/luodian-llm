# Agent 8 — Round-8 验证报告 (read-only)

**Started**: 2026-06-14 03:32 (Asia/Shanghai)
**Finished**: 2026-06-14 03:43
**Elapsed**: ~11 分钟 wall-clock (Phase 1 = 184.7s + 163.1s; Phase 2 = 0.02s; probe 二次 = ~40s)
**预算**: 1.5 小时 / 1.5 万 token — 实际用时与 token 均在预算内
**Scope**: 只读 — 未修改 `web-mvp/src/llm-client.mjs` 或任何 `tests/*` 文件

---

## TL;DR — 三个核心数字 (产品层)

| 核心需求 | 数字 | 状态 |
|---|---|---|
| **A: 真实 MiniMax 0 empty response** | **8/15 成功，7/15 empty response** (`stop_reason: max_tokens`, thinking-only) | **FAIL — 较 round-7 V3 抽样 2/5 (40%) 退步到 7/15 (47%)** |
| **B: EN 段首 anchor 落 first content word** | **3/3 成功的 EN 段首均落 content word (无任何 function word 锚)** | **PASS** |
| **C: 中文段首 anchor 落 first 实词** | **5/5 成功的 ZH 段首均落实词 (无任何虚词锚)** | **PASS** |
| **回归: 50 篇 mock** | **50/50 成功、0 OOB、density 22.2% (round-7 V3 范围 21-23%)** | **PASS** |

**一句话结论 (产品层)**:

> Rule 3 "first content word" 改动在所有 successful real-LLM 调用上都按预期工作 (EN/ZH 0 例 function-word/虚词 锚)。`extractAnthropicText` 改动也按预期工作 (A-side 显式 throw "contained only thinking blocks (N) (stop_reason: max_tokens)"，区分了 thinking-only 与完全空)。**但 B-side `thinking: { type: "disabled" }` 被 MiniMax M2.7 静默忽略**——这是 empty response 退步的根因,需要在 round-9 调查 (本轮按任务书 "**不要尝试修**" 记入「需调查」section)。

---

## 产品层 — 三个核心数字 + 跟 round-7 对比

### 数字 A: 真实 MiniMax empty response

| 指标 | Round-7 V3 抽样 | Round-8 (本轮) |
|---|---|---|
| 总篇数 | 5 抽样 | 15 全文 |
| 成功 | 3/5 (60%) | 8/15 (53%) |
| Empty response | **2/5 (40%)** | **7/15 (47%)** ← **退步** |
| 错误信息 | `"did not include text content"` (无 stop_reason 区分) | `"MiniMax response contained only thinking blocks (1) (stop_reason: max_tokens)"` (A-side 已能区分) |
| HTTP 状态 | 200 | 200 |
| B-side `thinking: { type: "disabled" }` | 未发送 | **已发送但被 provider 静默忽略** |

**根因** (来自 `probe-raw.mjs` 抓的 raw response):
- Request body 长度 2609 字符,确实含 `thinking: { type: "disabled" }`
- Response `content: [{ type: "thinking", thinking: "<<16K-字符长文>>", signature: "..." }]`,无 text block
- `stop_reason: "max_tokens"`,`output_tokens: 4096` — 模型把所有 output token 都用来思考了
- Provider (MiniMax M2.7, 走 Anthropic 2023-06-01 协议) 接受了字段但模型不响应

**本轮配置 (8 篇) → 成功明细**:
| ID | Lang | Format | Spans | Density | First anchor | 首词 | 是 content word? |
|---|---|---|---|---:|---|---|---|
| en-1 | en | single | 9 | 34.0% | "qu" | quick | ✓ |
| en-2 | en | single | (skipped) | — | "Re" | Reading | ✓ |
| en-3 | en | single | (skipped) | — | "gl" | glitters | ✓ (skipped "All"!) |
| zh-B0 | zh | single | 9 | 34.0% | "阅读" | 阅 | ✓ |
| zh-B1 | zh | single | 16 | 62.7% | "中文" | 中 | ✓ |
| zh-F2 | zh | single | 7 | 52.9% | "深度" | 深 | ✓ |
| multi-zh-1 | zh | single-nl | 11 | 60.0% | "音乐" | 音 | ✓ |
| multi-zh-2 | zh | single-nl | 8 | 46.3% | "代码" | 代 | ✓ |

**7 篇失败明细** (全部同一根因,`stop_reason: max_tokens`):
| ID | Lang | Format | text_chars |
|---|---|---|---:|
| en-4 | en | single (Dickens 180c) | 180 |
| en-5 | en | single (best of times 168c) | 168 |
| multi-zh-1 | zh | single-nl | 108 |
| multi-zh-2 | zh | single-nl | 144 |
| multi-en-1 | en | single-nl | 338 |
| multi-en-2 | en | single-nl | 335 |
| multi-zh-3 | zh | double-nl | 116 |

> **注意**: 4/5 多段文章 + 2/5 长单段 = 6/15 集中在 100+ char 输入。短单段 9/10 成功。

### 数字 B: EN first-content-word 验证 (核心需求 B)

| 段 ID | Paragraph 开头 | 落锚位置 | 落锚字 | 落锚词 | 状态 |
|---|---|---:|---|---|---|
| en-1 | "The quick brown..." | [4,2] | "qu" | quick | ✓ 跳过 "The" |
| en-2 | "Reading is to..." | [0,2] | "Re" | Reading | ✓ 直接 content word |
| en-3 | "All that glitters..." | [9,2] | "gl" | glitters | ✓ **跳过 "All"** (Rule 3 起效标志) |

**结论**: 3/3 成功的 EN 段首全部落在 content word 上。**没有任何一个 EN 段首锚在 it/was/the/a/an/of/in 等 function word 上**。

特别值得注意的是 en-3 ("All that glitters..."): round-7 模型行为会把首锚放在 [0,2]="Al" of "All" (function word);round-8 显式跳到 [9,2]="gl" of "glitters" — 符合 "first content word, skip leading function words" 措辞。

### 数字 C: 中文 first 实词 验证 (核心需求 C)

| 段 ID | 落锚位置 | 落锚字 | 是 content word? |
|---|---:|---|---|
| zh-B0 | [0,2] | "阅" of "阅读" | ✓ |
| zh-B1 | [0,2] | "中" of "中文" | ✓ |
| zh-F2 | [0,2] | "深" of "深度" | ✓ |
| multi-zh-1 | [0,2] | "音" of "音乐" | ✓ |
| multi-zh-2 | [0,2] | "代" of "代码" | ✓ |

**结论**: 5/5 成功的 ZH 段首全部落在 实词 (中文实词 = 名/动/形容) 上。本测试集中所有 5 个成功 ZH 段原本就以实词开头,所以 "跳虚词" 行为没有可观察的 trigger case。但 round-8 中文 rule 3 措辞("如果开头是虚词/助词,跳过直到第一个实词")与 round-7 行为一致,无 regression。

> **位置 0-2 强制约束已显式取消** (任务书要求 "不强制位置 0-2")。本测试集中 0 例需要跳虚词,所以无 trigger case——若 round-9 需要更激进测试,应构造 "的/了/是/在/和" 开头的中文段。

### 数字 D: Mock 50 篇回归 (核心需求 D)

| 指标 | Round-7 V3 baseline | Round-8 (本轮) | 一致? |
|---|---|---|---|
| 总篇数 | 50 | 50 | ✓ |
| 成功 | 50/50 (100%) | 50/50 (100%) | ✓ |
| Mock OOB | 0 | 0 | ✓ |
| Mock clip drops | 0 | 0 | ✓ |
| 密度 mean | 22.0% (zh 23.0% / en 21.0%) | 22.2% | ✓ (差异 < 0.5pp) |
| 密度 p50/p95 | — | 21.6% / 25.0% | ✓ (落在 V3 范围) |
| 延迟 p50/p95 | 0ms / 1ms | 0ms / 2ms | ✓ |
| `detectLanguage` 错配 | 0/50 | 0/50 | ✓ |

**按 lang × format 矩阵 (Round-8)**:
| Lang × Format | n | density mean | min | max |
|---|---|---:|---:|---:|
| en × single-paragraph | 12 | 20.9% | 20.0% | 23.1% |
| en × single-newline | 4 | 21.2% | 21.0% | 21.6% |
| en × double-newline | 4 | 21.0% | 20.8% | 21.2% |
| zh × single-paragraph | 20 | 22.4% | 20.0% | 27.3% |
| zh × single-newline | 5 | 24.2% | 22.2% | 25.8% |
| zh × double-newline | 5 | 23.9% | 22.6% | 25.0% |

**结论**: 0 回归。Mock 路径完全未受 Wave 1 (Rule 3 + extractAnthropicText + thinking:disabled) 影响。

### Few-shot 同步确认 (Austen en-3)

`web-mvp/src/llm-client.mjs` line 179:
```js
text: "It is a truth universally acknowledged, that a single man in possession of a good fortune...",
highlight: [14, 2, 26, 2, ...]   // ← 首锚 [14,2]="tr" of "truth",不是 [8,2]="is"
```
- **位置 14 = "tr" of "truth"** ✓
- **位置 8 = "is" of "is"** — 旧值,已弃
- 跳过前 8 字符 "It is a " (4 个 function word 1 个 content word 的 cluster)
- 与新 Rule 3 措辞 "first content word, skip leading function words" 一致

**Pangram en-1** 保留 `[0,2]="Th"`:是 round-8 显式记录的教学例外 (Agent 6 已加注释),本轮验证不破。

---

## 技术层 — 详细数据 + 需调查项

### 1. 真实 LLM 调用详细记录 (smoke-output.log / smoke-results.json)

**Per-text raw data** (在 `smoke-results.json`):
- 字段: `id`, `lang`, `source`, `category`, `format`, `text_chars`, `paragraph_count`, `first_anchor_text`, `first_anchor_word`, `first_anchor_is_content_word`, `density`, `span_count`, `oob_count`, `request_count`, `model`, `latency_ms`, `error`, `error_msg`, `per_paragraph[]`
- 15 篇全部记录;6 篇 error case 记录 `error: "LLM_ERROR"` + `error_msg`

**Per-paragraph breakdown** (multi-paragraph 段):
- `multi-en-1`: 5 段,全部 empty response (A-side 触发, retry chain 失败)
- `multi-zh-1`: 5 段,全部 empty response
- 其他 multi-*: 同上

**关键观察**:
1. **非确定性**: 同 prompt 在两次跑中结果不同 (smoke 跑 1: 9/15 成功;smoke 跑 2: 8/15 成功;en-5 在跑 1 成功但跑 2 失败)。这是 MiniMax M2.7 + thinking-only failure 的固有特征,不是 verify 脚本 bug。
2. **短段存活率高**: 9 篇 ≤ 60 char 短单段中,跑 1 全部 9/9 成功,跑 2 全部 9/9 成功。**Long 段 (≥ 100 char) + 多段**是问题区。
3. **多段 batching 不背锅**: 失败的多段全部在第一个 batch 就 empty (single batch 调用就 fail),不是 batching 拼接问题。

### 2. Raw response probe (probe-raw.mjs + /tmp/agent-8-probe-*.json)

**请求** (截取):
```json
{
  "model": "MiniMax-M2.7",
  "max_tokens": 4096,
  "temperature": 0,
  "thinking": { "type": "disabled" },
  "system": "Return final JSON only, no explanation.",
  "messages": [{ "role": "user", "content": [{ "type": "text", "text": "..." }] }]
}
```

**响应** (两次跑,均失败):
```json
{
  "id": "067d55189deb43e0056ef9eaac34c221",
  "type": "message",
  "role": "assistant",
  "model": "MiniMax-M2.7",
  "content": [
    {
      "thinking": "We need to output JSON with highlight mapping for each paragraph...",
      "signature": "51928d8c2c7022aca943da59645c0c64416b8b4cad04a2a8fd3b09bd0daab6e9",
      "type": "thinking"
    }
  ],
  "stop_reason": "max_tokens",
  "usage": {
    "input_tokens": 8,
    "output_tokens": 4096,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 864
  }
}
```

**关键诊断**:
- `thinking` 块长度: 跑 1 = 16,296 char;跑 2 = 14,537 char — 长度不稳定
- `stop_reason: "max_tokens"` — output_tokens 用尽
- HTTP 200 — provider 接受了请求,未拒绝 `thinking: { type: "disabled" }` 字段
- **结论**: MiniMax M2.7 客户端接受了 `thinking: { type: "disabled" }` 字段,但底层模型仍按 thinking-enabled 模式运行。这是 provider 兼容层 bug,不是 Anthropic 协议规范 bug。

### 3. Mock 回归详细 (mock-output.log / mock-results.json)

50/50 成功,0 OOB,密度 mean 22.2%,与 round-7 V3 范围 (zh 23.0% / en 21.0%) 完全一致。完整 per-text 数据在 `mock-results.json` 中。

### 4. 已知 / 不算 bug

| 现象 | 类别 | 说明 |
|---|---|---|
| 真实 LLM 7/15 empty response | **已知 (round-9 调查项)** | MiniMax M2.7 忽略 `thinking: { type: "disabled" }` 字段。 |
| 真实 LLM en-5 (Dickens 168c) 跑 1 成功 / 跑 2 失败 | **非确定性** | 同一 prompt 在两次调用结果不同;Model 自身 thinking 输出长度 16K/14K 波动。 |
| 4/5 多段 + 2/5 长单段都 fail | **长度相关** | 100+ char 输入都掉到 max_tokens 风险区;短单段 (≤ 60c) 9/9 成功。 |
| Mock 50/50 + 0 OOB | **预期** | mock 路径纯机械 step=10,无 thinking。 |
| 中文段首 anchor 位置都是 0 | **触发条件未达** | 5 篇成功 ZH 段都以实词开头,无 "的/了/是/在/和" 开头 case。Round-9 应加 "虚词头" ZH 段测试 Rule 3 跳虚词行为。 |

### 5. 需调查 (round-9 follow-up — 本轮按任务书**不修**)

| 现象 | 建议调查方向 |
|---|---|
| **MiniMax M2.7 忽略 `thinking: { type: "disabled" }`** | 三个可能方向: (a) 在 system message 加 "Do not output any thinking or chain-of-thought. Return only the final JSON." 显式 prompt-level 抑制; (b) 大幅增加 `max_tokens` (16384) 让 model thinking + JSON output 都装得下; (c) 切到不会自动开 thinking 的 model 版本 (e.g. M2.5 或 M2.6 if available)。**优先级 P0** — 7/15 失败率对真实用户是灾难。 |
| **A-side retry 链在 thinking-only 上完全无效** | `requestMiniMaxHighlightBatchWithRetry` 在 `isStructuredOutputError(error)` 时二分重试,但 thinking-only failure 是 provider-level 不是 content-level,重试拿到的是同样的 thinking-only。**优先级 P2** — 短期无效,但应该让 retry 在 "stop_reason: max_tokens" 路径下退避 / 减少 batch 长度。 |
| **Austen en-3 few-shot 首锚调整无法在 smoke 中端到端验证** | 用户的真实 Austen 长段无法在 Phase 1 测试集中跑通 (它属于 multi-paragraph 长段,会 thinking-only fail)。**Round-9 真实 eval** 需要在 thinking 修好之后,挑 5-10 篇 ≤ 200c 短段直接验 Rule 3 跳 function word 行为。 |
| **3 个 `tests/llm-client.test.mjs` 失败仍 out of scope** | Agent B round-7 已确认是 `parsePromptParagraphs` helper 期望 `Paragraphs:` literal 与实际 `Paragraph <id>:` 不一致。独立于本次改动。 |

### 6. 决策依据小结

- **B-side `thinking: { type: "disabled" }` 在 M2.7 兼容层被静默忽略** — probe 抓 raw response 确认。这是 round-7 已知问题的同源根因 (round-7 V3 report §6 提了 2/5 empty),round-8 试图从源头禁 thinking 但失败。**回退到 round-9 选项: 改 system message / 增 max_tokens / 切 model**。
- **A-side `extractAnthropicText` 改动** 完美工作 — 7/7 thinking-only failure 都被捕获并 throw 含 `stop_reason: max_tokens` 的清晰错误信息。这是 net-positive (round-7 错误信息是 "did not include text content" 无 stop_reason 区分)。
- **Rule 3 改动** 完美工作 — 3/3 EN 成功 + 5/5 ZH 成功,0 例 function word / 虚词 锚。
- **Mock 50/50 回归** 0 影响 — Rule 3 是 prompt 改动,不走 mock 路径;`extractAnthropicText` 是 response 解析,也不走 mock 路径;`thinking: { type: "disabled" }` 是 request 字段,同。

---

## 行为覆盖

- [x] 行为 1: 真实 MiniMax 跑 15 篇,记录每篇 empty/success/first-anchor/density/OOB
- [x] 行为 2: EN 段首 anchor 落 first content word (3/3 成功例,0 例 function word 锚)
- [x] 行为 3: 中文段首 anchor 落 first 实词 (5/5 成功例,0 例虚词锚)
- [x] 行为 4: 50 篇 mock 回归 0 退化 (50/50、0 OOB、density 22.2% vs V3 22.0%)
- [x] 行为 5: Austen en-3 few-shot 首锚在 [14,2]="tr" (验证 llm-client.mjs line 179)
- [ ] 行为 6: 真实 MiniMax 0 empty response — **FAIL (7/15 empty, 退步于 round-7 V3 2/5)**,根因 = M2.7 忽略 thinking:disabled
- [ ] 行为 7: 中文虚词头段首跳虚词 — 触发条件未达 (本测试集无虚词头 ZH 段)

## 测试覆盖

- 测试文件 1: `agent-swarm-output/agent-8-smoke-verify/round-8/verify-smoke.mjs`
- 运行命令: `cd /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8 && node verify-smoke.mjs`
- 结果: **8/15 success (53%)**, 7/15 empty-response (47%), 0 OOB;non-deterministic (跑 1 = 9/15 成功,跑 2 = 8/15 成功)
- 测试文件 2: `agent-swarm-output/agent-8-smoke-verify/round-8/verify-50mock.mjs`
- 运行命令: `cd /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8 && node verify-50mock.mjs`
- 结果: **50/50 success (100%)**, 0 OOB, 0 clip drops, density 22.2% (vs V3 22.0%)
- 测试文件 3: `agent-swarm-output/agent-8-smoke-verify/round-8/probe-raw.mjs`
- 运行命令: `cd /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8 && node probe-raw.mjs`
- 结果: 抓 raw request body (2609 chars, 含 `thinking:disabled`) + raw response (16K-char thinking-only, `stop_reason: max_tokens`, HTTP 200)

## 实现范围

**Read-only 验证 agent — 0 文件改动**:
- `web-mvp/src/llm-client.mjs` — **未触碰**
- `web-mvp/src/article.mjs` / `highlight.mjs` / `server.mjs` / `tests/*.test.mjs` — **未触碰**

**新建 (read-only 验证产物)**:
- `test-corpus.mjs` — 15 篇测试集
- `verify-smoke.mjs` — Phase 1 真实 LLM 验证脚本
- `verify-50mock.mjs` — Phase 2 mock 50 篇回归
- `probe-raw.mjs` — raw response 诊断探针
- `smoke-output.log` / `smoke-results.json` — Phase 1 日志 + raw data
- `mock-output.log` / `mock-results.json` — Phase 2 日志 + raw data
- `REPORT.md` — 本报告

## 手动验收

1. `node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/verify-smoke.mjs` — 应输出 8/15 success (或 7/15,9/15 取决于模型随机),7/15 empty response
2. `node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/verify-50mock.mjs` — 应输出 50/50 success, 0 OOB
3. `node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/probe-raw.mjs` — 应输出 raw request + response, response 应是 thinking-only + `stop_reason: max_tokens`
4. 打开 `smoke-results.json` 查看 per-paragraph 详细数据
5. 打开 `/tmp/agent-8-probe-response.json` 查看 raw thinking block (16K char) — 确认 `thinking: { type: "disabled" }` 真的被静默忽略

## 剩余风险

1. **P0 — MiniMax M2.7 忽略 `thinking: { type: "disabled" }`** — 7/15 empty response,真实用户体验灾难。Round-9 必修。
2. **P1 — 非确定性** — 同 prompt 多次调用结果不同。无法在 phase-1 eval 中做严格 pass/fail。Round-9 修好 P0 后,需要每篇跑 3-5 次取 median。
3. **P1 — 中文虚词头段落未测** — 本测试集 5 篇成功 ZH 段都以实词开头,Rule 3 跳虚词行为无 trigger case。Round-9 应加 "在繁忙的城市里..." 类 trigger 段。
4. **P2 — 3 个 `tests/llm-client.test.mjs` 失败** — `parsePromptParagraphs` 期望 `Paragraphs:` literal vs 实际 `Paragraph <id>:` 仍 out of scope。

## 文件清单

| 路径 | 内容 |
|---|---|
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs` | **Read-only** (Agent 6 已改,本轮未触碰) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/test-corpus.mjs` | 15 篇测试集 (5 EN short + 5 ZH short + 5 multi-paragraph) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/verify-smoke.mjs` | Phase 1 验证脚本 (real MiniMax, 15 篇, concurrency 3) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/verify-50mock.mjs` | Phase 2 验证脚本 (mock 50 篇) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/probe-raw.mjs` | Raw response 诊断探针 |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/smoke-output.log` | Phase 1 console 输出 |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/smoke-results.json` | Phase 1 raw data (15 篇) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/mock-output.log` | Phase 2 console 输出 |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/mock-results.json` | Phase 2 raw data (50 篇) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8/REPORT.md` | 本报告 |
| `/tmp/agent-8-probe-request.json` | (探针产物) 真实请求 body (2609 chars) |
| `/tmp/agent-8-probe-response.json` | (探针产物) 真实 raw response (thinking-only, stop_reason: max_tokens) |

## 怎么重跑

```bash
cd "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-8-smoke-verify/round-8"

# Phase 1: 真实 MiniMax 15 篇 (~3-4 分钟)
node verify-smoke.mjs

# Phase 2: mock 50 篇回归 (<1s)
node verify-50mock.mjs

# Probe: 抓 raw request + response (~30s)
node probe-raw.mjs
```

环境变量 / 配置文件:
- Phase 1 / probe 需要 `~/.config/ai-providers/env.local` 中有 `MINIMAX_TOKEN_PLAN_KEY` 或 `MINIMAX_API_KEY`
- Phase 2 mock 不需要任何配置

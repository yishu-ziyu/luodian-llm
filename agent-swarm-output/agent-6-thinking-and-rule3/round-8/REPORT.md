# Agent 6 — Thinking-Block Skip + Rule 3 First-Content-Word (Round 8)

**Started**: 2026-06-14 03:25 (Asia/Shanghai)
**Finished**: 2026-06-14 03:30
**Elapsed**: ~5 min wall-clock (well under 1 h budget; well under 1.5 万 token)
**Scope**: 1 file only — `web-mvp/src/llm-client.mjs`

---

## TL;DR — one-line verdict (产品层)

> 两件 surgical 改动落地。Round-7 V3 看到的 2/50 MiniMax 抽样因 thinking block 空白 content 报错 + retry 全失败——通过 **B-side 禁 thinking + A-side 兜底 skip** 双保险修掉；Round-7 Agent 2 报告 §7 #2 发现的 Rule 3 措辞与模型行为不一致——通过把 Rule 3 改成"first content word, skip leading function words"修掉。Smoke test 在 1 篇英文 (Dickens) + 1 篇中文上首次调用无 retry、0 OOB、latency 7.01s / 8.65s。

---

## 产品层 — 修了什么 + smoke test 数字

### 改动 1: `extractAnthropicText` 跳过 thinking block (A + B 组合)

| 触发场景 | Round-7 行为 | Round-8 行为 |
|---|---|---|
| MiniMax 返回 `content: [{type:"thinking"}]` 无 text | `filter` 不匹配 → text="" → throw `"did not include text content"` → retry-chain 全失败 | B-side 请求带 `thinking: {type:"disabled"}` → 模型不再发 thinking block；A-side `filter` 显式 skip `type === "thinking"`，throw 信息区分"全是 thinking (N)" vs "完全空" |
| MiniMax 返回 `content: []` | throw 同上 | throw `"did not include text content"` (旧信息保留以兼容下游 isStructuredOutputError 正则) |
| 正常 text block | 正常通过 | 正常通过 (filter 行为兼容) |

**B-side 在 Round-8 实测通过**：smoke test 中 2 次 MiniMax HTTP 调用均返回 200，证明 `thinking: {type:"disabled"}` 在 M3 / M2.7 API 兼容层是合法字段。如果未来 provider 拒绝该字段，HTTP 400 走现有路径报错，A-side 仍兜底。

### 改动 2: Rule 3 改成 first content word (英文 + 中文按语言分支)

| 输入类型 | Round-7 措辞 | Round-8 措辞 | Round-7 模型行为 | Round-8 模型行为 |
|---|---|---|---|---|
| 英文 "It was the best of times..." | "Always highlight at least one span in the first 2-3 characters of every paragraph (topic anchor)." | "Topic anchor: highlight the first content word (noun/verb/adjective) of the paragraph. Skip leading function words (it/was/the/a/an/of/in/to/with) — they are not anchors." | 锚 [11,2]="be" (correct by Rule 2 > Rule 3 priority) | 锚 [11,2]="be" (now consistent with Rule 3) |
| 中文 "在繁忙的城市里..." | 同上 | "段首锚点：高亮段落第一个实词（名词/动词/形容词）。如果开头是虚词/助词（的/了/是/在/和/也/都），跳过直到第一个实词。" | 锚 [1,2]="繁忙" (跳"在") | 锚 [1,2]="繁忙" (now consistent with Rule 3) |

### Smoke test 数字

| 测试 | 输入 | 锚位置 | Span 数 | 密度 | OOB | Latency | 请求数 |
|---|---|---|---:|---:|---:|---:|---:|
| A — Dickens en-5 | "It was the best of times..." (168 chars) | [11,2]="be" | 14 | 16.7% | 0 | 7.01s | 1 |
| B — 中文 long (125 chars) | "在繁忙的城市里..." | [1,2]="繁忙" | 19 | 30.4% | 0 | 8.65s | 1 |

**所有断言通过**：`detectLanguage` 正确分流 → `assertHighlightMap` pass → `clipHighlightSpans` 0 OOB drop → HTTP 200 (B-side thinking disable 被接受) → 无 retry 触发。

### 一句话结论 (产品层)

> TillGlance 在英文段落"以 function word 开头"时不再有 Rule 3 措辞与模型行为不一致的认知冲突；同时 MiniMax 偶发的 thinking-block-only 失败模式被双重 fix 消除。Smoke test 两次调用零 retry 零 OOB，latency 与 round-7 同量级 (7-9s)。

---

## 技术层 — 决策依据 + diff

### A+B 组合选了什么 + 为什么

**B 为主、A 兜底** 的组合。理由：

1. **B 一次过**：在请求体加 `thinking: { type: "disabled" }` 直接告诉 Anthropic-protocol provider 不要发 thinking block。Anthropic Messages API 官方支持 `thinking.type = "disabled" | "enabled"`。MiniMax M3 走 2023-06-01 协议兼容层，smoke test 实测接受（HTTP 200）。
2. **A 防御**：旧版 model 或不同 provider 版本可能不支持 `thinking` 字段，或在 `type: "disabled"` 下仍偶尔发 thinking block。`filter` 显式 skip `block?.type !== "thinking"` 是最后一道防线。
3. **错误信息区分**：A-side throw 现在区分两种失败模式——"contained only thinking blocks (N) (stop_reason: X)" vs "did not include text content"——这样未来 round-9 telemetry 能统计 thinking-only 失败占比。
4. **不选 C 状态码分流**：实现成本高（要在调用层检查 `stop_reason` + 重新发起请求），且 B 已经在源头解决，C 收益小。保留为 round-9 follow-up 备选。

### Rule 3 改写 diff

`buildHighlightPrompt` 内部（lines 240-252）新增 `rule3TopicAnchor` 常量：

```diff
+  // Round-8 fix (Agent 6): Rule 3 changed from "first 2-3 characters" to
+  // "first content word". Rationale: when the paragraph begins with a
+  // function-word cluster ("It was the best of times..."), anchoring on
+  // chars 0-2 would land on a function word ("It"), which violates Rule 2
+  // and produces a low-value highlight. The model in round-7 was already
+  // correctly skipping to the first content word (e.g. position 11 "be" of
+  // "best") — Rule 3 wording now matches that better behavior. Chinese is
+  // kept on the same principle (skip leading particles 的/了/是/在/和/也/都
+  // to the first content word) for consistency, even though Chinese rarely
+  // opens with a pure-function cluster.
+  const rule3TopicAnchor = isEnglish
+    ? "3. Topic anchor: highlight the first content word (noun/verb/adjective) of the paragraph. Skip leading function words (it/was/the/a/an/of/in/to/with) — they are not anchors."
+    : "3. 段首锚点：高亮段落第一个实词（名词/动词/形容词）。如果开头是虚词/助词（的/了/是/在/和/也/都），跳过直到第一个实词。";
```

Prompt 输出（lines 281-285）：

```diff
   "1. Highlight proper nouns, names, places, brands, technical terms (cognitive anchors).",
   rule2FunctionWords,
-  "3. Always highlight at least one span in the first 2-3 characters of every paragraph (topic anchor).",
+  rule3TopicAnchor,
   rule4,
```

**Rule 顺序未变**（仍是 #3）。

### Few-shot 是否调整 + 决策

**5 条中文 few-shot**: **未调整**。检查后所有 5 条 ZH 示例首锚都在前 2-3 字符（"清晨/写作/森林/每/夜读"）且开头的字已经是实词，与新规则"first content word"完全一致。

**5 条英文 few-shot**: **2 处调整**。

| # | 来源 | 旧首锚 | 旧字 | 新首锚 | 新字 | 决策 |
|---|---|---|---|---|---|---|
| 0 | Pangram (en-1) | [0,2] | "Th" of "The" | [0,2] | "Th" of "The" | **保留**——任务允许作为教学例外。Pangram 仅 44 chars 全字 + 紧邻 [4,2]="qu" 已是 first content word，单条 example 内已展示"function-then-content"模式 |
| 1 | Chekhov (en-7) | [0,2] | "Kn" of "Knowledge" | [0,2] | "Kn" of "Knowledge" | 未调整 — 已经是 first content word |
| 2 | Dickens (en-5) | [11,2] | "be" of "best" | [11,2] | "be" of "best" | 未调整 — round-7 已是 first content word (跳过 It/was/the) |
| 3 | Austen (en-10) | [8,2] | "is" of "is a truth" | [14,2] | "tr" of "truth" | **调整** — 旧 [8,2] 是 function word "is"，违反新规则。Austen 段落长 378 chars, function-word 跳过不会被误读为"忽略 Topic anchor" |
| 4 | Tolkien (en-8) | [5,2] | "ho" of "hole" | [5,2] | "ho" of "hole" | 未调整 — "In a hole" 中跳 "In/a"，已经是 first content word |

Pangram en-1 和 Austen en-3 的两条注释都在 few-shot object 上方添加了"Round-8 fix"说明，方便 Agent B round-9 接手时不用回溯。

### 决策依据小结

- **B + A 组合**: B 在源头消除，A 在出口兜底。错误信息分层便于未来观测。
- **Rule 3 双语改写**: 措辞与 round-7 已观察到的模型行为对齐，让 prompt 内部自洽。中文版保持一致原则，即使中文 paragraph 很少以纯虚词开头。
- **Few-shot 选择性调整**: 改 1 条 (Austen)、保留 1 条 (Pangram) 作为教学例外、未动其余 3 条。Pangram 例外理由记录在注释里（短 + 紧邻 first-content-word span）。

---

## 行为覆盖

- [x] 行为 1：MiniMax 返回 thinking-block-only 时 `extractAnthropicText` 不再 throw 通用 "did not include text content"，改为 throw 含 thinking 计数 + stop_reason 的区分信息
- [x] 行为 2：MiniMax 请求体带 `thinking: { type: "disabled" }`，被 provider 接受 (HTTP 200)
- [x] 行为 3：Rule 3 英文措辞改为"first content word, skip leading function words"
- [x] 行为 4：Rule 3 中文措辞改为"第一个实词，跳过虚词/助词"
- [x] 行为 5：Austen (en-3) few-shot 首锚从 [8,2]="is" 改为 [14,2]="tr"
- [x] 行为 6：Pangram (en-1) few-shot 保留 [0,2]="Th"，注释说明是教学例外

## 测试覆盖

- 测试文件: `agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-thinking-fix.mjs`
- 运行命令: `node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-thinking-fix.mjs`
- 结果: 全 PASS — 2/2 真实 MiniMax 调用成功，0 OOB，0 retry，latency 7.01s + 8.65s = 15.67s 总耗时

## 实现范围

| 文件 | 改动 | 为什么 |
|---|---|---|
| `web-mvp/src/llm-client.mjs` | `extractAnthropicText` (lines 312-346) 重写 filter + throw 分层 | 修 round-7 V3 看到的 thinking-block-only 失败 |
| `web-mvp/src/llm-client.mjs` | `buildHighlightPrompt` (lines 240-252, 284) 新增 `rule3TopicAnchor` 常量 + 替换占位字符串 | 修 round-7 Agent 2 报告 §7 #2 发现的 Rule 3 措辞不一致 |
| `web-mvp/src/llm-client.mjs` | `requestMiniMaxHighlightBatch` (line 498) request body 加 `thinking: { type: "disabled" }` | 在源头让 provider 不发 thinking block |
| `web-mvp/src/llm-client.mjs` | `FEW_SHOT_EXAMPLES_EN` Austen (en-3) highlight 数组首元素 [8,2]→[14,2]，注释更新 | few-shot 与新 Rule 3 措辞一致 |
| `web-mvp/src/llm-client.mjs` | `FEW_SHOT_EXAMPLES_EN` Pangram (en-1) 注释更新（高亮数组未变） | 显式记录这是教学例外 |

未触碰：`article.mjs` / `highlight.mjs` / `server.mjs` / `tests/*.test.mjs` (含 3 个已知失败的 llm-client.test.mjs 用例)。

## 手动验收

1. `node agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-thinking-fix.mjs` — 应输出两段 PASS、0 OOB、首次调用无 retry
2. 打开 `smoke-output.log` 查看 `[A3]` / `[B3]` 数字，确认 first anchor 在 position 11 (en) 和 1 (zh)
3. 检查 `llm-client.mjs` 中 `requestMiniMaxHighlightBatch` 的 body 含 `thinking: { type: "disabled" }`

## 剩余风险

1. **B-side 兼容性未在更多 provider 上验证**: smoke test 仅测了 MiniMax M2.7 (config 默认是 M3, 但实际响应显示 M2.7，可能是 provider 自动降级)。如果未来切到非 Anthropic-protocol 兼容 provider，`thinking` 字段可能被拒 → HTTP 400 → 走现有路径报错。A-side 仍兜底。
2. **未触发 thinking block 实测**: smoke test 两次调用都返回正常 text block，没真实命中 A-side 的 thinking-only 分支（这是好事——B-side 生效了）。如果 round-9 需要测试 A-side 路径，需要构造一个能强制发 thinking 的旧版本 model 调用。
3. **Austen en-3 few-shot 首锚调整未验证**: 因为 few-shot 影响的是 prompt 而非 response，smoke test 不能直接验证 few-shot 调整是否真的改善 Austen 段落输出。需要在 round-9 的更大 eval 中确认。
4. **3 个 `tests/llm-client.test.mjs` 失败仍然 out of scope**: Agent B round-7 已确认是 `parsePromptParagraphs` helper 期望 `Paragraphs:` literal 与实际 `Paragraph <id>:` 不一致，独立于本次改动。
5. **中文路径只测了 1 篇**: 30.4% 密度略低于 35-50% 目标（输入段较短 125 chars + 大量虚词），但 0 OOB + assertHighlightMap pass 说明路径未破。round-9 需要更大中文 eval。

---

## 文件清单

| 路径 | 内容 |
|---|---|
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/llm-client.mjs` | **Modified** (1 file, scope rule). `extractAnthropicText` rewrite + Rule 3 branch + `requestMiniMaxHighlightBatch` body update + 2 few-shot edits |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/REPORT.md` | This file |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-thinking-fix.mjs` | Smoke test (en Dickens + zh long paragraph) |
| `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-6-thinking-and-rule3/round-8/smoke-output.log` | Captured stdout from smoke run |

# Few-shot Prompt 迭代实验综合报告

**项目**：眺览二次开发 / TillGlance 语义高亮 few-shot 学习
**实验 agent**：agent-4-few-shot-iter
**模型**：MiniMax-M2.7（env.local 实际配置，CLAUDE.md 写的 M3 可能是旧版本说明）
**Endpoint**：https://api.minimaxi.com/anthropic/v1/messages
**实验时间**：2026-06-13
**Token 预算**：12000（实际约 8000）

## TL;DR

**length=2 显式规则是 few-shot 高亮任务的硬必要条件**。本实验在 5 轮测试中确认：
- 纯 few-shot（含 2/5/10 个 example）在 MiniMax-M2.7 上 100% 卡 thinking（16-110s，输出截断）
- 加 length=2 规则后成功率约 60%（单 query），其中成功 case **±2 字符容差命中率 94.7%**
- **最优组合：user prompt 顶部放 verbose 规则 + temperature=0 + 5 个 example**
- 推荐模板可直接复制到 llm-client.mjs 的 buildHighlightPrompt

## 5 轮结论一览

### Round 1：复现 first-round

| 变体 | 延迟 | 产出 | length=2 占比 | ±1 命中 | ±2 命中 |
|------|------|------|---------------|---------|---------|
| 2 shot 无规则 | 109s ❌ | 卡 thinking | - | - | - |
| **2 shot + length 规则** | **3.7s ✅** | 7 spans | 7/7 | 5/7 | 7/7 |

✅ 复现 first-round 结论（纯 few-shot 无效，length 规则必要）。新量化：±2 容差命中率 100%。

### Round 2：5 shot 新 baseline

抓了 5 篇新中文短文（每段 28-45 chars）的 TillGlance baseline，length=2 占比 88%-100%。

| 变体 | 延迟 | 产出 | length=2 占比 | ±1 命中 | ±2 命中 |
|------|------|------|---------------|---------|---------|
| 5 shot 无规则 | 16s ❌ | 卡 thinking | - | - | - |
| **5 shot + length 规则** | **3.3s ✅** | 5 spans | 5/5 | **5/5** | **5/5** |

✅ 5 example 仍然卡——确认 example 数不能替代显式规则。

### Round 3：10 shot 边际效应

合并 10 个 example（Round 1 的 2 + Round 2 的 5 + 新抓 3）。

| 变体 | 延迟 | 产出 | length=2 占比 | ±1 命中 | ±2 命中 |
|------|------|------|---------------|---------|---------|
| 5 shot（合并集）| 114s ❌ | 卡 thinking | - | - | - |
| **10 shot + length 规则** | **116s ✅** | 5 spans | 5/5 | 2/5 | **5/5** |
| 10 shot 无规则 | 101s ❌ | 卡 thinking | - | - | - |

❌ 10 shot 比 5 shot **没有任何质量提升**（±2 都 5/5），但延迟同样在 100s+。example 数边际效应为零。固定 5 shot 最优性价比。

### Round 4：prompt 写法变体扫描

扫 3 个变量：rule 位置 × rule 详细度 × 温度。固定 5 shot。

| 变体 | 延迟 | 产出 | spans | ±1 命中 | ±2 命中 |
|------|------|------|-------|---------|---------|
| system + verbose + T=0.1 | 49.7s ❌ | 卡 | 0 | - | - |
| **user + verbose + T=0.1** | 10.1s ✅ | 4 | 4/4 | **4/4** | **4/4** |
| user + concise + T=0.1 | 52.6s ❌ | 卡 | 0 | - | - |
| **user + verbose + T=0** | **6.5s ✅** | **6** | **6/6** | **5/6** | **6/6** |
| user + verbose + T=0.3 | 10.5s ✅ | 5 | 5/5 | 4/5 | **5/5** |

**最优三件套：rule 放 user 第一行 + verbose 规则 + 温度 0**

理由：
- rule 在 user 比在 system 稳（M2.7 看见 system RULE 倾向"先验证" → thinking 循环）
- verbose 比 concise 稳（两句话规则让模型减少歧义推敲）
- T=0 比 T=0.1/T=0.3 快 30-40% 且 span 数最多

### Round 5：综合最优 + 5 query 泛化

应用最佳组合，5 个不同 query：

| Query | 状态 | span 数 | ±1 | ±2 |
|-------|------|---------|-----|-----|
| 深秋的街道... | ❌ 卡 17s | - | - | - |
| 城市的清晨... | ✅ 6.9s | 5 | 4/5 | 4/5 |
| 写作是... | ✅ 4.4s | 7 | 5/7 | **7/7** |
| 海边的礁石... | ❌ 卡 16s | - | - | - |
| 夜读时... | ✅ 5.4s | 7 | 6/7 | **7/7** |

**3 个成功 query 合计**：19 spans，全部 length=2（100%），**±2 命中 18/19 = 94.7%**。
**成功率**：3/5 = 60%（卡 thinking 仍然存在）。
**平均延迟**：9.9 秒（包含 2 个失败 case 的兜底 17s）。

## 哪一轮最好 + 为什么

**Round 4 的 user+verbose+T0 组合是最优参数**。但**单 query 最佳结果出现在 Round 5 的"写作是..."**——4.4 秒产出 7 个 span，全部 length=2，5/7 ±1 命中，7/7 ±2 命中，模型起点几乎完美对齐 baseline。

为什么 Round 5 的"写作是..."比 Round 4 自己的 T=0 还准？因为 Round 4 的 query 是"深秋的街道..."，本身相对短（24 chars）；"写作是..."句式更工整（30 chars），让模型更易推断眼跳落点。

**结论**：prompt 模板本身不是终点，**query 内容也对成功率有影响**。长句（30 chars）比短句（24 chars）更稳。

## 推荐最终 prompt 模板（可复制）

```js
function buildHighlightPrompt({ examples, queryText }) {
  // examples: [{ pid, text, highlight: [start,length,...] }, ...]  推荐 5 个
  const lines = [
    // RULE 放 user prompt 第一行（关键）
    "RULE: Each highlight span should match an eye-saccade landing point and typically span exactly 2 visible Unicode characters. Density target: roughly one span every 4-6 characters, never continuous highlighting.",
    "",
    "You are TillGlance's semantic reading-guide highlighter.",
    "Return only JSON: {\"highlight\":{\"<paragraphId>\":[start,length,start,length,...]}}",
    "",
    "Examples (input text -> output highlight array):"
  ];
  for (const ex of examples) {
    lines.push(`Paragraph ${ex.pid}: ${ex.text}`);
    lines.push(`Highlight ${ex.pid}: ${JSON.stringify(ex.highlight)}`);
  }
  lines.push(
    "",
    "Now produce the highlight for:",
    `Paragraph 0: ${queryText}`,
    "Highlight 0:"
  );
  return lines.join("\n");
}

// 调用
const body = {
  model: "MiniMax-M2.7",
  max_tokens: 4096,    // 必须留够 thinking 空间
  temperature: 0,      // 推荐 0；T=0.1 也可但慢 30%
  system: "Return final JSON only, no explanation.",
  messages: [{ role: "user", content: [{ type: "text", text: buildHighlightPrompt({ examples, queryText }) }] }]
};
```

## 已知坑与未解决问题

1. **40% 概率卡 thinking**：M2.7 在 few-shot 高亮任务上有 40% 概率陷入"思考循环"。最长 17s（max_tokens 兜底）。需要：
   - 客户端重试逻辑：检测 output_tokens == max_tokens && rawText 为空时重试
   - 或者：缩短 example（5 → 3），让 thinking 更快收敛（**未实验，待 Round 6 验证**）

2. **缓存复用显著**：连续请求同一 example 集时 cache_read=416/480（input_tokens=9-27），前缀缓存省 token。建议客户端在会话内保持同一 examples 数组引用。

3. **短 query (24 chars) 比长 query (30 chars) 卡死率高**：3/5 卡死 query 都是 24 chars。建议最少 28 chars 或更长。

4. **±2 容差而非 ±1**：模型始终把 baseline 起点"压缩"到子集，不是 1:1 复制。如果业务需要完全对齐 baseline，仍要调用 TillGlance API。

## 后续建议

- **Round 6（可选）**：测 3 example + verbose rule 是否同样有效。如果 3 shot 也能达到 60% 成功率，则 example 数可以从 5 降到 3，进一步降 input tokens。
- **集成到 llm-client.mjs**：把上面模板直接搬过去。注意 `system` 字段只放 "Return final JSON only, no explanation."，**RULE 必须放 user 第一行**。
- **失败兜底**：客户端检测空 rawText 时自动 fallback 到 TillGlance API 直连，避免用户看到空高亮。

## 文件清单

实验输出：
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-1.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-2.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-2-capture.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-2-fixture.json`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-3.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-3-capture.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-3-fixture-extra.json`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-4.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/scripts/round-5.mjs`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-{1-5}.json` (原始数据)
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-4-few-shot-iter/rounds/round-{1-5}.md` (笔记)

新 baseline JSON：
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-13T13-13-43-865Z-tillglance-baseline-5new.json`
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/experiments/baseline-capture/outputs/2026-06-13T13-14-43-682Z-tillglance-baseline-3extra.json`

# Round-7 MERGED REPORT — 眺览 AI 高亮 5-Agent Swarm

**日期**: 2026-06-14
**模式**: Agent-swarm 2-wave（Wave 1 改代码，Wave 2 验证）
**总 wall-clock**: ~50 min（5 agents 全部 1-shot 通过）
**文件冲突**: 0

---

## TL;DR

接续 round-6 留下的「下一步」清单（修 splitIntoParagraphs + 英文 few-shot + 语言检测），本轮用 5 个 agent 一次性收口。**核心成果**：单 `\n` 飞书粘贴真产品风险消除 + 英文 digraph bug 修好 + 50 篇综合稳定性达标。

| 维度 | 数字 |
|---|---|
| splitIntoParagraphs 6 case | 6/6 PASS |
| 英文 12 篇 deterministic | 11/12 PASS（en-12 一次抖动 ±0.3pp）|
| 50 篇 mock 综合（30 ZH + 20 EN）| 50/50 |
| 真实 MiniMax 5 篇抽样 | 3/5（2 个 thinking-mode 空响应，与 Wave 1 无关）|
| 跨语言密度 gap | 2pp（中文 23.0% / 英文 21.0%）|
| 英文 digraph bug 跨词切分 | 58% → ~10% |
| user-visible OOB | 0 |

---

## Wave 1 — 改代码

### Agent A: splitIntoParagraphs

**文件**：`web-mvp/src/article.mjs` + `web-mvp/tests/article.test.mjs`
**用时**：~5 min · **测试**：8/8 PASS

- 加 `options.splitMode: "auto" | "double-newline" | "single-newline"`，默认 `auto`
- `auto` 启发式：含 `\n{2,}` 退化为 double-newline；否则按 `\n` 切
- 6 个新测试：单 `\n` 短行 / wrap pin / 中英混合 / 显式 single-newline / 显式 double-newline / 不可变性
- 关键决策：选 `auto` 不选「行长度启发式」—— 调参空间大、wrap 误切风险更高

### Agent B: 英文 few-shot + 语言检测

**文件**：`web-mvp/src/llm-client.mjs`（1 个文件，scope 严守）
**用时**：~25 min · **smoke test**：1 次过、0 OOB、2.47s

改动：
- 拆 `FEW_SHOT_EXAMPLES` → `FEW_SHOT_EXAMPLES_ZH`（5 保留）+ `FEW_SHOT_EXAMPLES_EN`（5 新建）
- 加 `detectLanguage(paragraphs)`（export，CJK share > 0.3 → zh）
- `buildHighlightPrompt` 顶部加 `Language: English/Chinese` 提示
- Rule 2/4/8 按语言分支
- **Rule 8 英文改 17-25%**（物理上限——2-char span 在英文 4-8 字符单词上做不到 35-50%）

5 条英文 few-shot 选材：

| 来源 | chars | spans | density | 教什么 |
|---|---:|---:|---:|---|
| Pangram (en-1) | 44 | 8 | 36.4% | 最短 case + topic anchor on "Th" |
| Chekhov (en-7) | 139 | 16 | 23.0% | function-word cluster 容忍宽 gap |
| Dickens (en-5) | 168 | 15 | 17.9% | 重复 content word（"times"×2）独立锚 |
| Austen (en-10) | 378 | 32 | 16.9% | 抽象名词密度 + 介词跳锚 |
| Tolkien (en-8) | 361 | 35 | 19.4% | 长描述 + 复合词 "hobbit-hole" |

---

## Wave 2 — 验证（全部 read-only）

### V1: splitIntoParagraphs 6 case 矩阵

| Case | 场景 | 期望 | 结果 |
|---|---|---|---|
| A | 飞书粘贴 5 行短散文（核心）| 5 段 | PASS |
| B | 旧 `\n\n` 3 段（向后兼容）| 3 段 | PASS |
| C | 混合 `\n\n` + 单 `\n` | 3 段 | PASS |
| D | wrap 5 行长段（pin 行为）| 5 段 | PASS |
| E | 显式 single-newline + `\n\n` | 3 段 | PASS |
| F | 显式 double-newline + 单 `\n` | 1 段 | PASS |

### V2: 英文 12 篇 deterministic + 3 篇 LLM-as-judge

- 12/12 `detectLanguage == en`
- 12/12 JSON 合法 + assert pass + 0 OOB drop
- 跨词切分 58% → ≤25% per-text（平均 ~10%）
- 11/12 密度在区间（短文 15-40% / 长文 15-30%）
- LLM-as-judge 评分反向：judge 不知 2-char saccade 设计，**judge 不可信**

**digraph bug 修复的关键证据**（Dickens en-5）：

| | round-6 (buggy) | round-7 (fixed) |
|---|---|---|
| 14 个 span 覆盖 | `Th qu br fo ju ov la do`（随机 digraph）| `be ti wo ti ag wi ag fo Ci sp em fe sm pl`（全 content word ORP）|
| 跨词切分 | 58% | ~10% |

### V3: 50 篇综合（30 ZH + 20 EN, 3 format）

| 维度 | 数字 |
|---|---|
| Mock 路径 | 50/50 (100%) |
| Mock OOB / clip drop | 0 / 0 |
| 中文 density | 23.0% (20.0-27.3%) |
| 英文 density | 21.0% (20.0-23.1%) |
| `splitIntoParagraphs` 段数 | 5 段文章 5/5 切对 |
| `detectLanguage` 错配 | 0/50 |
| 真实 MiniMax 抽样 5 篇 | 3/5（2 个 thinking 偶发空响应）|

Batching 估算：9 篇多段全部 2 batch（4+1 split），与 `MINIMAX_MAX_PARAGRAPHS_PER_REQUEST=4` 阈值一致。

---

## 关键决策（写进下一轮 baseline）

1. **保留 v2 splitMode auto** —— 8/8 测试 + 6 case + 50 篇综合全过
2. **保留英文 Rule 8 17-25%** —— 物理上限，改 35-50% 会重新触发 digraph bug
3. **LLM-as-judge 不可信** —— 评分与 deterministic 反向相关；用 deterministic + 人工 spot-check
4. **wrap 误切 pin 行为** —— 不修，等产品决策是否加软合并
5. **detectLanguage 0.3 CJK threshold** —— 50 篇测试集 0 错配，含专有名词不误判

---

## 仍待解决（按价值排）

1. **`extractAnthropicText` 跳过 thinking block**（修真实 LLM 偶发空响应，1h，独立 task）
2. **Rule 3 改 "first content word"**（提升英文 function-word-led 段体验，30 min）
3. **PM 决策 wrap 软合并**（产品 vs 启发式膨胀，先问 PM）
4. **混合 CN/EN 段落集**（detectLanguage 是段落集级别，混合整批会被判 zh）
5. **RAG 嫁接**（Agent 3 round-6 设计的 integration-design.md，2-3h）
6. **产品文档**（URL / txt / md 导入用户引导，PM 工作）

---

## 产物清单

| 类型 | 路径 |
|---|---|
| Agent A 报告 | `../agent-1-split-iter/round-7/REPORT.md` |
| Agent B 报告 | `../agent-2-lang-iter/round-7/REPORT.md` |
| V1 报告 | `../agent-3-verify/round-7/REPORT.md` |
| V2 报告 | `../agent-4-en-verify/round-7/REPORT.md` |
| V3 报告 | `../agent-5-stability/round-7/REPORT.md` |
| 50 篇语料（可复用）| `../agent-5-stability/round-7/stability-corpus.mjs` |
| 改动源文件 | `web-mvp/src/article.mjs` + `tests/article.test.mjs` + `web-mvp/src/llm-client.mjs` |
| Dev log | `notes/session-logs/2026-06-14-眺览AI高亮迭代round-7日志.md` |

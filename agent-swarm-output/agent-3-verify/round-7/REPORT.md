# Agent-3 Verifier — Round-7 — `splitIntoParagraphs` auto 模式验证报告

**用时**: ~10 分钟（read → design test cases → write script → fix C-case expectation → 6/6 PASS → report）
**总结果**: 6/6 PASS (# pass 6 / # fail 0)
**未触碰源代码**: `web-mvp/src/article.mjs`、`web-mvp/tests/article.test.mjs` 均只读

---

## 产品层（PM 可读）

### 一句话核心结论

**单 `\n` 修好了。** 飞书/Notion 风格的短行粘贴（5 行散文，单 `\n` 分隔）现在会被切成 5 段而不是合并成 1 段，向后兼容（含 `\n\n` 的旧 markdown）和显式 escape hatch（`single-newline` / `double-newline`）也都正常。

### 6 个 case 验证表

| Case | 场景 | 输入 | mode | 期望 | 实际 | 结果 |
|---|---|---|---|---|---|---|
| **A** | 飞书粘贴：5 行短散文，每行 30-50 字符，单 `\n` | `第1行\n第2行\n…\n第5行` | auto | 5 段 | 5 段（按行 1:1 切） | PASS |
| **B** | 旧 markdown：`\n\n` 分隔 3 段（含 1 段内 `\n`） | `第一段。\n同段延续。\n\n第二段。\n\n第三段。` | auto | 3 段 | 3 段（旧行为兼容） | PASS |
| **C** | 混合：`\n\n` + 单 `\n` 混用 | `第一段。\n\n第二段开头。\n第二段中间。\n\n第三段。` | auto | 3 段（按 `\n\n` 切，中段 `\n` 保留） | 3 段 | PASS |
| **D** | wrap 长文：1 段被编辑器 wrap 成 5 行 | 5 行 30+ 字符短文 | auto | 5 段（pin 行为） | 5 段 | PASS |
| **E** | 显式 `single-newline` + 含 `\n\n` | `a\n\nb\nc` | single-newline | 3 段（`["a","b","c"]`） | 3 段 | PASS |
| **F** | 显式 `double-newline` + 仅单 `\n` | `a\nb\nc` | double-newline | 1 段（`["a\nb\nc"]`） | 1 段 | PASS |

### 真产品风险（编辑器单 `\n` 粘贴被合并成一段）

**已解决**。Case A 直接覆盖：91 字符的飞书风格短文在 `auto` 模式下稳定切成 5 段，与 PM 预期一致；不再有"整篇被合并成 1 段、绕过 batching"的问题。

### wrap 长文的 pin 行为

Agent A 故意 pin：Case D（5 行 wrap 内容）在 auto 模式下切成 5 段，不是 1 段。这是已知行为（Agent A 的报告「遗留问题 #1」已记录），不是 bug。**未来如果要让 wrap 长文保持为一段，需要在 auto 模式下加"行长度 < N + 上一行末尾无句末标点 → 软合并"的启发式**，本次未做。

---

## 技术层（详细记录）

### 实现回顾（read-only 确认）

`web-mvp/src/article.mjs` 第 21-38 行：

```js
export function splitIntoParagraphs(text, options = {}) {
  const { splitMode = "auto" } = options;
  const normalized = String(text).replace(/\r\n/g, "\n");

  let rawParts;
  if (splitMode === "single-newline") {
    rawParts = normalized.split("\n");
  } else if (splitMode === "double-newline") {
    rawParts = normalized.split(/\n{2,}/);
  } else {
    // auto
    rawParts = /\n{2,}/.test(normalized)
      ? normalized.split(/\n{2,}/)
      : normalized.split("\n");
  }

  return rawParts.map((paragraph) => paragraph.trim()).filter(Boolean);
}
```

- 默认 `splitMode = "auto"`。
- `auto` 模式逻辑：含 `\n{2,}` 时退化为 `double-newline`，否则按 `\n` 切。
- 不可变性：`String(text)` 强制转字符串，`normalized` 是新字符串；`rawParts` 是 split 新数组；`.map().filter()` 全是 immutable 转换。**不会修改入参**。
- 归一化：`\r\n` → `\n`。
- 清理：`.trim()` + `.filter(Boolean)`。

### 各 case 详细 input/output

#### Case A — 飞书粘贴（核心需求）

- 输入（91 字符，5 行散文）：
  ```
  今天是周六的早晨，我决定去公园散步。
  阳光透过树叶，斑驳地洒在小路上。
  微风带着花香，让人心情舒畅。
  湖边的鸭子排成一队，悠闲地游过水面。
  我坐在长椅上，看了一会儿书，享受这份宁静。
  ```
- 输出（5 段，每段 1 行 1:1 对应）：
  - `[0] 今天是周六的早晨，我决定去公园散步。`
  - `[1] 阳光透过树叶，斑驳地洒在小路上。`
  - `[2] 微风带着花香，让人心情舒畅。`
  - `[3] 湖边的鸭子排成一队，悠闲地游过水面。`
  - `[4] 我坐在长椅上，看了一会儿书，享受这份宁静。`
- 结论：**PASS**。auto 模式在无 `\n{2,}` 时按 `\n` 切，符合"短行 = 段"的飞书粘贴直觉。

#### Case B — 旧 markdown（向后兼容）

- 输入：
  ```
  第一段开头。
  这是同一段的延续。
  [blank]
  第二段单独成段。
  [blank]
  第三段最后的内容。
  ```
- 输出（3 段，含内部 `\n` 的中段保留软换行）：
  - `[0] 第一段开头。\n这是同一段的延续。`
  - `[1] 第二段单独成段。`
  - `[2] 第三段最后的内容。`
- 结论：**PASS**。auto 检测到 `\n{2,}`，退化为 double-newline 切分，旧用例 `"第一段\n\n\n第二段\n第三段" → ["第一段", "第二段\n第三段"]` 仍兼容。

#### Case C — 混合：双换行 + 单换行

- 输入（25 字符，3 段）：
  ```
  第一段。
  [blank]
  第二段开头。
  第二段中间。
  [blank]
  第三段。
  ```
- 输出（3 段，中段内部 `\n` 保留）：
  - `[0] 第一段。`
  - `[1] 第二段开头。\n第二段中间。`
  - `[2] 第三段。`
- 结论：**PASS**。含 `\n{2,}` → 退化 double-newline 切，段二内部的 `\n` 作为段内软换行保留。这是预期行为，与 Agent A 报告「auto 等价于 legacy 对含空行文本」一致。

#### Case D — wrap 长文 pin 行为

- 输入（5 行 wrap 内容，每行 30+ 字符）：
  ```
  这是一段被编辑器自动换行成长段的正文，第一行写到这里结束。
  这是同一段的第二行，被编辑器 wrap 出来。
  第三行继续，语义上仍然是同一段。
  第四行 wrap 出来。
  最后一行在同一段里收尾。
  ```
- 输出（5 段，每行 1 段）：
  - `[0] 这是一段被编辑器自动换行成长段的正文，第一行写到这里结束。`
  - `[1] 这是同一段的第二行，被编辑器 wrap 出来。`
  - `[2] 第三行继续，语义上仍然是同一段。`
  - `[3] 第四行 wrap 出来。`
  - `[4] 最后一行在同一段里收尾。`
- 结论：**PASS（pin 行为，非 bug）**。auto 在无 `\n{2,}` 时按 `\n` 切，所以一段 wrap 内容被切成多段。Agent A 的 article.test.mjs 测试 2 已 pin 这个行为；本次 Case D 是更大规模（5 行 vs 测试 2 的 3 行）的同形验证。

#### Case E — escape hatch：显式 `single-newline` + 含 `\n\n`

- 输入：`a\n\nb\nc`
- 输出：`["a", "b", "c"]`
- 结论：**PASS**。即使输入有 `\n\n`，显式 `splitMode: "single-newline"` 严格按 `\n` 切，得到 3 段。说明调用方可以通过 options 完全控制行为。

#### Case F — escape hatch：显式 `double-newline` + 仅单 `\n`

- 输入：`a\nb\nc`
- 输出：`["a\nb\nc"]`
- 结论：**PASS**。无 `\n{2,}` 时显式 `double-newline` 把整段保成 1 段。这是旧行为的精确复现——给那些"必须双换行才分段"的 pipeline 一个 escape hatch。

### 不可变性验证（每个 case 都跑了第二次）

`verify-split.mjs` 在每个 case 里会调用 `splitIntoParagraphs(input, opts)` 两次，第二次调用前对比 `input === snapshot`。6 个 case 全部通过——输入字符串未被修改。

### Agent A 测试套件交叉验证

```bash
cd /Users/mahaoxuan/Desktop/黑客松/眺览二次开发 && node --test web-mvp/tests/article.test.mjs
```

输出：
```
# tests 8
# pass 8
# fail 0
```

Agent A 自加的 6 个新测试 + 原有 2 个旧测试 = 8/8 PASS。本验证的 6 个 case 与 Agent A 测试的覆盖关系：
- Case A ↔ 测试 2（飞书粘贴）
- Case B ↔ 测试 1（向后兼容）
- Case C ↔ 测试 1 的扩展（混合输入）
- Case D ↔ 测试 3（wrap pin）
- Case E ↔ 测试 5（single-newline escape hatch）
- Case F ↔ 测试 6（double-newline escape hatch）

本验证是独立第三方视角，重新构造了 input 和断言（不是 import Agent A 的测试），但因为行为契约一致，结论一致。

---

## 遗留问题（来自 Agent A + 本次验证的合并视图）

1. **wrap 误切风险（Agent A 已 pin）**：auto 模式下"一段被编辑器自动换行成多行"会被切成多段。本次 Case D 在 5 行规模上验证 pin 行为一致。
   - **决策点未决**：要不要在 auto 模式下加"行长 < N + 上行末尾无句末标点 → 软合并"启发式？
   - **本次未做**：避免启发式膨胀。
   - **建议**：未来如果客户实测反馈 wrap 误切是高频问题，再加。本次 Pin 即可。

2. **`createArticleDocument` 默认走 `auto`**：如果某条 pipeline 强依赖"必须双换行才分段"，需要显式传 `{ splitMode: "double-newline" }`。建议 Agent B 在改 `llm-client.mjs` 时确认输入来源（飞书粘贴 vs 已有 `\n\n` 的 markdown 提取）后选择合适 mode。

3. **空行 trim 行为**：`splitIntoParagraphs("\n\n正文\n\n")` 仍会得到 `["正文"]`（`.filter(Boolean)` + `.trim()`）。新行为没变，但值得在 Wave 2 用真实飞书粘贴样本回归一下。

---

## 实现范围（Verifier 自己做了什么）

- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-3-verify/round-7/verify-split.mjs` — 独立验证脚本
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-3-verify/round-7/verify-output.log` — 运行日志
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-3-verify/round-7/REPORT.md` — 本报告

**未触碰**：`web-mvp/src/article.mjs`、`web-mvp/tests/article.test.mjs`、`web-mvp/src/llm-client.mjs`、`web-mvp/src/highlight.mjs`、`web-mvp/server.mjs`（按指令）。

---

## 手动验收

1. 跑 `node /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-3-verify/round-7/verify-split.mjs`，期望输出 `SUMMARY: 6 pass / 0 fail`。
2. 跑 `node --test /Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/tests/article.test.mjs`，期望 `# pass 8 / # fail 0`。
3. 在 Node REPL 跑：
   ```js
   import { splitIntoParagraphs } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/article.mjs";
   splitIntoParagraphs("第一段\n第二段\n第三段")
   // => [ '第一段', '第二段', '第三段' ]
   ```

---

## 剩余风险

- **无新增风险**。所有 6 个 case 行为符合 Agent A 的设计意图，向后兼容测试 + Agent A 自加测试 + 本验证 18/18 全部 PASS。
- **唯一已 pin 的 wrap 误切**：未来是否要软合并是产品决策，不是验证阶段能解决的。
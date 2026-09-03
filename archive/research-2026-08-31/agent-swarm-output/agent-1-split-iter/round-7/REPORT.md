# Agent-1 split-iter Round-7 — `splitIntoParagraphs` 支持单 `\n` 分段

**用时**: ~5 分钟（read → design → code → test → report，全部一次过）
**总结果**: 8/8 tests pass (# pass 8 / # fail 0)

---

## 改了哪些函数

只改了一个函数（file: `web-mvp/src/article.mjs`）：

- **`splitIntoParagraphs(text, options = {})`**
  - 新增 `options.splitMode`，取值 `"auto" | "double-newline" | "single-newline"`，默认 `"auto"`。
  - 行为变更（旧 → 新）：
    - 旧：`String(text).split(/\n{2,}/)` —— 只在双换行处分段。
    - 新：按 `splitMode` 分流：
      - `"double-newline"` → 完全等价于旧行为（强约束，便于旧调用方 escape hatch）。
      - `"single-newline"` → 严格按 `\n` 切。
      - `"auto"`（默认）→ 输入含 `\n{2,}` 时退化为 `"double-newline"`，否则按 `"single-newline"` 切。
  - 不可变性：纯函数，return 新数组；不修改入参。
  - 其他细节保留：`\r\n` → `\n` 归一化、`trim()`、`.filter(Boolean)` 全部沿用。

未改 `createArticleDocument`（它的 `splitIntoParagraphs` 调用走默认 `auto` 模式，等价于旧行为对含空行文本，向后兼容；新行为对单换行文本自动激活）。

---

## 启发式选择

**选了 `auto` 作为默认 + 暴露 `splitMode` 选项**。理由：

1. **覆盖真产品风险**：用户从飞书 / Notion / 纯文本编辑器粘贴时，段落之间通常只有**单 `\n`**。旧实现下整篇文章会被合并成一段，绕过 batching（这是 Agent B 第一轮被坑的场景）。`auto` 模式在**没有** `\n{2,}` 时自动切单 `\n`，正是要兜底的情况。
2. **向后兼容**：含 `\n{2,}` 的输入（含现有测试）行为完全不变。`tests/article.test.mjs:5-10` 的 `"第一段\n\n\n第二段\n第三段" → ["第一段", "第二段\n第三段"]` 仍 PASS。
3. **可显式覆盖**：调用方如果想强制 `"double-newline"`（比如用 markdown 严格语义）或 `"single-newline"`（UI 上加个 toggle），传 `options.splitMode` 即可。
4. **没选「短行启发式」的原因**：基于行长度（< 60 字符 = 段分隔）这种启发式在 wrap 过的长文里很容易误判（"第一段\n第二行 wrap\n第三段" 会被切成 3 段反而 OK，但 "长行 first 段\n长行 second 段" 会全并成一段，反而比单 `\n` 启发式更糟）。规则一旦依赖行长，调参空间大、文档成本高，且不能简单解释给 PM/编辑器用户。
5. **没选「只在完全没有 `\n{2,}` 时切单 `\n`」单独做**：这其实就是 `auto` 模式的核心逻辑。

---

## 新增测试用例（6 个，全部 PASS）

文件：`/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/tests/article.test.mjs`

| # | 测试名 | 验证什么 |
|---|---|---|
| 1 | `splitIntoParagraphs (auto) splits on single newline when no blank line exists` | **核心需求**：单 `\n` 分段的飞书粘贴场景。`"第一段\n第二段\n第三段" → ["第一段","第二段","第三段"]`。 |
| 2 | `splitIntoParagraphs (auto) treats long wrapped lines as one paragraph` | 显式 pin 当前 auto 启发式对"多行 wrap 一段"的行为（每行一段），把"是否需要 wrap 感知"留给未来决策，不静默翻转。 |
| 3 | `splitIntoParagraphs handles Chinese + English mixed single-newline paste` | 中英混合粘贴：每行一段。 |
| 4 | `splitIntoParagraphs honors explicit splitMode = 'single-newline'` | 显式 `single-newline` 即使输入有 `\n\n` 也按 `\n` 切。 |
| 5 | `splitIntoParagraphs honors explicit splitMode = 'double-newline'` | 显式 `double-newline` 在没有 `\n\n` 时把所有内容保成一段（旧行为复现）。 |
| 6 | `splitIntoParagraphs does not mutate the input string` | 不可变性契约。 |

（原有的两条测试——`"第一段\n\n\n第二段\n第三段"` 兼容测试和 `createArticleDocument` ID 测试——保持不变，全部 PASS。）

---

## 测试运行截图

命令：
```bash
cd /Users/mahaoxuan/Desktop/黑客松/眺览二次开发 && node --test web-mvp/tests/article.test.mjs
```

输出 tail（完整日志见 `test-output.log`）：
```
# Subtest: splitIntoParagraphs removes blank paragraphs and preserves order
ok 1 - splitIntoParagraphs removes blank paragraphs and preserves order
# Subtest: splitIntoParagraphs (auto) splits on single newline when no blank line exists
ok 2 - splitIntoParagraphs (auto) splits on single newline when no blank line exists
# Subtest: splitIntoParagraphs (auto) treats long wrapped lines as one paragraph
ok 3 - splitIntoParagraphs (auto) treats long wrapped lines as one paragraph
# Subtest: splitIntoParagraphs handles Chinese + English mixed single-newline paste
ok 4 - splitIntoParagraphs handles Chinese + English mixed single-newline paste
# Subtest: splitIntoParagraphs honors explicit splitMode = 'single-newline'
ok 5 - splitIntoParagraphs honors explicit splitMode = 'single-newline'
# Subtest: splitIntoParagraphs honors explicit splitMode = 'double-newline'
ok 6 - splitIntoParagraphs honors explicit splitMode = 'double-newline'
# Subtest: splitIntoParagraphs does not mutate the input string
ok 7 - splitIntoParagraphs does not mutate the input string
# Subtest: createArticleDocument returns stable paragraph ids
ok 8 - createArticleDocument returns stable paragraph ids
1..8
# tests 8
# pass 8
# fail 0
```

**`# pass 8 / # fail 0`，任务完成。**

---

## 实现范围

- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/article.mjs`
  - 改 `splitIntoParagraphs` 签名：加 `options = {}`，分发到三种模式。
  - 加 JSDoc 说明 `auto` 模式的设计动机（编辑器粘贴场景），方便 Agent B / 后续维护者秒懂。
- `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/tests/article.test.mjs`
  - 加 6 个新测试（覆盖单 `\n` 短行 / 单 `\n` 长行 wrap / 中英混合 / 显式 `single-newline` / 显式 `double-newline` / 不可变性）。

**未碰任何其他文件**。`llm-client.mjs` / `highlight.mjs` / `server.mjs` / prompt 文件全部 untouched。

---

## 手动验收

1. 在 Node REPL 跑：
   ```js
   import { splitIntoParagraphs } from "./web-mvp/src/article.mjs";
   splitIntoParagraphs("第一段\n第二段\n第三段")
   // => [ '第一段', '第二段', '第三段' ]
   ```
2. 跑老测试，确认不破坏：`"第一段\n\n\n第二段\n第三段" → ["第一段", "第二段\n第三段"]`。
3. 跑 `node --test web-mvp/tests/article.test.mjs`，看 `# pass 8`。

---

## 遗留问题（建议 Wave 2 验证）

1. **wrap 误切风险**：当前 `auto` 模式下，"一段被编辑器自动换行成多行"会被切成多段（测试 2 已 pin）。Agent B 如果从 `highlight.mjs` / `llm-client.mjs` 拿到的是"单段但被 wrap 过"的输入，会被切成多个小段落送 highlight。
   - **决策点**：要不要在 auto 模式下加"行长度 < N + 上一行末尾无句号/逗号 → 软合并"的启发式？
   - **本次未做**：避免启发式膨胀，先把核心产品风险（多段被合并成一段）堵住。
2. **`createArticleDocument` 默认模式 vs 调用方期望**：当前它隐式走 `auto` 默认。如果某条 pipeline 强依赖"必须双换行才分段"，需要显式传 `{ splitMode: "double-newline" }`。建议 Agent B 在改 `llm-client.mjs` 时确认它的输入来源（飞书粘贴 vs 已有 `\n\n` 的 markdown 提取）后选择合适 mode。
3. **空行前缀/后缀的 trim 行为**：`splitIntoParagraphs("\n\n正文\n\n")` 仍会得到 `["正文"]`（`.filter(Boolean)` + `.trim()`）。新行为没变，但值得在 Wave 2 用真实飞书粘贴样本回归一下。

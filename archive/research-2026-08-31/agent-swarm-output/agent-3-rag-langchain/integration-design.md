# 阅读理解检测（Quiz）嫁接方案

> 输入：用户导入的文章（已有 ArticleDocument 结构，web-mvp/src/article.mjs）
> 流程：高亮 → 阅读 → 读完后生成 3-5 个检测题 → 用户答题 → 反馈
> 技术栈：Node ESM Web MVP（无 RAG 框架，minimax LLM）
> 调研日期：2026-06-13

## 1. 设计原则

1. **复用优先**：沿用 `llm-client.mjs` 的 minimax fetch 客户端、批次切分、retry、JSON 解析与恢复。
2. **不引入框架**：MVP 不上 LangChain.js，避免 +30MB 依赖；完整版再评估。
3. **段落即粒度**：复用 `article.paragraphs[]` 作为题源、引用定位单位。
4. **MVP / 完整版分层**：MVP 先跑通"1 段 2 题"，完整版再做"全文 5 题 + 评分"。

## 2. 数据模型

### 2.1 题目结构（QuizItem）

```js
{
  id: "quiz_<uuid>",
  articleId: "<article.id>",
  paragraphId: "<paragraph.id>",      // 题源段落（引用定位）
  type: "multiple_choice" | "open",
  prompt: "下列哪个最能概括本段主旨？",
  // 多选题
  options: ["A...", "B...", "C...", "D..."] | null,
  answer: { index: 2, text: "C..." },    // 多选：index + text 双存
  // 开放题
  referenceAnswer: "本段指出...",       // 开放题：rubric 三条中的参考
  rubric: [
    "1. 答到 X 得 1 分",
    "2. 答到 Y 加 1 分",
    "3. 答到 Z 加 1 分"
  ] | null,
  createdAt: "<ISO>"
}
```

### 2.2 答题记录（QuizAttempt）

```js
{
  id: "attempt_<uuid>",
  quizId: "<quiz.id>",
  userAnswer: "B" | "<free text>",
  correct: true | null,             // 多选 strict / 开放题留 null 让 LLM 评
  score: 0 | 1 | 2,                  // 0-3
  feedback: "答到了 X 但漏了 Y",     // 开放题 LLM 反馈
  submittedAt: "<ISO>"
}
```

### 2.3 试卷（QuizSheet）

```js
{
  id: "sheet_<uuid>",
  articleId: "<article.id>",
  items: [<QuizItem>, ...],
  attempts: [<QuizAttempt>, ...],    // 与 items 同长度，初始为空
  startedAt: "<ISO>",
  finishedAt: "<ISO>" | null,
  totalScore: 0,
  maxScore: 0
}
```

## 3. 后端 API 端点

> 全部 POST，新增在 `server.mjs`，不入 `/api/compare` 既有对比流。

### 3.1 `POST /api/quiz/generate`

**MVP**：1 段 → 2 题（1 选择 + 1 开放）

```js
// Request
{
  paragraphs: [<paragraph>, ...],   // 1 个或 N 个段落
  perParagraphCount: 1 | 2,         // MVP 固定 2（1 MCQ + 1 open）
  difficulty: "easy" | "medium"     // MVP 默认 medium
}

// Response
{
  items: [<QuizItem>, ...],         // 长度 = paragraphs.length * perParagraphCount
  modelInfo: { provider, model, latencyMs, requestCount, usage }
}
```

**完整版**：N 段 → 5 题（3 MCQ + 2 open，跨段可重复）

- 入参新增 `totalCount: 5`、`types: { mcq: 3, open: 2 }`
- 后端按 minimax 4 段/1200 字符分批；每批 prompt 出"该批贡献几道 MCQ + 几道 open"的结构化 JSON；汇总去重（避免重复 paragraphId）

### 3.2 `POST /api/quiz/grade`

```js
// Request
{
  items: [<QuizItem>, ...],          // 服务端先回传，客户端作答后再次提交
  attempts: [{ quizId, userAnswer }, ...]
}

// Response
{
  attempts: [<QuizAttempt with correct/score/feedback>, ...],
  summary: {
    totalScore: 5,
    maxScore: 8,
    mcqCorrect: 2,
    mcqTotal: 3,
    openScore: 3,
    openTotal: 5
  }
}
```

**MVP 简化**：只支持 1 段 1 MCQ；开放题评分需要 LLM 调用 → MVP 可选择**先不做开放题评分**，只让用户自评"我想到了 X / Y / Z"对照 rubric。

### 3.3 `POST /api/quiz/save`（可选，完整版）

把 sheet 存到 `data/quizzes/<sheetId>.json`（沿用现有 `experiments.mjs::saveReadingExperiment` 风格）。

### 3.4 数据流（完整版）

```
[导入] /api/import/{file,url} → article
[高亮] /api/highlight           → highlight (已就绪)
[阅读] 用户读，滚动到底 → 前端触发
[出题] /api/quiz/generate       → QuizSheet.items
[答题] 用户作答
[评分] /api/quiz/grade          → QuizSheet.attempts + summary
[反馈] 前端渲染 + 高亮回链
[持久化] /api/quiz/save         → data/quizzes/<id>.json
```

## 4. 前端 UI 草图（文字描述）

### 4.1 MVP 版（最小落地）

阅读到底后，弹出一个 modal/overlay：

```
┌──────────────────────────────────────────────┐
│  阅读检测 · 段落 3（共 1 题）                │
├──────────────────────────────────────────────┤
│  Q1. [选择题]                                │
│  "下列哪个最能概括本段主旨？"                │
│  ○ A. ……                                    │
│  ○ B. ……                                    │
│  ○ C. ……                                    │
│  ○ D. ……                                    │
│                                              │
│  Q2. [开放题]                                │
│  "用一句话说出本段的核心观点"                │
│  ┌────────────────────────────────────────┐  │
│  │ （自由输入）                            │  │
│  └────────────────────────────────────────┘  │
│                                              │
│            [提交]    [跳过本段]              │
└──────────────────────────────────────────────┘
```

提交后：

```
┌──────────────────────────────────────────────┐
│  ✓ Q1 答对（你的选 C，正确 C）               │
│  ◐ Q2 你提到了 X / 漏了 Y（rubric 反馈）     │
│                                              │
│  回到原文段落 3：[点击跳转 → 高亮闪烁 3 次]  │
│            [继续下一段]    [结束阅读]        │
└──────────────────────────────────────────────┘
```

### 4.2 完整版（带进度条 + 评分）

```
┌──────────────────────────────────────────────┐
│  阅读检测 · 第 2 / 5 题                      │
│  ▓▓▓░░░░░  进度 40%                          │
├──────────────────────────────────────────────┤
│  Q2 [选择题 · 段落 5]                        │
│  题目 ……                                    │
│  ○ A. ……                                    │
│  ○ B. ……                                    │
│  ○ C. ……                                    │
│  ○ D. ……                                    │
│  [上一题]   [跳过]   [下一题]                │
└──────────────────────────────────────────────┘
```

完成后：

```
┌──────────────────────────────────────────────┐
│  测验完成 · 总分 6 / 8                        │
│                                              │
│  ✓ Q1 ✓ Q2 ✗ Q3 ◐ Q4 ◐ Q5                  │
│                                              │
│  ── 错题回链 ──                              │
│  ✗ Q3（段落 7）[回看] ←── 点击高亮闪烁       │
│  ◐ Q4（段落 11）[回看]                      │
│  ◐ Q5（段落 14）[回看]                      │
│                                              │
│  [下载测验记录]  [重新测一次]  [回到阅读]    │
└──────────────────────────────────────────────┘
```

### 4.3 交互细节

- **触发时机**：用户滚动到 reader 底部（IntersectionObserver 触发"完成阅读"事件，1.2s 弹 quiz）
- **段落定位**：用现有 `appendHighlightedText` 重新渲染目标段落（高亮闪烁 3 次 = 临时加 `pulse` CSS 类）
- **键盘**：方向键切选项，Enter 提交，Esc 关闭（不提交，记为"放弃"）
- **可访问性**：modal 用 `role="dialog"` + `aria-modal="true"`，焦点 trap

## 5. 关键技术决策

### 5.1 Prompt 模板（MVP 版，1 段 2 题）

```
你是一位阅读理解出题助手。基于给定的段落，同时生成 2 道检测题：
1. 一道选择题（MCQ）：4 个选项，1 个正确答案，干扰项要像但不完全对。
2. 一道开放题：要求读者用 1-2 句话回答，给出参考要点 rubric 三条。

规则：
- 只返回 valid JSON，不要任何解释。
- 题目语言与段落原文一致。
- 选择题答案用 index（0-3）。
- 引用段落 ID 必须用给定段落 id 列表中的某一个。
- 不要出"以下哪项是正确的"这种表面题，要测理解。

段落：
{"id":"<id>","text":"<text>"}

输出 JSON 形状：
{
  "items": [
    {
      "type": "multiple_choice",
      "prompt": "...",
      "options": ["A","B","C","D"],
      "answer": {"index": 2, "text": "C 选项原文"},
      "paragraphId": "<id>"
    },
    {
      "type": "open",
      "prompt": "...",
      "referenceAnswer": "...",
      "rubric": ["1. ...", "2. ...", "3. ..."],
      "paragraphId": "<id>"
    }
  ]
}
```

### 5.2 评分逻辑

**选择题**（纯代码）：
```js
attempts[i].correct = (userAnswer === items[i].answer.index)
attempts[i].score = attempts[i].correct ? 1 : 0
```

**开放题**（完整版调 LLM，MVP 可选）：
```
给定：
- 用户答案：<userAnswer>
- 参考要点：<referenceAnswer>
- rubric 三条：<rubric>

评分（0-3）：
- 0 分：未触及 rubric 任何一条
- 1 分：触及 1 条
- 2 分：触及 2 条
- 3 分：触及全部 3 条

输出 JSON：
{"score": 2, "feedback": "你提到了 X，但漏了 Y 和 Z。", "rubricHits": [true, false, false]}
```

### 5.3 复用现有 minimax 客户端

`llm-client.mjs` 已经实现：
- `requestMiniMaxHighlightBatchWithRetry` 二分递归
- `parseHighlightJson` fenced JSON 解析 + 正则回退
- `mapWithConcurrency` 并发

**新增 `quiz-generator.mjs`**：
- 复用 `loadProviderEnv` / `resolveLlmConfig` / `requestMiniMaxHighlightBatch` 的 fetcher
- 新增 `buildQuizPrompt(paragraphs, options)`
- 新增 `parseQuizJson(rawText, expectedCount)`
- 出口函数 `generateQuiz({ paragraphs, options })`

## 6. MVP vs 完整版 区分

| 维度 | MVP | 完整版 |
|---|---|---|
| 出题范围 | 1 段（用户点哪段出哪段） | 全文 5 题（3 MCQ + 2 open） |
| 触发方式 | 用户点击"测一下本段"按钮 | 阅读到底自动触发 |
| 题型 | 1 MCQ + 1 open | 5 题跨段 |
| 评分 | MCQ strict，open 仅自评对照 | MCQ strict + open LLM 评分 |
| 反馈 | 答案对错 + rubric | + 总分 + 错题回链高亮 |
| 持久化 | 无 | `data/quizzes/<id>.json` |
| 依赖 | 0 新增 | 0 新增（MVP 不引 LangChain.js） |
| API 端点 | `/api/quiz/generate` 1 个 | + `/api/quiz/grade` + `/api/quiz/save` |
| 实现时间 | 1-2 小时 | 半天 |

**MVP 落地步骤**：
1. 新建 `web-mvp/src/quiz-generator.mjs`（复用 llm-client）
2. `server.mjs` 加 `POST /api/quiz/generate` 路由
3. `public/index.html` + `styles.css` 加 quiz overlay 骨架
4. `public/app.js` 加 quiz 状态机（state.quizSheet、state.currentQuiz、show/hide modal）
5. 在 reader 段落下方加"测一下本段"按钮（MVP 触发点）

**完整版落地步骤**：
1. `quiz-generator.mjs` 加 `totalCount/types` 入参 + 分批去重
2. 加 `quiz-grader.mjs`（选择题代码评分 + 开放题 LLM 评分）
3. 加 `/api/quiz/grade` 路由
4. 加 reader 底部 IntersectionObserver 触发
5. 加错题回链（reader 段落 pulse 闪烁）

## 7. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 段落级检测 → 用户读完未必切段（MVP 触发依赖用户手动点） | MVP 接受；完整版改自动触发 |
| LLM 出题跑偏格式 → JSON 解析失败 | 沿用 fenced JSON + 正则回退 + 题型 schema 校验（assertQuizSheet） |
| 开放题 LLM 自评分不一致 | MVP 跳过开放题评分；完整版用 rubric 锚定，让 LLM "逐条判定 + 0/1/2/3 总分" |
| 5 题 token 消耗 | minimax 单段 ≤1200 字符，5 题预估 ≤8k 输入 + ≤4k 输出 |
| 用户没读完就触发 | MVP 不自动触发；完整版 IntersectionObserver 触发 + 弹窗确认 |
| 与现有 highlight 实验数据冲突 | 写到 `data/quizzes/` 独立目录，不影响 `data/experiments/` |

## 8. 不做的事（明确排除）

- **不引入 LangChain.js / LangGraph**（MVP + 完整版都不引）
- **不做"全文综述题"**（跨段抽象对成人加速阅读价值低）
- **不做账号体系 / 历史记录**（保持单次会话）
- **不做 PDF 导入**（当前只有 txt / md / URL，符合现有导入能力）
- **不重做高亮逻辑**（沿用现有 HighlightMap）

---

## 9. 落地建议（一句话）

先做 MVP（1 段 1 MCQ + 1 open）验证"读完检测"对成人加速阅读有没有价值；如果用户在 2 次 session 里都触发 quiz，再上完整版。

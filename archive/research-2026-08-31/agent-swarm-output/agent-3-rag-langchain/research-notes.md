# RAG + LangChain 阅读理解调研笔记

> 目标：在 tillglance 二次开发（Node ESM Web MVP）上嫁接"读完理解检测"环节。
> 用户群：成人阅读加速（对比 SoeonPark 的韩语儿童互动阅读）。
> 调研日期：2026-06-13。

## 1. 现状盘点（web-mvp 已有能力）

读了 `web-mvp/src/article.mjs`、`highlight.mjs`、`llm-client.mjs`、`server.mjs`、`public/app.js`、`public/index.html`，要点：

- **ArticleDocument 结构**（已就绪）：`{ id, sourceType, sourceUrl, title, plainText, paragraphs[], extraction, createdAt }`，段落有 `{ id, index, text, charLength }`。
- **API 端点**（已就绪）：`/api/import/file`、`/api/import/url`、`/api/highlight`、`/api/compare`、`/api/experiments`、`/api/health`。
- **LLM 客户端**（已就绪）：走 minimax（anthropic-compatible API），单批 ≤4 段 / ≤1200 字符，已实现 split+retry 的"二分递归"容错。
- **前端 state**：vanilla JS（`state.article`、`state.highlight`、`state.modelInfo`、`state.showHighlight`），没有读取进度/理解检测 state。
- **UI 形态**：左导入面板 + 右阅读面板；status-line 提示，无 modal/quiz overlay。

**缺口**：读完不检测 → 用户不知道自己有没有记住关键信息。
**机会**：已经能稳定调用 LLM，新增"理解检测"只是在 `/api/highlight` 旁边加一两个新端点 + 前端在阅读后弹出 quiz overlay。

## 2. LangChain.js 的 QA chain 对比

调研 `langchain-ai/langchainjs`（17806 stars，2026-06-13 最新）的 `libs/langchain-classic/src/chains/question_answering/load.ts`，明确三种 chain：

| Chain | 工作方式 | 适合场景 | 对 tillglance 的适用性 |
|---|---|---|---|
| **stuff** | 把所有 chunks 直接塞进 prompt，单次 LLM 调用 | 文档 ≤ 几段 / context window 够大 | **最合适**。MVP 段落级检测题，context 是 1-2 段 |
| **map_reduce** | 每个 chunk 独立调用 LLM 出中间答案，再汇总 | 文档超长 / 必须覆盖全文 | **完整版备选**。5 题 quiz 可分段生成后聚合 |
| **refine** | 第一个 chunk 出答案，后续 chunk 迭代精化 | 文档很长、答案需精确 | 不合适。阅读理解题要多样性，不需要"越改越准" |

**段落级 QA 推荐 stuff**：
- 单段 ≤ 1200 字符（已匹配 minimax 限制）
- 一次 LLM 调用 → 一次响应 → 前端拿到结果直接渲染
- 与现有 highlight 端的"4 段批量"模式一致，复用现成 retry/merge 工具函数即可

**参考源码片段**（stuff 模式，from `examples/src/langchain-classic/chains/question_answering_stuff.ts`）：

```ts
import { loadQAStuffChain } from "@langchain/classic/chains";
import { Document } from "@langchain/core/documents";

const chain = loadQAStuffChain(llm);
const res = await chain.invoke({
  input_documents: docs,
  question: "Where did Harrison go to college?",
});
// → { text: 'Harrison went to Harvard.' }
```

**对我们需求的启示**：
- 我们的"问题"不是单一问句，而是"基于这段出 1 道选择题 + 1 道开放题"——直接把 question 改成指令式 prompt 即可，prompt 模板换成我们自己的结构化输出 prompt（参考现有 highlight 端的 JSON-only 设计）。

## 3. 文档分块策略

读 `libs/langchain-textsplitters/src/text_splitter.ts` 和 `recursive_text_splitter.ts` 示例，三种分块：

| 策略 | 切分点 | 优缺点 |
|---|---|---|
| **按字符递归** | `\n\n` → `\n` → ` ` → `""`（LangChain 默认） | 通用，但会切碎段落、丢失"语义单元"边界 |
| **按段落切分**（**当前已有**） | `\n{2,}` | **保留语义边界**，最贴合 tillglance 的 ArticleDocument 结构 |
| **按句切分** | `. ` `! ` `? ` `。 ` | 适合细粒度 QA，但和阅读高亮不匹配 |

**推荐**：**沿用现有段落切分**（`article.mjs::splitIntoParagraphs`）。
- 已存在 `paragraph.id` / `paragraph.text` / `paragraph.charLength`，语义边界天然对齐
- 段落级就是"理解检测粒度"——题出在段上、引用也回到段
- 省一次 chunk 重切，不增加额外 embedding/cost

**唯一调整**：如果某段 > 1200 字符（minimax 上限），沿用现有 `splitParagraphsForMiniMax` 二分逻辑截断（已有，0 改动）。

## 4. 参考项目清单（5 个）

> 用 `gh search repos/code` 搜 "reading assistant rag"、"article qa langchain"、"reading comprehension detector" 等关键词找到，并逐个读了核心源码。

### 4.1 [SoeonPark/EyeTrackingReadingAssistance](https://github.com/SoeonPark/EyeTrackingReadingAssistance)

- **用户群**：韩语儿童互动阅读（语音 + 眼动 + 表情 + RAG）
- **RAG 形态**：Streamlit 版 `app2.py` —— PyMuPDFLoader + RecursiveCharacterTextSplitter(200/50) + FAISS + OpenAIEmbeddings + ChatOpenAI
- **5 道题 quiz**：`generate_quiz()` 一次性 prompt 让 LLM 出 5 道 `{question, answer, explanation}` JSON 题；用户逐题 text_input 答题，比对 `answer` 字段累计 score
- **自由问答**：`retrieval_chain.invoke(question)` 走同一份 vectorstore
- **前端**：`discussion.jsx`（React+Vite）只做了 chatbot UI 骨架，无 quiz overlay
- **亮点**：5 题 + 自由问答 + 错题 review 三段式
- **缺点**：纯 Python、Streamlit；prompt 一次性要求 5 题，模型容易跑偏格式；JSON 解析失败 fallback 弱

**对我们的启示（不照搬）**：
- 用户群不同（成人 vs 儿童），不需要"亲切口语化"的 prompt
- 用户已读完（不是边读边答），可以分段出题，不必一次性
- 评分机制可借鉴：选择题 strict match，开放题用 LLM 打分

### 4.2 [efe-onal-2016400267/reading_assistant_RAG](https://github.com/efe-onal-2016400267/reading_assistant_RAG)

- **用户群**：通用文学读者（CLI）
- **架构**：LangGraph `retrieve → generate` 两节点；Ingest 走正则解析 Part/Chapter，page_number = char_offset / 1500
- **引用能力**：prompt 强制 LLM 标注 `[Part: X | Chapter: Y | Page: Z]` —— 对我们的"段落级"直接借鉴成 `[段落 ID X]`
- **结构元数据**：把 Part/Chapter/Page 写入 Document.metadata，retriever 自动带回
- **优点**：结构化 metadata + 强制引用 → 答案可溯源
- **缺点**：CLI 不友好；ChromaDB 持久化对单次会话冗余；OpenAI-only（我们走 minimax）

### 4.3 [ojolisa/Langchain-Question-Generation](https://github.com/ojolisa/Langchain-Question-Generation)

- **用户群**：Streamlit + PDF 通用
- **核心思路**：FAISS + create_stuff_documents_chain + create_retrieval_chain，分两步生成题目
- **三种题型**：True-False / MCQ / One-word —— 每个题型一个按钮，两次 LLM 调用：第一次出题，第二次强制约束答案格式
- **结构清晰**：每个题型一份 prompt 模板
- **缺点**：题型分流到前端按钮，每次都重 invoke retrieval_chain，浪费 token；不验证用户答案

**对我们的启示**：
- "两步生成"是 anti-pattern —— 我们一次性 prompt 同时出"question + 4 options + answer"，前端只调一次 LLM
- 题型分类（MCQ + 开放题）正好对应 MVP 版的两种题

### 4.4 [lixinsu/RCZoo](https://github.com/lixinsu/RCZoo)（164 stars，经典）

- **形态**：研究型 reading comprehension 数据集 + 模型集合（SQuAD、bAbI、CBT、NarrativeQA、VQA）
- **价值**：BERT/SQuAD 等"从段落直接抽答案"的方法论参考 —— 但**对 tillglance 不实用**：训练成本高、不支持生成式题型（开放题）
- **使用建议**：仅作为"是否需要 retrieval"的判定基准 —— SQuAD 范式"在段落里抽 span"对我们太严，开放题必须有 LLM 生成能力

### 4.5 [langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs)（17806 stars，官方）

- **价值**：权威实现库，QA chain 三选一（stuff/map_reduce/refine）的接口已经稳定
- **决策**：**MVP 直接自实现，不引入 LangChain.js 依赖**
  - 理由 1：现有 minimax 客户端直接调 fetch，LangChain.js 增加约 30MB 依赖 + 学习成本
  - 理由 2：MVP 只做段落级 stuff —— 用 minimax 客户端 + 一个 prompt 模板 + JSON 解析就够了
  - 理由 3：**完整版**再考虑 LangChain.js（vectorstore 多文档检索时复用社区实现）

## 5. RAG vs 自实现：决策表

| 维度 | LangChain.js（heavy） | 自实现 stuff（**推荐 MVP**） | LangGraph（medium） |
|---|---|---|---|
| 包体积 | +30MB | 0 | +10MB |
| 学习成本 | 中（LCEL Runnable） | 低（prompt + JSON） | 高（StateGraph） |
| 段落级 QA 适用度 | 高 | 高 | 杀鸡用牛刀 |
| 跨段检索 / 全文 QA | 天然支持 | 需手写 | 支持 |
| 与 minimax 集成 | 需写 ChatMinimax wrapper | 已就绪 | 需写 wrapper |
| MVP 落地时间 | 半天 | **1-2 小时** | 1 天 |

**MVP 决策**：**自实现 stuff 风格**，不复用 LangChain.js。
- 复用 `llm-client.mjs::generateAiHighlight` 的"分批 + retry + JSON 恢复"模式
- 新增 `quiz-generator.mjs::generateQuiz(paragraphs, options)`，prompt 输出结构化 JSON（题型、题干、选项、答案、引用段落 ID）
**完整版决策**：如需全文 5 题 + 跨段综述题，再考虑引入 LangChain.js + MemoryVectorStore；当前阶段不引入。

## 6. 关键风险与缓解

| 风险 | 缓解 |
|---|---|
| LLM 出题格式跑偏 → JSON 解析失败 | 沿用 `recoverHighlightMapFromText` 正则回退；用 fenced JSON / 严格 prompt + 题型 schema 校验 |
| 开放题评分主观 | 第一次出题时同时让 LLM 自评"rubric 三条"，前端展示给用户；不强求数字分 |
| minimax 单段 ≤1200 字符 | 已就绪（llm-client 的二分截断）；段落 ID 不变 |
| 5 题触发第 6 个 token 消耗大 | 完整版才做；MVP 1 段 = 1 调用 = ≤1k tokens |
| 用户读完不答题直接关页面 | MVP 不强制；完整版加"未完成 quiz 提示"状态 |

## 7. 结论

**MVP 版**：1 段 = 1 调用出 1 道选择题 + 1 道开放题，前端弹 quiz overlay → 用户答题 → 选择题 strict 比对、开放题用 LLM rubric 比对 → 反馈。**不引入任何 RAG 框架**。

**完整版**：全文 5 题（3 选择 + 2 开放）跨段生成 + 用户答题累积分数 + 错题回链到高亮段落。引入 LangChain.js + MemoryVectorStore。

---

## 8. 参考链接（无 click，方便粘贴）

- https://github.com/SoeonPark/EyeTrackingReadingAssistance
- https://github.com/efe-onal-2016400267/reading_assistant_RAG
- https://github.com/ojolisa/Langchain-Question-Generation
- https://github.com/lixinsu/RCZoo
- https://github.com/langchain-ai/langchainjs
- https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/question_answering/load.ts
- https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/question_answering_stuff.ts
- https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/question_answering_map_reduce.ts
- https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/qa_refine.ts
- https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/combine_documents/stuff.ts
- https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/retrieval_qa.ts
- https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-textsplitters/src/text_splitter.ts

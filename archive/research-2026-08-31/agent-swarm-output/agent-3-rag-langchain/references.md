# 参考项目与资料清单

> 调研工具：`gh search repos`、`gh search code`、`gh api repos/.../contents`
> 调研日期：2026-06-13
> 全部用 gh CLI 检索，未走 webfetch。

## 1. 直接相关的 RAG / QA 阅读项目（5 个）

| # | 项目 | 链接 | Stars | 用户群 | 与 tillglance 关系 |
|---|---|---|---|---|---|
| 1 | SoeonPark/EyeTrackingReadingAssistance | https://github.com/SoeonPark/EyeTrackingReadingAssistance | 0 | 韩语儿童 + 语音 + 眼动 | 借鉴 5 题 quiz + 错题 review 流程；不照搬（用户群不同） |
| 2 | efe-onal-2016400267/reading_assistant_RAG | https://github.com/efe-onal-2016400267/reading_assistant_RAG | 0 | 通用文学读者（CLI） | 借鉴 Part/Chapter 结构化 metadata + 强制引用 prompt |
| 3 | ojolisa/Langchain-Question-Generation | https://github.com/ojolisa/Langchain-Question-Generation | 0 | Streamlit + PDF 通用 | 借鉴三题型分流思路；不照搬（两次 LLM 调用浪费） |
| 4 | lixinsu/RCZoo | https://github.com/lixinsu/RCZoo | 164 | 阅读理解研究数据集 | 仅作为 SQuAD 范式参考；不实用（生成式题型不匹配） |
| 5 | langchain-ai/langchainjs | https://github.com/langchain-ai/langchainjs | 17806 | 框架 | 权威实现库；MVP 不引入，完整版再评估 |

## 2. LangChain.js 关键源码（QA chain）

| 文件 | 链接 | 用途 |
|---|---|---|
| `libs/langchain-classic/src/chains/question_answering/load.ts` | https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/question_answering/load.ts | loadQAStuffChain / loadQAMapReduceChain / loadQARefineChain 三选一入口 |
| `libs/langchain-classic/src/chains/question_answering/stuff_prompts.ts` | https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/question_answering/stuff_prompts.ts | DEFAULT_QA_PROMPT：context + question → answer |
| `examples/src/langchain-classic/chains/question_answering_stuff.ts` | https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/question_answering_stuff.ts | stuff 模式最小示例（单次 LLM 调用） |
| `examples/src/langchain-classic/chains/question_answering_map_reduce.ts` | https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/question_answering_map_reduce.ts | map_reduce 模式（多 chunk 独立调用 + 汇总） |
| `examples/src/langchain-classic/chains/qa_refine.ts` | https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/chains/qa_refine.ts | refine 模式（迭代精化答案） |
| `libs/langchain-classic/src/chains/combine_documents/stuff.ts` | https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/combine_documents/stuff.ts | createStuffDocumentsChain：把 docs 塞进 prompt |
| `libs/langchain-classic/src/chains/retrieval_qa.ts` | https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-classic/src/chains/retrieval_qa.ts | RetrievalQAChain：retriever + combine_docs_chain 组合 |
| `libs/langchain-textsplitters/src/text_splitter.ts` | https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-textsplitters/src/text_splitter.ts | TextSplitter 抽象类（chunkSize/chunkOverlap/keepSeparator） |
| `examples/src/langchain-classic/indexes/recursive_text_splitter.ts` | https://github.com/langchain-ai/langchainjs/blob/main/examples/src/langchain-classic/indexes/recursive_text_splitter.ts | RecursiveCharacterTextSplitter 最小示例 |

## 3. 同主题搜索关键词（备用）

> 留作后续追溯，方便后续 agent 复用。

- `gh search repos "reading assistant rag"` → 1 命中（efe-onal）
- `gh search repos "question answering reading"` → 5 命中（NeuralQA / RCZoo 等）
- `gh search repos "interactive reading comprehension"` → 7 命中（Bouncing_Beans / Arabic-Comprehension / sports-heroes / lenses-rotos / ELA-STAAR-OS / day_30 等，多数零星项目，仅供启发）
- `gh search repos "pdf quiz generation"` → 5 命中（PDF → 题转换，结构类似）
- `gh search repos "langchain question generation"` → 1 命中（ojolisa）
- `gh search code "loadQAStuffChain"` → 5 命中（langchainjs / andantonyan / vectorhub / LangChain-JS-Full-Course / directus-extension-copilot）
- `gh search code "loadQAMapReduceChain"` → 5 命中（同上族群）

## 4. 参考但不直接借鉴的项目

| 项目 | 链接 | 为什么不直接借鉴 |
|---|---|---|
| suriyadeepan/NeuralQA | https://github.com/suriyadeepan/NeuralQA | 4 stars、研究型、BERT-based，对生成式题型不友好 |
| NLPaladins/rinehartAnalysis_questionAnswering | https://github.com/NLPaladins/rinehartAnalysis_questionAnswering | 4 stars、课程作业，结构不规范 |
| shubham11941140/Question-Answering-Reading-Comprehension-Closed-Domain | https://github.com/shubham11941140/Question-Answering-Reading-Comprehension-Closed-Domain | 1 star、Coreference Resolution 专项，与本场景无关 |
| Rustyraygun/Bouncing_Beans_V0.5 | https://github.com/rustyraygun/Bouncing_Beans_V0.5 | 0 stars、儿童互动 + quiz，无 RAG |
| MosesChirusha/day_30_reading_comprehension_quiz | https://github.com/MosesChirusha/day_30_reading_comprehension_quiz | 0 stars、非洲低带宽 + 离线，无 LLM |
| sullivan-sean/chat-langchainjs | https://github.com/sullivan-sean/chat-langchainjs | 292 stars、LangChain.js + 自问自答参考实现，可作 fallback |
| Azure-Samples/serverless-chat-langchainjs | https://github.com/Azure-Samples/serverless-chat-langchainjs | 858 stars、Azure + LangChain.js 服务化示例 |

## 5. tillglance 现有可复用代码（直接利用，无需重新调研）

| 文件 | 复用点 |
|---|---|
| `web-mvp/src/article.mjs::splitIntoParagraphs` | 段落切分（已用） |
| `web-mvp/src/article.mjs::createArticleDocument` | ArticleDocument 结构（已用） |
| `web-mvp/src/highlight.mjs::assertHighlightMap` | JSON 形状校验，迁移为 `assertQuizSheet` |
| `web-mvp/src/llm-client.mjs::loadProviderEnv` | minimax token + endpoint 解析 |
| `web-mvp/src/llm-client.mjs::resolveLlmConfig` | mock / minimax 自动切换 |
| `web-mvp/src/llm-client.mjs::requestMiniMaxHighlightBatchWithRetry` | 二分递归 retry（直接复用） |
| `web-mvp/src/llm-client.mjs::parseHighlightJson` | fenced JSON + 正则回退（迁移到 quiz 解析） |
| `web-mvp/src/llm-client.mjs::splitParagraphsForMiniMax` | 4 段 / 1200 字符分批（直接复用） |
| `web-mvp/src/experiments.mjs::saveReadingExperiment` | `data/<dir>/<id>.json` 持久化模式（迁移） |
| `web-mvp/server.mjs` | POST `/api/...` 路由模式（迁移） |
| `web-mvp/public/app.js` | state 模式 + postJson + IntersectionObserver（新增 quiz state） |
| `web-mvp/public/styles.css` | 高亮色 `--highlight` / 强调色 `--accent`（quiz overlay 复用） |

---

## 6. 调研局限（诚实声明）

- **未做实际跑通**：调研阶段只读源码，未实际运行 SoeonPark app2.py 或 reading_assistant_RAG，对实际 prompt 质量、JSON 解析成功率仅做"源码推测"。
- **未调研英文成人加速阅读产品**：Spritz / Reasy / Spreeder 等是商业闭源，未列入。
- **未调研 Google Scholar**：本任务限定 gh CLI，未走学术检索。
- **未做评测**：MVP 落地后建议用 5 篇短文 + 5 个真人用户跑通，验证"读完检测"对加速阅读的实际帮助。

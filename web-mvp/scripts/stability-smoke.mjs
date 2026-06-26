import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProviderEnv } from "../src/llm-client.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(moduleDir, "stability-smoke-output.json");

const port = process.env.PORT || 4173;
const baseUrl = `http://localhost:${port}`;

const samples = [
  {
    id: "short",
    title: "短篇样本",
    paragraphs: [
      "清晨推开窗户，远处山峦还笼着薄雾。",
      "楼下早餐铺的香味慢慢飘上来，让人想起家乡的味道。",
      "写作是一种与未来读者的对话，作者写下文字，期望有人愿意倾听。",
      "森林里阳光穿过树叶的缝隙，洒在青苔上。",
      "鸟鸣声从远处传来，提醒人们自然从未离开。",
      "每一个程序背后都有一个故事，工程师用代码写下解决现实问题的思考过程。",
      "夜读时一盏台灯就足够，书页翻动的声音让整个房间变得安静。",
      "城市的夜晚总是比白天更诚实，霓虹灯照出每个人隐藏的表情。",
      "旅行的意义不在于目的地，而在于途中遇见的陌生人。",
      "一杯咖啡凉透之前，足够写完三行重要的句子。",
      "旧书页边的批注是前任读者留下的秘密通道。",
      "雨声是最好的白噪音，它让思绪变得缓慢而清晰。"
    ]
  },
  {
    id: "medium",
    title: "中篇样本",
    paragraphs: [
      "人工智能正在改变我们处理文本的方式，但阅读的本质从未改变。",
      "眼睛仍然在字里行间跳跃，寻找那些能够固定注意力的锚点。",
      "好的高亮不是把每个词都标出来，而是标出视线最可能落下的位置。",
      "研究表明，中文读者的注视点通常落在实词上，尤其是名词和动词。",
      "虚词如的、了、是、在，虽然出现频率高，却很少成为注视目标。",
      "因此，语义高亮算法应该优先选择内容词，而非功能词。",
      "长文场景下，模型输出不稳定的问题变得尤为突出。",
      "当段落数量超过一定阈值时，部分模型会返回空内容或思考块。",
      " fallback 机制的存在就是为了在这种情况下保证可用性。",
      "它并不试图替代主模型，而是在主模型失效时提供一条退路。",
      "这条退路的输出质量可能略低，但至少不会让页面空白。",
      "用户体验研究中，稳定性往往比偶尔的惊艳更重要。",
      "一个总是可用的工具，比一个偶尔完美但经常失败的工具更有价值。",
      "这也是我们优先保证长文高亮成功率的原因。",
      "每次 fallback 都应该被记录，以便后续分析主模型的失败模式。",
      "通过收集足够多的样本，我们可以针对性地优化 prompt。",
      "最终目标是让 fallback 越来越少，而不是越来越多。",
      "这需要在模型能力、成本和用户体验之间找到平衡。"
    ]
  },
  {
    id: "long",
    title: "长篇样本",
    paragraphs: [
      "在信息过载的时代，阅读能力成为一种稀缺技能。",
      "人们每天接触大量文字，却很少真正读完任何一段。",
      "注意力被不断切割，深度阅读变得越来越困难。",
      "语义高亮技术的目标之一，就是帮助读者更快地抓住重点。",
      "它不是简化内容，而是引导视线，减少无效注视。",
      "通过突出关键位置，读者可以更高效地建立文本结构。",
      "这种技术的历史可以追溯到印刷时代的重点标记。",
      "但数字化让它能够根据每段内容动态生成。",
      "大型语言模型为这种动态生成提供了新的可能性。",
      "它们可以理解上下文，识别重要概念，并预测注视点。",
      "然而，模型输出并不总是稳定，尤其是在长文本上。",
      "长文本意味着更长的上下文和更高的输出复杂度。",
      "模型可能因为 token 限制、注意力分散或格式问题而失败。",
      "为了应对这种情况，系统需要多层容错机制。",
      "第一层是提示工程，通过精心设计的 few-shot 示例引导输出。",
      "第二层是输出解析，能够从非标准格式中恢复高亮数据。",
      "第三层是分批处理，将长文拆成多个小批次分别请求。",
      "第四层是二分重试，当某批次失败时进一步缩小范围。",
      "最后一层是外部 fallback，当所有内部手段都失败时调用备用服务。",
      "这五层机制共同构成了长文高亮的稳定性保障。",
      "每一层都有其成本和限制，需要在实际使用中权衡。",
      "例如，分批处理会增加请求次数和总延迟。",
      "二分重试虽然提高了成功率，但会进一步增加延迟。",
      "外部 fallback 则可能带来额外的依赖和成本。",
      "因此，监控各层的触发频率至关重要。",
      "稳定性 smoke 测试就是为此而设计的开发者工具。",
      "它定期对预设样本发起请求，统计成功率和 fallback 率。",
      "通过这些数据，开发者可以判断系统是否 regress。",
      "如果 fallback 率突然上升，说明主模型或提示需要调整。",
      "如果延迟显著增加，可能是分批策略需要优化。",
      "最终，这些监控数据会反哺产品决策。"
    ]
  }
];

function toArticleDocument(sample) {
  return {
    id: `smoke-${sample.id}`,
    sourceType: "smoke",
    title: sample.title,
    paragraphs: sample.paragraphs.map((text, index) => ({
      id: String(index),
      index,
      text,
      charLength: Array.from(text).length
    }))
  };
}

async function postHighlight(article) {
  const response = await fetch(`${baseUrl}/api/highlight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articleId: article.id,
      paragraphs: article.paragraphs,
      density: "medium"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }

  return response.json();
}

async function runSample(sample) {
  const article = toArticleDocument(sample);
  const startedAt = Date.now();

  try {
    const result = await postHighlight(article);
    const latencyMs = Date.now() - startedAt;
    const paragraphIds = article.paragraphs.map((paragraph) => paragraph.id);
    const returnedIds = Object.keys(result.highlight || {});
    const allParagraphsReturned = paragraphIds.every((id) => returnedIds.includes(id));

    return {
      id: sample.id,
      title: sample.title,
      paragraphCount: article.paragraphs.length,
      ok: true,
      fallbackUsed: result.modelInfo?.fallbackUsed === true,
      provider: result.modelInfo?.provider || "unknown",
      model: result.modelInfo?.model || "unknown",
      latencyMs,
      allParagraphsReturned,
      error: null
    };
  } catch (error) {
    return {
      id: sample.id,
      title: sample.title,
      paragraphCount: article.paragraphs.length,
      ok: false,
      fallbackUsed: false,
      provider: null,
      model: null,
      latencyMs: Date.now() - startedAt,
      allParagraphsReturned: false,
      error: error.message
    };
  }
}

function summarize(results) {
  const total = results.length;
  const successful = results.filter((result) => result.ok).length;
  const fallbackCount = results.filter((result) => result.fallbackUsed).length;
  const latencies = results.filter((result) => result.ok).map((result) => result.latencyMs);
  const averageLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  return {
    total,
    successful,
    failed: total - successful,
    fallbackCount,
    successRate: total > 0 ? successful / total : 0,
    fallbackRate: total > 0 ? fallbackCount / total : 0,
    averageLatencyMs
  };
}

async function main() {
  loadProviderEnv();

  console.log(`Stability smoke test against ${baseUrl}`);
  console.log(`Samples: ${samples.length}`);
  console.log("");

  const results = [];
  for (const sample of samples) {
    const result = await runSample(sample);
    results.push(result);
    const status = result.ok ? (result.fallbackUsed ? "FALLBACK" : "OK") : "FAIL";
    console.log(`${status}  ${result.title.padEnd(8)}  ${result.paragraphCount}段  ${result.latencyMs}ms  ${result.model || result.error || ""}`);
  }

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    summary,
    samples: results
  };

  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));

  console.log("");
  console.log(`总样本: ${summary.total}  成功: ${summary.successful}  失败: ${summary.failed}  fallback: ${summary.fallbackCount}`);
  console.log(`成功率: ${(summary.successRate * 100).toFixed(1)}%  fallback 率: ${(summary.fallbackRate * 100).toFixed(1)}%  平均延迟: ${summary.averageLatencyMs}ms`);
  console.log(`报告已保存: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

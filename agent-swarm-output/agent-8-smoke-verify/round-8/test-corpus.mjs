// Agent 8 round-8 verification corpus: 15 texts total.
// Composition:
//   - 5 EN short (en-1..en-5 from round-6/swarm-agent-D/test-corpus-english.mjs)
//   - 5 ZH short (B0/B1/B5/B6/F2 from round-6/test-corpus.mjs)
//   - 5 multi-paragraph self-constructed (2 ZH \n + 2 EN \n + 1 ZH \n\n)
// Each text has: id, lang, source, category, format, text
// text is the RAW input as we will hand it to generateAiHighlight after
// splitIntoParagraphs auto (for multi-paragraph) or directly (for short).

// ===== 5 EN SHORT (round-6/swarm-agent-D/test-corpus-english.mjs) =====
const EN_SHORT = [
  {
    id: "en-1",
    source: "round-6/swarm-agent-D/test-corpus-english.mjs",
    lang: "en",
    category: "short",
    format: "single-paragraph",
    text: "The quick brown fox jumps over the lazy dog."
  },
  {
    id: "en-2",
    source: "round-6/swarm-agent-D/test-corpus-english.mjs",
    lang: "en",
    category: "short",
    format: "single-paragraph",
    text: "Reading is to the mind what exercise is to the body."
  },
  {
    id: "en-3",
    source: "round-6/swarm-agent-D/test-corpus-english.mjs",
    lang: "en",
    category: "short",
    format: "single-paragraph",
    text: "All that glitters is not gold, and not all who wander are lost."
  },
  {
    id: "en-4",
    source: "round-6/swarm-agent-D/test-corpus-english.mjs",
    lang: "en",
    category: "medium",
    format: "single-paragraph",
    text: "The Tortoise and the Hare were neighbors. The Hare always laughed at the Tortoise for being slow. One day the Tortoise grew tired of the laughter and challenged the Hare to a race."
  },
  {
    id: "en-5",
    source: "round-6/swarm-agent-D/test-corpus-english.mjs",
    lang: "en",
    category: "medium",
    format: "single-paragraph",
    text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness. Cities sprung up and empires fell across the small planet."
  }
];

// ===== 5 ZH SHORT (round-6/test-corpus.mjs, picking B0/B1/B5/B6/F2) =====
const ZH_SHORT = [
  {
    id: "zh-B0",
    source: "round-6/test-corpus.mjs#B0",
    lang: "zh",
    category: "技术-长",
    format: "single-paragraph",
    text: "阅读不是眼睛平滑扫过文字，而是由注视和眼跳组成。合适的高亮可以像轨道一样，帮助读者更快找到下一次视线落点。"
  },
  {
    id: "zh-B1",
    source: "round-6/test-corpus.mjs#B1",
    lang: "zh",
    category: "技术-长",
    format: "single-paragraph",
    text: "中文阅读没有天然空格，读者需要在连续汉字中判断词边界。语义、词频和句子结构都会影响眼睛下一步看向哪里。"
  },
  {
    id: "zh-B5",
    source: "round-6/test-corpus.mjs#B5",
    lang: "zh",
    category: "技术-中",
    format: "single-paragraph",
    text: "代码是程序员写给未来的信，每一行都要考虑下一个维护者的感受。可读性与性能同等重要。"
  },
  {
    id: "zh-B6",
    source: "round-6/test-corpus.mjs#B6",
    lang: "zh",
    category: "文化-中",
    format: "single-paragraph",
    text: "音乐会上，指挥家的手势决定整支乐队的呼吸。乐手跟随节奏，把作曲家埋在音符里的情感表达出来。"
  },
  {
    id: "zh-F2",
    source: "round-6/test-corpus.mjs#F2",
    lang: "zh",
    category: "技术-中",
    format: "single-paragraph",
    text: "深度学习模型的推理速度受到显存带宽限制，量化与剪枝是常见的优化手段。"
  }
];

// ===== 5 MULTI-PARAGRAPH (self-constructed for batch path verification) =====
// 2 ZH single-newline (5 segments) + 2 EN single-newline (5 segments) + 1 ZH double-newline (5 segments)
const MULTI = [
  {
    id: "multi-zh-1",
    source: "self-constructed",
    lang: "zh",
    category: "multi-singlenl-散文",
    format: "single-newline",
    text:
      "清晨推开窗户，远处山峦还笼着薄雾。\n" +
      "楼下早餐铺的香味慢慢飘上来，让人想起家乡的味道。\n" +
      "母亲在厨房里忙碌，锅里的粥咕嘟咕嘟冒着泡。\n" +
      "邻家的小孩背着书包跑过，笑着跟每个人打招呼。\n" +
      "这是普通的一天，但普通里藏着安稳的幸福。"
  },
  {
    id: "multi-zh-2",
    source: "self-constructed",
    lang: "zh",
    category: "multi-singlenl-技术",
    format: "single-newline",
    text:
      "Docker 镜像由多层只读层组成，每一层对应 Dockerfile 里的一条指令。\n" +
      "容器启动时会在镜像之上加一层可写层，所有运行时变更都落在这层。\n" +
      "这种分层结构让镜像复用和分发都变得高效。\n" +
      "开发者之间共享基础镜像时，只需增量推送变更的层。\n" +
      "CI 系统缓存这些层之后，构建速度会显著提升。"
  },
  {
    id: "multi-en-1",
    source: "self-constructed",
    lang: "en",
    category: "multi-singlenl-tech",
    format: "single-newline",
    text:
      "RESTful APIs follow a small set of conventions.\n" +
      "Resources are identified by URLs, and HTTP verbs describe the action.\n" +
      "GET retrieves a resource, POST creates one, PUT updates it, and DELETE removes it.\n" +
      "The server returns a status code that tells the client what happened.\n" +
      "Well-designed APIs feel like a natural extension of the web itself."
  },
  {
    id: "multi-en-2",
    source: "self-constructed",
    lang: "en",
    category: "multi-singlenl-prose",
    format: "single-newline",
    text:
      "The first snow of the year fell on a Tuesday.\n" +
      "It began as a thin mist, barely visible against the gray sky.\n" +
      "By evening, the streets were covered in a soft white blanket.\n" +
      "Children ran outside in mismatched boots, laughing as they caught flakes on their tongues.\n" +
      "The city fell quiet, as if everyone had agreed to slow down for one night."
  },
  {
    id: "multi-zh-3",
    source: "self-constructed",
    lang: "zh",
    category: "multi-doublenl-散文",
    format: "double-newline",
    text:
      "春天是北海道最让人期待的季节。\n\n" +
      "漫长的冬天把雪堆得很厚，街道两旁的树枝都压弯了腰。\n\n" +
      "等到第一缕暖风从南方吹来，雪就开始一点一点地融化。\n\n" +
      "街道上冒出泥泞的草地，野花从缝隙里探出头来。\n\n" +
      "樱花还没开，但整个城市已经准备好迎接它了。"
  }
];

export const TEST_CORPUS = [...EN_SHORT, ...ZH_SHORT, ...MULTI];

export const SUMMARY = {
  totalPlanned: 15,
  enShort: 5,
  zhShort: 5,
  multiParagraph: 5,
  formats: {
    "single-paragraph": 10,
    "single-newline": 4,
    "double-newline": 1
  }
};

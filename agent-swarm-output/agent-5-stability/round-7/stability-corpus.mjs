// Stability test corpus for Agent 5 round-7.
// 50 articles total: 30 Chinese + 20 English.
// Mixed formats: single-newline (editor paste), double-newline (markdown),
// single-paragraph (1 segment), multi-paragraph (3-5 segments).
//
// Each article has: id, lang, category, format, text (raw, with \n or \n\n separators).
// Verification script will run splitIntoParagraphs("auto") to derive paragraph count.
//
// Reuses:
//   - ZH 0-19 from agent-4-few-shot-iter/round-6/test-corpus.mjs
//   - EN 0-11 from agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs

// ===== 20 existing Chinese =====
const ZH_EXISTING = [
  { id: "ZH-00", category: "技术-长", format: "single-paragraph",
    text: "阅读不是眼睛平滑扫过文字，而是由注视和眼跳组成。合适的高亮可以像轨道一样，帮助读者更快找到下一次视线落点。" },
  { id: "ZH-01", category: "技术-长", format: "single-paragraph",
    text: "中文阅读没有天然空格，读者需要在连续汉字中判断词边界。语义、词频和句子结构都会影响眼睛下一步看向哪里。" },
  { id: "ZH-02", category: "生活-中", format: "single-paragraph",
    text: "城市的清晨从一碗热粥开始，街角的早餐店冒着蒸汽。上班族匆忙走过，手里握着刚买的咖啡。" },
  { id: "ZH-03", category: "评论-中", format: "single-paragraph",
    text: "互联网改变了阅读习惯，屏幕前的读者习惯快速扫过文字。合适的视觉节奏能帮助他们重新聚焦。" },
  { id: "ZH-04", category: "散文-中", format: "single-paragraph",
    text: "登山者在云层之上看到日出，第一缕光穿过山峰的缝隙。那一刻，所有疲惫都显得值得。" },
  { id: "ZH-05", category: "技术-中", format: "single-paragraph",
    text: "代码是程序员写给未来的信，每一行都要考虑下一个维护者的感受。可读性与性能同等重要。" },
  { id: "ZH-06", category: "文化-中", format: "single-paragraph",
    text: "音乐会上，指挥家的手势决定整支乐队的呼吸。乐手跟随节奏，把作曲家埋在音符里的情感表达出来。" },
  { id: "ZH-07", category: "散文-中", format: "single-paragraph",
    text: "步行穿过老巷子，两旁的老房子保留了上个世纪的痕迹。墙角的青苔记录了无数次的雨季。" },
  { id: "ZH-08", category: "生活-短", format: "single-paragraph",
    text: "深夜的城市依然有光，便利店的招牌亮着，等候晚归的人带走一份热食。" },
  { id: "ZH-09", category: "散文-中", format: "single-paragraph",
    text: "海边的礁石上长满了贝类，潮水退去后留下海盐结晶。远处的灯塔每隔几秒闪一次。" },
  { id: "ZH-10", category: "散文-短", format: "single-paragraph",
    text: "故乡的春天总是来得迟缓，院子里的玉兰在清明前后才肯打开花苞。" },
  { id: "ZH-11", category: "散文-中", format: "single-paragraph",
    text: "黄昏的光线斜斜地铺在书桌上，把打开的笔记本染成一片温暖的金色。" },
  { id: "ZH-12", category: "技术-中", format: "single-paragraph",
    text: "深度学习模型的推理速度受到显存带宽限制，量化与剪枝是常见的优化手段。" },
  { id: "ZH-13", category: "技术-中", format: "single-paragraph",
    text: "Kubernetes 通过声明式配置管理容器集群，节点故障时会自动重新调度 Pod。" },
  { id: "ZH-14", category: "对话-短", format: "single-paragraph",
    text: '\u201c你觉得这本书怎么样？\u201d \u201c作者把复杂的概念讲得通俗易懂，我推荐给所有初学者。\u201d' },
  { id: "ZH-15", category: "对话-短", format: "single-paragraph",
    text: '\u201c今晚加班吗？\u201d \u201c不了，我想早点回家陪孩子。周末再处理吧。\u201d' },
  { id: "ZH-16", category: "短句", format: "single-paragraph",
    text: "时间会回答一切。" },
  { id: "ZH-17", category: "短句", format: "single-paragraph",
    text: "坚持是一种温柔的倔强。" },
  { id: "ZH-18", category: "长-生活", format: "single-paragraph",
    text: "我坐在咖啡馆靠窗的位置，雨水顺着玻璃缓缓流下，模糊了街景。店员端来一杯拿铁，热气在冷空气中升起，杯口的奶泡像一朵小小的云。手边的书翻到了第三章，故事刚刚进入高潮。" },
  { id: "ZH-19", category: "长-技术", format: "single-paragraph",
    text: "程序员的一天往往从一杯咖啡开始，先看一眼邮件，然后处理昨天留下的 bug。中午叫一份外卖，下午集中精力写新功能。下班前提交代码，关上电脑的那一刻，感觉自己像完成了某种小型仪式。" }
];

// ===== 10 NEW Chinese (Wave 1 stress test) =====
// 5 single-newline separated (editor-paste) + 5 double-newline separated (markdown)

const ZH_NEW_SINGLE_NL = [
  { id: "ZH-20", category: "散文-多段-singlenl", format: "single-newline",
    text: "清晨推开窗户，远处山峦还笼着薄雾。\n楼下早餐铺的香味慢慢飘上来，让人想起家乡的味道。\n母亲在厨房里忙碌，锅里的粥咕嘟咕嘟冒着泡。\n邻家的小孩背着书包跑过，笑着跟每个人打招呼。\n这是普通的一天，但普通里藏着安稳的幸福。" },
  { id: "ZH-21", category: "技术-多段-singlenl", format: "single-newline",
    text: "Docker 镜像由多层只读层组成，每一层对应 Dockerfile 里的一条指令。\n容器启动时会在镜像之上加一层可写层，所有运行时变更都落在这层。\n这种分层结构让镜像复用和分发都变得高效。\n开发者之间共享基础镜像时，只需增量推送变更的层。\nCI 系统缓存这些层之后，构建速度会显著提升。" },
  { id: "ZH-22", category: "生活-多段-singlenl", format: "single-newline",
    text: "周末的早晨，阳光从窗帘缝隙里漏进来。\n我赖在床上，听见楼下的孩子在院子里追猫。\n厨房里咖啡机嗡嗡作响，烤面包的香味慢慢弥漫。\n这样的时刻让人不想起床，又不舍得辜负。\n最后还是爬起来，把今天想读的书摆在桌上。" },
  { id: "ZH-23", category: "评论-多段-singlenl", format: "single-newline",
    text: "算法推荐改变了信息消费的方式。\n过去我们主动寻找内容，现在内容主动找上我们。\n这种转变带来便利，也带来隐忧。\n用户在不知不觉中被塑造，视野反而可能变窄。\n一个健康的信息环境，需要算法，也需要人的选择权。" },
  { id: "ZH-24", category: "短-多段-singlenl", format: "single-newline",
    text: "夜读时一盏台灯就足够。\n书页翻动的声音让整个房间变得安静。\n窗外的风把树叶吹得沙沙响。\n这一刻，时间好像真的慢了下来。\n读完最后一个字，我把书合上，闭上眼睛。" }
];

const ZH_NEW_DOUBLE_NL = [
  { id: "ZH-25", category: "散文-多段-doublenl", format: "double-newline",
    text: "春天是北海道最让人期待的季节。\n\n漫长的冬天把雪堆得很厚，街道两旁的树枝都压弯了腰。\n\n等到第一缕暖风从南方吹来，雪就开始一点一点地融化。\n\n街道上冒出泥泞的草地，野花从缝隙里探出头来。\n\n樱花还没开，但整个城市已经准备好迎接它了。" },
  { id: "ZH-26", category: "技术-多段-doublenl", format: "double-newline",
    text: "微服务架构将单体应用拆分成多个独立服务。\n\n每个服务负责单一业务能力，可以独立部署和扩展。\n\n服务之间通过轻量协议（通常是 HTTP/RPC）通信。\n\n这种架构提升了系统的弹性和团队的并行效率。\n\n代价是运维复杂度上升，需要完善的服务治理工具。" },
  { id: "ZH-27", category: "文化-多段-doublenl", format: "double-newline",
    text: "茶道是日本传统的待客礼仪。\n\n主人会精心准备茶具和环境，每一个动作都有含义。\n\n客人接过茶碗，先表达感谢，再慢慢品尝。\n\n整个过程强调\u201c和、敬、清、寂\u201d四个精神。\n\n这种慢节奏的仪式感在现代社会尤其珍贵。" },
  { id: "ZH-28", category: "生活-多段-doublenl", format: "double-newline",
    text: "我家楼下有一家开了二十年的面馆。\n\n老板头发已经花白，但每天凌晨四点还是会准时出现在后厨。\n\n他揉面的手法很稳，每一根面条的厚度都几乎一致。\n\n我常常点一碗清汤面，配一碟小菜，安静地吃完。\n\n这种味道，已经成了我生活的一部分。" },
  { id: "ZH-29", category: "评论-多段-doublenl", format: "double-newline",
    text: "读论文是研究者最重要的基本功之一。\n\n很多人一开始会被海量的术语和公式吓退。\n\n但只要找到合适的切入角度，每篇论文都在讲一个清晰的故事。\n\n先读摘要和结论了解全貌，再回到细节里抠方法。\n\n读 100 篇之后，速度会自然地提上来。" }
];

// ===== 12 existing English =====
const EN_EXISTING = [
  { id: "EN-00", category: "short", format: "single-paragraph",
    text: "The quick brown fox jumps over the lazy dog." },
  { id: "EN-01", category: "short", format: "single-paragraph",
    text: "Reading is to the mind what exercise is to the body." },
  { id: "EN-02", category: "short", format: "single-paragraph",
    text: "All that glitters is not gold, and not all who wander are lost." },
  { id: "EN-03", category: "medium", format: "single-paragraph",
    text: "The Tortoise and the Hare were neighbors. The Hare always laughed at the Tortoise for being slow. One day the Tortoise grew tired of the laughter and challenged the Hare to a race." },
  { id: "EN-04", category: "medium", format: "single-paragraph",
    text: "It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness. Cities sprung up and empires fell across the small planet." },
  { id: "EN-05", category: "medium", format: "single-paragraph",
    text: "To be, or not to be, that is the question. Whether tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles." },
  { id: "EN-06", category: "medium", format: "single-paragraph",
    text: "Knowledge is of no value unless you put it into practice. A single conversation with a wise man is better than ten years of solitary study." },
  { id: "EN-07", category: "long", format: "single-paragraph",
    text: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort. It had a perfectly round door like a porthole, painted green, with a shiny yellow brass knob in the exact middle." },
  { id: "EN-08", category: "long", format: "single-paragraph",
    text: "Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation." },
  { id: "EN-09", category: "long", format: "single-paragraph",
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters." },
  { id: "EN-10", category: "proper-nouns", format: "single-paragraph",
    text: "On July 4, 1776, the Declaration of Independence was signed in Philadelphia by delegates from the thirteen American colonies." },
  { id: "EN-11", category: "proper-nouns", format: "single-paragraph",
    text: "Albert Einstein published his theory of general relativity in 1915, and later received the Nobel Prize in Physics in 1921 for his work on the photoelectric effect." }
];

// ===== 8 NEW English (Wave 1 stress test) =====
const EN_NEW_SINGLE_NL = [
  { id: "EN-12", category: "multi-singlenl", format: "single-newline",
    text: "The kitchen smelled of cinnamon and fresh apples.\nMy grandmother was making pie for Sunday dinner.\nShe had been baking for over fifty years, and her hands moved with quiet confidence.\nI sat at the counter, watching her fold the dough.\nIn that moment, time felt like a slow river." },
  { id: "EN-13", category: "multi-singlenl-tech", format: "single-newline",
    text: "RESTful APIs follow a small set of conventions.\nResources are identified by URLs, and HTTP verbs describe the action.\nGET retrieves a resource, POST creates one, PUT updates it, and DELETE removes it.\nThe server returns a status code that tells the client what happened.\nWell-designed APIs feel like a natural extension of the web itself." },
  { id: "EN-14", category: "multi-singlenl-prose", format: "single-newline",
    text: "The first snow of the year fell on a Tuesday.\nIt began as a thin mist, barely visible against the gray sky.\nBy evening, the streets were covered in a soft white blanket.\nChildren ran outside in mismatched boots, laughing as they caught flakes on their tongues.\nThe city fell quiet, as if everyone had agreed to slow down for one night." },
  { id: "EN-15", category: "multi-singlenl-news", format: "single-newline",
    text: "On March 15, 2024, NASA announced a new mission to study Europa.\nThe spacecraft will launch in 2027 aboard a SpaceX Falcon Heavy rocket.\nScientists believe the icy moon hides a vast subsurface ocean.\nThe mission will spend three years mapping the surface and probing the ice.\nIt is the first dedicated astrobiology mission to the outer solar system in a decade." }
];

const EN_NEW_DOUBLE_NL = [
  { id: "EN-16", category: "multi-doublenl-prose", format: "double-newline",
    text: "Rain had been falling all morning, soft and steady.\n\nThe garden was full of small pools that reflected the gray sky.\n\nI sat by the window with a cup of coffee, watching the leaves bend under the weight of the drops.\n\nThere was something calming about the sound of rain, the way it seemed to wash the world clean.\n\nFor a long while, I did nothing at all, and it was enough." },
  { id: "EN-17", category: "multi-doublenl-essay", format: "double-newline",
    text: "Learning a new language is like building a second mind.\n\nAt first, every word feels heavy, and you have to carry them one at a time.\n\nAfter a few months, the words begin to find each other, forming simple sentences.\n\nA year in, you start to think in the new language, even dreaming in it sometimes.\n\nEventually, it becomes part of you, as natural as the first." },
  { id: "EN-18", category: "multi-doublenl-tech", format: "double-newline",
    text: "PostgreSQL is one of the most mature open-source databases.\n\nIt began as a research project at Berkeley in 1986 and has evolved steadily ever since.\n\nIts MVCC implementation gives readers a consistent snapshot without blocking writers.\n\nIt supports advanced types like JSONB, ranges, and arrays natively.\n\nFor transactional workloads, it remains hard to beat." },
  { id: "EN-19", category: "multi-doublenl-proper", format: "double-newline",
    text: "The first atomic bomb was detonated on July 16, 1945, in the deserts of New Mexico.\n\nThe Trinity test marked the beginning of the nuclear age.\n\nLess than a month later, two more bombs were dropped on Hiroshima and Nagasaki.\n\nThe bombings killed an estimated 200,000 people and led to Japan's surrender.\n\nThe event reshaped geopolitics for the rest of the twentieth century." }
];

export const STABILITY_CORPUS = [
  ...ZH_EXISTING,
  ...ZH_NEW_SINGLE_NL,
  ...ZH_NEW_DOUBLE_NL,
  ...EN_EXISTING,
  ...EN_NEW_SINGLE_NL,
  ...EN_NEW_DOUBLE_NL
];

export const SUMMARY = {
  totalPlanned: 50,
  zhExisting: 20,
  zhNewSingleNl: 5,
  zhNewDoubleNl: 5,
  enExisting: 12,
  enNewSingleNl: 4,
  enNewDoubleNl: 4,
  formats: {
    "single-paragraph": 32,
    "single-newline": 9,
    "double-newline": 9
  }
};

export const ZH_BREAKDOWN = {
  total: 30,
  formats: {
    "single-paragraph": 20,
    "single-newline": 5,
    "double-newline": 5
  }
};

export const EN_BREAKDOWN = {
  total: 20,
  formats: {
    "single-paragraph": 12,
    "single-newline": 4,
    "double-newline": 4
  }
};

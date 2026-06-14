// 20 test paragraphs: 10 from existing TillGlance baselines + 10 handpicked fresh.
// Each is a single paragraph to keep batching off the critical path.
export const TEST_CORPUS = [
  // === 10 from existing baselines (not in few-shot pool) ===
  { id: "B0", source: "baseline-12:34", category: "技术-长",
    text: "阅读不是眼睛平滑扫过文字，而是由注视和眼跳组成。合适的高亮可以像轨道一样，帮助读者更快找到下一次视线落点。" },
  { id: "B1", source: "baseline-12:34", category: "技术-长",
    text: "中文阅读没有天然空格，读者需要在连续汉字中判断词边界。语义、词频和句子结构都会影响眼睛下一步看向哪里。" },
  { id: "B2", source: "baseline-13:12", category: "生活-中",
    text: "城市的清晨从一碗热粥开始，街角的早餐店冒着蒸汽。上班族匆忙走过，手里握着刚买的咖啡。" },
  { id: "B3", source: "baseline-13:12", category: "评论-中",
    text: "互联网改变了阅读习惯，屏幕前的读者习惯快速扫过文字。合适的视觉节奏能帮助他们重新聚焦。" },
  { id: "B4", source: "baseline-13:12", category: "散文-中",
    text: "登山者在云层之上看到日出，第一缕光穿过山峰的缝隙。那一刻，所有疲惫都显得值得。" },
  { id: "B5", source: "baseline-13:12", category: "技术-中",
    text: "代码是程序员写给未来的信，每一行都要考虑下一个维护者的感受。可读性与性能同等重要。" },
  { id: "B6", source: "baseline-13:12", category: "文化-中",
    text: "音乐会上，指挥家的手势决定整支乐队的呼吸。乐手跟随节奏，把作曲家埋在音符里的情感表达出来。" },
  { id: "B7", source: "baseline-13:14", category: "散文-中",
    text: "步行穿过老巷子，两旁的老房子保留了上个世纪的痕迹。墙角的青苔记录了无数次的雨季。" },
  { id: "B8", source: "baseline-13:14", category: "生活-短",
    text: "深夜的城市依然有光，便利店的招牌亮着，等候晚归的人带走一份热食。" },
  { id: "B9", source: "baseline-13:14", category: "散文-中",
    text: "海边的礁石上长满了贝类，潮水退去后留下海盐结晶。远处的灯塔每隔几秒闪一次。" },

  // === 10 handpicked (fresh variety) ===
  { id: "F0", source: "fresh-散文-短", category: "散文-短",
    text: "故乡的春天总是来得迟缓，院子里的玉兰在清明前后才肯打开花苞。" },
  { id: "F1", source: "fresh-散文-中", category: "散文-中",
    text: "黄昏的光线斜斜地铺在书桌上，把打开的笔记本染成一片温暖的金色。" },
  { id: "F2", source: "fresh-技术-中", category: "技术-中",
    text: "深度学习模型的推理速度受到显存带宽限制，量化与剪枝是常见的优化手段。" },
  { id: "F3", source: "fresh-技术-中", category: "技术-中",
    text: "Kubernetes 通过声明式配置管理容器集群，节点故障时会自动重新调度 Pod。" },
  { id: "F4", source: "fresh-对话-短", category: "对话-短",
    text: "“你觉得这本书怎么样？” “作者把复杂的概念讲得通俗易懂，我推荐给所有初学者。”" },
  { id: "F5", source: "fresh-对话-短", category: "对话-短",
    text: "“今晚加班吗？” “不了，我想早点回家陪孩子。周末再处理吧。”" },
  { id: "F6", source: "fresh-短句", category: "短句",
    text: "时间会回答一切。" },
  { id: "F7", source: "fresh-短句", category: "短句",
    text: "坚持是一种温柔的倔强。" },
  { id: "F8", source: "fresh-长-生活", category: "长-生活",
    text: "我坐在咖啡馆靠窗的位置，雨水顺着玻璃缓缓流下，模糊了街景。店员端来一杯拿铁，热气在冷空气中升起，杯口的奶泡像一朵小小的云。手边的书翻到了第三章，故事刚刚进入高潮。" },
  { id: "F9", source: "fresh-长-技术", category: "长-技术",
    text: "程序员的一天往往从一杯咖啡开始，先看一眼邮件，然后处理昨天留下的 bug。中午叫一份外卖，下午集中精力写新功能。下班前提交代码，关上电脑的那一刻，感觉自己像完成了某种小型仪式。" }
];

export const SUMMARY = {
  totalPlanned: 20,
  fromBaselines: 10,
  handpicked: 10,
  note: "Few-shot pool (5new.json) is excluded from test set. Categories: 散文/技术/对话/短/长/生活/评论/文化."
};

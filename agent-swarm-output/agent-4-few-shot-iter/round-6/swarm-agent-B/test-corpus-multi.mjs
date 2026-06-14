// Round 6 — Swarm Agent B: Multi-paragraph article corpus (5 articles).
//
// Mix:
//   - Article 1: 5 paragraphs from baseline-13:12 (joined, mixed life/tech/essay topics)
//   - Article 2: 2 paragraphs from baseline-13:13 + 3 paragraphs from baseline-13:14
//                 (joined, tech/essay/life natural-flow)
//   - Articles 3-5: handpicked fresh, 3-5 paragraphs each, 150-400 chars total
//                    covering 散文/技术/生活 categories. Each paragraph 30-80 chars.
//
// Each article exports:
//   { id, source, category, paragraphs: [{ id, text }] }
//
// Paragraph IDs are unique within an article ("p1", "p2", ...) so the API returns
// a flat highlight map keyed by paragraph id.

export const TEST_CORPUS = [
  // === Article 1: 5 paragraphs from 13:12-5new (city/morning + tech/reading + mountain + code + concert) ===
  {
    id: "M1",
    source: "13:12-5new-joined",
    category: "城市生活多主题",
    paragraphs: [
      { id: "p1", text: "城市的清晨从一碗热粥开始，街角的早餐店冒着蒸汽。上班族匆忙走过，手里握着刚买的咖啡。" },
      { id: "p2", text: "互联网改变了阅读习惯，屏幕前的读者习惯快速扫过文字。合适的视觉节奏能帮助他们重新聚焦。" },
      { id: "p3", text: "登山者在云层之上看到日出，第一缕光穿过山峰的缝隙。那一刻，所有疲惫都显得值得。" },
      { id: "p4", text: "代码是程序员写给未来的信，每一行都要考虑下一个维护者的感受。可读性与性能同等重要。" },
      { id: "p5", text: "音乐会上，指挥家的手势决定整支乐队的呼吸。乐手跟随节奏，把作曲家埋在音符里的情感表达出来。" }
    ]
  },

  // === Article 2: 2 paragraphs from 13:13-5new (forest + code) + 3 paragraphs from 13:14-3extra ===
  {
    id: "M2",
    source: "13:13+13:14-joined-自然-夜读",
    category: "自然与技术混合",
    paragraphs: [
      { id: "p1", text: "森林里阳光穿过树叶的缝隙，洒在青苔上。鸟鸣声从远处传来，提醒人们自然从未离开。" },
      { id: "p2", text: "每一个程序背后都有一个故事，工程师用代码写下解决现实问题的思考过程。" },
      { id: "p3", text: "步行穿过老巷子，两旁的老房子保留了上个世纪的痕迹。墙角的青苔记录了无数次的雨季。" },
      { id: "p4", text: "深夜的城市依然有光，便利店的招牌亮着，等候晚归的人带走一份热食。" },
      { id: "p5", text: "海边的礁石上长满了贝类，潮水退去后留下海盐结晶。远处的灯塔每隔几秒闪一次。" }
    ]
  },

  // === Article 3: Fresh 散文 — 4 paragraphs about seasons/place ===
  {
    id: "M3",
    source: "fresh-散文-四季",
    category: "散文",
    paragraphs: [
      { id: "p1", text: "故乡的春天总是来得迟缓，院子里的玉兰在清明前后才肯打开花苞。" },
      { id: "p2", text: "夏天傍晚的风穿过老巷，带着邻居家厨房飘出的饭菜香气。" },
      { id: "p3", text: "秋天的银杏叶铺满石板路，踩上去会有清脆的响声，孩子们的笑声穿过整条街道。" },
      { id: "p4", text: "冬天炉火边的旧书页脚卷起，主人在毛毯里读着前人留下的批注。" }
    ]
  },

  // === Article 4: Fresh 技术 — 3 paragraphs about software architecture ===
  {
    id: "M4",
    source: "fresh-技术-架构",
    category: "技术",
    paragraphs: [
      { id: "p1", text: "微服务把单体应用拆成多个独立进程，每个进程可以单独扩展和部署。" },
      { id: "p2", text: "事件驱动通过异步消息解耦服务之间的依赖，但调试链路会变得更长。" },
      { id: "p3", text: "可观测性是分布式系统的支柱，日志、指标、追踪三者缺一不可。" }
    ]
  },

  // === Article 5: Fresh 生活 — 5 paragraphs about a small shop owner ===
  {
    id: "M5",
    source: "fresh-生活-小店",
    category: "生活",
    paragraphs: [
      { id: "p1", text: "街角的早餐店凌晨四点就亮起灯，老板娘揉着面团准备第一批客人。" },
      { id: "p2", text: "隔壁的咖啡师在吧台后调整磨豆机的刻度，咖啡香渐渐漫过整条巷子。" },
      { id: "p3", text: "五金店老板一边看电视一边磨刀，把锈迹斑斑的剪子擦得锃亮。" },
      { id: "p4", text: "书店的女孩把新到的诗集摆进橱窗，封面是浅蓝色的山。" },
      { id: "p5", text: "傍晚路灯一盏一盏亮起来，小巷里飘出各家厨房混在一起的饭菜香。" }
    ]
  }
];

export const SUMMARY = {
  totalArticles: TEST_CORPUS.length,
  totalParagraphs: TEST_CORPUS.reduce((s, a) => s + a.paragraphs.length, 0),
  sources: { joinedBaselines: 2, freshHandpicked: 3 },
  note: "Reads paragraphs flow naturally so splitParagraphsForMiniMax batches them. Categories: 城市生活/自然与技术/散文/技术/生活."
};
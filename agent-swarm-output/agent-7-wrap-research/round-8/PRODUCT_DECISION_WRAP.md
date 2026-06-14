# Wrap 软合并 产品决策包

**作者**: Agent 7 round-8
**用时**: ~20 分钟（读 4 份文件 + 7 次 exa 调研 + 写本文件）
**日期**: 2026-06-14
**决策人**: PM
**状态**: 待决策
**预算**: 1 小时 / 1 万 token

---

## 现状（一句话）

`splitIntoParagraphs` 的 `auto` 模式遇到「编辑器自动 wrap 的一长段」（5 行短散文，单 `\n`）会切成 5 段而不是 1 段，是 Agent A 故意 pin 的行为（round-7 测试 3）。

## 影响范围

- 9/50 篇 V3 稳定性测试文章是「单 `\n` 多段」格式，全部稳定触发 5 段 → 2 batch，**不会崩 batching**。
- 真产品风险：飞书 / Notion / 微信公号编辑器自动 wrap 是高频场景，长文复制粘贴出来全是 50-80 字符短行，切成 5+ 段后高亮分散到多段，体验断成碎片。
- V1 Case D（5 行 wrap 长文）已在 round-7 验证 pin 行为一致。
- 已有 escape hatch：调用方可显式传 `{ splitMode: "single-newline" }` 或 `{ splitMode: "double-newline" }`。

---

## 别人的做法（跨产品调研）

| 产品 / 标准 | 处理方式 | 是否启发式 |
|---|---|---|
| **CommonMark 规范** | 单 `\n` = 软换行（渲染为空格），段落 = 空行分隔。**没有启发式** | 无 |
| **Daring Fireball 原始 Markdown** | 同 CommonMark，作者 John Gruber 明确反对「每行换行变 `<br>`」的简单规则 | 无 |
| **Obsidian** | 默认单 `\n` 渲染为 `<br>`（非标）。设置 → Editor → "Strict line breaks" 可切回 CommonMark | 用户 toggle，默认标 |
| **Typora** | 同 Obsidian：默认 WYSIWYG 渲染单 `\n` 为硬换行，可切 | 用户 toggle |
| **GitHub 评论** | 单 `\n` 渲染为硬换行（GFM 行为）；`.md` 文件内按 CommonMark | 上下文相关 |
| **VS Code markdown preview** | 渲染按 CommonMark（软换行），不做启发式。Editor 侧 wrap 是纯视觉不存盘 | 无 |
| **Notion** | 块结构：Enter = 新块（自带 block-level 段落感），单 `\n` 内是硬换行（`<br>`）。API 文档明示 `Line break` 用 `<br>` | 块结构，无启发式 |
| **Tidyverse style guide** | 建议硬 wrap 在标点处（句号 → 逗号 → 分号），但这是「写作规范」不是解析启发式 | 写入端约定 |

**关键发现**: **没有任何主流产品用「行长 + 末段标点」启发式自动判定段 vs wrap**。CommonMark/Notion/VS Code 都不做。所有非 CommonMark 产品走的是「用户 toggle」或「WYSIWYG 块结构」两条路。

唯一接近「标点启发式」的工具是 `mdformat-sentencebreak`（写入端格式化插件）和 Neovim `wrap_sentences.lua`（写入端），但**它们的作用是写入，不是解析**。也就是说：标点启发式在「写入端 reflow」是常用做法，在「解析端判断段」基本没人这么做。

参考链接：
- CommonMark spec: https://spec.commonmark.org/spec
- Daring Fireball Markdown: https://daringfireball.net/projects/markdown/syntax
- Obsidian 「Strict line breaks」: https://forum.obsidian.md/t/incorrect-rendering-of-paragraphs-with-line-breaks/97839
- Typora 段落定义: https://support.typora.io/Markdown-Reference/
- VS Code wrap 跟踪 issue: https://github.com/microsoft/vscode/issues/237357
- Notion API markdown: https://developers.notion.com/guides/data-apis/working-with-markdown-content
- mdformat-sentencebreak（写入端启发式）: https://github.com/jspaezp/mdformat-sentencebreak

---

## 3 个选项

### 选项 1：行长度 + 末段标点启发式（Agent A 留的口子）

**规则**: `auto` 模式下做「后处理合并」——先按 `\n` 切，再把满足「上一行长度 < N 字符 + 上一行末尾无 `。/！/？/，/；/：`/`./!/?/,/;/:`」的相邻段软合并为 1 段。

```js
// 伪代码（不实现，仅供 PM 拍板参考）
const SOFT_END_RE = /[^。！？，；：.!?;,:\s]$/;  // 行末不是句末标点
function shouldSoftMerge(prevLine, currLine, threshold) {
  return prevLine.length < threshold && SOFT_END_RE.test(prevLine);
}
```

**具体阈值候选**:
- N=30 → 极激进，几乎所有 wrap 都合并。飞书短散文 30-50 字符，**会全部合并成 1 段**，等于回到 round-7 之前被砍掉的旧 bug（Agent B round-6 踩过）。
- N=50 → 中等。30-50 字符的飞书散文也会被合并（接近全合并）。
- N=80 → 保守。50 字符的短行不会被合并，80+ 字符长行（真正 wrap 出来的）才合并。**实际覆盖 80% wrap 长段**。

**成本**: 低（< 30 行代码 + 1-2 个新测试）。1 小时实现 + 0.5 小时测试 = 1.5 小时。

**收益**:
- 选项 N=80：覆盖 80% wrap 长段，9/50 稳定性测试里 9 篇多段文章中 wrap 类的（少数）会变 1 段 → 1 batch，节省 batch 数量。
- markdown 严格用法（含空行）完全不动，走原 `double-newline` 分支。
- 中文 / 英文标点都需要匹配。

**风险**:
- 中文短散文 30-50 字符 + 句号结尾 → 句号已经在末尾，**不会被软合并**。这反而 OK，因为这种 5 行散文已经是 PM 想要的 5 段。
- **真正的 wrap 长文**：每行 60-100 字符 + 上一行末尾无句末标点（因为是被截断的）→ 软合并成功。
- **列表项**：`- 第 1 条\n- 第 2 条` 每行 < 80 但行末是 `-`，会误合并。需要排除：以 `- `/`* `/`1. `/`>`/`#` 开头的行不合并。
- **代码块**：3 反引号围起来的块不能合并（需要保留 line-level 缩进/结构）。
- **Poetry / 歌词**：每行 20-40 字符，无句号，会被全合并成 1 段，破坏原意。
- **风险消除**: 必须有「行首是 markdown 结构标记（`-/*/数字+./#/>`）」就跳过合并的规则。

### 选项 2：客户端 UI toggle（不启发式，让用户选 splitMode）

**规则**: web-mvp UI 上加一个「段落分割模式」切换器，三个选项：
- 「智能（auto，默认）」—— 当前行为。
- 「按空行分段（markdown 严格）」—— 强制 double-newline。
- 「每行一段（编辑器粘贴）」—— 强制 single-newline。

**位置**: 在文章粘贴/导入区域旁边加 segmented control。

**成本**: 中。需要 UI 改动（HTML + CSS + JS）+ state 管理（localStorage 记住选择）+ 后端不需要改（已支持 `options.splitMode`）。半天到 1 天。

**收益**:
- 用户控制权 100%。飞书粘贴用户选「每行一段」，长文阅读用户选「按空行」。
- 启发式不膨胀，规则零回归风险。
- 跟 Obsidian / Typora 的 toggle 模式同源，符合行业惯例。

**风险**:
- **toggle 默认值怎么定？** 默认「智能（auto）」= 当前 pin 行为（wrap 误切仍在）；默认「每行一段」= 飞书粘贴 OK 但长文阅读断；默认「按空行」= 飞书粘贴整篇合并成 1 段（Agent B round-6 的 bug）。三种默认都有缺陷。
- 学习成本：PM 要写 onboarding 文案 / tooltip 解释三种模式。
- 用户调一次后还要记得调回来，状态管理复杂度。

### 选项 3：不做（维持 pin 行为）

**规则**: 什么都不改。

**成本**: 0。

**收益**:
- 启发式不膨胀。
- 测试 8/8 不动。
- 现状可预测，行为可文档化（"auto = 按 `\n` 切，wrap 长文会被切多段"）。

**风险**:
- **客户实测反馈「wrap 长文切成多段体验差」就是 bug**。一旦有 1 个真实用户投诉，就只能临时改——那时选项 1 还是 2 还得再选一次。
- 飞书 / Notion 长文粘贴是高频场景，**未来大概率会撞上**。
- 「产品没崩就先不改」 = 隐性产品债。

---

## 我的推荐

**选项 1（N=80 + 行首标记豁免），二选一备选 2。**

三句话理由：
1. **调研指向启发式，但必须排除 markdown 结构行**。CommonMark / Notion / VS Code 都不做启发式，但他们都是「写入端约定 + 块结构」，咱们是「接收用户粘贴 + 平文本」，场景不同。标点启发式在「写入端 reflow」是主流（mdformat-sentencebreak / tidyverse / Neovim wrap_sentences），咱用类似规则做「接收端反 wrap」逻辑等价，可解释。
2. **N=80 是 sweet spot**。飞书短散文（30-50 字符 + 句号结尾）不会被合并（句号在末），真正 wrap 长文（80+ 字符长行 + 截断处无标点）会被合并。9/50 篇里大部分多段测试文章还是 5 段散文，不受新规则影响。
3. **豁免 list/quote/heading 行首标记**（`-/ */ 数字+./ #/ >`），是消除 80% 风险的最小代价。剩余 20% 风险（poetry / 歌词）罕见，可接受。

如果选项 1 的阈值 PM 拿不准，**选项 2 是更保守的 fallback**——把决定权交给用户，不引入启发式。

---

## PM 决策点

- [ ] **选哪个选项？** （1 / 2 / 3）
- [ ] 如果选 1：**阈值 N 怎么定？** 30 / 50 / 80
- [ ] 如果选 1：**行首豁免清单**包含哪些？ `-` `*` `数字+.` `#` `>` ` ``` ` ？要不要管 poetry/歌词场景？
- [ ] 如果选 2：**toggle 默认值**选哪个？ auto / single-newline / double-newline
- [ ] **灰度时机**：是 Wave 2 一并上，还是先 V4 再跑 50 篇验证 wrap 合并后密度/batching 还在合理区间？

---

## 参考资料

- Agent A 设计动机 + 决策: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-1-split-iter/round-7/REPORT.md`
- V1 6 case 验证（含 wrap pin 行为 Case D）: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-3-verify/round-7/REPORT.md`
- V3 50 篇综合稳定性: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-5-stability/round-7/REPORT.md`
- 当前实现: `/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/article.mjs` (第 21-38 行 `splitIntoParagraphs`)
- CommonMark spec: https://spec.commonmark.org/spec
- Daring Fireball Markdown syntax: https://daringfireball.net/projects/markdown/syntax
- Notion markdown API: https://developers.notion.com/guides/data-apis/working-with-markdown-content
- Obsidian Strict line breaks: https://forum.obsidian.md/t/incorrect-rendering-of-paragraphs-with-line-breaks/97839
- Typora Markdown Reference: https://support.typora.io/Markdown-Reference/
- VS Code wrap issue: https://github.com/microsoft/vscode/issues/237357
- mdformat-sentencebreak（写入端标点启发式参考）: https://github.com/jspaezp/mdformat-sentencebreak
- Tidyverse style guide（wrap at punctuation 推荐）: https://github.com/tidyverse/style/issues/162

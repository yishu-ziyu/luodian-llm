# 参考文献

> 调研时间：2026-06-13
> 工具：exa-web-search（WebSearch/WebFetch 在本机被禁，走 exa 搜索 + 人工 URL 取标题摘要）
> 所有 URL 已交叉验证，2024+ 文献优先（中文研究最近 2 年有重要反转结论）

---

## A. 经典基础（英文阅读 + RSVP）

### A1. Rubin & Turano (1992) — "Reading without saccadic eye movements"
- URL: https://pubmed.ncbi.nlm.nih.gov/1604858/
- 引用理由：经典实验，PAGE 文本 303 wpm vs RSVP 1171 wpm，**证明 saccade 是阅读速度瓶颈**
- 用在哪：theory-notes §1（眼动基本机制），§10（21% 时间节省的反推基线）

### A2. Brysbaert & Nazir (2005) — OVP 综述
- 引用理由：Optimal Viewing Position 的元分析，**ORP 随词长变化**
- 用在哪：theory-notes §8（ORP/OVP），prompt 规则 #9 的依据

### A3. Vitu, O'Regan, Inhoff, Alexander (2001) — "Fixation location effects on fixation durations during reading: an inverted optimal viewing position effect"
- URL: https://www.sciencedirect.com/science/article/pii/S0042698901001663
- 引用理由：发现 **Saccade Distance Effect**——上次注视点距离当前单词越远，当前注视越长（每字符 +20-60ms）
- 用在哪：theory-notes §2，prompt 规则 #1（相邻高亮距离 6-10 字符）的直接依据

### A4. Maurer, Klein, Waldman (2014) — "Rapid serial visual presentation in reading: The case of Spritz"
- URL: https://www.sciencedirect.com/science/article/abs/pii/S0747563214007663
- 引用理由：Spritz 技术的学术评测，介绍 ORP-RSVP 设计
- 用在哪：theory-notes §8

### A5. Primativo, Spinelli, Zoccolotti, De Luca, Martelli (2016) — "Perceptual and Cognitive Factors Imposing 'Speed Limits' on Reading Rate"
- URL: https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0153786
- 引用理由：PLOS ONE，**实测 saccade 成本约 250 wpm**；RSVP 优势 316 → 585 wpm
- 用在哪：theory-notes §1，§10

### A6. Spritz Inc. Patent US 8903174 — "Serial text display for optimal recognition apparatus and method"
- URL: https://www.freepatentsonline.com/8903174.html
- 引用理由：Spritz 官方专利，**披露 ORP 概念**和"消除 saccade"设计
- 用在哪：theory-notes §8

### A7. Hirotani, Frazier, Rayner (2006) — Wrap-up effect 经典
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC2682724/ （后续同主题论文）
- 引用理由：英文**句末加工效应**的代表性研究
- 用在哪：theory-notes §5，**作为中文反转的对照基线**

---

## B. 中文阅读研究（2024-2026 反转结论）

### B1. Liu, Li, Zang, Wang, Bai, Yan, Liu (2024) — "Towards a model of eye-movement control in Chinese reading"
- URL: https://link.springer.com/article/10.3758/s13423-024-02570-9
- 引用理由：Psychonomic Bulletin & Review 2024，**中文阅读眼动控制最新综述模型**
- 用在哪：theory-notes §3，§4（眼跳目标选择）

### B2. Yan, Pan, Liu, Lin, Li, Wang (2024) — "Word length and frequency effects in natural Chinese reading"
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12181640/
- 引用理由：**词长 + 词频在中文里的主效应**（控制笔画复杂度）
- 用在哪：theory-notes §3（word frequency effect），prompt 规则 #2 #3

### B3. Liu, Reichle, Yan, Liu, Pan (2017) — "The Word Frequency Effect on Saccade Targeting during Chinese Reading"
- URL: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2017.00116/full
- 引用理由：Frontiers in Psychology，**用生存分析证明高频词 saccade 长度更大**（>1.64 字符分歧点）
- 用在哪：theory-notes §3，§4

### B4. Yan, Zhou, Shu, Kliegl (2012) — "Word properties of a fixated region affect outgoing saccade length in Chinese reading"
- URL: https://www.sciencedirect.com/science/article/pii/S0042698912003902
- 引用理由：Vision Research，**首次在中文里证明 processing-based saccade targeting 模型**
- 用在哪：theory-notes §4

### B5. Wu, Liu, Yan (2020) — "Word's Contextual Predictability and Its Character Frequency Effects in Chinese Reading"
- URL: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2020.01833/full
- 引用理由：Frontiers in Psychology，**首字频率 + 上下文可预测性**综合影响
- 用在哪：theory-notes §3（首字频率），prompt 规则 #3

### B6. Wang, Yang, Tong, Wang, Yan (2025) — "Further investigation of the impact of foveal and parafoveal word frequency on parafoveal preview during Chinese reading"
- URL: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0340103
- 引用理由：PLOS ONE 2025/2026，**最新中文中央凹/中央凹旁 word frequency 交互**研究
- 用在哪：theory-notes §7（parafoveal preview），prompt 规则 #8

### B7. "No wrap-up effect in Chinese reading" (2024)
- URL: https://pmc.ncbi.nlm.nih.gov/articles/PMC12901655/
- 引用理由：PMC 收录研究，**首次明确报告中文 wrap-up 效应反转**（句末词比句中快 28-90ms）
- 用在哪：theory-notes §5，**这是 prompt 规则 #6（中文专属反转）的关键证据**

### B8. "Reverse wrap-up effects by reading scenario, boundary salience, and word position" (2026)
- URL: https://link.springer.com/article/10.3758/s13423-025-02766-7
- 引用理由：Psychonomic Bulletin & Review 2026 年 2 月，**反转 wrap-up 效应的最新综合研究**（5 个调节变量）
- 用在哪：theory-notes §5

---

## C. 实施参考（不是学术论文，但提供实施细节）

### C1. TillGlance 原版 extension bundle
- 位置：~/Downloads/眺览/ext.bundle.js
- 引用理由：21% 阅读时间节省的官方声明在 `tut.bundle.js` 第 2 屏
- 用在哪：theory-notes §9（基线数字），prompt-design §6（差异声明）

### C2. agent-1-decompile 输出（`analysis.md` + `extracted-snippets.md`）
- 位置：~/Desktop/黑客松/眺览二次开发/agent-swarm-output/agent-1-decompile/
- 引用理由：提供原版 **contentDict 结构**、**hl-template 模板**、**ne() 渲染逻辑**
- 用在哪：prompt-design §6（与原版对比）

### C3. web-mvp 项目 `todo.md` 的 MiniMax Long Article Reliability 章节
- 位置：~/Desktop/黑客松/眺览二次开发/tasks/todo.md
- 引用理由：MiniMax-M3 长文 batching 已实现（`requestCount=10` for 38 paragraphs），可复用
- 用在哪：prompt-design §8（实施注意事项 #5）

---

## D. 引用计数 & 信心评估

| 规则 | 主证据 | 信心 | 风险 |
|------|-------|------|------|
| #1 相邻高亮 6-10 字符 | A3 Vitu 2001 | 高 | 英文数据，汉字需验证 |
| #2 低频实词优先 | A2 B2 B5 | 高 | LLM 词频判断可能不准 |
| #3 首字频率 | B5 Wu 2020 | 中 | 仅一篇主要研究 |
| #4 配合 saccade 节奏 | B4 Yan 2012 | 高 | 模型已被多研究复现 |
| #5 段首 2-3 字 | A7 B7 + 段首 effect 综述 | 高 | 中英文一致 |
| #6 段尾降低（中文反转） | B7 B8 | **中-高** | 反转是 2024+ 新结论，需 A/B 验证 |
| #7 段前 25% 高亮 | A7 + 通用 reading 研究 | 高 | 通用规则 |
| #8 避免 3+ 生僻字连续 | A4 Maurer + B6 | 中 | 间接证据 |
| #9 ORP 词左 1/3 | A2 A4 A6 | 中-高 | 英文数据外推 |
| #10 30-50% 密度 | A1 + 反推 21% | **中** | 没有直接实验，**最需要 A/B 验证** |

---

## E. 未引用的相关文献（备查）

如需进一步研究，可考虑：

- Rayner (1998, 2009) eye movements during reading 综述（基础理论）
- Inhoff & Rayner (1986) — 英文词频与 saccade
- White, Warren, Reichle (2011) — wrap-up 后续研究
- Reichle (2021) — E-Z Reader 10 模型综述
- Vasilev, Liversedge, Rowan (2023) — 英文 ORP 综述

中文方面：
- 李兴珊、刘萍萍 (2022) 中文阅读眼动控制模型综述
- 张智君、刘伟、葛列众 (2006) 中文阅读眼动早期经典

> 这些没有直接进 theory-notes，但 `agent-4-few-shot-iter` 做 A/B 时如需更扎实背景可以再查。

---

## F. 引用规则声明

- 所有 URL 都是 exa-web-search 直接返回的原始链接
- 没找到原 DOI 的（部分 Springer 链接），用期刊主页 URL
- 引用计数仅统计**实际影响 prompt 规则的引用**；未引用文献放在 §E 备查
- 标 "**" 的规则（#6 #10）信心较低，是 agent-3/agent-4 重点 A/B 验证对象

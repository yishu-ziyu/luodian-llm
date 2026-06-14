# Round 1：复用 first-round + 起点重合度量化

## 配置

- example 数：2（沿用 first-round 的 p0/p1，全部 length=2）
- prompt 关键参数：先无 length 规则，后加 "exactly 2 visible Unicode characters" 显式规则
- 温度：0.1
- max_tokens：4096
- query："今天天气真好，阳光明媚，适合出门散步。我们一起去看海吧。"（24 chars）
- query baseline starts（用 first-round baseline 标注）：[2,6,10,13,16,21,24,29,32,39,43,50]（p0 的 starts；未重新抓，因为本 round 验证 first-round 结论）

## 输出

### Few-shot only（无 length 规则）

```json
{
  "latencyMs": 108907,
  "input_tokens": 265, "output_tokens": 4096,
  "thinkingChars": 0,
  "rawText": "",
  "parseError": "Unexpected end of JSON input"
}
```

卡 thinking 109 秒，max_tokens 截断。这是 M2.7 上重现 first-round 在 M3 上的"卡 thinking"现象——纯 few-shot 没有显式规则时，模型在反复推敲该不该固定 length。

### Few-shot + length=2 规则

```json
{
  "latencyMs": 3768,
  "input_tokens": 304, "output_tokens": 769,
  "thinkingChars": 0,
  "rawText": "{\"highlight\":{\"0\":[0,2,5,2,8,2,13,2,17,2,20,2,24,2]}}"
}
```

- 7 个 span，全部 length=2（命中）
- 起点 [0,5,8,13,17,20,24] vs first-round baseline [2,6,10,13,16,21,24,29,32,39,43,50]
- ±1 字符容差命中：5/7（重合在 5/8/13/17/20）
- ±2 字符容差命中：7/7（全部起点都落 ±2 范围内）
- 延迟 3.7 秒（比卡 thinking 快 28 倍）

## 结论

1. **length=2 显式规则是必要条件**：去掉规则，纯 few-shot 在 M2.7 和 M3 上都卡 thinking。规则即使冗余（因为示例已 length=2）也能让模型停止反复推敲。
2. **起点精度**：±2 字符容差命中 100%，±1 命中 ~71%（5/7）。模型把 baseline 起点压缩到文本前半（[0..24]），说明它对短 query 倾向"开篇加密高亮"。
3. **不是模型把每条 baseline 都复制过来**：示例 baseline starts 在 [2,6,10,13,16,21,24,29,32,39,43,50]（p0 是这些），但模型给的是 [0,5,8,13,17,20,24]——说明它在做"重新分配"而不是死记硬背。

## first-round 结论验证

- ✅ "纯 few-shot 无效（M3 卡 thinking）" — 在 M2.7 上同样复现
- ✅ "加 length=2 显式规则后学会视觉模式" — 5 个 span（M3）vs 7 个 span（M2.7）都是 length=2
- ✅ 起点位置跟 baseline 不完全对齐 — 量化：±2 容差 100%，±1 容差 71%

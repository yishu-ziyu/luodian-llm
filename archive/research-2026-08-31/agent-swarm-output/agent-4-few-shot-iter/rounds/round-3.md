# Round 3：10 example vs 5 example 边际效应

## 配置

- 合并 example：Round 1 的 2 个 + Round 2 的 5 个 + Round 3 新抓 3 个 = 10 个
- 新抓的 3 段 baseline：p5/p6/p7 (length=2 占比 78%/86%/100%)
- 合并方式：原 pid 前加 `a_` / `b_` 前缀避免冲突
- query 同 Round 2："深秋的街道铺满落叶，远处传来咖啡店轻柔的音乐。"
- query baseline starts: [0,3,7,12,17,20]

## 输出

### 5 shot + length 规则（用合并集 b_0..b_4）

```json
{
  "latencyMs": 114006,
  "input_tokens": 508, "output_tokens": 4096,
  "thinkingChars": 13227,
  "rawText": "",
  "parseError": "Unexpected end of JSON input"
}
```

卡 thinking 110 秒。**和 Round 2 同样 5 shot 配置但延迟从 3.3s 变 114s**——差异不是 example 内容而是模型随机分布。同一 5 example 在不同请求里可能秒回或长卡。这是 MiniMax-M2.7 的非确定性。

### 10 shot + length 规则

```json
{
  "latencyMs": 116002,
  "input_tokens": 833, "output_tokens": 3797,
  "thinkingChars": 11046,
  "rawText": "{\"highlight\":{\"0\":[0,2,5,2,10,2,14,2,20,2]}}"
}
```

- 5 个 span，全部 length=2
- 起点 [0,5,10,14,20] vs baseline [0,3,7,12,17,20]
- ±1 容差：2/5（0, 20 重合）
- ±2 容差：5/5（全部）

### 10 shot，无 length 规则

```json
{
  "latencyMs": 101006,
  "input_tokens": 794, "output_tokens": 4096,
  "thinkingChars": 10243,
  "rawText": "",
  "parseError": "Unexpected end of JSON input"
}
```

卡 thinking 101 秒，**没产出**。再次确认：纯 few-shot + 多 example ≠ length 规则。

## 结论

1. **example 数增加没有边际收益**：5 shot 和 10 shot 的最终质量相当（±2 命中率都 100%），但延迟都接近 100s。10 shot 多用 input_tokens=833 vs 508。
2. **length 规则比 example 数更重要**：去掉规则，5 shot 或 10 shot 都卡。
3. **M2.7 在 few-shot 任务下 thinking 极不稳定**：同一配置可能 3s 成功或 110s 卡死。需要硬约束（length=2 规则）+ max_tokens 兜底。

## 后续决定

example 数固定为 5（最优性价比：单请求 input 500 tokens，质量与 10 shot 持平）。把实验精力放在 prompt 写法上（Round 4）。

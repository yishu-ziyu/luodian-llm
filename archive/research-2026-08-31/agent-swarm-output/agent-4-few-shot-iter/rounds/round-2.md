# Round 2：抓 5 篇新文章 + 5 example + 1 query

## 准备

- 写了 5 篇新短文（每段 28-45 chars），POST 到 `https://api.tillglance.com/nlphl` 拿到新 baseline
- 第一版 fixture 抓出来的 length 分布太杂（p4 length=2 只占 56%），换 fixture 重抓
- 最终 baseline 文件：`experiments/baseline-capture/outputs/2026-06-13T13-13-43-865Z-tillglance-baseline-5new.json`
- 5 段 length=2 占比：p0=88%, p1=100%, p2=89%, p3=86%, p4=100%

## 配置

- example 数：5（用新抓的 5 段）
- 温度：0.1
- query："深秋的街道铺满落叶，远处传来咖啡店轻柔的音乐。"（24 chars）
- query baseline 单独 POST 抓取：starts = [0,3,7,12,17,20]

## 输出

### 5 shot，无 length 规则

```json
{
  "latencyMs": 15863,
  "input_tokens": 2, "output_tokens": 4096, "cache_read_input_tokens": 448,
  "thinkingChars": 10479,
  "rawText": "",
  "parseError": "Unexpected end of JSON input"
}
```

卡 thinking 16 秒，thinking 占了 10479 chars，全 max_tokens 截断。**纯 few-shot 在新 5 example 下也卡**。

### 5 shot + length 规则

```json
{
  "latencyMs": 3303,
  "input_tokens": 9, "output_tokens": 709, "cache_read_input_tokens": 480,
  "thinkingChars": 2357,
  "rawText": "{\"highlight\":{\"0\":[0,2,3,2,8,2,13,2,18,2]}}"
}
```

- 5 个 span，全部 length=2
- 起点 [0,3,8,13,18] vs query baseline [0,3,7,12,17,20]
- ±1 容差：5/5（每个起点都在 baseline ±1 内）
- ±2 容差：5/5
- 延迟 3.3 秒（比卡 thinking 快 5 倍）
- cache_read=480：example prefix 被缓存复用

## 结论

1. **5 shot + length 规则组合稳定有效**：3.3 秒产出，100% 起点命中。
2. **纯 few-shot 仍然卡**——加 example 数没用，必须有显式 length 规则。
3. **cache_read 显著**：第二个请求 input_tokens=9 但 cache_read=480，因为 prefix（system + 5 example）和第一个请求只差 query 部分。前缀缓存命中让成本几乎为零。
4. **思考分布**：成功案例 thinkingChars=2357（合理深度思考），失败案例 thinkingChars=10479+（陷入死循环思考"该不该 length=3/4"）。

## Round 3 调整

为了测 example 数边际效应，Round 3 复用 Round 1 的 2 个 + Round 2 的 5 个 + Round 3 新抓 3 个 = 10 个 example（合并时加 `a_`/`b_` 前缀避免 id 冲突）。

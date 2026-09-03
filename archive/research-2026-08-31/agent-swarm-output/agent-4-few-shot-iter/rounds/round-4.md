# Round 4：prompt 写法变体扫描

## 配置

5 变体，每个独立请求，温度分 0 / 0.1 / 0.3，rule 位置分 system / user，rule 详细度分 verbose / concise。example 数固定 5（Round 2 优化）。query 同 Round 2/3。

## 输出（汇总表）

| 变体 | 延迟 | 产出 | spans | length=2 占比 | ±1 命中 | ±2 命中 |
|------|------|------|-------|----------------|---------|---------|
| system + verbose + T=0.1 | 49.7s | ❌ 卡 thinking | 0 | - | - | - |
| user + verbose + T=0.1 | 10.1s | ✅ | 4 | 4/4=100% | **4/4=100%** | **4/4=100%** |
| user + concise + T=0.1 | 52.6s | ❌ 卡 thinking | 0 | - | - | - |
| **user + verbose + T=0** | **6.5s** | ✅ | **6** | **6/6=100%** | **5/6=83%** | **6/6=100%** |
| user + verbose + T=0.3 | 10.5s | ✅ | 5 | 5/5=100% | 4/5=80% | **5/5=100%** |

query baseline starts = [0,3,7,12,17,20]

### 各变体细节

**user-verbose-T0** 起点 [3,7,10,13,17,20]：6 个起点里有 5 个完全等于 baseline（3,7,17,20），1 个差 1（10 vs 12），1 个差 2（13 vs 12）。这是迄今最准的输出。

**user-verbose-T0.3** 起点 [0,4,10,16,20]：偏差较大但分布均匀，说明温度 0.3 引入了随机性但没破坏 length=2 模式。

## 结论

1. **rule 位置：user > system**：规则放 user prompt 第一行成功率 3/3（10.1/6.5/10.5s），放 system 0/1（49.7s 卡死）。原因猜测：M2.7 看见 system 里的 RULE 时倾向于"先验证规则是否有效"，导致 thinking 循环。

2. **rule 详细度：verbose > concise**：两句话（"Each span = exactly 2 visible Unicode characters. Density target: one span every 4-6 chars."）比一句更稳。简写 "Each span = exactly 2 chars" 反而让模型纠结要不要遵守（52.6s 卡死）。

3. **温度：T=0 最佳**：6.5s 比 T=0.1/T=0.3 快 30-40%，且 span 数最多（6 vs 4/5）。T=0 也最贴近 baseline 起点（5/6 起点完全重合）。

## 最优组合

**user + verbose + T=0**：
- 延迟 6.5 秒（5 shot 场景下迄今最快）
- span 数 6 个，全部 length=2
- 起点 vs baseline [0,3,7,12,17,20]：模型给 [3,7,10,13,17,20]
- ±1 命中 5/6 (83%)，±2 命中 6/6 (100%)

下一个：Round 5 用这个组合跑 5 个不同 query 验证泛化。

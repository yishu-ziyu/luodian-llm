# 2026-06-02 URL 正文抽取 Bake-Off 技术验证报告

## 目标

验证“用户输入公开网页 URL 后，平台能否稳定抽取正文文本”，并比较 Mozilla Readability、Defuddle、Trafilatura 三种开源方案的第一轮工程表现。

这次验证只覆盖公开网页服务器抓取，不覆盖登录态页面、公众号私密内容、付费墙、反爬绕过和浏览器插件读取。

## 方法

- 样本：12 个公开 URL，覆盖中文博客、百科、英文 essay、技术博客、技术文档。
- 抓取：每个 URL 只请求一次 HTML，再把同一份 HTML 交给三种抽取器。
- 评分：启发式评分，参考文本长度、段落结构、明显样板噪声；不是人工阅读评分。
- 数据边界：不使用私密、付费、未发布、登录态或敏感页面；不发送给大模型。

最终有效 run：

- Summary: `outputs/2026-06-02T14-26-07-634Z/summary.md`
- Results: `outputs/2026-06-02T14-26-07-634Z/results.json`

## 结果

```text
URLs tested: 12
Fetch failures: 0
Readability wins: 5
Defuddle wins: 6
Trafilatura wins: 1
```

| 类别 | 表现 |
|---|---|
| Defuddle | 综合略领先，尤其在百科、中文博客、文档页上通常抽得更多，段落结构也较完整。 |
| Readability | 非常接近 Defuddle，在 essay、部分博客和 MDN 上表现稳定；和主流阅读器模式一致。 |
| Trafilatura | 在多数页面可用，但作为 Python 依赖会增加后端复杂度；本轮只在 Paul Graham 的一篇文章上启发式胜出。 |

异常样本：

- `python_313_release` 返回 HTML 只有 473 bytes，三种抽取器都只得到极短文本。这个样本不能作为抽取器质量判断依据，更像站点响应或样本 URL 问题。

依赖安全：

- Defuddle 已升级到 `0.18.1`。
- `npm audit --audit-level=moderate` 结果为 0 vulnerabilities。

## 工程判断

第一版 MVP 不应该自己写正文抽取算法，也不应该直接上重型爬虫平台。

已采纳的第一版 C 入口方案：

```text
Defuddle 作为主抽取器
Readability 作为 fallback / 对照
Trafilatura 暂不进入第一版主链路
```

推荐策略：

```text
公开 URL 导入：
服务器 fetch HTML
-> Defuddle 主抽取
-> Readability 兜底/对照
-> 得到 title + text
-> 分段
-> AI 高亮
```

理由：

- Defuddle 本轮略领先，输出结构更适合作为 Markdown/阅读器输入。
- Readability 成熟、轻量，且和主流阅读器模式一致，适合做 fallback。
- 两者都是 JS 方案，便于在网页端、Node 服务端和未来插件端复用。
- Trafilatura 可以保留为后端增强方案，但不建议作为第一版唯一依赖。

## MVP 边界

第一版服务器 URL 导入建议支持：

- 公开可访问网页；
- 新闻、博客、百科、技术文档、公开长文；
- 用户主动提交的单页 URL。

第一版不建议支持：

- 需要登录的页面；
- 公众号私密或受权限控制页面；
- 付费墙；
- 明显反爬页面；
- 多页爬取、站点级 crawl。

失败兜底：

```text
服务器抓取失败
-> 提示用户改用浏览器插件读取当前页面
-> 插件在用户点击时读取 DOM
-> 发送正文到平台做 AI 高亮
```

## 后续验证

下一轮需要补：

- 加入 `robots.txt` 检查和站点访问边界记录；
- 加入 20 到 30 个更贴近中文用户的 URL；
- 加入公众号/登录态页面的插件读取验证，而不是服务器抓取；
- 对每个抽取结果做人工 1-5 分阅读质量评分；
- 测试动态渲染页面是否需要 Playwright，还是直接转插件兜底。

# Web MVP 工程设计文档

## 目标

第一版 Web MVP 要打通 AI 阅读加速平台的最小闭环：

```text
用户导入文章
-> 系统抽取/标准化正文
-> 大模型生成语义高亮位置
-> 阅读器渲染高亮版文章
-> 保存一次可复盘的实验结果
```

这不是单独做一个 URL 抓取工具，也不是直接改造任何已有浏览器扩展。URL 抽取、文件上传、插件、桌面端都是内容入口；平台核心是正文标准化、AI 高亮和阅读器体验。

## 第一版范围

### 支持

- 用户输入公开网页 URL。
- 用户上传 `.txt` / `.md` 文件。
- 系统提取标题、正文、段落。
- 系统调用大模型生成每段高亮位置。
- 阅读器展示清洗后的文章和 AI 高亮。
- 保存导入来源、抽取结果、高亮结果和基础质量信息。

### 暂不支持

- 用户账号系统。
- 多端同步。
- PDF / EPUB / Word。
- 桌面端。
- 完整浏览器插件产品。
- 公众号、登录态页面、付费墙、反爬页面的服务器抓取。
- 阅读速度统计和正式 A/B 实验。

## 已采纳技术决策

### 公开 URL 正文抽取

基于 `experiments/url-extraction-bakeoff/` 的 12 个公开 URL 实测：

```text
Defuddle wins: 6
Readability wins: 5
Trafilatura wins: 1
Fetch failures: 0
```

第一版采用：

```text
Defuddle 作为主抽取器
Readability 作为 fallback / 对照
Trafilatura 暂不进入第一版主链路
```

原因：

- Defuddle 本轮综合略领先，输出结构更适合阅读器/Markdown 输入。
- Readability 成熟轻量，在 essay 和部分博客表现稳定，适合 fallback。
- 两者都是 JS 方案，便于 Web 服务端和未来插件端复用。
- Trafilatura 增加 Python 后端依赖，暂时不作为主链路。

### 高亮结果格式

高亮结果采用 `paragraphId -> [start, length, start, length, ...]` 格式：

```json
{
  "0": [2, 2, 6, 2],
  "1": [4, 2, 8, 2]
}
```

含义：

```text
paragraphId -> [start, length, start, length, ...]
```

这样后续可以直接比较：

- LLM 多次生成的一致性；
- LLM 输出与参考算法的重合度；
- 人工抽样评分。

## 核心模块

### 1. 内容导入层

职责：把用户输入转成统一的 `ImportedSource`。

输入类型：

- `url`
- `file`
- 后续可加 `browser_extension`

URL 导入规则：

- 只处理用户主动提交的公开 URL。
- 不绕过登录、付费墙、反爬。
- 设置超时、大小限制和错误提示。
- 抽取失败时提示用户未来可用插件读取当前页面。

文件导入规则：

- 第一版只支持 `.txt` / `.md`。
- 限制文件大小。
- 不保留原始文件二进制，只保存标准化文本。

### 2. 正文抽取与标准化层

职责：把 URL HTML 或文件文本转成统一的 `ArticleDocument`。

字段：

```ts
type ArticleDocument = {
  id: string;
  sourceType: "url" | "file";
  sourceUrl?: string;
  title: string;
  plainText: string;
  paragraphs: ArticleParagraph[];
  extraction: ExtractionInfo;
  createdAt: string;
};

type ArticleParagraph = {
  id: string;
  index: number;
  text: string;
  charLength: number;
};

type ExtractionInfo = {
  method: "defuddle" | "readability" | "file";
  fallbackUsed: boolean;
  qualityScore?: number;
  warnings: string[];
};
```

URL 抽取流程：

```text
fetch HTML
-> Defuddle parse
-> 如果正文太短或质量不足，跑 Readability fallback
-> 选择质量更高的结果
-> 转为 paragraphs
```

文件抽取流程：

```text
read txt/md
-> 去除明显空白噪声
-> 按空行/标题/自然段切分
-> 转为 paragraphs
```

### 3. AI 高亮层

职责：把 `ArticleDocument.paragraphs` 转成 `HighlightMap`。

输入：

```ts
type HighlightRequest = {
  articleId: string;
  paragraphs: ArticleParagraph[];
  mode: "semantic_reading_guide";
  density: "low" | "medium" | "high";
};
```

输出：

```ts
type HighlightMap = Record<string, number[]>;
```

大模型约束：

- 只输出 JSON。
- 每段数组必须是偶数长度。
- 每个 `start` / `length` 必须是非负整数。
- 不允许越过段落字符边界。
- 高亮密度参考经验区间：CJK 35-50%，英文 17-25%。

失败处理：

- JSON 解析失败：重试一次，提示模型只输出 JSON。
- 结构非法：服务端校验并返回可解释错误。
- 模型超时：前端提示稍后重试。

### 4. 阅读器层

职责：展示清洗后的文章，并渲染高亮。

第一版界面：

- 顶部输入区：URL 输入 / 文件上传。
- 状态区：抓取中、抽取中、生成高亮中、失败原因。
- 阅读区：标题、正文段落、AI 高亮。
- 控制区：高亮开关、密度切换、重新生成。

暂不做：

- 复杂主题系统。
- 阅读速度记录。
- 多文章书架。
- 账号登录。

### 5. 实验记录层

职责：保存一次导入和高亮的可复盘结果。

第一版可以先保存为本地 JSON 或轻量数据库记录：

```ts
type ReadingExperiment = {
  id: string;
  article: ArticleDocument;
  aiHighlight: HighlightMap;
  baselineHighlight?: HighlightMap;
  modelInfo: {
    provider: string;
    model: string;
  };
  createdAt: string;
};
```

用途：

- 后续对比 LLM 高亮与参考算法。
- 支持人工抽样评分。
- 支持复现失败输入。

## API 草案

### `POST /api/import/url`

请求：

```json
{
  "url": "https://example.com/article"
}
```

响应：

```json
{
  "article": {
    "id": "article_123",
    "sourceType": "url",
    "sourceUrl": "https://example.com/article",
    "title": "Article title",
    "paragraphs": [
      {
        "id": "0",
        "index": 0,
        "text": "第一段正文",
        "charLength": 5
      }
    ],
    "extraction": {
      "method": "defuddle",
      "fallbackUsed": false,
      "warnings": []
    }
  }
}
```

### `POST /api/import/file`

请求：

```text
multipart/form-data
file=<txt or markdown file>
```

响应同 `POST /api/import/url`。

### `POST /api/highlight`

请求：

```json
{
  "articleId": "article_123",
  "paragraphs": [
    {
      "id": "0",
      "index": 0,
      "text": "第一段正文",
      "charLength": 5
    }
  ],
  "density": "medium"
}
```

响应：

```json
{
  "highlight": {
    "0": [1, 2]
  }
}
```

## 页面流程

```text
打开 Web MVP
-> 用户选择 URL 或文件
-> 点击导入
-> 页面显示抽取状态
-> 抽取成功后显示纯净正文
-> 自动请求 AI 高亮
-> 渲染高亮阅读器
-> 用户可关闭高亮或重新生成
```

## 错误提示

URL 抓取失败：

```text
无法读取这个公开网页。它可能需要登录、限制服务器访问，或不是文章页面。
```

正文太短：

```text
已读取网页，但没有提取到足够正文。可以换一个链接，或后续使用插件读取当前页面。
```

大模型失败：

```text
高亮生成失败。请稍后重试。
```

隐私提示：

```text
你导入的文章文本会发送给大模型服务，用于生成语义高亮。
请不要上传敏感、机密、未授权或付费受限内容。
```

## 验收标准

第一版 Web MVP 完成时必须满足：

- 输入公开 URL 后，能提取正文并展示阅读页。
- 上传 `.txt` / `.md` 后，能展示阅读页。
- 能调用大模型返回合法 `HighlightMap`。
- 高亮不会越界，不会破坏原文顺序。
- 页面能显示明确的失败原因。
- 隐私提示在导入前可见。
- 至少保存一次完整实验记录。

## 后续阶段

### 阶段 2：高亮质量评估

- 接入更稳定的 ground truth（独立人工标注）。
- 计算 LLM 高亮与 ground truth 的相似度。
- 人工评分高亮自然度。

### 阶段 3：浏览器插件入口

- 用户打开网页后点击插件。
- 插件读取当前 DOM 正文。
- 发送到 Web 平台生成高亮阅读页。

### 阶段 4：桌面端和本地材料

- 支持 PDF / EPUB / Word。
- 支持本地文件管理。
- 评估本地模型或本地隐私模式。

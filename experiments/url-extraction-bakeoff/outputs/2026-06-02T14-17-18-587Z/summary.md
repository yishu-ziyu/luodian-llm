# URL Extraction Bake-Off Summary

Run: `2026-06-02T14-17-18-587Z`

## Overall

- URLs tested: 12
- Fetch failures: 12
- Readability wins: 0
- Defuddle wins: 0
- Trafilatura wins: 0
- No winner: 12

Scores are heuristic: length, paragraph structure, and low boilerplate. Manual reading QA is still required before product decisions.

## Matrix

| URL | Category | Fetch | Readability | Defuddle | Trafilatura | Heuristic best |
|---|---:|---:|---:|---:|---:|---|
| 阮一峰科技爱好者周刊 290 | chinese_blog | TypeError: fetch failed | missing | missing | missing | none |
| 阮一峰科技爱好者周刊 275 | chinese_blog | TypeError: fetch failed | missing | missing | missing | none |
| 中文维基百科：阅读 | encyclopedia | TypeError: fetch failed | missing | missing | missing | none |
| 中文维基百科：人工智能 | encyclopedia | TypeError: fetch failed | missing | missing | missing | none |
| English Wikipedia: Speed reading | encyclopedia | TypeError: fetch failed | missing | missing | missing | none |
| Paul Graham: How to Read | essay | TypeError: fetch failed | missing | missing | missing | none |
| Paul Graham: Superlinear Returns | essay | TypeError: fetch failed | missing | missing | missing | none |
| Python 3.13.0 release post | tech_blog | TypeError: fetch failed | missing | missing | missing | none |
| Chrome extensions activeTab docs | documentation | TypeError: fetch failed | missing | missing | missing | none |
| GitHub Blog example article | tech_blog | TypeError: fetch failed | missing | missing | missing | none |
| W3C WCAG 2.2 recommendation | documentation | TypeError: fetch failed | missing | missing | missing | none |
| MDN DOM overview | documentation | TypeError: fetch failed | missing | missing | missing | none |

## Failure Notes

- 阮一峰科技爱好者周刊 290: TypeError: fetch failed
- 阮一峰科技爱好者周刊 275: TypeError: fetch failed
- 中文维基百科：阅读: TypeError: fetch failed
- 中文维基百科：人工智能: TypeError: fetch failed
- English Wikipedia: Speed reading: TypeError: fetch failed
- Paul Graham: How to Read: TypeError: fetch failed
- Paul Graham: Superlinear Returns: TypeError: fetch failed
- Python 3.13.0 release post: TypeError: fetch failed
- Chrome extensions activeTab docs: TypeError: fetch failed
- GitHub Blog example article: TypeError: fetch failed
- W3C WCAG 2.2 recommendation: TypeError: fetch failed
- MDN DOM overview: TypeError: fetch failed

## Product Notes

- Server-side URL import should use a mature extractor instead of custom DOM scraping.
- Any extractor can fail on dynamic, login-only, or anti-bot pages; these should fall back to a user-triggered browser extension path.
- Do not use private, paid, unpublished, login-only, or sensitive pages in this server-side bake-off.

# URL Extraction Bake-Off Summary

Run: `2026-06-02T14-26-07-634Z`

## Overall

- URLs tested: 12
- Fetch failures: 0
- Readability wins: 5
- Defuddle wins: 6
- Trafilatura wins: 1
- No winner: 0

Scores are heuristic: length, paragraph structure, and low boilerplate. Manual reading QA is still required before product decisions.

## Matrix

| URL | Category | Fetch | Readability | Defuddle | Trafilatura | Heuristic best |
|---|---:|---:|---:|---:|---:|---|
| 阮一峰科技爱好者周刊 290 | chinese_blog | 200/845ms | 70 (6070 chars, 67 paras) | 72 (10337 chars, 102 paras) | 69 (5816 chars, 66 paras) | defuddle |
| 阮一峰科技爱好者周刊 275 | chinese_blog | 200/328ms | 72 (6236 chars, 70 paras) | 72 (9278 chars, 103 paras) | 72 (5932 chars, 69 paras) | readability |
| 中文维基百科：阅读 | encyclopedia | 200/716ms | 73 (5163 chars, 30 paras) | 74 (15922 chars, 47 paras) | 73 (4835 chars, 37 paras) | defuddle |
| 中文维基百科：人工智能 | encyclopedia | 200/265ms | 74 (44954 chars, 166 paras) | 75 (133699 chars, 279 paras) | 74 (42783 chars, 267 paras) | defuddle |
| English Wikipedia: Speed reading | encyclopedia | 200/702ms | 70 (20668 chars, 45 paras) | 70 (26161 chars, 54 paras) | 70 (20356 chars, 80 paras) | readability |
| Paul Graham: How to Read | essay | 200/2346ms | 67 (2402 chars, 35 paras) | 65 (2493 chars, 10 paras) | 69 (2502 chars, 10 paras) | trafilatura |
| Paul Graham: Superlinear Returns | essay | 200/447ms | 70 (24816 chars, 345 paras) | 70 (25291 chars, 67 paras) | 70 (24931 chars, 75 paras) | readability |
| Python 3.13.0 release post | tech_blog | 200/1268ms | 5 (97 chars, 1 paras) | 6 (163 chars, 1 paras) | 5 (80 chars, 1 paras) | defuddle |
| Chrome extensions activeTab docs | documentation | 200/2262ms | 54 (1475 chars, 9 paras) | 72 (2805 chars, 10 paras) | 51 (1452 chars, 7 paras) | defuddle |
| GitHub Blog example article | tech_blog | 200/1147ms | 70 (5020 chars, 9 paras) | 70 (4819 chars, 18 paras) | 69 (3807 chars, 15 paras) | readability |
| W3C WCAG 2.2 recommendation | documentation | 200/586ms | 69 (121786 chars, 503 paras) | 70 (182390 chars, 618 paras) | 69 (91044 chars, 475 paras) | defuddle |
| MDN DOM overview | documentation | 200/1985ms | 70 (20124 chars, 66 paras) | 70 (26650 chars, 89 paras) | 70 (18619 chars, 147 paras) | readability |

## Failure Notes

- No fetch failures.

## Product Notes

- Server-side URL import should use a mature extractor instead of custom DOM scraping.
- Any extractor can fail on dynamic, login-only, or anti-bot pages; these should fall back to a user-triggered browser extension path.
- Do not use private, paid, unpublished, login-only, or sensitive pages in this server-side bake-off.

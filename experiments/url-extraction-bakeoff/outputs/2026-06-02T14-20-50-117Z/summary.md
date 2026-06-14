# URL Extraction Bake-Off Summary

Run: `2026-06-02T14-20-50-117Z`

## Overall

- URLs tested: 12
- Fetch failures: 0
- Readability wins: 6
- Defuddle wins: 6
- Trafilatura wins: 0
- No winner: 0

Scores are heuristic: length, paragraph structure, and low boilerplate. Manual reading QA is still required before product decisions.

## Matrix

| URL | Category | Fetch | Readability | Defuddle | Trafilatura | Heuristic best |
|---|---:|---:|---:|---:|---:|---|
| 阮一峰科技爱好者周刊 290 | chinese_blog | 200/902ms | 70 (6070 chars, 67 paras) | 72 (10251 chars, 102 paras) | 69 (5816 chars, 66 paras) | defuddle |
| 阮一峰科技爱好者周刊 275 | chinese_blog | 200/460ms | 72 (6236 chars, 70 paras) | 72 (9287 chars, 104 paras) | 72 (5932 chars, 69 paras) | readability |
| 中文维基百科：阅读 | encyclopedia | 200/1091ms | 73 (5163 chars, 30 paras) | 74 (14013 chars, 47 paras) | 73 (4835 chars, 37 paras) | defuddle |
| 中文维基百科：人工智能 | encyclopedia | 200/239ms | 74 (44954 chars, 166 paras) | 75 (109665 chars, 268 paras) | 74 (42783 chars, 267 paras) | defuddle |
| English Wikipedia: Speed reading | encyclopedia | 200/1628ms | 70 (20668 chars, 45 paras) | 70 (30949 chars, 56 paras) | 70 (20356 chars, 80 paras) | readability |
| Paul Graham: How to Read | essay | 200/1594ms | 67 (2402 chars, 35 paras) | 65 (2464 chars, 10 paras) | fail:  | readability |
| Paul Graham: Superlinear Returns | essay | 200/402ms | 70 (24816 chars, 345 paras) | 70 (25172 chars, 67 paras) | fail:  | readability |
| Python 3.13.0 release post | tech_blog | 200/1542ms | 5 (97 chars, 1 paras) | 6 (140 chars, 1 paras) | 5 (80 chars, 1 paras) | defuddle |
| Chrome extensions activeTab docs | documentation | 200/1668ms | 54 (1475 chars, 9 paras) | 70 (3126 chars, 11 paras) | 51 (1452 chars, 7 paras) | defuddle |
| GitHub Blog example article | tech_blog | 200/978ms | 70 (5020 chars, 9 paras) | 70 (5551 chars, 27 paras) | 69 (3807 chars, 15 paras) | readability |
| W3C WCAG 2.2 recommendation | documentation | 200/446ms | 69 (121786 chars, 503 paras) | 70 (167603 chars, 565 paras) | 69 (91044 chars, 475 paras) | defuddle |
| MDN DOM overview | documentation | 200/943ms | 70 (20124 chars, 66 paras) | 70 (23375 chars, 86 paras) | 70 (18619 chars, 147 paras) | readability |

## Failure Notes

- No fetch failures.

## Product Notes

- Server-side URL import should use a mature extractor instead of custom DOM scraping.
- Any extractor can fail on dynamic, login-only, or anti-bot pages; these should fall back to a user-triggered browser extension path.
- Do not use private, paid, unpublished, login-only, or sensitive pages in this server-side bake-off.

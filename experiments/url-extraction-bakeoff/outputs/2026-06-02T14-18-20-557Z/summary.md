# URL Extraction Bake-Off Summary

Run: `2026-06-02T14-18-20-557Z`

## Overall

- URLs tested: 12
- Fetch failures: 0
- Readability wins: 4
- Defuddle wins: 8
- Trafilatura wins: 0
- No winner: 0

Scores are heuristic: length, paragraph structure, and low boilerplate. Manual reading QA is still required before product decisions.

## Matrix

| URL | Category | Fetch | Readability | Defuddle | Trafilatura | Heuristic best |
|---|---:|---:|---:|---:|---:|---|
| 阮一峰科技爱好者周刊 290 | chinese_blog | 200/1167ms | 70 (6070 chars, 67 paras) | 72 (10251 chars, 102 paras) | 48 (5816 chars, 1 paras) | defuddle |
| 阮一峰科技爱好者周刊 275 | chinese_blog | 200/216ms | 72 (6236 chars, 70 paras) | 72 (9287 chars, 104 paras) | 50 (5932 chars, 1 paras) | readability |
| 中文维基百科：阅读 | encyclopedia | 200/1214ms | 73 (5163 chars, 30 paras) | 74 (14013 chars, 47 paras) | 51 (4835 chars, 1 paras) | defuddle |
| 中文维基百科：人工智能 | encyclopedia | 200/921ms | 74 (44954 chars, 166 paras) | 75 (109665 chars, 268 paras) | 53 (42783 chars, 1 paras) | defuddle |
| English Wikipedia: Speed reading | encyclopedia | 200/835ms | 70 (20668 chars, 45 paras) | 70 (30949 chars, 56 paras) | 48 (20356 chars, 1 paras) | readability |
| Paul Graham: How to Read | essay | 200/2455ms | 45 (2402 chars, 1 paras) | 65 (2464 chars, 10 paras) | fail:  | defuddle |
| Paul Graham: Superlinear Returns | essay | 200/437ms | 48 (24816 chars, 1 paras) | 70 (25172 chars, 67 paras) | fail:  | defuddle |
| Python 3.13.0 release post | tech_blog | 200/2212ms | 5 (97 chars, 1 paras) | 6 (140 chars, 1 paras) | 5 (80 chars, 1 paras) | defuddle |
| Chrome extensions activeTab docs | documentation | 200/2214ms | 54 (1475 chars, 9 paras) | 70 (3126 chars, 11 paras) | 32 (1452 chars, 1 paras) | defuddle |
| GitHub Blog example article | tech_blog | 200/2398ms | 70 (5020 chars, 9 paras) | 70 (5551 chars, 27 paras) | 48 (3807 chars, 1 paras) | readability |
| W3C WCAG 2.2 recommendation | documentation | 200/1079ms | 69 (121786 chars, 503 paras) | 70 (167603 chars, 565 paras) | 48 (91044 chars, 1 paras) | defuddle |
| MDN DOM overview | documentation | 200/893ms | 70 (20124 chars, 66 paras) | 70 (23375 chars, 86 paras) | 48 (18619 chars, 1 paras) | readability |

## Failure Notes

- No fetch failures.

## Product Notes

- Server-side URL import should use a mature extractor instead of custom DOM scraping.
- Any extractor can fail on dynamic, login-only, or anti-bot pages; these should fall back to a user-triggered browser extension path.
- Do not use private, paid, unpublished, login-only, or sensitive pages in this server-side bake-off.

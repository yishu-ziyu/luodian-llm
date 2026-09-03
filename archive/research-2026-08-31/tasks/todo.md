# 眺览二次开发 Todo

## Baseline Capture

- [x] Create sample `contentDict` fixture.
- [x] Implement direct `nlphl` capture script.
- [x] Verify one successful capture or document why the service is unavailable.
- [x] Save the result path in the session log.

## URL Extraction Bake-Off

- [x] Create 12 public URL samples.
- [x] Implement Readability / Defuddle / Trafilatura comparison runner.
- [x] Run a network-enabled bake-off.
- [x] Save summary and results JSON.
- [x] Write technical validation report.

## Web MVP

- [x] Write Web MVP engineering design document.
- [x] Write implementation plan for the Web MVP.
- [x] Build URL import flow with Defuddle primary extraction and Readability fallback.
- [x] Build txt/md file import flow.
- [x] Build AI highlight generation API.
- [x] Connect real MiniMax LLM provider behind the highlight API.
- [x] Switch MiniMax highlight model to `MiniMax-M3`.
- [x] Build highlighted reading view.
- [x] Save one reproducible reading experiment record.

## Kami UI Optimization

- [x] Apply kami visual language to the Web MVP page while keeping the reader workflow first-screen.
- [x] Verify the optimized page with automated tests and browser visual QA.

## MiniMax Long Article Reliability

- [x] Reproduce the no-highlight failure on long article input.
- [x] Confirm MiniMax-M3 returns thinking-only content when one large request exhausts `max_tokens`.
- [x] Split long highlight requests into smaller MiniMax batches and merge the resulting HighlightMap.
- [x] Add regression coverage for MiniMax batching and structured-output retry.
- [x] Add long-article in-progress status copy for the frontend.
- [x] Verify long file import renders real highlights in the browser.

## Eye-Tracking Theory (Agent 2)

- [x] Read agent-1-decompile outputs (`analysis.md`, `extracted-snippets.md`) for context on what the original `nlphl` does.
- [x] Run web research via exa-web-search (WebSearch/WebFetch are denied by `~/.claude/settings.json`).
- [x] Survey English reading + RSVP literature (Saccade distance effect, ORP/OVP, wrap-up effect, Rubin & Turano 1992, Primativo 2016 PLOS ONE, Vitu 2001, Spritz patent US 8903174).
- [x] Survey Chinese reading literature 2017-2026 (Liu 2024 PBR, Yan 2024, Wu 2020, B7/B8 2024-2026 wrap-up reversal, Yan 2012 processing-based saccade targeting).
- [x] Surface the key 2024-2026 finding: Chinese reading has a **reversed** wrap-up effect, so sentence-final words do NOT need heavier highlighting.
- [x] Translate theory into 10 prompt rules (distance, frequency, ORP, paragraph position, density 30-50%).
- [x] Write `agent-2-eye-tracking-theory/theory-notes.md` (10 sections, 179 lines).
- [x] Write `agent-2-eye-tracking-theory/prompt-design-recommendations.md` (main prompt + meta prompt + 3 few-shot examples + failure-mode defense clauses, 204 lines).
- [x] Write `agent-2-eye-tracking-theory/references.md` (15+ sources with confidence assessment, 150 lines).
- Remaining risk: rules #6 (reversed wrap-up) and #10 (30-50% density) have the lowest confidence; `agent-4-few-shot-iter` should A/B test them first.

## Highlight Comparison Workbench

- [x] Add a comparison API that calls original TillGlance `nlphl` and MiniMax-M3 on the same paragraphs.
- [x] Compute quality metrics: position hit rate, coverage similarity, density delta, and baseline recall.
- [x] Save comparison experiment records with baseline output, AI output, provider metadata, and metrics.
- [x] Add a `/compare` page with original-algorithm, AI, and difference views.
- [x] Link the main reader page to the comparison page.
- [x] Add regression tests for metrics, TillGlance client, comparison API, and experiment persistence.
- [x] Verify the comparison page with a real browser QA path.

## Development Protocol

- [x] Define the final Web MVP objective.
- [x] Write sustainable development protocol.
- [x] Write stable project handoff.
- [x] Write temp handoff for context transfer.
- [x] Execute Web MVP implementation plan task by task.

## Review

- Changed files in this implementation phase are limited to the Web MVP app, focused tests, task tracking, session log, and handoff material.
- Verification passed: `npm run test:web-mvp` reported 22 passing tests and 0 failures.
- Verification passed: API smoke checks covered `/api/health`, `/api/import/file`, `/api/highlight`, and `/api/experiments`.
- Verification passed before M3 switch: direct MiniMax smoke returned `provider=minimax`, `model=MiniMax-M2.7`, `apiType=anthropic-compatible`, and a legal `HighlightMap`.
- Verification passed: HTTP `/api/highlight` returned `provider=minimax`, `fallbackUsed=false`, and a legal `HighlightMap`.
- Verification passed: Playwright browser QA imported `https://example.com`, imported a local markdown file, showed `minimax`, toggled highlights off/on, and checked mobile width for no horizontal overflow.
- Verification passed after M3 switch: URL import -> `/api/highlight` returned HTTP 200 with `model=MiniMax-M3`.
- Verification passed after M3 switch: Playwright browser QA produced experiment records `experiment_34384abd-64f1-469c-ba1f-71fd7d699ad4` and `experiment_4fe624f9-98d0-4648-8117-27446735b958`.
- Verification passed after kami UI optimization: `npm run test:web-mvp` reported 24 passing tests and 0 failures.
- Verification passed after kami UI optimization: Playwright QA produced URL experiment `experiment_7de1697e-9f83-40c5-86c0-8470909f4e28` and file experiment `experiment_8d939708-7c1d-4aec-a68e-7012e2eb0e34`; model note displayed `MiniMax-M3`, highlighter toggle worked, console had no errors, and 390px mobile width had no horizontal overflow.
- Screenshot evidence after kami UI optimization: `/private/tmp/tillglance-web-mvp-qa/initial.png`, `/private/tmp/tillglance-web-mvp-qa/after-file.png`, `/private/tmp/tillglance-web-mvp-qa/mobile.png`.
- Verification passed after long-article MiniMax fix: `npm run test:web-mvp` reported 26 passing tests and 0 failures.
- Verification passed after long-article MiniMax fix: one-shot 37-paragraph MiniMax diagnostic returned `stop_reason=max_tokens` and only a `thinking` content block, confirming the root cause.
- Verification passed after long-article MiniMax fix: local API returned HTTP 200 for a 38-paragraph imported markdown sample in about 100 seconds, with `requestCount=10` and 38 highlighted paragraphs.
- Verification passed after long-article MiniMax fix: Playwright long-file import produced `experiment_572ce742-c053-4361-b3f7-56e5165fbf16`, rendered 101 `mark.reading-highlight` elements, displayed `MiniMax-M3`, had no console errors, and had no horizontal overflow.
- Verification passed after long-article MiniMax fix: frontend status copy shows `生成语义高亮中... 正在分批处理 13 段，请保持页面打开。` for long files.
- Verification passed after comparison workbench: `npm run test:web-mvp` reported 34 passing tests and 0 failures.
- Verification passed after comparison workbench: real `/api/compare` smoke returned HTTP 200 in 104220ms, `baselineProvider=tillglance-nlphl`, `model=MiniMax-M3`, two baseline paragraphs, two AI paragraphs, and experiment `experiment_38e3e76a-8b29-4f5b-93fa-93ee489688d0`.
- Verification passed after comparison workbench: Playwright QA on `/compare` generated `experiment_59451f18-765c-41a0-b961-edd65f225098`, rendered 23 baseline marks, 6 AI marks, 27 difference marks, displayed `tillglance-nlphl / MiniMax-M3`, had no console issues, and had no horizontal overflow at 390px.
- Screenshot evidence after comparison workbench: `/private/tmp/tillglance-compare-qa/initial.png`, `/private/tmp/tillglance-compare-qa/after-compare.png`, `/private/tmp/tillglance-compare-qa/mobile.png`.
- Verification passed: at least one experiment JSON was saved under `web-mvp/data/experiments/`.
- Repository status: this project directory is not currently a Git repository.
- Remaining risk: comparison is now available for single articles, but highlighter quality has not yet been evaluated across a 20-50 article sample set.
- Remaining risk: real comparison works, but synchronous end-to-end waiting can take about 100 seconds for even small examples because it waits for both remote services.

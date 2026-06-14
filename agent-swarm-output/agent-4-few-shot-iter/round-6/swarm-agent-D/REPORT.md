# Agent D — English Text Test Report (Round 6)

**Date**: 2026-06-13
**Test scope**: Does the new Chinese-biased `buildHighlightPrompt` produce reasonable output on English text?
**Status**: Read-only experiment. No code changes to `web-mvp/src/`.
**Model**: MiniMax-M3 via web-mvp on `http://localhost:4173`.

---

## TL;DR — One-line verdict

> **English output is structurally valid but semantically garbage: the Chinese prompt's "every 4-6 chars, length=2" rule produces random character digraphs in English, missing proper nouns, dates, and word boundaries entirely.**

---

## Test corpus

12 hardcoded English texts (no network fetching):

| # | ID | Category | Chars | Source |
|---|---|---|---|---|
| 1 | en-1-short | short | 44 | Pangram: "The quick brown fox..." |
| 2 | en-2-short | short | 52 | Aphorism: "Reading is to the mind..." |
| 3 | en-3-short | short | 63 | Tolkien: "All that glitters is not gold..." |
| 4 | en-4-medium | medium | 180 | Aesop: Tortoise and the Hare (paraphrased) |
| 5 | en-5-medium | medium | 168 | Dickens: A Tale of Two Cities opening |
| 6 | en-6-medium | medium | 171 | Shakespeare: Hamlet's soliloquy |
| 7 | en-7-medium | medium | 139 | Chekhov aphorism |
| 8 | en-8-long | long | 361 | Tolkien: Hobbit opening |
| 9 | en-9-long | long | 304 | Melville: Moby Dick opening |
| 10 | en-10-long | long | 378 | Austen: Pride and Prejudice opening |
| 11 | en-11-proper | proper-nouns | 125 | July 4 1776 / Declaration of Independence / Philadelphia |
| 12 | en-12-proper | proper-nouns | 163 | Einstein / relativity / 1915 / 1921 / Nobel Prize |

---

## Per-text results

### Aggregate metrics

| Metric | Value | Note |
|---|---|---|
| Total texts | 12 | 100% HTTP 200 |
| JSON valid rate | **100%** | 12/12 returned parseable JSON |
| Output shape valid | **100%** | All 12 returned proper flat array `[start,len,start,len,...]` |
| Chinese characters in AI output | **0** | Model did NOT hallucinate "段首" or any CN terms |
| Length=2 share | **99.5%** (187/188) | Rule #10 fully obeyed on English too |
| Mean AI density | **21.9%** | Lower than Chinese 44% because longer English texts dilute density |
| Mean spans per text | 15.7 | |
| Mean latency | 1.67s | Comparable to Chinese |
| **TillGlance baseline returned empty** | **12/12 = 100%** | **Critical: TillGlance nlphl API itself returns `{"paragraphs":[],"density":[]}` for English** |
| ±2 hit rate vs baseline | **N/A** | Baseline is empty — no meaningful comparison possible |

### Density by category

| Category | Count | Mean density | Mean spans |
|---|---|---|---|
| short (20-50 chars) | 3 | 36.2% | 9.0 |
| medium (50-150 chars) | 4 | 20.1% | 16.5 |
| long (150-300 chars) | 3 | 13.9% | 24.0 |
| proper-nouns / dates | 2 | 15.8% | 11.5 |

Density is naturally lower on English because English words are 3-8 chars; with length=2 spans spaced 4-6 chars, you can't physically exceed ~30% density even on infinite text.

---

## Critical analysis — did the Chinese prompt confuse the model on English?

### Findings

**1. JSON shape is correct** (good)
All 12 responses returned a proper flat array: `[0,2,4,2,10,2,...]`. No nested arrays, no garbled output. The model understood the format even on English input.

**2. No Chinese-character leakage** (good)
Zero Chinese characters appeared anywhere in the AI output or response metadata. The model did NOT hallucinate "段首" (paragraph start) or copy any Chinese terms from the prompt or few-shot examples into the output JSON.

**3. Rule #10 (length=2) is fully obeyed** (good for Chinese, harmful for English)
99.5% of spans are length=2. The model rigidly applied this rule even when it makes no sense for English words. Example:

```
Text:   "The quick brown fox jumps over the lazy dog."
AI:     [0,2]="Th"  [4,2]="qu"  [10,2]="br"  [14,2]="n "
        [19,2]=" j" [25,2]=" o" [30,2]=" t"  [35,2]="la" [40,2]="do"
```

The model is producing **random 2-char windows spaced ~5 chars apart**, completely ignoring English word structure. The output is technically valid JSON but has no semantic value.

**4. Proper nouns and dates are missed** (bad)
For "On July 4, 1776, the Declaration of Independence was signed in Philadelphia by delegates from the thirteen American colonies." (en-11-proper), the AI produced:

```
"On" "(space)4" " 6," "ec" "of" "ce" "ig" "hi" "eg"
```

- "July" is highlighted as ", 4" (mid-number)
- "1776" is split: " 6," then "ec" of "Declaration"
- "Philadelphia" is not highlighted at all
- "Declaration" gets "ec" (chars 22-23)
- Rule #1 ("Highlight proper nouns") is completely failing on English.

For "Albert Einstein published his theory of general relativity in 1915..." (en-12-proper), only "Al" of "Albert" is highlighted — the most important name in the sentence gets one digraph.

**5. Word-boundary analysis** (quantitative evidence of bad quality)

| Metric | Value | Interpretation |
|---|---|---|
| Total AI spans | 188 | |
| Spans inside a single word (split it) | **58.0%** | More than half of highlights split a word in half |
| Spans starting at word boundary | **27.7%** | Only ~1 in 4 highlights starts at a word's first character |
| Spans starting with capital letter | **6.4%** | Proper nouns (which rule #1 mandates highlighting) are essentially ignored |

Compare to expected for English text: 70-90% should land on or near word starts; 30-50% should start with capitals for typical mixed-case text.

**6. TillGlance baseline is empty for English** (important context for "hit rate")

The web-mvp `/api/compare` endpoint relies on `https://api.tillglance.com/nlphl` for the baseline. Direct verification:

```bash
curl -X POST https://api.tillglance.com/nlphl \
  -d '{"paragraphs":[{"id":"0","text":"The quick brown fox...","charLength":44}],"density":"medium"}'
# returns: {"paragraphs":[],"density":[]}
```

TillGlance's API **does not support English text** at all — every English query returns empty baselines. This means:
- The 0% hit rate vs baseline is **not a problem with our prompt** — there is no baseline to compare against.
- The "±2 hit rate" metric that drove the Chinese success (87.88%) is **structurally meaningless** for English.
- Any English→highlight feature would need its own ground truth (e.g., a separate English-trained eye-tracking dataset, or hand-labeled English highlights).

**7. Did "wrap-up effect is reversed" (rule #4) confuse the model on English?**

The model did NOT seem to skip the last few chars of English paragraphs (it still spans there). The rule's effect is hard to detect because length=2 spans at fixed intervals will mechanically land near paragraph endings anyway. **No evidence of confusion here.**

**8. Did few-shot Chinese examples confuse the model?**

The 5 few-shot examples are all Chinese. The model did NOT copy Chinese terms into the output (point #2). However, the model **did learn "emit length=2 spans at fixed intervals" from those examples** — a pattern that is correct for Chinese characters (1 char = 1 morpheme) but **wrong for English** (where words are 3-8 chars and need length=4-8 spans).

---

## Worked example: en-12-proper (Einstein)

**Text (163 chars)**: "Albert Einstein published his theory of general relativity in 1915, and later received the Nobel Prize in Physics in 1921 for his work on the photoelectric effect."

**AI output (14 spans, 0% of proper nouns covered)**:

| Start | Length | Snippet | What it should have been |
|---|---|---|---|
| 0 | 2 | "Al" | "Albert" (full name, 6 chars) |
| 12 | 2 | "ei" | end of "Einstein" — cuts name in half |
| 25 | 2 | " h" | "his" — function word, should be skipped per rule #2 |
| 35 | 2 | "y " | trailing "y " of "theory" |
| 39 | 2 | " g" | function word "of" — should be skipped |
| 43 | 2 | "er" | mid-word of "general" |
| 47 | 2 | " r" | mid-word of "relativity" |
| 62 | 2 | "19" | mid-date "1915" — gets digits but not the year |
| 66 | 2 | ", " | comma + space — meaningless |
| 74 | 2 | "te" | "later" — function word |
| 82 | 2 | "iv" | mid-word "received" |
| 87 | 2 | "th" | "the" — function word, should be skipped per rule #2 |
| 94 | 2 | "el" | "Nobel" — finally gets a partial proper noun |
| 99 | 2 | "iz" | end of "Prize" |

**Scorecard**:
- "Albert" partial: 1/6 chars covered (rule #1 fails)
- "Einstein" partial: 1/8 chars covered (rule #1 fails)
- "relativity" partial: 1/10 chars covered (rule #1 fails)
- "Nobel Prize" partial: 4 chars of 11 covered (rule #1 partially works)
- "1915" / "1921" partial: 2/4 of each year (rule #1 fails on dates)
- Function words "his", "of", "the" highlighted (rule #2 fails)
- Comma + space "," highlighted (rule #6 fails)

---

## Recommendation

**Option 1: Add English few-shot examples alongside Chinese** — RECOMMENDED.

The prompt's structural rules (JSON shape, length rules, density target) work fine in English; the model output is **technically valid but semantically empty** because the few-shot pool taught it a Chinese-style "every N chars, length=K" pattern. Adding 2-3 English few-shot examples with **word-aligned** spans (e.g., `start=0,length=4` for "The", `start=4,length=5` for "quick") would teach the model that English spans should land on word boundaries and cover whole content words. Cost: ~30 min to author + re-test 20 English texts.

**Why not the others**:
- Option 2 (bilingual rules): doubles prompt length for marginal gain — the rules are language-agnostic in intent, only the *examples* need language variety.
- Option 3 (branch on language): the model is already language-agnostic in its rules; the issue is pattern imitation from examples, not rule comprehension. A branch would add complexity without fixing the root cause.
- Option 4 (accept lower quality): shipping "valid JSON that highlights random digraphs" to English users would be embarrassing — the highlights would actively mislead reading rather than help.

**Effort estimate**: 30 min to author English few-shots + 1 hour to re-run a 12-text English battery = **1.5 hours total**.

---

## Files produced

- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/test-corpus-english.mjs` — 12 hardcoded English texts
- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/runner.mjs` — pipeline runner
- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/raw/en-1-short.json` … `en-12-proper.json` — raw API responses
- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/all-results.json` — concatenated structured results
- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/aggregate.json` — computed aggregate metrics
- `agent-swarm-output/agent-4-few-shot-iter/round-6/swarm-agent-D/REPORT.md` — this report

## Open risks (surfaced honestly)

1. **No English ground truth** — the "hit rate" comparison to baseline is N/A. To validate Option 1, someone needs to hand-label English highlights OR capture an English TillGlance-equivalent dataset.
2. **The 12 texts are all from public-domain classics** — modern English (Twitter, news headlines, technical docs) was not tested. Real users may paste very different prose.
3. **Did NOT test prompt with a single mixed Chinese/English text** — the typical "import a Chinese article with some English terms" case is untested.
4. **Did NOT test against a model that was not MiniMax-M3** — different LLMs may handle the Chinese-prompt-on-English case differently. The current finding is M3-specific.
5. **No retry logic was tested on English** — Chinese had 5% failure rate; English may be similar or worse. The runner used a single attempt; if M3 had drifted past paragraph bounds, it would have failed silently.
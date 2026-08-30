export interface HighlightSpan {
  start: number;
  end: number;
}

export interface HighlightOptions {
  excludedRanges?: HighlightSpan[];
}

export interface HighlightCandidate extends HighlightSpan {
  id: string;
  text: string;
  score: number;
  kind: "token" | "phrase";
}

interface WordToken extends HighlightSpan {
  text: string;
}

const STOP_WORDS = new Set([
  "的",
  "了",
  "是",
  "在",
  "和",
  "也",
  "都",
  "与",
  "及",
  "或",
  "而",
  "并",
  "被",
  "把",
  "这",
  "那",
  "一个",
  "一种",
  "中的",
  "有所",
  "主要是",
  "一下",
  "看看",
  "试着",
  "其实",
  "同时",
  "加上",
  "前",
  "后"
]);

const WORD_CHARACTER = /[\p{Script=Han}\p{Letter}\p{Number}]/u;
const HAN_CHARACTER = /\p{Script=Han}/u;
const NUMBER = /\p{Number}/u;
const LATIN_CHARACTER = /[A-Za-z]/;
const PHRASE_BREAK = /[，。！？；：、,.!?;:\n]/u;
const RELATION_CUE = /不会|不能|无法|未能|有待|因为|所以|因此|但是|然而|如果|导致|影响|原因|应该|选择|提高|降低|增加|减少|丧失|逃避/u;
const NEGATION_CUE = /不会|不能|无法|未能|没有|没/u;
const CONNECTOR_WORDS = new Set(["的", "中", "和", "与", "及", "或", "在", "来", "就", "把", "让", "于", "对", "从", "个", "一", "有", "会"]);
const QUANTIFIER_WORDS = new Set(["个", "项", "条", "次", "种", "倍", "年", "月", "日"]);
const PREFIX_WORDS = new Set(["最", "更", "较", "很"]);
const BAD_BOUNDARIES = new Set(["后半部", "性的", "到底有", "前部分"]);
const STOP_CHARACTERS = new Set(["的", "了", "是", "在", "和", "也", "都", "与", "及", "或", "而", "并", "被", "把"]);
const WORD_SUFFIXES = new Set(["器", "件", "性", "化", "者", "力", "度", "率", "感", "点"]);
const LOW_INFORMATION_PENALTIES = new Map<string, number>([
  ["我们", 2.8],
  ["关于", 2.6],
  ["之前", 3.2],
  ["之后", 3.2],
  ["以前", 3.2],
  ["目前", 3.2],
  ["现在", 3.0],
  ["今天", 3.0],
  ["这里", 3.0],
  ["这些", 3.0],
  ["一些", 3.0],
  ["部分", 3.2],
  ["前部分", 3.2],
  ["后半部", 3.2],
  ["后半部分", 3.2],
  ["内容", 3.2],
  ["方面", 3.0],
  ["情况", 2.8],
  ["时候", 2.8],
  ["正好", 2.8],
  ["出来", 2.6],
  ["进行", 2.6],
  ["相关", 2.4],
  ["通过", 2.2],
  ["主要是", 3.2],
  ["中的", 3.2],
  ["有所", 2.8],
  ["一下", 2.8],
  ["看看", 2.8],
  ["试着", 2.8],
  ["其实", 2.8],
  ["同时", 2.6],
  ["加上", 2.6],
  ["到底有", 3.2]
]);
const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "word" });

function candidateScore(text: string, frequency: number): number {
  const length = Array.from(text).length;
  let score = length === 1 ? 0.75 : 2.5 + Math.min(length, 4) * 0.55;
  if (NUMBER.test(text)) score += 1.5;
  if (frequency > 1) score += Math.min(frequency - 1, 2) * 0.45;
  if (length > 6) score -= (length - 6) * 0.35;
  score -= LOW_INFORMATION_PENALTIES.get(text) || 0;
  return score;
}

function phraseScore(text: string, tokens: WordToken[]): number {
  const compactLength = Array.from(text.replace(/[\s「」『』“”‘’《》〈〉【】()（）-]/g, "")).length;
  const meaningfulCount = tokens.filter((token) => !STOP_WORDS.has(token.text)).length;
  let score = 1.6 + meaningfulCount * 0.55 + Math.min(compactLength, 8) * 0.22;
  if (tokens.some((token) => LATIN_CHARACTER.test(token.text))) score += 1.2;
  if (RELATION_CUE.test(text)) score += 1;
  if (tokens.some((token) => CONNECTOR_WORDS.has(token.text))) score += 0.45;
  score -= Math.max(0, compactLength - 6) * 0.9;
  score -= Math.max(0, tokens.length - 3) * 0.75;
  score -= LOW_INFORMATION_PENALTIES.get(text.replace(/\s/g, "")) || 0;
  return score;
}

function overlaps(left: HighlightSpan, right: HighlightSpan): boolean {
  return left.start < right.end && right.start < left.end;
}

function collectCandidates(text: string, excludedRanges: HighlightSpan[]): HighlightCandidate[] {
  const segmented = Array.from(segmenter.segment(text))
    .filter((part) => part.isWordLike && WORD_CHARACTER.test(part.segment));
  const words: typeof segmented = [];
  for (const part of segmented) {
    const previous = words.at(-1);
    if (
      previous &&
      part.index === previous.index + previous.segment.length &&
      WORD_SUFFIXES.has(part.segment) &&
      Array.from(previous.segment).length <= 2
    ) {
      previous.segment += part.segment;
      continue;
    }
    words.push({ ...part });
  }
  const frequencies = new Map<string, number>();
  for (const word of words) {
    frequencies.set(word.segment, (frequencies.get(word.segment) || 0) + 1);
  }

  const tokens: WordToken[] = words.map((part) => ({
    text: part.segment,
    start: part.index,
    end: part.index + part.segment.length
  }));
  const tokenCandidates = tokens
    .filter((part) => !STOP_WORDS.has(part.text))
    .filter((part) => !Array.from(part.text).every((character) => STOP_CHARACTERS.has(character)))
    .map((part) => ({
      start: part.start,
      end: part.end,
      text: part.text,
      score: candidateScore(part.text, frequencies.get(part.text) || 1),
      kind: "token" as const
    }))
    .filter((candidate) => candidate.score >= 1.5)
    .filter((candidate) => !excludedRanges.some((range) => overlaps(candidate, range)));

  const phraseCandidates: Omit<HighlightCandidate, "id">[] = [];
  for (let startIndex = 0; startIndex < tokens.length; startIndex += 1) {
    for (let size = 2; size <= 6 && startIndex + size <= tokens.length; size += 1) {
      const slice = tokens.slice(startIndex, startIndex + size);
      const first = slice[0];
      const last = slice.at(-1);
      if (!first || !last) continue;
      const phraseText = text.slice(first.start, last.end);
      if (PHRASE_BREAK.test(phraseText)) break;
      const compactLength = Array.from(phraseText.replace(/[\s「」『』“”‘’《》〈〉【】()（）-]/g, "")).length;
      if (compactLength > 14) break;
      const meaningful = slice.filter((token) => !STOP_WORDS.has(token.text));
      if (meaningful.length < 2) continue;

      const hasLatin = slice.some((token) => LATIN_CHARACTER.test(token.text));
      const hasRelation = RELATION_CUE.test(phraseText);
      const hasConnector = slice.some((token) => CONNECTOR_WORDS.has(token.text));
      const shortCompound = size <= 4 && compactLength <= 8;
      if (!(size === 2 || hasLatin || hasRelation || hasConnector || shortCompound)) continue;
      const firstIsRelation = RELATION_CUE.test(first.text);
      const firstIsWeak = STOP_WORDS.has(first.text) || LOW_INFORMATION_PENALTIES.has(first.text);
      const lastIsWeak = STOP_WORDS.has(last.text) || LOW_INFORMATION_PENALTIES.has(last.text);
      const firstIsFragment = Array.from(first.text).length === 1 && !LATIN_CHARACTER.test(first.text) && !NUMBER.test(first.text);
      const lastIsFragment = Array.from(last.text).length === 1 && !LATIN_CHARACTER.test(last.text) && !NUMBER.test(last.text);
      const numericQuantity = NUMBER.test(first.text) && QUANTIFIER_WORDS.has(last.text);
      const allowedPrefix = PREFIX_WORDS.has(first.text);
      if ((firstIsWeak || firstIsFragment) && !firstIsRelation && !allowedPrefix) continue;
      if ((lastIsWeak || lastIsFragment) && !numericQuantity) continue;

      const candidate = {
        start: first.start,
        end: last.end,
        text: phraseText.trim(),
        score: phraseScore(phraseText, slice),
        kind: "phrase" as const
      };
      if (candidate.score < 1.5) continue;
      if (excludedRanges.some((range) => overlaps(candidate, range))) continue;
      phraseCandidates.push(candidate);
    }
  }

  for (const match of text.matchAll(/[「『“‘]([^」』”’]{2,14})[」』”’]/gu)) {
    const inner = match[1];
    if (!inner || match.index === undefined) continue;
    const openingLength = match[0].indexOf(inner);
    const start = match.index + openingLength;
    const candidate = {
      start,
      end: start + inner.length,
      text: inner,
      score: 5.2,
      kind: "phrase" as const
    };
    if (!excludedRanges.some((range) => overlaps(candidate, range))) phraseCandidates.push(candidate);
  }

  const phraseBudget = tokenCandidates.length;
  const phrasesByStart = new Map<number, Omit<HighlightCandidate, "id">[]>();
  for (const phrase of phraseCandidates) {
    const group = phrasesByStart.get(phrase.start) || [];
    group.push(phrase);
    phrasesByStart.set(phrase.start, group);
  }
  const keptPhrases = Array.from(phrasesByStart.values())
    .map((group) => {
      const quoted = group.find((candidate) => candidate.score === 5.2);
      if (quoted) return quoted;
      const negation = group.filter((candidate) => NEGATION_CUE.test(candidate.text));
      if (negation.length > 0) return negation.sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
      const leadingRelation = group.filter((candidate) => RELATION_CUE.test(candidate.text.slice(0, 4)));
      if (leadingRelation.length > 0) return leadingRelation.sort((left, right) => (right.end - right.start) - (left.end - left.start))[0];
      return group.sort((left, right) =>
        (left.end - left.start) - (right.end - right.start) || right.score - left.score
      )[0];
    })
    .filter((candidate): candidate is Omit<HighlightCandidate, "id"> => Boolean(candidate))
    .sort((left, right) => right.score - left.score || left.start - right.start)
    .slice(0, phraseBudget);
  return [...tokenCandidates, ...keptPhrases]
    .filter((candidate) => !BAD_BOUNDARIES.has(candidate.text))
    .sort((left, right) => left.start - right.start || left.end - right.end || right.score - left.score)
    .map((candidate, index) => ({ ...candidate, id: `c${index}` }));
}

export function createHighlightCandidates(
  text: string,
  options: HighlightOptions = {}
): HighlightCandidate[] {
  if (!text || !HAN_CHARACTER.test(text)) return [];
  return collectCandidates(text, options.excludedRanges || []);
}

export function selectHighlightCandidates(
  textLength: number,
  candidates: HighlightCandidate[]
): HighlightSpan[] {
  if (candidates.length === 0) return [];

  const selected: HighlightSpan[] = [];
  let cursor = 0;
  const searchWindow = 11;

  while (cursor < textLength) {
    const windowCandidates = candidates.filter(
      (candidate) => candidate.start >= cursor && candidate.start < cursor + searchWindow
    );
    if (windowCandidates.length === 0) {
      cursor += searchWindow;
      continue;
    }

    // The cursor already sits one character after the previous anchor. Prefer
    // the earliest strong candidate from there so the page forms a continuous
    // word-gap-word reading track instead of skipping an extra four characters.
    const target = cursor;
    const best = windowCandidates.reduce((current, candidate) => {
      const adjusted = candidate.score - Math.abs(candidate.start - target) * 0.16 - Math.max(0, candidate.end - candidate.start - 4) * 0.8 - (candidate.kind === "phrase" ? 0.35 : 0);
      const currentAdjusted = current.score - Math.abs(current.start - target) * 0.16 - Math.max(0, current.end - current.start - 4) * 0.8 - (current.kind === "phrase" ? 0.35 : 0);
      return adjusted > currentAdjusted ? candidate : current;
    });

    selected.push({ start: best.start, end: best.end });
    cursor = Math.max(best.end + 1, cursor + 1);
  }

  return selected;
}

export function createHighlightSpans(text: string, options: HighlightOptions = {}): HighlightSpan[] {
  return selectHighlightCandidates(text.length, createHighlightCandidates(text, options));
}

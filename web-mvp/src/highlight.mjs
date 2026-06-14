export function assertHighlightMap(highlightMap, paragraphs) {
  if (!highlightMap || typeof highlightMap !== "object" || Array.isArray(highlightMap)) {
    throw new Error("HighlightMap must be an object.");
  }

  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));

  for (const [paragraphId, ranges] of Object.entries(highlightMap)) {
    const paragraph = paragraphById.get(paragraphId);
    if (!paragraph) throw new Error(`Unknown paragraph id: ${paragraphId}`);
    if (!Array.isArray(ranges)) {
      throw new Error(`Ranges for paragraph ${paragraphId} must be an array.`);
    }
    if (ranges.length % 2 !== 0) {
      throw new Error(`Ranges for paragraph ${paragraphId} must have even length.`);
    }

    for (let index = 0; index < ranges.length; index += 2) {
      const start = ranges[index];
      const length = ranges[index + 1];
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length <= 0) {
        throw new Error(`Invalid range at paragraph ${paragraphId}.`);
      }
      if (start + length > paragraph.charLength) {
        throw new Error(`Range out of bounds at paragraph ${paragraphId}.`);
      }
    }
  }
}

/**
 * 裁剪 highlightMap 中越界的 span，返回新的 highlightMap（不改原对象）。
 *
 * 适用场景：LLM 偶尔会让 span 越过段落末尾（start + length > charLength），
 * 调用方不想因为单个坏 span 抛错丢掉整段结果。坏 span 会被丢弃并 console.warn。
 *
 * 与 assertHighlightMap 的区别：
 * - assertHighlightMap 严格模式：遇到越界就 throw，用于开发/单元测试。
 * - clipHighlightSpans 宽松模式：丢掉坏 span 返回可用结果，用于线上容错。
 *
 * @param {object} highlightMap - 形如 { "<paragraphId>": [start, length, ...] }
 * @param {Array}  paragraphs    - [{ id, charLength, ... }]
 * @returns {object} 新的 highlightMap（immutable，原对象未被修改）
 */
export function clipHighlightSpans(highlightMap, paragraphs) {
  if (!highlightMap || typeof highlightMap !== "object" || Array.isArray(highlightMap)) {
    throw new Error("HighlightMap must be an object.");
  }

  const paragraphById = new Map(paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const cleaned = {};

  for (const [paragraphId, ranges] of Object.entries(highlightMap)) {
    const paragraph = paragraphById.get(paragraphId);
    if (!paragraph) {
      console.warn(`[clipHighlightSpans] unknown paragraph id: ${paragraphId}, dropped whole entry`);
      continue;
    }
    if (!Array.isArray(ranges) || ranges.length % 2 !== 0) {
      console.warn(`[clipHighlightSpans] invalid ranges for paragraph ${paragraphId}, dropped whole entry`);
      continue;
    }

    const kept = [];
    for (let index = 0; index < ranges.length; index += 2) {
      const start = ranges[index];
      const length = ranges[index + 1];
      const isValid =
        Number.isInteger(start) &&
        Number.isInteger(length) &&
        start >= 0 &&
        length > 0 &&
        start + length <= paragraph.charLength;
      if (!isValid) {
        console.warn(
          `[clipHighlightSpans] dropped span paragraph=${paragraphId} [start=${start},length=${length}] charLength=${paragraph.charLength}`
        );
        continue;
      }
      kept.push(start, length);
    }
    cleaned[paragraphId] = kept;
  }

  return cleaned;
}

export function generateMockHighlightMap(paragraphs, density = "medium") {
  const stepByDensity = { low: 14, medium: 10, high: 7 };
  const step = stepByDensity[density] || stepByDensity.medium;

  return Object.fromEntries(
    paragraphs.map((paragraph) => {
      const chars = Array.from(paragraph.text);
      const ranges = [];
      for (let index = 0; index < chars.length; index += step) {
        ranges.push(index, Math.min(2, chars.length - index));
      }
      return [paragraph.id, ranges];
    })
  );
}

function rangePairs(ranges = []) {
  const pairs = [];
  for (let index = 0; index < ranges.length; index += 2) {
    pairs.push([ranges[index], ranges[index + 1]]);
  }
  return pairs;
}

function rangeStarts(ranges = []) {
  return rangePairs(ranges).map(([start]) => start);
}

function expandedRangeSet(ranges = []) {
  const positions = new Set();
  for (const [start, length] of rangePairs(ranges)) {
    for (let offset = 0; offset < length; offset += 1) {
      positions.add(start + offset);
    }
  }
  return positions;
}

function intersectionSize(left, right) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function startHitRate(sourceStarts, targetStarts, tolerance) {
  if (sourceStarts.length === 0) return targetStarts.length === 0 ? 1 : 0;
  const hits = sourceStarts.filter((sourceStart) =>
    targetStarts.some((targetStart) => Math.abs(sourceStart - targetStart) <= tolerance)
  ).length;
  return hits / sourceStarts.length;
}

function roundMetric(value) {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function paragraphMetrics({ paragraph, baselineRanges, aiRanges, tolerance }) {
  const baselineSet = expandedRangeSet(baselineRanges);
  const aiSet = expandedRangeSet(aiRanges);
  const overlapChars = intersectionSize(baselineSet, aiSet);
  const unionChars = new Set([...baselineSet, ...aiSet]).size;
  const baselineStarts = rangeStarts(baselineRanges);
  const aiStarts = rangeStarts(aiRanges);
  const charLength = paragraph.charLength || Array.from(paragraph.text || "").length;
  const baselineDensity = charLength ? baselineSet.size / charLength : 0;
  const aiDensity = charLength ? aiSet.size / charLength : 0;

  return {
    paragraphId: paragraph.id,
    index: paragraph.index,
    charLength,
    baselineRanges: baselineStarts.length,
    aiRanges: aiStarts.length,
    baselineChars: baselineSet.size,
    aiChars: aiSet.size,
    overlapChars,
    unionChars,
    coverageSimilarity: roundMetric(unionChars === 0 ? 1 : overlapChars / unionChars),
    positionHitRate: roundMetric(startHitRate(aiStarts, baselineStarts, tolerance)),
    baselineRecall: roundMetric(startHitRate(baselineStarts, aiStarts, tolerance)),
    baselineDensity: roundMetric(baselineDensity),
    aiDensity: roundMetric(aiDensity),
    densityDelta: roundMetric(aiDensity - baselineDensity)
  };
}

export function computeHighlightMetrics({ paragraphs, baselineHighlight, aiHighlight, tolerance = 2 }) {
  const perParagraph = paragraphs.map((paragraph) =>
    paragraphMetrics({
      paragraph,
      baselineRanges: baselineHighlight?.[paragraph.id] || [],
      aiRanges: aiHighlight?.[paragraph.id] || [],
      tolerance
    })
  );

  const totals = perParagraph.reduce(
    (sum, metrics) => ({
      paragraphs: sum.paragraphs + 1,
      chars: sum.chars + metrics.charLength,
      baselineRanges: sum.baselineRanges + metrics.baselineRanges,
      aiRanges: sum.aiRanges + metrics.aiRanges,
      baselineChars: sum.baselineChars + metrics.baselineChars,
      aiChars: sum.aiChars + metrics.aiChars,
      overlapChars: sum.overlapChars + metrics.overlapChars,
      unionChars: sum.unionChars + metrics.unionChars
    }),
    {
      paragraphs: 0,
      chars: 0,
      baselineRanges: 0,
      aiRanges: 0,
      baselineChars: 0,
      aiChars: 0,
      overlapChars: 0,
      unionChars: 0
    }
  );

  return {
    tolerance,
    totals,
    coverageSimilarity: roundMetric(totals.unionChars === 0 ? 1 : totals.overlapChars / totals.unionChars),
    positionHitRate: roundMetric(
      totals.aiRanges === 0
        ? totals.baselineRanges === 0
          ? 1
          : 0
        : perParagraph.reduce((sum, item) => sum + item.positionHitRate * item.aiRanges, 0) / totals.aiRanges
    ),
    baselineRecall: roundMetric(
      totals.baselineRanges === 0
        ? totals.aiRanges === 0
          ? 1
          : 0
        : perParagraph.reduce((sum, item) => sum + item.baselineRecall * item.baselineRanges, 0) /
            totals.baselineRanges
    ),
    baselineDensity: roundMetric(totals.chars ? totals.baselineChars / totals.chars : 0),
    aiDensity: roundMetric(totals.chars ? totals.aiChars / totals.chars : 0),
    densityDelta: roundMetric(totals.chars ? (totals.aiChars - totals.baselineChars) / totals.chars : 0),
    perParagraph
  };
}

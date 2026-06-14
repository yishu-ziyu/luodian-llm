import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputDir = path.resolve(moduleDir, "../data/experiments");

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function saveReadingExperiment({
  article,
  aiHighlight,
  baselineHighlight,
  baselineInfo,
  metrics,
  modelInfo,
  outputDir = defaultOutputDir
}) {
  await fs.mkdir(outputDir, { recursive: true });

  const experiment = {
    id: `experiment_${crypto.randomUUID()}`,
    article,
    aiHighlight,
    ...(baselineHighlight ? { baselineHighlight } : {}),
    ...(baselineInfo ? { baselineInfo } : {}),
    ...(metrics ? { metrics } : {}),
    modelInfo,
    createdAt: new Date().toISOString()
  };

  const outputPath = path.join(outputDir, `${timestampForFile()}-${experiment.id}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(experiment, null, 2)}\n`, "utf8");

  return {
    experiment,
    path: outputPath
  };
}

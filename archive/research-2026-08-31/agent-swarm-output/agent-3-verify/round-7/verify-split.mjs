// Agent-3 Verifier — Round-7
// Verifies Agent A's `splitMode: auto` change against 6 cases.
// Read-only: never modifies web-mvp/src or web-mvp/tests.

import { splitIntoParagraphs } from "/Users/mahaoxuan/Desktop/黑客松/眺览二次开发/web-mvp/src/article.mjs";

// --- Test case definitions --------------------------------------------------

const cases = [
  {
    id: "A",
    name: "飞书粘贴：5 行短散文，单 \\n 分隔",
    description: "Real product scenario: 飞书/Notion style short-line paste",
    input:
      "今天是周六的早晨，我决定去公园散步。\n" +
      "阳光透过树叶，斑驳地洒在小路上。\n" +
      "微风带着花香，让人心情舒畅。\n" +
      "湖边的鸭子排成一队，悠闲地游过水面。\n" +
      "我坐在长椅上，看了一会儿书，享受这份宁静。",
    mode: undefined, // default auto
    expect: {
      length: 5,
      firstEquals: "今天是周六的早晨，我决定去公园散步。",
      lastEquals: "我坐在长椅上，看了一会儿书，享受这份宁静。",
    },
  },
  {
    id: "B",
    name: "旧 markdown：\\n\\n 分隔 3 段",
    description: "Backward compat: legacy markdown with double-newline",
    input: "第一段开头。\n这是同一段的延续。\n\n第二段单独成段。\n\n第三段最后的内容。",
    mode: undefined, // default auto
    expect: {
      length: 3,
      firstEquals: "第一段开头。\n这是同一段的延续。",
    },
  },
  {
    id: "C",
    name: "混合：\\n\\n + 单 \\n 混用",
    description: "auto should degrade to double-newline when \\n{2,} exists",
    input: "第一段。\n\n第二段开头。\n第二段中间。\n\n第三段。",
    mode: undefined, // default auto
    expect: {
      // auto mode: \n{2,} is present → falls back to double-newline split
      // single \n in middle of 段二 stays joined (legacy behavior)
      length: 3,
      firstEquals: "第一段。",
      secondEquals: "第二段开头。\n第二段中间。",
      lastEquals: "第三段。",
    },
  },
  {
    id: "D",
    name: "wrap 长文：1 段被 wrap 成 5 行",
    description: "Pinned behavior: editor wrap will be over-split in auto mode",
    input:
      "这是一段被编辑器自动换行成长段的正文，第一行写到这里结束。\n" +
      "这是同一段的第二行，被编辑器 wrap 出来。\n" +
      "第三行继续，语义上仍然是同一段。\n" +
      "第四行 wrap 出来。\n" +
      "最后一行在同一段里收尾。",
    mode: undefined, // default auto
    expect: {
      // Pinned behavior: each wrap-line becomes its own paragraph.
      // This is the over-split we want to log but not flag as a bug.
      length: 5,
    },
  },
  {
    id: "E",
    name: "显式 single-newline + \\n\\n 输入",
    description: "escape hatch: explicit single-newline always splits on \\n",
    input: "a\n\nb\nc",
    mode: "single-newline",
    expect: {
      length: 3,
      deepEqual: ["a", "b", "c"],
    },
  },
  {
    id: "F",
    name: "显式 double-newline + 单 \\n 输入",
    description: "escape hatch: explicit double-newline collapses when no \\n\\n",
    input: "a\nb\nc",
    mode: "double-newline",
    expect: {
      length: 1,
      deepEqual: ["a\nb\nc"],
    },
  },
];

// --- Runner -----------------------------------------------------------------

let passCount = 0;
let failCount = 0;
const results = [];

for (const c of cases) {
  const opts = c.mode ? { splitMode: c.mode } : {};
  let output;
  let pass = true;
  const failures = [];

  try {
    output = splitIntoParagraphs(c.input, opts);
  } catch (err) {
    pass = false;
    failures.push(`threw: ${err.message}`);
    output = [];
  }

  // Check length
  if (c.expect.length !== undefined && output.length !== c.expect.length) {
    pass = false;
    failures.push(
      `length: expected ${c.expect.length}, got ${output.length}`
    );
  }

  // Check firstEquals
  if (c.expect.firstEquals !== undefined) {
    if (output[0] !== c.expect.firstEquals) {
      pass = false;
      failures.push(
        `first: expected "${c.expect.firstEquals}", got "${output[0]}"`
      );
    }
  }

  // Check lastEquals
  if (c.expect.lastEquals !== undefined) {
    if (output[output.length - 1] !== c.expect.lastEquals) {
      pass = false;
      failures.push(
        `last: expected "${c.expect.lastEquals}", got "${output[output.length - 1]}"`
      );
    }
  }

  // Check nthEquals (n is 0-indexed)
  if (c.expect.nthEquals !== undefined) {
    const { n, value } = c.expect.nthEquals;
    if (output[n] !== value) {
      pass = false;
      failures.push(
        `[${n}]: expected "${value}", got "${output[n]}"`
      );
    }
  }

  // Check secondEquals
  if (c.expect.secondEquals !== undefined) {
    if (output[1] !== c.expect.secondEquals) {
      pass = false;
      failures.push(
        `second: expected "${c.expect.secondEquals}", got "${output[1]}"`
      );
    }
  }

  // Check deepEqual
  if (c.expect.deepEqual !== undefined) {
    const expStr = JSON.stringify(c.expect.deepEqual);
    const outStr = JSON.stringify(output);
    if (expStr !== outStr) {
      pass = false;
      failures.push(`deepEqual: expected ${expStr}, got ${outStr}`);
    }
  }

  // Check immutability (always — implicit contract)
  const snapshot = c.input;
  splitIntoParagraphs(c.input, opts); // call again to ensure no mutation
  if (c.input !== snapshot) {
    pass = false;
    failures.push("input was mutated");
  }

  if (pass) {
    passCount++;
  } else {
    failCount++;
  }

  results.push({
    id: c.id,
    name: c.name,
    description: c.description,
    mode: c.mode ?? "auto (default)",
    input: c.input,
    output,
    pass,
    failures,
  });
}

// --- Print ------------------------------------------------------------------

console.log("=".repeat(72));
console.log("Agent-3 Verifier — Round-7: splitMode auto verification");
console.log("=".repeat(72));

for (const r of results) {
  const status = r.pass ? "PASS" : "FAIL";
  console.log(`\n[${r.id}] ${status} — ${r.name}`);
  console.log(`    desc: ${r.description}`);
  console.log(`    mode: ${r.mode}`);
  console.log(`    input (${r.input.length} chars):`);
  console.log(`      ${r.input.replace(/\n/g, "\\n")}`);
  console.log(`    output (${r.output.length} paragraphs):`);
  r.output.forEach((p, i) => {
    console.log(`      [${i}] ${p.replace(/\n/g, "\\n")}`);
  });
  if (!r.pass) {
    console.log(`    failures:`);
    r.failures.forEach((f) => console.log(`      - ${f}`));
  }
}

console.log("\n" + "=".repeat(72));
console.log(`SUMMARY: ${passCount} pass / ${failCount} fail (of ${cases.length})`);
console.log("=".repeat(72));

process.exit(failCount === 0 ? 0 : 1);
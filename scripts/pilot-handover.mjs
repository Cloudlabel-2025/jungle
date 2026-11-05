import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  unzipSync,
  zipSync,
  strFromU8,
} from "three/examples/jsm/libs/fflate.module.js";
import { csv } from "../lib/pilot-assessment.js";
const source = process.argv[2];
if (!source) throw Error("Supply the local requirement ZIP path.");
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  bytes = await readFile(source),
  zip = unzipSync(bytes),
  docName = Object.keys(zip).find((n) => n.endsWith(".docx")),
  doc = unzipSync(zip[docName]),
  xml = strFromU8(doc["word/document.xml"]);
const plain = (s) =>
  [...s.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((t) =>
      t[1]
        .replaceAll("&amp;", "&")
        .replaceAll("&gt;", ">")
        .replaceAll("&lt;", "<"),
    )
    .join(" ");
const rows = [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((m) =>
  [...m[0].matchAll(/<w:tc[ >][\s\S]*?<\/w:tc>/g)].map((c) => plain(c[0])),
);
const seenRequirements = new Set();
const requirements = rows
  .filter(
    (r) =>
      /^FR-\d{3}$/.test(r[0] || "") &&
      !seenRequirements.has(r[0]) &&
      seenRequirements.add(r[0]),
  )
  .map((r) => ({
    id: r[0],
    module: r[1],
    requirement: r[2],
    sourceStatus: r[3],
    implementation:
      Number(r[0].slice(-3)) <= 5
        ? "Existing foundation retained; regression tested"
        : "Added programme engine / existing role screens",
    evidence:
      "pilot-regression.log; pilot-http-verification.json; pilot-implementation-handover.txt",
    releaseStatus:
      "Developer verification only; independent acceptance pending",
  }));
await writeFile(
  "artifacts/pilot-requirements.csv",
  csv(requirements, Object.keys(requirements[0])),
);
const cases = rows
  .filter((r) => /^(T\d{2}-\d{2}|E2E-\d{2})$/.test(r[0] || ""))
  .map((r) => ({
    id: r[0],
    requirement: r.slice(1).join(" | "),
    status: "NOT INDEPENDENTLY EXECUTED",
    owner: "Independent QA / MC / CC",
    developerEvidence:
      "See pilot-implementation-handover.txt; developer tests are not independent sign-off",
  }));
for (const p of [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) =>
  plain(m[0]),
))
  if (/^E2E-\d{2}\b/.test(p))
    cases.push({
      id: p.slice(0, 6),
      requirement: p.slice(6).trim(),
      status: "NOT INDEPENDENTLY EXECUTED",
      owner: "Independent QA / MC / CC",
      developerEvidence:
        "See pilot-implementation-handover.txt; developer tests are not independent sign-off",
    });
await writeFile(
  "artifacts/pilot-independent-qa.csv",
  csv(cases, Object.keys(cases[0])),
);
const unchanged = [];
for (const path of [
  "app/game-map.css",
  "app/map-navigation.css",
  "app/level-briefing.css",
  "components/WeekOneViews.js",
]) {
  const before = execFileSync("git", ["show", `HEAD:${path}`]),
    after = await readFile(path);
  unchanged.push({
    path,
    unchanged:
      sha(before.toString().replaceAll("\r\n", "\n")) ===
      sha(after.toString().replaceAll("\r\n", "\n")),
  });
}
const files = {};
async function add(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".env"].includes(e.name)) continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) await add(p);
    else
      files[relative(resolve("learner-starter"), p).replaceAll("\\", "/")] =
        new Uint8Array(await readFile(p));
  }
}
await add("learner-starter");
await writeFile("artifacts/pilot-alumni-unsolved-starter.zip", zipSync(files));
const report = {
  source: resolve(source),
  zipSha256: sha(bytes),
  masterDocument: docName,
  masterSha256: sha(zip[docName]),
  baselineCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  strategy:
    "Additive integration; clean-room/replacement instructions superseded by explicit user choice. Current changes are uncommitted.",
  requirements: requirements.length,
  independentCases: cases.length,
  preservedFiles: unchanged,
  learnerArchiveSha256: sha(
    await readFile("artifacts/pilot-alumni-unsolved-starter.zip"),
  ),
  generatedAt: new Date().toISOString(),
};
await writeFile(
  "artifacts/pilot-source-baseline.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));

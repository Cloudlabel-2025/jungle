import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { parseCsv } from "../lib/pilot-assessment.js";
import { graph } from "../lib/pilot-calendar.js";

const input = process.argv[2];
if (!input) throw new Error("Supply the frozen Part B ZIP path.");

const root = "CODEWILD_PART_B/";
const archive = unzipSync(await readFile(input));
const checksums = new Map(
  parseCsv(
    strFromU8(archive[root + "07_APPROVAL_AND_INTEGRATION/FILE_INTEGRITY_SHA256.csv"]),
  ).map((row) => [row.path, row]),
);
const bytes = (path) => {
  const entry = archive[root + path];
  const expected = checksums.get(path);
  assert.ok(entry && expected, path);
  assert.equal(entry.length, Number(expected.size_bytes), path);
  assert.equal(createHash("sha256").update(entry).digest("hex"), expected.sha256, path);
  return entry;
};
const csv = (path) => parseCsv(strFromU8(bytes(path)));
const json = (path) => JSON.parse(strFromU8(bytes(path)));
const version = "Part B frozen 2026-11-06";

const incidentArchive = unzipSync(
  bytes("08_SOURCE_PACKS_UNCHANGED/CODEWILD_Sprint3_Four_Incident_Patch_Preparation_Kits_V1.zip"),
);
const incidentCsv = (name) =>
  parseCsv(strFromU8(incidentArchive[`CODEWILD_SPRINT3/${name}`]));
const sprint3 = {
  number: 3,
  version,
  tasks: incidentCsv("06_SPRINT3_FROZEN_20_CARDS.csv").map((row) => ({
    id: row.task_id,
    owner: row.gamer,
    tt: row.type,
    title: row.task,
    hours: Number(row.estimated_hours),
    depends: row.depends_on ? row.depends_on.split(";") : [],
  })),
  acceptance: incidentCsv("07_SPRINT3_FROZEN_7_CC_ACCEPTANCE.csv").map((row) => ({
    id: row.check_id,
    text: row.CC_victory_check,
  })),
};
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const delivery = (number, prefix) => ({
  number,
  version,
  tasks: csv(`${prefix}_20_TASK_CARDS.csv`).map((row) => {
    assert.equal(row.status, "FROZEN");
    const uat = /^UAT-0([1-5])$/.exec(row.task_id);
    return {
      id: row.task_id,
      owner: row.gamer,
      tt: row.task_type,
      hours: Number(row.estimated_hours),
      title: row.title,
      instructions: row.definition_of_done,
      depends: row.depends_on ? row.depends_on.split(";") : [],
      evidenceRequired: row.evidence_required,
      technicalRole: row.technical_role,
      ...(uat && { uat: { day: weekdays[Number(uat[1]) - 1] } }),
    };
  }),
  acceptance: csv(`${prefix}_7_ACCEPTANCE_CHECKS.csv`).map((row) => ({
    id: row.check_id,
    text: row.requirement,
  })),
});
const sprints = [
  sprint3,
  delivery(4, "02_WEEK5_SPRINT4/W5_S4_FROZEN"),
  delivery(5, "03_WEEK6_SPRINT5/W6_S5_FROZEN"),
];
const helpSource = strFromU8(bytes("02_WEEK5_SPRINT4/W5_S4_TESTING_GUIDES_AND_PROMPTS.md"));
const helpKeys = ["functional", "nonFunctional", "system", "uat"];
const helpSections = [...helpSource.matchAll(/^## [1-4]\. (.+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
assert.equal(helpSections.length, helpKeys.length);
const sprint4Help = Object.fromEntries(helpSections.map(([, title, section], index) => {
  const fields = Object.fromEntries([...section.matchAll(/^\*\*(Purpose|Steps|Example|FIRE prompt|STORY prompt|Evidence):\*\* (.+)$/gm)]
    .map(([, name, value]) => [name, value.trim().replace(/^"|"$/g, "")]));
  assert.equal(Object.keys(fields).length, 6);
  return [helpKeys[index], { title: title.trim(), fields }];
}));
sprint4Help.coaching = helpSource.split("## MC 1:1 guidance for every discipline")[1].trim();
for (const sprint of sprints) {
  assert.equal(sprint.tasks.length, 20);
  assert.equal(sprint.acceptance.length, 7);
  graph(sprint.tasks);
}
for (const [index, owner] of [..."ABCDE"].entries()) {
  const tasks = sprints[2].tasks.filter((task) => task.owner === owner);
  assert.equal(tasks.length, 4);
  assert.deepEqual(
    tasks.filter((task) => task.technicalRole === "Business persona").map((task) => task.id),
    [`DEMO-0${index + 1}`],
  );
}
const finalFriday = {
  operating: json("04_FINAL_FRIDAY/FINAL_FRIDAY_OPERATING_CONFIG.json"),
  awards: json("04_FINAL_FRIDAY/AWARD_CATEGORIES_AND_SELECTION_CONFIG.json"),
  passport: json("04_FINAL_FRIDAY/CAPABILITY_PASSPORT_DATA_TEMPLATE.json"),
  certificate: json("04_FINAL_FRIDAY/CERTIFICATE_DATA_TEMPLATE.json"),
  thursdayExport: json("04_FINAL_FRIDAY/THURSDAY_TWO_LINKED_EXPORTS_TEMPLATE.json"),
  advisoryOutput: json("04_FINAL_FRIDAY/FINAL_FRIDAY_AI_OUTPUT_SCHEMA_EXAMPLE.json"),
  advisoryPrompt: strFromU8(
    bytes("04_FINAL_FRIDAY/THURSDAY_AI_CODE_REVIEW_AND_QUESTIONS_PROMPT.md"),
  ),
};
const phase2 = json("05_PHASE2_OPTIONAL/P2_APPROVED_TASKS_WITH_FROZEN_STATUS.json");
assert.equal(finalFriday.operating.five_parallel_arenas.length, 5);
assert.equal(finalFriday.awards.award_category_count, 20);
assert.equal(phase2.levels.length, 3);
for (const level of phase2.levels) {
  assert.equal(level.cards.length, 20);
  graph(level.cards.map((card) => ({ id: card.id, depends: card.depends_on })));
}
await writeFile(
  new URL("../lib/pilot-part-b.json", import.meta.url),
  JSON.stringify({ source: version, sprints, finalFriday, phase2, sprint4Help }, null, 2) + "\n",
);
console.log("Verified and imported 60 core cards, 21 gates, Final Friday references and 60 optional cards.");

import { readFile, writeFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
import { parseCsv, csv } from "../lib/pilot-assessment.js";

const path = process.argv[2];
if (!path) throw new Error("Supply the frozen Part B archive path.");
const archive = unzipSync(await readFile(path));
const root = "CODEWILD_PART_B/";
const source = parseCsv(strFromU8(archive[root + "06_INDEPENDENT_QA/PART_B_TEST_CASES.csv"]));
const existing = parseCsv(await readFile("artifacts/part-b-acceptance-results.csv", "utf8"));
const categories = {
  Sprint3: "A: technical operator must map/rehearse real isolated student-app incidents and witness repair, confidentiality, rollback and acceptance",
  Sprint4: "B: witness protected UAT, actual defects/retests, approved non-functional targets, regression evidence and QA-15 timing",
  Sprint5: "C: witness real persona journeys, private defences, actual release/rollback, prior 28 checks and QA-18 timing",
  "Final Friday": "D/E/F/G: actual staffing/rooms, human question quality/approval, external AI/source safety, optional code demonstration and ungraded Campfire",
  Awards: "G: verify real final scores, evidence-based selections, ties, truthful override announcement and no mark changes",
  Passport: "H: inspect real learner identity/evidence/criterion accuracy and approve actual issue; generated two-page PDF and private MongoDB byte/hash/access/review/issue/correction controls have synthetic technical evidence",
  Certificate: "H: approve real learner identity/dates/unique ID and signatures; generated one-page exact wording and private MongoDB access have synthetic technical evidence",
  Phase2: "I: verify actual isolated student-app integrations, sandbox payment authenticity, concurrency/recovery and codebase governance",
};
const automated = new Map();
const cover = (ids, description) => ids.forEach(id => automated.set(`PB-QA-${String(id).padStart(3,"0")}`,description));
cover([77,98,101,102,103,108,111,112,113,114,115,116], "Existing pilot-part-b.test.mjs regression: content, eligibility, score isolation, staffing and private issue guards");
cover([111,113,115], "pilot-part-b-phase2.test.mjs: all 60 cards across three levels submitted and independently reviewed via normal actions; rework/resubmission per level, 25-Gamer owner-only visibility and no automatic marks/bonuses; only prior Key 5 eligibility seeded. Synthetic engine workflow, not real integrations or browser execution");
cover([112,114,116], "pilot-part-b.test.mjs: early-level eligibility rejected; pilot-part-b-phase2.test.mjs: each following level approved only after all preceding cards accepted through normal actions. Synthetic engine workflow, not independent student acceptance");
cover([95], "pilot-part-b-controls.test.mjs: Q1/Q2/Q3 validation, MC edit, CC version approval, stale approval/witness invalidation and assessor scope");
cover([99], "pilot-part-b-controls.test.mjs: five teams/25 voluntary ten-minute bookings, 250 reviewer-minutes, overlap and reviewer permission guards; synthetic schedule only");
cover([100], "pilot-part-b-controls.test.mjs: production-labelled Admin Chair evidence rejected; real target execution remains operator work");
cover([104,105], "pilot-part-b-controls.test.mjs: original criterion totals, highest-score/tie selection policy, explicit override and truthful label; no score ledger mutation");
cover([91], "pilot-part-b-controls.test.mjs: passing-witness showcase prerequisite and no scoring side effect; actual five-finalist selection requires CC");
cover([92,93], "PARTIAL: absent source marked NOT_ASSESSABLE; unsupported code findings rejected; untrusted-source warning; actual external AI behavior not exercised");
cover([107,109,110], "pilot-part-b-pdf.test.mjs + inspect-part-b-pdfs.py: actual two-page Passport and one-page certificate; 13 criteria/maxima, NOT_ASSESSED source controls, separate bonuses, exact certificate text, clickable evidence, real MongoDB bytes and SHA-256 round trip, privacy before issue, assigned MC review, CC issue, stale-source rejection and correction/reissue. Fictional assessed eligibility; real learner accuracy/signatures still require humans");
cover([65,66,67,68,69,70,71,72,73,74,76,82,83,84,85,86,87,88,89,90], "PARTIAL: release/witness/approved-question gates and persona-scoped cross-team assessor access; no real learner observation or rooms simulated");
cover([50,51,52,53,54,55], "pilot-help.test.mjs: consent, reservations, completed MC session, lifetime sponsorship, verified credit and carry-forward");
const rows = source.map(row => {
  const prior = existing.find(item => item.test_id === row.test_id);
  return { test_id: row.test_id, area: row.area, scenario: row.scenario, expected_result: row.expected_result,
    historical_result: prior?.result || "NOT_RECORDED", historical_retest: prior?.retest_result || "",
    new_automated_coverage: automated.get(row.test_id) || "Existing row evidence retained; no newly claimed independent pass",
    remaining_verification: prior?.result === "PASS" ? "Review existing row evidence during final independent sign-off" : categories[row.area],
    evidence: automated.has(row.test_id) ? "part-b-full-regression.txt; part-b-pdf-verification.json; tests/pilot-part-b-controls.test.mjs; tests/pilot-part-b-pdf.test.mjs; tests/pilot-part-b-phase2.test.mjs; tests/pilot-part-b.test.mjs; tests/pilot-help.test.mjs" : prior?.run_evidence || "",
    independent_signoff: "NOT_CREATED_BY_AUTOMATED_TESTS" };
});
const admin = unzipSync(archive[root + "08_SOURCE_PACKS_UNCHANGED/CODEWILD_PartB_Week6_Admin_Chair_Frozen_AddOn_V1.zip"]);
for (const row of parseCsv(strFromU8(admin["PB-W6-ADV-ADMIN-01_QA.csv"]))) rows.push({
  test_id: row["Test ID"], area: "Original Admin Chair", scenario: row.Scenario, expected_result: row["Expected result"],
  historical_result: "NO_COMPLETE_INDEPENDENT_RECORD_ESTABLISHED",
  new_automated_coverage: "Mandatory-witness, separate 0-5 ledger, five-point evidence, isolated environment, duration, booking, no auto trophy and duplicate guards covered; see control tests",
  remaining_verification: "F: independent equivalent briefs, actual isolated code/config change, cross-layer verification, rollback and private defence; sign the original case",
  evidence: "part-b-full-regression.txt; tests/pilot-part-b-controls.test.mjs; tests/pilot-part-b.test.mjs",
  independent_signoff: "NOT_CREATED_BY_AUTOMATED_TESTS",
});
const incident = unzipSync(archive[root + "08_SOURCE_PACKS_UNCHANGED/CODEWILD_Sprint3_Four_Incident_Patch_Preparation_Kits_V1.zip"]);
const operatorText = strFromU8(incident["CODEWILD_SPRINT3/09_INDEPENDENT_TESTING_MINIMUM.md"]);
const checks = operatorText.split(/\r?\n/).filter(line => /^\| /.test(line)).slice(1);
checks.forEach((line,index) => {
  const [,scenario,action,expected] = line.split("|").map(value => value.trim());
  rows.push({ test_id: `S3-OP-${String(index+1).padStart(2,"0")}`, area: "Original incident operator", scenario: `${scenario}: ${action}`,
    expected_result: expected, historical_result: "NO_COMPLETE_INDEPENDENT_RECORD_ESTABLISHED",
    new_automated_coverage: "Generic role/approval/client acceptance controls retained; no real student-repository patch execution claimed",
    remaining_verification: categories.Sprint3, independent_signoff: "NOT_CREATED_BY_AUTOMATED_TESTS" });
});
let browser = { checks: [] };
try { browser = JSON.parse(await readFile("artifacts/part-b-browser-2026-11-12/browser-results.json","utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
browser.checks = browser.checks.map(check => ({ ...check,
  evidence: check.evidence.map(path => `part-b-browser-2026-11-12/${path}`) }));
try {
  const pdfBrowser = JSON.parse(await readFile("artifacts/part-b-pdf-browser-2026-11-12/browser-results.json", "utf8"));
  browser.checks.push(...pdfBrowser.checks.map(check => ({ ...check,
    evidence: check.evidence.map(path => `part-b-pdf-browser-2026-11-12/${path}`) })));
} catch (error) { if (error.code !== "ENOENT") throw error; }
for (const row of rows) {
  const checks = browser.checks.filter(check => check.cases.includes(row.test_id));
  row.browser_result = checks.length ? [...new Set(checks.map(check => check.status))].join("; ") : "NOT_RUN_IN_THIS_BROWSER_SESSION";
  row.browser_coverage = checks.map(check => `${check.id}: ${check.observation}`).join(" | ");
  row.browser_evidence = [...new Set(checks.flatMap(check => check.evidence))].join("; ");
}
await writeFile("artifacts/part-b-manual-verification.csv", csv(rows,["test_id","area","scenario","expected_result","historical_result","historical_retest","new_automated_coverage","browser_result","browser_coverage","browser_evidence","remaining_verification","evidence","independent_signoff"])+"\n");
console.log(`Wrote ${rows.length} rows: ${source.length} Part B + 12 Admin Chair + ${checks.length} incident operator checks. Historical acceptance outcomes preserved.`);

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
import { models } from "../lib/db.js";
import { pilotAction } from "../lib/pilot-engine.js";
import { authorisedFile, bytesFor, privateFileResponse } from "../lib/pilot-storage.js";
import { finalReportPdf } from "../lib/part-b-report-pdf.js";
import { hash } from "../lib/pilot-rules.js";
import { finalCriteria } from "../lib/part-b-final.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import partB from "../lib/pilot-part-b.json" with { type: "json" };

test("Part B PDF: real private bytes, MC review, CC issue, learner download and correction without Blob",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 }, async t => {
    const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = "/part_b_pdf_workflow";
    process.env.MONGODB_URI = uri.toString();
    t.after(() => mongoose.disconnect());
    const { cc, mc, otherMC, gamers, teams, cohortId } = await pilotFixture(1);
    const teamId = teams[0].id, userId = gamers[0]._id;
    const now = new Date("2026-12-11T08:00:00Z");
    const reason = "Fictional generated report workflow; not a real student assessment or signature.";
    const evidence = "https://example.invalid/assessed-evidence";
    const programme = await models.WeekOneProgram.findById(cohortId).lean();
    const config = { ...sprintConfig(teams, mc, 2), number: 5,
      template: partB.sprints.find(row => row.number === 5), rosterDigest: hash(programme.data.recovery.published),
      gates: [], acceptances: [{ teamId, decision: "ACCEPTED", key: "Key 5" }],
      dueAt: "2026-12-11T11:30:00Z" };
    // Synthetic assessed eligibility only. All PDFs, stored bytes and access decisions below are real.
    await models.PilotSprint.create({ _id: "pdf-final", cohortId, state: "ACTIVE", version: 1, createdAt: now, data: config });
    await models.PilotLedger.create({ _id: "pdf-core", cohortId, sprintId: "pdf-final", teamId, userId,
      state: "CORE", createdAt: now, data: { score: 100, evidence } });
    await models.PilotDaily.create({ _id: "pdf-witness", cohortId, sprintId: "pdf-final", teamId, userId,
      state: "FINAL_DEMO_WITNESS", createdAt: now, data: { decision: "PASS", defenceMinutes: 5, evidence } });
    await models.PilotTask.create({ _id: "pdf-demo", cohortId, sprintId: "pdf-final", teamId, userId,
      state: "Accepted", createdAt: now, data: { code: "DEMO-01", title: "Alumni administrator journey", technicalRole: "Business persona", evidence: [{ url: evidence, by: userId }], stages: [], basic: {} } });
    const act = (actor, action, body = {}) => pilotAction(actor, action,
      { requestId: randomUUID(), teamId, reason, ...body }, now);
    const profile = { userId, rubricVersion: "WILD6-frozen",
      criteria: finalCriteria.map(row => ({ criterion_id: row.criterion_id, approved_score: row.max_score, evidence_refs: [evidence] })),
      strengths: [{ criterion_id: finalCriteria[0].criterion_id, observation: "Explains the persisted result using traceable test evidence.", evidence_ref: evidence }],
      gaps: [{ criterion_id: finalCriteria[1].criterion_id, recommended_exercise: "Practise a recovery scenario with an independent reviewer.", evidence_ref: evidence }] };
    await act(cc, "final-profile", profile);
    const body = { userId, commit: "b".repeat(40), sanitised: true, course: "MERN Programme",
      projectId: "FICTIONAL-QA-APP", sourceArtifactLink: evidence, deployedTestUrl: evidence };
    await assert.rejects(act(gamers[0], "final-report-generate", body), { status: 403 });
    await assert.rejects(act(otherMC, "final-report-generate", body), { status: 403 });
    const requestId = randomUUID();
    let generated = await act(mc, "final-report-generate", { ...body, requestId });
    assert.deepEqual(await act(mc, "final-report-generate", { ...body, requestId }), generated);
    assert.equal(await models.PrivateReportFile.countDocuments({ cohortId }), 2);
    assert.equal((await models.PrivateReportFile.findOne({ cohortId }).lean()).bytes, undefined);
    const pair = output => ({ userId, passportId: output.files.find(row => row.kind === "PASSPORT").id,
      certificateId: output.files.find(row => row.kind === "CERTIFICATE").id,
      passportPages: 2, certificateWordingVerified: true, evidenceVerified: true });
    for (const file of generated.files) {
      const stored = await authorisedFile(mc, file.id), bytes = await bytesFor(stored);
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
      assert.equal((await PDFDocument.load(bytes)).getPageCount(), file.kind === "PASSPORT" ? 2 : 1);
      await assert.rejects(authorisedFile(gamers[0], file.id), { status: 403 });
      await assert.rejects(authorisedFile(gamers[1], file.id), { status: 403 });
      await assert.rejects(authorisedFile(otherMC, file.id), { status: 403 });
    }
    await assert.rejects(act(cc, "final-report-issue", { userId }), /MC must review/);
    await assert.rejects(act(mc, "final-report-review", { ...pair(generated), evidenceVerified: false }), /Verify the two-page/);
    await act(cc, "final-profile", profile);
    await assert.rejects(act(mc, "final-report-review", pair(generated)), /out of date/);
    const old = generated;
    generated = await act(mc, "final-report-generate", body);
    await assert.rejects(act(mc, "final-report-review", { ...pair(generated), certificateId: pair(old).certificateId }), /different generations/);
    await act(mc, "final-report-review", pair(generated));
    await assert.rejects(act(mc, "final-report-issue", { userId }), { status: 403 });
    await act(cc, "final-report-issue", { userId });
    for (const file of generated.files) {
      const response = await privateFileResponse(gamers[0], file.id);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Content-Type"), "application/pdf");
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.match(response.headers.get("Content-Disposition"), /^attachment;/);
      assert.equal(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"), file.sha256);
    }
    await assert.rejects(act(mc, "final-report-generate", body), /Reopen issued/);
    await act(cc, "final-report-reopen", { userId });
    await assert.rejects(authorisedFile(gamers[0], pair(generated).passportId), { status: 403 });
    const corrected = await act(mc, "final-report-generate", { ...body, course: "Corrected fictional programme" });
    await act(mc, "final-report-review", pair(corrected));
    await models.PilotLedger.updateOne({ _id: "pdf-core" }, { $set: { "data.evidence": evidence + "/corrected" } });
    await assert.rejects(act(cc, "final-report-issue", { userId }), /evidence changed/);
    const final = await act(mc, "final-report-generate", body);
    await act(mc, "final-report-review", pair(final));
    await act(cc, "final-report-issue", { userId });
    await assert.rejects(authorisedFile(gamers[0], pair(generated).passportId), { status: 403 });
    await models.Cohort.updateOne({ _id: cohortId }, { $set: { college: "Changed college identity" } });
    await assert.rejects(authorisedFile(gamers[0], pair(final).passportId), /evidence changed/);
    await models.Cohort.updateOne({ _id: cohortId }, { $set: { college: "QA only" } });
    await mkdir("output/pdf", { recursive: true });
    for (const file of final.files) {
      const bytes = await bytesFor(await authorisedFile(gamers[0], file.id));
      await writeFile(`output/pdf/part-b-fictional-${file.kind.toLowerCase()}.pdf`, bytes);
    }
    const { report } = await act(mc, "final-report-data", body);
    const overflow = structuredClone(report);
    overflow.dossier.strengths = [{ observation: "Long observation ".repeat(1800), evidence_ref: evidence }];
    await assert.rejects(finalReportPdf(overflow), /exceeds the fixed page layout/);
    const unsupported = structuredClone(report); unsupported.identity.name = "Unsupported \u{1F600}";
    await assert.rejects(finalReportPdf(unsupported), /font does not support/);
    const target = final.files[0];
    await models.PrivateReportFile.updateOne({ _id: target.id }, { $set: { bytes: Buffer.from("corrupted") } });
    await assert.rejects(privateFileResponse(mc, target.id), /integrity/);
    await models.PilotSprint.updateOne({ _id: "pdf-final" }, { $set: { "data.acceptances": [] } });
    await assert.rejects(authorisedFile(gamers[0], pair(final).certificateId), { status: 403 });
    t.diagnostic("Actual PDF round trip verified without Blob credentials. Sample files contain fictional assessment records and unsigned signature lines.");
  });

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import mongoose from "mongoose";
import { PDFDocument } from "pdf-lib";
import { models } from "../lib/db.js";
import { hash } from "../lib/pilot-rules.js";
import { pilotFixture, sprintConfig } from "./pilot-fixture.mjs";
import { uploadIntent, storePrivateUpload, finishUpload, privateFileResponse } from "../lib/pilot-storage.js";
import partB from "../lib/pilot-part-b.json" with { type: "json" };

test("Part B private evidence: all 25 learners, five teams, immutable uploads, format/size/expiry and scoped downloads without Blob",
  { skip: !process.env.TEST_MONGODB_URI, timeout: 180000 }, async t => {
    const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = "/part_b_private_evidence";
    process.env.MONGODB_URI = uri.toString();
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = "";
    t.after(async () => { await mongoose.disconnect();
      if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = previousToken; });
    const { mc, otherMC, gamers, teams, cohortId } = await pilotFixture(5);
    const now = new Date(), programme = await models.WeekOneProgram.findById(cohortId).lean();
    const config = { ...sprintConfig(teams, mc, 2), number: 5,
      template: partB.sprints.find(row => row.number === 5), rosterDigest: hash(programme.data.recovery.published),
      dueAt: "2099-12-11T11:30:00Z", gates: [], acceptances: [],
      kickoffStart: new Date(+now - 86400000).toISOString(), kickoffEnd: new Date(+now - 86400000).toISOString(),
      teams: teams.map(team => ({ teamId: team.id, members: team.members, commanderId: mc._id,
        kickoff: { by: mc._id, at: new Date(+now - 86400000) } })) };
    await models.PilotSprint.create({ _id: "evidence-sprint", cohortId, state: "ACTIVE", version: 1, createdAt: now, data: config });
    const task = async (owner, id = `evidence-${owner._id}`) => {
      await models.PilotTask.create({ _id: id, cohortId, sprintId: "evidence-sprint", teamId: owner.teamId,
        userId: owner._id, state: "Working", createdAt: now,
        data: { code: id, evidence: [], basic: {}, stages: [], depends: [], dueAt: config.dueAt } });
      return id;
    };
    const intent = (actor, taskId, filename = "verified.pdf", extra = {}) => uploadIntent(actor,
      { requestId: randomUUID(), reason: "Fictional storage and permission test only.", taskId, filename, ...extra });
    const document = await PDFDocument.create(); document.addPage(); const bytes = Buffer.from(await document.save());
    const request = (body = bytes, contentType = "application/pdf") => new Request("http://localhost/api/pilot/storage", {
      method: "PUT", headers: { "Content-Type": contentType }, body });
    const taskIds = [];
    for (const gamer of gamers) {
      const taskId = await task(gamer); taskIds.push(taskId);
      const reserved = await intent(gamer, taskId);
      assert.equal(reserved.provider, "MONGODB");
      assert.match(reserved.uploadUrl, /^\/api\/pilot\/storage\?evidenceId=/);
      const otherTeam = gamers.find(other => other.teamId !== gamer.teamId);
      await assert.rejects(storePrivateUpload(otherTeam, reserved.evidenceId, request()), { status: 403 });
      await assert.rejects(finishUpload(gamer, { evidenceId: reserved.evidenceId }), /Upload at most/);
      await storePrivateUpload(gamer, reserved.evidenceId, request());
      await assert.rejects(privateFileResponse(gamer, reserved.evidenceId), /not verified/);
      await assert.rejects(storePrivateUpload(gamer, reserved.evidenceId, request()), /already stored/);
      await finishUpload(gamer, { evidenceId: reserved.evidenceId });
      await finishUpload(gamer, { evidenceId: reserved.evidenceId }); // Lost completion response is retryable.
      const response = await privateFileResponse(gamer, reserved.evidenceId);
      assert.equal(response.headers.get("Content-Type"), "application/pdf");
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      assert.equal(createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"), createHash("sha256").update(bytes).digest("hex"));
      await assert.rejects(privateFileResponse(otherTeam, reserved.evidenceId), { status: 403 });
      await assert.rejects(privateFileResponse(otherMC, reserved.evidenceId), { status: 403 });
      assert.equal((await privateFileResponse(mc, reserved.evidenceId)).status, 200);
      const saved = await models.PilotTask.findById(taskId).lean();
      assert.equal(saved.data.evidence.length, 1);
      assert.equal(saved.data.evidence[0].by, gamer._id);
    }
    assert.equal(await models.PrivateReportFile.countDocuments({ cohortId }), 25);
    const owner = gamers[0], sameTeam = gamers[1];
    const one = await models.PilotEvidence.findOne({ userId: owner._id }).lean();
    assert.equal((await privateFileResponse(sameTeam, one._id)).status, 200, "Task evidence is intentionally shared within its team");
    const badTask = await task(owner, "negative-upload-task");
    const bad = await intent(owner, badTask);
    await assert.rejects(storePrivateUpload(sameTeam, bad.evidenceId, request()), { status: 403 });
    await assert.rejects(storePrivateUpload(owner, bad.evidenceId, request(bytes, "text/plain")), /type/);
    await assert.rejects(storePrivateUpload(owner, bad.evidenceId, request(Buffer.from("not a PDF"))), /PDF signature/);
    await assert.rejects(storePrivateUpload(owner, bad.evidenceId, request(Buffer.alloc(0))), /5 MB/);
    await assert.rejects(storePrivateUpload(owner, bad.evidenceId, request(Buffer.alloc(5 * 1024 * 1024 + 1))), { status: 413 });
    await models.PilotEvidence.updateOne({ _id: bad.evidenceId }, { $set: { createdAt: new Date(Date.now() - 16 * 60000) } });
    await assert.rejects(storePrivateUpload(owner, bad.evidenceId, request()), /expired/);
    assert.equal(await models.PrivateReportFile.countDocuments({ _id: bad.evidenceId }), 0);
    await intent(owner, taskIds[0]); await intent(owner, taskIds[0]);
    await assert.rejects(intent(owner, taskIds[0]), /Three total evidence/);
    await models.PilotBatch.create({ _id: "marks-upload", cohortId, sprintId: "evidence-sprint", userId: mc._id,
      state: "EXPORTED", createdAt: now, data: {} });
    const returned = await uploadIntent(mc, { requestId: randomUUID(), batchId: "marks-upload", filename: "return.csv" });
    const csv = Buffer.from("gamer_id,criterion,score\nFICTIONAL,example,1\n");
    await storePrivateUpload(mc, returned.evidenceId, request(csv, "text/csv"));
    await finishUpload(mc, { evidenceId: returned.evidenceId });
    const csvResponse = await privateFileResponse(mc, returned.evidenceId);
    assert.equal(csvResponse.headers.get("Content-Type"), "text/csv");
    assert.equal(await csvResponse.text(), csv.toString());
    await assert.rejects(privateFileResponse(owner, returned.evidenceId), { status: 403 });
    const largeTask = await task(owner, "five-megabyte-upload");
    const large = await intent(owner, largeTask), chunkSize = 1024 * 1024;
    const payload = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5 * chunkSize - 9, 32)]);
    const partRequest = (index, data = payload.subarray(index * chunkSize, (index + 1) * chunkSize)) => new Request("http://localhost/api/pilot/storage", {
      method: "PUT", headers: { "Content-Type": "application/pdf", "X-Upload-Part": String(index), "X-Upload-Parts": "5", "X-Upload-Size": String(payload.length) }, body: data });
    await storePrivateUpload(owner, large.evidenceId, partRequest(0));
    await storePrivateUpload(owner, large.evidenceId, partRequest(0));
    await assert.rejects(storePrivateUpload(owner, large.evidenceId, partRequest(0, Buffer.alloc(chunkSize))), /different upload part/);
    await assert.rejects(finishUpload(owner, { evidenceId: large.evidenceId }), /Upload at most/);
    for (const index of [2, 1, 4, 3]) await storePrivateUpload(owner, large.evidenceId, partRequest(index));
    await storePrivateUpload(owner, large.evidenceId, partRequest(3)); // Last response may be lost.
    await finishUpload(owner, { evidenceId: large.evidenceId });
    const largeResponse = await privateFileResponse(owner, large.evidenceId);
    assert.equal(largeResponse.headers.get("Content-Length"), null, "Large files use a streaming response");
    assert.deepEqual(Buffer.from(await largeResponse.arrayBuffer()), payload);
    assert.equal(await models.PrivateReportFile.countDocuments({ _id: { $regex: `^${large.evidenceId}:part:` } }), 0);
    const restored = mongoose.connection.getClient().db(`part_b_restore_${randomUUID().replaceAll("-", "")}`);
    try {
      for (const model of [models.PilotEvidence, models.PilotTask, models.PrivateReportFile]) {
        const name = model.collection.collectionName;
        const records = await model.collection.find({ cohortId }).toArray();
        await restored.collection(name).insertMany(records);
        assert.equal(await restored.collection(name).countDocuments(), records.length);
      }
      const recovered = await restored.collection(models.PrivateReportFile.collection.collectionName).findOne({ _id: large.evidenceId });
      assert.equal(createHash("sha256").update(recovered.bytes.buffer).digest("hex"), createHash("sha256").update(payload).digest("hex"));
    } finally {
      await restored.dropDatabase(); // Only this newly created disposable restore database.
    }
    t.diagnostic("25 real PDF upload/completion/download round trips across five fictional teams; MC access and cross-team/unassigned access checked. CSV mark-return bytes preserved. No real learner work or external integrations certified.");
    t.diagnostic("Exact 5 MB transport payload assembled from bounded 1 MB parts, duplicate/out-of-order parts verified, download streamed and private-file/metadata logical restore checked. The limit payload tests transport, not PDF semantic validity or an operational backup policy.");
  });

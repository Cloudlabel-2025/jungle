import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { models, connect } from "../lib/db.js";
import { dayOneAction } from "../lib/day-one.js";
import { newLevelOne } from "../lib/level-one-rules.js";
import { readSharedChat } from "../lib/shared-chat-reader.js";
import { fixtureConfig } from "./day-one-fixture.mjs";

const link = suffix => `https://chatgpt.com/share/12345678-1234-1234-1234-${String(suffix).padStart(12, "0")}`;
const answer = "Automobiles need careful comparison of running costs, safety and equipment. Research should check each assumption against evidence from a reliable source. Consider whether the result changes when the budget, journey length or available options change. Compare the alternatives fairly and explain which choice works best for the same situation. Identify uncertainty and propose a practical way to check the claim before making a final decision. This is a detailed research discussion about automobiles and their trade-offs, using clear reasoning and public information.";
function providerData() {
  const mapping = { root: { id: "root" } }; let parent = "root";
  for (let i = 0; i < 3; i++) for (const role of ["user", "assistant"]) {
    const id = `${role}-${i}`;
    mapping[id] = { id, parent, message: { author: { role }, content: { content_type: "text", parts: [role === "user" ? `Research automobiles, compare options and check source ${i}.` : `${answer} https://example.org/source`] } } };
    parent = id;
  }
  return { title: "Automobiles research", mapping, current_node: parent };
}
test("MongoDB shared-link review: URL-only submissions, safe retries, historical backfill, scope and stale reads", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const uri = new URL(process.env.TEST_MONGODB_URI); uri.pathname = `shared_chat_${Date.now()}`; process.env.MONGODB_URI = uri.toString();
  await connect(); for (const model of Object.values(models)) await model.init();
  const p = { _id: "shared-p", name: "Player", email: "shared-p@example.invalid", role: "GAMER", cohortId: "alpha", teamId: "shared-team" };
  const q = { ...p, _id: "shared-q", name: "Other player", email: "shared-q@example.invalid" };
  const cc = { _id: "shared-cc", name: "CC", email: "shared-cc@example.invalid", role: "CENTRE_COMMAND", cohortId: "alpha" };
  const mc = { _id: "shared-mc", name: "MC", email: "shared-mc@example.invalid", role: "MISSION_COMMANDER", cohortId: "alpha" };
  const config = { ...fixtureConfig(), version: 1 };
  const now = new Date("2026-11-02T03:40:00Z");
  let requests = 0;
  const reader = url => readSharedChat(url, { now, fetchImpl: async () => { requests++; return Response.json(providerData()); } });
  try {
    await models.User.insertMany([p, q, cc, mc]);
    await models.Team.create({ _id: "shared-team", name: "Shared test", code: "ST", cohortId: "alpha", commanderId: "another-mc" });
    await models.Cohort.create({ _id: "alpha", name: "Shared QA", college: "Synthetic", startDate: config.day, currentWeek: 1 });
    await models.DayOneSetup.create({ _id: "alpha", revision: 0, draft: config, released: config });
    await models.WeekOneRelease.create({ _id: "alpha", days: [1,2,3,4,5].map(day => ({ day, state: day === 1 ? "OPEN" : "DRAFT", ...(day === 1 ? { content: config, scheduledEnd: config.closingCutoff, officialStart: config.officialStart, openedAt: config.availableAt } : {}) })) });
    for (const player of [p, q]) await models.DayOneRecord.create({ _id: `alpha:${player._id}`, userId: player._id, cohortId: "alpha", version: 0, data: { config, genreId: config.genres[0].id, clockAt: config.availableAt, availableAt: config.availableAt, acknowledgedAt: config.availableAt, startedAt: config.availableAt, deadline: "2026-11-02T05:00:00Z", submissions: [], ledger: [], levelOne: newLevelOne() } });
    const saved = player => models.DayOneRecord.findById(`alpha:${player._id}`).lean();
    const balance = player => models.User.findById(player._id).lean();
    await dayOneAction(p, "submit", { version: 0, url: link(1), transcript: "FORGED CLIENT TEXT SHOULD NOT BE USED" }, now, { sharedChatReader: reader });
    let record = await saved(p), submission = record.data.submissions.at(-1);
    assert.equal(record.data.levelOne.automatic.stars, 3); assert.equal((await balance(p)).xp, 150);
    assert.ok(!submission.transcript.includes("FORGED CLIENT"));
    assert.equal(submission.evidence.userTurns, 3); assert.equal(record.data.verification.status, "VERIFIED");
    assert.equal(requests, 1);
    await dayOneAction(p, "submit", { version: record.version, url: link(1) }, now, { sharedChatReader: reader });
    assert.equal(requests, 1, "a retry uses its immutable provider snapshot");
    assert.equal(await models.LevelOneReward.countDocuments({ userId: p._id }), 1);
    record = await saved(p);
    await dayOneAction(p, "review-link", { version: record.version, revisionId: submission.id }, now, { sharedChatReader: reader });
    assert.equal((await balance(p)).xp, 150); assert.equal(requests, 1);
    // A network read finishing after another write must not overwrite that write.
    record = await saved(p);
    const staleReader = async url => { const result = await reader(url); await models.DayOneRecord.updateOne({ _id: record._id }, { $inc: { version: 1 } }); return result; };
    await assert.rejects(dayOneAction(p, "submit", { version: record.version, url: link(2), reason: "Updated research conversation" }, now, { sharedChatReader: staleReader }), e => e.status === 409);
    assert.equal((await balance(p)).xp, 150); assert.equal((await saved(p)).data.submissions.length, 1);
    // Save a URL-only legacy submission: review later must preserve its timestamp.
    const originalAt = "2026-11-02T03:40:00.000Z";
    await models.DayOneRecord.updateOne({ _id: `alpha:${q._id}` }, { $unset: { "data.levelOne": "" }, $set: { "data.submissions": [{ id: "legacy-link", url: link(3), at: originalAt, reason: "Initial submission" }] } });
    await assert.rejects(dayOneAction(mc, "review-link", { userId: q._id, version: 0, revisionId: "legacy-link" }, now, { sharedChatReader: reader }), e => e.status === 403);
    const failed = url => readSharedChat(url, { fetchImpl: async () => new Response(null, { status: 403 }) });
    await dayOneAction(q, "review-link", { version: 0, revisionId: "legacy-link" }, now, { sharedChatReader: failed });
    record = await saved(q); assert.equal(record.data.levelOne.automatic.status, "REVIEW_REQUIRED"); assert.equal((await balance(q)).xp, 0);
    await models.WeekOneRelease.updateOne({ _id: "alpha" }, { $set: { "days.0.state": "CLOSED" } });
    await dayOneAction(q, "review-link", { version: record.version, revisionId: "legacy-link" }, new Date("2026-11-03T06:00:00Z"), { sharedChatReader: reader });
    record = await saved(q);
    assert.equal(record.data.submissions.at(-1).at, originalAt);
    assert.equal(record.data.levelOne.automatic.stars, 3, "the provider read time is not the submission deadline");
    assert.equal((await balance(q)).xp, 150);
    await dayOneAction(cc, "level-result", { userId: q._id, members: [q._id], versions: { [q._id]: record.version }, operation: "reopen", reason: "Evidence requires a fresh attempt" }, now);
    record = await saved(q);
    await dayOneAction(q, "review-link", { version: record.version, revisionId: "legacy-link" }, now, { sharedChatReader: reader });
    assert.equal((await balance(q)).xp, 0, "retry cannot bypass a staff reopen");
  } finally { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
});

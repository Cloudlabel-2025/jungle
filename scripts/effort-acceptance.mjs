import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { models } from "../lib/db.js";

export async function effortAcceptance(request) {
  const gamer = "usr_g01",
    peer = "usr_g06",
    mc = "usr_mc01",
    cc = "usr_cc01";
  const read = (who) => request(who, "support");
  const post = (who, action, body, status = 200) =>
    request(
      who,
      `support/${action}`,
      { idempotencyKey: randomUUID(), ...body },
      status,
    );
  const createTicket = async (description) => {
    await post(gamer, "ticket-create", { description });
    return (await read(gamer)).tickets.find(
      (t) => t.description === description,
    )._id;
  };
  const original = await createTicket(
    "V3 synthetic original: investigate duplicate delivery",
  );
  const repeat = await createTicket(
    "V3 synthetic repeat: investigate equivalent duplicate delivery",
  );
  const body = {
    ticketId: original,
    startedAt: "2026-10-20T01:00:00Z",
    endedAt: "2026-10-20T04:00:00Z",
    sessionKind: "ACTIVE",
    reason: "Synthetic failed investigation fixture",
    idempotencyKey: randomUUID(),
  };
  await Promise.all([
    post(gamer, "effort-create", body),
    post(gamer, "effort-create", body),
  ]);
  await post(
    gamer,
    "effort-create",
    { ...body, reason: "Changed input with reused key" },
    409,
  );
  await post(gamer, "effort-create", {
    ...body,
    idempotencyKey: randomUUID(),
    startedAt: "2026-10-20T05:00:00Z",
    endedAt: "2026-10-20T09:00:00Z",
  });
  await post(gamer, "effort-create", {
    ticketId: original,
    startedAt: "2026-10-20T09:00:00Z",
    endedAt: "2026-10-20T10:00:00Z",
    sessionKind: "WAITING",
    reason: "Synthetic passive waiting fixture",
  });
  await post(gamer, "effort-create", {
    ticketId: repeat,
    startedAt: "2026-10-21T01:00:00Z",
    endedAt: "2026-10-21T02:00:00Z",
    sessionKind: "ACTIVE",
    reason: "Synthetic repeat investigation fixture",
  });
  await post(
    gamer,
    "effort-create",
    { ...body, idempotencyKey: randomUUID(), ticketId: repeat },
    409,
  );
  await post(
    peer,
    "effort-create",
    { ...body, idempotencyKey: randomUUID() },
    404,
  );
  await post(
    gamer,
    "effort-create",
    { ...body, idempotencyKey: randomUUID(), endedAt: "2026-10-20T00:00:00Z" },
    400,
  );
  for (const id of [original, repeat]) {
    await post(cc, "ticket-classify", {
      ticketId: id,
      category: "EXPERIENCE",
      tags: ["synthetic"],
      reason: "Synthetic acceptance classification",
    });
    await post(cc, "ticket-assign", {
      ticketId: id,
      userId: mc,
      reason: "Synthetic acceptance assignment",
    });
  }
  await post(gamer, "comparison-link", {
    originalTicketId: original,
    repeatTicketId: repeat,
    rationale: "Same duplicated message failure and recovery",
    technology: "Synthetic queue v1",
    difficulty: "Equivalent scope and workload",
    environment: "Same isolated test environment",
    aiUse: "No AI used in either fixture",
    humanGuidance: "Same guidance available",
    evidence: "Synthetic AT16–AT20 fixture references",
  });
  let state = await read(cc);
  let comparison = state.effort.comparisons.find(
    (r) => r.repeatTicketId === repeat,
  );
  assert.equal(comparison.originalMinutes, 420);
  assert.equal(comparison.repeatMinutes, 60);
  assert.equal(comparison.deltaMinutes, 360);
  assert.equal(comparison.status, "PENDING");
  const review = () => ({
    comparisonId: comparison._id,
    version: comparison.version,
    status: "VERIFIED",
    comparabilityConfirmed: true,
    reason: "Confirmed synthetic equivalent complexity and assistance",
  });
  await post(gamer, "comparison-review", review(), 403);
  await post(mc, "comparison-review", review(), 403);
  await post(cc, "comparison-policy", {
    reviewerIds: [mc],
    reason: "Delegate review for synthetic acceptance",
  });
  await post(mc, "comparison-review", review());
  await post(gamer, "attempt", {
    ticketId: original,
    approach: "Synthetic unsuccessful investigation approach",
    rationale: "Synthetic hypothesis tested and disproved",
    result: "UNSUCCESSFUL",
    artifact: "fixture:failed",
  });
  await post(gamer, "attempt", {
    ticketId: original,
    approach: "Synthetic successful recovery approach",
    rationale: "Synthetic recovery verified against evidence",
    result: "SUCCESSFUL",
    artifact: "fixture:success",
  });
  const attempt = (await read(mc)).attempts.find(
    (a) => a.ticketId === original && a.result === "SUCCESSFUL",
  );
  await post(mc, "attempt-verify", {
    ticketId: original,
    attemptId: attempt._id,
    reason: "Verified synthetic successful recovery evidence",
  });
  await post(mc, "ticket-response", {
    ticketId: original,
    guidance:
      "Synthetic substantive guidance with concrete recovery next action",
  });
  await post(mc, "ticket-state", {
    ticketId: original,
    state: "RESOLVED",
    reason: "Verified synthetic recovery complete",
  });
  const content = {
    title: "Synthetic redacted comparison case",
    cause: "Synthetic duplicate message cause",
    unsuccessful: "Synthetic failed approach did not deduplicate",
    successful: "Synthetic successful recovery deduplicated",
    applicability: "Equivalent isolated queue tasks only",
    prerequisites: "Synthetic queue v1 environment",
    anonymisation: "Removed all names and private institutional data",
    validationEvidence: "Synthetic successful attempt reviewed by assigned MC",
  };
  await post(cc, "case-draft", { ticketId: original, ...content });
  const caseId = (await read(cc)).cases.find(
    (c) => c.ticketId === original,
  )._id;
  await post(cc, "case-comparison", {
    caseId,
    comparisonId: comparison._id,
    reason: "Reviewed synthetic comparison source and redaction",
  });
  await post(cc, "case-publish", {
    caseId,
    redactionConfirmed: true,
    resolutionConfirmed: true,
    reason: "Human review confirms synthetic case publication",
  });
  const publicCase = (await read(peer)).cases.find((c) => c._id === caseId);
  assert.equal(publicCase.comparisonSummary.deltaMinutes, 360);
  assert.equal(publicCase.ticketId, undefined);
  assert.equal(publicCase.comparisonId, undefined);
  let exported = await request(cc, "support/comparisons/export");
  assert.equal(exported.totals.sampleCount, 1);
  assert.equal(exported.totals.deltaMinutes, 360);
  assert.equal((await read(peer)).effort.sessions.length, 0);
  assert.equal((await read(peer)).effort.comparisons.length, 0);
  await request(gamer, "support/comparisons/export", null, 403);
  // A second credential session sees the same persisted effort, without browser storage.
  assert.equal(
    (await read("password-test")).effort.sessions.filter(
      (s) => s.ticketId === original,
    ).length,
    3,
  );
  state = await read(gamer);
  const session = state.effort.sessions.find((s) => s.ticketId === repeat);
  await post(gamer, "effort-update", {
    ticketId: repeat,
    sessionId: session._id,
    version: session.version,
    startedAt: session.startedAt,
    endedAt: "2026-10-21T09:00:00Z",
    sessionKind: "ACTIVE",
    reason: "Synthetic correction makes repeat longer than original",
  });
  comparison = (await read(cc)).effort.comparisons.find(
    (r) => r._id === comparison._id,
  );
  assert.equal(comparison.status, "PENDING");
  assert.equal(comparison.deltaMinutes, -60);
  assert.equal(
    (await read(peer)).cases.find((c) => c._id === caseId).comparisonSummary,
    null,
  );
  assert.equal(
    (await request(cc, "support/comparisons/export")).comparisons.length,
    0,
  );
  await post(mc, "comparison-review", review());
  exported = await request(
    cc,
    "support/comparisons/export?technology=queue&umbrella=EXPERIENCE",
  );
  assert.equal(exported.totals.deltaMinutes, -60);
  assert.equal(
    (await read(peer)).cases.find((c) => c._id === caseId).comparisonSummary,
    null,
  );
  comparison = (await read(cc)).effort.comparisons.find(
    (r) => r._id === comparison._id,
  );
  await post(cc, "comparison-review", {
    ...review(),
    status: "REJECTED",
    reason:
      "Synthetic rejection example: complexity not sufficiently evidenced",
  });
  exported = await request(cc, "support/comparisons/export");
  assert.equal(exported.totals.rejectedCount, 1);
  assert.equal(exported.comparisons.length, 0);
  await post(gamer, "effort-start", {
    ticketId: repeat,
    sessionKind: "BLOCKED",
    reason: "Synthetic timer excluded from active effort",
  });
  let timer = (await read(gamer)).effort.sessions.find((s) => !s.endedAt);
  await post(
    gamer,
    "effort-start",
    {
      ticketId: original,
      sessionKind: "ACTIVE",
      reason: "Overlapping timer must be denied",
    },
    409,
  );
  await post(gamer, "effort-stop", {
    ticketId: repeat,
    sessionId: timer._id,
    version: timer.version,
    reason: "Stop blocked timer synthetic fixture",
  });
  timer = (await read(gamer)).effort.sessions.find((s) => s._id === timer._id);
  await post(gamer, "effort-delete", {
    ticketId: repeat,
    sessionId: timer._id,
    version: timer.version,
    reason: "Remove synthetic blocked period with audit",
  });
  assert.ok(
    (await models.SupportEvent.find({ ticketId: repeat }).lean()).some(
      (e) => e.kind === "COMPARISON_INVALIDATED",
    ),
  );
  console.log(
    "PASS AT16–AT20: synthetic +360/-60, cross-session persistence, concurrent idempotency, learner overlaps, delegated reviews, rejection, correction invalidation, timers and API privacy",
  );
}

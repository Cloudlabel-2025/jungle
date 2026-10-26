import assert from "node:assert/strict";
import { models } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";

// Runs inside the acceptance runner's disposable database and production server.
export async function supportAcceptance(request, personas) {
  const gamer = "usr_g01",
    peer = "usr_g02",
    other = "usr_g06",
    mc = "usr_mc01",
    cc = "usr_cc01",
    cc2 = "usr_cc02";
  const post = (who, action, body, status = 200) =>
    request(who, `support/${action}`, body, status);
  const read = (who) => request(who, "support");
  await models.Credential.create({
    _id: gamer,
    passwordHash: await hashPassword("test-passphrase-123"),
  });
  await request(
    "password-test",
    "auth/login",
    { email: personas.find((p) => p._id === gamer).email, password: "wrong" },
    401,
  );
  await request("password-test", "auth/login", {
    email: personas.find((p) => p._id === gamer).email,
    password: "test-passphrase-123",
  });
  assert.equal((await request("password-test", "auth/me")).user._id, gamer);
  await models.User.updateOne({ _id: gamer }, { $set: { active: false } });
  await request("password-test", "support", null, 401);
  await request(
    "password-test",
    "auth/login",
    {
      email: personas.find((p) => p._id === gamer).email,
      password: "test-passphrase-123",
    },
    401,
  );
  await models.User.updateOne({ _id: gamer }, { $set: { active: true } });
  for (let i = 0; i < 5; i++)
    await request(
      "password-test",
      "auth/login",
      {
        email: personas.find((p) => p._id === gamer).email,
        password: "incorrect-password",
      },
      401,
    );
  await request(
    "password-test",
    "auth/login",
    {
      email: personas.find((p) => p._id === gamer).email,
      password: "test-passphrase-123",
    },
    401,
  );
  await models.Credential.updateOne(
    { _id: gamer },
    { $set: { failures: 0, lockedUntil: null } },
  );
  await post(cc, "calendar", {
    calendar: {
      timeZone: "Asia/Kolkata",
      startMinute: 540,
      weekdays: [1, 2, 3, 4, 5],
      holidays: ["2026-10-27"],
    },
  });
  await post(gamer, "calendar", { calendar: {} }, 403);
  await post(cc, "discovery-prompt", {
    prompt:
      "Investigate an unfamiliar event-driven queue. Explain failure handling and verify any AI guidance.",
  });
  for (const p of personas.filter((p) => p.role === "GAMER"))
    await post(p._id, "baseline", {
      priorExposure: "No prior exposure to message queues",
      activity: "Built a small experiment with retries",
      helpUsed:
        "Asked MC and verified AI suggestions against a runnable example",
      reflection:
        "Observed duplicate messages and reasoned about idempotent consumers.",
    });
  const own = (await read(gamer)).baselines;
  assert.equal(own.length, 1);
  assert.equal((await read(mc)).baselines.length, 25);
  await post(mc, "baseline-review", {
    baselineId: own[0]._id,
    reasoning: "Tested a duplicate-delivery hypothesis with explicit evidence.",
    notes:
      "Descriptive baseline only; continue observing independent verification.",
  });
  await post(
    gamer,
    "baseline-review",
    { baselineId: own[0]._id, reasoning: "x", notes: "x" },
    403,
  );
  await post(
    gamer,
    "ticket-create",
    {
      description:
        "My unfamiliar queue consumer processes the same event twice.",
      taskId: "quest_1_0",
    },
    403,
  );
  await post(gamer, "ticket-create", {
    description: "My unfamiliar queue consumer processes the same event twice.",
    taskId: "quest_0_0",
  });
  const ticket = (await read(gamer)).tickets[0],
    ticketId = ticket._id;
  assert.equal(ticket.category, null);
  assert.equal(ticket.dueAt, undefined);
  assert.equal((await read(mc)).tickets.length, 0);
  assert.equal((await read(peer)).tickets.length, 0);
  assert.equal((await read(other)).tickets.length, 0);
  await post(
    peer,
    "attempt",
    {
      ticketId,
      approach: "An unauthorised private read",
      rationale: "No permission",
      result: "SUCCESSFUL",
      artifact: "x",
    },
    404,
  );
  await post(
    gamer,
    "ticket-classify",
    {
      ticketId,
      category: "EXPERIENCE",
      tags: [],
      reason: "Student cannot classify",
    },
    403,
  );
  await post(cc, "ticket-classify", {
    ticketId,
    category: "EXPERIENCE",
    tags: ["queue"],
    reason: "Initial operational support assessment",
  });
  await post(cc, "ticket-classify", {
    ticketId,
    category: "COGNITION",
    tags: ["queue", "idempotency"],
    reason: "Corrected after reviewing the stated learning support need",
  });
  await post(cc, "ticket-assign", {
    ticketId,
    userId: mc,
    reason: "MC will support the next investigation",
  });
  let assigned = (await read(mc)).tickets[0];
  await post(mc, "ticket-acknowledge", { ticketId });
  assert.equal((await read(mc)).tickets[0].firstResponseAt, undefined);
  // Simulate an overdue obligation; reassignment must preserve it.
  const originalDue = new Date(Date.now() - 120000);
  await models.HelpTicket.updateOne(
    { _id: ticketId },
    { $set: { dueAt: originalDue } },
  );
  await post(cc, "ticket-assign", {
    ticketId,
    userId: cc2,
    reason: "Reassign without restarting the customer SLA",
  });
  const reassigned = (await read(cc2)).tickets[0];
  assert.equal(reassigned.dueAt, originalDue.toISOString());
  assert.equal(reassigned.assignedAt, assigned.assignedAt);
  assert.ok(reassigned.breachedAt && reassigned.escalated);
  assert.equal((await read(mc)).tickets.length, 0);
  await post(cc, "ticket-assign", {
    ticketId,
    userId: mc,
    reason: "Return to MC for the practical coaching session",
  });
  await post(mc, "ticket-response", {
    ticketId,
    guidance:
      "Add a stable event key and verify duplicate delivery with the attached test. Meet at 10:00 IST tomorrow.",
  });
  const firstResponse = (await read(mc)).tickets[0].firstResponseAt;
  for (const kind of ["INT01", "INT02", "INT03", "INT04", "INT05", "INT06"])
    await post(cc, "intervention", {
      ticketId,
      kind,
      performerId: ["INT02", "INT04"].includes(kind) ? cc : mc,
      plannedAt: "2026-10-28T10:00:00+05:30",
      actualAt: "2026-10-28T10:05:00+05:30",
      guidance:
        "Human-led guidance: inspect event keys and verify duplicate handling.",
      outcome: "Student will run and record a duplicate-delivery experiment.",
      artifact: "training-evidence/session-1",
    });
  await post(gamer, "attempt", {
    ticketId,
    approach: "Retried the entire operation without a stable key",
    rationale: "Expected retries to repair the problem automatically",
    result: "UNSUCCESSFUL",
    artifact: "evidence/failed-retry",
  });
  await post(gamer, "attempt", {
    ticketId,
    approach: "Used an atomic unique event key to reject duplicate work",
    rationale: "A stable unique event key identifies the same operation",
    result: "SUCCESSFUL",
    artifact: "evidence/unique-key-test",
  });
  const attempt = (await read(mc)).attempts.find(
    (a) => a.result === "SUCCESSFUL",
  );
  await post(
    mc,
    "ticket-state",
    { ticketId, state: "RESOLVED", reason: "Attempt is not verified yet" },
    400,
  );
  await post(mc, "attempt-verify", {
    ticketId,
    attemptId: attempt._id,
    reason:
      "Reproduced the duplicate event test and verified one persisted operation",
  });
  await post(mc, "issue", {
    ticketId,
    symptom: "Duplicate queue messages caused duplicate work",
    cause: "Missing idempotency key",
  });
  await post(mc, "ticket-state", {
    ticketId,
    state: "RESOLVED",
    reason: "Verified atomic uniqueness with recovery evidence",
  });
  const content = {
    title: "Recovering from duplicate message delivery",
    cause: "Repeated messages were missing an atomic deduplication guard.",
    unsuccessful: "Retrying without a stable event key repeated the operation.",
    successful:
      "An atomic unique event key prevented duplicate persisted work.",
    applicability:
      "Use for at-least-once delivery with stable message identifiers.",
    prerequisites:
      "A transactional database and a durable event identifier are required.",
    anonymisation:
      "Removed all student, college, client identifiers and private reflections.",
    validationEvidence:
      "Reviewer reproduced the test in a separate training environment.",
  };
  await post(cc, "case-draft", { ticketId, ...content });
  assert.equal((await read(gamer)).cases.length, 0);
  const entry = (await read(cc)).cases[0];
  await post(gamer, "case-publish", { caseId: entry._id }, 403);
  await post(
    cc,
    "case-publish",
    {
      caseId: entry._id,
      reason: "Reviewed all case statements against source evidence",
      redactionConfirmed: false,
      resolutionConfirmed: true,
    },
    400,
  );
  await post(cc, "case-publish", {
    caseId: entry._id,
    reason: "Reviewed redaction and verified recovery evidence",
    redactionConfirmed: true,
    resolutionConfirmed: true,
  });
  const publicCase = (await read(other)).cases[0];
  assert.ok(publicCase.content.successful && publicCase.content.unsuccessful);
  assert.equal(publicCase.ticketId, undefined);
  assert.equal(publicCase.content.validationEvidence, undefined);
  assert.equal((await read(other)).tickets.length, 0);
  await post(mc, "growth-propose", {
    userId: gamer,
    strengths: "Investigates duplicate delivery with a reproducible test",
    unobserved: "Architecture at larger scale remains unobserved",
    trajectory: "Recovered from retry assumptions with evidence",
    support: "MC coaching and AI guidance were explicitly verified",
    pathway: "Continue exploring reliable backend systems",
    comparison:
      "Later queue task had comparable complexity and the same opportunity to test",
    evidenceIds: [own[0]._id, ticketId, "quest_0_4"],
    scores: [80, null, 70, 90],
  });
  assert.equal((await read(gamer)).growth.length, 0);
  const report = (await read(cc)).growth[0];
  assert.equal(report.total, null);
  await post(cc, "growth-validate", { reportId: report._id });
  assert.equal((await read(gamer)).growth.length, 1);
  assert.equal((await read(peer)).growth.length, 0);
  await post(gamer, "growth-correction", {
    reportId: report._id,
    reason:
      "Please include my second verification experiment in the comparison",
  });
  await post(gamer, "ticket-state", {
    ticketId,
    state: "IN_PROGRESS",
    reason: "The duplicate delivery recurred in the next test run",
  });
  assigned = (await read(mc)).tickets[0];
  assert.equal(assigned.firstResponseAt, firstResponse);
  assert.equal(assigned.dueAt, originalDue.toISOString());
  const result = await read(cc);
  assert.equal(result.interventions.length, 6);
  assert.equal(result.events.filter((e) => e.kind === "CLASSIFIED").length, 2);
  assert.ok(result.events.some((e) => e.kind === "RECOVERY_VERIFIED"));
  assert.equal(result.issues.length, 1);
  assert.equal(result.caseVersions.length, 2);
  await request(gamer, "support/export", null, 403);
  const exported = await request(cc, "support/export");
  assert.equal(exported.tickets[0]._id, ticketId);
  await post(cc, "case-revise", {
    caseId: entry._id,
    ...content,
    cause: "Corrected cause explanation after another human review.",
    reason: "Clarified the exact prerequisite for atomic deduplication",
  });
  assert.equal((await read(gamer)).cases.length, 0);
  await post(cc, "case-withdraw", {
    caseId: entry._id,
    reason: "Withdraw pending a further operational review",
  });
  console.log(
    "PASS V2: 25 descriptive baselines, credential sign-in, private support chain, all 6 interventions, SLA preservation, case moderation and growth review",
  );
}

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { seed } from "../lib/seed.js";
import { models } from "../lib/db.js";
import { modules, personas, navigation, prefix } from "../lib/catalog.js";
import { initialFiles } from "../lib/lab-project.js";
import { stopNext } from "./dev-runtime.mjs";
import { supportAcceptance } from "./support-acceptance.mjs";
import { challengeAcceptance } from "./challenge-acceptance.mjs";

if (!process.env.TEST_MONGODB_URI)
  throw new Error("Set TEST_MONGODB_URI to a running replica set.");
const database = `codewild_acceptance_${Date.now()}`;
const uri = new URL(process.env.TEST_MONGODB_URI);
uri.pathname = `/${database}`;
process.env.MONGODB_URI = uri.toString();
process.env.SESSION_SECRET = randomBytes(48).toString("hex");
process.env.DEMO_MODE = "true";
process.env.DEMO_ACCESS_CODE = randomBytes(24).toString("hex");
process.env.APP_ORIGIN = "http://127.0.0.1:3001";
const base = process.env.APP_ORIGIN;
let server;
let serverLog = "";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cookies = new Map();
async function request(who, path, body, status = 200) {
  const response = await fetch(base + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
      ...(cookies.has(who) ? { cookie: cookies.get(who) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie) cookies.set(who, cookie.split(";")[0]);
  const type = response.headers.get("content-type") || "";
  const result = type.includes("json")
    ? await response.json()
    : await response.text();
  assert.equal(
    response.status,
    status,
    `${who}: ${path}: ${JSON.stringify(result)}`,
  );
  return result;
}
async function login(who) {
  return request(who, "auth/login", {
    email: personas.find((p) => p._id === who).email,
    accessCode: process.env.DEMO_ACCESS_CODE,
  });
}
try {
  await seed();
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3001",
    ],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (b) => {
    serverLog += b.toString();
  });
  server.stderr.on("data", (b) => {
    serverLog += b.toString();
  });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const r = await fetch(base + "/api/auth/me");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(500);
  }
  assert.ok(ready, `Production test server did not start. ${serverLog}`);
  await request("anonymous", "state", null, 401);
  const denied = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.invalid",
    },
    body: JSON.stringify({ email: personas[0].email }),
  });
  assert.equal(denied.status, 403);
  await request(
    "wrong-code",
    "auth/login",
    { email: personas[0].email, accessCode: "wrong" },
    401,
  );
  const gamer = "usr_g01",
    commander = "usr_mc01",
    lead1 = "usr_cc01",
    lead2 = "usr_cc02",
    lead3 = "usr_cc03";
  for (const who of [gamer, commander, lead1, lead2, lead3]) await login(who);
  for (const persona of personas) {
    await login(persona._id);
    const data = await request(persona._id, "state");
    assert.equal(data.user._id, persona._id);
    assert.equal(data.user.role, persona.role);
    assert.equal(data.user.teamId, persona.teamId);
    if (persona.role === "GAMER") {
      assert.ok(data.tasks.every((t) => t.teamId === persona.teamId));
      assert.ok(data.roster.every((p) => p.teamId === persona.teamId));
      assert.deepEqual(data.leaderboard, []);
      assert.equal(data.rankingPaused, true);
      assert.equal(data.coaching.length, 0);
      assert.ok(data.journals.every((j) => j.userId === persona._id));
    }
  }
  console.log(
    "PASS all 29 personas, role identities, squad isolation and private data scope",
  );
  for (const who of [gamer, commander, lead1]) {
    const data = await request(who, "state");
    assert.equal(data.roster.length, who === gamer ? 5 : 25);
    assert.equal(data.teams.length, 5);
    assert.equal(data.modules.length, 10);
    assert.equal(data.perks.length, 13);
    assert.equal(data.rules.length, 19);
    for (const [, screen] of navigation[data.user.role]) {
      const r = await fetch(`${base}/${prefix(data.user.role)}/${screen}`, {
        headers: { cookie: cookies.get(who) },
      });
      assert.equal(r.status, 200);
    }
  }
  console.log(
    "PASS production routes, origin checks, arena access code and role sessions",
  );
  await supportAcceptance(request, personas);
  await request(commander, "commander/coaching", {
    userId: gamer,
    standupRating: 4,
    notes: "Focused standup feedback with a clear next action.",
  });
  assert.equal((await request(commander, "state")).coaching.length, 1);
  assert.equal((await request(gamer, "state")).coaching.length, 0);
  await request(
    commander,
    "commander/task",
    { taskId: "quest_0_0", action: "reassign", userId: "usr_g06" },
    400,
  );
  await request(commander, "commander/task", {
    taskId: "quest_0_0",
    action: "reassign",
    userId: "usr_g05",
  });
  await request(commander, "commander/task", {
    taskId: "quest_0_0",
    action: "reassign",
    userId: "usr_g02",
  });
  await request(lead1, "centre-command/roster", {
    userId: "usr_g25",
    teamId: "team_04",
  });
  assert.equal((await request("usr_g25", "state")).user.teamId, "team_04");
  await request(lead1, "centre-command/roster", {
    userId: "usr_g25",
    teamId: "team_05",
  });
  console.log(
    "PASS private coaching, constrained quest reassignment and squad reallocation",
  );
  await request(gamer, "commander/rules", {}, 403);
  await request(commander, "centre-command/approvals", {}, 403);
  await request(
    gamer,
    "gamer/modules",
    { moduleId: "module_1", answer: 0 },
    400,
  );
  for (const module of modules)
    await request(gamer, "gamer/modules", {
      moduleId: module._id,
      answer: module.answer,
    });
  await request(
    gamer,
    "gamer/modules",
    { moduleId: "module_1", answer: 1 },
    409,
  );
  let state = await request(gamer, "state");
  assert.equal(state.user.xp, 150);
  assert.equal(state.progress.length, 10);
  assert.equal(state.user.trophies, 50);
  assert.ok(state.leaderboard.every((p) => !("xp" in p)));
  for (const task of state.tasks.filter((t) => t.assigneeId === gamer)) {
    await request(gamer, "gamer/task-status", {
      taskId: task._id,
      status: "Review",
      preDeadlineStatus: "Complete",
    });
    await request(commander, "commander/task", {
      taskId: task._id,
      action: "approve",
    });
    await request(
      commander,
      "commander/task",
      { taskId: task._id, action: "approve" },
      400,
    );
  }
  state = await request(gamer, "state");
  assert.equal(state.user.xp, 150);
  assert.ok(
    state.tasks
      .filter((t) => t.assigneeId === gamer)
      .every((t) => t.reportedAt && t.status === "Done"),
  );
  await request(lead1, "centre-command/clearance", {
    userId: gamer,
    competency: 5,
  });
  console.log(
    "PASS foundation verification, immutable completion, quest reports, review, daily XP cap and certificate clearance",
  );
  await request(gamer, "gamer/clock-in", {
    latenessReason: "Acceptance test shift attendance.",
  });
  await request(
    gamer,
    "gamer/clock-in",
    { latenessReason: "Acceptance test duplicate attendance." },
    409,
  );
  const journal = {
    workDone: "Completed the banking portal integration.",
    learnings: "Verified atomic transaction handling.",
    blockers: "",
    tomorrowPlan: "Deliver the reviewed ledger endpoint.",
    supportTicketId: (await request(gamer, "support")).tickets[0]._id,
  };
  await request("usr_g02", "gamer/journal", journal, 403);
  await request(gamer, "gamer/journal", journal);
  assert.deepEqual(
    (await request(gamer, "state")).journals[0].supportTicketIds,
    [journal.supportTicketId],
  );
  await request(gamer, "gamer/journal", journal, 409);
  await request(gamer, "gamer/messages", {
    message: "Need a review of ledger invariants.",
    isBlocker: true,
  });
  state = await request(commander, "state");
  const blocker = state.messages.find((m) => m.isBlocker);
  assert.ok(blocker);
  await request(commander, "commander/blocker", { messageId: blocker._id });
  await request(gamer, "gamer/lab", { files: initialFiles });
  assert.deepEqual((await request(gamer, "gamer/lab")).files, initialFiles);
  console.log(
    "PASS attendance idempotency, sealed journal, squad blocker resolution and saved virtual project",
  );
  await request(commander, "commander/proposals", {
    recipientId: gamer,
    perkId: "perk_1",
    rationale: "Consistent ownership of the banking portal delivery.",
  });
  state = await request(lead1, "state");
  const proposal = state.proposals[0];
  await request(lead1, "centre-command/approvals", {
    proposalId: proposal._id,
    action: "APPROVE",
  });
  await request(
    lead1,
    "centre-command/approvals",
    { proposalId: proposal._id, action: "APPROVE" },
    409,
  );
  assert.equal(
    (await request(lead2, "state")).proposals[0].status,
    "PENDING_APPROVAL",
  );
  await request(lead2, "centre-command/approvals", {
    proposalId: proposal._id,
    action: "APPROVE",
  });
  assert.equal((await request(gamer, "state")).proposals[0].status, "APPROVED");
  await request(lead1, "centre-command/override", {
    recipientId: gamer,
    kind: "XP_OVERRIDE",
    amount: 50,
    rationale: "Documented exceptional effort; daily cap must remain enforced.",
  });
  const xpOverride = (await request(lead1, "state")).proposals.find(
    (p) => p.kind === "XP_OVERRIDE",
  );
  for (const who of [lead2, lead3])
    await request(who, "centre-command/approvals", {
      proposalId: xpOverride._id,
      action: "APPROVE",
    });
  assert.equal((await request(gamer, "state")).user.xp, 150);
  const target = "usr_g02";
  for (let i = 0; i < 5; i++)
    await request(commander, "commander/rules", {
      userId: target,
      ruleId: 10,
      notes: "Acceptance test: documented communication infraction.",
      eventKey: `acceptance-hp-event-${i}`,
    });
  await request(commander, "commander/rules", {
    userId: target,
    ruleId: 10,
    notes: "Retry of the same documented event.",
    eventKey: "acceptance-hp-event-4",
  });
  state = await request(commander, "state");
  assert.equal(state.roster.find((u) => u._id === target).hp, 0);
  const rescue = state.rescues.find((r) => r.userId === target);
  assert.ok(rescue);
  await request(commander, "commander/rescue", {
    rescueId: rescue._id,
    plan: "Pair daily with a mentor and submit status reports before every quest deadline.",
  });
  await request(lead1, "centre-command/override", {
    recipientId: target,
    kind: "HP_OVERRIDE",
    amount: 2,
    rationale:
      "Restore energy after a verified exceptional infrastructure outage.",
  });
  state = await request(lead1, "state");
  const override = state.proposals.find((p) => p.kind === "HP_OVERRIDE");
  await request(
    lead1,
    "centre-command/approvals",
    { proposalId: override._id, action: "APPROVE" },
    409,
  );
  for (const who of [lead2, lead3])
    await request(who, "centre-command/approvals", {
      proposalId: override._id,
      action: "APPROVE",
    });
  state = await request(lead1, "state");
  assert.equal(state.roster.find((u) => u._id === target).hp, 2);
  console.log(
    "PASS distinct approval seals, self-approval rejection, exact HP deductions, rescue plan and emergency override",
  );
  await request(
    lead1,
    "centre-command/client-control",
    {
      title: "Revised audit criteria",
      description: "Add a tamper-evident receipt to every successful transfer.",
      disruptionType: "Compliance update",
    },
    409,
  );
  state = await request(lead1, "state");
  const config = { ...state.cohort, currentWeek: 3 };
  await request(lead1, "centre-command/setup", config);
  await request(lead1, "centre-command/setup", config, 409);
  await request(lead1, "centre-command/client-control", {
    title: "Revised audit criteria",
    description: "Add a tamper-evident receipt to every successful transfer.",
    disruptionType: "Compliance update",
  });
  const event = (await request(gamer, "state")).events[0];
  await login("usr_g06");
  assert.equal((await request("usr_g06", "state")).events[0]._id, event._id);
  await request(lead1, "centre-command/rules", {
    text: "Document every disruption response with an owner and acceptance criteria.",
  });
  const csv = await request(lead1, "centre-command/reports?format=csv");
  assert.match(csv, /Emergency|communication infraction/);
  await challengeAcceptance(request);
  await request(gamer, "auth/logout", {});
  await request(gamer, "state", null, 401);
  console.log(
    "PASS week-three disruption gate, configuration concurrency, shared broadcasts, rule versions, CSV export and logout",
  );
  console.log("ALL ACCEPTANCE CHECKS PASSED against the production build.");
} catch (error) {
  console.error(serverLog.slice(-5000));
  throw error;
} finally {
  await stopNext(server);
  if (mongoose.connection.readyState === 1) {
    assert.match(mongoose.connection.name, /^codewild_acceptance_\d+$/);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

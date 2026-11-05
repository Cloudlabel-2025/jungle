import { randomUUID, randomInt } from "node:crypto";
import { models, connect, transaction } from "./db.js";
import {
  cohortOf,
  tenantOf,
  scope,
  demand,
  permitted,
  typedIds,
} from "./access-scope.js";
import {
  text,
  number,
  hash,
  day,
  validateCalendar,
  workingAt,
  working,
  graph,
  cap,
  stages,
} from "./pilot-rules.js";
import manifests from "./pilot-manifests.json" with { type: "json" };
import { rosterDigest } from "./recovery.js";
import { criteria as defaultCriteria } from "./week-one-catalog.js";
import { parseCsv } from "./pilot-assessment.js";
const CC = "CENTRE_COMMAND",
  MC = "MISSION_COMMANDER",
  G = "GAMER";
const clone = (x) => JSON.parse(JSON.stringify(x));
export const storageProof = Symbol("verified-private-storage");
const model = (k) => models[`Pilot${k}`];
const find = (k, q, session) =>
  model(k)
    .find(q)
    .session(session || null)
    .lean();
const one = (k, q, session) =>
  model(k)
    .findOne(q)
    .session(session || null)
    .lean();
async function put(k, row, session) {
  await model(k).replaceOne({ _id: row._id }, row, { upsert: true, session });
  return row;
}
const iso = (x) => {
  demand(
    typeof x === "string" &&
      /(Z|[+-]\d\d:\d\d)$/.test(x) &&
      Number.isFinite(Date.parse(x)),
    "Timestamp with explicit timezone required.",
    400,
  );
  return new Date(x).toISOString();
};
const url = (x) => {
  const v = text(x, "Evidence URL", 8, 2000);
  demand(new URL(v).protocol === "https:", "Use an HTTPS evidence URL.", 400);
  return v;
};
const staff = (u) => demand([CC, MC].includes(u.role));
const centre = (u) => {
  demand(u.role === CC);
  demand(permitted(u, "sprint:write"), "Sprint permission required.");
};
const allowed = (u, t) =>
  u.role === CC ||
  (u.role === MC ? t.commanderId === u._id : t.members.includes(u._id));
function team(s, u, id) {
  const t = s.data.teams.find((t) => t.teamId === id);
  demand(t && allowed(u, t));
  return t;
}
function active(s, t, now) {
  demand(
    t.kickoff &&
      now >= new Date(s.data.kickoffEnd) &&
      !["CLOSED", "NOT_ACCEPTED"].includes(s.state),
    "The approved sprint kickoff is not complete.",
    409,
  );
}
function expectedReviewer(s, t, owner) {
  return t.leaderId === owner ? t.commanderId : t.leaderId;
}
function rubric(rows) {
  demand(
    Array.isArray(rows) &&
      rows.length === 13 &&
      new Set(rows.map((r) => r.key)).size === 13,
    "Thirteen approved criterion rows required.",
    400,
  );
  const out = defaultCriteria.map((c) => ({
    ...c,
    weight: number(rows.find((r) => r.key === c.key)?.weight, 0.01, 40),
  }));
  for (const area of new Set(out.map((c) => c.area)))
    demand(
      out.filter((c) => c.area === area).reduce((n, c) => n + c.weight, 0) ===
        defaultCriteria
          .filter((c) => c.area === area)
          .reduce((n, c) => n + c.weight, 0),
      "Preserve the 40/20/25/15 totals.",
      400,
    );
  return out;
}
function manifest(config) {
  const n = config.number;
  demand(
    Number.isInteger(n) && n >= 1 && n <= 5,
    "Sprint number must be 1–5.",
    400,
  );
  if (n <= 2) {
    const m = clone(manifests.sprints[n - 1]);
    if (config.template)
      demand(
        hash(config.template) === hash(m),
        "Frozen task content may not be changed silently.",
        400,
      );
    return m;
  }
  text(config.contentApproval, "Future sprint approval");
  demand(
    config.template?.tasks?.length > 0 && config.template.tasks.length <= 40,
    "Approved future task content required.",
    400,
  );
  graph(config.template.tasks);
  for (const t of config.template.tasks) {
    text(t.title, "Task title", 3, 200);
    demand(
      "ABCDE".includes(t.owner) && t.owner.length === 1,
      "Explicit role owner required.",
      400,
    );
  }
  return clone(config.template);
}
async function event(ctx, kind, data, id = randomUUID()) {
  return put(
    "Event",
    {
      _id: id,
      cohortId: ctx.cohortId,
      sprintId: ctx.s?._id,
      teamId: ctx.t?.teamId,
      userId: ctx.u._id,
      createdAt: ctx.now,
      state: kind,
      data,
    },
    ctx.session,
  );
}
async function ledger(ctx, kind, userId, data, eventKey) {
  const id = `${ctx.cohortId}:${kind}:${eventKey}`;
  const old = await one("Ledger", { _id: id }, ctx.session);
  if (old) return old;
  return put(
    "Ledger",
    {
      _id: id,
      cohortId: ctx.cohortId,
      sprintId: ctx.s?._id,
      teamId: ctx.t?.teamId,
      userId,
      createdAt: ctx.now,
      state: kind,
      data,
    },
    ctx.session,
  );
}
async function policy(ctx, kind, version, value) {
  text(version, "Policy version", 1, 70);
  const id = `${ctx.cohortId}:${kind}:${version}`,
    old = await one("Policy", { _id: id }, ctx.session);
  demand(
    !old || hash(old.data.value) === hash(value),
    "Published versions are immutable, including historical versions.",
    409,
  );
  if (!old)
    await put(
      "Policy",
      {
        _id: id,
        cohortId: ctx.cohortId,
        state: kind,
        createdAt: ctx.now,
        data: {
          version,
          value,
          approval: text(ctx.b.reason, "Approval reason"),
          by: ctx.u._id,
        },
      },
      ctx.session,
    );
  return id;
}
async function getTask(ctx, id) {
  demand(typeof id === "string", "Task ID required.", 400);
  const card = await one(
    "Task",
    { _id: id, cohortId: ctx.cohortId, sprintId: ctx.s._id },
    ctx.session,
  );
  demand(card, "Task not found.", 404);
  ctx.t = team(ctx.s, ctx.u, card.teamId);
  return card;
}
async function saveTask(ctx, card) {
  await model("Review").updateMany(
    {
      cohortId: ctx.cohortId,
      sprintId: ctx.s._id,
      "data.taskId": card._id,
      "data.kind": "APPEAL",
      state: "PENDING",
      "data.subjectHash": {
        $ne: hash({ evidence: card.data.evidence, stages: card.data.stages }),
      },
    },
    {
      $set: {
        state: "SUPERSEDED",
        "data.supersededAt": ctx.now,
        "data.supersededReason":
          "The task evidence changed after this reassessment was requested.",
      },
    },
    { session: ctx.session },
  );
  card.version++;
  return put("Task", card, ctx.session);
}
async function review(ctx, card, kind, reviewerId, hours, index) {
  const id = `${card._id}:${kind}:${card.version}`;
  return put(
    "Review",
    {
      _id: id,
      cohortId: ctx.cohortId,
      sprintId: ctx.s._id,
      teamId: card.teamId,
      userId: card.userId,
      state: "PENDING",
      createdAt: ctx.now,
      data: {
        taskId: card._id,
        kind,
        index,
        reviewerId,
        reviewerRole: reviewerId === card.userId ? CC : null,
        dueAt: workingAt(ctx.now, ctx.s.data.calendar, hours * 60),
        evidenceHash: hash(
          index !== undefined
            ? card.data.stages[index]
            : { evidence: card.data.evidence, stages: card.data.stages },
        ),
        history: [],
      },
    },
    ctx.session,
  );
}
async function deliveryEnergy(ctx, ...ids) {
  const records = await find(
    "Ledger",
    {
      cohortId: ctx.cohortId,
      userId: { $in: [...new Set(ids)] },
      state: "ENERGY",
    },
    ctx.session,
  );
  for (const id of ids) {
    const latest = records
      .filter((r) => r.userId === id)
      .sort((a, b) => (a.data.sequence || 0) - (b.data.sequence || 0))
      .at(-1);
    demand(!latest?.data.rescue, "Individual energy recovery is pending.", 409);
  }
}
async function guardWork(ctx, card, next) {
  const changesWork = Boolean(
    next ||
    ctx.b.stage !== undefined ||
    ctx.b.evidence ||
    ["upload-intent", "upload-complete"].includes(ctx.action),
  );
  const clients = await find(
    "Client",
    {
      cohortId: ctx.cohortId,
      sprintId: ctx.s._id,
      "data.pausedTaskId": card._id,
      state: "WORKING",
    },
    ctx.session,
  );
  demand(
    !changesWork || !clients.length,
    "Task is paused for an approved client change.",
    409,
  );
  if (changesWork) {
    await deliveryEnergy(ctx, card.userId, ctx.u._id);
  }
  if (next === "Working") {
    for (const code of card.data.depends) {
      const dep = await one(
        "Task",
        {
          cohortId: ctx.cohortId,
          sprintId: ctx.s._id,
          teamId: card.teamId,
          "data.code": code,
        },
        ctx.session,
      );
      demand(
        dep?.state === "Accepted",
        "Prerequisites must first be accepted.",
        409,
      );
      if (dep.userId !== card.userId) {
        const h = await one(
          "Handover",
          {
            cohortId: ctx.cohortId,
            sprintId: ctx.s._id,
            "data.from": dep._id,
            "data.to": card._id,
            "data.sourceAcceptedAt": dep.data.acceptedAt,
            state: "RECEIVED",
          },
          ctx.session,
        );
        demand(h, "Receive the current one-working-hour handover first.", 409);
      }
    }
    if (card.data.hours && card.data.hours <= 2)
      await put(
        "Notice",
        {
          _id: `${card._id}:short`,
          cohortId: ctx.cohortId,
          sprintId: ctx.s._id,
          teamId: card.teamId,
          userId: card.userId,
          state: "EXPECT_DELAY",
          createdAt: ctx.now,
          data: {
            taskId: card._id,
            text: "Expect delay? Confirm status at the start of this short task.",
          },
        },
        ctx.session,
      );
  }
  if (next === "In Review")
    for (const code of card.data.releaseGates || [])
      demand(
        (ctx.s.data.gates || []).some(
          (g) =>
            g.teamId === card.teamId &&
            g.code === code &&
            g.decision === "PASS",
        ),
        "Independent QA-06 and QA-08 release gates must pass.",
        409,
      );
}
async function validateConfig(ctx, c) {
  validateCalendar(c.calendar);
  c.kickoffStart = iso(c.kickoffStart);
  c.kickoffEnd = iso(c.kickoffEnd);
  c.dueAt = iso(c.dueAt);
  demand(
    new Date(c.dueAt) > new Date(c.kickoffEnd) &&
      new Date(c.kickoffEnd) >= new Date(c.kickoffStart),
    "Invalid sprint window.",
    400,
  );
  if (c.number === 1)
    demand(
      Date.parse(c.kickoffEnd) - Date.parse(c.kickoffStart) === 7200000,
      "Sprint 1 kickoff is the two-hour class.",
      400,
    );
  const m = manifest(c);
  graph(m.tasks);
  const p = await models.WeekOneProgram.findById(ctx.cohortId)
      .session(ctx.session)
      .lean(),
    pub = p?.data.publications?.at(-1),
    r = p?.data.recovery;
  demand(
    p?.data.locked &&
      !p.data.correction &&
      pub &&
      r?.published &&
      r.published.eligibleDigest === rosterDigest(r, pub),
    "Current human-confirmed recovery roster must be published and locked first.",
    409,
  );
  demand(
    Array.isArray(c.teams) && c.teams.length === r.published.teams.length,
    "Include every published team.",
    400,
  );
  const users = await models.User.find(tenantOf(ctx.u))
      .session(ctx.session)
      .lean(),
    seen = new Set();
  for (const t of c.teams) {
    const source = r.published.teams.find((x) => x.id === t.teamId);
    demand(
      source &&
        Array.isArray(t.members) &&
        hash([...t.members].sort()) === hash([...source.members].sort()),
      "Team membership must match the approved roster.",
      400,
    );
    demand(
      t.members.length >= 3 &&
        t.members.length <= 5 &&
        t.members.every(
          (id) =>
            !seen.has(id) &&
            users.some(
              (u) => u._id === id && u.role === G && u.active !== false,
            ),
        ),
      "Active teams of 3–5 actual Gamers required.",
      400,
    );
    t.members.forEach((id) => seen.add(id));
    demand(
      users.some(
        (u) => u._id === t.commanderId && u.role === MC && u.active !== false,
      ),
      "Active same-cohort MC required.",
      400,
    );
    demand(
      c.teams.filter((x) => x.commanderId === t.commanderId).length <= 5,
      "Maximum five teams per MC.",
      400,
    );
    text(t.rationale, "Allocation rationale");
    for (const task of m.tasks)
      demand(
        t.members.includes(t.owners?.[task.id]) ||
          (t.members.length < 5 && t.owners?.[task.id] === t.commanderId),
        "Explicit ownership, including approved Joker coverage, required.",
        400,
      );
    for (const task of m.tasks) {
      const resource = c.resources?.[task.id];
      demand(
        resource?.author === "CURRICULUM",
        "Curriculum-approved basic clues required for every task.",
        400,
      );
      url(resource.url);
      text(resource.approval, "Resource approval");
      text(resource.version, "Resource version", 1, 70);
    }
  }
  c.rosterDigest = hash(r.published);
  c.template = m;
  return c;
}
export async function pilotAction(actor, action, b = {}, now = new Date()) {
  await connect();
  typedIds(b);
  text(b.requestId, "Request ID", 8, 100);
  const requestHash = hash({ action, ...b });
  const cohortId = cohortOf(actor);
  return transaction(async (session) => {
    const cohortLock = await models.Cohort.updateOne(
      { _id: cohortId },
      { $inc: { accessRevision: 1 } },
      { session },
    );
    demand(
      cohortLock.matchedCount,
      "Configure the cohort before using the programme.",
      409,
    );
    const u = (await scope(actor, session)).user;
    demand(cohortOf(u) === cohortId);
    if (u.role === CC)
      demand(
        permitted(
          u,
          action === "access" ? "permissions:manage" : "sprint:write",
        ),
        "Outside delegated permissions.",
      );
    const replay = await one(
      "Event",
      { _id: `${cohortId}:request:${b.requestId}` },
      session,
    );
    if (replay) {
      demand(
        replay.userId === u._id,
        "Request IDs belong to their original authenticated actor.",
      );
      demand(
        replay.data.requestHash === requestHash,
        "Request ID already used for different content.",
        409,
      );
      return replay.data.result;
    }
    let s = await model("Sprint")
      .findOne({
        cohortId,
        ...(b.sprintId ? { _id: b.sprintId } : { state: { $ne: "CLOSED" } }),
      })
      .sort({ createdAt: -1 })
      .session(session)
      .lean();
    const ctx = { u, b, s, now, session, cohortId, action };
    let result = { success: true };
    if (action === "access") {
      centre({ ...u, permissions: undefined });
      text(b.reason, "Access approval");
      const target = await models.User.findOne({
        $and: [tenantOf(u), { _id: b.userId }],
      }).session(session);
      demand(target);
      if (b.permissions) {
        demand(
          target.role === CC &&
            target._id !== u._id &&
            Array.isArray(b.permissions) &&
            b.permissions.every(
              (p) =>
                [
                  "reports:read",
                  "roster:write",
                  "sprint:write",
                  "game:write",
                  "client:write",
                  "support:write",
                  "coaching:read",
                  "permissions:manage",
                ].includes(p) && permitted(u, p),
            ),
          "Valid explicit colleague permissions required.",
          400,
        );
        const before = target.permissions;
        target.permissions = b.permissions;
        await target.save({ session });
        await event(ctx, "ACCESS_CHANGED", {
          before,
          after: b.permissions,
          userId: target._id,
          reason: b.reason,
        });
      } else {
        demand(target.role === MC);
        const t = await models.Team.findOne({
          $and: [tenantOf(u), { _id: b.teamId }],
        }).session(session);
        demand(t);
        demand(
          !s?.data.teams.some((x) => x.teamId === t._id),
          "Loaded sprint assignments require an approved sprint amendment.",
          409,
        );
        demand(
          (await models.Team.countDocuments({
            cohortId,
            commanderId: target._id,
            _id: { $ne: t._id },
          }).session(session)) < 5,
          "Maximum five teams per MC.",
          409,
        );
        t.commanderId = target._id;
        await t.save({ session });
        await event(ctx, "ACCESS_CHANGED", {
          teamId: t._id,
          commanderId: target._id,
          reason: b.reason,
        });
      }
    } else if (action === "draft") {
      centre(u);
      demand(
        !s || s.state === "DRAFT",
        "Close the previous sprint before staging another.",
        409,
      );
      const c = await validateConfig(ctx, clone(b.config));
      const previous = await model("Sprint")
        .findOne({ cohortId, state: "CLOSED" })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();
      demand(
        c.number === (previous?.data.number || 0) + 1,
        "Load core sprints sequentially.",
        409,
      );
      s = await put(
        "Sprint",
        {
          _id: s?._id || randomUUID(),
          cohortId,
          state: "DRAFT",
          createdAt: s?.createdAt || now,
          version: (s?.version || 0) + 1,
          data: {
            ...c,
            approval: null,
            acceptances: [],
            gates: [],
            originalDueAt: c.dueAt,
          },
        },
        session,
      );
      ctx.s = s;
      result.sprintId = s._id;
    } else {
      demand(s, "CC has not configured a sprint.", 409);
      if (b.version !== undefined)
        demand(
          b.version === s.version,
          "Data changed; refresh before saving.",
          409,
        );
      s.version++;
      ctx.s = s;
      if (
        !["DRAFT", "CLOSED"].includes(s.state) &&
        action !== "reconcile-roster"
      ) {
        const source = await models.WeekOneProgram.findById(cohortId)
          .session(session)
          .lean();
        demand(
          source?.data.locked &&
            !source.data.correction &&
            source.data.recovery?.published &&
            hash(source.data.recovery.published) === s.data.rosterDigest,
          "The published roster changed. CC must reconcile the loaded sprint before work continues.",
          409,
        );
      }
      const t = b.teamId ? team(s, u, b.teamId) : null;
      ctx.t = t;
      if (action === "reconcile-roster") {
        centre(u);
        text(b.reason, "Roster reconciliation evidence");
        const checked = await validateConfig(ctx, clone(s.data));
        s.data.rosterDigest = checked.rosterDigest;
        await event(ctx, "ROSTER_RECONCILED", {
          reason: b.reason,
          rosterDigest: checked.rosterDigest,
        });
      } else if (action === "approve") {
        centre(u);
        demand(s.state === "DRAFT");
        await validateConfig(ctx, clone(s.data));
        s.data.approval = {
          by: u._id,
          at: now,
          reason: text(b.reason, "CC approval"),
          contentHash: hash({ ...s.data, approval: null }),
        };
      } else if (action === "load") {
        centre(u);
        demand(
          s.state === "DRAFT" &&
            s.data.approval &&
            s.data.approval.contentHash === hash({ ...s.data, approval: null }),
          "Approve the current unchanged package first.",
          409,
        );
        await validateConfig(ctx, clone(s.data));
        for (const t of s.data.teams)
          for (const template of s.data.template.tasks) {
            const code = template.id;
            await put(
              "Task",
              {
                _id: `${s._id}:${t.teamId}:${code}`,
                cohortId,
                sprintId: s._id,
                teamId: t.teamId,
                userId: t.owners[code],
                state: "Ready",
                version: 1,
                createdAt: now,
                data: {
                  ...template,
                  code,
                  basic: s.data.resources[code],
                  originalDueAt: s.data.dueAt,
                  dueAt: s.data.dueAt,
                  stages: stages.map((name) => ({
                    name,
                    state: "Not Started",
                  })),
                  evidence: [],
                  dueHistory: [],
                },
              },
              session,
            );
          }
        s.state = "PREVIEW";
      } else if (action === "kickoff") {
        demand(
          t && [MC, CC].includes(u.role) && now >= new Date(s.data.kickoffEnd),
          "Assigned staff complete kickoff after its scheduled end.",
          409,
        );
        text(b.evidence, "Kickoff evidence");
        if (!t.kickoff) {
          const history = await find(
              "Sprint",
              { cohortId, "data.teams.teamId": t.teamId },
              session,
            ),
            served = history.flatMap((h) =>
              h.data.teams
                .filter((x) => x.teamId === t.teamId && x.kickoff)
                .map((x) => x.leaderId),
            ),
            candidates = t.members.filter(
              (id) => !served.slice(-t.members.length).includes(id),
            );
          t.leaderId = (candidates.length ? candidates : t.members)[
            randomInt((candidates.length ? candidates : t.members).length)
          ];
          t.kickoff = { by: u._id, at: now, evidence: b.evidence };
          const scores = await find(
            "Ledger",
            {
              cohortId,
              state: "CORE",
              "data.week": s.data.number,
              teamId: t.teamId,
            },
            session,
          );
          t.clCap = cap(
            t.members,
            scores.map((v) => ({ userId: v.userId, score: v.data.score })),
          );
          t.capSource = scores.map((v) => v._id);
        }
        s.state = s.data.teams.every((x) => x.kickoff) ? "ACTIVE" : "PREVIEW";
      } else if (action === "task") {
        const card = await getTask(ctx, b.taskId);
        active(s, ctx.t, now);
        demand(
          u._id === card.userId ||
            (u._id === card.data.coGamerId &&
              b.evidence &&
              !b.next &&
              b.stage === undefined &&
              b.blocked === undefined),
          "Only the assigned contributor updates work.",
        );
        demand(
          !["Accepted", "In Review"].includes(card.state),
          "Submitted work is sealed.",
          409,
        );
        if (b.cardVersion !== undefined)
          demand(card.version === b.cardVersion, "Task changed; refresh.", 409);
        await guardWork(ctx, card, b.next);
        if (b.next) {
          const transitions = {
            Ready: ["Working"],
            Working: ["In Review"],
            Rework: ["Working"],
          };
          demand(
            transitions[card.state]?.includes(b.next),
            "Use the approved task transitions.",
            409,
          );
          if (card.state === "Ready")
            demand(
              now <= new Date(card.data.dueAt),
              "Approve a revised task target before starting overdue feature work.",
              409,
            );
          if (b.next === "In Review") {
            demand(
              card.data.evidence.length &&
                card.data.stages.every((x) => x.state === "Complete"),
              "All SDLC stages and attributable evidence required.",
              409,
            );
            for (const i of [0, 1, 3])
              demand(
                card.data.stages[i].review === "OK",
                "Required SDLC checkpoints must be reviewed.",
                409,
              );
            await review(ctx, card, "FINAL", ctx.t.commanderId, 8);
          }
          card.state = b.next;
        }
        if (b.stage !== undefined) {
          number(b.stage, 0, 4);
          demand(
            Number.isInteger(b.stage) && card.state === "Working",
            "Stage updates require working state.",
            409,
          );
          await model("Review").updateMany(
            {
              cohortId,
              sprintId: s._id,
              "data.taskId": card._id,
              "data.kind": "STAGE",
              "data.index": b.stage,
              state: "PENDING",
            },
            {
              $set: {
                state: "SUPERSEDED",
                "data.supersededAt": now,
                "data.supersededReason": "The owner revised this checkpoint.",
              },
            },
            { session },
          );
          card.data.stages[b.stage] = {
            name: stages[b.stage],
            state: b.complete ? "Complete" : "In Progress",
            note: text(b.note, "Stage reasoning"),
            by: u._id,
            at: now,
          };
          if (b.complete && [0, 1, 3].includes(b.stage))
            await review(
              ctx,
              card,
              "STAGE",
              card.data.coGamerId === ctx.t.leaderId
                ? ctx.t.commanderId
                : expectedReviewer(s, ctx.t, u._id),
              b.stage === 3 ? 4 : 2,
              b.stage,
            );
        }
        if (b.evidence) {
          demand(
            card.data.evidence.length < 3,
            "Maximum three evidence slots.",
            409,
          );
          card.data.evidence.push({
            id: randomUUID(),
            url: url(b.evidence),
            summary: text(b.summary, "Evidence explanation"),
            by: u._id,
            at: now,
          });
        }
        if (b.blocked !== undefined)
          card.data.blocker = {
            blocked: b.blocked === true,
            note: text(b.note, "Truthful status"),
            at: now,
            by: u._id,
          };
        await saveTask(ctx, card);
      } else if (action === "review") {
        const r = await one(
          "Review",
          { _id: b.reviewId, cohortId, sprintId: s._id, state: "PENDING" },
          session,
        );
        demand(r, "Pending review not found.", 404);
        ctx.t = team(s, u, r.teamId);
        demand(
          u._id !== r.userId &&
            ((r.data.reviewerRole === CC && u.role === CC) ||
              r.data.reviewerId === u._id),
          "Independent assigned reviewer required.",
        );
        demand(
          ["OK", "REWORK"].includes(b.decision),
          "Choose OK or REWORK.",
          400,
        );
        const c = await getTask(ctx, r.data.taskId);
        demand(
          c.data.coGamerId !== u._id,
          "A contributor cannot review their own task evidence.",
        );
        r.state = "DECIDED";
        r.data.decision = b.decision;
        r.data.reason = text(b.reason, "Review evidence");
        r.data.by = u._id;
        r.data.decidedAt = now;
        if (r.data.kind === "FINAL") {
          demand(
            c.state === "In Review",
            "Task is not awaiting final review.",
            409,
          );
          c.state = b.decision === "OK" ? "Accepted" : "Rework";
          if (c.state === "Accepted") c.data.acceptedAt = now.toISOString();
        } else if (r.data.kind === "APPEAL") {
          demand(
            r.data.subjectHash ===
              hash({ evidence: c.data.evidence, stages: c.data.stages }),
            "Evidence changed; this reassessment is obsolete.",
            409,
          );
          const old = await one(
            "Review",
            { _id: r.data.originalReviewId, cohortId },
            session,
          );
          old.data.history ||= [];
          old.data.history.push(clone({ ...old.data, history: undefined }));
          old.data.decision = b.decision;
          old.data.correction = { by: u._id, at: now, reason: b.reason };
          await put("Review", old, session);
          if (old.data.kind === "FINAL") {
            c.state = b.decision === "OK" ? "Accepted" : "Rework";
            if (c.state === "Accepted") c.data.acceptedAt = now.toISOString();
          } else c.data.stages[old.data.index].review = b.decision;
        } else {
          demand(
            hash(c.data.stages[r.data.index]) === r.data.evidenceHash,
            "Evidence changed; submit the checkpoint again.",
            409,
          );
          c.data.stages[r.data.index].review = b.decision;
        }
        await put("Review", r, session);
        await saveTask(ctx, c);
      } else if (action === "reassess" || action === "audit-review") {
        const r = await one(
          "Review",
          { _id: b.reviewId, cohortId, sprintId: s._id, state: "DECIDED" },
          session,
        );
        demand(r && r.data.kind !== "APPEAL");
        if (action === "audit-review") centre(u);
        else demand(r.userId === u._id && u.role === G);
        ctx.t = team(s, u, r.teamId);
        const subject = await getTask(ctx, r.data.taskId);
        demand(
          (
            await find(
              "Event",
              { cohortId, userId: u._id, state: "REASSESSMENT" },
              session,
            )
          ).length < 3 || action === "audit-review",
          "Three formal requests maximum across the game.",
          409,
        );
        demand(
          !(await one(
            "Review",
            { cohortId, "data.originalReviewId": r._id, state: "PENDING" },
            session,
          )),
          "A reassessment is already pending.",
          409,
        );
        await put(
          "Review",
          {
            _id: randomUUID(),
            cohortId,
            sprintId: s._id,
            teamId: r.teamId,
            userId: r.userId,
            state: "PENDING",
            createdAt: now,
            data: {
              kind: "APPEAL",
              taskId: r.data.taskId,
              originalReviewId: r._id,
              reviewerId:
                action === "audit-review" || r.data.by === ctx.t.commanderId
                  ? null
                  : ctx.t.commanderId,
              reviewerRole:
                action === "audit-review" || r.data.by === ctx.t.commanderId
                  ? CC
                  : null,
              evidence: text(b.evidence, "Appeal evidence"),
              subjectHash: hash({
                evidence: subject.data.evidence,
                stages: subject.data.stages,
              }),
            },
          },
          session,
        );
        await event(
          ctx,
          action === "audit-review" ? "AUDIT_REVIEW" : "REASSESSMENT",
          { reviewId: r._id },
        );
      } else if (action === "handover") {
        const from = await getTask(ctx, b.fromId),
          to = await getTask(ctx, b.toId);
        active(s, ctx.t, now);
        demand(
          from.teamId === to.teamId &&
            from.state === "Accepted" &&
            to.data.depends.includes(from.data.code),
          "Accepted same-team prerequisite required.",
          409,
        );
        demand(
          u._id === from.userId || u.role === CC || u._id === ctx.t.commanderId,
        );
        const id = `${from._id}:${to._id}:${from.data.acceptedAt}`;
        if (!(await one("Handover", { _id: id }, session)))
          await put(
            "Handover",
            {
              _id: id,
              cohortId,
              sprintId: s._id,
              teamId: to.teamId,
              userId: to.userId,
              state: from.userId === to.userId ? "RECEIVED" : "TRANSIT",
              createdAt: now,
              data: {
                from: from._id,
                to: to._id,
                sourceAcceptedAt: from.data.acceptedAt,
                senderId: from.userId,
                readyAt: workingAt(
                  now,
                  s.data.calendar,
                  from.userId === to.userId ? 0 : 60,
                ),
                evidence: text(b.evidence, "Handover evidence"),
              },
            },
            session,
          );
      } else if (action === "receive") {
        const h = await one(
          "Handover",
          { _id: b.handoverId, cohortId, sprintId: s._id },
          session,
        );
        demand(h && h.userId === u._id);
        team(s, u, h.teamId);
        demand(
          now >= new Date(h.data.readyAt),
          "One working hour has not elapsed.",
          409,
        );
        h.state = "RECEIVED";
        h.data.receivedAt = now;
        await put("Handover", h, session);
      } else if (action === "forecast" || action === "deadline") {
        const c = await getTask(ctx, b.taskId);
        active(s, ctx.t, now);
        if (action === "deadline") {
          staff(u);
          const due = iso(b.dueAt);
          demand(
            new Date(due) > new Date(s.data.kickoffEnd),
            "A revised target must follow kickoff.",
            400,
          );
          if (new Date(due) > new Date(s.data.originalDueAt)) centre(u);
          c.data.dueHistory.push({
            before: c.data.dueAt,
            after: due,
            reason: text(b.reason, "Deadline approval"),
            by: u._id,
            at: now,
            clientId: b.clientId,
          });
          c.data.dueAt = due;
        } else {
          demand(c.userId === u._id);
          demand(
            ["ON_TRACK", "AT_RISK"].includes(b.status),
            "Choose ON_TRACK or AT_RISK.",
            400,
          );
          const related = await find(
            "Task",
            {
              cohortId,
              sprintId: s._id,
              teamId: c.teamId,
              "data.depends": c.data.code,
            },
            session,
          );
          await put(
            "Notice",
            {
              _id: randomUUID(),
              cohortId,
              sprintId: s._id,
              teamId: c.teamId,
              userId: u._id,
              state: b.status,
              createdAt: now,
              data: {
                taskId: c._id,
                reason:
                  b.status === "AT_RISK"
                    ? text(b.reason, "Risk reason")
                    : "Owner confirms on track",
                eta: b.status === "AT_RISK" ? iso(b.eta) : null,
                recipients: [
                  ctx.t.commanderId,
                  ctx.t.leaderId,
                  ...related.map((x) => x.userId),
                ],
              },
            },
            session,
          );
        }
        await saveTask(ctx, c);
      } else if (action === "daily") {
        demand(u.role === G && t?.members.includes(u._id));
        active(s, t, now);
        demand(
          ["SOD", "EOD", "JOURNAL", "AGENDA", "CLOCK", "RULE_ACK"].includes(
            b.kind,
          ),
          "Daily record type required.",
          400,
        );
        const d = day(now, s.data.calendar),
          id = `${s._id}:${u._id}:${d}:${b.kind}`,
          old = await one("Daily", { _id: id }, session);
        await put(
          "Daily",
          {
            _id: id,
            cohortId,
            sprintId: s._id,
            teamId: t.teamId,
            userId: u._id,
            state: b.kind,
            createdAt: old?.createdAt || now,
            data: {
              note: text(b.note, "Daily evidence"),
              timely: working(now, s.data.calendar),
              policyVersion: s.data.rulesVersion,
              at: now,
              history: old
                ? [
                    ...(old.data.history || []),
                    { note: old.data.note, at: old.data.at },
                  ].slice(-30)
                : [],
              day: d,
            },
          },
          session,
        );
      } else if (action === "spark") {
        demand(u.role === G && t);
        active(s, t, now);
        demand(
          working(now, s.data.calendar) && now <= new Date(s.data.dueAt),
          "Spark is available during the active working week.",
          409,
        );
        const d = day(now, s.data.calendar),
          tasks = (
            await find(
              "Task",
              { cohortId, sprintId: s._id, teamId: t.teamId },
              session,
            )
          )
            .filter((c) => t.members.includes(c.userId) && !c.data.extensionId)
            .sort((a, b) => a._id.localeCompare(b._id)),
          card =
            tasks[parseInt(hash(d + t.teamId).slice(0, 6), 16) % tasks.length];
        if (b.answer !== card.userId) result.correct = false;
        else {
          await ledger(
            ctx,
            "SPARK",
            u._id,
            { day: d, taskId: card._id },
            `${u._id}:${d}`,
          );
          const count = (
            await find(
              "Ledger",
              { cohortId, userId: u._id, state: "SPARK" },
              session,
            )
          ).length;
          if (count % 5 === 0)
            await ledger(
              ctx,
              "COSMETIC",
              u._id,
              { milestone: count / 5 },
              `${u._id}:${count / 5}`,
            );
          result.correct = true;
        }
      } else if (action === "rules") {
        centre(u);
        demand(
          Array.isArray(b.rules) && b.rules.length === 19,
          "Nineteen approved behaviours required.",
          400,
        );
        b.rules.forEach((x) => text(x, "Rule", 3, 1000));
        s.data.rulesVersion = text(b.policyVersion, "Rule version", 1, 70);
        s.data.rulesId = await policy(
          ctx,
          "RULEBOOK",
          s.data.rulesVersion,
          b.rules,
        );
      } else if (action === "bank") {
        centre(u);
        demand(
          Array.isArray(b.items) &&
            b.items.length === 35 &&
            new Set(b.items.map((x) => x.id)).size === 35 &&
            b.items.filter((x) => x.kind === "CL1").length === 20 &&
            b.items.filter((x) => x.kind === "CL2").length === 15,
          "35 unique items: 20 CL1 and 15 CL2 required.",
          400,
        );
        for (const x of b.items) {
          text(x.id, "Bank item code", 1, 70);
          text(x.title, "Title", 3, 200);
          text(x.instructions, "Instructions", 20, 5000);
          text(x.acceptance, "Acceptance", 10, 2000);
          number(x.minutes, 1, 239);
        }
        s.data.bankId = await policy(ctx, "BANK", b.policyVersion, b.items);
      } else if (action === "cl-propose" || action === "cl-release") {
        staff(u);
        demand(
          s.data.number >= 2,
          "Client interruptions start in Week 3.",
          409,
        );
        const bank = await one(
            "Policy",
            { _id: s.data.bankId, cohortId },
            session,
          ),
          item = bank?.data.value.find((x) => x.id === b.itemCode);
        demand(item, "Approved bank item required.", 400);
        if (action === "cl-propose") {
          demand(t);
          active(s, t, now);
          const candidate = b.userId || t.members[randomInt(t.members.length)];
          demand(t.members.includes(candidate));
          await put(
            "Client",
            {
              _id: randomUUID(),
              cohortId,
              sprintId: s._id,
              teamId: t.teamId,
              userId: candidate,
              state: "PROPOSED",
              createdAt: now,
              data: {
                bankId: bank._id,
                itemCode: item.id,
                by: u._id,
                reason: text(b.reason, "MC recommendation"),
              },
            },
            session,
          );
        } else {
          centre(u);
          text(b.eventKey, "Common event key", 8, 100);
          const eventId = `${s._id}:client:${b.eventKey}`,
            old = await one("Event", { _id: eventId }, session);
          if (old)
            demand(
              old.data.bankId === bank._id &&
                old.data.itemCode === item.id &&
                old.data.assignmentsHash === hash(b.assignments || []),
              "Event key identifies different content.",
              409,
            );
          else {
            for (const target of s.data.teams) {
              active(s, target, now);
              const deliveries = await find(
                  "Client",
                  {
                    cohortId,
                    sprintId: s._id,
                    teamId: target.teamId,
                    state: { $nin: ["PROPOSED", "INELIGIBLE"] },
                  },
                  session,
                ),
                proposal = (
                  await find(
                    "Client",
                    {
                      cohortId,
                      sprintId: s._id,
                      teamId: target.teamId,
                      state: "PROPOSED",
                      "data.bankId": bank._id,
                      "data.itemCode": item.id,
                    },
                    session,
                  )
                )
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .at(-1);
              const override = b.assignments?.find(
                  (x) => x.teamId === target.teamId,
                ),
                owner = override?.userId || proposal?.userId,
                blocked =
                  deliveries.length >= target.clCap ||
                  deliveries.filter((x) =>
                    ["ASSIGNED", "WORKING", "REWORK"].includes(x.state),
                  ).length >= 2;
              demand(
                blocked || target.members.includes(owner),
                "Every eligible team needs an MC proposal or reasoned CC override.",
                400,
              );
              if (override) text(override.reason, "CC override");
              await put(
                "Client",
                {
                  _id: `${eventId}:${target.teamId}`,
                  cohortId,
                  sprintId: s._id,
                  teamId: target.teamId,
                  userId: blocked ? undefined : owner,
                  state: blocked ? "INELIGIBLE" : "ASSIGNED",
                  createdAt: now,
                  data: {
                    eventId,
                    bankId: bank._id,
                    item: clone(item),
                    releaseAt: now,
                    dueAt: workingAt(now, s.data.calendar, item.minutes),
                    reason: blocked
                      ? "Weekly cap or two active slots"
                      : text(b.reason, "Common release approval"),
                    proposalId: proposal?._id,
                  },
                },
                session,
              );
            }
            await event(
              ctx,
              "CLIENT_RELEASE",
              {
                bankId: bank._id,
                itemCode: item.id,
                releaseAt: now,
                assignmentsHash: hash(b.assignments || []),
              },
              eventId,
            );
          }
        }
      } else if (action === "cl-work") {
        const c = await one(
          "Client",
          { _id: b.clientId, cohortId, sprintId: s._id },
          session,
        );
        demand(c);
        ctx.t = team(s, u, c.teamId);
        active(s, ctx.t, now);
        if (["WORKING", "IN_REVIEW"].includes(b.next))
          await deliveryEnergy(ctx, u._id);
        if (b.next === "WORKING") {
          const energy = (
            await find(
              "Ledger",
              { cohortId, userId: u._id, state: "ENERGY" },
              session,
            )
          )
            .sort((a, b) => (a.data.sequence || 0) - (b.data.sequence || 0))
            .at(-1);
          demand(
            !energy?.data.rescue,
            "Individual energy recovery is pending.",
            409,
          );
          demand(
            c.userId === u._id && ["ASSIGNED", "REWORK"].includes(c.state),
          );
          const count = (
            await find(
              "Client",
              {
                cohortId,
                sprintId: s._id,
                teamId: c.teamId,
                state: { $in: ["ASSIGNED", "WORKING", "REWORK"] },
              },
              session,
            )
          ).filter((x) => x._id !== c._id).length;
          demand(count < 2, "Two active interruptions already.", 409);
          if (b.taskId) {
            const task = await getTask(ctx, b.taskId);
            demand(task.userId === u._id && task.state === "Working");
            c.data.pausedTaskId = task._id;
            c.data.remainingMinutes = number(b.remainingMinutes, 0, 2400);
          }
        } else if (b.next === "IN_REVIEW") {
          demand(c.userId === u._id && c.state === "WORKING");
          c.data.evidence = url(b.evidence);
          c.data.reason = text(b.reason, "Client test evidence");
          c.data.reviewDueAt = workingAt(now, s.data.calendar, 480);
        } else {
          staff(u);
          demand(
            u._id !== c.userId &&
              c.state === "IN_REVIEW" &&
              ["ACCEPTED", "REWORK"].includes(b.next),
          );
          if (b.next === "REWORK")
            demand(
              (
                await find(
                  "Client",
                  {
                    cohortId,
                    sprintId: s._id,
                    teamId: c.teamId,
                    state: { $in: ["ASSIGNED", "WORKING", "REWORK"] },
                  },
                  session,
                )
              ).length < 2,
              "Wait for an active slot before rework.",
              409,
            );
          c.data.review = {
            by: u._id,
            at: now,
            reason: text(b.reason, "Review evidence"),
          };
        }
        c.data.history ||= [];
        c.data.history.push({ state: c.state, at: now, by: u._id });
        c.state = b.next;
        await put("Client", c, session);
      } else if (action === "help" || action === "help-grant") {
        demand(t);
        active(s, t, now);
        if (action === "help-grant") {
          centre(u);
          demand(t.members.includes(b.userId));
          number(b.amount, 1, 20);
          text(b.reason, "Approved allowance");
          await ledger(
            ctx,
            "HELP_PASS",
            b.userId,
            { amount: b.amount, reason: b.reason },
            b.requestId,
          );
        } else {
          demand(t.members.includes(u._id));
          const kind = b.package || "ESSENTIAL";
          if (kind !== "ESSENTIAL") {
            const p = s.data.assistance;
            demand(p, "Assistance prices require approval.", 409);
            const balance = (
              await find(
                "Ledger",
                {
                  cohortId,
                  sprintId: s._id,
                  userId: u._id,
                  state: "HELP_PASS",
                },
                session,
              )
            ).reduce((n, x) => n + x.data.amount, 0);
            demand(
              balance >= p[kind],
              "Insufficient optional Help Pass balance.",
              409,
            );
            if (["GUIDE", "AI_PROMPT"].includes(kind)) {
              const task = await getTask(ctx, b.taskId),
                resource = task.data.basic[kind];
              demand(
                task.userId === u._id || task.data.coGamerId === u._id,
                "Optional assistance must relate to your assigned contribution.",
              );
              demand(
                resource?.author === "CURRICULUM",
                "Approved optional resource is unavailable.",
                409,
              );
              text(resource.approval, "Curriculum assistance approval");
              text(resource.version, "Assistance version", 1, 70);
              result.resource = url(resource.url);
            } else
              demand(
                kind === "MC_ONE_TO_ONE",
                "Unknown assistance package.",
                400,
              );
            await ledger(
              ctx,
              "HELP_PASS",
              u._id,
              { amount: -p[kind], package: kind, resource: result.resource },
              b.requestId,
            );
          }
          if (!result.resource) {
            demand(
              [
                "EXPERIENCE",
                "COGNITION",
                "EXPERT_INTERVENTION_NEEDED",
              ].includes(b.category),
              "Choose a support umbrella.",
              400,
            );
            const id = randomUUID();
            await models.HelpTicket.create(
              [
                {
                  _id: id,
                  cohortId,
                  teamId: t.teamId,
                  createdBy: u._id,
                  description: text(b.reason, "Help request"),
                  category: b.category,
                  state: "ASSIGNED",
                  assignedTo: t.commanderId,
                  assignedAt: now,
                  dueAt: new Date(workingAt(now, s.data.calendar, 60)),
                  calendarSnapshot: s.data.calendar,
                  createdAt: now,
                },
              ],
              { session },
            );
            await models.SupportEvent.create(
              [
                {
                  _id: randomUUID(),
                  cohortId,
                  ticketId: id,
                  actorId: u._id,
                  kind: "CREATED",
                  details: { programme: s._id, package: kind },
                  createdAt: now,
                },
              ],
              { session },
            );
            result.ticketId = id;
          }
        }
      } else if (action === "settings") {
        centre(u);
        if (b.ruleConsequenceAt) {
          s.data.ruleConsequenceAt = iso(b.ruleConsequenceAt);
          s.data.ruleConsequenceId = await policy(
            ctx,
            "RULE_CONSEQUENCE",
            b.policyVersion,
            s.data.ruleConsequenceAt,
          );
        }
        if (b.rubric) {
          const value = rubric(b.rubric);
          s.data.rubricId = await policy(ctx, "RUBRIC", b.policyVersion, value);
          s.data.rubric = value;
        }
        if (b.assistance) {
          for (const k of ["GUIDE", "AI_PROMPT", "MC_ONE_TO_ONE"])
            number(b.assistance[k], 0, 20);
          s.data.assistanceId = await policy(
            ctx,
            "ASSISTANCE",
            b.policyVersion,
            b.assistance,
          );
          s.data.assistance = b.assistance;
        }
        if (b.energy) {
          demand(
            b.energy.start === 5 &&
              b.energy.max === 5 &&
              Number.isInteger(b.energy.lives) &&
              ["RESET_IF_LIVES", "AWAIT_RECOVERY"].includes(b.energy.zeroMode),
            "Approve the five-energy policy, lives and zero/reset handling.",
            400,
          );
          number(b.energy.lives, 1, 5);
          s.data.energyPolicy = await policy(
            ctx,
            "ENERGY",
            b.policyVersion,
            b.energy,
          );
          for (const t of s.data.teams) {
            ctx.t = t;
            for (const id of t.members) {
              const prior = await find(
                "Ledger",
                { cohortId, userId: id, state: "ENERGY" },
                session,
              );
              if (!prior.length)
                await ledger(
                  ctx,
                  "ENERGY",
                  id,
                  {
                    energy: 5,
                    lives: b.energy.lives,
                    rescue: false,
                    losses: 0,
                    policyId: s.data.energyPolicy,
                  },
                  `${id}:initial`,
                );
            }
          }
        }
        if (b.midpoint) {
          iso(b.midpoint.at);
          number(b.midpoint.threshold, 1, 100);
          s.data.midpoint = b.midpoint;
          s.data.midpointId = await policy(
            ctx,
            "MIDPOINT",
            b.policyVersion,
            b.midpoint,
          );
        }
        if (b.bonusCap !== undefined) {
          number(b.bonusCap, 0, 100);
          s.data.bonusCap = b.bonusCap;
          s.data.bonusId = await policy(
            ctx,
            "BONUS",
            b.policyVersion,
            b.bonusCap,
          );
        }
      } else if (action === "gate" || action === "accept") {
        centre(u);
        demand(t);
        active(s, t, now);
        if (action === "gate") {
          demand(
            (Number.isInteger(b.index) && b.index >= 1 && b.index <= 7) ||
              ["QA-06", "QA-08"].includes(b.code),
            "A client gate or deployment test code is required.",
            400,
          );
          demand(
            ["PASS", "FAIL", "BLOCKED"].includes(b.decision),
            "Gate decision required.",
            400,
          );
          url(b.evidence);
          text(b.reason, "Executed test findings");
          const code = b.code || `AC-${b.index}`;
          if (b.code) {
            const c = await one(
              "Task",
              {
                cohortId,
                sprintId: s._id,
                teamId: t.teamId,
                "data.code": code,
              },
              session,
            );
            demand(
              c?.state === "Accepted" && c.userId !== u._id,
              "Accepted independently reviewed test evidence required.",
              409,
            );
          }
          s.data.gates = s.data.gates
            .filter((x) => x.teamId !== t.teamId || x.code !== code)
            .concat({
              teamId: t.teamId,
              code,
              decision: b.decision,
              evidence: b.evidence,
              reason: b.reason,
              by: u._id,
              at: now,
            });
          const old = s.data.acceptances.find((x) => x.teamId === t.teamId);
          if (old) {
            old.history ||= [];
            old.history.push({ ...old, history: undefined });
            old.decision = "REVIEW_REQUIRED";
            old.key = null;
          }
        } else {
          demand(
            ["ACCEPTED", "NOT_ACCEPTED"].includes(b.decision),
            "Record an explicit disposition.",
            400,
          );
          if (b.decision === "ACCEPTED")
            demand(
              Array.from({ length: 7 }, (_, i) =>
                s.data.gates.some(
                  (x) =>
                    x.teamId === t.teamId &&
                    x.code === `AC-${i + 1}` &&
                    x.decision === "PASS",
                ),
              ).every(Boolean),
              "All seven latest client gates must pass.",
              409,
            );
          const old = s.data.acceptances.find((x) => x.teamId === t.teamId),
            record = {
              teamId: t.teamId,
              decision: b.decision,
              key: b.decision === "ACCEPTED" ? `Key ${s.data.number}` : null,
              by: u._id,
              at: now,
              reason: text(b.reason, "Client disposition"),
            };
          if (old) Object.assign(old, record);
          else s.data.acceptances.push(record);
        }
        s.state = s.data.teams.every((t) =>
          s.data.acceptances.some(
            (a) => a.teamId === t.teamId && a.decision === "ACCEPTED",
          ),
        )
          ? "ACCEPTED"
          : "CLIENT_REVIEW";
      } else if (action === "close") {
        centre(u);
        demand(
          s.data.teams.every((t) =>
            s.data.acceptances.some(
              (x) =>
                x.teamId === t.teamId &&
                ["ACCEPTED", "NOT_ACCEPTED"].includes(x.decision),
            ),
          ),
          "Each team needs an explicit final disposition.",
          409,
        );
        demand(
          !(await one(
            "Review",
            { cohortId, sprintId: s._id, state: "PENDING" },
            session,
          )) &&
            !(await one(
              "Client",
              {
                cohortId,
                sprintId: s._id,
                state: { $in: ["ASSIGNED", "WORKING", "IN_REVIEW", "REWORK"] },
              },
              session,
            )),
          "Resolve pending reviews and client changes before closing.",
          409,
        );
        text(b.reason, "Closure approval");
        s.state = "CLOSED";
      } else if (
        action === "midpoint-open" ||
        action === "midpoint-submit" ||
        action === "midpoint-review"
      ) {
        demand(t);
        const policy = s.data.midpoint;
        demand(
          policy && now >= new Date(policy.at),
          "Approved midpoint window has not opened.",
          409,
        );
        const id = `${s._id}:recovery:${b.userId || u._id}`;
        let r = await one("Recovery", { _id: id, cohortId }, session);
        if (action === "midpoint-open") {
          staff(u);
          demand(t.members.includes(b.userId));
          number(b.score, 0, policy.threshold - 0.001);
          demand(!r, "Individual case already exists.", 409);
          r = {
            _id: id,
            cohortId,
            sprintId: s._id,
            teamId: t.teamId,
            userId: b.userId,
            state: "OPEN",
            createdAt: now,
            data: {
              score: b.score,
              evidence: text(b.evidence, "Individual threshold evidence"),
              attempts: [],
            },
          };
        } else {
          demand(r);
          if (action === "midpoint-submit") {
            demand(
              r.userId === u._id &&
                r.data.attempts.length < 2 &&
                r.state === "OPEN",
            );
            r.data.attempts.push({
              evidence: url(b.evidence),
              note: text(b.reason, "Recovery explanation"),
              at: now,
            });
            r.state = "PENDING";
          } else {
            staff(u);
            demand(r.userId !== u._id && r.state === "PENDING");
            demand(["PASS", "FAIL"].includes(b.decision));
            r.data.attempts.at(-1).review = {
              by: u._id,
              decision: b.decision,
              reason: text(b.reason, "Independent verification"),
              at: now,
            };
            r.state =
              b.decision === "PASS"
                ? "CLEARED"
                : r.data.attempts.length === 2
                  ? "HUMAN_DISPOSITION_REQUIRED"
                  : "OPEN";
          }
        }
        await put("Recovery", r, session);
        if (action === "midpoint-open") {
          const cases = await find(
            "Recovery",
            { cohortId, sprintId: s._id, teamId: t.teamId },
            session,
          );
          if (t.members.every((id) => cases.some((c) => c.userId === id)))
            await noticeOnce(
              {
                _id: `${s._id}:${t.teamId}:midpoint-team`,
                cohortId,
                sprintId: s._id,
                teamId: t.teamId,
                state: "TEAM_INTERVENTION",
                createdAt: now,
                data: {
                  text: "Every team member is below the midpoint threshold. Arrange a team intervention; each Gamer still requires independent verification.",
                },
              },
              session,
            );
        }
      } else if (!(await advanced(ctx, action, result)))
        demand(false, "Unknown programme action.", 404);
      await put("Sprint", s, session);
    }
    await event(
      ctx,
      "COMMAND",
      { action, reason: b.reason, requestHash, result },
      `${cohortId}:request:${b.requestId}`,
    );
    return result;
  });
}
async function advanced(ctx, action, result) {
  const { s, u, b, cohortId, session, now } = ctx,
    t = ctx.t;
  if (action === "daily-report") {
    demand(t);
    active(s, t, now);
    demand(
      b.kind === "TEAM_EOD"
        ? t.leaderId === u._id
        : b.kind === "MC_EXCEPTIONS" && [MC, CC].includes(u.role),
    );
    const d = day(now, s.data.calendar),
      id = `${s._id}:${t.teamId}:${d}:${b.kind}`,
      old = await one("Daily", { _id: id }, session);
    await put(
      "Daily",
      {
        _id: id,
        cohortId,
        sprintId: s._id,
        teamId: t.teamId,
        userId: u._id,
        state: b.kind,
        createdAt: old?.createdAt || now,
        data: {
          day: d,
          note: text(b.note, "Verified report"),
          by: u._id,
          at: now,
          history: [
            ...(old?.data.history || []),
            ...(old ? [{ note: old.data.note, at: old.data.at }] : []),
          ],
        },
      },
      session,
    );
  } else if (action === "meeting-publish") {
    staff(u);
    demand(t);
    const startAt = iso(b.startAt);
    await put(
      "Daily",
      {
        _id: randomUUID(),
        cohortId,
        sprintId: s._id,
        teamId: t.teamId,
        userId: u._id,
        state: "MEETING",
        createdAt: now,
        data: {
          day: day(startAt, s.data.calendar),
          startAt,
          agenda: text(b.agenda, "Published SOD agenda"),
          by: u._id,
        },
      },
      session,
    );
  } else if (action === "challenge-publish") {
    centre(u);
    demand(
      Array.isArray(b.quests) &&
        b.quests.length === 5 &&
        b.quests.filter((q) => q.role === "PRIMARY").length === 3 &&
        b.quests.filter((q) => q.role === "SECONDARY").length === 2 &&
        new Set(b.quests.map((q) => q.id)).size === 5,
      "Publish five approved quests: three primary and two secondary.",
      400,
    );
    for (const q of b.quests) {
      text(q.id, "Quest ID", 1, 70);
      text(q.title, "Quest title", 3, 200);
      text(q.instructions, "Quest instructions", 20);
    }
    text(b.discovery, "Approved discovery prompt", 20);
    text(b.goat, "Approved GOAT prompt", 20);
    s.data.challengeId = await policy(ctx, "CHALLENGES", b.policyVersion, {
      quests: b.quests,
      discovery: b.discovery,
      goat: b.goat,
    });
  } else if (
    action === "challenge-start" ||
    action === "challenge-submit" ||
    action === "challenge-review"
  ) {
    demand(t);
    active(s, t, now);
    const definition = await one(
      "Policy",
      { _id: s.data.challengeId, cohortId },
      session,
    );
    demand(
      definition,
      "Approved optional challenge content is not ready.",
      409,
    );
    if (action === "challenge-start") {
      demand(u.role === G && t.members.includes(u._id));
      demand(["QUEST", "DISCOVERY", "GOAT"].includes(b.kind));
      const prompt =
        b.kind === "QUEST"
          ? definition.data.value.quests.find((q) => q.id === b.code)
              ?.instructions
          : definition.data.value[b.kind.toLowerCase()];
      demand(prompt, "Approved challenge not found.", 404);
      const d = day(now, s.data.calendar),
        id = `${s._id}:${u._id}:${b.kind}:${b.kind === "QUEST" ? b.code : d}`;
      demand(
        !(await one("Daily", { _id: id }, session)),
        "This challenge is already started.",
        409,
      );
      await put(
        "Daily",
        {
          _id: id,
          cohortId,
          sprintId: s._id,
          teamId: t.teamId,
          userId: u._id,
          state: "CHALLENGE",
          createdAt: now,
          data: {
            status: "WORKING",
            kind: b.kind,
            code: b.code,
            day: d,
            prompt,
            policyId: definition._id,
            startedAt: now,
            dueAt:
              b.kind === "DISCOVERY"
                ? workingAt(now, s.data.calendar, 30)
                : s.data.dueAt,
          },
        },
        session,
      );
    } else {
      const r = await one(
        "Daily",
        {
          _id: b.attemptId,
          cohortId,
          sprintId: s._id,
          teamId: t.teamId,
          state: "CHALLENGE",
        },
        session,
      );
      demand(r);
      if (action === "challenge-submit") {
        demand(
          r.userId === u._id && ["WORKING", "REWORK"].includes(r.data.status),
        );
        r.data.evidence = url(b.evidence);
        r.data.note = text(b.reason, "Actual optional work");
        r.data.status = now > new Date(r.data.dueAt) ? "EXPIRED" : "IN_REVIEW";
        r.data.submittedAt = now;
      } else {
        staff(u);
        demand(
          r.userId !== u._id &&
            ["IN_REVIEW", "EXPIRED"].includes(r.data.status),
        );
        demand(["PASS", "REWORK"].includes(b.decision));
        r.data.review = {
          decision: b.decision,
          by: u._id,
          at: now,
          reason: text(b.reason, "Verified challenge evidence"),
        };
        r.data.status = b.decision;
        if (b.decision === "PASS")
          await ledger(
            ctx,
            "TROPHY",
            r.userId,
            {
              category:
                r.data.kind === "QUEST"
                  ? "WEEKLY_QUEST"
                  : r.data.kind === "DISCOVERY"
                    ? "DAILY_DISCOVERY"
                    : "GOAT",
              evidence: r.data.evidence,
            },
            `${r.userId}:${r.data.day}:${r.data.kind}`,
          );
      }
      await put("Daily", r, session);
    }
  } else if (action === "mark-correct") {
    centre(u);
    const m = await one(
      "Ledger",
      { _id: b.markId, cohortId, state: "ASSESSMENT" },
      session,
    );
    demand(m);
    ctx.t = team(s, u, m.teamId);
    const p = await one("Policy", { _id: m.data.rubricId, cohortId }, session);
    demand(p && b.ratings);
    const scores = Object.fromEntries(
      p.data.value.map((c) => {
        const rating = b.ratings[c.key];
        demand(
          rating === null || Number.isInteger(rating),
          "Use integer 0–4 evidence ratings or null.",
          400,
        );
        return [
          c.key,
          rating === null ? null : (number(rating, 0, 4) / 4) * c.weight,
        ];
      }),
    );
    m.data.history ||= [];
    m.data.history.push(clone(m.data.human));
    m.data.human = {
      ratings: b.ratings,
      scores,
      total: Object.values(scores).every((v) => v === null)
        ? null
        : Object.values(scores).reduce((n, v) => n + (v || 0), 0),
      by: u._id,
      at: now,
      reason: text(b.reason, "Independent mark correction"),
    };
    await put("Ledger", m, session);
  } else if (action === "midpoint-dispose") {
    centre(u);
    demand(t?.members.includes(b.userId));
    const r = await one(
      "Recovery",
      {
        _id: `${s._id}:recovery:${b.userId}`,
        cohortId,
        state: "HUMAN_DISPOSITION_REQUIRED",
      },
      session,
    );
    demand(r);
    r.data.disposition = {
      decision: text(b.decision, "Human participation decision", 3, 100),
      reason: text(b.reason, "Individual verified disposition"),
      by: u._id,
      at: now,
    };
    r.state = "DISPOSED";
    await put("Recovery", r, session);
  } else if (action === "upload-intent") {
    demand(
      /\.(pdf|docx|xlsx|csv)$/i.test(b.filename) &&
        /^[\w .-]{1,160}$/.test(b.filename),
      "Supported filename required.",
      400,
    );
    const id = randomUUID(),
      path = `codewild/${cohortId}/${id}.${b.filename.split(".").at(-1).toLowerCase()}`;
    let teamId;
    if (b.batchId) {
      staff(u);
      const batch = await one(
        "Batch",
        { _id: b.batchId, cohortId, sprintId: s._id },
        session,
      );
      demand(batch && (u.role === CC || batch.userId === u._id));
      demand(/\.(csv|xlsx)$/i.test(b.filename));
    } else {
      const c = await getTask(ctx, b.taskId);
      active(s, ctx.t, now);
      await guardWork(ctx, c);
      demand(
        (c.userId === u._id || c.data.coGamerId === u._id) &&
          !["Accepted", "In Review"].includes(c.state),
      );
      const pending = await find(
        "Evidence",
        { cohortId, "data.taskId": c._id, state: "PENDING" },
        session,
      );
      demand(
        c.data.evidence.length +
          pending.filter((e) => now - new Date(e.createdAt) < 1200000).length <
          3,
        "Three total evidence slots maximum.",
        409,
      );
      teamId = c.teamId;
    }
    await put(
      "Evidence",
      {
        _id: id,
        cohortId,
        sprintId: s._id,
        teamId,
        userId: u._id,
        state: "PENDING",
        createdAt: now,
        data: {
          taskId: b.taskId,
          batchId: b.batchId,
          path,
          filename: b.filename,
        },
      },
      session,
    );
    result.evidenceId = id;
    result.path = path;
  } else if (action === "upload-complete") {
    demand(b._proof === storageProof, "Storage verification required.");
    const e = await one(
      "Evidence",
      { _id: b.evidenceId, cohortId, userId: u._id, state: "PENDING" },
      session,
    );
    demand(e && e.data.path === b.path);
    number(b.size, 1, 5 * 1024 * 1024);
    e.state = e.data.batchId ? "RETURN" : "READY";
    e.data = {
      ...e.data,
      size: b.size,
      contentType: b.contentType,
      etag: b.etag,
      extracted: b.extracted,
      warning: b.warning,
      blobUrl: b.blobUrl,
    };
    if (e.data.taskId) {
      const c = await getTask(ctx, e.data.taskId);
      active(s, ctx.t, now);
      await guardWork(ctx, c);
      demand(
        (c.userId === u._id || c.data.coGamerId === u._id) &&
          c.data.evidence.length < 3 &&
          !["Accepted", "In Review"].includes(c.state),
      );
      c.data.evidence.push({
        id: e._id,
        url: `/api/pilot/files/${e._id}`,
        summary: e.data.filename,
        by: u._id,
        at: now,
        extracted: b.extracted,
        warning: b.warning,
      });
      await saveTask(ctx, c);
    }
    await put("Evidence", e, session);
  } else if (action === "estimate") {
    centre(u);
    const c = await getTask(ctx, b.taskId);
    number(b.hours, 1, 40);
    text(b.reason, "Approved estimate");
    c.data.estimateHistory ||= [];
    c.data.estimateHistory.push({
      before: c.data.hours,
      after: b.hours,
      by: u._id,
      at: now,
      reason: b.reason,
    });
    c.data.hours = b.hours;
    await saveTask(ctx, c);
  } else if (action === "assign-helper") {
    staff(u);
    const c = await getTask(ctx, b.taskId);
    demand(ctx.t.members.includes(b.userId) && b.userId !== c.userId);
    demand(!["Accepted", "In Review"].includes(c.state));
    c.data.coGamerId = b.userId;
    c.data.helperApproval = {
      by: u._id,
      reason: text(b.reason, "Co-Gamer scope and attribution"),
      at: now,
    };
    await model("Review").updateMany(
      {
        cohortId,
        sprintId: s._id,
        "data.taskId": c._id,
        state: "PENDING",
        "data.reviewerId": b.userId,
      },
      {
        $set: {
          "data.reviewerId": ctx.t.commanderId,
          "data.reviewerRole": ctx.t.commanderId === c.userId ? CC : null,
          "data.reassignedAt": now,
          "data.reassignedReason": "The TL became an attributed contributor.",
        },
      },
      { session },
    );
    await saveTask(ctx, c);
  } else if (action === "hygiene") {
    staff(u);
    demand(t && t.members.includes(b.userId));
    const d = text(b.day, "Local day", 10, 10),
      records = await find(
        "Daily",
        { cohortId, sprintId: s._id, userId: b.userId, "data.day": d },
        session,
      ),
      tasks = await find(
        "Task",
        { cohortId, sprintId: s._id, teamId: t.teamId, userId: b.userId },
        session,
      ),
      eod = records.find((r) => r.state === "EOD"),
      moved = tasks.some((c) =>
        c.data.stages.some(
          (v) => v.by === b.userId && v.at && day(v.at, s.data.calendar) === d,
        ),
      ),
      evidence = tasks.some((c) =>
        c.data.evidence.some(
          (v) => v.by === b.userId && day(v.at, s.data.calendar) === d,
        ),
      ),
      blocker = tasks.some(
        (c) =>
          c.data.blocker?.by === b.userId &&
          day(c.data.blocker.at, s.data.calendar) === d,
      );
    const score =
      (moved ? 4 : 0) +
      (evidence ? 3 : 0) +
      (blocker ? 2 : 0) +
      (eod?.data.timely ? 1 : 0);
    await put(
      "Daily",
      {
        _id: `${s._id}:${b.userId}:${d}:HYGIENE`,
        cohortId,
        sprintId: s._id,
        teamId: t.teamId,
        userId: b.userId,
        state: "HYGIENE",
        createdAt: now,
        data: {
          day: d,
          score,
          qualifyingDay: score === 10,
          by: u._id,
          reason: text(b.reason, "Verified daily evidence"),
        },
      },
      session,
    );
  } else if (action === "trophy") {
    staff(u);
    demand(t && t.members.includes(b.userId) && b.userId !== u._id);
    demand(
      [
        "ON_TIME",
        "PERFECT_DAY",
        "COMEBACK",
        "HELPING_HAND",
        "INNOVATION",
        "PROBLEM_SOLVER",
        "INITIATIVE",
        "DAILY_DISCOVERY",
        "WEEKLY_QUEST",
        "GOAT",
        "TL_STAR",
        "BEST_TL",
      ].includes(b.category),
      "Approved trophy category required.",
      400,
    );
    if (b.category === "BEST_TL") centre(u);
    const d = day(now, s.data.calendar),
      key =
        b.category === "BEST_TL"
          ? `${s._id}:BEST_TL`
          : `${b.userId}:${d}:${b.category}`;
    await ledger(
      ctx,
      "TROPHY",
      b.userId,
      {
        category: b.category,
        evidence: url(b.evidence),
        reason: text(b.reason, "Verified award evidence"),
      },
      key,
    );
  } else if (
    action === "energy-propose" ||
    action === "energy-decide" ||
    action === "energy-recover"
  ) {
    staff(u);
    demand(s.data.energyPolicy, "Energy policy is awaiting approval.", 409);
    const p = await one(
      "Policy",
      { _id: s.data.energyPolicy, cohortId },
      session,
    );
    demand(p);
    if (action === "energy-propose") {
      demand(t?.members.includes(b.userId));
      number(b.amount, -5, 5);
      demand(Number.isInteger(b.amount) && b.amount !== 0);
      const row = await ledger(
        ctx,
        "ENERGY_PROPOSAL",
        b.userId,
        {
          amount: b.amount,
          by: u._id,
          reason: text(b.reason, "Adjustment evidence"),
          state: "PENDING",
        },
        b.requestId,
      );
      result.proposalId = row._id;
    } else {
      centre(u);
      let proposal;
      if (action === "energy-decide") {
        proposal = await one(
          "Ledger",
          {
            _id: b.proposalId,
            cohortId,
            state: "ENERGY_PROPOSAL",
            "data.state": "PENDING",
          },
          session,
        );
        demand(
          proposal && proposal.data.by !== u._id,
          "A different CC must approve this pending proposal.",
        );
        ctx.t = team(s, u, proposal.teamId);
        demand(["APPROVE", "REJECT"].includes(b.decision));
        proposal.data.state = b.decision;
        proposal.data.decision = {
          by: u._id,
          at: now,
          reason: text(b.reason, "Independent approval"),
        };
        await put("Ledger", proposal, session);
        if (b.decision === "REJECT") return true;
      } else {
        demand(t?.members.includes(b.userId));
        text(b.reason, "Verified recovery");
      }
      const id = proposal?.userId || b.userId,
        records = await find(
          "Ledger",
          { cohortId, userId: id, state: "ENERGY" },
          session,
        ),
        old = records
          .sort((a, b) => (a.data.sequence || 0) - (b.data.sequence || 0))
          .at(-1)?.data;
      demand(old, "Energy record unavailable.", 409);
      const value = {
        ...old,
        sequence: (old.sequence || 0) + 1,
        policyId: p._id,
      };
      if (action === "energy-recover") {
        demand(old.rescue, "No open rescue.", 409);
        value.energy = 5;
        value.lives = number(b.lives, 1, 5);
        demand(
          Number.isInteger(value.lives),
          "Use a whole number of lives.",
          400,
        );
        value.rescue = false;
        value.losses = 0;
      } else {
        const amount = proposal.data.amount;
        value.energy = Math.max(0, Math.min(5, old.energy + amount));
        value.losses = amount < 0 ? (old.losses || 0) + 1 : 0;
        value.amount = amount;
        if (value.energy === 0 && amount < 0) {
          value.lives = Math.max(0, old.lives - 1);
          value.rescue = true;
          if (value.lives > 0 && p.data.value.zeroMode === "RESET_IF_LIVES") {
            value.energy = 5;
            value.rescue = false;
          }
        }
        value.coaching = value.losses >= 3;
        value.proposalId = proposal._id;
      }
      await ledger(ctx, "ENERGY", id, value, b.requestId);
    }
  } else if (action === "export") {
    staff(u);
    demand(
      s.data.rubric,
      "Approve the final rubric row map before grading.",
      409,
    );
    const teams = s.data.teams.filter((t) => allowed(u, t)),
      tasks = await find(
        "Task",
        {
          cohortId,
          sprintId: s._id,
          teamId: { $in: teams.map((t) => t.teamId) },
          "data.extensionId": { $exists: false },
        },
        session,
      ),
      rows = [];
    for (const task of tasks) {
      for (const id of [task.userId, task.data.coGamerId].filter((id) =>
        teams.some((t) => t.members.includes(id)),
      )) {
        const ev = task.data.evidence.filter((e) => e.by === id),
          notes = task.data.stages.filter((e) => e.by === id && e.note);
        if (ev.length || notes.length)
          rows.push({
            key: `${id}:${task._id}`,
            taskId: task._id,
            userId: id,
            teamId: task.teamId,
            fingerprint: hash({
              evidence: task.data.evidence,
              stages: task.data.stages,
            }),
            evidence: ev,
            notes,
            warning: ev.length
              ? "Human verification of linked application required."
              : "No file or executable evidence; stage notes alone do not prove correctness.",
            workplaceEvidence: await find(
              "Daily",
              {
                cohortId,
                sprintId: s._id,
                userId: id,
                state: { $in: ["CLOCK", "SOD", "EOD", "RULE_ACK", "HYGIENE"] },
              },
              session,
            ),
          });
      }
    }
    demand(rows.length, "No worked attributable evidence to export.", 409);
    const batch = {
      _id: randomUUID(),
      cohortId,
      sprintId: s._id,
      userId: u._id,
      state: "EXPORTED",
      createdAt: now,
      data: {
        rows,
        rubric: clone(s.data.rubric),
        rubricId: s.data.rubricId,
        prompt: text(b.prompt, "Approved manual AI instructions", 20, 16000),
        promptVersion: text(b.promptVersion, "Prompt version", 1, 70),
        reason: text(b.reason, "Export approval"),
      },
    };
    await put("Batch", batch, session);
    result.batchId = batch._id;
  } else if (["import", "mark-review", "mark-commit"].includes(action)) {
    staff(u);
    const batch = await one(
      "Batch",
      { _id: b.batchId, cohortId, sprintId: s._id },
      session,
    );
    demand(batch && (u.role === CC || batch.userId === u._id));
    for (const row of batch.data.rows) {
      team(s, u, row.teamId);
      const c = await getTask(ctx, row.taskId);
      demand(
        hash({ evidence: c.data.evidence, stages: c.data.stages }) ===
          row.fingerprint,
        "Assessment evidence changed; export a fresh batch.",
        409,
      );
    }
    if (action === "import") {
      demand(
        ["EXPORTED", "QUARANTINED"].includes(batch.state),
        "Use an audited correction for previously validated marks.",
        409,
      );
      const rows = b.rows || parseCsv(b.csv),
        errors = [],
        seen = new Set();
      const allowedColumns = new Set([
        "key",
        "cohort_id",
        "sprint_id",
        "task_id",
        "gamer_id",
        ...batch.data.rubric.map((c) => c.key),
        "total_score",
        "rationale",
        "review_flag",
      ]);
      demand(
        Array.isArray(rows) && rows.length <= 10000,
        "Bounded returned rows required.",
        400,
      );
      for (const row of rows) {
        demand(
          row && typeof row === "object" && !Array.isArray(row),
          "A marks row must be an object.",
          400,
        );
        if (Object.keys(row).some((k) => !allowedColumns.has(k)))
          errors.push(
            "Unexpected marks columns; human approval is recorded only by the reviewer.",
          );
        const source = batch.data.rows.find((x) => x.key === row.key);
        if (
          !source ||
          row.cohort_id !== cohortId ||
          row.sprint_id !== s._id ||
          row.task_id !== source.taskId ||
          row.gamer_id !== source.userId ||
          seen.has(row.key)
        ) {
          errors.push("Unknown, repeated or cross-scope assignment.");
          continue;
        }
        seen.add(row.key);
        let total = 0;
        for (const c of batch.data.rubric) {
          const raw = row[c.key],
            v = raw === "" || raw === null ? null : Number(raw);
          if (v !== null && (!Number.isFinite(v) || v < 0 || v > c.weight))
            errors.push(`Invalid criterion ${c.key}.`);
          if (v !== null) total += v;
        }
        if (
          row.total_score !== "" &&
          (!Number.isFinite(Number(row.total_score)) ||
            Math.abs(Number(row.total_score) - total) > 0.01)
        )
          errors.push("Criterion total mismatch.");
      }
      if (seen.size !== batch.data.rows.length)
        errors.push("Missing assignment rows.");
      batch.data.importHistory ||= [];
      if (batch.data.import) batch.data.importHistory.push(batch.data.import);
      batch.data.import = {
        rows,
        errors,
        at: now,
        by: u._id,
        sourceHash: hash(rows),
      };
      batch.state = errors.length ? "QUARANTINED" : "VALIDATED";
      result.errors = errors;
    } else if (action === "mark-review") {
      demand(
        batch.state === "VALIDATED",
        "Validate the complete import first.",
        409,
      );
      const row = batch.data.import.rows.find((x) => x.key === b.key);
      demand(row, "Marks row not found.", 404);
      const ratings = b.ratings;
      demand(
        ratings && Object.keys(ratings).length === 13,
        "Thirteen 0–4 ratings or explicit nulls required.",
        400,
      );
      demand(
        batch.data.rubric.every(
          (c) => ratings[c.key] === null || Number.isInteger(ratings[c.key]),
        ),
        "Use integer ratings from zero to four or explicit null.",
        400,
      );
      const scores = Object.fromEntries(
        batch.data.rubric.map((c) => [
          c.key,
          ratings[c.key] === null
            ? null
            : (number(ratings[c.key], 0, 4) / 4) * c.weight,
        ]),
      );
      row.history ||= [];
      if (row.human) row.history.push(row.human);
      row.human = {
        ratings,
        scores,
        total: Object.values(scores).every((v) => v === null)
          ? null
          : Object.values(scores).reduce((n, v) => n + (v || 0), 0),
        by: u._id,
        at: now,
        reason: text(b.reason, "Human evidence and rationale"),
      };
    } else {
      demand(
        batch.state === "VALIDATED" &&
          batch.data.import.rows.every((r) => r.human),
        "Review every suggestion before committing.",
        409,
      );
      for (const row of batch.data.import.rows) {
        ctx.t = team(
          s,
          u,
          batch.data.rows.find((x) => x.key === row.key).teamId,
        );
        await ledger(
          ctx,
          "ASSESSMENT",
          row.gamer_id,
          {
            batchId: batch._id,
            taskId: row.task_id,
            human: row.human,
            ai: Object.fromEntries(
              batch.data.rubric.map((c) => [c.key, row[c.key]]),
            ),
            rubricId: batch.data.rubricId,
          },
          `${batch._id}:${row.key}`,
        );
      }
      batch.state = "COMMITTED";
    }
    await put("Batch", batch, session);
  } else if (action === "core-results") {
    centre(u);
    demand(
      t &&
        Array.isArray(b.results) &&
        b.results.length === t.members.length &&
        new Set(b.results.map((x) => x.userId)).size === t.members.length &&
        b.results.every((x) => t.members.includes(x.userId)),
      "One approved core result per actual Gamer required.",
      400,
    );
    text(b.reason, "Verified source of final core results");
    demand(
      !(await one(
        "Ledger",
        { cohortId, sprintId: s._id, teamId: t.teamId, state: "CORE" },
        session,
      )),
      "Core results are sealed; use the correction action.",
      409,
    );
    for (const r of b.results)
      await ledger(
        ctx,
        "CORE",
        r.userId,
        {
          week: s.data.number + 1,
          score: number(r.score, 0, 100),
          source: url(r.evidence),
          reason: b.reason,
        },
        `${s._id}:${r.userId}`,
      );
  } else if (action === "core-correct") {
    centre(u);
    demand(t?.members.includes(b.userId));
    const old = await one(
      "Ledger",
      {
        cohortId,
        sprintId: s._id,
        teamId: t.teamId,
        userId: b.userId,
        state: "CORE",
      },
      session,
    );
    demand(old);
    old.data.history ||= [];
    old.data.history.push({
      score: old.data.score,
      source: old.data.source,
      by: u._id,
      at: now,
    });
    old.data.score = number(b.score, 0, 100);
    old.data.source = url(b.evidence);
    old.data.reason = text(b.reason, "Audited correction");
    await put("Ledger", old, session);
  } else if (action === "extension-publish") {
    centre(u);
    demand(
      (s.data.extensionIds || []).length < 3 ||
        (s.data.extensionIds || []).includes(
          `${cohortId}:EXTENSION:${b.policyVersion}`,
        ),
      "At most three approved advanced packs per weekly sprint.",
      409,
    );
    demand(
      b.template?.tasks?.length && b.template.tasks.length <= 40,
      "Approved extension cards required.",
      400,
    );
    graph(b.template.tasks);
    const codes = new Set(
      (await find("Task", { cohortId, sprintId: s._id }, session)).map(
        (c) => c.data.code,
      ),
    );
    for (const c of b.template.tasks) {
      text(c.title, "Extension task title", 3, 200);
      text(c.instructions, "Approved extension instructions", 20);
      demand(
        ["TT1", "TT2"].includes(c.tt) &&
          typeof c.owner === "string" &&
          /^[A-E]$/.test(c.owner),
        "Approved task type and role owner required.",
        400,
      );
      if (c.hours !== null && c.hours !== undefined) number(c.hours, 1, 40);
      demand(!codes.has(c.id), "Use unique extension task codes.", 400);
      demand(
        b.template.resources?.[c.id]?.author === "CURRICULUM",
        "Approved extension resources required.",
        400,
      );
      url(b.template.resources[c.id].url);
      text(b.template.resources[c.id].approval, "Curriculum approval");
      text(b.template.resources[c.id].version, "Resource version", 1, 70);
    }
    const id = await policy(ctx, "EXTENSION", b.policyVersion, b.template);
    s.data.extensionIds = [...new Set([...(s.data.extensionIds || []), id])];
  } else if (action === "extension-start") {
    demand(
      u.role === G &&
        t &&
        s.data.acceptances.some(
          (a) => a.teamId === t.teamId && a.decision === "ACCEPTED",
        ),
      "CC core acceptance required before extensions.",
      409,
    );
    demand(s.data.extensionIds?.includes(b.extensionId));
    const p = await one(
      "Policy",
      { _id: b.extensionId, cohortId, state: "EXTENSION" },
      session,
    );
    demand(p);
    for (const template of p.data.value.tasks) {
      const owner =
        t.members["ABCDE".indexOf(template.owner)] ||
        p.data.value.fallbackOwners?.[t.teamId]?.[template.id];
      demand(
        t.members.includes(owner),
        "Explicit approved fallback owner required.",
        400,
      );
      const id = `${s._id}:${t.teamId}:extension:${p._id}:${template.id}`;
      if (!(await one("Task", { _id: id }, session)))
        await put(
          "Task",
          {
            _id: id,
            cohortId,
            sprintId: s._id,
            teamId: t.teamId,
            userId: owner,
            state: "Ready",
            version: 1,
            createdAt: now,
            data: {
              ...template,
              code: template.id,
              extensionId: p._id,
              basic: p.data.value.resources[template.id],
              dueAt: p.data.value.dueAt
                ? iso(p.data.value.dueAt)
                : s.data.dueAt,
              originalDueAt: s.data.dueAt,
              stages: stages.map((name) => ({ name, state: "Not Started" })),
              evidence: [],
              dueHistory: [],
            },
          },
          session,
        );
    }
  } else if (action === "extension-verify") {
    staff(u);
    demand(t && s.data.bonusId, "An approved bonus cap is required.", 409);
    const tasks = await find(
      "Task",
      {
        cohortId,
        sprintId: s._id,
        teamId: t.teamId,
        "data.extensionId": b.extensionId,
      },
      session,
    );
    demand(
      tasks.length && tasks.every((c) => c.state === "Accepted"),
      "All extension cards must be independently accepted.",
      409,
    );
    demand(
      Array.isArray(b.results) &&
        new Set(b.results.map((x) => x.userId)).size === b.results.length,
    );
    for (const r of b.results) {
      demand(t.members.includes(r.userId) && r.userId !== u._id);
      await ledger(
        ctx,
        "EXTENSION",
        r.userId,
        {
          extensionId: b.extensionId,
          bonus: number(r.bonus, 0, s.data.bonusCap),
          evidence: url(r.evidence),
          reason: text(b.reason, "Verified additional delivery"),
        },
        `${s._id}:${b.extensionId}:${r.userId}`,
      );
    }
  } else if (action === "rule-followup" || action === "rule-consequence") {
    staff(u);
    demand(t?.members.includes(b.userId) && s.data.rulesVersion);
    const ack = await one(
      "Daily",
      {
        cohortId,
        sprintId: s._id,
        userId: b.userId,
        state: "RULE_ACK",
        "data.policyVersion": s.data.rulesVersion,
      },
      session,
    );
    demand(!ack, "Current rules already acknowledged.", 409);
    if (action === "rule-followup")
      await event(ctx, "RULE_EXPLAINED", {
        userId: b.userId,
        version: s.data.rulesVersion,
        evidence: text(b.reason, "Additional explanation"),
      });
    else {
      centre(u);
      demand(
        s.data.number === 2 &&
          now >= new Date(s.data.ruleConsequenceAt || "9999-01-01") &&
          (await one(
            "Event",
            {
              cohortId,
              sprintId: s._id,
              state: "RULE_EXPLAINED",
              "data.userId": b.userId,
              "data.version": s.data.rulesVersion,
            },
            session,
          )),
        "Approved Week 3 EOD and recorded explanation required.",
        409,
      );
      await ledger(
        ctx,
        "ACCOUNTABILITY",
        b.userId,
        {
          amount: -1,
          version: s.data.rulesVersion,
          reason: text(b.reason, "One-time consequence"),
        },
        `${b.userId}:week3-rules`,
      );
    }
  } else if (action === "sync") {
    staff(u);
    await synchronise(ctx);
  } else return false;
  return true;
}
async function noticeOnce(row, session) {
  await model("Notice").updateOne(
    { _id: row._id },
    { $setOnInsert: row },
    { upsert: true, session },
  );
}
async function synchronise(ctx) {
  const { s, cohortId, session, now } = ctx;
  if (!s.data.calendar || ["DRAFT", "CLOSED"].includes(s.state)) return;
  const tasks = await find("Task", { cohortId, sprintId: s._id }, session);
  for (const c of tasks) {
    if (!s.data.teams.find((t) => t.teamId === c.teamId)?.kickoff) continue;
    if (["Accepted", "In Review"].includes(c.state)) continue;
    if (now >= new Date(workingAt(c.data.dueAt, s.data.calendar, -120)))
      await noticeOnce(
        {
          _id: `${c._id}:warning:${hash(c.data.dueAt + s.data.calendar.timeZone)}`,
          cohortId,
          sprintId: s._id,
          teamId: c.teamId,
          userId: c.userId,
          state: "EXPECT_DELAY",
          createdAt: now,
          data: {
            taskId: c._id,
            text: "Expect delay? Confirm on track or record reason and revised ETA.",
            dueAt: c.data.dueAt,
          },
        },
        session,
      );
  }
  for (const r of await find(
    "Review",
    { cohortId, sprintId: s._id, state: "PENDING" },
    session,
  ))
    if (r.data.dueAt && now > new Date(r.data.dueAt))
      await noticeOnce(
        {
          _id: `${r._id}:sla`,
          cohortId,
          sprintId: s._id,
          teamId: r.teamId,
          userId: r.data.reviewerId,
          state: "REVIEW_SLA",
          createdAt: now,
          data: {
            reviewId: r._id,
            text: "Pending independent review is past its working-time SLA.",
          },
        },
        session,
      );
  for (const t of s.data.teams) {
    if (!t.kickoff) continue;
    for (const id of t.members) {
      if (
        s.data.rulesVersion &&
        !(await one(
          "Daily",
          {
            cohortId,
            sprintId: s._id,
            userId: id,
            state: "RULE_ACK",
            "data.policyVersion": s.data.rulesVersion,
          },
          session,
        ))
      ) {
        const reminders = (
            await find(
              "Notice",
              {
                cohortId,
                sprintId: s._id,
                userId: id,
                state: "RULE_REMINDER",
                "data.version": s.data.rulesVersion,
              },
              session,
            )
          ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
          last = reminders.at(-1);
        if (
          working(now, s.data.calendar) &&
          (!last ||
            now >= new Date(workingAt(last.createdAt, s.data.calendar, 120)))
        )
          await noticeOnce(
            {
              _id: randomUUID(),
              cohortId,
              sprintId: s._id,
              teamId: t.teamId,
              userId: id,
              state: "RULE_REMINDER",
              createdAt: now,
              data: {
                version: s.data.rulesVersion,
                text: "Read and acknowledge the current rulebook; ask for an explanation if needed.",
              },
            },
            session,
          );
      }
      const energy = (
          await find(
            "Ledger",
            { cohortId, userId: id, state: "ENERGY" },
            session,
          )
        ).sort((a, b) => (a.data.sequence || 0) - (b.data.sequence || 0)),
        old = energy.at(-1);
      if (!old || old.data.energy >= 5 || old.data.rescue) continue;
      const consumed = new Set(energy.flatMap((v) => v.data.sourceDays || [])),
        today = day(now, s.data.calendar),
        days = [];
      let cursor = new Date(today + "T12:00:00Z");
      for (let i = 0; i < 30 && days.length < 3; i++) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        const d = cursor.toISOString().slice(0, 10);
        if (
          !s.data.calendar.weekdays.includes(cursor.getUTCDay()) ||
          s.data.calendar.holidays.includes(d)
        )
          continue;
        const h = await one(
          "Daily",
          {
            cohortId,
            userId: id,
            state: "HYGIENE",
            "data.day": d,
            "data.qualifyingDay": true,
          },
          session,
        );
        if (
          !h ||
          consumed.has(d) ||
          energy.some(
            (e) => e.data.amount < 0 && day(e.createdAt, s.data.calendar) >= d,
          )
        )
          break;
        days.push(d);
      }
      if (days.length === 3) {
        ctx.t = t;
        await ledger(
          ctx,
          "ENERGY",
          id,
          {
            ...old.data,
            amount: 1,
            energy: Math.min(5, old.data.energy + 1),
            sequence: (old.data.sequence || 0) + 1,
            sourceDays: days,
            reason: "Three verified clean working days",
          },
          `${id}:clean:${days.join(":")}`,
        );
      }
    }
  }
}
export async function pilotSnapshot(actor, now = new Date()) {
  await connect();
  const a = await scope(actor),
    u = a.user,
    cohortId = cohortOf(u),
    s =
      (await model("Sprint")
        .findOne({ cohortId, state: { $ne: "CLOSED" } })
        .sort({ createdAt: -1 })
        .lean()) ||
      (await model("Sprint")
        .findOne({ cohortId })
        .sort({ createdAt: -1 })
        .lean());
  if (
    u.role === CC &&
    !permitted(u, "sprint:write") &&
    !permitted(u, "reports:read")
  )
    return null;
  const roster = await models.User.find({
    $and: [tenantOf(u), { active: { $ne: false } }],
  })
    .select("_id name role")
    .lean();
  const setup =
    u.role === CC && permitted(u, "sprint:write")
      ? {
          manifests,
          roster,
          source:
            (await models.WeekOneProgram.findById(cohortId).lean())?.data
              .recovery?.published?.teams || [],
        }
      : null;
  if (!s)
    return {
      setup,
      sprint: null,
      teams: [],
      names: {},
      tasks: [],
      reviews: [],
      handovers: [],
      clients: [],
      daily: [],
      notices: [],
      ledgers: [],
      recoveries: [],
      policies: [],
      meetings: [],
      batches: [],
      audit: [],
      sparks: [],
      stages,
    };
  const teams = s.data.teams.filter((t) => allowed(u, t)),
    teamIds = teams.map((t) => t.teamId),
    q = { cohortId, sprintId: s._id, teamId: { $in: teamIds } },
    staffUser = u.role !== G;
  const [
    tasks,
    reviews,
    handovers,
    clients,
    daily,
    notices,
    ledgers,
    recoveries,
    policies,
  ] = await Promise.all([
    find("Task", q),
    find("Review", q),
    find("Handover", q),
    find("Client", q),
    find("Daily", { ...q, ...(!staffUser ? { userId: u._id } : {}) }),
    find("Notice", {
      cohortId,
      sprintId: s._id,
      $or: [
        { teamId: { $in: teamIds } },
        ...(staffUser ? [{ state: "WORKER_FAILURE" }] : []),
      ],
    }),
    find("Ledger", {
      cohortId,
      ...(!staffUser ? { userId: u._id } : { teamId: { $in: teamIds } }),
    }),
    find("Recovery", { ...q, ...(!staffUser ? { userId: u._id } : {}) }),
    find("Policy", {
      cohortId,
      ...(!staffUser
        ? {
            _id: {
              $in: [
                s.data.rulesId,
                s.data.challengeId,
                ...(s.data.extensionIds || []),
              ].filter(Boolean),
            },
          }
        : {}),
    }),
  ]);
  const safeSprint = clone(s);
  const batches = staffUser
    ? await find("Batch", {
        cohortId,
        sprintId: s._id,
        ...(u.role === MC ? { userId: u._id } : {}),
      })
    : [];
  const audit = staffUser
    ? (
        await find("Event", {
          cohortId,
          sprintId: s._id,
          ...(u.role === MC
            ? { $or: [{ teamId: { $in: teamIds } }, { userId: u._id }] }
            : {}),
        })
      )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100)
    : [];
  safeSprint.data.teams = teams;
  safeSprint.data.acceptances = s.data.acceptances.filter((x) =>
    teamIds.includes(x.teamId),
  );
  safeSprint.data.gates = s.data.gates.filter((x) =>
    teamIds.includes(x.teamId),
  );
  if (!setup) {
    delete safeSprint.data.resources;
    delete safeSprint.data.template?.resources;
  }
  const currentDay = day(now, s.data.calendar);
  const sparks = teams.map((t) => {
    const list = tasks
        .filter(
          (c) =>
            c.teamId === t.teamId &&
            t.members.includes(c.userId) &&
            !c.data.extensionId,
        )
        .sort((a, b) => a._id.localeCompare(b._id)),
      c =
        list[
          parseInt(hash(currentDay + t.teamId).slice(0, 6), 16) % list.length
        ];
    return {
      teamId: t.teamId,
      text: c ? `Who owns ${c.data.code}: ${c.data.title}?` : null,
      choices: t.members,
      answered: ledgers.some(
        (l) =>
          l.state === "SPARK" &&
          l.data.day === currentDay &&
          l.userId === u._id,
      ),
    };
  });
  const names = Object.fromEntries(
    roster
      .filter(
        (x) =>
          teams.some(
            (t) => t.members.includes(x._id) || t.commanderId === x._id,
          ) || x._id === u._id,
      )
      .map((x) => [x._id, x.name]),
  );
  return {
    setup,
    meetings: await find("Daily", {
      ...q,
      state: {
        $in: staffUser
          ? ["MEETING", "TEAM_EOD", "MC_EXCEPTIONS"]
          : ["MEETING", "TEAM_EOD"],
      },
    }),
    batches,
    audit,
    sprint: safeSprint,
    teams,
    names,
    tasks: tasks.map((c) => {
      const card = clone(c);
      delete card.data.basic.GUIDE;
      delete card.data.basic.AI_PROMPT;
      return card;
    }),
    reviews,
    handovers,
    clients: clients
      .filter((c) => staffUser || c.state !== "PROPOSED")
      .map((c) => {
        const x = clone(c);
        if (x.data.item) {
          delete x.data.item.GUIDE;
          delete x.data.item.AI_PROMPT;
        }
        return x;
      }),
    daily,
    notices,
    ledgers,
    recoveries,
    policies: policies
      .map((p) =>
        p.state === "EXTENSION" &&
        !staffUser &&
        !teams.some((t) =>
          s.data.acceptances.some(
            (a) => a.teamId === t.teamId && a.decision === "ACCEPTED",
          ),
        )
          ? {
              _id: p._id,
              state: p.state,
              data: { version: p.data.version, locked: true },
            }
          : p,
      )
      .filter(Boolean),
    sparks,
    stages,
  };
}

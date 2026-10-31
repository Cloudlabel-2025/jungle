import { NextResponse } from "next/server";
import { allowedWriteOrigin } from "@/lib/request-origin.js";
import {
  currentUser,
  setSession,
  clearSession,
  demoEnabled,
  assertRole,
} from "@/lib/auth.js";
import { models, connect, transaction } from "@/lib/db.js";
import { snapshot } from "@/lib/snapshot.js";
import { programAudit } from "@/lib/week-one-program.js";
import { programAction, programSnapshot } from "@/lib/week-one-program.js";
import { dayOneSnapshot, dayOneAction, dayOneSignIn } from "@/lib/day-one.js";
import { weekOneSnapshot, weekOneAction } from "@/lib/week-one.js";
import { supportAction, supportSnapshot } from "@/lib/support.js";
import { comparisonTotals } from "@/lib/effort-rules.js";
import { checkPassword } from "@/lib/password.js";
import { challengeAction, taskAudit } from "@/lib/challenges.js";
import { projectAction } from "@/lib/projects.js";
import { publishedLevels } from "@/lib/published-levels.js";
import { levelAction } from "@/lib/level-authoring.js";
import { chooseCharacter } from "@/lib/character-actions.js";
import { teamAction } from "@/lib/team-management.js";
import { characters, characterKey } from "@/lib/characters.js";
import { teamRoles, playerRole } from "@/lib/team-roles.js";
import { award, deduct, id } from "@/lib/engine.js";
import { DAILY_XP_CAP } from "@/lib/rewards.js";
import { modules, personas, perks, rules } from "@/lib/catalog.js";
import {
  ist,
  attendanceRule,
  allowedReports,
  allowedStates,
} from "@/lib/rules.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const all = ["GAMER", "MISSION_COMMANDER", "CENTRE_COMMAND"];
const staff = ["MISSION_COMMANDER", "CENTRE_COMMAND"];
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function text(value, label, min = 1, max = 4000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
async function gamer(id, session) {
  const u = await models.User.findOne({ _id: id, role: "GAMER" }).session(
    session,
  );
  if (!u) fail("Operative not found.", 404);
  return u;
}
async function handle(request, { params }) {
  try {
    const { path } = await params;
    const route = path.join("/");
    if (request.method === "POST") {
      if (!allowedWriteOrigin(request))
        fail("Cross-origin writes are not allowed.", 403);
      if (Number(request.headers.get("content-length") || 0) > 100000)
        fail("Request is too large.", 413);
    }
    const body = request.method === "POST" ? await request.json() : {};
    if (JSON.stringify(body).length > 100000)
      fail("Request is too large.", 413);
    await connect();
    if (route === "auth/personas" && request.method === "GET")
      return NextResponse.json({
        personas: demoEnabled() ? personas : [],
        demo: demoEnabled(),
      });
    if (route === "auth/login" && request.method === "POST") {
      if (body.password !== undefined) {
        const identity = text(
          body.username ?? body.identifier ?? body.email,
          "Username or email",
          3,
          120,
        ).toLowerCase();
        const user = await models.User.findOne(
          identity.includes("@") ? { email: identity } : { username: identity },
        ).lean();
        const credential =
          user &&
          user.active !== false &&
          (await models.Credential.findById(user._id));
        if (!credential || credential.lockedUntil > new Date())
          fail("Invalid credentials or account temporarily locked.", 401);
        const attempt = await models.Credential.findOneAndUpdate(
          {
            _id: user._id,
            $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }],
          },
          { $inc: { failures: 1 } },
          { new: true },
        );
        if (!attempt)
          fail("Invalid credentials or account temporarily locked.", 401);
        if (
          attempt.failures > 5 ||
          !(await checkPassword(body.password, credential.passwordHash))
        ) {
          if (attempt.failures >= 5)
            await models.Credential.updateOne(
              { _id: user._id },
              {
                $set: {
                  lockedUntil: new Date(Date.now() + 15 * 60000),
                  failures: 0,
                },
              },
            );
          fail("Invalid credentials or account temporarily locked.", 401);
        }
        await models.Credential.updateOne(
          { _id: user._id },
          { $set: { failures: 0, lockedUntil: null } },
        );
        await setSession(user._id);
        await dayOneSignIn(user);
        return NextResponse.json({ success: true, user });
      }
      if (!demoEnabled())
        fail(
          "Persona login is disabled. Enable DEMO_MODE only for a private simulation.",
          403,
        );
      if (
        process.env.DEMO_ACCESS_CODE &&
        body.accessCode !== process.env.DEMO_ACCESS_CODE
      )
        fail("Invalid arena access code.", 401);
      const email = text(body.email, "Email", 3, 120);
      if (!personas.some((persona) => persona.email === email))
        fail(
          "Use your username and password. Persona switching is only available for demo accounts.",
          403,
        );
      const user = await models.User.findOne({ email }).lean();
      if (!user || user.active === false)
        fail("Unknown or inactive persona.", 404);
      await setSession(user._id);
      await dayOneSignIn(user);
      return NextResponse.json({ success: true, user });
    }
    if (route === "auth/logout" && request.method === "POST") {
      await clearSession();
      return NextResponse.json({ success: true });
    }
    const user = await currentUser();
    if (route === "auth/me" && request.method === "GET")
      return NextResponse.json({
        authenticated: !!user,
        user,
        serverTime: new Date().toISOString(),
      });
    assertRole(user, all);
    if (route === "week1/audit" && request.method === "GET") {
      const search = new URL(request.url).searchParams;
      return NextResponse.json(
        await programAudit(user, {
          cursor: search.get("cursor"),
          kind: search.get("kind"),
        }),
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (route === "week1/program" && request.method === "GET")
      return NextResponse.json(await programSnapshot(user), {
        headers: { "Cache-Control": "no-store" },
      });
    if (
      path[0] === "week1" &&
      path[1] === "program" &&
      path.length === 3 &&
      request.method === "POST"
    )
      return NextResponse.json(await programAction(user, path[2], body));
    if (route === "week1/state" && request.method === "GET")
      return NextResponse.json(await weekOneSnapshot(user), {
        headers: { "Cache-Control": "no-store" },
      });
    if (path[0] === "week1" && path.length === 2 && request.method === "POST")
      return NextResponse.json(await weekOneAction(user, path[1], body));
    if (route === "day1/state" && request.method === "GET")
      return NextResponse.json(await dayOneSnapshot(user), {
        headers: { "Cache-Control": "no-store" },
      });
    if (path[0] === "day1" && path.length === 2 && request.method === "POST")
      return NextResponse.json(await dayOneAction(user, path[1], body));
    if (
      path[0] === "centre-command" &&
      path[1] === "teams" &&
      path.length === 3 &&
      request.method === "POST"
    )
      return NextResponse.json({
        success: true,
        ...(await teamAction(user, path[2], body)),
      });
    if (route === "gamer/character" && request.method === "POST")
      return NextResponse.json({
        success: true,
        ...(await chooseCharacter(user, body)),
      });
    if (
      path[0] === "levels" &&
      path.length === 2 &&
      request.method === "POST"
    ) {
      assertRole(user, ["CENTRE_COMMAND"]);
      return NextResponse.json({
        success: true,
        ...(await levelAction(user, path[1], body)),
      });
    }
    if (
      path[0] === "projects" &&
      path.length === 2 &&
      request.method === "POST"
    )
      return NextResponse.json({
        success: true,
        ...(await projectAction(user, path[1], body)),
      });
    if (
      ["gamer/task-status", "commander/task"].includes(route) &&
      request.method === "POST" &&
      (await models.Task.exists({
        _id: body.taskId,
        projectAttemptId: { $type: "string" },
      }))
    ) {
      assertRole(user, route.startsWith("gamer/") ? ["GAMER"] : staff);
      return NextResponse.json({
        success: true,
        ...(await projectAction(user, "task", body)),
      });
    }
    if (route === "challenges" && request.method === "GET") {
      const state = await snapshot(user);
      return NextResponse.json(
        {
          challenges: state.challenges,
          tasks: state.tasks,
          taskEvents: state.taskEvents,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      path[0] === "challenges" &&
      path.length === 2 &&
      request.method === "POST"
    ) {
      return NextResponse.json({
        success: true,
        ...(await challengeAction(user, path[1], body)),
      });
    }
    if (route === "support/comparisons/export" && request.method === "GET") {
      assertRole(user, ["CENTRE_COMMAND"]);
      const state = await supportSnapshot(user);
      const filters = new URL(request.url).searchParams;
      const technology = (filters.get("technology") || "").toLowerCase();
      const umbrella = filters.get("umbrella");
      const comparisons = state.effort.comparisons.filter(
        (r) =>
          r.technology.toLowerCase().includes(technology) &&
          (!umbrella ||
            state.tickets.find((t) => t._id === r.repeatTicketId)?.category ===
              umbrella),
      );
      return NextResponse.json(
        {
          label: "Verified difference between comparable tasks",
          cohortId: user.cohortId || "alpha",
          exportedAt: new Date().toISOString(),
          totals: comparisonTotals(comparisons),
          comparisons: comparisons.filter((r) => r.status === "VERIFIED"),
          caveat:
            "Descriptive reviewed evidence; prior experience, reuse, AI, coaching, workload and task difficulty may affect effort. No causal productivity claim.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "Content-Disposition":
              'attachment; filename="codewild-verified-comparisons.json"',
          },
        },
      );
    }
    if (route === "support/export" && request.method === "GET") {
      assertRole(user, ["CENTRE_COMMAND"]);
      return NextResponse.json(await supportSnapshot(user), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition":
            'attachment; filename="codewild-support-evidence.json"',
        },
      });
    }
    if (route === "support" && request.method === "GET")
      return NextResponse.json(await supportSnapshot(user), {
        headers: { "Cache-Control": "no-store" },
      });
    if (route.startsWith("support/") && request.method === "POST") {
      await supportAction(user, path[1], body);
      return NextResponse.json({ success: true });
    }
    if (request.method === "GET") {
      if (route === "state") return NextResponse.json(await snapshot(user));
      if (route === "gamer/lab") {
        assertRole(user, ["GAMER"]);
        const saved = await models.Lab.findById(user._id).lean();
        return NextResponse.json({
          files: saved
            ? Object.fromEntries(
                saved.files.map((file) => [file.path, file.content]),
              )
            : null,
          updatedAt: saved?.updatedAt,
        });
      }
      if (route.startsWith("gamer/")) {
        assertRole(user, ["GAMER"]);
        const data = await snapshot(user);
        const mapping = {
          journal: data.journals,
          messages: data.messages,
          modules: { modules: data.modules, progress: data.progress },
          rewards: {
            ledger: data.trophies,
            rankings: data.leaderboard,
            experience: data.experience,
            perks: data.perks,
          },
        };
        if (!(path[1] in mapping)) fail("Endpoint not found.", 404);
        return NextResponse.json(mapping[path[1]]);
      }
      if (route === "commander/data") {
        assertRole(user, staff);
        return NextResponse.json(await snapshot(user));
      }
      if (
        route === "centre-command/data" ||
        route === "centre-command/reports"
      ) {
        assertRole(user, ["CENTRE_COMMAND"]);
        const data = await snapshot(user);
        if (new URL(request.url).searchParams.get("format") === "csv") {
          const [allTrophies, allEnergy, allExperience] = await Promise.all([
            models.Trophy.find().sort({ createdAt: 1 }).lean(),
            models.Energy.find().sort({ createdAt: 1 }).lean(),
            models.Experience.find().sort({ createdAt: 1 }).lean(),
          ]);
          const esc = (x) =>
            '"' +
            String(x ?? "")
              .replaceAll('"', '""')
              .replace(/^[=+@\-]/, "'$&") +
            '"';
          const lines = [
            ["Event", "Operative", "Amount", "Reason", "Timestamp", "Currency"],
            ...allTrophies.map((t) => [
              t._id,
              data.roster.find((u) => u._id === t.userId)?.name,
              t.amount,
              t.reason,
              t.createdAt,
              "TROPHIES",
            ]),
            ...allEnergy.map((t) => [
              t._id,
              data.roster.find((u) => u._id === t.userId)?.name,
              t.change,
              t.reason,
              t.createdAt,
              t.resource === "ENERGY" ? "ENERGY" : "HP",
            ]),
            ...allExperience.map((t) => [
              t._id,
              data.roster.find((u) => u._id === t.userId)?.name,
              t.amount,
              t.reason,
              t.createdAt,
              "XP",
            ]),
          ];
          return new Response(
            lines.map((row) => row.map(esc).join(",")).join("\r\n"),
            {
              headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition":
                  'attachment; filename="codewild-audit.csv"',
                "Cache-Control": "no-store",
              },
            },
          );
        }
        return NextResponse.json(data);
      }
      fail("Endpoint not found.", 404);
    }
    if (request.method !== "POST") fail("Method not allowed.", 405);
    await transaction(async (session) => {
      const now = new Date();
      const day = ist(now).day;
      if (route === "gamer/clock-in") {
        assertRole(user, ["GAMER"]);
        const { onTime } = attendanceRule(now, body.latenessReason || "");
        if (
          await models.Attendance.exists({ userId: user._id, day }).session(
            session,
          )
        )
          fail("You have already checked in today.", 409);
        await models.Attendance.create(
          [
            {
              _id: id(),
              userId: user._id,
              day,
              clockAt: now,
              onTime,
              reason: body.latenessReason || "",
            },
          ],
          { session },
        );
        if (onTime)
          await award(
            user._id,
            1,
            "On-time punch-in",
            `attendance:${user._id}:${day}`,
            session,
          );
        else
          await deduct(
            user._id,
            "Late attendance",
            1,
            `late:${user._id}:${day}`,
            session,
          );
      } else if (route === "gamer/task-status") {
        assertRole(user, ["GAMER"]);
        const task = await models.Task.findOne({
          _id: body.taskId,
          assigneeId: user._id,
          teamId: user.teamId,
        }).session(session);
        if (!task) fail("This quest is not assigned to you.", 403);
        if (body.preDeadlineStatus) {
          if (!allowedReports.includes(body.preDeadlineStatus))
            fail("Invalid report.");
          if (now >= task.dueAt)
            fail(
              "The deadline has passed. The late communication infraction is recorded automatically.",
              409,
            );
          task.report = body.preDeadlineStatus;
          task.reportedAt = now;
        }
        if (body.status) {
          const before = task.status;
          if (!allowedStates.includes(body.status))
            fail("Invalid quest state.");
          if (task.status === "Done") fail("Approved quests are sealed.");
          if (task.dependencyId && body.status !== "Backlog") {
            const dependency = await models.Task.findById(
              task.dependencyId,
            ).session(session);
            if (dependency?.status !== "Done")
              fail("Complete and approve the dependency first.", 409);
          }
          if (body.status === "Done")
            fail("Submit for Review; your Commander seals completed quests.");
          if (task.challengeId && task.status === "Review")
            fail("Your submission is awaiting Commander review.", 409);
          if (task.challengeId && body.status === "Review") {
            if (
              !Array.isArray(body.evidenceReferences) ||
              !body.evidenceReferences.length ||
              body.evidenceReferences.length > 10
            )
              fail("Supply 1–10 completion evidence references.");
            task.submissionSummary = text(
              body.submissionSummary,
              "Completion summary",
              10,
            );
            task.evidenceReferences = body.evidenceReferences.map((value) =>
              text(value, "Evidence reference", 3, 1000),
            );
            task.submittedAt = now;
            task.submissionVersion += 1;
            task.reviewFeedback = "";
            await taskAudit(
              task,
              user,
              "SUBMITTED",
              {
                summary: task.submissionSummary,
                evidenceReferences: task.evidenceReferences,
                version: task.submissionVersion,
              },
              session,
            );
          }
          task.status = body.status;
          await taskAudit(
            task,
            user,
            "STATE_CHANGED",
            { before, after: task.status },
            session,
          );
        }
        await task.save({ session });
      } else if (route === "gamer/journal") {
        assertRole(user, ["GAMER"]);
        if (
          body.supportTicketId &&
          !(await models.HelpTicket.exists({
            _id: body.supportTicketId,
            createdBy: user._id,
          }).session(session))
        )
          fail("Link only your own support ticket.", 403);
        if (
          await models.Journal.exists({ userId: user._id, day }).session(
            session,
          )
        )
          fail("Today’s flight log is sealed and cannot be edited.", 409);
        await models.Journal.create(
          [
            {
              _id: id(),
              userId: user._id,
              teamId: user.teamId,
              day,
              workDone: text(body.workDone, "Completed work", 10),
              learnings: text(body.learnings, "Learnings", 10),
              blockers:
                typeof body.blockers === "string"
                  ? body.blockers.slice(0, 4000)
                  : "",
              tomorrowPlan: text(body.tomorrowPlan, "Tomorrow’s plan", 10),
              supportTicketIds: body.supportTicketId
                ? [body.supportTicketId]
                : [],
              submittedAt: now,
            },
          ],
          { session },
        );
      } else if (route === "gamer/messages") {
        assertRole(user, ["GAMER"]);
        const recent = await models.Message.countDocuments({
          senderId: user._id,
          createdAt: { $gte: new Date(Date.now() - 60000) },
        }).session(session);
        if (recent >= 20) fail("Comms rate limit: try again in a minute.", 429);
        await models.Message.create(
          [
            {
              _id: id(),
              teamId: user.teamId,
              senderId: user._id,
              senderName: user.name,
              message: text(body.message, "Message", 1, 2000),
              isBlocker: body.isBlocker === true,
            },
          ],
          { session },
        );
      } else if (route === "gamer/modules") {
        assertRole(user, ["GAMER"]);
        const module = modules.find((m) => m._id === body.moduleId);
        if (!module) fail("Module not found.", 404);
        if (body.answer !== module.answer)
          fail(
            "That answer needs another look. Review the field notes and try again.",
          );
        if (
          await models.Progress.exists({
            userId: user._id,
            moduleId: module._id,
          }).session(session)
        )
          fail("Module already completed.", 409);
        await models.Progress.create(
          [{ _id: id(), userId: user._id, moduleId: module._id }],
          { session },
        );
        await award(
          user._id,
          module.xp,
          `Foundation: ${module.title}`,
          `module:${user._id}:${module._id}`,
          session,
        );
      } else if (route === "gamer/lab") {
        assertRole(user, ["GAMER"]);
        const keys = ["src/App.jsx", "src/styles.css", "tests/ledger.test.js"];
        if (
          !body.files ||
          Object.keys(body.files).length !== 3 ||
          !keys.every(
            (k) =>
              typeof body.files[k] === "string" &&
              body.files[k].length <= 25000,
          )
        )
          fail("Invalid virtual project. Each file must be under 25 KB.");
        await models.Lab.updateOne(
          { _id: user._id },
          {
            $set: {
              files: Object.entries(body.files).map(([path, content]) => ({
                path,
                content,
              })),
              updatedAt: now,
            },
          },
          { upsert: true, session },
        );
      } else if (route === "commander/task") {
        assertRole(user, staff);
        const task = await models.Task.findById(body.taskId).session(session);
        if (!task) fail("Quest not found.", 404);
        if (body.action === "approve") {
          if (task.status !== "Review")
            fail("Only quests in Review can be approved.");
          if (
            task.challengeId &&
            (!task.submittedAt ||
              !task.submissionSummary ||
              !task.evidenceReferences.length)
          )
            fail(
              "Challenge tasks need a completion summary and evidence before approval.",
            );
          task.status = "Done";
          task.approvedAt = now;
          await taskAudit(
            task,
            user,
            "APPROVED",
            { submissionVersion: task.submissionVersion },
            session,
          );
          await award(
            task.assigneeId,
            task.xp,
            `Quest approved: ${task.title}`,
            `quest:${task._id}`,
            session,
          );
        } else if (body.action === "return") {
          if (task.status !== "Review")
            fail("Only quests in Review can be returned.");
          task.status = "In Progress";
          if (task.challengeId) {
            task.reviewFeedback = text(body.feedback, "Review feedback", 10);
            await taskAudit(
              task,
              user,
              "RETURNED",
              {
                feedback: task.reviewFeedback,
                submissionVersion: task.submissionVersion,
              },
              session,
            );
          }
        } else if (body.action === "reassign") {
          if (task.status === "Done") fail("Approved quests are sealed.");
          const next = await gamer(body.userId, session);
          if (next.active === false) fail("Select an active player.");
          if (next.teamId !== task.teamId)
            fail("Reassign within the quest’s squad.");
          if (task.challengeId && playerRole(next) !== task.targetRole)
            fail(
              "Challenge tasks must be reassigned to a player with the target team role.",
            );
          const previous = task.assigneeId;
          task.assigneeId = next._id;
          await taskAudit(
            task,
            user,
            "REASSIGNED",
            {
              previous,
              next: next._id,
              reason: task.challengeId
                ? text(body.reason, "Reassignment reason", 10)
                : undefined,
            },
            session,
          );
        } else fail("Unknown quest action.");
        await task.save({ session });
      } else if (route === "commander/blocker") {
        assertRole(user, staff);
        const message = await models.Message.findOne({
          _id: body.messageId,
          isBlocker: true,
        }).session(session);
        if (!message) fail("Blocker not found.", 404);
        message.resolvedAt = now;
        await message.save({ session });
      } else if (route === "commander/rules") {
        assertRole(user, staff);
        await gamer(body.userId, session);
        const rule = rules.find((r) => r._id === Number(body.ruleId));
        if (!rule) fail("Unknown D18 rule.");
        if (
          body.deduction !== undefined &&
          body.deduction !== 1 &&
          body.deduction !== -1
        )
          fail("An infraction deducts exactly one energy.");
        const eventKey = text(body.eventKey, "Idempotency key", 10, 150);
        await deduct(
          body.userId,
          text(body.notes, "Infraction notes", 10),
          rule._id,
          `manual:${eventKey}`,
          session,
        );
      } else if (route === "commander/coaching") {
        assertRole(user, staff);
        await gamer(body.userId, session);
        if (
          !Number.isInteger(body.standupRating) ||
          body.standupRating < 1 ||
          body.standupRating > 5
        )
          fail("Standup rating must be 1–5.");
        await models.Coaching.create(
          [
            {
              _id: id(),
              userId: body.userId,
              authorId: user._id,
              notes: text(body.notes, "Coaching notes", 10),
              standupRating: body.standupRating,
            },
          ],
          { session },
        );
      } else if (route === "commander/rescue") {
        assertRole(user, staff);
        const rescue = await models.Rescue.findById(body.rescueId).session(
          session,
        );
        if (!rescue) fail("Rescue case not found.", 404);
        if (rescue.status === "CLOSED") fail("This rescue case is closed.");
        rescue.plan = text(body.plan, "Remediation plan", 20);
        rescue.status = "RECOVERING";
        await rescue.save({ session });
      } else if (route === "commander/proposals") {
        assertRole(user, ["MISSION_COMMANDER"]);
        await gamer(body.recipientId, session);
        if (!perks.some((p) => p._id === body.perkId)) fail("Unknown perk.");
        await models.Proposal.create(
          [
            {
              _id: id(),
              proposerId: user._id,
              recipientId: body.recipientId,
              perkId: body.perkId,
              rationale: text(body.rationale, "Justification", 15),
              approvers: [],
            },
          ],
          { session },
        );
      } else if (route === "centre-command/approvals") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const proposal = await models.Proposal.findById(
          body.proposalId,
        ).session(session);
        if (!proposal) fail("Proposal not found.", 404);
        if (proposal.status !== "PENDING_APPROVAL")
          fail("Proposal is already sealed.", 409);
        if (
          proposal.proposerId === user._id ||
          proposal.approvers.includes(user._id)
        )
          fail(
            "A different Centre Command lead must review this proposal.",
            409,
          );
        if (body.action === "REJECT") {
          proposal.status = "REJECTED";
          proposal.rejectedBy = user._id;
        } else if (body.action === "APPROVE") {
          proposal.approvers.push(user._id);
          if (proposal.approvers.length >= 2) {
            proposal.status = "APPROVED";
            if (proposal.kind === "XP_OVERRIDE")
              await award(
                proposal.recipientId,
                proposal.amount,
                `Emergency override: ${proposal.rationale}`,
                `override:${proposal._id}`,
                session,
                true,
              );
            if (proposal.kind === "HP_OVERRIDE") {
              const operative = await gamer(proposal.recipientId, session);
              const change = Math.min(proposal.amount, 5 - operative.hp);
              operative.hp += change;
              if (change > 0) operative.energy = 3;
              await operative.save({ session });
              await models.Energy.create(
                [
                  {
                    _id: id(),
                    userId: operative._id,
                    change,
                    result: operative.hp,
                    resource: "LIFE",
                    energyResult: operative.hp > 0 ? operative.energy : 0,
                    lifeChange: change,
                    reason: `Two-lead emergency restoration: ${proposal.rationale}`,
                    eventKey: `override:${proposal._id}`,
                    day,
                  },
                ],
                { session },
              );
            }
          }
        } else fail("Unknown review action.");
        await proposal.save({ session });
      } else if (route === "centre-command/override") {
        assertRole(user, ["CENTRE_COMMAND"]);
        await gamer(body.recipientId, session);
        if (!["HP_OVERRIDE", "XP_OVERRIDE"].includes(body.kind))
          fail("Invalid override type.");
        if (
          !Number.isInteger(body.amount) ||
          body.amount < 1 ||
          body.amount > (body.kind === "HP_OVERRIDE" ? 5 : DAILY_XP_CAP)
        )
          fail("Override amount is outside the allowed range.");
        await models.Proposal.create(
          [
            {
              _id: id(),
              proposerId: user._id,
              recipientId: body.recipientId,
              perkId: body.kind,
              kind: body.kind,
              amount: body.amount,
              rationale: text(body.rationale, "Emergency justification", 20),
              approvers: [],
            },
          ],
          { session },
        );
      } else if (route === "centre-command/client-control") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const cohort = await models.Cohort.findById("alpha").session(session);
        if (cohort.currentWeek < 3)
          fail("Client disruptions unlock in week 3.", 409);
        await models.ClientEvent.create(
          [
            {
              _id: id(),
              title: text(body.title, "Title", 5, 120),
              description: text(body.description, "Client change", 20),
              disruptionType: text(
                body.disruptionType,
                "Disruption type",
                2,
                60,
              ),
              broadcastAt: now,
              creatorId: user._id,
            },
          ],
          { session },
        );
      } else if (route === "centre-command/setup") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const cohort = await models.Cohort.findById("alpha").session(session);
        if (body.version !== cohort.version)
          fail("Arena configuration changed. Refresh before saving.", 409);
        cohort.name = text(body.name, "Cohort name", 3, 100);
        cohort.college = text(body.college, "College name", 3, 150);
        cohort.scenario = text(body.scenario, "Scenario", 10, 1000);
        if (
          !Number.isInteger(body.currentWeek) ||
          body.currentWeek < 1 ||
          body.currentWeek > 52
        )
          fail("Week must be 1–52.");
        cohort.currentWeek = body.currentWeek;
        cohort.version++;
        await cohort.save({ session });
      } else if (route === "centre-command/roster") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const operative = await gamer(body.userId, session);
        const nextTeamId = body.teamId || operative.teamId;
        if (!(await models.Team.exists({ _id: nextTeamId }).session(session)))
          fail("Unknown squad.");
        if (nextTeamId !== operative.teamId) {
          if (
            (await models.User.countDocuments({
              teamId: nextTeamId,
              role: "GAMER",
            }).session(session)) >= 5
          )
            fail("The destination team already has five members.", 409);
          const activeProjects = await models.ProjectAttempt.find({
            teamId: operative.teamId,
            status: { $ne: "CLEARED" },
          })
            .select("_id")
            .session(session)
            .lean();
          if (
            await models.Task.exists({
              assigneeId: operative._id,
              projectAttemptId: { $in: activeProjects.map((a) => a._id) },
            }).session(session)
          )
            fail(
              "This player contributes to an active team project. Complete it or reassign their work before changing teams.",
              409,
            );
        }
        if (
          nextTeamId !== operative.teamId &&
          (await models.Task.exists({
            assigneeId: operative._id,
            $or: [
              { challengeId: { $type: "string" } },
              { projectAttemptId: { $type: "string" } },
            ],
            status: { $ne: "Done" },
          }).session(session))
        )
          fail(
            "This player has open challenge tasks. Reassign those within the original team or complete them before changing teams.",
            409,
          );
        await models.Cohort.updateOne(
          { _id: "alpha" },
          { $inc: { rosterVersion: 1 } },
          { session },
        );
        if (body.teamRoleCode) {
          const selected = teamRoles.find((r) => r.code === body.teamRoleCode);
          if (!selected) fail("Unknown team role.");
          operative.teamRoleCode = selected.code;
          operative.assignment = selected.label;
        }
        if (body.characterKey) {
          if (!characters.some((c) => c.key === body.characterKey))
            fail("Unknown character.");
          const currentKey = characterKey(operative);
          const peers = await models.User.find({
            teamId: nextTeamId,
            role: "GAMER",
            active: { $ne: false },
            _id: { $ne: operative._id },
          }).session(session);
          const holders = peers.filter(
            (p) => characterKey(p) === body.characterKey,
          );
          if (holders.length > 1)
            fail(
              "Resolve duplicate character identities in this squad first.",
              409,
            );
          if (holders.length && operative.teamId !== nextTeamId)
            fail(
              "Choose an unused character when moving a player to another squad.",
              409,
            );
          if (holders.length && body.characterKey !== currentKey) {
            if (!currentKey) fail("Assign an unused character first.", 409);
            holders[0].characterKey = currentKey;
            await holders[0].save({ session });
          }
          operative.characterKey = body.characterKey;
        }
        if (body.characterVariant) {
          if (!["male", "female"].includes(body.characterVariant))
            fail("Choose a valid character version.");
          operative.characterVariant = body.characterVariant;
        }
        operative.teamId = nextTeamId;
        await operative.save({ session });
        await models.Task.updateMany(
          { assigneeId: operative._id, status: { $ne: "Done" } },
          { $set: { teamId: nextTeamId } },
          { session },
        );
      } else if (route === "centre-command/rules") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const cohort = await models.Cohort.findById("alpha").session(session);
        cohort.rulesVersion++;
        await models.RuleVersion.create(
          [
            {
              _id: id(),
              version: cohort.rulesVersion,
              text: text(body.text, "Rule amendment", 20),
              authorId: user._id,
            },
          ],
          { session },
        );
        await cohort.save({ session });
      } else if (route === "centre-command/clearance") {
        assertRole(user, ["CENTRE_COMMAND"]);
        const operative = await gamer(body.userId, session);
        const projectLevels = await publishedLevels(session, operative.teamId);
        const completed = await models.ProjectAttempt.countDocuments({
          teamId: operative.teamId,
          status: "CLEARED",
          levelId: { $in: projectLevels.map((l) => l._id) },
          stars: { $gte: 1 },
        }).session(session);
        const open = await models.Rescue.exists({
          userId: operative._id,
          status: { $ne: "CLOSED" },
        }).session(session);
        const tasks = await models.Task.countDocuments({
          assigneeId: operative._id,
          status: { $ne: "Done" },
        }).session(session);
        if (
          completed < projectLevels.length ||
          open ||
          operative.hp === 0 ||
          tasks > 0
        )
          fail(
            "Clearance requires every published team project cleared, all assigned objectives approved, positive life, and no open rescue.",
          );
        if (
          !Number.isInteger(body.competency) ||
          body.competency < 1 ||
          body.competency > 5
        )
          fail("Competency must be 1–5.");
        await models.Clearance.updateOne(
          { _id: operative._id },
          {
            $setOnInsert: {
              userId: operative._id,
              reviewerId: user._id,
              competency: body.competency,
            },
          },
          { upsert: true, session },
        );
      } else fail("Endpoint not found.", 404);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error.status || (error.code === 11000 ? 409 : 400);
    const message =
      error.code === 11000
        ? "This event has already been recorded."
        : error.message;
    console.error("[CODEWILD]", error.name, error.message);
    return NextResponse.json(
      { success: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export const GET = handle;
export const POST = handle;

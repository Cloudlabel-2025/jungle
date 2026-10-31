import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { requiredText, fail } from "./day-one-rules.js";
import {
  dayAt,
  learner,
  saveLearner,
  attempt,
  saveAttempt,
  event,
  reason,
  editable,
  rosterQuery,
  copy,
} from "./week-one-store.js";
import { iso, finite, safeId } from "./week-one-program-rules.js";
import { reconcileTrophies } from "./week-one-ledger.js";

export async function rulesAction(ctx) {
  const { p, body, action } = ctx;
  if (action === "publish-rules") {
    const rule = {
      version: p.rules.length + 1,
      text: requiredText(body.text, "Game Rules", 20, 12000),
      publishedAt: ctx.at,
      publishedBy: ctx.user._id,
      reason: reason(body),
    };
    p.rules.push(rule);
    await event(ctx, "RULE_VERSION_PUBLISHED", rule);
  } else if (action === "rules-ack") {
    const rule = p.rules.at(-1);
    if (!rule || body.ruleVersion !== rule.version || body.understood !== true)
      fail('Read the latest Rules and explicitly select "Yes, I understand".');
    const l = await learner(ctx);
    l.data.ruleAcks[rule.version] ||= {
      at: ctx.at,
      clarificationWindowEnd: new Date(
        ctx.now.getTime() + 86400000,
      ).toISOString(),
    };
    await saveLearner(ctx, l);
    ctx.changedResults = true;
    await event(ctx, "RULE_ACKNOWLEDGED", {
      userId: l.userId,
      ruleVersion: rule.version,
    });
  } else {
    p.faq.push({
      id: randomUUID(),
      ruleVersion: p.rules.at(-1)?.version,
      question: requiredText(body.question, "FAQ question", 5, 1000),
      answer: requiredText(body.answer, "FAQ answer", 5, 4000),
      by: ctx.user._id,
      at: ctx.at,
    });
    await event(ctx, "RULE_FAQ", { ruleVersion: p.rules.at(-1)?.version });
  }
}
export async function ticketAction(ctx) {
  const { action, body } = ctx;
  if (action === "group-questions") {
    const ids = Array.isArray(body.ticketIds)
      ? body.ticketIds
      : String(body.ticketIds || "")
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length)
      fail("Choose up to 50 distinct classroom tickets.");
    const tickets = await models.WeekOneTicket.find({
      _id: { $in: ids },
      cohortId: ctx.cohortId,
      category: "CLASS",
    }).session(ctx.session);
    if (tickets.length !== ids.length)
      fail(
        "Every grouped ticket must be a classroom question in this cohort.",
        403,
      );
    const group = {
      id: randomUUID(),
      category: "CLASS",
      ticketIds: ids,
      question: requiredText(
        body.question,
        "Approved anonymised group question",
        10,
        2000,
      ),
      answer: requiredText(body.answer, "Shared answer", 10, 4000),
      followupAt: body.followupAt
        ? iso(body.followupAt, "planned class discussion")
        : null,
      by: ctx.user._id,
      at: ctx.at,
    };
    ctx.p.questionGroups ||= [];
    ctx.p.questionGroups.push(group);
    ctx.p.faq.push({
      id: group.id,
      category: "CLASS",
      question: group.question,
      answer: group.answer,
      by: group.by,
      at: group.at,
    });
    for (const ticket of tickets) {
      ticket.data.status = "ANSWERED";
      ticket.data.groupId = group.id;
      ticket.markModified("data");
      await ticket.save({ session: ctx.session });
    }
    await event(ctx, "CLASS_QUESTIONS_GROUPED", {
      groupId: group.id,
      ticketIds: ids,
      followupAt: group.followupAt,
    });
    return;
  }
  if (action === "ask") {
    const category = body.category;
    if (!["CLASS", "RULES", "ACCESS", "ESSENTIAL"].includes(category))
      fail("Choose class, Rules, access or essential support.");
    const current = ctx.release.days.find((d) => d.state === "OPEN");
    if (category === "CLASS" && !current)
      fail("Class questions are available while a day is open.", 409);
    const day =
      current?.day ||
      ctx.release.days.filter((d) => d.state === "CLOSED").at(-1)?.day ||
      1;
    if (
      category === "CLASS" &&
      (await models.WeekOneTicket.countDocuments({
        cohortId: ctx.cohortId,
        userId: ctx.user._id,
        day,
        category,
      }).session(ctx.session)) >= 2
    )
      fail(
        "Two regular class questions have been used today. Rules and essential support remain available.",
        409,
      );
    await learner(ctx);
    const ticket = {
      _id: randomUUID(),
      cohortId: ctx.cohortId,
      userId: ctx.user._id,
      day,
      category,
      data: {
        question: requiredText(body.text, "Question", 5, 4000),
        ruleVersion: category === "RULES" ? ctx.p.rules.at(-1)?.version : null,
        status: "OPEN",
        assignedTo: "MC",
        createdAt: ctx.at,
        replies: [],
      },
    };
    await models.WeekOneTicket.create([ticket], { session: ctx.session });
    await event(ctx, "QUESTION_CREATED", {
      ticketId: ticket._id,
      userId: ctx.user._id,
      day,
      category,
    });
  } else {
    const ticket = await models.WeekOneTicket.findOne({
      _id: body.ticketId,
      cohortId: ctx.cohortId,
    }).session(ctx.session);
    if (!ticket) fail("Question not found.", 404);
    if (action === "escalate") {
      ticket.data.assignedTo = "CC";
      ticket.data.status = "ESCALATED";
      ticket.data.escalationReason = reason(body);
    } else {
      ticket.data.replies.push({
        id: randomUUID(),
        text: requiredText(body.text, "Answer", 5, 4000),
        actorId: ctx.user._id,
        at: ctx.at,
      });
      ticket.data.status = body.resolve === true ? "RESOLVED" : "ANSWERED";
      if (body.publishAnonymously === true && ticket.category === "CLASS")
        ctx.p.faq.push({
          id: randomUUID(),
          category: "CLASS",
          day: ticket.day,
          question: requiredText(
            body.safeQuestion,
            "Anonymised question",
            5,
            1000,
          ),
          answer: ticket.data.replies.at(-1).text,
          by: ctx.user._id,
          at: ctx.at,
        });
    }
    ticket.markModified("data");
    await ticket.save({ session: ctx.session });
    await event(ctx, "QUESTION_UPDATED", {
      ticketId: ticket._id,
      userId: ticket.userId,
      status: ticket.data.status,
    });
  }
}
export async function challengeAction(ctx) {
  const { p, body, action } = ctx;
  if (action === "publish-challenge") {
    const kind = body.kind;
    if (!["WEEKLY", "GRAND"].includes(kind))
      fail(
        "Required daily challenges are configured with each day. Choose Weekly or Grand.",
      );
    if (p.challenges.some((c) => c.kind === kind))
      fail(
        "Only one weekly and one one-time Grand Challenge may be published in Week 1.",
        409,
      );
    if (!ctx.release.days.some((d) => ["OPEN", "CLOSED"].includes(d.state)))
      fail("Open Week 1 before publishing optional challenges.", 409);
    const c = {
      id: `W1-${kind}`,
      kind,
      title: requiredText(body.title, "Challenge title", 3, 150),
      brief: requiredText(body.brief, "Challenge brief", 20, 8000),
      reward: requiredText(body.reward, "Approved reward", 3, 500),
      publishedAt: ctx.at,
      publishedBy: ctx.user._id,
      untilWeek: 6,
    };
    p.challenges.push(c);
    await event(ctx, "OPTIONAL_CHALLENGE_PUBLISHED", c);
  } else if (action === "start-challenge") {
    const id = safeId(body.challengeId);
    let challenge = p.challenges.find((c) => c.id === id),
      number = ctx.release.days.find((d) => d.state === "OPEN")?.day || 5;
    if (!challenge) {
      const match = /^D([234])-DISCOVERY$/.exec(id);
      if (!match) fail("Challenge not found.", 404);
      number = Number(match[1]);
      const day = dayAt(ctx, number);
      if (!["OPEN", "CLOSED"].includes(day.state) || !day.content.discovery)
        fail("This Discovery is not released.", 409);
      challenge = {
        id,
        ...day.content.discovery,
        kind: "DAILY",
        untilWeek: 6,
        publishedAt: day.openedAt,
      };
    }
    const cohort = await models.Cohort.findById(ctx.cohortId)
      .session(ctx.session)
      .lean();
    if ((cohort?.currentWeek || 1) > 6)
      fail("The Week 6 submission window has ended.", 409);
    const recordId = `${ctx.cohortId}:${ctx.user._id}:${id}`;
    if (
      await models.WeekOneAttempt.exists({ _id: recordId }).session(ctx.session)
    )
      return;
    await learner(ctx);
    await models.WeekOneAttempt.create(
      [
        {
          _id: recordId,
          cohortId: ctx.cohortId,
          userId: ctx.user._id,
          activityId: id,
          day: number,
          version: 0,
          data: {
            activity: {
              id,
              name: challenge.title,
              kind: "CHALLENGE",
              challengeKind: challenge.kind,
              durationMinutes: 60,
              fields: ["evidence", "outcome"],
              criteria: [],
            },
            challenge,
            variant: { id, name: challenge.title, brief: challenge.brief },
            anonymousId: randomUUID(),
            startedAt: ctx.at,
            deadline: new Date(ctx.now.getTime() + 60 * 60000).toISOString(),
            draft: {},
            submissions: [],
            history: [],
            extensions: [],
            result: null,
          },
        },
      ],
      { session: ctx.session },
    );
    await event(ctx, "CHALLENGE_STARTED", {
      userId: ctx.user._id,
      challengeId: id,
    });
  } else {
    const record = await attempt(ctx, body.attemptId);
    if (
      record.data.activity.challengeKind === "DAILY" &&
      Date.parse(record.data.firstEvidenceAt || record.data.submittedAt) <=
        Date.parse(dayAt(ctx, record.day).scheduledEnd)
    )
      editable(ctx);
    if (record.data.activity.kind !== "CHALLENGE" || !record.data.submittedAt)
      fail("Review a submitted challenge attempt.");
    if (typeof body.genuine !== "boolean")
      fail("Verify whether the attempt contains genuine research evidence.");
    const review = {
      genuine: body.genuine,
      reason: reason(body),
      by: ctx.user._id,
      at: ctx.at,
      submissionId: record.data.submissions.at(-1).id,
    };
    if (record.data.review)
      record.data.history.push({ review: record.data.review, at: ctx.at });
    record.data.review = review;
    await saveAttempt(ctx, record);
    const l = await learner(ctx, record.userId);
    await reconcileTrophies(ctx, l);
    await saveLearner(ctx, l);
    await event(ctx, "CHALLENGE_REVIEWED", {
      attemptId: record._id,
      userId: record.userId,
      review,
    });
    ctx.changedResults =
      record.data.activity.challengeKind === "DAILY" && !ctx.p.locked;
  }
}
export async function showcaseAction(ctx) {
  const { p, body, action } = ctx;
  if (action === "showcase-groups") {
    if (p.rounds.length)
      fail("Presentation groups are pinned once Showcase starts.", 409);
    const roster = await models.User.find(rosterQuery(ctx.cohortId))
      .session(ctx.session)
      .lean();
    const ids = roster.map((u) => u._id).sort();
    if (
      !Array.isArray(body.groups) ||
      body.groups.length !== 5 ||
      body.groups.some(
        (g) => !Array.isArray(g.members) || g.members.length !== 5,
      ) ||
      body.groups
        .flatMap((g) => g.members)
        .sort()
        .join() !== ids.join()
    )
      fail(
        "Assign all 25 Gamers exactly once to five temporary groups of five.",
      );
    p.groups = body.groups.map((g, i) => ({
      id: `presentation-${i + 1}`,
      name: `Presentation group ${i + 1}`,
      members: g.members,
    }));
    await event(ctx, "SHOWCASE_GROUPS", { groups: p.groups });
    return;
  }
  if (action === "share-consent") {
    const l = await learner(ctx);
    l.data.sharing ||= {};
    l.data.sharing[safeId(body.activityId)] = {
      allowed: body.allowed === true,
      at: ctx.at,
    };
    await saveLearner(ctx, l);
    await event(ctx, "SHARING_CONSENT", {
      userId: l.userId,
      activityId: body.activityId,
      allowed: body.allowed === true,
    });
    return;
  }
  const day = dayAt(ctx, body.day);
  if (!["OPEN", "CLOSED"].includes(day.state))
    fail("Showcase is not released for this day.", 409);
  const group = p.groups.find((g) => g.id === body.groupId);
  if (!group) fail("Choose a temporary presentation group.");
  let round = p.rounds.find((r) => r.day === day.day && r.groupId === group.id);
  if (action === "share-work") {
    if (day.state !== "OPEN") fail("Share work while the day is open.", 409);
    if (!group.members.includes(body.userId))
      fail("Choose a member of this presentation group.");
    const l = await learner(ctx, body.userId);
    if (l.data.showcase)
      fail("This Gamer has already presented this week.", 409);
    if (!l.data.sharing?.[body.activityId]?.allowed)
      fail("The Gamer must consent to sharing this research first.", 409);
    let kind;
    if (body.activityId === "D1-R01") {
      const original = await models.DayOneRecord.findOne({
        cohortId: ctx.cohortId,
        userId: body.userId,
      })
        .session(ctx.session)
        .lean();
      if (original?.data.verification?.status !== "VERIFIED")
        fail("Verify the Day 1 source before sharing a safe summary.", 409);
      kind = "GENERAL";
    } else {
      const source = await models.WeekOneAttempt.findOne({
        cohortId: ctx.cohortId,
        userId: body.userId,
        activityId: body.activityId,
      })
        .session(ctx.session)
        .lean();
      if (!source?.data.submittedAt || source.day > day.day)
        fail("Use a submitted, released research source.", 409);
      kind = source.data.activity.kind;
      if (kind === "FITNESS") kind = "GENERAL";
      if (!["GENERAL", "TECHNICAL"].includes(kind))
        fail("Only general or technical research is eligible.");
    }
    if (!round) {
      round = {
        id: randomUUID(),
        day: day.day,
        groupId: group.id,
        kind,
        state: "SHARED",
        round: 1,
        candidates: [],
        reads: {},
        ballots: [],
        questions: [],
        history: [],
      };
      p.rounds.push(round);
    }
    if (round.state !== "SHARED" || round.kind !== kind)
      fail(
        "Keep this presentation slot's type consistent and share all work before opening ballots.",
        409,
      );
    if (round.candidates.some((c) => c.userId === body.userId))
      fail("This Gamer's work is already shared in this slot.", 409);
    round.candidates.push({
      id: randomUUID(),
      userId: body.userId,
      activityId: body.activityId,
      summary: requiredText(
        body.summary,
        "Approved anonymous research summary",
        20,
        6000,
      ),
      approvedBy: ctx.user._id,
      approvedAt: ctx.at,
    });
  } else {
    if (!round) fail("Share eligible anonymous research first.", 409);
    if (
      ["showcase-read", "vote", "showcase-question"].includes(action) &&
      !group.members.includes(ctx.user._id)
    )
      fail("This Showcase belongs to another presentation group.", 403);
    if (action === "open-vote") {
      if (
        !["SHARED", "REVOTE_REQUIRED"].includes(round.state) ||
        !round.candidates.length
      )
        fail("This ballot cannot be opened.", 409);
      if (day.day === 1 && round.kind !== "GENERAL")
        fail("All Day 1 Showcase slots are general.");
      const cap = day.day === 1 ? 5 : round.kind === "TECHNICAL" ? 3 : 2;
      if (
        p.rounds.filter(
          (r) =>
            r.day === day.day &&
            r.id !== round.id &&
            r.kind === round.kind &&
            r.state !== "SHARED",
        ).length >= cap
      )
        fail(
          "The day's approved technical/general Showcase mix is already allocated.",
          409,
        );
      round.voteEndsAt = iso(body.voteEndsAt, "ballot deadline");
      if (ctx.now >= new Date(round.voteEndsAt))
        fail("The ballot deadline must be in the future.");
      if (round.state === "REVOTE_REQUIRED") round.round = 2;
      round.state = "OPEN";
    } else if (action === "showcase-read") {
      if (!round.candidates.some((c) => c.id === body.candidateId))
        fail("Research summary not found.");
      round.reads[ctx.user._id] ||= [];
      if (!round.reads[ctx.user._id].includes(body.candidateId))
        round.reads[ctx.user._id].push(body.candidateId);
    } else if (action === "vote") {
      if (round.state !== "OPEN" || ctx.now > new Date(round.voteEndsAt))
        fail("The ballot is closed.", 409);
      if (
        round.candidates.some((c) => !round.reads[ctx.user._id]?.includes(c.id))
      )
        fail("Read every shared research summary before voting.", 409);
      const candidate = round.candidates.find((c) => c.id === body.candidateId);
      if (!candidate || candidate.userId === ctx.user._id)
        fail("Choose an eligible candidate other than yourself.");
      if (round.ballots.some((b) => b.userId === ctx.user._id))
        fail("Only one secret ballot is allowed per round.", 409);
      round.ballots.push({
        userId: ctx.user._id,
        candidateId: candidate.id,
        at: ctx.at,
      });
      ctx.changedResults = true;
    } else if (action === "close-vote") {
      if (round.state !== "OPEN" || ctx.now < new Date(round.voteEndsAt))
        fail("Wait until the open ballot ends.", 409);
      if (!round.ballots.length && round.round === 1) {
        round.history.push({ round: 1, ballots: [], at: ctx.at });
        round.state = "REVOTE_REQUIRED";
      } else {
        const votes = round.candidates.map((c) => ({
          ...c,
          count: round.ballots.filter((b) => b.candidateId === c.id).length,
        }));
        const maximum = Math.max(...votes.map((v) => v.count)),
          leaders = votes.filter((v) => v.count === maximum);
        const selected =
          votes.find((c) => c.id === body.candidateId) ||
          (leaders.length === 1 ? leaders[0] : null);
        if (!selected)
          fail("Document the MC selection for a tied or empty ballot.");
        if (
          leaders.length !== 1 ||
          selected.count !== maximum ||
          body.unavailable === true
        )
          round.selectionReason = reason(body);
        if (
          leaders.length === 1 &&
          selected.count !== maximum &&
          body.unavailable !== true
        )
          fail(
            "A non-winning presenter requires an unavailable-presenter exception.",
          );
        const l = await learner(ctx, selected.userId);
        if (
          l.data.showcase ||
          p.rounds.some(
            (r) => r.id !== round.id && r.selectedUserId === selected.userId,
          )
        )
          fail("A Gamer may present exactly once per week.", 409);
        round.selectedUserId = selected.userId;
        round.closedAt = ctx.at;
        round.state = "SELECTED";
        ctx.changedResults = true;
      }
    } else if (action === "showcase-question") {
      round.questions.push({
        id: randomUUID(),
        userId: ctx.user._id,
        text: requiredText(body.text, "Peer question", 5, 1000),
        status: "PENDING",
        at: ctx.at,
      });
    } else if (action === "approve-question") {
      const q = round.questions.find((q) => q.id === body.questionId);
      if (!q) fail("Peer question not found.", 404);
      q.status = "APPROVED";
      q.safeText = requiredText(body.safeText, "Approved question", 5, 1000);
      q.approvedBy = ctx.user._id;
      if (body.askedBy !== "MC") await learner(ctx, body.askedBy);
      q.askedBy = body.askedBy;
    } else if (action === "score-showcase") {
      editable(ctx);
      if (!round.selectedUserId) fail("Select a presenter before assessment.");
      const l = await learner(ctx, round.selectedUserId);
      if (l.data.showcase && l.data.showcase.roundId !== round.id)
        fail("This learner already has an assessed presentation.", 409);
      const marks = {
        understanding: finite(body.understanding, 0, 4, "Understanding"),
        reasoning: finite(body.reasoning, 0, 4, "Answering and reasoning"),
        clarity: finite(body.clarity, 0, 2, "Clarity"),
      };
      const score = {
        ...marks,
        total: Object.values(marks).reduce((n, v) => n + v, 0),
        roundId: round.id,
        day: day.day,
        evidence: reason(body),
        by: ctx.user._id,
        at: ctx.at,
      };
      if (l.data.showcase)
        (l.data.showcaseHistory ||= []).push(copy(l.data.showcase));
      l.data.showcase = score;
      await saveLearner(ctx, l);
      round.state = "ASSESSED";
      ctx.changedResults = true;
    }
  }
  await event(ctx, action.toUpperCase(), {
    day: day.day,
    groupId: group.id,
    roundId: round?.id,
    ...(ctx.user.role === "GAMER" ? { userId: ctx.user._id } : {}),
  });
}

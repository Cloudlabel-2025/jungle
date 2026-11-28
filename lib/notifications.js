import { prefix } from "./catalog.js";
import { flightScreens } from "./flight-rules.js";
import { programmePath } from "./workspace-navigation.js";

export const monitoringRequired = (data) =>
  data.user.role === "GAMER" &&
  (data.user.drops >= 3 ||
    (data.rescues || []).some(
      (row) => row.userId === data.user._id && row.status !== "CLOSED",
    ));

// Store only an opaque sign-in identifier, never profile or assessment data.
export function claimSignInNotice(sessionKey, storage) {
  const key = `codewild:sign-in-notice:${sessionKey}`;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
  } catch {
    /* The shell's in-memory guard still prevents repeated poll toasts. */
  }
  return true;
}

// Sources have already been filtered by the server's account/team/cohort scope.
// This projection deliberately contains no private marks or reference answers.
export function buildNotifications(data, receipts = [], programmeNotices = []) {
  const user = data.user,
    gamer = user.role === "GAMER",
    base = `/${prefix(user.role)}`;
  const read = new Set(receipts.map((row) => row.notificationId));
  const items = new Map();
  const add = (
    id,
    category,
    title,
    message,
    href,
    createdAt,
    requiresAttention = false,
  ) => {
    if (data.story?.flight && !flightScreens.has(href.split("/").at(-1)?.split("?")[0]))
      href = `${base}/week-one-ask-mc`;
    items.set(id, {
      id,
      category,
      title,
      message: message || "Open for details.",
      href,
      createdAt: createdAt || null,
      requiresAttention,
      read: read.has(id),
    });
  };
  const people = gamer ? [user] : data.roster || [];
  for(const review of data.levelReviewNotices || []){
    if(!gamer || review.userId!==user._id || review.cohortId!==(user.cohortId || "alpha"))continue;
    const role=review.actorRole==="CENTRE_COMMAND"?"Centre Command":"Mission Commander";
    const reviewer=`${role} ${review.actorName || review.actorId}`;
    const score=result=>result?.completed?`${result.stars}/3 stars`:"incomplete";
    const changed=review.before?.stars!==review.after?.stars || review.before?.completed!==review.after?.completed;
    const actions={validate:"validated",revalidate:"revalidated",reopen:"returned for revision",replay:"opened for replay",result:changed?"changed":"reviewed"};
    const title=`Level ${review.day} ${actions[review.operation] || "reviewed"}`;
    const message=review.operation==="result" && changed?`${reviewer} changed your Level ${review.day} result from ${score(review.before)} to ${score(review.after)}.`:review.operation==="reopen"?`${reviewer} returned Level ${review.day} for revision. Review the feedback before resubmitting.`:review.operation==="replay"?`${reviewer} opened a new Level ${review.day} replay. Your best earned reward is retained.`:`${reviewer} ${actions[review.operation] || "reviewed"} your Level ${review.day} result: ${score(review.after)}.`;
    add(`level-review:${review._id}`,"Programme",title,`${message} ${review.reason}`,`${programmePath(user.role,"results")}?level=${review.day}`,review.createdAt,review.operation==="reopen");
  }
  for(const decision of data.trophyConduct || []) {
    if(!gamer || decision.userId !== user._id) continue;
    add(`trophy-conduct:${decision._id}`,"Rewards",decision.action === "WARNING" ? "Trophy conduct warning" : decision.action === "RESTORE" ? "Trophy deduction reversed" : "Trophies reduced",
      `${decision.reason} ${decision.amount > 0 ? "+" : ""}${decision.amount} trophies. Open your decision receipt for evidence and review options.`,`${base}/week-one-ask-mc`,decision.createdAt,decision.action !== "RESTORE");
  }
  for (const person of people.filter((row) => row.drops >= 3)) {
    const penalty = (data.energy || []).find(
      (event) => event.userId === person._id && event.change < 0 && !/^(mission:|retry:)/.test(event.eventKey || ""),
    );
    add(
      `monitoring:${person._id}:${person.drops}:${penalty?._id || "current"}`,
      "Support",
      gamer
        ? "Commander check-in needed"
        : `${person.name} needs a Commander check-in`,
      gamer
        ? "Your recent energy penalties require monitoring. Contact your Commander to agree the next steps."
        : "This player has three or more consecutive energy penalties. Review their support needs.",
      `${base}/${gamer ? "team-room" : user.role === "MISSION_COMMANDER" ? "coaching" : "dashboard"}`,
      penalty?.createdAt,
      true,
    );
  }
  for (const rescue of data.rescues || []) {
    if (rescue.status === "CLOSED" || (gamer && rescue.userId !== user._id))
      continue;
    add(
      `rescue:${rescue._id}:${rescue.status}`,
      "Support",
      gamer ? "Recovery support is active" : "Player recovery needs follow-up",
      "Work with the responsible Commander on the remediation plan. Reading this notice does not close the recovery case.",
      `${base}/${gamer ? "team-room" : user.role === "MISSION_COMMANDER" ? "coaching" : "reports"}`,
      rescue.openedAt,
      true,
    );
  }
  for (const event of data.events || [])
    add(
      `dispatch:${event._id}`,
      "Announcements",
      event.title,
      event.description,
      `${base}/${gamer ? "sprint-board" : user.role === "CENTRE_COMMAND" ? "client-control" : "dashboard"}`,
      event.broadcastAt,
    );
  for (const task of data.tasks || []) {
    if (gamer && task.assigneeId === user._id)
      add(
        `task:${task._id}:${task.status}:${task.submissionVersion || 0}:${Boolean(task.reviewFeedback)}`,
        "Tasks",
        task.status === "Done"
          ? "Objective approved"
          : task.reviewFeedback
            ? "Objective feedback available"
            : "Your assigned objective",
        task.title,
        `${base}/sprint-board`,
        task.approvedAt || task.submittedAt || task.releasedAt,
        Boolean(task.reviewFeedback && task.status !== "Done"),
      );
    else if (user.role === "MISSION_COMMANDER" && task.status === "Review")
      add(
        `review:${task._id}:${task.submissionVersion || 0}`,
        "Tasks",
        "Objective awaiting your review",
        task.title,
        `${base}/sprints`,
        task.submittedAt,
        true,
      );
  }
  const p = data.weekOneProgram;
  if (p) {
    for (const notice of p.notifications || [])
      add(
        `week1:${notice.id}`,
        "Programme",
        "Week 1 follow-up",
        notice.message,
        programmePath(user.role, notice.screen),
      );
    for (const day of p.days || []) {
      if (gamer && day.agenda)
        add(
          `agenda:${day.day}:${day.agenda.version || day.agenda.publishedAt}`,
          "Announcements",
          `Day ${day.day} agenda published`,
          day.agenda.text,
          programmePath(user.role, "announcements"),
          day.agenda.publishedAt,
        );
      if (gamer)
        for (const recap of day.recaps || [])
          add(
            `recap:${day.day}:${recap.session}:${recap.publishedAt}`,
            "Announcements",
            `Day ${day.day} · Class ${recap.session} recap`,
            recap.text,
            programmePath(user.role, "announcements"),
            recap.publishedAt,
          );
    }
    for (const ticket of p.tickets || []) {
      const replies = ticket.data?.replies || [],
        reply = replies.at(-1);
      if (gamer && ticket.userId === user._id && reply)
        add(
          `reply:${ticket._id}:${reply.id || reply.at}`,
          "Messages",
          "A reply to your question",
          reply.text,
          programmePath(user.role, "ask-mc"),
          reply.at,
        );
      if (
        !gamer &&
        ticket.data?.status !== "RESOLVED" &&
        ticket.data?.assignedTo ===
          (user.role === "CENTRE_COMMAND" ? "CC" : "MC")
      )
        add(
          `question:${ticket._id}:${ticket.data.status}:${replies.length}`,
          "Messages",
          "Player question awaiting attention",
          ticket.data.question,
          programmePath(user.role, "questions"),
          ticket.createdAt,
          true,
        );
    }
    if (gamer && p.publication)
      add(
        `results:${p.publication.version}`,
        "Programme",
        "Your results are available",
        "View your privately published outcome and next steps.",
        programmePath(user.role, "results"),
        p.publication.at,
      );
  }
  for (const ticket of data.support?.tickets || []) {
    if (gamer && ticket.createdBy !== user._id) continue;
    add(
      `support-ticket:${ticket._id}:${ticket.state}:${ticket.firstResponseAt || ""}`,
      "Support",
      `Support ticket · ${ticket.state.replaceAll("_", " ").toLowerCase()}`,
      ticket.description,
      `${base}/${gamer ? "team-room" : user.role === "MISSION_COMMANDER" ? "coaching" : "dashboard"}`,
      ticket.firstResponseAt || ticket.createdAt,
      ticket.breachedAt && !["RESOLVED", "CLOSED"].includes(ticket.state),
    );
  }
  for (const notice of programmeNotices) {
    if (gamer && notice.userId && notice.userId !== user._id) continue;
    const staffScreen =
      user.role === "CENTRE_COMMAND"
        ? "client-control?programme=board#programme-board"
        : "sprints?board=programme";
    add(
      `sprint:${notice._id}`,
      "Programme",
      notice.state.replaceAll("_", " ").toLowerCase(),
      notice.data?.text || notice.data?.message || notice.data?.reason,
      `${base}/${gamer ? "sprint-board?board=programme" : staffScreen}`,
      notice.createdAt,
      notice.state === "WORKER_FAILURE",
    );
  }
  const list = [...items.values()]
    .sort(
      (a, b) =>
        Number(b.requiresAttention) - Number(a.requiresAttention) ||
        (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    )
    .slice(0, 100);
  return { items: list, unread: list.filter((item) => !item.read).length };
}

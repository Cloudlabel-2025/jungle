"use client";
import Link from "next/link";
import { Check, LockKeyhole, Clock3 } from "lucide-react";
import { Modal, Badge } from "./ui";

export default function AlumniLevelBriefing({ level, data, close }) {
  const mine = level.tasks.filter(t => t.mine);
  const names = Object.fromEntries(data.roster.map(p => [p._id, p.name]));
  return (
    <Modal title={`${level.number}. ${level.name}`} kicker="ALUMNI CONNECT / TEAM MISSION" close={close} wide>
      <div className="alumni-mission">
        <Badge tone={level.state === "CLEARED" ? "lime" : "amber"}>{level.statusLabel}</Badge>
        <h3>{level.subtitle}</h3>
        <p className="detail-copy">{level.goal}</p>
        <p className="alumni-unlock"><LockKeyhole size={17} />
          {level.number === 1 ? "CC releases the approved first sprint to your team." : `Earn ${level.number === 2 ? "Key 1" : `Keys 1–${level.number - 1}`} and wait for CC to release this sprint.`}
          {" "}Complete the kickoff before starting work. All seven client checks must pass and CC must award Key {level.number} to complete this level.
        </p>
        {level.canOpen ? (
          <Link className="btn primary" href={`/gamer/sprint-board?board=programme&sprint=${encodeURIComponent(level.sprintId)}`}>
            {level.state === "CLEARED" ? "Review sprint work & evidence" : level.state === "REWORK" ? "Open work & review feedback" : "Open my sprint work"}
          </Link>
        ) : <p role="status" className="muted">{level.statusLabel}. You can preview the mission and acceptance checks below.</p>}
        <section aria-label="My level work">
          <h3>My work <small>{mine.filter(t => t.state === "Accepted").length}/{mine.length} accepted</small></h3>
          {mine.length ? <ul className="alumni-task-list">{mine.map(t => <li key={t._id}>
            <strong>{t.code} · {t.title}</strong><span>{t.state}</span>
            {t.depends.length > 0 && <small>Prerequisites: {t.depends.join(", ")}</small>}
          </li>)}</ul> : <p className="muted">Your assignments appear when CC releases the sprint package.</p>}
        </section>
        <section aria-label="Team level progress">
          <h3>Team progress <small>{level.acceptedTasks}/{level.tasks.length} tasks accepted</small></h3>
          <p>Everyone shares the team’s map progress. Each player submits and explains their own contribution.</p>
          {level.tasks.length > 0 && <details><summary>Team assignments and blockers</summary>
            <ul className="alumni-task-list">{level.tasks.map(t => <li key={t._id}>
              <strong>{t.code} · {t.title}</strong><span>{t.ownerName || names[t.userId] || "Team member"} · {t.state}</span>
              {t.depends.some(code => !level.tasks.some(c => c.code === code && c.state === "Accepted")) &&
                <small>Waiting for prerequisite work: {t.depends.filter(code => !level.tasks.some(c => c.code === code && c.state === "Accepted")).join(", ")}</small>}
            </li>)}</ul>
          </details>}
        </section>
        <section aria-label="Client acceptance checklist">
          <h3>Client acceptance <small>{level.acceptance.filter(a => a.decision === "PASS").length}/{level.acceptance.length} passed</small></h3>
          <ol className="alumni-checks">{level.acceptance.map(a => <li key={a.id}>
            {a.decision === "PASS" ? <Check size={18} /> : <Clock3 size={18} />}
            <span>{a.text}<small>{a.decision === "PENDING" ? "Awaiting client verification" : a.decision}</small></span>
          </li>)}</ol>
          <p className="muted">Submitting work, earning trophies or reading this checklist does not award a key. CC records the client acceptance.</p>
        </section>
      </div>
    </Modal>
  );
}

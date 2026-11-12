"use client";
import Link from "next/link";
import { Panel, Badge } from "./ui";

export default function AlumniSprintHistory({ data, user }) {
  const teamId = data.teams.find(t => t.members.includes(user._id))?.teamId;
  const tasks = data.tasks.filter(t => t.teamId === teamId);
  return <section aria-label="Accepted Alumni Connect sprint">
    <Panel title={`Sprint ${data.sprint.data.number} · Alumni Connect`} action={<Badge tone="lime">Sprint record</Badge>}>
      <p>This sprint is read-only. Review your team’s contributions and submitted evidence here.</p>
      <Link href="/gamer/dashboard" className="btn">Return to map</Link>
      <h3>Team contributions</h3>
      {tasks.map(t => <details key={t._id} className="alumni-history-task">
        <summary>{t.data.code} · {t.data.title} · {t.state}{t.userId === user._id ? " · My work" : ""}</summary>
        <p>{data.names[t.userId] || "Team member"}</p>
        {(t.data.stages || []).map((stage, i) => <p key={i}>{stage.name || stage.key || stage.id || `Stage ${i + 1}`} · {stage.state}</p>)}
        <ul>{(t.data.evidence || []).map((e, i) => <li key={i}><a href={e.url} target="_blank" rel="noreferrer">{e.summary || e.title || e.label || `Submitted evidence ${i + 1}`}</a></li>)}</ul>
        {!t.data.evidence?.length && <p className="muted">No submitted evidence links.</p>}
      </details>)}
    </Panel>
  </section>;
}

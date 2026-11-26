"use client";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Users, BookOpen } from "lucide-react";
import { programmeSetupConfig, programmeSetupPayload, programmeTimeInput, programmeTimeValue } from "@/lib/programme-setup.js";
import { sprintRoleAssignments, sprintTaskOwners } from "@/lib/role-rotation.js";

const steps = [["Schedule", CalendarDays], ["Team assignments", Users], ["Learning resources", BookOpen]];
const minuteTime = value => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const timeMinute = value => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };

export default function ProgrammeSetupForm({ format, setup, sprint, run }) {
  const [config, setConfig] = useState(() => programmeSetupConfig(format, sprint));
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState(sprint?.state === "DRAFT" ? sprint.data.reason || "" : "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useRef(null);
  const heading = useRef(null);
  const tasks = setup.manifests.sprints.find(row => row.number === config.number).tasks;
  const names = Object.fromEntries(setup.roster.map(person => [person._id, person.name]));
  const commanders = setup.roster.filter(person => person.role === "MISSION_COMMANDER");
  const update = values => { setConfig(current => ({ ...current, ...values })); setSaved(false); };
  const calendar = values => update({ calendar: { ...config.calendar, ...values } });
  function team(index, values) {
    update({ teams: config.teams.map((row, i) => i === index ? { ...row, ...values } : row) });
  }
  function resource(id, values) {
    update({ resources: { ...config.resources, [id]: { ...config.resources[id], ...values, author: "CURRICULUM" } } });
  }
  function changeStep(next) {
    if (next > step && !form.current.reportValidity()) return;
    setStep(next);
    setError("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function submit(event) {
    event.preventDefault();
    if (step < 2) { changeStep(step + 1); return; }
    setError("");
    setBusy(true);
    try {
      const result = await run("draft", programmeSetupPayload(config, reason), setError);
      setSaved(Boolean(result && result.success !== false));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (!config.teams.length) return <p className="programme-setup-notice" role="status">Publish and lock the Week 1 recovery roster before setting up a sprint. Its published teams will appear here automatically.</p>;
  if (!commanders.length) return <p className="programme-setup-notice" role="status">Create an active Mission Commander in this cohort through Manage college first. Each published team needs an MC assignment.</p>;
  return <form ref={form} className="programme-setup-form" onSubmit={submit}>
    <div className="programme-setup-intro"><h3>Set up Sprint {config.number}</h3><p>Enter the schedule, assign responsibility, and add approved resources. Save the draft, then approve and load it below.</p></div>
    <ol className="programme-setup-steps" aria-label="Sprint setup progress">
      {steps.map(([label, Icon], index) => <li key={label} aria-current={index === step ? "step" : undefined}><button type="button" onClick={() => changeStep(index)} disabled={busy || index > step + 1}><Icon size={17} aria-hidden="true" /><span>{index + 1}. {label}</span></button></li>)}
    </ol>
    <h4 ref={heading} tabIndex={-1}>{steps[step][0]}</h4>
    <fieldset disabled={busy}>
      {step === 0 && <>
        <p className="muted">Schedule dates are in India time (Asia/Kolkata).{config.number === 1 && " Sprint 1 kickoff must last exactly two hours."}</p>
        <div className="programme-setup-grid">
          {[["kickoffStart", "Kickoff starts"], ["kickoffEnd", "Kickoff ends"], ["dueAt", "Sprint deadline"]].map(([key, label]) => <label key={key}>{label}<input type="datetime-local" required value={programmeTimeInput(config[key])} onChange={e => update({ [key]: programmeTimeValue(e.target.value) })} /></label>)}
        </div>
        <h5>Working calendar · {config.calendar.timeZone}</h5>
        <div className="programme-working-days">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <label key={day}><input type="checkbox" checked={config.calendar.weekdays.includes(index)} onChange={e => calendar({ weekdays: e.target.checked ? [...config.calendar.weekdays, index].sort() : config.calendar.weekdays.filter(d => d !== index) })} />{day}</label>)}</div>
        <div className="programme-setup-grid">{config.calendar.intervals.map((interval, index) => <div key={index} className="programme-setup-grid">
          {[["startMinute", "starts"], ["endMinute", "ends"]].map(([key, label]) => <label key={key}>Work period {index + 1} {label}<input type="time" required value={minuteTime(interval[key])} onChange={e => e.target.value && calendar({ intervals: config.calendar.intervals.map((row, i) => i === index ? { ...row, [key]: timeMinute(e.target.value) } : row) })} /></label>)}
        </div>)}</div>
        <label>Holidays (one YYYY-MM-DD date per line)<textarea rows={3} value={config.calendar.holidays.join("\n")} onChange={e => calendar({ holidays: e.target.value.split("\n") })} /></label>
        {config.number >= 3 && <label>Curriculum content approval<textarea required minLength={10} value={config.contentApproval || ""} onChange={e => update({ contentApproval: e.target.value })} /></label>}
      </>}
      {step === 1 && <>
        <p className="muted">Choose an MC for each published team. Player roles rotate automatically each sprint; task owners follow the approved weekly rotation. The MC covers missing slots in teams with fewer than five players.</p>
        {config.teams.map((row, index) => <section className="programme-setup-team" key={row.teamId}>
          <h5>{setup.source.find(source => source.id === row.teamId)?.name || `Team ${index + 1}`}</h5>
          <p>{row.members.map(id => names[id] || id).join(" · ")}</p>
          <label>Responsible MC<select required value={row.commanderId} onChange={e => team(index, { commanderId: e.target.value, owners: Object.fromEntries(Object.entries(row.owners).map(([id, owner]) => [id, row.members.includes(owner) ? owner : ""])) })}><option value="">Choose a Mission Commander</option>{commanders.map(person => <option key={person._id} value={person._id}>{person.name}</option>)}</select></label>
          <label>Why this allocation?<textarea required minLength={10} value={row.rationale} onChange={e => team(index, { rationale: e.target.value })} /></label>
          <ul className="programme-role-rotation">{sprintRoleAssignments(row.members, config.number).map(role => <li key={role.userId}><strong>{names[role.userId] || role.userId}</strong><span>{role.label}</span></li>)}</ul>
          <details><summary>View automatic task assignments</summary><div className="programme-owner-list">{tasks.map(task => {
            const owner = sprintTaskOwners([task], row.members, row.commanderId)[task.id];
            return <div className="programme-owner-row" key={task.id}><span><strong>{task.id}</strong> {task.title}</span><span>{names[owner] || "Choose an MC for coverage"}</span></div>;
          })}</div></details>
        </section>)}
      </>}
      {step === 2 && <>
        <p className="muted">Provide a Curriculum-approved resource for each task, including its version and approval reference.</p>
        {tasks.map(task => <section className="programme-setup-resource" key={task.id}>
          <h5>{task.id} · {task.title}</h5>
          <label>Resource URL<input type="url" required maxLength={2000} value={config.resources[task.id]?.url || ""} onChange={e => resource(task.id, { url: e.target.value })} /></label>
          <div className="programme-setup-grid"><label>Version<input required maxLength={70} value={config.resources[task.id]?.version || ""} onChange={e => resource(task.id, { version: e.target.value })} /></label><label>Approval reference<input required minLength={10} value={config.resources[task.id]?.approval || ""} onChange={e => resource(task.id, { approval: e.target.value })} /></label></div>
        </section>)}
        <label>Reason for this sprint configuration<textarea required minLength={10} value={reason} onChange={e => { setReason(e.target.value); setSaved(false); }} /></label>
      </>}
    </fieldset>
    {error && <p role="alert" className="danger-text">{error}</p>}
    {saved && <p role="status" className="programme-setup-notice"><Check size={16} aria-hidden="true" />Draft saved. Approve the current package and load its preview using the controls below.</p>}
    <div className="programme-setup-footer"><span>Step {step + 1} of 3</span><button className="btn" type="button" disabled={step === 0 || busy} onClick={() => changeStep(step - 1)}><ChevronLeft size={16} aria-hidden="true" />Back</button><button className="btn primary" type="submit" disabled={busy || saved}>{busy ? "Saving draft…" : step === 2 ? "Save sprint draft" : "Continue"}{step < 2 && <ChevronRight size={16} aria-hidden="true" />}</button></div>
  </form>;
}

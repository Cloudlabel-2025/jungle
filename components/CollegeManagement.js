"use client";
import { useEffect, useState } from "react";
import { Check, ChevronRight, GraduationCap, Pencil, Plus, RefreshCw, Users, X } from "lucide-react";
import { ManagementDialog } from "./PlatformDashboard";
import { prefix } from "@/lib/catalog.js";
import { teamRoles } from "@/lib/team-roles.js";

export default function CollegeManagement({ college, actor }) {
  const cc = actor.role === "CENTRE_COMMAND";
  const [detail, setDetail] = useState(null), [cohortId, setCohortId] = useState("");
  const [dialog, setDialog] = useState(null), [revision, setRevision] = useState(0);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [loading, setLoading] = useState(true);
  const cohort = detail?.cohorts.find(c => c.id === cohortId) || detail?.cohorts[0];
  const teams = detail?.teams.filter(t => t.cohortId === cohort?.id) || [];
  const guides = detail?.people.filter(p => p.cohortId === cohort?.id && p.role === "MISSION_COMMANDER") || [];
  const workspace = `/${prefix(actor.role)}/dashboard`;
  async function api(path, { body, method = body ? "POST" : "GET", signal } = {}) {
    const response = await fetch(`/api/college-management/${path}`, { method, signal, cache: "no-store",
      headers: { "x-codewild-college": college.id, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) location.assign(workspace);
      throw Object.assign(new Error(result.error || "Unable to complete this action."), { status: response.status });
    }
    return result;
  }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    api("state", { signal: controller.signal }).then(setDetail).catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  async function save(type, values, initial) {
    const base = `cohorts/${encodeURIComponent(type === "person" ? initial.cohortId : cohort?.id)}`;
    let result;
    if (type === "cohort") { result = await api("cohorts", { body: values }); setCohortId(result.id); }
    else if (type === "edit-cohort") await api(base, { method: "PATCH", body: { ...values, version: initial.version } });
    else if (type === "staff") await api(`${base}/guides`, { body: values });
    else if (type === "team") await api(`${base}/teams`, { body: values });
    else if (type === "edit-team") await api(`${base}/teams/${encodeURIComponent(initial.id)}`, { method: "PATCH", body: { ...values, version: initial.version } });
    else if (type === "member") { const { requestId, ...member } = values; await api(`${base}/teams/${encodeURIComponent(initial.id)}/players`, { body: { requestId, member } }); }
    else if (type === "person") await api(`${base}/people/${encodeURIComponent(initial.id)}`, { method: "PATCH", body: { ...values, active: values.active === "true", version: initial.version } });
    setDialog(null); setRevision(n => n + 1); setNotice("Changes saved.");
  }
  return <section className="platform-admin college-management" aria-label={cc ? "College management" : "Player management"}>
      <div className="pa-page-heading cm-heading"><div><span className="pa-kicker">{cc ? "YOUR COLLEGE · ALL COHORTS" : "YOUR TEAMS · PLAYER ACCOUNTS"}</span><h1>{cc ? "Manage college" : "Manage players"}</h1><p><strong>{college.name}</strong> · {cc ? "Organise cohorts, assign MCs and build your teams." : "Create players in the teams assigned to you."}</p><div className="pa-college-meta"><a className="pa-text-link" href={college.loginUrl} target="_blank" rel="noreferrer">College sign-in link<ChevronRight size={14} /></a></div></div><button className="pa-secondary" disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Refresh</button></div>
      {error && <p className="pa-error" role="alert">{error}</p>}
      {notice && <div className="pa-success" role="status"><Check size={16} />{notice}<button className="pa-icon" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {!detail ? <div className="pa-empty" role="status">{loading ? "Opening college…" : "Refresh to try again."}</div> : <>
        <div className="pa-detail-summary"><span><GraduationCap size={18} /><strong>{detail.cohorts.length}</strong>cohorts</span><span><Users size={18} /><strong>{detail.teams.length}</strong>teams</span><span><strong>{detail.people.filter(p => p.role === "GAMER").length}</strong>players</span></div>
        <div className="pa-hierarchy"><aside className="pa-cohort-list"><header><h2>Cohorts</h2>{cc && <button className="pa-icon" aria-label="Add cohort" onClick={() => setDialog({ type: "cohort" })}><Plus size={18} /></button>}</header>
          {detail.cohorts.map(c => <button key={c.id} className={cohort?.id === c.id ? "is-active" : ""} onClick={() => setCohortId(c.id)}><GraduationCap size={18} /><span><strong>{c.name}</strong><small>{detail.teams.filter(t => t.cohortId === c.id).length} teams · Week {c.currentWeek}</small></span><ChevronRight size={14} /></button>)}
          {!detail.cohorts.length && <p>{cc ? "Add your first cohort." : "No teams are assigned to you yet. Ask Centre Command to assign a team."}</p>}
        </aside><section className="pa-cohort-content">{cohort && <>
          <div className="pa-cohort-heading"><div><h2>{cohort.name}</h2><p>Started {cohort.startDate?.slice(0, 10)} · Week {cohort.currentWeek}</p></div>{cc && <button className="pa-icon" aria-label="Edit cohort" onClick={() => setDialog({ type: "edit-cohort", initial: cohort })}><Pencil size={16} /></button>}</div>
          {cc && <><div className="pa-section-heading"><h3>Guides (MC)</h3><button className="pa-secondary" onClick={() => setDialog({ type: "staff" })}><Plus size={16} />Create MC</button></div><section className="pa-staff">{guides.map(g => <div className="pa-staff-row" key={g.id}><span className="pa-avatar">{g.name[0]}</span><div><strong>{g.name}{!g.active && " · Inactive"}</strong><small>{g.email}</small></div><button className="pa-icon" aria-label={`Edit account for ${g.name}`} onClick={() => setDialog({ type: "person", initial: g })}><Pencil size={16} /></button></div>)}{!guides.length && <p className="pa-note">Create a Guide, then assign them to a team.</p>}</section></>}
          <div className="pa-section-heading"><h3>Teams <span>{teams.length}</span></h3>{cc && <button className="pa-secondary" onClick={() => setDialog({ type: "team" })}><Plus size={16} />Add team</button>}</div>
          <section className="pa-teams">{teams.map(t => { const players = detail.people.filter(p => p.role === "GAMER" && p.teamId === t.id), guide = detail.people.find(p => p.id === t.commanderId); return <article className="pa-team" key={t.id}>
            <header className="pa-team-header"><div className="pa-team-toggle"><Users size={18} /><span><strong>{t.name}</strong><small>{t.code}</small></span></div><span className="pa-guide-name">{guide?.name || "Guide unassigned"}</span><span className="pa-team-count">{players.length}/5</span>{cc && <button className="pa-icon" aria-label={`Edit ${t.name}`} onClick={() => setDialog({ type: "edit-team", initial: t })}><Pencil size={16} /></button>}</header>
            <div className="pa-team-members">{players.map(p => <div className="pa-member" key={p.id}><span className="pa-avatar">{p.name[0]}</span><div><strong>{p.name}{!p.active && " · Inactive"}</strong><small>{p.username || p.email} · {teamRoles.find(r => r.code === p.teamRoleCode)?.label || "Full-stack explorer"}</small></div>{cc && <button className="pa-icon" aria-label={`Edit account for ${p.name}`} onClick={() => setDialog({ type: "person", initial: p })}><Pencil size={16} /></button>}</div>)}
              {!players.length && <p className="pa-note">No players yet.</p>}<button className="pa-text-link" disabled={players.length >= 5} onClick={() => setDialog({ type: "member", initial: t })}><Plus size={16} />{players.length >= 5 ? "Team is full" : "Create player"}</button></div>
          </article>; })}{!teams.length && <div className="pa-empty pa-empty-small">{cc ? "Add a team to this cohort, then create its player accounts." : "No teams assigned in this cohort."}</div>}</section>
        </>}</section></div>
      </>}
      {dialog && <ManagementDialog dialog={dialog} detail={detail} cohort={cohort} onClose={() => setDialog(null)} onSave={save} staffRoles={["MISSION_COMMANDER"]} allowRoleChange={false} />}
    </section>;
}

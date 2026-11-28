"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, ChevronDown, ChevronRight, CircleHelp, GraduationCap,
  Pencil, Plus, Search, ShieldCheck, Users, X, RefreshCw, Activity, KeyRound, Check, Mail } from "lucide-react";
import NavLogoutButton from "./NavLogoutButton";
import CollegeLifecycleActions from "./CollegeLifecycleActions";
import PlayerPasswordResetDialog from "./PlayerPasswordResetDialog";
import { usernamePattern, usernameHint } from "@/lib/account-username.js";

import { platformApi as api } from "@/lib/platform-client.js";
import { Field, PasswordInput } from "./PlatformFields";
import PlatformAccounts from "./PlatformAccounts";
import { teamRoles } from "@/lib/team-roles.js";
import { brand } from "@/lib/brand.js";
import CollegeProfile from "./CollegeProfile";
import CollegeLoginUrl from "./CollegeLoginUrl";

function PlatformBrand({ href = "/platform" }) {
  return <a className="pa-brand" href={href} aria-label={`${brand.name} CMS`}>
    <img className="pa-brand-emblem" src={brand.logo} alt="" width={52} height={52} />
    <span className="pa-brand-copy"><strong>{brand.shortName}</strong><small>{brand.name}</small></span>
    <span className="pa-brand-label">CMS</span>
  </a>;
}

const roleName = role => role === "MISSION_COMMANDER" ? "Guide" : role === "CENTRE_COMMAND" ? "Centre Command" : "Learner";
const statusName = value => value?.toLowerCase().replaceAll("_", " ").replace(/^./, s => s.toUpperCase());
const dateText = date => date ? new Date(`${String(date).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const enc = encodeURIComponent;
const countLabel = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;
function Status({ value }) { return <span className={`pa-status pa-status-${value?.toLowerCase()}`}><i />{statusName(value)}</span>; }
function Login({ onLogin }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <main className="platform-admin pa-login"><section className="pa-login-intro">
    <PlatformBrand />
    <div><span className="pa-kicker">VOYAGE OF WILDERNESS · CMS</span><h1>Every voyage<br />starts with a team.</h1><p>Bring your colleges together. Build cohorts, support your Guides and prepare each team for its journey.</p>
      <div className="pa-login-hierarchy"><Building2 /><span>Colleges</span><ChevronRight /><GraduationCap /><span>Cohorts</span><ChevronRight /><Users /><span>Teams</span></div></div>
    <small>Explore. Question. Grow together.</small></section>
    <section className="pa-login-side"><div className="pa-login-form"><span className="pa-kicker">EXPEDITION ADMINISTRATION</span><ShieldCheck size={30} /><h2>Super admin sign-in</h2><p>Manage your colleges and their learning journeys.</p>
      <form method="post" onSubmit={async e => { e.preventDefault(); if (busy) return; const data = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); setError("");
        try { await onLogin(data); } catch (error) { setError(error.message); } finally { setBusy(false); } }}>
        <Field label="Email address"><input name="email" type="email" required autoComplete="username" placeholder="you@college.com" maxLength={254} /></Field>
        <Field label="Password"><PasswordInput name="password" required autoComplete="current-password" maxLength={256} /></Field>
        {error && <p className="pa-error" role="alert">{error}</p>}
        <button className="pa-primary" disabled={busy || !ready}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={17} /></button>
      </form><a className="pa-text-link" href="/recover?realm=platform">Forgot password?</a><p className="pa-note">College accounts sign in at their college’s own URL.</p>
    </div></section></main>;
}
function PasswordForm({ forced, onSave }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <section className="pa-password"><KeyRound size={27} /><h2>{forced ? "Set your super admin password" : "Change password"}</h2>
    <p>{forced ? "Replace the temporary password before opening your dashboard." : "Changing your password signs out your other platform sessions."}</p>
    <form method="post" onSubmit={async e => { e.preventDefault(); if (busy) return; const form = e.currentTarget, data = Object.fromEntries(new FormData(form)); setError("");
      if (data.newPassword !== data.confirmPassword) { setError("The new passwords do not match."); return; } setBusy(true);
      try { await onSave(data); form.reset(); } catch (error) { setError(error.message); } finally { setBusy(false); } }}>
      <Field label={forced ? "Temporary password" : "Current password"}><input name="currentPassword" type="password" autoComplete="current-password" required maxLength={256} /></Field>
      <Field label="New password" hint="Use at least 8 characters."><input name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></Field>
      <Field label="Confirm new password"><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} /></Field>
      {error && <p className="pa-error" role="alert">{error}</p>}
      <button className="pa-primary" disabled={busy || !ready}>{busy ? "Saving…" : "Save password"}<ArrowRight size={16} /></button>
    </form></section>;
}
export function ManagementDialog({ dialog, detail, cohort, onClose, onSave, staffRoles = ["MISSION_COMMANDER", "CENTRE_COMMAND"], allowRoleChange = true }) {
  const ref = useRef(null), requestId = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const type = dialog.type, initial = dialog.initial || {};
  const titles = { cc: "Add Centre Command", person: "Manage account", cohort: "Add a cohort", "edit-cohort": "Edit cohort", team: "Add a team", "edit-team": "Edit team", staff: "Add staff account", member: "Add a learner" };
  const hints = { cc: "Centre Command manages every cohort and team within this college.", person: "Update access and contact details. Team membership and saved history are preserved.", cohort: "Create a new intake within this college.", "edit-cohort": "Published activities retain their existing schedules.", team: "Create a team, then add up to five learners.", "edit-team": "Update team details and its assigned Guide.", staff: "This account will belong to the selected cohort.", member: "Create a learner account in this team." };
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close(); }, []);
  const guides = detail?.people.filter(p => p.cohortId === cohort?.id && p.role === "MISSION_COMMANDER" && p.active) || [];
  return <dialog ref={ref} className="pa-dialog" aria-labelledby="pa-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="pa-dialog-content"><header><div><span className="pa-kicker">{detail?.college.name || "JUNGLE PLATFORM"}</span><h2 id="pa-dialog-title">{titles[type]}</h2><p>{hints[type]}</p></div><button className="pa-icon" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={20} /></button></header>
    <form method="post" onSubmit={async e => { e.preventDefault(); if (busy) return; const data = Object.fromEntries(new FormData(e.currentTarget)); setBusy(true); setError(""); requestId.current ||= crypto.randomUUID();
      try { await onSave(type, { ...data, requestId: requestId.current }, initial); } catch (error) { setError(error.message); if (error.status >= 400 && error.status < 500) requestId.current = null; } finally { setBusy(false); } }}>
      {type === "cc" && <><Field label="Full name"><input name="name" required maxLength={120} autoFocus /></Field><Field label="Email address"><input name="email" type="email" required maxLength={120} autoComplete="off" /></Field>
        <Field label="Home cohort" hint="Used when opening the game workspace. College management includes all cohorts."><select name="cohortId" defaultValue={cohort?.id}>{detail?.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Initial password" hint="Share credentials privately with the account owner."><input name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></Field></>}
      {(type === "cohort" || type === "edit-cohort") && <><Field label="Cohort name"><input name="name" required maxLength={120} defaultValue={initial.name || ""} autoFocus /></Field>
        {type === "cohort" && <Field label="Cohort code" hint="A permanent code, such as intake-2027."><input name="code" required maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>}
        <Field label="Start date"><input name="startDate" type="date" required defaultValue={initial.startDate?.slice(0, 10) || ""} /></Field>
        {type === "edit-cohort" && <Field label="Current week"><input name="currentWeek" type="number" min={1} max={52} required defaultValue={initial.currentWeek} /></Field>}</>}
      {(type === "team" || type === "edit-team") && <><Field label="Team name"><input name="name" required maxLength={120} defaultValue={initial.name || ""} autoFocus /></Field>
        <Field label={type === "team" ? "Team code (optional)" : "Team code"} hint={type === "team" ? "Leave blank to generate a unique code." : undefined}><input name="code" maxLength={20} pattern="[a-zA-Z0-9][a-zA-Z0-9-]*" defaultValue={initial.code || ""} required={type === "edit-team"} /></Field>
        <Field label="Assigned Guide"><select name="commanderId" defaultValue={initial.commanderId || ""}><option value="">Unassigned</option>{guides.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        {!guides.length && <p className="pa-note">Add a Guide account to this cohort to assign it to a team.</p>}</>}
      {(type === "staff" || type === "member") && <><Field label="Full name"><input name="name" required maxLength={type === "member" ? 80 : 120} autoFocus /></Field>
        {type === "staff" ? <><Field label="Email address"><input name="email" type="email" required maxLength={120} autoComplete="off" /></Field>
          <Field label="Role"><select name="role">{staffRoles.map(role => <option key={role} value={role}>{role === "MISSION_COMMANDER" ? "Guide (Mission Commander)" : "Centre Command"}</option>)}</select></Field></> : <>
          <Field label="Recovery email (optional)" hint="Players without email can ask their MC or CC for an assisted password reset."><input name="email" type="email" maxLength={120} /></Field><Field label="Username" hint={usernameHint}><input name="username" required minLength={3} maxLength={32} pattern={usernamePattern} autoCapitalize="none" spellCheck={false} autoComplete="off" /></Field>
          <p className="pa-hint">Work roles are assigned automatically in the jungle coding stage and rotate each week. Players create their own avatars.</p></>}
        <Field label="Initial password" hint="Share credentials privately with the account owner."><input name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></Field></>}
      {type === "person" && <><Field label="Full name"><input name="name" required maxLength={120} defaultValue={initial.name} /></Field>
        <Field label={initial.role==="GAMER"?"Recovery email (optional)":"Email address"} hint={initial.role==="GAMER"?"No email is needed for an assisted reset by your MC or CC.":"Password recovery is sent to this registered address."}><input name="email" type="email" required={initial.role!=="GAMER"} maxLength={120} defaultValue={initial.role==="GAMER" && initial.email?.endsWith(".invalid")?"":initial.email} /></Field>
        <Field label={initial.role==="GAMER"?"Username":"Username (optional)"} hint={usernameHint}><input name="username" required={initial.role==="GAMER"} minLength={3} maxLength={32} pattern={usernamePattern} autoCapitalize="none" spellCheck={false} defaultValue={initial.username || ""} /></Field>
        {initial.role !== "GAMER" && allowRoleChange && <Field label="Role"><select name="role" defaultValue={initial.role}><option value="MISSION_COMMANDER">Guide</option><option value="CENTRE_COMMAND">Centre Command</option></select></Field>}
        <Field label="Account access" hint="Deactivation signs this person out and retains their work and assessment history."><select name="active" defaultValue={String(initial.active)}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
        {initial.role === "MISSION_COMMANDER" && <Field label="Replacement Guide" hint="Required when disabling an assigned Guide or changing their role."><select name="replacementGuideId"><option value="">No replacement</option>{guides.filter(p => p.id !== initial.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      </>}
      {error && <p className="pa-error" role="alert">{error}</p>}
      <footer><button type="button" className="pa-secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="pa-primary" disabled={busy}>{busy ? "Saving…" : (type.startsWith("edit") || type === "person") ? "Save changes" : "Create"}<Check size={16} /></button></footer>
    </form></div></dialog>;
}

export default function PlatformDashboard({ initialAdmin, initialCollegeId = "" }) {
  const [admin, setAdmin] = useState(initialAdmin), [view, setView] = useState("colleges"), [collegeId, setCollegeId] = useState(initialCollegeId);
  const [directory, setDirectory] = useState(null), [detail, setDetail] = useState(null), [activity, setActivity] = useState(null);
  const [cohortId, setCohortId] = useState(""), [teamId, setTeamId] = useState(""), [dialog, setDialog] = useState(null);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [resetPlayer,setResetPlayer]=useState(null);
  const panelId = useId();
  const [query, setQuery] = useState({ search: "", status: "", page: 1 }), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [signingOut, setSigningOut] = useState(false);
  const cohort = detail?.cohorts.find(c => c.id === cohortId) || detail?.cohorts[0];
  const teams = detail?.teams.filter(t => t.cohortId === cohort?.id) || [];
  const people = detail?.people.filter(p => p.cohortId === cohort?.id) || [];
  const editable = detail && !detail.incomplete && detail.college.status !== "ARCHIVED";
  function failure(e) { if (e.name === "AbortError") return; setError(e.message); if (e.status === 401) setAdmin(null); }
  function selectCollege(id) { setCollegeId(id); setDetail(null); setCohortId(""); setTeamId(""); setTeamsExpanded(true); setError(""); history.pushState(null, "", id ? `/platform?college=${enc(id)}` : "/platform"); }
  useEffect(() => { const change = () => { setCollegeId(new URL(location.href).searchParams.get("college") || ""); setDetail(null); setCohortId(""); }; addEventListener("popstate", change); return () => removeEventListener("popstate", change); }, []);
  useEffect(() => {
    if (!admin || admin.mustChangePassword || ["account", "administrators", "recovery"].includes(view)) return;
    const controller = new AbortController(); setLoading(true); setError("");
    const timer = setTimeout(async () => {
      try {
        if (view === "activity") setActivity(await api("activity", { signal: controller.signal }));
        else if (collegeId) { const result = await api(`colleges/${enc(collegeId)}`, { signal: controller.signal }); setDetail(result); }
        else setDirectory(await api(`colleges?${new URLSearchParams({ ...query, page: String(query.page) })}`, { signal: controller.signal }));
      } catch (e) { failure(e); } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query.search ? 200 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [admin, view, collegeId, query.search, query.status, query.page, revision]);
  async function save(type, values, initial) {
    const base = collegeId ? `colleges/${enc(collegeId)}` : "colleges";
    let result;
    if (type === "cc") await api(`${base}/cc`, { body: values });
    else if (type === "cohort") { result = await api(`${base}/cohorts`, { body: values }); setCohortId(result.id); }
    else {
      const path = `${base}/cohorts/${enc(type === "person" ? initial.cohortId : cohort.id)}`;
      if (type === "person") await api(`${path}/people/${enc(initial.id)}`, { method: "PATCH", body: { ...values, active: values.active === "true", version: initial.version } });
      if (type === "edit-cohort") await api(path, { method: "PATCH", body: { ...values, version: initial.version } });
      if (type === "staff") await api(`${path}/staff`, { body: values });
      if (type === "team") { result = await api(`${path}/teams`, { body: values }); setTeamId(result.id); }
      if (type === "edit-team") await api(`${path}/teams/${enc(initial.id)}`, { method: "PATCH", body: { ...values, version: initial.version } });
      if (type === "member") { const { requestId, ...member } = values; await api(`${path}/teams/${enc(initial.id)}/members`, { body: { requestId, member } }); }
    }
    setDialog(null); setRevision(n => n + 1); setNotice((type.startsWith("edit") || type === "person") ? "Changes saved." : "Created successfully.");
  }
  async function savePassword(values) { const result = await api("auth/password", { body: values }); setAdmin(result.admin); setView("colleges"); setNotice("Password updated."); }
  async function recoverPerson(person) {
    if(person.role==="GAMER"){setResetPlayer(person);return;}
    setError("");
    try { await api("recovery", { body: { realm: "college", collegeId, userId: person.id, replace: true } }); setNotice("Password reset requested. View Recovery for delivery status."); }
    catch (e) { failure(e); }
  }
  if (!admin) return <Login onLogin={async values => { await api("auth/login", { body: values }); location.reload(); }} />;
  return <main className="platform-admin pa-shell"><aside className="pa-sidebar"><PlatformBrand />
    <div className="pa-sidebar-caption">EXPEDITION MANAGEMENT</div><nav aria-label="Platform navigation">{[["colleges", Building2, "Colleges"], ["administrators", ShieldCheck, "Super admins"], ["recovery", Mail, "Recovery"], ["activity", Activity, "Activity"], ["account", KeyRound, "Account"]].map(([key, Icon, text]) =>
      <button key={key} className={view === key ? "is-active" : ""} onClick={() => { setView(key); if (key === "colleges") selectCollege(""); setNotice(""); setError(""); }} disabled={admin.mustChangePassword && key !== "account"}><Icon size={19} />{text}{key === "colleges" && <ChevronRight size={15} />}</button>)}</nav>
    <div className="pa-sidebar-foot"><a href="/platform"><CircleHelp size={17} />CMS home<ArrowRight size={14} /></a>
      <div className="pa-admin-identity"><span className="pa-avatar">{admin.name[0]}</span><div><strong>Super admin</strong><small title={admin.email}>{admin.email}</small></div>
      </div>
      <NavLogoutButton busy={signingOut} onClick={async () => { if (signingOut) return; setSigningOut(true); try { await api("auth/logout", { body: {} }); location.assign("/platform"); } catch (e) { failure(e); setSigningOut(false); } }} />
    </div>
  </aside><section className="pa-workspace"><header className="pa-topbar"><div><span>VOW CMS</span><ChevronRight size={14} /><strong>{view === "account" || admin.mustChangePassword ? "Account" : ({ activity: "Activity", administrators: "Super admins", recovery: "Recovery" }[view] || "Colleges")}</strong>{collegeId && view === "colleges" && detail && <><ChevronRight size={14} /><span>{detail.college.name}</span></>}</div><span className="pa-platform-label"><ShieldCheck size={15} />Super admin</span></header>
    <div className="pa-content">{error && <div className="pa-error" role="alert">{error}<button className="pa-text-link" onClick={() => setRevision(n => n + 1)}>Try again</button></div>}
      {notice && <div className="pa-success" role="status"><Check size={16} />{notice}<button className="pa-icon" onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={16} /></button></div>}
      {admin.mustChangePassword || view === "account" ? <><div className="pa-page-heading"><div><span className="pa-kicker">YOUR ACCOUNT</span><h1>{admin.mustChangePassword ? "Welcome to Jungle." : "Account settings"}</h1><p>{admin.email}</p></div></div><PasswordForm forced={admin.mustChangePassword} onSave={savePassword} /></>
      : ["administrators", "recovery"].includes(view) ? <PlatformAccounts key={view} view={view} admin={admin} />
      : view === "activity" ? <><div className="pa-page-heading"><div><span className="pa-kicker">PLATFORM RECORD</span><h1>Activity</h1><p>Recent college and workspace management changes.</p></div><button className="pa-secondary" onClick={() => setRevision(n => n + 1)} disabled={loading}><RefreshCw size={16} />Refresh</button></div>
        <section className="pa-table-wrap" aria-busy={loading}><table><thead><tr><th>Action</th><th>College</th><th>By</th><th>Outcome</th><th>When</th></tr></thead><tbody>{activity?.map(a => <tr key={a.id}><td>{statusName(a.action)}</td><td>{a.college}</td><td>{a.actor}</td><td><Status value={a.state} /></td><td>{a.createdAt ? new Date(a.createdAt).toLocaleString("en-IN") : "—"}</td></tr>)}</tbody></table>{!activity?.length && <div className="pa-empty">{loading ? "Loading activity…" : "No management activity yet."}</div>}</section></>
      : !collegeId ? <><div className="pa-page-heading pa-directory-heading"><div><span className="pa-kicker">YOUR EXPEDITION NETWORK</span><h1>Colleges<span className="pa-heading-count">{directory ? Object.values(directory.counts).reduce((a, b) => a + b, 0) : "—"}</span></h1><p>Give every cohort a starting point. Bring Guides and learners together, one team at a time.</p></div><a className="pa-primary" href="/platform/colleges/new"><Plus size={18} />Add college</a></div>
        <div className="pa-directory-summary"><span><i className="pa-live-dot" />{directory?.counts.ACTIVE || 0} active</span><span>{directory?.counts.INACTIVE || 0} inactive</span><span>{directory?.counts.SUSPENDED || 0} suspended</span><span>{directory?.counts.ARCHIVED || 0} archived</span></div>
        <section className="pa-directory"><div className="pa-toolbar"><label className="pa-search"><Search size={18} /><input aria-label="Search colleges" placeholder="Search by college name or code" value={query.search} onChange={e => setQuery(q => ({ ...q, search: e.target.value, page: 1 }))} /></label><select aria-label="Filter colleges by status" value={query.status} onChange={e => setQuery(q => ({ ...q, status: e.target.value, page: 1 }))}><option value="">All statuses</option>{["ACTIVE", "INACTIVE", "SUSPENDED", "MAINTENANCE", "ARCHIVED", "DELETING", "PROVISIONING", "FAILED"].map(s => <option key={s} value={s}>{statusName(s)}</option>)}</select><button className="pa-icon" aria-label="Refresh colleges" disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={17} /></button></div>
        <div className="pa-table-wrap" aria-busy={loading}><table><thead><tr><th>College</th><th>Reference</th><th>Status</th><th>Added</th><th><span className="pa-sr-only">Open college</span></th></tr></thead><tbody>{directory?.colleges.map(c => <tr key={c.id}><td><button className="pa-college-link" onClick={() => selectCollege(c.id)}><span className="pa-college-avatar"><Building2 size={20} /></span><strong>{c.name}</strong></button></td><td><code>{c.slug}</code></td><td><Status value={c.status} /></td><td>{dateText(c.createdAt)}</td><td><button className="pa-icon" aria-label={`Manage ${c.name}`} onClick={() => selectCollege(c.id)}><ArrowRight size={18} /></button></td></tr>)}</tbody></table>
          {!directory?.colleges.length && <div className="pa-empty"><Building2 size={30} /><h3>{loading ? "Loading colleges…" : query.search || query.status ? "No colleges match" : "Your first college starts here"}</h3><p>{query.search || query.status ? "Try another name, code or status." : "Add a college to create its first cohort and administrator."}</p>{!loading && !query.search && !query.status && <a className="pa-secondary" href="/platform/colleges/new"><Plus size={16} />Add college</a>}</div>}</div>
        {directory && <footer className="pa-pagination"><span>{directory.total} {directory.total === 1 ? "college" : "colleges"}{loading ? " · Updating…" : ""}</span><div><button disabled={query.page === 1 || loading} className="pa-icon" aria-label="Previous page" onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}><ChevronRight className="pa-reverse" size={16} /></button><span>{directory.page} / {directory.pages}</span><button disabled={query.page >= directory.pages || loading} className="pa-icon" aria-label="Next page" onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}><ChevronRight size={16} /></button></div></footer>}</section></>
      : !detail ? <><button className="pa-back" onClick={() => selectCollege("")}><ArrowLeft size={16} />All colleges</button><div className="pa-empty" role="status">{loading ? "Opening college…" : "Select a college or try refreshing."}</div></>
      : <><button className="pa-back" onClick={() => selectCollege("")}><ArrowLeft size={16} />All colleges</button><div className="pa-page-heading"><div><span className="pa-kicker">COLLEGE WORKSPACE</span><h1>{detail.college.name}</h1><div className="pa-college-meta"><Status value={detail.college.status} /><code>{detail.college.slug}</code></div></div>{!detail.incomplete && <a className="pa-secondary" href={`/platform/colleges/${enc(detail.college.id)}/edit`}><Pencil size={16} />College settings</a>}</div>
        <CollegeLifecycleActions key={detail.college.id} college={detail.college} onChanged={result=>{setRevision(n=>n+1);if(!result.refreshOnly)setNotice(result.pending?"College blocked. Retry deletion after the displayed time.":result.status==="INACTIVE"?"College deactivated. Tenant access is blocked.":"College access restored. Users must sign in again.");}} onDeleted={()=>{selectCollege("");setRevision(n=>n+1);setNotice("College and tenant data permanently deleted.");}} />
        {detail.accessBlocked ? <div className="pa-empty"><ShieldCheck size={28}/><h2>{detail.college.status==="DELETING"?"College deletion is pending":"College is inactive"}</h2><p>{detail.college.status==="DELETING"?"Tenant access is blocked. Retry permanent deletion to finish cleanup.":"The tenant URL and college sessions are blocked. Restore access to manage retained cohorts, teams and accounts."}</p><button className="pa-secondary" onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/>Refresh status</button></div> : detail.incomplete ? <div className="pa-empty"><h2>{detail.college.status === "FAILED" ? "College setup needs attention" : "College setup is in progress"}</h2><p>{detail.college.status === "FAILED" ? "Retry setup with the college details and initial administrator account." : "Refresh shortly to see its first cohort."}</p>{detail.college.status === "FAILED" && <a className="pa-primary" href={`/platform/colleges/new?retry=${enc(detail.college.id)}`}>Retry setup</a>}<button className="pa-secondary" onClick={() => setRevision(n => n + 1)}><RefreshCw size={16} />Refresh</button></div>
        : <><div className="pa-detail-summary"><span><GraduationCap size={18} /><strong>{detail.cohorts.length}</strong>{detail.cohorts.length === 1 ? "cohort" : "cohorts"}</span><span><Users size={18} /><strong>{detail.teams.length}</strong>{detail.teams.length === 1 ? "team" : "teams"}</span><span><strong>{detail.people.filter(p => p.role === "GAMER").length}</strong>{detail.people.filter(p => p.role === "GAMER").length === 1 ? "learner" : "learners"}</span></div>
        <CollegeLoginUrl url={detail.college.loginUrl} />
        <CollegeProfile profile={detail.college.profile} />
        {detail.college.status === "ARCHIVED" && <p className="pa-note">This college is archived. Its records remain available. Reactivate it in College settings to make changes.</p>}
        <section aria-label="College Centre Command" className="pa-college-cc"><div className="pa-section-heading"><h3>Centre Command · College administrators</h3><button className="pa-secondary" disabled={!editable} onClick={() => setDialog({ type: "cc" })}><Plus size={16} />Add CC</button></div><p className="pa-note">CCs manage every cohort and team in this college. Their home cohort is used for the game workspace.</p><div className="pa-staff">{detail.people.filter(p => p.role === "CENTRE_COMMAND").map(p => <div className="pa-staff-row" key={p.id}><span className="pa-avatar">{p.name[0]}</span><div><strong>{p.name}{!p.active && " · Inactive"}</strong><small>{p.email}</small></div><button className="pa-icon" disabled={!editable} aria-label={`Manage Centre Command ${p.name}`} onClick={() => setDialog({ type: "person", initial: p })}><Pencil size={16} /></button></div>)}</div></section>
        <div className="cohort-management"><div className="cm-sections"><section className="cm-cohorts" aria-labelledby={`${panelId}-cohorts`}><header className="cm-section-heading"><div><h2 id={`${panelId}-cohorts`}>Cohorts</h2><p>Select a cohort to view its teams and members.</p></div><button className="pa-secondary" disabled={!editable} onClick={() => setDialog({ type: "cohort" })}><Plus size={16} />Add cohort</button></header><div className="cm-cohort-grid">{detail.cohorts.map(c => <button type="button" key={c.id} className={`cm-cohort-choice ${cohort?.id === c.id ? "is-active" : ""}`} aria-pressed={cohort?.id === c.id} onClick={() => { setCohortId(c.id); setTeamId(""); setTeamsExpanded(true); }}><GraduationCap size={20} /><span><strong>{c.name}</strong><small>{countLabel(detail.teams.filter(t => t.cohortId === c.id).length, "team")} · Week {c.currentWeek}</small></span>{cohort?.id === c.id ? <Check size={16} /> : <ChevronRight size={16} />}</button>)}</div>{!detail.cohorts.length && <p>No cohorts yet.</p>}</section>
          <div className="pa-cohort-content cm-cohort-content">{!cohort ? <div className="pa-empty"><h2>Add the first cohort</h2><p>Organise learners into an intake before creating teams.</p><button className="pa-primary" disabled={!editable} onClick={() => setDialog({ type: "cohort" })}><Plus size={16} />Add cohort</button></div> : <>
            <div className="pa-cohort-heading"><div><h2>{cohort.name}</h2><p>Started {dateText(cohort.startDate)}<span>·</span>Week {cohort.currentWeek}</p></div><button className="pa-icon" aria-label="Edit cohort" disabled={!editable} onClick={() => setDialog({ type: "edit-cohort", initial: cohort })}><Pencil size={17} /></button></div>
            <section className="cm-team-section" aria-labelledby={`${panelId}-teams-title`}><div className="pa-section-heading cm-team-heading"><h3 id={`${panelId}-teams-title`}><button type="button" className="cm-section-toggle" aria-expanded={teamsExpanded} aria-controls={`${panelId}-teams`} onClick={() => setTeamsExpanded(value => !value)}><Users size={19} /><span>Teams</span><span className="cm-count">{teams.length}</span><ChevronDown size={18} className={teamsExpanded ? "is-open" : ""} /></button></h3><button className="pa-secondary" disabled={!editable} onClick={() => setDialog({ type: "team" })}><Plus size={16} />Add team</button></div>
            <div id={`${panelId}-teams`} hidden={!teamsExpanded} className="pa-teams">{teams.map(t => { const members = people.filter(p => p.teamId === t.id && p.role === "GAMER"), guide = people.find(p => p.id === t.commanderId), expanded = teamId === t.id, membersId = `${panelId}-members-${t.id}`; return <article className="pa-team cm-team" key={t.id}><div className="pa-team-header"><button type="button" className="pa-team-toggle" aria-label={`${expanded ? "Hide" : "Show"} members of ${t.name}`} aria-expanded={expanded} aria-controls={membersId} onClick={() => setTeamId(expanded ? "" : t.id)}><ChevronDown size={18} className={expanded ? "is-open" : ""} /><span><strong>{t.name}</strong><small>{t.code}</small></span></button><span className="pa-guide-name">{guide?.name || "Guide unassigned"}</span><span className="pa-team-count">{members.length}/5 learners</span><button className="pa-icon" aria-label={`Edit ${t.name}`} disabled={!editable} onClick={() => setDialog({ type: "edit-team", initial: t })}><Pencil size={16} /></button></div>
              <div id={membersId} hidden={!expanded} className="pa-team-members"><h4 className="cm-members-title">Team members <span>{members.length}</span></h4>{members.map(m => <div className="pa-member" key={m.id}><span className="pa-avatar">{m.name[0]}</span><div><strong>{m.name}</strong><small>{m.username || m.email}</small></div><span className="pa-person-meta">{teamRoles.find(r => r.code === m.teamRoleCode)?.label || "Team role unassigned"}{!m.active && " · Inactive"}</span><div className="pa-account-actions"><button className="pa-icon" aria-label={`Edit account for ${m.name}`} disabled={!editable} onClick={() => setDialog({ type: "person", initial: m })}><Pencil size={15} /></button><button className="pa-icon" aria-label={`Password reset for ${m.name}`} disabled={!editable || !m.active} onClick={() => recoverPerson(m)}><KeyRound size={15} /></button></div></div>)}{!members.length && <p className="pa-note">No learners in this team yet.</p>}<button className="pa-text-link" disabled={!editable || members.length >= 5} onClick={() => setDialog({ type: "member", initial: t })}><Plus size={15} />{members.length >= 5 ? "Team is full" : "Add learner"}</button></div></article>; })}{!teams.length && <div className="pa-empty pa-empty-small"><Users size={26} /><h3>No teams yet</h3><p>Create a team for this cohort, then add its learners.</p></div>}</div></section>
            <div className="pa-section-heading"><h3>Staff <span>{people.filter(p => p.role !== "GAMER").length}</span></h3><button className="pa-secondary" disabled={!editable} onClick={() => setDialog({ type: "staff" })}><Plus size={16} />Add staff</button></div><section className="pa-staff">{people.filter(p => p.role !== "GAMER").map(p => <div className="pa-staff-row" key={p.id}><span className="pa-avatar">{p.name[0]}</span><div><strong>{p.name}</strong><small>{p.email}</small></div><span className="pa-person-meta">{roleName(p.role)}{!p.active && " · Inactive"}</span><div className="pa-account-actions"><button className="pa-icon" aria-label={`Edit account for ${p.name}`} disabled={!editable} onClick={() => setDialog({ type: "person", initial: p })}><Pencil size={15} /></button><button className="pa-icon" aria-label={`Password reset for ${p.name}`} disabled={!editable || !p.active} onClick={() => recoverPerson(p)}><KeyRound size={15} /></button></div></div>)}{!people.some(p => p.role !== "GAMER") && <p className="pa-note">Add Centre Command or a Guide to give this cohort its staff accounts.</p>}</section>
          </>}</div></div></div></>}
      </>}
    </div></section>{dialog && <ManagementDialog dialog={dialog} detail={detail} cohort={cohort} onClose={() => setDialog(null)} onSave={save} />}{resetPlayer && <PlayerPasswordResetDialog player={resetPlayer} onClose={()=>setResetPlayer(null)} onComplete={()=>setRevision(n=>n+1)} onReset={values=>api(`colleges/${enc(collegeId)}/cohorts/${enc(resetPlayer.cohortId)}/people/${enc(resetPlayer.id)}/password-reset`,{body:values})}/>}</main>;
}

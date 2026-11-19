"use client";
import { useEffect, useRef, useState } from "react";
import { Check, KeyRound, Mail, Pencil, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { platformApi as api } from "@/lib/platform-client.js";
import { Field } from "./PlatformFields";
const stateName = value => value?.toLowerCase().replaceAll("_", " ").replace(/^./, s => s.toUpperCase());
export default function PlatformAccounts({ view, admin }) {
  const [data, setData] = useState(null), [revision, setRevision] = useState(0), [dialog, setDialog] = useState(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const isAdmins = view === "administrators";
  function failed(e) { if (e.status === 401) location.reload(); else setError(e.message); }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setData(null); setError("");
    api(view, { signal: controller.signal }).then(setData).catch(e => { if (e.name !== "AbortError") failed(e); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [view, revision]);
  useEffect(() => { if (dialog) ref.current.showModal(); }, [dialog]);
  async function reset(person, realm = "platform", collegeId) {
    if (busy) return; setBusy(true); setError("");
    try { await api("recovery", { body: { realm, userId: person.id || person.userId, collegeId, replace: true } });
      setNotice("Password reset requested. Check the Recovery page for delivery status."); setRevision(n => n + 1);
    } catch (e) { failed(e); } finally { setBusy(false); }
  }
  const missingLabels = { SMTP_TENANT_ID: "Microsoft directory (tenant) ID", SMTP_CLIENT_ID: "Microsoft application (client) ID", SMTP_CLIENT_SECRET: "Microsoft application secret",
    SMTP_HOST: "Outgoing mail server", SMTP_PORT: "Outgoing mail port", SMTP_USER: "Sender mailbox", SMTP_PASS: "Mailbox application password", CMS_EMAIL_FROM: "Sender address", CMS_PUBLIC_ORIGIN: "Public application URL", SESSION_SECRET: "Server encryption secret", SMTP_AUTH_MODE: "Mail authorization method" };
  return <><div className="pa-page-heading"><div><span className="pa-kicker">{isAdmins ? "PLATFORM ACCESS" : "ACCOUNT RECOVERY"}</span><h1>{isAdmins ? "Super admins" : "Password recovery"}</h1><p>{isAdmins ? "Manage the people who administer every college." : "Track reset requests and outgoing recovery emails."}</p></div>
    {isAdmins ? <button className="pa-primary" onClick={() => setDialog({})}><Plus size={17} />Add super admin</button> : <button className="pa-secondary" onClick={() => setRevision(n => n + 1)} disabled={loading}><RefreshCw size={16} />Refresh</button>}</div>
    {error && <p className="pa-error" role="alert">{error}</p>}{notice && <p className="pa-success" role="status"><Check size={16} />{notice}</p>}
    {!isAdmins && data && <section className="pa-mail-setup"><Mail size={22} /><div><h2>{data.configuration.ready ? "Mailbox connection configured" : "Microsoft 365 setup needed"}</h2>
      <p>{data.configuration.ready ? `Recovery mail is configured from ${data.configuration.sender}. Delivery results appear below.` : "Automatic email needs your Microsoft 365 administrator to authorize the sender mailbox. Account records remain unchanged until a valid reset link is used."}</p>
      <p><strong>Sender:</strong> {data.configuration.sender || "Not configured"}</p>
      {!!data.configuration.missing.length && <><ul>{data.configuration.missing.map(k => <li key={k}>{missingLabels[k] || k}</li>)}</ul>
        <a className="pa-text-link" href="https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth" target="_blank" rel="noreferrer">Microsoft's mailbox authorization instructions</a></>}
    </div></section>}
    <section className="pa-table-wrap pa-account-table" aria-busy={loading}><table><thead>{isAdmins ? <tr><th>Administrator</th><th>Access</th><th>Password</th><th>Actions</th></tr> : <tr><th>Account</th><th>Type</th><th>Request</th><th>Email delivery</th><th>Actions</th></tr>}</thead><tbody>
      {isAdmins ? data?.map(p => <tr key={p.id}><td><strong>{p.name}{p.id === admin.id ? " (you)" : ""}</strong><small>{p.email}</small></td><td><span className={`pa-status pa-status-${p.active ? "active" : "suspended"}`}>{p.active ? "Active" : "Inactive"}</span></td><td>{p.mustChangePassword ? "Change required at sign-in" : "Set"}</td><td><div className="pa-account-actions"><button className="pa-icon" aria-label={`Edit ${p.name}`} onClick={() => setDialog(p)}><Pencil size={16} /></button><button className="pa-text-link" disabled={!p.active || busy} onClick={() => reset(p)}><KeyRound size={15} />Send reset</button></div></td></tr>)
      : data?.requests.map(r => <tr key={r._id}><td><strong>{r.name}</strong><small>{r.email}</small></td><td>{r.realm === "platform" ? "Super admin" : "College account"}</td><td>{r.state === "USED" ? "Completed" : r.expired ? "Expired" : stateName(r.state)}<small>{new Date(r.createdAt).toLocaleString("en-IN")}</small></td><td><span className={`pa-status pa-status-${r.delivery === "SENT" ? "active" : r.delivery === "FAILED" ? "failed" : "maintenance"}`}>{r.delivery === "SENT" ? "Accepted by mail server" : stateName(r.delivery)}</span>{r.failureCode && <small>{r.failureCode === "CONFIGURATION" ? "Mailbox setup required" : r.failureCode === "AUTHORIZATION" ? "Mailbox authorization failed" : "Delivery failed; retry available"}</small>}</td><td><button className="pa-text-link" disabled={busy || r.state === "USED" || !data.configuration.ready} onClick={() => reset({ userId: r.userId }, r.realm, r.collegeId)}><Mail size={15} />Send new link</button></td></tr>)}
    </tbody></table>{loading ? <div className="pa-empty">Loading…</div> : !(isAdmins ? data?.length : data?.requests.length) && <div className="pa-empty">{isAdmins ? "No administrators found." : "No password reset requests yet."}</div>}</section>
    {dialog && <dialog ref={ref} className="pa-dialog" aria-labelledby="pa-admin-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) setDialog(null); }}><div className="pa-dialog-content"><header><div><span className="pa-kicker">PLATFORM ACCESS</span><h2 id="pa-admin-dialog-title">{dialog.id ? "Edit super admin" : "Add super admin"}</h2><p>A super admin can manage all colleges and their accounts.</p></div><button className="pa-icon" aria-label="Close dialog" disabled={busy} onClick={() => setDialog(null)}><X size={19} /></button></header>
      <form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(""); const fields = Object.fromEntries(new FormData(e.currentTarget));
        try { const result = await api(dialog.id ? `administrators/${encodeURIComponent(dialog.id)}` : "administrators", { method: dialog.id ? "PATCH" : "POST",
          body: { ...fields, ...(dialog.id ? { active: dialog.id === admin.id ? true : fields.active === "true", version: dialog.version } : {}) } });
          if (result.id === admin.id) { location.reload(); return; } setDialog(null); setRevision(n => n + 1); setNotice("Administrator saved.");
        } catch (e) { failed(e); } finally { setBusy(false); }
      }}><Field label="Full name"><input name="name" required maxLength={120} defaultValue={dialog.name || ""} /></Field><Field label="Email address"><input name="email" type="email" required maxLength={254} defaultValue={dialog.email || ""} /></Field>
      {dialog.id ? <Field label="Account access" hint={dialog.id === admin.id ? "You cannot deactivate your own account." : "Deactivation signs out this administrator and preserves their history."}><select name="active" defaultValue={String(dialog.active)} disabled={dialog.id === admin.id}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
        : <Field label="Initial password" hint="The new administrator must change this password at first sign-in."><input name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></Field>}
      {error && <p className="pa-error" role="alert">{error}</p>}<footer><button type="button" className="pa-secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</button><button className="pa-primary" disabled={busy}>{busy ? "Saving…" : "Save administrator"}<ShieldCheck size={16} /></button></footer></form>
    </div></dialog>}
  </>;
}

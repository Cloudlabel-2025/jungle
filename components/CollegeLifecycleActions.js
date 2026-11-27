"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Power, RotateCcw, Trash2, X } from "lucide-react";
import { platformApi } from "@/lib/platform-client.js";

export default function CollegeLifecycleActions({college,onChanged,onDeleted}) {
  const [mode,setMode]=useState(null), [confirmation,setConfirmation]=useState(""), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const [now,setNow]=useState(Date.now);
  const dialog=useRef(null),pending=useRef(false),id=useId();
  const deleting=college.status==="DELETING", inactive=college.status==="INACTIVE";
  const waiting=deleting && college.deletionReadyAt && new Date(college.deletionReadyAt).getTime()>now;
  useEffect(()=>{if(mode) dialog.current?.showModal();},[mode]);
  useEffect(()=>{if(!college.deletionReadyAt)return;const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[college.deletionReadyAt]);
  function open(action){setError("");setConfirmation("");setMode(action);}
  const title=mode==="delete"?"Permanently delete college":mode==="restore"?"Restore college access":"Deactivate college";
  async function submit(event){
    event.preventDefault();if(pending.current)return;
    pending.current=true;setBusy(true);setError("");
    try {
      const result=await platformApi(`colleges/${encodeURIComponent(college.id)}${mode==="delete"?"":"/access"}`,{
        method:mode==="delete"?"DELETE":"POST",body:{version:college.version,accessRevision:college.accessRevision,...(mode==="delete"?{confirmationSlug:confirmation}:{action:mode})},
      });
      setMode(null);
      if(result.deleted)onDeleted();else onChanged(result);
    }catch(failure){setError(failure.message);onChanged({refreshOnly:true});}
    finally{pending.current=false;setBusy(false);}
  }
  return <section className="pa-lifecycle" aria-label="College access and deletion">
    <div><h2>College access &amp; deletion</h2><p>{deleting?"Deletion is pending. Tenant access stays blocked until cleanup finishes.":inactive?"This college is inactive. Its data is retained and its tenant URL is unavailable to every college role.":"Deactivate to keep college data while blocking all tenant access. Permanently delete to erase the college and its tenant data."}</p>
      {waiting && <p role="status">Cleanup is waiting for outstanding activity or upload permissions to expire. Retry after {new Date(college.deletionReadyAt).toLocaleString("en-IN")}.</p>}</div>
    <div className="pa-lifecycle-actions">
      {!deleting && !["PROVISIONING","FAILED"].includes(college.status) && <button type="button" className="pa-secondary" disabled={busy} onClick={()=>open(inactive?"restore":"deactivate")}>{inactive?<RotateCcw size={16}/>:<Power size={16}/>} {inactive?"Restore access":"Deactivate college"}</button>}
      <button type="button" className="pa-delete-button" disabled={busy || college.status==="PROVISIONING" || Boolean(waiting)} onClick={()=>open("delete")}><Trash2 size={16}/>{deleting?"Retry permanent deletion":"Delete permanently"}</button>
    </div>
    {mode && <dialog ref={dialog} className="pa-lifecycle-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event=>{event.preventDefault();if(!busy)setMode(null);}}>
      <header><h2 id={`${id}-title`}>{title}</h2><button type="button" className="pa-icon" aria-label="Close confirmation" disabled={busy} onClick={()=>setMode(null)}><X size={18}/></button></header>
      <p id={`${id}-description`}>{mode==="delete"?`Erase ${college.name}, all its accounts, cohorts, teams, learning records and stored files. This cannot be undone.`:mode==="restore"?`Make ${college.name} accessible again. Users must sign in again; retained data will be available.`:`Make ${college.name} inactive immediately. Direct links, sign-ins and existing sessions will stop working. All tenant data will be kept.`}</p>
      <form onSubmit={submit}>
        {mode==="delete" && <label htmlFor={`${id}-code`}><span>Type <strong>{college.slug}</strong> to confirm</span><input id={`${id}-code`} autoFocus autoComplete="off" spellCheck={false} required value={confirmation} disabled={busy} onChange={event=>setConfirmation(event.target.value)}/></label>}
        {error && <p role="alert" className="pa-error">{error}</p>}
        <footer><button type="button" className="pa-secondary" disabled={busy} onClick={()=>setMode(null)}>Cancel</button><button className={mode==="delete"?"pa-delete-button":"pa-primary"} disabled={busy || (mode==="delete" && confirmation!==college.slug)}>{busy?"Working…":title}</button></footer>
      </form>
    </dialog>}
  </section>;
}

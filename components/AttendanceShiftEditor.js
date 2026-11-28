"use client";
import {useState} from "react";
import fetch from "@/lib/college-fetch.js";

export default function AttendanceShiftEditor({data,onSaved}){
  const [start,setStart]=useState(data.currentHours.startTime),[end,setEnd]=useState(data.currentHours.endTime),[effective,setEffective]=useState(data.today),[reason,setReason]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(event){
    event.preventDefault();if(busy)return;setBusy(true);setError("");
    try{
      const response=await fetch("/api/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"HOURS",hours:{startTime:start,endTime:end},effectiveDay:effective,reason,version:data.shiftVersion})});
      const result=await response.json();if(!response.ok)throw Error(result.error || "Could not save the shift.");
      setReason("");onSaved(`Shift saved from ${result.effectiveDay}. Previous shifts remain in history.`);
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  }
  return <details className="calendar-hours"><summary>Attendance shift · {data.currentHours.startTime}–{data.currentHours.endTime}</summary>
    <p>Daily schedule for the whole cohort, in {data.timeZone}. Changes from today update open sessions. Closed sessions and earlier dates retain their recorded shift.</p>
    {data.canEdit&&<form className="calendar-editor calendar-hours-form" onSubmit={save}>
      <label>Clock-in opens<input type="time" required value={start} disabled={busy} onChange={e=>setStart(e.target.value)}/></label>
      <label>Official clock-out<input type="time" required min={start} value={end} disabled={busy} onChange={e=>setEnd(e.target.value)}/></label>
      <label>Effective from<input type="date" required min={data.today} value={effective} disabled={busy} onChange={e=>setEffective(e.target.value)}/></label>
      <label>Reason<input required minLength={5} maxLength={1000} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
      {error&&<p role="alert">{error} Refresh attendance if another editor has saved a change.</p>}
      <button className="calendar-save" disabled={busy}>{busy?"Saving…":"Save shift"}</button>
    </form>}
    <details className="calendar-history"><summary>Shift change history <span>{data.shiftHistory.length}</span></summary><ol>{data.shiftHistory.map(entry=><li key={entry._id}><strong>From {entry.date}</strong><span>{entry.before.startTime}–{entry.before.endTime} → {entry.after.startTime}–{entry.after.endTime}</span><p>{entry.reason}</p><small>{entry.actorName} · {new Date(entry.createdAt).toLocaleString("en-IN",{timeZone:data.timeZone})}</small></li>)}{!data.shiftHistory.length&&<li>No shift changes recorded.</li>}</ol></details>
  </details>;
}

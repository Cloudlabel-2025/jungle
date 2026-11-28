"use client";
import {useEffect,useState} from "react";
import {Modal} from "./ui";
import {fieldLabels} from "@/lib/week-one-catalog.js";

export default function DraftConflictDialog({ownerId,screen}) {
  const [conflict,setConflict]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    setConflict(null);setError("");
    const receive=event=>{if(event.detail.ownerId===ownerId){setConflict(event.detail);setError("");}};
    window.addEventListener("codewild:draft-conflict",receive);
    return()=>window.removeEventListener("codewild:draft-conflict",receive);
  },[ownerId,screen]);
  if(!conflict)return null;
  const resolve=async choice=>{
    setBusy(true);setError("");
    try{await conflict.resolve(choice);setConflict(old=>old===conflict?null:old);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <Modal title="Keep your latest work" kicker="SAVED ANSWER CHECK" close={()=>{if(!busy)setConflict(null);}} portal>
    <div className="draft-conflict-review"><p>Your level is still active. Another copy changed the answers below. Choose which version to keep; your other edits will be preserved.</p>
      {conflict.conflicts.map(item=><section key={item.field}>
        <h3>{fieldLabels[item.field.split(".").at(-1)]||item.field}</h3>
        <div className="draft-conflict-versions"><div><strong>Your current answer</strong><p>{format(item.local)}</p></div><div><strong>Saved answer</strong><p>{format(item.server)}</p></div></div>
      </section>)}
      <div className="draft-conflict-actions"><button type="button" className="btn primary" disabled={busy} onClick={()=>resolve("local")}>{busy?"Saving…":"Save my edited answers"}</button><button type="button" className="btn" disabled={busy} onClick={()=>resolve("server")}>Use saved answers for conflicts</button><button type="button" className="btn" disabled={busy} onClick={()=>setConflict(null)}>Keep editing</button></div>
      {error&&<p role="alert">{error}</p>}
    </div>
  </Modal>;
}
const format=value=>Array.isArray(value)?value.join(" → "):value==null||value===""?"No answer recorded":String(value);

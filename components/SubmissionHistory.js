"use client";
import {useEffect,useState} from "react";
import fetch from "@/lib/college-fetch.js";
const historyTime=value=>value && Number.isFinite(Date.parse(value))?new Date(value).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",timeZoneName:"short"}):"Timestamp not saved";

const label=value=>value.replace(/([A-Z])/g," $1").replace(/[_-]/g," ").replace(/^./,letter=>letter.toUpperCase());
function safeLink(value){try{const url=new URL(value);return ["https:","http:"].includes(url.protocol)?url.href:null;}catch{return null;}}
function Answer({value}){
  if(value===null || value===undefined)return <span>No answer saved</span>;
  if(Array.isArray(value))return <ol>{value.map((item,index)=><li key={index}><Answer value={item}/></li>)}</ol>;
  if(typeof value==="object")return <dl>{Object.entries(value).map(([key,item])=><div key={key}><dt>{label(key)}</dt><dd><Answer value={item}/></dd></div>)}</dl>;
  const link=typeof value==="string" && safeLink(value);
  return link?<a href={link} target="_blank" rel="noopener noreferrer">{value}</a>:<span style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{typeof value==="boolean"?value?"Yes":"No":String(value)}</span>;
}

export function SubmissionHistoryList({history}){
  const count=history.attempts.reduce((total,attempt)=>total+attempt.missions.reduce((sum,mission)=>sum+mission.submissions.length,0),0);
  return <div className="submission-history-list"><p>{count} saved submission{count===1?"":"s"} across {history.attempts.length} attempt{history.attempts.length===1?"":"s"}. Each revision shows the evidence saved at that time. History is read-only; result decisions apply to the current attempt.</p>
    {history.attempts.map((attempt,index)=><section key={`${attempt.attempt}:${index}`} className="receipt">
      <h4>Attempt {attempt.attempt} · {attempt.archived?"Archived attempt":"Current attempt"}</h4>
      {attempt.archived&&<p>Archived {historyTime(attempt.archivedAt)} · {attempt.reason}</p>}
      {attempt.missions.map(mission=><section key={mission.id}>
        <h5>{mission.title}</h5>{mission.brief&&<p>{mission.brief}</p>}
        {!mission.submissions.length&&<p>No submitted revisions saved for this mission.</p>}
        {mission.submissions.map((submission,i)=><details key={submission.id || i}>
          <summary>Revision {i+1} · {historyTime(submission.at)}{submission.late?" · Late":""}{submission.expired?" · Timer expired":""}</summary>
          {submission.id&&<small>Submission ID: {submission.id}</small>}
          {submission.reason&&<p>{submission.reason}</p>}
          {submission.deadline&&<p>Saved deadline: {historyTime(submission.deadline)}</p>}
          {submission.researchRevisionId&&<p>Linked research submission: {submission.researchRevisionId}</p>}
          {submission.url&&<p><Answer value={submission.url}/></p>}
          {submission.answers&&<dl>{Object.entries(submission.answers).map(([key,value])=>{const question=mission.questions?.find(question=>question.id===key);const option=question && Number.isInteger(value)?question.options?.[value]:undefined;return <div key={key}><dt>{question?.prompt || label(key)}</dt><dd><Answer value={option ?? value}/></dd></div>;})}</dl>}
          {submission.transcript&&<details><summary>Saved conversation transcript</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:320,overflow:"auto"}}>{submission.transcript}</pre></details>}
          {!submission.transcript&&submission.url&&<p>No conversation transcript was saved for this revision. Open its submitted link to inspect it.</p>}
        </details>)}
      </section>)}
    </section>)}
  </div>;
}

export default function SubmissionHistory({userId,day,revision}){
  const [open,setOpen]=useState(false),[history,setHistory]=useState(null),[error,setError]=useState(""),[reload,setReload]=useState(0);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();setHistory(null);setError("");
    (async()=>{try{
      const response=await fetch(`/api/week1/submission-history?userId=${encodeURIComponent(userId)}&day=${day}`,{cache:"no-store",signal:controller.signal});
      const value=await response.json();if(!response.ok)throw Error(value.error || "Could not load submission history.");
      if(!controller.signal.aborted)setHistory(value);
    }catch(failure){if(!controller.signal.aborted)setError(failure.message);}})();
    return ()=>controller.abort();
  },[open,userId,day,revision,reload]);
  return <details className="submission-history" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Full submission history · Level {day}</summary>
    {open&&(error?<p role="alert">{error} <button type="button" className="btn" onClick={()=>setReload(value=>value+1)}>Try again</button></p>:history?<SubmissionHistoryList history={history}/>:<p role="status">Loading all saved revisions…</p>)}
  </details>;
}

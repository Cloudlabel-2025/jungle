"use client";
import { useState } from "react";
import { Target } from "lucide-react";
import { flushPendingWork } from "./useSavedWork";

export default function ViewObjectivesLink({level=1,ownerId}) {
  const [error,setError]=useState(""), [busy,setBusy]=useState(false);
  const href=`/gamer/objectives?level=${level}`;
  return <span className="view-objectives-link"><a className="btn" href={href} aria-disabled={busy} onClick={async(e)=>{
    e.preventDefault(); if(busy)return; setBusy(true); setError("");
    try {await flushPendingWork(ownerId); window.location.assign(href);}
    catch {setError("Your work could not be saved. Try opening objectives again.");setBusy(false);}
  }}><Target size={16}/>{busy?"Saving…":"View objectives"}</a>{error&&<span role="alert">{error}</span>}</span>;
}

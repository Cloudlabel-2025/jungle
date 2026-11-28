"use client";
import { useState } from "react";
import Link from "next/link";
import { Modal } from "./ui";

export default function FlightLevelRetry({ data, act, day, now }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const first = data.dayOne?.records?.find(row => row.userId === data.user._id);
  const level = day === 1 ? first?.levelOne : data.weekOneProgram?.levelResults?.find(row => row.userId === data.user._id && row.day === day);
  const attempts = data.weekOneProgram?.attempts?.filter(row => row.userId === data.user._id && row.day === day) || [];
  const expired = day === 1 ? first?.startedAt && Date.parse(first.deadline) <= +new Date(now) : attempts.some(row => row.data.startedAt && Date.parse(row.data.deadline) <= +new Date(now));
  if (data.weekOneProgram?.locked || level?.replayPending || (!expired && !level?.result?.completed)) return null;
  return <section className="flight-retry" aria-label={`Retry Level ${day}`}>
    <div><h3>{expired && !level?.result?.completed ? "Time’s up. Try this level again." : "Try for a better result"}</h3>
      <p>A fresh attempt costs 1 energy. Your previous submissions and rewards stay saved.</p>
      </div>
    {data.user.energy < 1 ? <p>Retry needs 1 energy. <Link href="/gamer/week-one-ask-mc">Open energy recovery</Link></p> : <button type="button" className="btn primary" onClick={()=>setConfirm(true)}>Retry Level {day} · 1 energy</button>}
    {confirm && <Modal title={`Retry Level ${day}`} close={()=>{if(!busy)setConfirm(false);}} portal>
      <div className="field-form flight-retry-actions"><p>Restart both missions in Level {day}? This costs 1 energy. The timer starts when you launch a mission.</p><p>Your previous submissions and rewards stay saved.</p>
      <p>Beat your best stars for +3 trophies. Equal or lower stars: no extra trophies. Completed retries earn 25% XP. Your first star award on this level earns normal trophies.</p>
      <button type="button" className="btn primary" disabled={busy} onClick={async()=>{
      setBusy(true); setError("");
      try {
        const saved = await act("week1/program/level-retry", { day, attempt: level?.attempt || 1 }, "Retry ready. 1 energy spent; launch a mission for a fresh timer.");
        if (!saved) throw Error("Retry was not started. Refresh and try again.");
        setConfirm(false);
      } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}>{busy ? "Preparing retry…" : "Confirm retry · 1 energy"}</button><button type="button" className="btn" disabled={busy} onClick={()=>setConfirm(false)}>Keep current attempt</button>
    {error && <p role="alert">{error}</p>}</div></Modal>}
  </section>;
}

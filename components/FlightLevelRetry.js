"use client";
import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Modal } from "./ui";
import { pipImage } from "@/lib/pip-expressions.js";

export function KikoRetryMessage({ day, expired = false, confirmation = false }) {
  return <div className="retry-kiko" role={confirmation ? undefined : "status"}>
    <img src={pipImage(expired ? "concerned" : "guiding")} width="120" height="80" alt="Kiko, your flight buddy" />
    <div><strong>Kiko <span>Your flight buddy</span></strong>
      <p>{confirmation ? `Ready for another chance at Level ${day}? A retry uses 1 energy. Your fresh timer starts when you launch a mission.` : expired ? "Time’s up. This attempt has ended. Want another chance? I’ll help you get ready." : "Want to beat your best stars? Let’s give this level another go."}</p>
    </div>
  </div>;
}

export default function FlightLevelRetry({ data, act, day, now }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const first = data.dayOne?.records?.find(row => row.userId === data.user._id);
  const level = day === 1 ? first?.levelOne : data.weekOneProgram?.levelResults?.find(row => row.userId === data.user._id && row.day === day);
  // Gamer snapshots are already private and older responses omit userId.
  const attempts = data.weekOneProgram?.attempts?.filter(row => (!row.userId || row.userId === data.user._id) && row.day === day) || [];
  const expired = day === 1 ? first?.startedAt && Date.parse(first.deadline) <= +new Date(now) : attempts.some(row => row.data.startedAt && Date.parse(row.data.deadline) <= +new Date(now));
  const started = day === 1 ? Boolean(first?.startedAt) : attempts.some(row => row.data.startedAt);
  if (data.weekOneProgram?.locked || (level?.replayPending && !started) || (!expired && !level?.result?.completed)) return null;
  return <section className="flight-retry" aria-label={`Retry Level ${day}`}>
    <div><h3>{expired && !level?.result?.completed ? "Time’s up. Try this level again." : "Try for a better result"}</h3>
      <KikoRetryMessage day={day} expired={expired && !level?.result?.completed}/>
      <p>A fresh attempt costs 1 energy. Your previous submissions and rewards stay saved.</p>
      </div>
    {data.user.energy < 1 ? <p>Retry needs 1 energy. <Link href="/gamer/week-one-ask-mc">Open energy recovery</Link></p> : <button type="button" className="btn primary" onClick={()=>setConfirm(true)}><RotateCcw size={17} aria-hidden="true"/> Retry Level {day} · 1 energy</button>}
    {confirm && <Modal title={`Another chance at Level ${day}`} kicker="KIKO / RETRY" close={()=>{if(!busy)setConfirm(false);}} portal>
      <div className="field-form flight-retry-actions"><KikoRetryMessage day={day} confirmation/>
      <p>Restart both missions. Your previous submissions and rewards stay saved.</p>
      <dl className="retry-reward-summary"><div><dt>Retry cost</dt><dd>1 energy</dd></div><div><dt>New best stars</dt><dd>+3 trophies</dd></div><div><dt>Completed retry</dt><dd>25% XP</dd></div></dl>
      <p>Equal or lower stars earn no extra trophies. Your first star award on this level earns normal trophies.</p>
      <button type="button" className="btn primary" disabled={busy} onClick={async()=>{
      setBusy(true); setError("");
      try {
        const saved = await act("week1/program/level-retry", { day, attempt: level?.attempt || 1 }, "Kiko: Your fresh attempt is ready! 1 energy spent. Launch a mission when you’re ready.");
        if (!saved) throw Error("Retry was not started. Refresh and try again.");
        setConfirm(false);
      } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }}><RotateCcw size={17} aria-hidden="true"/>{busy ? "Preparing retry…" : "Retry · 1 energy"}</button><button type="button" className="btn" disabled={busy} onClick={()=>setConfirm(false)}>Not now</button>
    {error && <p role="alert">{error}</p>}</div></Modal>}
  </section>;
}

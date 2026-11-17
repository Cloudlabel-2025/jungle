"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, LockKeyhole, Target, ArrowLeft, ChevronRight, BookOpen } from "lucide-react";

export default function PlayerObjectives({levels=[],initialLevel}) {
  const [selected,setSelected]=useState(()=>levels.find(l=>l.day===Number(initialLevel))?.day || levels.find(l=>l.unlocked&&!l.completed)?.day || 1);
  const level=levels.find(l=>l.day===selected), objective=level?.objective;
  return <section className="objective-journal" aria-label="Level objectives">
    <header><div><span className="objective-eyebrow">YOUR FLIGHT JOURNAL</span><h1><Target/> Level objectives</h1><p>Know your mission. Learn something new at every stop.</p></div><Link className="btn" href="/gamer/week-one-games"><ArrowLeft size={16}/> Back to sky map</Link></header>
    <nav aria-label="Choose a level">{levels.map(l=><button key={l.day} type="button" aria-pressed={selected===l.day} onClick={()=>setSelected(l.day)} className={l.unlocked?"":"is-locked"}>{l.completed?<Check/>:l.unlocked?<Target/>:<LockKeyhole/>}<span>LEVEL {l.day}<strong>{l.title}</strong><small>{l.completed?"Completed":l.unlocked?"Objective unlocked":`Complete Level ${l.day-1}`}</small></span></button>)}</nav>
    {!objective?<div className="objective-locked"><LockKeyhole size={42}/><h2>Keep exploring</h2><p>Complete Level {Math.max(1,selected-1)} to unlock this objective.</p></div>:<article className="objective-detail" key={selected}>
      <div className="objective-goal"><span className="objective-eyebrow">LEVEL {selected} / YOUR OBJECTIVE</span><h2>{objective.goal}</h2><p><BookOpen size={18}/><span>{objective.learn}</span></p></div>
      <div className="objective-missions">{objective.missions.map((mission,i)=><section key={mission.title}><span className="objective-eyebrow">MISSION {i+1}</span><h3>{mission.title}</h3><ol>{mission.steps.map(step=><li key={step}>{step}</li>)}</ol></section>)}</div>
      <footer><Check size={20}/><p>{objective.finish}</p><Link href="/gamer/week-one-games">Return to play <ChevronRight size={16}/></Link></footer>
    </article>}
  </section>;
}

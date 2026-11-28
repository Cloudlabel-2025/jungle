"use client";
import { Eye, Save, Settings2 } from "lucide-react";
import WorkspaceSelect from "./WorkspaceSelect";
import { missionStarters } from "@/lib/mission-starters.js";

export default function MissionBriefForm({form,teams,starter,onStarter,update,onFeature,onDetailed,save,inspect,busy,dirty,levelId}) {
  return <form className="field-form mission-brief-form" onSubmit={save} aria-busy={busy} onInvalidCapture={event=>{const section=event.target.closest("details");if(section)section.open=true;}}>
    <div className="mission-brief-intro"><strong>Start with a brief</strong><p>A starter prepares five features and their 25 layer tasks. Review the work before publishing; nothing is assigned when you save a draft.</p></div>
    <WorkspaceSelect label="Start from a template" value={starter} options={missionStarters} onChange={onStarter} disabled={busy}/>
    <small>Changing the template replaces its prepared features and tasks.</small>
    <label>Mission name<input required minLength={3} maxLength={120} value={form.name} onChange={event=>update("name",event.target.value)} disabled={busy}/></label>
    <label>What should the team build?<textarea required minLength={10} maxLength={4000} rows={3} value={form.description} onChange={event=>update("description",event.target.value)} disabled={busy}/></label>
    <details className="mission-brief-options"><summary>Schedule &amp; teams <span>{form.hours} working hours · {form.teamIds.length} teams</span></summary><div className="mission-brief-options-body"><label>Time budget · working hours<input type="number" required min="0.25" max="160" step="0.25" value={form.hours} onChange={event=>update("hours",event.target.value)} disabled={busy}/></label><small>The deadline begins when a team opens this mission.</small><fieldset><legend>Assign to teams</legend><div className="level-team-options">{teams.map(team=><label key={team._id}><input type="checkbox" checked={form.teamIds.includes(team._id)} disabled={busy} onChange={event=>update("teamIds",event.target.checked?[...form.teamIds,team._id]:form.teamIds.filter(id=>id!==team._id))}/>{team.name}</label>)}</div>{!form.teamIds.length&&<p role="alert">Select at least one team before saving.</p>}</fieldset></div></details>
    <details className="mission-brief-options"><summary>Review team work <span>5 features · 25 prepared tasks</span></summary><div className="mission-brief-options-body"><p>Each feature includes frontend, backend, database, testing and deployment. Editing a feature updates its five starter tasks and acceptance criteria.</p>{form.features.map((feature,index)=><div className="mission-brief-feature" key={feature.characterKey}><label>Feature {index+1}<input required minLength={3} maxLength={80} value={feature.name} disabled={busy} onChange={event=>onFeature(index,"name",event.target.value)}/></label><label>What counts as complete?<textarea required minLength={10} maxLength={1000} rows={2} value={feature.objective} disabled={busy} onChange={event=>onFeature(index,"objective",event.target.value)}/></label></div>)}</div></details>
    <div className="mission-brief-advanced"><span>Artwork is selected automatically. Need custom task instructions?</span><button type="button" className="btn small" onClick={onDetailed} disabled={busy}><Settings2 size={15}/>Open detailed editor</button></div>
    <div className="button-row"><button className="btn primary" disabled={busy||!form.teamIds.length}><Save size={16}/>{busy?"Working…":"Save draft"}</button><button type="button" className="btn" disabled={busy||dirty||!levelId} onClick={inspect}><Eye size={16}/>Preview assignments</button></div>
    {dirty&&<small>Save the draft to review assignments. Publishing remains a separate step.</small>}
  </form>;
}

import test from "node:test";
import assert from "node:assert/strict";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {flightGameState,attemptComplete,experimentFeedback,firstUnanswered} from "../lib/final-flight-games.js";
import {pack,start,later} from "./week-one-levels.test.mjs";
const noAction=()=>assert.fail("Rendering must not mutate progress");
async function load(file,name="default") {
  const b=await build({entryPoints:[file],bundle:true,packages:"external",platform:"node",format:"cjs",write:false,alias:{"@":resolve(".")},loader:{".js":"jsx"},jsx:"automatic"});
  const m={exports:{}};new Function("require","module","exports",b.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);return m.exports[name];
}
const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
function fixture(day,index=0,draft={},gameState) {
  const activity=pack(day).activities[index];
  return {_id:`p:${activity.id}`,activityId:activity.id,day,version:3,data:{activity,variant:activity.variants?.[0]||null,startedAt:start.toISOString(),deadline:later(activity.durationMinutes).toISOString(),draft,gameState,extensions:[],submissions:[]}};
}
function player(day,attempts=[]) {return {user:{_id:"p"},weekOneProgram:{days:[{...pack(day),state:"OPEN"}],attempts,levelResults:[],progression:{mode:"COMPLETION",levels:[{day,available:true}]}}};}

test("board metadata is bounded and cannot award completion or rewards",()=>{
  assert.deepEqual(flightGameState("D4-G02",{actor:"other",policy:"owner",runs:1,stars:3,xp:999,completed:true}),{runs:1,actor:"other",policy:"owner"});
  assert.throws(()=>flightGameState("D1-R01",{}));
  for(const state of [{cursor:-1},{runs:1000},{policy:"admin"},{mode:"win"},{actor:[]},null])assert.throws(()=>flightGameState("D4-G01",state));
  assert.equal(experimentFeedback(true,{actor:"other",policy:"signin"}).safe,false);
  assert.equal(experimentFeedback(true,{actor:"other",policy:"owner"}).safe,true);
  assert.match(experimentFeedback(true,{actor:"self",policy:"owner"}).text,/another identity/);
  assert.equal(experimentFeedback(false,{plan:"success"}).safe,false);
  assert.equal(experimentFeedback(false,{plan:"fair"}).safe,true);
});
test("quiz completion requires saved submission and every valid answer; saved cursor fallback finds unanswered questions",()=>{
  const r=fixture(5,1),q=r.data.activity.questions;
  r.data.submittedAt=later(10).toISOString();r.data.submissions=[{answers:{[q[0].id]:0},expired:true}];
  assert.equal(attemptComplete(r),false);
  const answers=Object.fromEntries(q.map(a=>[a.id,0]));r.data.submissions[0].answers=answers;
  assert.equal(attemptComplete(r),true);delete answers[q[3].id];
  assert.equal(firstUnanswered(r.data.activity,answers),3);assert.equal(attemptComplete(r),false);
});
test("Level 4 dossier board and Level 5 cockpit have distinct gameplay and protected locks",async()=>{
  const C=await load("components/FlightFinale.js");
  const four=render(C,{data:player(4),dayNumber:4,act:noAction,now:later(5)});
  const five=render(C,{data:player(5),dayNumber:5,act:noAction,now:later(5)});
  assert.match(four,/Investigation Deck/);assert.match(four,/Break the seal/);assert.match(four,/deck-dossier/);
  assert.doesNotMatch(four,/trial-flightplan|l2-comic|signal-lab-bays|<textarea|<select/);
  assert.match(five,/Captain’s Run/);assert.match(five,/trial-flightplan/);assert.match(five,/Then vs. now/);assert.match(five,/Clear the checkpoints/);
  assert.doesNotMatch(five,/deck-dossier|l2-comic|signal-lab-bays|<textarea|<select/);
  const locked=player(4);locked.weekOneProgram.progression.levels[0].available=false;
  const html=render(C,{data:locked,dayNumber:4,act:noAction,now:later(5)});
  assert.match(html,/Complete Level 3/);assert.doesNotMatch(html,/Break the seal/);
});
test("saved dossiers restore the board, report and pinned custom scenario with original timers",async()=>{
  const C=await load("components/FlightFinale.js"),r=fixture(4,1,{}, {actor:"other",policy:"owner",runs:1,mode:"board"});
  r.data.variant.brief="A custom case supplied by CC. Never replace this saved briefing.";
  const html=render(C,{data:player(4,[r]),dayNumber:4,act:noAction,now:later(5)});
  assert.match(html,/Request blocked/);assert.match(html,/Another crew record/);assert.match(html,/custom case supplied by CC/);
  r.data.gameState={mode:"report",cursor:2};r.data.draft={reason:"My saved reasoning about a custom permission failure."};
  const restored=render(C,{data:player(4,[r]),dayNumber:4,act:noAction,now:later(5)});
  assert.match(restored,/My saved reasoning/);assert.match(restored,/55:00/);
  const expired=render(C,{data:player(4,[r]),dayNumber:4,act:noAction,now:later(1000)});
  assert.match(expired,/readOnly|readonly/);assert.match(expired,/Transmit saved evidence/);
});
test("Level 5 restores the saved quiz answer and current checkpoint without exposing the whole quiz as a form",async()=>{
  const C=await load("components/FlightFinale.js"),r=fixture(5,1,{}, {cursor:3});
  const q=r.data.activity.questions[3];r.data.draft[q.id]=2;
  const html=render(C,{data:player(5,[r]),dayNumber:5,act:noAction,now:later(5)});
  assert.ok(html.includes(q.question));assert.match(html,/Knowledge checkpoint/);assert.match(html,/aria-pressed="true"/);
  assert.doesNotMatch(html,/<select|<textarea|type="radio"/);
  assert.match(html,/25:00/);
  assert.equal(r.data.deadline,later(30).toISOString());
});

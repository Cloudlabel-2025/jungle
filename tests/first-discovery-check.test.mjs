import test from "node:test";
import assert from "node:assert/strict";
import {claimCheckAnswers,completedClaimCheck} from "../lib/first-discovery-check.js";
import {scoreLevelOne} from "../lib/level-one-rules.js";
import {conversation} from "./level-one-rules.test.mjs";
import {build} from "esbuild";
import {createRequire} from "node:module";
import {resolve} from "node:path";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
export const check={claim:"The AI claims electric vehicles always cost less to run than petrol vehicles.",source:"https://example.org/transport-study",verdict:"UNCERTAIN",finding:"I compared the running costs in the source with the AI claim. The estimates depend on electricity prices, driving distance and maintenance, so I would not trust the word always."};
test("the claim check accepts justified uncertainty and rejects AI links, invented verdicts and empty explanations",()=>{
  assert.deepEqual(claimCheckAnswers(check,true),check);
  for(const extra of [{source:"https://chatgpt.com/share/again"},{source:"javascript:alert(1)"},{source:"https://reader:secret@example.org"},{verdict:"TRUE"},{finding:"It is correct"},{claim:"Cars"}])assert.throws(()=>claimCheckAnswers({...check,...extra},true));
});
test("new Level 1 needs both concepts, binds the check to the research revision and preserves old results",()=>{
  const data={levelOne:{claimCheckRequired:true},config:{genres:[{id:"g",question:"Investigate research about Automobiles and show sources and reasoning."}]},genreId:"g",acknowledgedAt:"2026-11-02T03:30:00Z",startedAt:"2026-11-02T03:30:00Z",deadline:"2026-11-02T05:00:00Z"};
  const submission={id:"research-1",transcript:conversation(),at:"2026-11-02T03:40:00Z"};
  const first=scoreLevelOne(data,submission);assert.equal(first.completed,false);assert.equal(first.stars,0);assert.equal(first.checks.readable,true);assert.equal(first.checks.claimCheck,false);
  data.claimCheck={...check,researchRevisionId:submission.id,at:"2026-11-02T03:50:00Z"};
  assert.equal(scoreLevelOne(data,submission).stars,3);
  assert.equal(completedClaimCheck(data,{...submission,id:"changed-chat"}),false);
  data.claimCheck.at="2026-11-02T05:01:00Z";assert.equal(scoreLevelOne(data,submission).stars,2);
  assert.equal(scoreLevelOne({...data,levelOne:{}},submission).stars,3,"legacy completion is not gated retrospectively");
});
test("the first-level hub exposes two concepts with a locked second mission, and saved checks restore their verdict",async()=>{
  const bundle=await build({entryPoints:["components/LevelOneJourney.js"],bundle:true,packages:"external",platform:"node",format:"cjs",write:false,alias:{"@":resolve(".")},loader:{".js":"jsx"},jsx:"automatic"});
  const m={exports:{}};new Function("require","module","exports",bundle.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);
  const record={_id:"first",userId:"p",submissions:[],levelOne:{claimCheckRequired:true,automatic:null,result:null},deadline:"2026-11-02T05:00:00Z"};
  const render=(C,p)=>renderToStaticMarkup(React.createElement(C,p));
  const hub=render(m.exports.default,{record,children:()=>React.createElement("p",null,"research"),now:new Date("2026-11-02T04:00Z"),open:true});
  assert.match(hub,/MISSION 01 \/ EXPLORE/);assert.match(hub,/MISSION 02 \/ VERIFY/);assert.match(hub,/Complete Mission 1 first/);assert.match(hub,/disabled/);
  record.levelOne.automatic={checks:{checkpoints:true,readable:true,related:true}};record.submissions=[{id:"r",url:"https://chatgpt.com/share/research"}];record.claimCheckDraft={answers:check,revision:3,researchRevisionId:"r"};
  const form=render(m.exports.ClaimCheck,{record,now:new Date("2026-11-02T04:00Z"),open:true});
  assert.ok(form.includes(check.claim));assert.match(form,/aria-pressed="true"/);assert.match(form,/Still uncertain/);assert.match(form,/Saved check restored/);
});

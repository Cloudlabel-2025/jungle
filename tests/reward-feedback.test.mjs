import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { trackExperience } from "../lib/experience-celebration.js";
import { trackTrophyLeague, advanceTrophyLeague } from "../lib/trophy-leagues.js";

async function load(path, name) {
  const bundle = await build({entryPoints:[path],bundle:true,packages:"external",platform:"node",format:"cjs",write:false,alias:{"@":resolve(".")},loader:{".js":"jsx"},jsx:"automatic"});
  const module={exports:{}};
  new Function("require","module","exports",bundle.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  return module.exports[name];
}

test("an XP increase on the first refresh is queued from the sign-in baseline and survives reload until shown",()=>{
  const signedIn=trackExperience(null,75);
  assert.equal(signedIn.pending,null);
  const loaded=trackExperience(signedIn,125);
  assert.equal(loaded.pending.to,2);
  const restored=trackExperience(JSON.parse(JSON.stringify(loaded)),125);
  assert.equal(restored.pending.to,2,"blocked or remounted feedback must not be consumed");
  assert.equal(trackExperience(restored,140).pending.to,2,"small subsequent XP gains preserve queued feedback");
  assert.equal(trackExperience({...restored,pending:null},125).pending,null,"finished animations must not replay");
  assert.equal(trackExperience(restored,75).pending,null,"a revoked gain cannot leave a stale celebration");
  assert.equal(trackExperience(restored,650).pending.to,4);
});

test("trophy promotion and demotion survive a blocked display, and acknowledgement prevents replay",()=>{
  const baseline=trackTrophyLeague(null,299);
  const promoted=trackTrophyLeague(baseline,300);
  assert.equal(promoted.pending.direction,"promotion");
  assert.equal(trackTrophyLeague(JSON.parse(JSON.stringify(promoted)),300).pending.direction,"promotion");
  assert.equal(trackTrophyLeague({...promoted,pending:null},300).pending,null);
  const demoted=trackTrophyLeague(promoted,299);
  assert.equal(demoted.pending.direction,"demotion");
  assert.equal(demoted.pending.to,"Unranked");
  assert.equal(trackTrophyLeague(demoted,299).pending.direction,"demotion");
  assert.equal(trackTrophyLeague(demoted,450).pending.direction,"promotion");
});

test("trophy directions render centred automatic animations without controls or a dialog",async()=>{
  const Transition=await load("components/TrophyLeague.js","LeagueTransition");
  for(const [before,after,direction] of [[299,300,"promotion"],[300,299,"demotion"]]){
    const change=advanceTrophyLeague({total:before},after).transition;
    const html=renderToStaticMarkup(React.createElement(Transition,{change,close(){},open(){}}));
    assert.match(html,new RegExp(`is-${direction}`));
    assert.match(html,/role="status"/);
    assert.match(html,/league-celebration-art/);
    assert.match(html,/reward-celebration-backdrop/);
    assert.match(html,/--reward-duration:1500ms/);
    assert.doesNotMatch(html,/<button|<a |role="dialog"|aria-modal|Continue playing|View league trail|Close dialog/);
    assert.doesNotMatch(html,/class="league-change /,"league updates must not render as corner toasts");
    assert.ok(html.includes(change.to));
  }
});

test("Kiko explains an expired attempt and asks before the paid retry",async()=>{
  const Message=await load("components/FlightLevelRetry.js","KikoRetryMessage");
  const timedOut=renderToStaticMarkup(React.createElement(Message,{day:3,expired:true}));
  assert.match(timedOut,/role="status"/);
  assert.match(timedOut,/pip-concerned.webp/);
  assert.match(timedOut,/Want another chance/);
  const confirmation=renderToStaticMarkup(React.createElement(Message,{day:3,confirmation:true}));
  assert.match(confirmation,/Level 3/);
  assert.match(confirmation,/1 energy/);
  assert.match(confirmation,/timer starts when you launch/);
});

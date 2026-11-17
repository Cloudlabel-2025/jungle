import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { objectiveJourney } from "../lib/level-objectives.js";

test("objectives unlock in order, keep completed guides and withhold future instructions",()=>{
  const initial=objectiveJourney();
  assert.deepEqual(initial.map(l=>l.unlocked),[true,false,false,false,false]);
  assert.equal(initial[1].objective,undefined);
  const gaps=objectiveJourney([{day:1,completed:true},{day:3,completed:true}]);
  assert.deepEqual(gaps.map(l=>l.unlocked),[true,true,false,false,false]);
  const all=objectiveJourney([1,2,3,4,5].map(day=>({day,completed:true})));
  assert.ok(all.every(l=>l.unlocked&&l.objective));
  assert.match(all[2].objective.missions[1].steps[0],/Browser → API → Server/);
});

test("separate objective page shows the chosen guide, locked URL selection never reveals its mission",async()=>{
  const b=await build({entryPoints:["components/PlayerObjectives.js"],bundle:true,packages:"external",platform:"node",format:"cjs",write:false,alias:{"@":resolve(".")},loader:{".js":"jsx"},jsx:"automatic"});
  const m={exports:{}};
  new Function("require","module","exports",b.outputFiles[0].text)(createRequire(import.meta.url),m,m.exports);
  const C=m.exports.default, levels=objectiveJourney([{day:1,completed:true},{day:2,completed:true}]);
  const render=level=>renderToStaticMarkup(React.createElement(C,{levels,initialLevel:level}));
  const lab=render(3);
  assert.match(lab,/Mission 1 · Explain a clue/);
  assert.match(lab,/Mission 2 · Follow a click/);
  assert.match(lab,/href="\/gamer\/week-one-games"/);
  const locked=render(4);
  assert.match(locked,/Complete Level 3/);
  assert.doesNotMatch(locked,/The Impossible Claim|Propose two distinct diagnostic/);
  assert.equal((lab.match(/aria-pressed="true"/g)||[]).length,1);
});

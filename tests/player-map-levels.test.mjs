import test from "node:test";
import assert from "node:assert/strict";
import { playerMapLevels } from "../lib/player-map-levels.js";
import { alumniLevels } from "../lib/alumni-map.js";
import { defaultMapPoint, missionMapPoint } from "../lib/mission-map.js";

test("map designer and team progression share core IDs, titles and published mission order", () => {
  const data = { projectLevels: [
    {_id:"practice-1",number:1,name:"Old practice project"},
    {_id:"mission-b",number:102,name:"Second map mission",mapMission:true},
    {_id:"mission-a",number:101,name:"First map mission",mapMission:true},
  ] };
  const map = playerMapLevels(data, {includeDrafts:true});
  const progression = playerMapLevels(data, {teamId:"team-a"});
  assert.deepEqual(map.map(l=>[l._id,l.name]),progression.map(l=>[l._id,l.name]));
  assert.deepEqual(map.slice(0,5).map(l=>l._id),alumniLevels.map(l=>l._id));
  assert.deepEqual(map.slice(5).map(l=>l._id),["mission-a","mission-b"]);
  assert.ok(map.every(l=>l._id!=="practice-1"));
  const positions = {"alumni-sprint-2":{x:920,y:18},"mission-a":{x:3400,y:67}};
  assert.deepEqual(missionMapPoint(map[1],positions,1,500),{x:920,y:245.2,labelPlacement:"below"});
  assert.equal((positions[map[5]._id] || defaultMapPoint(5)).x,3400);
});

test("team assignments and private drafts do not leak into the player level catalogue", () => {
  const mission = {_id:"map-a",number:101,name:"Published version",mapMission:true,teamIds:["team-a"]};
  const data = {projectLevels:[mission],levelDrafts:[
    {_id:"map-a",published:mission,draft:{...mission,name:"Unpublished edit"}},
    {_id:"map-private",draft:{number:102,name:"Private map mission",mapMission:true}},
    {_id:"practice-private",draft:{number:103,name:"Private practice project"}},
  ],alumniMap:[{...alumniLevels[0],state:"CLEARED",statusLabel:"Key 1 earned",sprintId:"saved-sprint"}]};
  const player = playerMapLevels(data,{teamId:"team-a"});
  assert.equal(player[0].state,"CLEARED");
  assert.equal(player[0].sprintId,"saved-sprint");
  assert.equal(player[5].name,"Published version");
  assert.equal(playerMapLevels(data,{teamId:"team-b"}).length,5);
  assert.equal(player.length,6);
  const editor = playerMapLevels(data,{includeDrafts:true});
  assert.equal(editor.length,7);
  assert.equal(editor[6].privateDraft,true);
  assert.ok(!editor.some(l=>l._id==="practice-private"));
});

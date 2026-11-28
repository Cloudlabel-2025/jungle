import test from "node:test";
import assert from "node:assert/strict";
import {missionStarter,missionStarters} from "../lib/mission-starters.js";
import {validateLevel} from "../lib/level-definitions.js";

test("map mission starters produce valid independent drafts with complete feature tasks",()=>{
  for(const choice of missionStarters){
    const draft=missionStarter([{_id:"team-a"},{_id:"team-b"}],choice.value);
    const valid=validateLevel(draft);
    assert.equal(valid.mapMission,true);
    assert.equal(draft._id,undefined);
    assert.equal(draft.number,undefined);
    assert.deepEqual(valid.teamIds,["team-a","team-b"]);
    assert.equal(valid.features.length,5);
    assert.equal(valid.tasks.length,25);
    for(const feature of valid.features)assert.equal(valid.tasks.filter(task=>task.targetCharacter===feature.characterKey).length,5);
    draft.features[0].name="Edited feature";
    assert.notEqual(missionStarter([{_id:"team-a"}],choice.value).features[0].name,"Edited feature");
  }
  assert.throws(()=>missionStarter([],"unknown"),/available mission starter/);
});

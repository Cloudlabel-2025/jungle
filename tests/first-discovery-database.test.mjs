import test from "node:test";
import {flightProgress} from "../lib/flight-progression.js";
import {starterFlightContent} from "../lib/flight-starter-content.js";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {connect,models} from "../lib/db.js";
import {fixtureConfig} from "./day-one-fixture.mjs";
import {dayOneAction,dayOneSnapshot} from "../lib/day-one.js";
import {newLevelOne} from "../lib/level-one-rules.js";
import {check} from "./first-discovery-check.test.mjs";
import {conversation} from "./level-one-rules.test.mjs";

test("two-mission Level 1: own-account draft, stage gates, stale writes, atomic rewards, retries and revision invalidation",{skip:!process.env.TEST_MONGODB_URI},async()=>{
  process.env.MONGODB_URI=new URL(`discovery_${Date.now()}`,process.env.TEST_MONGODB_URI).toString();
  await connect();for(const m of Object.values(models))await m.init();
  const config={...fixtureConfig(),version:1},start=new Date(config.officialStart),at=m=>new Date(+start+m*60000),p={_id:"first-p",name:"Player",role:"GAMER",cohortId:"alpha",email:"p@discovery.invalid",xp:0,trophies:0},q={...p,_id:"first-q",email:"q@discovery.invalid"};
  try{
    await models.User.insertMany([p,q]);
    await models.Cohort.create({_id:"alpha",name:"First discovery",college:"QA",startDate:config.day,currentWeek:1});
    await models.DayOneSetup.create({_id:"alpha",revision:0,released:config,draft:config});
    await models.WeekOneRelease.create({_id:"alpha",revision:0,days:[1,2,3,4,5].map(day=>({day,state:day===1?"OPEN":"DRAFT",...(day===1?{content:config,officialStart:config.officialStart,scheduledEnd:config.closingCutoff,openedAt:config.availableAt}:{})}))});
    for(const user of [p,q])await models.DayOneRecord.create({_id:`alpha:${user._id}`,cohortId:"alpha",userId:user._id,version:0,data:{config,availableAt:config.availableAt,genreId:config.genres[0].id,acknowledgedAt:start.toISOString(),startedAt:start.toISOString(),deadline:at(90).toISOString(),submissions:[],ledger:[],levelOne:{...newLevelOne(),claimCheckRequired:true}}});
    const read=()=>models.DayOneRecord.findById(`alpha:${p._id}`).lean();
    const reader=async url=>({ok:true,transcript:conversation(),evidence:{provider:"ChatGPT",canonicalUrl:url,userTurns:3,assistantTurns:3,sha256:"check-test",fetchedAt:at(10).toISOString()}});
    const command={ownerId:p._id,researchRevisionId:"missing",draftVersion:0,answers:check};
    await assert.rejects(dayOneAction(p,"claim-check-submit",command,at(9)),e=>e.status===409);
    await dayOneAction(p,"submit",{url:"https://chatgpt.com/share/research-one"},at(10),{sharedChatReader:reader});
    let record=await read();const progress=d=>flightProgress([{day:1,state:"OPEN",content:config},{day:2,state:"PREPARED",content:starterFlightContent(2,config)}],d);assert.equal(progress(record.data)[1].available,false);assert.equal(record.data.levelOne.automatic.completed,false);assert.equal((await models.User.findById(p._id).lean()).xp,0);
    command.researchRevisionId=record.data.submissions.at(-1).id;
    await assert.rejects(dayOneAction(q,"claim-check-draft",command,at(11)),e=>e.status===403);
    await dayOneAction(p,"claim-check-draft",command,at(11));
    const view=(await dayOneSnapshot(p,at(12))).records.find(r=>r.userId===p._id);assert.deepEqual(view.claimCheckDraft.answers,check);assert.equal(view.levelOne.claimCheckRequired,true);
    await assert.rejects(dayOneAction(p,"claim-check-draft",{...command,answers:{...check,finding:"another draft"}},at(12)),e=>e.status===409);
    command.draftVersion=1;
    await assert.rejects(dayOneAction(p,"claim-check-submit",{...command,answers:{...check,source:"https://chatgpt.com/share/another-chat"}},at(13)));
    await Promise.all([dayOneAction(p,"claim-check-submit",command,at(14)),dayOneAction(p,"claim-check-submit",command,at(14))]);
    record=await read();assert.equal(progress(record.data)[1].available,true);assert.equal(record.data.levelOne.automatic.completed,true);assert.equal(record.data.levelOne.automatic.stars,3);assert.equal((await models.User.findById(p._id).lean()).xp,150);assert.equal(await models.LevelOneReward.countDocuments({userId:p._id}),1);
    await dayOneAction(p,"claim-check-submit",command,at(100));assert.equal((await read()).data.levelOne.automatic.stars,3,"retry retains the original completion time");
    await dayOneAction(p,"submit",{url:"https://chatgpt.com/share/research-two",reason:"A new conversation contains revised evidence."},at(16),{sharedChatReader:reader});
    assert.equal((await read()).data.levelOne.automatic.completed,false,"new research requires its own claim check");
    const revised=await read();
    const lateCommand={...command,researchRevisionId:revised.data.submissions.at(-1).id,draftVersion:1};
    await dayOneAction(p,"claim-check-draft",lateCommand,at(101));
    await dayOneAction(p,"claim-check-submit",{...lateCommand,draftVersion:2},at(102));
    assert.equal((await read()).data.levelOne.automatic.stars,2,"late claim checks can still complete the level");
    assert.equal((await models.User.findById(q._id).lean()).xp,0);
  }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

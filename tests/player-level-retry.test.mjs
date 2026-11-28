import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connect, models, transaction } from "../lib/db.js";
import { programAction } from "../lib/week-one-program.js";
import { fixtureConfig } from "./day-one-fixture.mjs";
import { starterFlightContent } from "../lib/flight-starter-content.js";
import { blankProgram, validateDayContent } from "../lib/week-one-program-rules.js";
import { newLevelOne } from "../lib/level-one-rules.js";
import { newFlightLevel } from "../lib/week-one-level-rules.js";
import { reconcileLevelOne } from "../lib/level-one.js";
import { reconcileFlightReward, flightLevelId } from "../lib/week-one-levels.js";
import { beginRetryRewards, retryRewardTotals } from "../lib/retry-rewards.js";
import { recoverMissionEnergy, missionRecoverySnapshot } from "../lib/mission-energy.js";

test("retry rewards preserve trophies, grant a small best-star bonus and reduced XP exactly once",()=>{
  const level={history:[],creditedTrophies:25,creditedXp:125};
  beginRetryRewards(level,{completed:true,stars:2},125);
  assert.deepEqual(retryRewardTotals(level,{completed:true,stars:1},{trophies:15,xp:75}),{trophies:25,xp:143});
  assert.deepEqual(retryRewardTotals(level,{completed:true,stars:3},{trophies:30,xp:150}),{trophies:28,xp:162});
  assert.deepEqual(retryRewardTotals(level,{completed:true,stars:3},{trophies:30,xp:150}),{trophies:28,xp:162});
  level.creditedTrophies=28; level.creditedXp=162;
  beginRetryRewards(level,{completed:true,stars:3},162);
  assert.deepEqual(retryRewardTotals(level,{completed:true,stars:3},{trophies:30,xp:150}),{trophies:28,xp:199},"equal stars on another paid retry grant XP but no trophies");
  const failed={history:[],creditedTrophies:0}; beginRetryRewards(failed,null,0);
  assert.deepEqual(retryRewardTotals(failed,{completed:false,stars:0},{trophies:0,xp:0}),{trophies:0,xp:0});
  assert.deepEqual(retryRewardTotals(failed,{completed:true,stars:2},{trophies:25,xp:125}),{trophies:25,xp:31},"first earned stars retain the normal trophy award");
});

test("all five levels retry expired work transactionally, preserve evidence and reconcile limited rewards",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname="level_retry_"+Date.now();process.env.MONGODB_URI=uri.toString();await connect();
  try {
    for(const model of Object.values(models))await model.init();
    const config=fixtureConfig(),now=new Date(config.officialStart),old=new Date(now.getTime()-3600000).toISOString();
    const player={_id:"p",name:"Player",email:"p@retry.invalid",role:"GAMER",cohortId:"alpha",energy:3,hp:5,drops:2,streak:2,trophies:1000,xp:10000};
    await models.User.create(player);
    await models.Cohort.create({_id:"alpha",name:"Retry test",college:"Test",startDate:config.day});
    await models.DayOneSetup.create({_id:"alpha",released:config,draft:config});
    const days=[1,2,3,4,5].map(day=>({day,state:"PREPARED",content:day===1?config:validateDayContent(day,starterFlightContent(day,config),config)}));
    await models.WeekOneRelease.create({_id:"alpha",days});
    await models.WeekOneProgram.create({_id:"alpha",data:{...blankProgram(),progressionMode:"COMPLETION"}});
    const result={completed:true,stars:1,source:"SYSTEM",reason:"Saved first attempt"};
    await models.DayOneRecord.create({_id:"alpha:p",cohortId:"alpha",userId:"p",version:1,data:{config,genreId:config.genres[0].id,availableAt:old,acknowledgedAt:old,startedAt:old,deadline:old,submissions:[{id:"saved",url:"https://example.org/saved",transcript:"Original evidence",at:old}],ledger:[],levelOne:{...newLevelOne(),automatic:null,creditedTrophies:0,creditedXp:0}}});
    for(const day of [2,3,4,5]){
      if(day!==2)await models.WeekOneLevel.create({_id:flightLevelId("alpha","p",day),cohortId:"alpha",userId:"p",day,version:1,data:{...newFlightLevel(),automatic:result,creditedTrophies:15,creditedXp:75*day}});
      await models.WeekOneAttempt.create({_id:"attempt-"+day,cohortId:"alpha",userId:"p",day,activityId:days[day-1].content.activities[0].id,version:3,data:{activity:days[day-1].content.activities[0],startedAt:old,deadline:old,draft:{notes:"Saved unfinished draft"},submissions:[]}});
    }
    const getLevel=async day=>day===1?models.DayOneRecord.findById("alpha:p"):models.WeekOneLevel.findById(flightLevelId("alpha","p",day));
    for(const day of [1,2,3,4,5]){
      await models.User.updateOne({_id:"p"},{$set:{energy:day===5?1:3}});
      const response=await Promise.all([programAction(player,"level-retry",{day,attempt:1},now),programAction(player,"level-retry",{day,attempt:1},now)]);
      assert.ok(response.some(value=>value.alreadyRetried));
      const user=await models.User.findById("p").lean();
      assert.equal(user.energy,day===5?0:2);assert.equal(user.hp,5);assert.equal(user.drops,2);assert.equal(user.streak,2);
      const row=await getLevel(day),level=day===1?row.data.levelOne:row.data;
      assert.equal(level.attempt,2);assert.equal(level.history.length,1);assert.equal(level.replayPending,true);
      if(day===1){assert.equal(row.data.startedAt,undefined);assert.equal(level.history[0].submissions[0].transcript,"Original evidence");}
      else{assert.equal(await models.WeekOneAttempt.countDocuments({userId:"p",day}),0);assert.equal(level.history[0].attempts[0].data.draft.notes,"Saved unfinished draft");}
      await assert.rejects(programAction(player,"level-retry",{day,attempt:2},now),/attempt changed/);
      if(day===2){
        const activity=days[1].content.activities[0];
        await programAction(player,"attempt-start",{day:2,activityId:activity.id,variantId:activity.variants[0].id},now);
        const fresh=await models.WeekOneAttempt.findById("alpha:p:"+activity.id).lean();
        assert.equal(fresh.version,4,"a new attempt cannot reuse stale autosave versions");
        assert.equal(fresh.data.startedAt,now.toISOString());
        assert.ok(Date.parse(fresh.data.deadline)>+now,"a timed-out level gets a real fresh timer");
        assert.equal((await getLevel(2)).data.replayPending,false,"starting the new mission consumes the pending retry");
        await models.WeekOneLevel.updateOne({_id:flightLevelId("alpha","p",2)},{$set:{"data.replayPending":true}});
        await assert.rejects(programAction(player,"level-retry",{day:2,attempt:2},now),/wait until/);
      }
      await transaction(async session=>{
        const saved=day===1?await models.DayOneRecord.findById("alpha:p").session(session):await models.WeekOneLevel.findById(flightLevelId("alpha","p",day)).session(session);
        const value=day===1?saved.data.levelOne:saved.data;
        value.automatic={...result,stars:2}; value.replayPending=false;
        if(day===1){await reconcileLevelOne(saved,player,session,now);await reconcileLevelOne(saved,player,session,now);}
        else{const ctx={user:player,session,now,at:now.toISOString()};await reconcileFlightReward(ctx,saved);await reconcileFlightReward(ctx,saved);}
        saved.markModified("data");await saved.save({session});
      });
      const saved=await getLevel(day),settled=day===1?saved.data.levelOne:saved.data;
      assert.equal(settled.creditedTrophies,day<=2?25:18);
      assert.equal(settled.creditedXp,(day<=2?0:75*day)+Math.floor(125*day/4));
    }
    assert.equal(await models.Energy.countDocuments({eventKey:/^retry:/}),5);
    const recovery=(await missionRecoverySnapshot(player)).cases[0];assert.equal(recovery.selfService,true);
    await recoverMissionEnergy(player,{rescueId:recovery.id,answers:[1,0,2]},now);
    assert.equal((await models.User.findById("p").lean()).energy,3);
    await models.User.updateOne({_id:"p"},{$set:{energy:0}});
    await assert.rejects(programAction(player,"level-retry",{day:5,attempt:2},now),/needs 1 energy/);
    await models.User.updateOne({_id:"p"},{$set:{energy:3}});
    await models.WeekOneProgram.updateOne({_id:"alpha"},{$set:{"data.locked":true}});
    await assert.rejects(programAction(player,"level-retry",{day:5,attempt:2},now),/locked/);
    await models.User.updateOne({_id:"p"},{$set:{active:false}});
    await assert.rejects(programAction(player,"level-retry",{day:1,attempt:2},now),/active player/);
  } finally { await mongoose.connection.dropDatabase();await mongoose.disconnect(); }
});

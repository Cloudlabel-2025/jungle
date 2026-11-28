import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {performance} from "node:perf_hooks";
import {connect,models} from "../lib/db.js";
import {snapshot} from "../lib/snapshot.js";
import {blankProgram} from "../lib/week-one-program-rules.js";
import {enableCompletionProgression} from "../lib/flight-progression-admin.js";
import {fixtureConfig} from "./day-one-fixture.mjs";
import {dayOneSnapshot} from "../lib/day-one.js";
import {submissionHistory} from "../lib/submission-history.js";

test("15 flight players read fresh private snapshots without repeatedly loading the same cohort content",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async t=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname=`snapshot_perf_${Date.now()}`;process.env.MONGODB_URI=uri.toString();
  await connect();
  const previousDebug=mongoose.get("debug");
  try{
    for(const model of Object.values(models))await model.init();
    const config=fixtureConfig();
    await models.Cohort.create({_id:"alpha",name:"Flight performance",college:"Test",startDate:config.day,currentWeek:1});
    await models.WeekOneProgram.create({_id:"alpha",version:0,data:blankProgram()});
    await models.WeekOneRelease.create({_id:"alpha",days:[1,2,3,4,5].map(day=>({day,title:`Level ${day}`,state:day===1?"PREPARED":"DRAFT",...(day===1?{content:config,officialStart:config.officialStart,scheduledEnd:config.closingCutoff}:{})}))});
    await models.DayOneSetup.create({_id:"alpha",released:config,draft:config});
    await enableCompletionProgression("alpha");
    const players=await models.User.create(Array.from({length:15},(_,i)=>({_id:`perf-${i}`,name:`Player ${i}`,email:`perf-${i}@example.invalid`,role:"GAMER",cohortId:"alpha"})));
    await snapshot(players[0].toObject());
    const counts={};
    mongoose.set("debug",(collection,method)=>{if(method.startsWith("find"))counts[collection]=(counts[collection]||0)+1;});
    const start=performance.now();
    const results=await Promise.all(players.map(player=>snapshot(player.toObject())));
    const elapsed=performance.now()-start;
    mongoose.set("debug",previousDebug);
    results.forEach((result,i)=>{assert.equal(result.user._id,players[i]._id);assert.equal(result.story.flight,true);assert.deepEqual(result.roster,[]);assert.equal(result.weekOneProgram.learners.length,0);});
    t.diagnostic(JSON.stringify({players:15,totalReadQueries:Object.values(counts).reduce((sum,count)=>sum+count,0),elapsedMs:Math.round(elapsed),readQueries:counts}));
    if(!process.env.SNAPSHOT_PERF_BASELINE){
      assert.ok(counts[models.WeekOneProgram.collection.name]<=30,"at most one shared programme read plus attendance context per player");
      assert.ok(counts[models.WeekOneRelease.collection.name]<=30,"at most one shared release read plus attendance context per player");
      assert.ok(Object.values(counts).reduce((sum,count)=>sum+count,0)<=300,"15 flight refreshes must reuse scoped reads and stay within 300 reads");
    }
    await models.Cohort.updateOne({_id:"alpha"},{$set:{name:"Changed after request"}});
    assert.equal((await snapshot(players[0].toObject())).cohort.name,"Changed after request","a new request must read updated cohort state");
  }finally{mongoose.set("debug",previousDebug);await mongoose.connection.dropDatabase();await mongoose.disconnect();globalThis.__codewildMongo=null;}
});

test("routine staff refreshes omit repeated audit snapshots while preserving evidence and full history",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async t=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname=`snapshot_payload_${Date.now()}`;process.env.MONGODB_URI=uri.toString();await connect();
  try{
    for(const model of Object.values(models))await model.init();
    const config=fixtureConfig(),cc={_id:"cc",name:"CC",email:"cc@perf.invalid",role:"CENTRE_COMMAND",cohortId:"alpha"};
    await models.User.create([cc,{_id:"p",name:"Player",email:"p@perf.invalid",role:"GAMER",cohortId:"alpha"}]);
    await models.Cohort.create({_id:"alpha",name:"Payload check",college:"Test",startDate:config.day,currentWeek:1});
    await models.DayOneSetup.create({_id:"alpha",released:config,draft:config});
    await models.WeekOneRelease.create({_id:"alpha",days:[1,2,3,4,5].map(day=>({day,title:`Level ${day}`,state:day===1?"OPEN":"DRAFT",...(day===1?{content:config}:{})}))});
    const evidence="A preserved conversation with source checks. ".repeat(250);
    const data={config,submissions:[{id:"s",url:"https://example.org/submission",transcript:evidence,at:"2026-11-27T10:00:00Z"}],responses:[],ledger:[]};
    await models.DayOneRecord.create({_id:"alpha:p",cohortId:"alpha",userId:"p",data});
    await models.DayOneEvent.insertMany(Array.from({length:150},(_,i)=>({_id:`event-${i}`,cohortId:"alpha",userId:"p",actorId:"p",kind:"SUBMIT",createdAt:new Date(),details:{before:data,after:data,reason:"Saved evidence revision"}})));
    const full=await dayOneSnapshot(cc),compact=await dayOneSnapshot(cc,new Date(),{cohortId:"alpha",compact:true});
    const fullBytes=Buffer.byteLength(JSON.stringify(full)),compactBytes=Buffer.byteLength(JSON.stringify(compact));
    t.diagnostic(JSON.stringify({fullBytes,compactBytes,reductionPercent:Math.round((1-compactBytes/fullBytes)*100)}));
    assert.ok(compactBytes<fullBytes*0.1,"polls must not transfer the same full evidence twice per audit event");
    assert.equal(compact.records[0].submissions[0].transcript,evidence);
    assert.equal(compact.events.length,150);assert.ok(compact.events.every(event=>!event.details.before && !event.details.after));
    assert.equal((await submissionHistory(cc,"p",1)).attempts[0].missions[0].submissions[0].transcript,evidence);
    assert.equal((await models.DayOneEvent.findById("event-0").lean()).details.before.submissions[0].transcript,evidence,"audit evidence remains unchanged in storage");
  }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

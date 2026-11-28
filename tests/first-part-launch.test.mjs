import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {connect,models} from "../lib/db.js";
import {programAction,programSnapshot} from "../lib/week-one-program.js";
import {dayOneAction,dayOneSnapshot} from "../lib/day-one.js";
import {playerStage} from "../lib/player-stage.js";
import {fixtureConfig} from "./day-one-fixture.mjs";
import {blankProgram} from "../lib/week-one-program-rules.js";
import {starterFlightContent} from "../lib/flight-starter-content.js";
import {attendanceAction,attendanceSnapshot} from "../lib/attendance.js";

test("CC opens the complete first part without manual rules or setup, with private sequential progress and safe retries",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname=`first_part_${Date.now()}`;process.env.MONGODB_URI=uri.toString();await connect();
  const now=new Date("2026-11-28T20:00:00Z"); // Sunday, outside normal college hours in India.
  try{
    for(const model of Object.values(models))await model.init();
    await models.Cohort.create([{_id:"alpha",name:"Initial cohort",college:"Test",startDate:"2026-11-27",currentWeek:1},{_id:"beta",name:"Other cohort",college:"Test",startDate:"2026-11-27",currentWeek:1}]);
    const people=await models.User.create([{_id:"cc",name:"CC",email:"cc@example.invalid",role:"CENTRE_COMMAND"},{_id:"mc",name:"MC",email:"mc@example.invalid",role:"MISSION_COMMANDER"},{_id:"limited",name:"Limited CC",email:"limited@example.invalid",role:"CENTRE_COMMAND",permissions:[]},...Array.from({length:15},(_,i)=>({_id:`g${i}`,name:`Player ${i}`,email:`g${i}@example.invalid`,role:"GAMER"}))]);
    const [cc,mc,limited,...players]=people.map(person=>person.toObject());
    for(const actor of [mc,limited,players[0],{...players[0],role:"CENTRE_COMMAND"},{...cc,cohortId:"beta"}])await assert.rejects(programAction(actor,"open-first-part",{},now),error=>error.status===403);
    assert.equal(await models.WeekOneRelease.countDocuments(),0,"rejected actors do not create releases");
    await assert.rejects(programAction(cc,"open-first-part",{cohortId:"beta"},now),/without overriding/);
    const opened=await programAction(cc,"open-first-part",{},now);assert.equal(opened.opened,true);
    const program=await models.WeekOneProgram.findById("alpha").lean(),release=await models.WeekOneRelease.findById("alpha").lean();
    assert.equal(program.data.rules.length,0,"no invented rules or CC approvals are published");
    assert.equal(program.data.progressionMode,"COMPLETION");assert.ok(program.data.flightLaunch.openedAt);
    assert.ok(release.days.every(day=>day.content));assert.equal(release.days[0].content.genres.length,51);
    assert.equal(await models.ResearchSelection.countDocuments(),3);
    assert.equal(await models.WeekOneRelease.countDocuments({_id:"beta"}),0);
    assert.equal((await playerStage(players[0])).flight,true);
    let view=await programSnapshot(players[0],now);assert.equal(view.progression.levels[0].available,true);assert.equal(view.progression.levels[1].available,false);
    assert.deepEqual(view.rules,[]);
    await dayOneAction(players[0],"clock",{},now);
    const original=await models.DayOneRecord.findOne({userId:players[0]._id}).lean();
    assert.equal(original.data.clockAt,now.toISOString());assert.equal(await models.Attendance.countDocuments(),0,"game entry does not forge official college attendance");
    const offer=await dayOneAction(players[0],"genre-offer",{},now);assert.equal(offer.genres.length,7);
    const before=mongoose.mongo.BSON.serialize(await models.DayOneRecord.findById(original._id).lean());
    const auditCount=await models.WeekOneEvent.countDocuments({kind:"FIRST_PART_OPENED"});
    const retry=await programAction(cc,"open-first-part",{},new Date(+now+60000));assert.equal(retry.alreadyOpen,true);
    assert.deepEqual(mongoose.mongo.BSON.serialize(await models.DayOneRecord.findById(original._id).lean()),before);
    assert.equal(await models.WeekOneEvent.countDocuments({kind:"FIRST_PART_OPENED"}),auditCount);
    const newcomer=(await models.User.create({_id:"late-player",name:"Late player",email:"late@example.invalid",role:"GAMER"})).toObject();
    await dayOneAction(newcomer,"clock",{},now);assert.equal((await dayOneAction(newcomer,"genre-offer",{},now)).genres.length,7,"players added after launch can enter without reconfiguration");
    assert.equal((await dayOneSnapshot(players[1],now)).records.length,0,"another player never sees the entered player's work");
    for(const player of players){
      for(const when of [now,new Date("2026-11-30T01:00:00Z"),new Date("2026-11-30T18:00:00Z")]){
        const session=await attendanceSnapshot(player,when);
        assert.equal(session.state,"FREE_PLAY");assert.equal(session.attendanceRequired,false);assert.equal(session.available,true);assert.equal(session.cutoffAt,null);
      }
    }
    await attendanceAction(players[1],"clock-in",{},now);
    await attendanceAction(players[1],"clock-out",{},now);
    assert.equal((await attendanceSnapshot(players[1],now)).state,"FREE_PLAY","old clock-out buttons cannot block first-part play");
    assert.equal(await models.Attendance.countDocuments(),0);assert.equal(await models.ExtraPlaySession.countDocuments(),0,"no daily play exceptions are required");

    const betaCc=(await models.User.create({_id:"beta-cc",name:"Beta CC",email:"betacc@example.invalid",role:"CENTRE_COMMAND",cohortId:"beta"})).toObject();
    await models.User.create({_id:"beta-player",name:"Beta player",email:"beta@example.invalid",role:"GAMER",cohortId:"beta"});
    const config=fixtureConfig(),custom=starterFlightContent(2,config);custom.activities[0].variants[0].brief="An existing customised scenario with its original pinned observations.";
    await models.WeekOneProgram.create({_id:"beta",data:blankProgram()});
    await models.WeekOneRelease.create({_id:"beta",days:[1,2,3,4,5].map(day=>({day,title:`Level ${day}`,state:day<3?"PREPARED":"DRAFT",...(day===1?{content:config}:day===2?{content:custom}:day===3?{draft:{unfinished:true}}:{})}))});
    await models.DayOneSetup.create({_id:"beta",draft:config,released:config,versions:[config]});
    const pinned=mongoose.mongo.BSON.serialize((await models.WeekOneRelease.findById("beta").lean()).days[1].content);
    await programAction(betaCc,"open-first-part",{},now);
    assert.deepEqual(mongoose.mongo.BSON.serialize((await models.WeekOneRelease.findById("beta").lean()).days[1].content),pinned);
    assert.deepEqual((await models.WeekOneRelease.findById("beta").lean()).days[2].draft,{unfinished:true},"unpublished drafts are preserved without blocking built-in launch content");
    assert.equal((await models.WeekOneRelease.findById("beta").lean()).days[0].content.genres.length,4,"existing published Day 1 content is kept");
    await models.WeekOneProgram.updateOne({_id:"beta"},{$set:{"data.locked":true}});
    await assert.rejects(programAction(betaCc,"open-first-part",{},now),error=>error.status===409);
  }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

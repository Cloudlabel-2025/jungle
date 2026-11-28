import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {connect,models} from "../lib/db.js";
import {calendarAction} from "../lib/cohort-calendar.js";
import {attendanceHours,attendanceWindow} from "../lib/attendance-hours.js";
import {attendanceRegister,correctAttendance} from "../lib/attendance-register.js";
import {syncAttendance} from "../lib/attendance-session.js";

const day="2026-11-16",at=(time,date=day)=>new Date(`${date}T${time}:00+05:30`);
test("dated shifts preserve prior schedules; scoped time corrections preserve breaks and audit old/new values",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname=`attendance_shifts_${Date.now()}`;process.env.MONGODB_URI=uri.toString();await connect();
  try{
    for(const model of Object.values(models))await model.init();
    await models.Cohort.create({_id:"alpha",name:"Crew",college:"Test",startDate:day,attendanceTrackingStartDay:day,workingCalendar:{timeZone:"Asia/Kolkata",weekdays:[1,2,3,4,5]}});
    const people=await models.User.create([["cc","CENTRE_COMMAND"],["mc","MISSION_COMMANDER"],["limited","MISSION_COMMANDER"],["p","GAMER"],["other","GAMER"]].map(([id,role])=>({_id:id,name:id,email:`${id}@invalid.test`,role,cohortId:"alpha",teamId:id==="p"?"t":"other",attendanceTrackingStartDay:day,xp:75,...(id==="limited"?{permissions:[]}: {})})));
    const [cc,mc,limited,p,other]=people.map(row=>row.toObject());
    await models.Team.create({_id:"t",name:"Team",code:"T",cohortId:"alpha",commanderId:mc._id});
    const hours={action:"HOURS",hours:{startTime:"10:00",endTime:"18:00"},effectiveDay:"2026-11-17",reason:"Shift for the next teaching day",version:0};
    for(const actor of [p,limited])await assert.rejects(calendarAction(actor,hours,at("10:00")),e=>e.status===403);
    await calendarAction(mc,hours,at("10:00"));
    let cohort=await models.Cohort.findById("alpha").lean();
    assert.equal(attendanceHours(cohort,day).startTime,"09:00");assert.equal(attendanceHours(cohort,"2026-11-17").startTime,"10:00");
    assert.equal(attendanceWindow(cohort,at("12:00")).endTime,"17:00");
    await assert.rejects(calendarAction(cc,hours,at("10:00")),e=>e.status===409);
    await assert.rejects(calendarAction(cc,{...hours,version:1,effectiveDay:"2026-11-15"},at("10:00")),e=>e.status===400);
    await models.Attendance.create({_id:"clock",cohortId:"alpha",userId:p._id,day,clockAt:at("09:00"),clockOutAt:at("16:00"),officialStartAt:at("09:00"),cutoffAt:at("17:00"),sessionState:"OUT",sessionEvents:[{type:"IN",at:at("09:00")},{type:"OUT",at:at("12:00")},{type:"IN",at:at("13:00")},{type:"OUT",at:at("16:00")} ]});
    const view=await attendanceRegister(mc,day,at("19:00")),row=view.rows[0];
    assert.equal(view.hours.startTime,"09:00");assert.equal(view.shiftHistory[0].actorName,"mc");
    const body={userId:p._id,day,status:"DEFAULT",reason:"Corrected times from the approved register",version:row.version,clockVersion:row.clockVersion,clockTimes:{clockIn:"10:00",clockOut:"15:00"}};
    await assert.rejects(correctAttendance(mc,{...body,userId:other._id},at("19:00")),e=>e.status===403);
    await assert.rejects(correctAttendance(p,body,at("19:00")),e=>e.status===403);
    await assert.rejects(correctAttendance(mc,{...body,clockTimes:{clockIn:"14:00",clockOut:"15:00"}},at("19:00")),e=>e.status===400);
    await assert.rejects(correctAttendance(mc,{...body,clockTimes:{clockIn:"10:00",clockOut:"20:00"}},at("19:00")),e=>e.status===400);
    await correctAttendance(mc,body,at("19:00"));
    const updated=await attendanceRegister(cc,day,at("19:00"));
    assert.equal(updated.rows.find(r=>r.userId===p._id).officialMinutes,240,"break time remains excluded");
    const audit=updated.history[0];assert.equal(+audit.before.clockAt,+at("09:00"));assert.equal(+audit.after.clockAt,+at("10:00"));assert.equal(audit.actorName,"mc");
    assert.equal((await models.User.findById(p._id).lean()).xp,75);
    await assert.rejects(correctAttendance(mc,body,at("19:00")),e=>e.status===409);
    // Changing today's open shift never rewrites a completed session.
    await models.Attendance.create({_id:"active",cohortId:"alpha",userId:other._id,day,clockAt:at("09:00"),officialStartAt:at("09:00"),cutoffAt:at("17:00"),checkDueAt:at("17:00"),sessionState:"ACTIVE"});
    const pinned=JSON.stringify(await models.Attendance.findById("clock").lean());
    await calendarAction(cc,{...hours,version:1,effectiveDay:day,hours:{startTime:"08:00",endTime:"16:30"}},at("14:00"));
    assert.equal(JSON.stringify(await models.Attendance.findById("clock").lean()),pinned);
    assert.equal(+(await models.Attendance.findById("active").lean()).cutoffAt,+at("16:30"));
    const activeView=await attendanceRegister(cc,day,at("14:00")),active=activeView.rows.find(r=>r.userId===other._id);
    await assert.rejects(correctAttendance(cc,{...body,userId:other._id,version:active.version,clockVersion:active.clockVersion,clockTimes:{clockIn:"09:00",clockOut:"13:00"}},at("14:00")),e=>e.status===409);
    await syncAttendance(at("16:30"));assert.equal((await models.Attendance.findById("active").lean()).sessionState,"OUT");
    cohort=await models.Cohort.findById("alpha").lean();assert.equal(attendanceHours(cohort,"2026-11-17").startTime,"10:00","later planned shifts are retained");
  }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

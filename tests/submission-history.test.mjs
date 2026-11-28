import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {connect,models} from "../lib/db.js";
import {submissionHistory} from "../lib/submission-history.js";

test("staff read all current and archived submission revisions, including old claim checks, within assigned scope",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
  const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname=`submission_history_${Date.now()}`;process.env.MONGODB_URI=uri.toString();await connect();
  try{
    for(const model of Object.values(models))await model.init();
    const people=await models.User.create([["cc","CENTRE_COMMAND"],["mc","MISSION_COMMANDER"],["p","GAMER"],["other","GAMER"],["beta","CENTRE_COMMAND"]].map(([id,role])=>({_id:id,name:id,email:`${id}@history.invalid`,role,cohortId:id==="beta"?"beta":"alpha",teamId:id==="p"?"t":"outside"})));
    const [cc,mc,p,other,beta]=people.map(row=>row.toObject());
    await models.Team.create({_id:"t",name:"Team",code:"T",cohortId:"alpha",commanderId:"mc"});
    const first={id:"first",at:"2026-11-26T10:00:00Z",url:"https://example.org/first",transcript:"First submitted conversation",reason:"Initial submission"};
    const second={id:"second",at:"2026-11-26T11:00:00Z",url:"https://example.org/second",transcript:"Corrected submitted conversation",reason:"Corrected evidence link"};
    const claim={claim:"Original claim",source:"https://example.org/source",verdict:"UNCERTAIN",finding:"An earlier independent finding",researchRevisionId:"first",at:"2026-11-26T12:00:00Z"};
    await models.DayOneRecord.create({_id:"alpha:p",cohortId:"alpha",userId:"p",data:{submissions:[{...second,id:"current"}],claimCheck:{...claim,claim:"Current claim",researchRevisionId:"current"},levelOne:{attempt:2,history:[{attempt:1,submissions:[first,second],claimCheck:claim,at:"2026-11-27T09:00:00Z",reason:"Approved replay"}]}}});
    await models.DayOneEvent.create([{_id:"claim1",cohortId:"alpha",userId:"p",actorId:"p",kind:"CLAIM-CHECK-SUBMIT",createdAt:new Date("2026-11-26T12:00:00Z"),details:{after:{claimCheck:claim,levelOne:{attempt:1}}}},{_id:"claim2",cohortId:"alpha",userId:"p",actorId:"p",kind:"CLAIM-CHECK-SUBMIT",createdAt:new Date("2026-11-26T13:00:00Z"),details:{after:{claimCheck:{...claim,at:"2026-11-26T13:00:00Z",finding:"Revised independent finding"},levelOne:{attempt:1}}}}]);
    for(const day of [2,3,4,5]){
      const attempt={_id:`old-${day}`,activityId:`D${day}-G01`,cohortId:"alpha",userId:"p",day,data:{activity:{name:`Mission ${day}`,questions:[]},submissions:[{id:`old-answer-${day}`,at:first.at,answers:{url:first.url,notes:"Original answer"}},{id:`revised-answer-${day}`,at:second.at,answers:{url:second.url,notes:"Revised answer"}}]}};
      await models.WeekOneLevel.create({_id:`level-${day}`,cohortId:"alpha",userId:"p",day,data:{attempt:2,history:[{attempt:1,at:second.at,reason:"Approved replay",attempts:[attempt]}]}});
      await models.WeekOneAttempt.create({...attempt,_id:`current-${day}`,data:{...attempt.data,submissions:[{id:`current-answer-${day}`,at:second.at,answers:{notes:"Current answer"}}]}});
    }
    const before=JSON.stringify(await models.DayOneRecord.findById("alpha:p").lean());
    for(const actor of [cc,mc]){
      const history=await submissionHistory(actor,"p",1);
      assert.deepEqual(history.attempts[0].missions[0].submissions.map(row=>row.url),[first.url,second.url]);
      assert.equal(history.attempts[0].missions[1].submissions.length,2,"audit-backed claim revisions survive replay without duplication");
      assert.equal(history.attempts[1].missions[0].submissions[0].id,"current");
      for(const day of [2,3,4,5]){
        const view=await submissionHistory(actor,"p",day);
        assert.equal(view.attempts[0].missions[0].submissions.length,2);
        assert.equal(view.attempts[0].missions[0].submissions[0].answers.notes,"Original answer");
        assert.equal(view.attempts[1].missions[0].submissions[0].answers.notes,"Current answer");
      }
    }
    for(const [actor,userId] of [[mc,"other"],[p,"p"],[beta,"p"],[{...p,role:"CENTRE_COMMAND"},"p"]])await assert.rejects(submissionHistory(actor,userId,1),e=>e.status===403);
    await assert.rejects(submissionHistory(cc,"p",6),e=>e.status===400);
    await models.User.updateOne({_id:"p"},{$set:{teamId:"outside"}});
    await assert.rejects(submissionHistory(mc,"p",1),e=>e.status===403,"team assignment changes take effect immediately");
    assert.equal(JSON.stringify(await models.DayOneRecord.findById("alpha:p").lean()),before,"history viewing never changes submissions or results");
  }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

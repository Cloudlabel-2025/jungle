import {connect,models} from "./db.js";
import {scope,cohortOf,demand} from "./access-scope.js";

const mission = attempt => ({
  id:attempt.activityId || attempt._id,
  title:attempt.data.activity?.name || "Mission",
  brief:attempt.data.variant?.brief || attempt.data.activity?.brief || "",
  questions:(attempt.data.activity?.questions || []).map(({id,prompt,question,options})=>({id,prompt:prompt || question,options})),
  submissions:attempt.data.submissions || [],
});
const claimAnswers = ({claim,source,verdict,finding})=>({claim,source,verdict,finding});

export async function submissionHistory(actor,userId,day){
  await connect();
  const access=await scope(actor);
  demand(["CENTRE_COMMAND","MISSION_COMMANDER"].includes(access.user.role),"MC or CC access is required.",403);
  demand(typeof userId==="string" && userId.length<=200 && access.userIds.includes(userId),"This player is outside your review scope.",403);
  demand(Number.isInteger(day) && day>=1 && day<=5,"Choose a level from 1 to 5.",400);
  const cohortId=cohortOf(access.user);
  if(day!==1){
    const [level,current]=await Promise.all([
      models.WeekOneLevel.findOne({cohortId,userId,day}).select("data.attempt data.history").lean(),
      models.WeekOneAttempt.find({cohortId,userId,day}).sort({activityId:1}).lean(),
    ]);
    const attempts=(level?.data.history || []).map(history=>({attempt:history.attempt,archived:true,archivedAt:history.at,reason:history.reason,missions:(history.attempts || []).filter(row=>row.userId===userId && row.cohortId===cohortId && row.day===day).map(mission)}));
    attempts.push({attempt:level?.data.attempt || 1,archived:false,missions:current.map(mission)});
    return {userId,day,attempts};
  }
  const [record,events]=await Promise.all([
    models.DayOneRecord.findOne({cohortId,userId}).select("data.submissions data.claimCheck data.levelOne.attempt data.levelOne.history").lean(),
    models.DayOneEvent.find({cohortId,userId,kind:"CLAIM-CHECK-SUBMIT"}).select("details.after.claimCheck details.after.levelOne.attempt createdAt").sort({createdAt:1,_id:1}).lean(),
  ]);
  const data=record?.data;
  const attempts=(data?.levelOne?.history || []).map(history=>({attempt:history.attempt,archived:true,archivedAt:history.at,reason:history.reason,missions:[{id:"research",title:"AI research conversation",submissions:history.submissions || []}],claim:history.claimCheck}));
  attempts.push({attempt:data?.levelOne?.attempt || 1,archived:false,missions:[{id:"research",title:"AI research conversation",submissions:data?.submissions || []}],claim:data?.claimCheck});
  for(const attempt of attempts){
    const checks=events.filter(event=>(event.details?.after?.levelOne?.attempt || 1)===attempt.attempt).map(event=>event.details.after.claimCheck).filter(Boolean);
    if(attempt.claim)checks.push(attempt.claim);
    const seen=new Set();
    const submissions=checks.filter(check=>{const key=JSON.stringify([check.researchRevisionId,check.at,claimAnswers(check)]);if(seen.has(key))return false;seen.add(key);return true;}).map((check,index)=>({id:`claim-${attempt.attempt}-${index+1}`,at:check.at,researchRevisionId:check.researchRevisionId,answers:claimAnswers(check)}));
    attempt.missions.push({id:"claim-check",title:"Independent claim check",submissions});
    delete attempt.claim;
  }
  return {userId,day,attempts};
}

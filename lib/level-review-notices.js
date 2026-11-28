import {models} from "./db.js";

const summary=result=>({completed:Boolean(result?.completed),stars:result?.completed?result.stars:0});
// Saved in the result transaction: failed or stale reviews cannot notify players.
export async function notifyLevelReview({cohortId,userId,day,version,actor,operation,before,after,reason,now,revalidated=false},session){
  await models.PlayerResultNotice.create([{
    _id:JSON.stringify([cohortId,userId,day,version]),cohortId,userId,day,version,
    actorId:actor._id,actorName:actor.name,actorRole:actor.role,
    operation:operation==="validate" && revalidated?"revalidate":operation,
    before:summary(before),after:summary(after),reason,createdAt:now,
  }],{session});
}

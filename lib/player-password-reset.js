import { randomBytes } from "node:crypto";
import { contextForCollege, collegeError } from "./college-registry.js";
import { authorizeManagement, guideOwnsTeam } from "./management-actor.js";
import { runWithCollege } from "./college-context.js";
import { transaction } from "./db.js";
import { cohortFilter } from "./access-scope.js";
import { hashPassword } from "./password.js";

const fail=(message,status=400)=>{throw collegeError(message,status);};
export async function resetPlayerPassword(actor,collegeId,body) {
  await authorizeManagement(actor,collegeId);
  if(typeof body.userId!=="string" || typeof body.cohortId!=="string" ||
    typeof body.requestId!=="string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId) ||
    !Number.isInteger(body.version) || body.version<1) fail("Reload the player account before requesting a reset.");
  const context=await contextForCollege({_id:collegeId});
  const temporaryPassword=randomBytes(18).toString("base64url"), passwordHash=await hashPassword(temporaryPassword);
  const eventId=`player-password-reset:${body.requestId}`;
  return runWithCollege(context,()=>transaction(async session=>{
    const staff=await authorizeManagement(actor,collegeId,session,{lock:true});
    const player=await context.models.User.findOne({_id:body.userId,$and:[cohortFilter({cohortId:body.cohortId})],role:"GAMER",active:{$ne:false}}).session(session).lean();
    if(!player)fail("Active player not found in this college and cohort.",404);
    const team=player.teamId?await context.models.Team.findOne({_id:player.teamId,$and:[cohortFilter(player)]}).session(session).lean():null;
    if(staff.role==="MISSION_COMMANDER" && (!team || !guideOwnsTeam(staff,team)))fail("You can reset passwords only for players in your assigned teams.",403);
    const actorId=staff.role==="SUPER_ADMIN"?`cms:${staff.id}`:staff.id;
    const previous=await context.models.PlatformManagementEvent.findById(eventId).session(session).lean();
    if(previous){
      if(previous.actorId!==actorId || previous.action!=="PLAYER_PASSWORD_RESET" || previous.details?.playerId!==player._id || previous.cohortId!==body.cohortId)fail("This reset request ID was already used for another action.",409);
      return{playerId:player._id,alreadyReset:true,mustChangePassword:true};
    }
    if((player.managementVersion||1)!==body.version)fail("The player account changed. Reload before resetting its password.",409);
    if(team)await context.models.Team.updateOne({_id:team._id},{$inc:{version:1}},{session});
    const credential=await context.models.Credential.findById(player._id).session(session).lean();
    if(!credential)fail("This player has no sign-in credential. Contact Centre Command to complete account setup.",409);
    const authVersion=(player.authVersion||1)+1;
    await context.models.User.updateOne({_id:player._id},{$set:{authVersion,managementVersion:body.version+1}},{session});
    await context.models.Credential.updateOne({_id:player._id},{$set:{passwordHash,mustChangePassword:true,passwordChangedAt:new Date(),failures:0,lockedUntil:null}},{session});
    await context.models.PlatformManagementEvent.create([{_id:eventId,actorId,action:"PLAYER_PASSWORD_RESET",cohortId:body.cohortId,teamId:player.teamId,details:{playerId:player._id,actorRole:staff.role,authVersion}}],{session});
    // Only metadata is audited. The temporary password exists only in this response.
    return{playerId:player._id,username:player.username||"",temporaryPassword,mustChangePassword:true};
  }));
}

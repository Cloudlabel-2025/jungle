import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {resetPlayerPassword} from "../lib/player-password-reset.js";
import {registryModels,contextForCollege,closeCollegeConnections} from "../lib/college-registry.js";
import {runWithCollege} from "../lib/college-context.js";
import {collegeManagementActor} from "../lib/management-actor.js";
import {platformModels} from "../lib/platform-auth.js";
import {hashPassword,checkPassword} from "../lib/password.js";
import {setPermanentPassword} from "../lib/college-password.js";
import {platformTeamCommand,platformPersonUpdate} from "../lib/platform-management.js";
import {normalizeAccountUsername,usernamePattern} from "../lib/account-username.js";
import {validateMembers} from "../lib/team-management.js";

test("plain player usernames agree between browser Unicode patterns and server validation",()=>{
 const pattern=new RegExp(`^(?:${usernamePattern})$`,"v");
 for(const name of ["arjun","Arjun","arjun.1","arjun_1","arjun-1"]){
  assert.ok(pattern.test(name));assert.equal(normalizeAccountUsername(` ${name} `),name.toLowerCase());
  assert.equal(validateMembers([{name:"Arjun",username:name,password:"Example-password-123"}])[0].username,name.toLowerCase());
 }
 for(const name of ["ar jun","@arjun","arjun@example.com"]){assert.ok(!pattern.test(name));assert.throws(()=>normalizeAccountUsername(name));}
});

test("assisted reset scopes staff, revokes sessions, preserves history and forces a fresh password without persisting the temporary secret",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
 const previous={...process.env},suffix=randomUUID().replaceAll("-","");
 Object.assign(process.env,{MONGODB_URI:process.env.TEST_MONGODB_URI,TENANT_MONGODB_URI:process.env.TEST_MONGODB_URI,MASTER_MONGODB_URI:process.env.TEST_MONGODB_URI,MASTER_DB_NAME:`reset_${suffix}`,TENANCY_ENABLED:"true",SESSION_SECRET:"test-assisted-reset-secret-longer-than-32-characters"});
 let context,other;
 try{
  const{PlatformAdmin}=await platformModels();await PlatformAdmin.create({_id:"owner",name:"Owner",email:"owner@example.edu",passwordHash:"unused",mustChangePassword:false});
  const{College}=await registryModels();await College.create([{_id:"a",name:"College A",slug:"a-college",dbName:`reset_a_${suffix}`,status:"ACTIVE"},{_id:"b",name:"College B",slug:"b-college",dbName:`reset_b_${suffix}`,status:"ACTIVE"}]);
  context=await contextForCollege({_id:"a"});other=await contextForCollege({_id:"b"});
  await Promise.all([...Object.values(context.models),...Object.values(other.models)].map(model=>model.init()));
  const{User,Credential,Team,Cohort,PlatformManagementEvent}=context.models;
  await other.models.Cohort.create({_id:"alpha",name:"Other intake",college:"B",startDate:"2027-01-04"});
  await other.models.Team.create({_id:"b-team",name:"Other college team",code:"BT"});
  const plainName=await platformTeamCommand("owner","b","add-member",{requestId:randomUUID(),cohortId:"alpha",teamId:"b-team",member:{name:"Arjun",username:"arjun",password:"Example-password-123"}});
  assert.equal((await other.models.User.findById(plainName.id).lean()).username,"arjun","CMS creation accepts the plain username arjun");
  await Cohort.create([{_id:"alpha",name:"Alpha",college:"A",startDate:"2027-01-04"},{_id:"beta",name:"Beta",college:"A",startDate:"2027-02-01"}]);
  await User.create([{_id:"cc",name:"CC",email:"cc@example.edu",role:"CENTRE_COMMAND"},{_id:"mc",name:"MC",email:"mc@example.edu",role:"MISSION_COMMANDER"},{_id:"mc-other",name:"Other MC",email:"mc-other@example.edu",role:"MISSION_COMMANDER"},
   {_id:"player",name:"Arjun",username:"arjun",email:"arjun@players.codewild.invalid",role:"GAMER",teamId:"team",xp:123,trophies:45},
   {_id:"other-player",name:"Other player",username:"other-player",email:"other@players.codewild.invalid",role:"GAMER",teamId:"other-team"},
   {_id:"beta-player",name:"Beta player",username:"beta-player",email:"beta@players.codewild.invalid",role:"GAMER",cohortId:"beta",teamId:"beta-team"},
   {_id:"inactive",name:"Inactive",username:"inactive",email:"inactive@players.codewild.invalid",role:"GAMER",teamId:"team",active:false}]);
  await Team.create([{_id:"team",name:"Team",code:"T1",commanderId:"mc"},{_id:"other-team",name:"Other",code:"T2",commanderId:"mc-other"},{_id:"beta-team",name:"Beta",code:"B1",cohortId:"beta",commanderId:"mc-other"}]);
  const oldPassword="Old-password-123",passwordHash=await hashPassword(oldPassword);
  await Credential.create(["player","other-player","beta-player","inactive"].map(_id=>({_id,passwordHash,mustChangePassword:false,failures:4,lockedUntil:new Date(Date.now()+60000)})));
  const as=work=>runWithCollege(context,work);
  const principal=async id=>as(async()=>collegeManagementActor(await User.findById(id).lean()));
  const mc=await principal("mc"),cc=await principal("cc"),gamer=await principal("player");
  const body=(userId="player",extras={})=>({userId,cohortId:"alpha",version:1,requestId:randomUUID(),...extras});
  await as(()=>assert.rejects(resetPlayerPassword(gamer,"a",body()),error=>error.status===403));
  await as(()=>assert.rejects(resetPlayerPassword(mc,"b",body()),error=>error.status===403));
  await as(()=>assert.rejects(resetPlayerPassword(mc,"a",body("other-player")),error=>error.status===403));
  await as(()=>assert.rejects(resetPlayerPassword(mc,"a",body("cc")),error=>error.status===404));
  await as(()=>assert.rejects(resetPlayerPassword(mc,"a",body("inactive")),error=>error.status===404));
  const request=body();const result=await as(()=>resetPlayerPassword(mc,"a",request));
  assert.equal(result.username,"arjun");assert.ok(result.temporaryPassword.length>=20);
  let saved=await Credential.findById("player").lean();assert.ok(await checkPassword(result.temporaryPassword,saved.passwordHash));assert.ok(!(await checkPassword(oldPassword,saved.passwordHash)));assert.equal(saved.mustChangePassword,true);assert.equal(saved.failures,0);assert.equal(saved.lockedUntil,null);
  const player=await User.findById("player").lean();assert.equal(player.authVersion,2);assert.equal(player.xp,123);assert.equal(player.trophies,45);assert.equal(player.teamId,"team");
  const receipt=await PlatformManagementEvent.findOne({action:"PLAYER_PASSWORD_RESET"}).lean();assert.ok(!JSON.stringify(receipt).includes(result.temporaryPassword));assert.ok(!JSON.stringify(receipt).includes(saved.passwordHash));
  const replay=await as(()=>resetPlayerPassword(mc,"a",request));assert.equal(replay.alreadyReset,true);assert.equal(replay.temporaryPassword,undefined);assert.equal((await User.findById("player").lean()).authVersion,2);
  await as(()=>assert.rejects(setPermanentPassword(player,{newPassword:result.temporaryPassword,confirmPassword:result.temporaryPassword}),/different/));
  await as(()=>setPermanentPassword(player,{newPassword:"Permanent-password-123",confirmPassword:"Permanent-password-123"}));
  assert.equal((await Credential.findById("player").lean()).mustChangePassword,false);assert.equal((await User.findById("player").lean()).authVersion,3);
  await as(()=>resetPlayerPassword(cc,"a",body("beta-player",{cohortId:"beta"})));
  const adminReset=await resetPlayerPassword("owner","a",body("other-player"));assert.ok(adminReset.temporaryPassword);
  const current=await User.findById("player").lean();const raceBody=body("player",{version:current.managementVersion});
  const race=await as(()=>Promise.all([resetPlayerPassword(mc,"a",raceBody),resetPlayerPassword(mc,"a",raceBody)]));assert.equal(race.filter(row=>row.temporaryPassword).length,1);assert.equal(race.filter(row=>row.alreadyReset).length,1);
  await Team.updateOne({_id:"team"},{$set:{commanderId:"mc-other"}});
  await as(()=>assert.rejects(resetPlayerPassword(mc,"a",raceBody),error=>error.status===403,"replay rechecks current team ownership"));
  await as(()=>assert.rejects(platformTeamCommand(cc,"a","add-member",{requestId:randomUUID(),cohortId:"alpha",teamId:"team",member:{name:"Duplicate Arjun",username:"arjun",password:"Example-password-123"}}),error=>error.status===409&&/already used/.test(error.message)));
  const available=await as(()=>platformTeamCommand(cc,"a","add-member",{requestId:randomUUID(),cohortId:"alpha",teamId:"other-team",member:{name:"Arjun Two",username:"arjun.two",password:"Example-password-123"}}));assert.ok(available.id);
  const edit=await User.findById(available.id).lean();
  await as(()=>platformPersonUpdate(cc,"a",{requestId:randomUUID(),cohortId:"alpha",userId:edit._id,version:edit.managementVersion,name:edit.name,username:"arjun_two",email:"",active:true}));
  assert.equal((await User.findById(edit._id).lean()).email,"arjun_two@players.codewild.invalid");
  assert.equal(await other.models.User.countDocuments(),1);assert.equal((await other.models.User.findById(plainName.id).lean()).authVersion,1,"another college with the same username is unchanged");
 }finally{
  await context?.connection.dropDatabase();await other?.connection.dropDatabase();const{connection}=await registryModels();await connection.dropDatabase();await closeCollegeConnections();
  for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);
 }
});

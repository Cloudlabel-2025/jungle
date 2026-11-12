// Disposable fictional browser QA. No .env.local, production DB or provider credentials.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
import mongoose from "mongoose";
import { models } from "../lib/db.js";
import { hash } from "../lib/pilot-rules.js";
import { stages } from "../lib/pilot-calendar.js";
import { hashPassword } from "../lib/password.js";
import { pilotFixture, sprintConfig } from "../tests/pilot-fixture.mjs";
import partB from "../lib/pilot-part-b.json" with { type: "json" };

const fiveTeams = process.argv.includes("--five-teams");
if (fiveTeams && (process.argv.includes("--restore") || process.argv.includes("--report-checkpoint"))) throw new Error("Restore checkpoints contain one team; use a fresh five-team fixture.");
const dir = resolve(fiveTeams ? "artifacts/part-b-final-local-2026-11-12" : "artifacts/part-b-browser-2026-11-12");
const privateDir = resolve(fiveTeams ? ".data/part-b-final-local" : ".data/part-b-browser");
await mkdir(dir, { recursive: true }); await mkdir(privateDir, { recursive: true });
const clock = resolve(privateDir,"clock.txt");
await writeFile(clock,"2026-11-30T07:00:00Z");
const replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.24" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
process.env.MONGODB_URI = replica.getUri("part_b_browser_disposable");
const fixture = await pilotFixture(fiveTeams ? 5 : 1);
const { cc, cc2, mc, otherMC, gamers, teams, cohortId } = fixture;
const fifth = { ...mc, _id:"browser-fifth",email:"fifth@pilot.invalid" }; await models.User.create(fifth);
const password = "Fictional-QA-2026!";
for (const user of [cc,cc2,mc,otherMC,fifth,...gamers]) await models.Credential.create({ _id:user._id,passwordHash:await hashPassword(password) });
await models.User.updateMany({ cohortId }, { $set: { rewardVersion:2, hp:5,energy:3 } });
const programme = await models.WeekOneProgram.findById(cohortId).lean();
const evidence="https://example.invalid/browser-evidence";
const seedStage = async number => {
  await models.PilotSprint.updateMany({ cohortId, state:{$ne:"CLOSED"} },{$set:{state:"CLOSED"}});
  for (let n=1;n<number;n++) {
    const old=await models.PilotSprint.findOne({cohortId,"data.number":n}).lean();
    const acceptances = teams.map(team => ({ teamId:team.id,decision:"ACCEPTED",key:`Key ${n}`,reason:"Seeded prior outcome for isolated browser checkpoint; not real UAT." }));
    if(old) await models.PilotSprint.updateOne({_id:old._id},{$set:{state:"CLOSED","data.acceptances":acceptances}});
    else await models.PilotSprint.create({_id:`browser-prior-${n}`,cohortId,state:"CLOSED",version:1,createdAt:new Date(`2026-11-0${n}T00:00:00Z`),data:{number:n,teams:[],gates:[],acceptances}});
  }
  const template=partB.sprints.find(row=>row.number===number);
  const dates=number===3? ["2026-11-23T04:30:00Z","2026-11-27T11:30:00Z","2026-11-23T07:00:00Z"] : number===4 ? ["2026-11-30T04:30:00Z","2026-12-04T11:30:00Z","2026-11-30T07:00:00Z"] : ["2026-12-07T04:30:00Z","2026-12-11T11:30:00Z","2026-12-11T08:00:00Z"];
  await writeFile(clock,dates[2]);
  const config={...sprintConfig(teams,mc,2),number,template, kickoffStart:dates[0],kickoffEnd:dates[0],dueAt:dates[1],originalDueAt:dates[1],contentApproval:"Fictional browser checkpoint only.",rosterDigest:hash(programme.data.recovery.published),
    teams:teams.map(team=>({teamId:team.id,members:team.members,commanderId:mc._id,leaderId:team.members[0],kickoff:{by:mc._id,at:dates[0]},owners:Object.fromEntries(template.tasks.map(row=>[row.id,team.members["ABCDE".indexOf(row.owner)]]))})),
    gates:[],acceptances:[],assistance:{GUIDE:1,AI_PROMPT:1,MC_ONE_TO_ONE:1}};
  const id=`browser-sprint-${number}`;
  await models.PilotSprint.create({_id:id,cohortId,state:"ACTIVE",version:1,createdAt:new Date(dates[2]),data:config});
  await models.PilotTask.insertMany(teams.flatMap(team => template.tasks.map(row=>{
    const ready=number===5?row.id==="DEMO-01":number===4?row.id==="UAT-01"||row.id==="QA-13":row.id==="DB-09";
    const owner=team.members["ABCDE".indexOf(row.owner)];
    return {_id:`${id}:${team.id}:${row.id}`,cohortId,sprintId:id,teamId:team.id,userId:owner,state:ready?"Ready":"Accepted",version:1,createdAt:new Date(dates[2]),
      data:{...row,code:row.id,basic:{author:"CURRICULUM",url:evidence,version:"QA",approval:"Synthetic only"},dueAt:dates[1],originalDueAt:dates[1],dueHistory:[],
        stages:stages.map(name=>({name,state:"Complete",review:"OK",note:"Seeded prior work; not a browser action."})),
        evidence:ready?[]:[{id:`QA-${row.id}`,url:evidence,by:owner,summary:"Seeded fictional evidence for a browser checkpoint."}]}};
  })));
  await models.PilotLedger.create({_id:`${id}:help`,cohortId,sprintId:id,teamId:teams[0].id,userId:gamers[0]._id,state:"HELP_PASS",createdAt:new Date(dates[2]),data:{amount:3,reason:"Fictional browser help balance."}});
  const common={teamId:teams[0].id,reason:"Fictional browser workflow evidence only."};
  const files={
    export:{...common,commit:"b".repeat(40),sanitised:true,sourceArtifactLink:evidence,deployedTestUrl:evidence,knownDefects:[]},
    plan:{...common,startAt:"2026-12-11T03:45:00Z",assessorIds:[cc._id,cc2._id,mc._id,otherMC._id,fifth._id],policyVersion:"browser-final-plan-v1"},
    booking:{...common,userId:gamers[0]._id,voluntary:true,assessorId:cc._id,startAt:"2026-12-11T05:20:00Z"},
    bonus:{...common,userId:gamers[0]._id,voluntary:true,assessorId:cc._id,bonus:3,durationMinutes:10,environment:"ISOLATED_BRANCH",target:evidence,baseline:evidence,rollback:evidence,sharedReleaseUnchanged:true,evidence,criteria:Object.fromEntries([..."ABCDE"].map((key,i)=>[key,{earned:i<3,evidence}]))},
    profile:{...common,userId:gamers[0]._id,rubricVersion:"frozen-13-browser-v1",criteria:partB.finalFriday.passport.page1.criterion_scores.map(row=>({criterion_id:row.criterion_id,approved_score:row.max_score,evidence_refs:[evidence]})),strengths:[],gaps:[]},
    report:{...common,userId:gamers[0]._id,commit:"b".repeat(40),sanitised:true,sourceArtifactLink:evidence,deployedTestUrl:evidence,course:"Fictional MERN programme",projectId:"BROWSER-QA-APP"},
    award:{...common,userId:gamers[0]._id,category:"Systems Thinker",decision:"APPROVE",evidence},
    showcase:{...common,userId:gamers[0]._id,evidence},
    core:{...common,results:gamers.map((g,i)=>({userId:g._id,score:100-i,evidence}))},
    phase2:{...common,levelId:"P2-S1",owners:Object.fromEntries(partB.phase2.levels[0].cards.map(row=>[row.id,gamers[0]._id])),branch:evidence},
    phase2Approve:{...common,levelId:"P2-S1"},
  };
  for(const[name,value]of Object.entries(files))await writeFile(resolve(privateDir,`${name}.json`),JSON.stringify(value,null,2));
  await writeFile(resolve(dir,"fixture-disclosure.json"),JSON.stringify({base:"http://localhost:3188",stage:number,sprintId:id,teamId:teams[0].id,accounts:[cc,mc,...gamers].map(u=>({id:u._id,email:u.email,role:u.role})),seeded:"Prior sprint acceptances, prior technical cards and completed SDLC checkpoints are synthetic fixture setup. Browser actions are separately evidenced; no actual student apps or provider credentials.",clock:dates[2]},null,2));
  console.log(`STAGE ${number} READY`);
};
if (process.argv.includes("--restore") || process.argv.includes("--report-checkpoint")) {
  const saved = JSON.parse(await readFile(resolve(dir,process.argv.includes("--report-checkpoint") ? "s5-browser-final.json" : "s5-before-ui-fix.json"),"utf8"));
  for (const [name,rows] of Object.entries(saved)) for (const row of rows)
    await models[name].replaceOne({ _id:row._id },row,{upsert:true});
  await writeFile(clock,"2026-12-11T09:00:00Z");
  console.log("RESTORED OBSERVED BROWSER CHECKPOINT for post-fix retest");
} else await seedStage(3);
const child=spawn(process.execPath,["--import",pathToFileURL(resolve("scripts/part-b-browser-clock.mjs")).href,resolve("node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port","3188"],{
  windowsHide:true,stdio:["ignore","pipe","pipe"],env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,USERPROFILE:process.env.USERPROFILE,TEMP:process.env.TEMP,TMP:process.env.TMP,APPDATA:process.env.APPDATA,LOCALAPPDATA:process.env.LOCALAPPDATA,
    MONGODB_URI:process.env.MONGODB_URI,SESSION_SECRET:randomBytes(48).toString("hex"),APP_ORIGIN:"http://localhost:3188",DEMO_MODE:"false",BLOB_READ_WRITE_TOKEN:"",
    WEEK1_NOTIFICATION_WEBHOOK_URL:"",WEEK1_NOTIFICATION_WEBHOOK_TOKEN:"",WEEK1_COLLEGE_CONTACTS_JSON:"{}",CRON_SECRET:randomBytes(32).toString("hex"),
    PART_B_BROWSER_CLOCK_FILE:clock,NEXT_TELEMETRY_DISABLED:"1"}});
child.stdout.on("data",d=>process.stdout.write(d));child.stderr.on("data",d=>process.stderr.write(d));
let closing=false;
const close=async()=>{if(closing)return;closing=true;child.kill();await mongoose.disconnect();await replica.stop();process.exit(0);};
process.once("SIGINT",close);process.once("SIGTERM",close);
createInterface({input:process.stdin}).on("line",async line=>{try{
  const command=JSON.parse(line);
  if(command.stage)await seedStage(command.stage);
  if(command.clock){await writeFile(clock,command.clock);console.log("CLOCK ADVANCED");}
  if(command.files){
    const exported=await models.PilotEvent.findOne({state:"FINAL_FRIDAY_EXPORT"}).sort({createdAt:-1}).lean();
    if(exported){const payload={schema_version:"PARTB_FINAL_FRIDAY_AI_V1",run_metadata:{export_id:exported._id,source_snapshots:[{team_id:"T01",commit_sha:exported.data.commit}]},gamer_question_sets:exported.data.aliases.map(gamer_id=>({gamer_id,team_id:"T01",questions:partB.finalFriday.advisoryOutput.gamer_question_sets[0].questions})),team_reviews:[]};await writeFile(resolve(privateDir,"import.json"),JSON.stringify({teamId:teams[0].id,payload,reason:"Synthetic external advisory return for browser control verification."},null,2));}
    const advisory=await models.PilotEvent.findOne({state:"FINAL_FRIDAY_ADVISORY_IMPORTED"}).sort({createdAt:-1}).lean();
    if(advisory)await writeFile(resolve(privateDir,"review.json"),JSON.stringify({teamId:teams[0].id,advisoryId:advisory._id,questionVersion:advisory.data.version,questionSets:advisory.data.questions.map(set=>({gamer_id:set.gamerId,team_id:"T01",questions:set.questions})),reason:"Fictional MC question content review."},null,2));
    console.log("BROWSER PAYLOAD FILES READY");
  }
  if(command.snapshot){const rows={};for(const name of ["PilotSprint","PilotTask","PilotReview","PilotDaily","PilotLedger","PilotEvent","PilotPolicy"])rows[name]=await models[name].find({cohortId}).lean();await writeFile(resolve(dir,`${command.snapshot}.json`),JSON.stringify(rows,null,2));console.log("SNAPSHOT SAVED",command.snapshot);}
  if(command.stop)await close();
}catch(error){console.error(error.message);}});
console.log("BROWSER FIXTURE http://localhost:3188 — stdin JSON stage/clock/files/snapshot/stop controls");

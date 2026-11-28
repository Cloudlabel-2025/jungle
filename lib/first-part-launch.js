import {models,connect} from "./db.js";
import {cohortOf,permitted} from "./access-scope.js";
import {runProgram,event,rosterQuery} from "./week-one-store.js";
import {defaultSetup,validateSetup,localParts,fail} from "./day-one-rules.js";
import {scheduleInstant,suggestedResearchGroups} from "./day-one-setup.js";
import {researchMode,researchConfig,provisionResearch} from "./research.js";
import {prepareDay} from "./week-one-rules.js";
import {validateDayContent} from "./week-one-program-rules.js";
import {starterFlightContent} from "./flight-starter-content.js";
import {firstPartIsOpen} from "./flight-progression.js";

export async function openFirstPart(actor,body={},now=new Date()) {
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).length)fail("Open the game for your current college and cohort without overriding its settings.");
  await connect();
  const current=await models.User.findOne({_id:actor?._id,active:{$ne:false}}).lean();
  if(!current||current.role!=="CENTRE_COMMAND"||cohortOf(current)!==cohortOf(actor)||!permitted(current,"game:write"))fail("Only Centre Command with game access can open this cohort’s first part.",403);
  return runProgram(actor,"OPEN_FIRST_PART",{},now,async ctx=>{
    const user=await models.User.findOne({_id:actor._id,active:{$ne:false}}).session(ctx.session).lean();
    if(!user||user.role!=="CENTRE_COMMAND"||cohortOf(user)!==ctx.cohortId||!permitted(user,"game:write"))fail("Only Centre Command with game access can open this cohort’s first part.",403);
    if(ctx.p.locked||ctx.p.correction||ctx.p.publications?.length)fail("This cohort has published or finalised results. Opening the game must not replace its completed programme.",409);
    if(firstPartIsOpen(ctx.p))return{alreadyOpen:true};
    const players=await models.User.find(rosterQuery(ctx.cohortId)).sort({_id:1}).select("_id").session(ctx.session).lean();
    if(!players.length)fail("Add at least one player to this cohort before opening the game.",409);
    let setup=await models.DayOneSetup.findById(ctx.cohortId).session(ctx.session);
    if(setup?.champion?.releasedAt)fail("This cohort’s first-part results are already finalised.",409);
    const first=ctx.release.days[0];
    if(!first.content){
      if(await models.DayOneRecord.exists({cohortId:ctx.cohortId}).session(ctx.session))fail("Existing player work needs its original Level 1 content restored before reopening.",409);
      const base=defaultSetup(),zone=base.timeZone,day=localParts(now,zone).day;
      const original=validateSetup(researchConfig({...base,day,startTime:"00:00",endTime:"23:59",availableAt:scheduleInstant(day,"00:00",zone),officialStart:scheduleInstant(day,"00:00",zone),clockCutoff:scheduleInstant(day,"00:30",zone),closingCutoff:scheduleInstant(day,"23:59",zone),revealAfter:new Date(now.getTime()+8*86400000).toISOString(),selectionMode:researchMode,questionSelection:"PLAYER_CHOICE",bankApproval:"Built-in starter questions selected by Centre Command using Open first-part game.",researchGroups:suggestedResearchGroups(players),markingInstructions:"Review submitted evidence against the existing frozen rubric. Verify claims and retain human review before approving results.",championPrompt:"Explain a verified claim, its independent evidence and one limitation. Demonstrate your reasoning without assistance."}));
      original.version=(setup?.released?.version||0)+1;
      original.genres=original.genres.map(genre=>({...genre,version:original.version}));
      await provisionResearch(original,ctx.cohortId,ctx.session,{allowSmallGroups:true});
      original.releasedAt=ctx.at;
      prepareDay(ctx.release,1,original,user._id,ctx.at);
      first.contentSource="Built-in click-to-play research pack";
      if(!setup)setup=new models.DayOneSetup({_id:ctx.cohortId,revision:0,draft:original,versions:[]});
      setup.released=original;setup.versions.push(original);setup.markModified("released");await setup.save({session:ctx.session});
    }
    const prepared=[];
    for(const number of [2,3,4,5]){
      const day=ctx.release.days[number-1];
      if(day.content)continue;
      if(await models.WeekOneAttempt.exists({cohortId:ctx.cohortId,day:number}).session(ctx.session))fail(`Restore the original Level ${number} content before reopening existing attempts.`,409);
      const content=validateDayContent(number,starterFlightContent(number,first.content),first.content);
      content.version=(day.contentVersion||0)+1;
      prepareDay(ctx.release,number,content,user._id,ctx.at);
      day.contentSource="Built-in click-to-play mission pack; unpublished drafts retained";
      prepared.push(number);
    }
    if(first.state==="PREPARED"){first.state="OPEN";first.openedAt=ctx.at;first.openedBy=user._id;}
    ctx.p.progressionMode="COMPLETION";
    ctx.p.flightLaunch={openedAt:ctx.at,openedBy:user._id,version:1};
    if(!ctx.p.settings.compassQuestions.length)ctx.p.settings.compassQuestions=["What changed in your approach to checking claims?","Which evidence changed your conclusion?","What will you verify next?"];
    await event(ctx,"FIRST_PART_OPENED",{mode:"COMPLETION",preparedLevels:prepared,playerCount:players.length,rulesRequired:false});
    return{opened:true,mode:"COMPLETION"};
  });
}

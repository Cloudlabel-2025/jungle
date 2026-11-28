import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {connect,models} from '../lib/db.js';
import {programAction} from '../lib/week-one-program.js';
import {blankProgram} from '../lib/week-one-program-rules.js';
import {mergeDraft} from '../lib/draft-merge.js';
import {config,start,later,pack,evidenceFor} from './week-one-levels.test.mjs';

test('independent fields merge; competing answers require an explicit choice and arrays remain atomic',()=>{
 const base={answers:{frame:'original',check1:''},labState:{circuit:['claim','evidence']}};
 const mine={answers:{frame:'original',check1:'My new test'},labState:{circuit:['claim','evidence']}};
 const server={answers:{frame:'Saved frame',check1:''},labState:{circuit:['claim','evidence']}};
 const safe=mergeDraft(base,mine,server);assert.equal(safe.conflicts.length,0);assert.deepEqual(safe.value.answers,{frame:'Saved frame',check1:'My new test'});
 mine.answers.frame='My conflicting frame';const conflict=mergeDraft(base,mine,server);assert.equal(conflict.conflicts[0].field,'answers.frame');
 assert.equal(mergeDraft(base,mine,server,'server').value.answers.frame,'Saved frame');
 assert.equal(mergeDraft(base,mine,server,'server').value.answers.check1,'My new test');
 assert.equal(mergeDraft(base,mine,server,'local').value.answers.frame,'My conflicting frame');
});

test('stale Level 4 saves recover without restarting; true conflicts retain both copies and submission uses reconciled evidence',{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
 const uri=new URL(process.env.TEST_MONGODB_URI);uri.pathname='save_conflict_'+Date.now();process.env.MONGODB_URI=uri.toString();await connect();
 try{
  for(const model of Object.values(models))await model.init();
  const player={_id:'p',name:'Player',role:'GAMER',email:'p@conflict.invalid',cohortId:'alpha',hp:5,energy:3};
  await models.User.create([player,{...player,_id:'q',email:'q@conflict.invalid'}]);
  await models.Cohort.create({_id:'alpha',name:'Test',college:'Test',startDate:config.day});
  await models.WeekOneProgram.create({_id:'alpha',data:{...blankProgram(),progressionMode:'SCHEDULED'}});
  await models.WeekOneRelease.create({_id:'alpha',days:[{day:1,state:'OPEN',content:config,officialStart:config.officialStart,scheduledEnd:later(480).toISOString()},...[2,3,4,5].map(day=>({day,state:'OPEN',content:pack(day),contentVersion:1,officialStart:config.officialStart,scheduledEnd:later(480).toISOString()}))]});
  const activity=pack(4).activities[1],variant=activity.variants[0],id='p:level4';
  await models.WeekOneAttempt.create({_id:id,userId:'p',cohortId:'alpha',day:4,activityId:activity.id,version:1,data:{activity,variant,draft:{},gameState:{},extensions:[],history:[],submissions:[],startedAt:start.toISOString(),deadline:later(60).toISOString()}});
  const save=(body,actor=player)=>programAction(actor,'attempt-save',{attemptId:id,...body},later(5));
  const read=()=>models.WeekOneAttempt.findById(id).lean();
  await save({attemptVersion:1,answers:{frame:'Server frame'},gameState:{cursor:1}});
  const recovered=await save({attemptVersion:1,attemptStartedAt:start.toISOString(),baseSubmittedAt:null,draftBase:{answers:{},gameState:{}},answers:{integrate:'Local evidence'},gameState:{cursor:8,mode:'report'}});
  assert.equal(recovered.attemptVersion,3);assert.equal(recovered.mergedDraft.answers.frame,'Server frame');assert.equal(recovered.mergedDraft.answers.integrate,'Local evidence');
  assert.equal((await read()).data.startedAt,start.toISOString());assert.equal((await read()).data.deadline,later(60).toISOString());
  const base=(await read()).data.draft;
  await save({attemptVersion:3,answers:{...base,frame:'Saved newer frame'}});
  let conflict;
  await assert.rejects(save({attemptVersion:3,attemptStartedAt:start.toISOString(),draftBase:{answers:base},answers:{...base,frame:'My newer frame',check2:'My second check'}}),error=>{conflict=error.draftConflict;return error.code==='ATTEMPT_DRAFT_CONFLICT';});
  assert.equal(conflict.version,4);assert.equal(conflict.conflicts[0].local,'My newer frame');assert.equal(conflict.conflicts[0].server,'Saved newer frame');
  assert.equal((await read()).data.draft.frame,'Saved newer frame');
  await assert.rejects(save({attemptVersion:3,attemptStartedAt:'wrong-generation',draftBase:{answers:base},answers:base}),/restarted/);
  await assert.rejects(save({attemptVersion:1,attemptStartedAt:start.toISOString(),draftBase:{answers:{}},answers:{}},{...player,_id:'q'}),/not found/);
  const full={...evidenceFor(activity,variant),frame:'My newer frame'};
  await save({attemptVersion:4,answers:full});
  await programAction(player,'attempt-submit',{attemptId:id,attemptVersion:5,useSavedDraft:true,answers:{frame:'stale closure must not overwrite saved evidence'}},later(6));
  const submitted=await read();assert.equal(submitted.data.submissions.at(-1).complete,true);assert.deepEqual(submitted.data.submissions.at(-1).answers,full);
  await assert.rejects(save({attemptVersion:4,attemptStartedAt:start.toISOString(),baseSubmittedAt:null,draftBase:{answers:base},answers:full}),/submitted or restarted/);
  assert.equal((await models.User.findById('p').lean()).energy,3,'save conflicts never charge retries or reset progress');
 }finally{await mongoose.connection.dropDatabase();await mongoose.disconnect();}
});

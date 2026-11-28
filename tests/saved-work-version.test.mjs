import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

test('an older dashboard poll cannot rewind a successful draft save and strand subsequent answers',async()=>{
 const slots=[];let cursor=0;
 const hooks={useRef(value){const i=cursor++;return slots[i]||=( {current:value});},useState(value){const i=cursor++;if(!(i in slots))slots[i]=typeof value==='function'?value():value;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useEffect(){}};
 const bundle=await build({entryPoints:['components/useSavedWork.js'],bundle:true,packages:'external',platform:'node',format:'cjs',write:false,alias:{'@':resolve('.')},loader:{'.js':'jsx'}});
 const module={exports:{}},realRequire=createRequire(import.meta.url);
 new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='react'?hooks:realRequire(name),module,module.exports);
 const previousFetch=globalThis.fetch,payloads=[];
 globalThis.fetch=async(_url,options)=>{const body=JSON.parse(options.body);payloads.push(body);return{ok:true,json:async()=>({attemptVersion:body.attemptVersion+1})};};
 const render=(answers)=>{cursor=0;return module.exports.default({value:{answers},initialValue:{answers:{frame:'saved'}},initialVersion:52,enabled:true,endpoint:'/api/week1/program/attempt-save',ownerId:'p',buildBody:(value,version)=>({...value,attemptVersion:version})});};
 try{
  let work=render({frame:'saved',check2:'A second diagnostic test'});await work.flush();assert.equal(work.getVersion(),53);
  work.syncVersion(52);assert.equal(work.getVersion(),53,'a response begun before the save cannot rewind the acknowledged version');
  work=render({frame:'saved',check2:'A second diagnostic test',update:'The final crew update'});work.syncVersion(60);
  assert.equal(work.getVersion(),53,'dirty edits still retain conflict protection against other sessions');
  await work.flush();assert.equal(payloads.at(-1).attemptVersion,53);assert.equal(payloads.at(-1).answers.update,'The final crew update');
  work.syncVersion(54);assert.equal(work.getVersion(),54);
 }finally{globalThis.fetch=previousFetch;}
});

async function hookRenderer(){
 const slots=[];let cursor=0;
 const hooks={useRef(value){const i=cursor++;return slots[i]||={current:value};},useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useEffect(){}};
 const bundle=await build({entryPoints:['components/useSavedWork.js'],bundle:true,packages:'external',platform:'node',format:'cjs',write:false,alias:{'@':resolve('.')},loader:{'.js':'jsx'}});
 const module={exports:{}},req=createRequire(import.meta.url);new Function('require','module','exports',bundle.outputFiles[0].text)(name=>name==='react'?hooks:req(name),module,module.exports);
 return props=>{cursor=0;return module.exports.default(props);};
}

test('save reconciliation updates the editor and a clean submit still checks the latest saved version',async()=>{
 const render=await hookRenderer(),fetchBefore=globalThis.fetch,payloads=[];let restored;
 globalThis.fetch=async(_url,options)=>{payloads.push(JSON.parse(options.body));return{ok:true,json:async()=>({attemptVersion:9,mergedDraft:{answers:{frame:'Saved in another copy',update:'My update'},gameState:{cursor:8}}})};};
 const props={value:{answers:{frame:'Original',update:'My update'},board:{cursor:8}},initialValue:{answers:{frame:'Original',update:''},board:{cursor:1}},initialVersion:7,enabled:true,endpoint:'/api/week1/program/attempt-save',ownerId:'p',attemptStartedAt:'start',onReconciled:value=>restored=value,buildBody:(value,version)=>({answers:value.answers,gameState:value.board,attemptId:'a',attemptVersion:version})};
 try{
  let work=render(props);work.syncVersion(8);assert.equal(work.getVersion(),7,'a poll cannot advance the version without reconciling its answers');
  await work.flush();assert.equal(restored.answers.frame,'Saved in another copy');assert.equal(restored.answers.update,'My update');
  assert.deepEqual(payloads[0].draftBase.answers,props.initialValue.answers);
  work=render({...props,value:restored});await work.flush(undefined,{force:true});assert.equal(payloads.length,2,'submission checks the server even when local answers are unchanged');
 }finally{globalThis.fetch=fetchBefore;}
});

test('a real answer conflict keeps local edits and resolves without reloading the mission',async()=>{
 const render=await hookRenderer(),oldFetch=globalThis.fetch,oldWindow=globalThis.window;let event,restored;const payloads=[];
 globalThis.window={dispatchEvent:value=>{event=value;}};
 globalThis.fetch=async(_url,options)=>{payloads.push(JSON.parse(options.body));return payloads.length===1?{ok:false,json:async()=>({code:'ATTEMPT_DRAFT_CONFLICT',error:'Review both answers',draftConflict:{version:60,draft:{answers:{frame:'Server frame',update:'Original update'}},conflicts:[{field:'answers.frame',local:'My frame',server:'Server frame'}]}})}:{ok:true,json:async()=>({attemptVersion:61})};};
 const base={answers:{frame:'Original frame',update:'Original update'}},value={answers:{frame:'My frame',update:'My new update'}};
 try{
  const work=render({value,initialValue:base,initialVersion:59,enabled:true,endpoint:'/api/week1/program/attempt-save',ownerId:'p',attemptStartedAt:'start',onReconciled:value=>restored=value,buildBody:(value,version)=>({attemptId:'a',answers:value.answers,attemptVersion:version})});
  await assert.rejects(work.flush(),/Review both answers/);
  assert.equal(event.detail.ownerId,'p');assert.equal(event.detail.conflicts[0].local,'My frame');
  await event.detail.resolve('server');assert.equal(restored.answers.frame,'Server frame');assert.equal(restored.answers.update,'My new update');
  assert.equal(payloads[1].attemptVersion,60);assert.equal(payloads[1].answers.update,'My new update');assert.equal(work.getVersion(),61);
 }finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow;}
});

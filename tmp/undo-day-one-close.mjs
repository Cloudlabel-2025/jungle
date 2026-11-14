import mongoose from 'mongoose';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {models,connect,transaction} from '../lib/db.js';
try {
  await connect();
  const player=await models.User.findOne({name:/^Aarav Patel$/i}).select('_id cohortId').lean();
  if(!player)throw Error('Aarav was not found; no changes made.');
  const cohortId=player.cohortId||'alpha';
  const before=await models.WeekOneRelease.findById(cohortId).lean();
  if(!before)throw Error('Day release not found; no changes made.');
  console.log('Before:',JSON.stringify(before.days.map(d=>({day:d.day,state:d.state,closedAt:d.closedAt}))));
  if(before.days[0]?.state==='OPEN'){console.log('Day 1 is already open. No changes needed.');}
  else {
    if(before.days[0]?.state!=='CLOSED')throw Error('Day 1 is not closed; no changes made.');
    if(before.days.some(d=>d.day!==1&&d.state==='OPEN'))throw Error('Another day is open; reopening Day 1 would conflict. No changes made.');
    await writeFile(`tmp/day1-before-undo-${Date.now()}.json`,JSON.stringify(before,null,2));
    await transaction(async session=>{
      const release=await models.WeekOneRelease.findById(cohortId).session(session);
      if(release.revision!==before.revision||release.days[0]?.state!=='CLOSED'||release.days.some(d=>d.day!==1&&d.state==='OPEN'))throw Error('Release changed during the undo. No changes made.');
      const days=release.days.map(day=>({...day}));
      const closedAt=days[0].closedAt,closedBy=days[0].closedBy;
      days[0].state='OPEN';delete days[0].closedAt;delete days[0].closedBy;
      release.days=days;release.revision+=1;release.markModified('days');
      await release.save({session});
      await models.WeekOneEvent.create([{_id:randomUUID(),cohortId,actorId:'system:authorised-day1-undo',kind:'OPEN',createdAt:new Date(),details:{day:1,previousState:'CLOSED',state:'OPEN',operation:'UNDO_ACCIDENTAL_CLOSE',reason:'Restore Day 1 after accidental closure, at user request.',undoneClosedAt:closedAt,undoneClosedBy:closedBy,contentVersion:days[0].contentVersion}}],{session});
    });
    const after=await models.WeekOneRelease.findById(cohortId).lean();
    if(after.days[0].state!=='OPEN')throw Error('Reopen verification failed.');
    console.log('After:',JSON.stringify(after.days.map(d=>({day:d.day,state:d.state}))));
    console.log('Day 1 restored to OPEN. Schedule, content and player work were not modified.');
  }
} catch(e){console.error(e.message);process.exitCode=1;}
finally {await mongoose.disconnect();}

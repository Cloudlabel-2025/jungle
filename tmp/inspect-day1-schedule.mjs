import mongoose from 'mongoose';
import {models,connect} from '../lib/db.js';
await connect();
try {
 const s=await models.DayOneSetup.findById('alpha').lean();
 const r=await models.WeekOneRelease.findById('alpha').lean();
 const records=await models.DayOneRecord.find({cohortId:'alpha'}).lean();
 console.log(JSON.stringify({now:new Date().toISOString(),setupRevision:s?.revision,editVersion:s?.editVersion,champion:!!s?.champion?.releasedAt,releaseRevision:r?.revision,days:r?.days.map(d=>({day:d.day,state:d.state,scheduledEnd:d.scheduledEnd,officialStart:d.officialStart,agenda:!!d.agenda,config:d.day===1?{day:d.content?.day,startTime:d.content?.startTime,endTime:d.content?.endTime,timeZone:d.content?.timeZone,selectionMode:d.content?.selectionMode,clockCutoff:d.content?.clockCutoff}:undefined})),records:records.map(x=>({id:x._id,day:x.data?.config?.day,clockAt:x.data?.clockAt,started:!!x.data?.startedAt,submissions:x.data?.submissions?.length||0})),rules:!!(await models.WeekOneProgram.findById('alpha').lean())?.data?.rules?.length},null,2));
} finally {await mongoose.disconnect();}

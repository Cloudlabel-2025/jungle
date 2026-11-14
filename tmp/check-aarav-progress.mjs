import mongoose from 'mongoose';
import {connect,models} from '../lib/db.js';
try {
  await connect();
  const u=await models.User.findOne({name:/^Aarav Patel$/i}).select('_id name cohortId').lean();
  if(!u){console.log('Player not found');process.exitCode=1;}
  else {
    const [r,release,learner]=await Promise.all([models.DayOneRecord.findOne({userId:u._id,cohortId:u.cohortId}).lean(),models.WeekOneRelease.findById(u.cohortId).lean(),models.WeekOneLearner.findOne({userId:u._id,cohortId:u.cohortId}).lean()]);
    const d=r?.data||{};
    console.log(JSON.stringify({levelOneResult:d.levelOne?.override||d.levelOne?.automatic||null,creditedTrophies:d.levelOne?.creditedTrophies||0,creditedXp:(d.levelOne?.creditedTrophies||0)*5,transcriptCharacters:d.submissions?.at(-1)?.transcript?.length||0},null,2));
    console.log(JSON.stringify({player:u.name,dayOne:{genre:d.genreId,question:d.researchAssignment?.question?.title||d.researchAssignment?.questionId,accepted:!!d.acknowledgedAt,started:!!d.startedAt,submissions:d.submissions?.length||0,verification:d.verification,badge:d.badge},days:release?.days?.map(x=>({day:x.day,state:x.state,date:x.date})),learner:learner?.data?.days},null,2));
  }
} catch(e){console.log('Progress lookup failed: '+(e.code||e.name));process.exitCode=1;}
finally {await mongoose.disconnect();}

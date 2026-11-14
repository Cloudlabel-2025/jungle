import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { connect, models } from '../lib/db.js';
import { projectRecord } from '../lib/day-one-rules.js';
import { pipTutorial } from '../lib/pip-tutorial.js';
try {
  await connect();
  const user = await models.User.findOne({ name: /^Aarav Patel$/i }).select('_id role cohortId').lean();
  assert.ok(user, 'Aarav exists');
  const raw = await models.DayOneRecord.findOne({ userId: user._id, cohortId: user.cohortId }).lean();
  const release = await models.WeekOneRelease.findById(user.cohortId).lean();
  assert.ok(raw, 'Saved Day 1 record exists');
  const record = projectRecord(raw, 'GAMER');
  const data = { user, story: { flight: true, introComplete: true }, dayOne: { state: release.days.find(d => d.day === 1).state, records: [record] } };
  const before = JSON.stringify(raw.data);
  const step = pipTutorial(data, { missionOpen: true });
  assert.equal(JSON.stringify(raw.data), before);
  const saved = JSON.parse(JSON.stringify(data));
  assert.deepEqual(pipTutorial(saved, { missionOpen: true }), step, 'Reload resumes the same guidance');
  console.log(JSON.stringify({ player: 'Aarav Patel', savedSubmissions: record.submissions.length, verification: record.verification?.status, tutorialStep: step.id, message: step.message, readOnly: true }, null, 2));
} catch (error) {
  console.error('Saved progress check failed: ' + error.name);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }

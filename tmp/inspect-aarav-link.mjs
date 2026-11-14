import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { connect, models } from '../lib/db.js';
try {
  await connect();
  const player = await models.User.findOne({ name: /^Aarav Patel$/i }).lean();
  const record = await models.DayOneRecord.findOne({ userId: player._id, cohortId: player.cohortId }).lean();
  const submission = record?.data.submissions?.at(-1);
  const url = new URL(submission.url);
  console.log(JSON.stringify({ provider: url.hostname, pathType: url.pathname.split('/')[1], submissionAt: submission.at, question: record.data.researchAssignment?.question?.title, levelResult: record.data.levelOne?.automatic?.status || null }));
  if (url.protocol !== 'https:' || !['chatgpt.com','chat.openai.com','gemini.google.com','claude.ai','g.co','copilot.microsoft.com'].includes(url.hostname)) throw Error('Unexpected provider; inspect before requesting.');
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'CODEWILD-ResearchReader/1.0', Accept: 'text/html' } });
  const html = await response.text();
  await mkdir('.data/shared-chat-inspection', { recursive: true });
  await writeFile('.data/shared-chat-inspection/aarav.html', html);
  await writeFile('.data/shared-chat-inspection/source.json', JSON.stringify({ url: submission.url, submissionId: submission.id, playerId: player._id, cohortId: player.cohortId }));
  console.log(JSON.stringify({ status: response.status, contentType: response.headers.get('content-type'), redirect: response.headers.get('location') ? new URL(response.headers.get('location'), url).hostname : null, bytes: Buffer.byteLength(html), saved: '.data/shared-chat-inspection/aarav.html' }));
} catch (error) { console.error(error.name + ': ' + error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
const replica = await MongoMemoryReplSet.create({ binary: { version: '7.0.24' }, instanceOpts: [{ launchTimeout: 60000 }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
try {
  const child = spawn(process.execPath, ['--test', 'tests/attendance.test.mjs'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, TEST_MONGODB_URI: replica.getUri('attendance_tutorial_qa'), WEEK1_NOTIFICATION_WEBHOOK_URL: '', WEEK1_NOTIFICATION_WEBHOOK_TOKEN: '', WEEK1_COLLEGE_CONTACTS_JSON: '{}' } });
  process.exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); });
} finally { await replica.stop(); }

// Entirely synthetic databases; does not load .env.local or use application data.
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createModels } from "../lib/db.js";
import { registryModels, closeCollegeConnections } from "../lib/college-registry.js";
import { seed } from "../lib/seed.js";
import { runWithCollege } from "../lib/college-context.js";
import { hashPassword } from "../lib/password.js";
import { signToken } from "../lib/session-token.js";
import { platformModels } from "../lib/platform-auth.js";
const replica = await MongoMemoryReplSet.create({ binary: { version: "7.0.24" }, replSet: { count: 1 } });
let server, output = "", checks = 0;
const connections = [], suffix = randomUUID().replaceAll("-", "");
const port = Number(process.env.COLLEGE_TEST_PORT || 3199), base = `http://127.0.0.1:${port}`;
const password = "Synthetic-test-password-123";
try {
  process.env.MONGODB_URI = replica.getUri(`http_legacy_${suffix}`);
  process.env.TENANT_MONGODB_URI = process.env.MONGODB_URI;
  process.env.MASTER_MONGODB_URI = process.env.MONGODB_URI;
  process.env.MASTER_DB_NAME = `http_registry_${suffix}`;
  process.env.TENANCY_ENABLED = "true";
  process.env.SESSION_SECRET = "synthetic-http-college-session-secret-at-least-32-chars";
  const { College } = await registryModels(); await College.init();
  const colleges = [];
  for (const [index, slug] of ["college-for-test", "second-college"].entries()) {
    const connection = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: `http_college_${index}_${suffix}` }).asPromise();
    connections.push(connection);
    const models = createModels(connection), college = { _id: randomUUID(), name: index ? "Second College" : "College for test", slug,
      dbName: connection.name, connectionProfile: "DEFAULT", status: "ACTIVE", accessRevision: 1 };
    await College.create(college);
    await runWithCollege({ college, connection, models }, async () => {
      await seed();
      await models.Cohort.updateOne({ _id: "alpha" }, { $set: { college: college.name, currentWeek: 2 } });
      const passwordHash = await hashPassword(password);
      for (const id of ["usr_g01", "usr_mc01", "usr_cc01"]) {
        await models.User.updateOne({ _id: id }, { $set: { username: id, name: `${college.name} ${id}` } });
        await models.Credential.create({ _id: id, passwordHash, mustChangePassword: false });
      }
      if(index===0){
        await models.Cohort.create({_id:"launch",name:"Fresh flight",college:college.name,startDate:"2026-11-27",currentWeek:1});
        for(const [id,role] of [["launch-cc","CENTRE_COMMAND"],["launch-player","GAMER"]]){
          await models.User.create({_id:id,name:id,username:id,email:`${id}@http.invalid`,cohortId:"launch",role});
          await models.Credential.create({_id:id,passwordHash,mustChangePassword:false});
        }
      }
      const bytes = Buffer.from(`Private evidence for ${college.name}`), sha256 = createHash("sha256").update(bytes).digest("hex");
      await models.PilotSprint.create({ _id: "same-sprint", cohortId: "alpha", state: "DRAFT", data: { teams: [{ teamId: "team_01", commanderId: "usr_mc01", members: ["usr_g01"] }] } });
      await models.PilotEvidence.create({ _id: "same-file", cohortId: "alpha", sprintId: "same-sprint", teamId: "team_01", userId: "usr_g01", state: "READY",
        data: { provider: "MONGODB", size: bytes.length, sha256, filename: "evidence.csv", contentType: "text/csv" } });
      await models.PrivateReportFile.create({ _id: "same-file", cohortId: "alpha", bytes, sha256 });
    });
    colleges.push(college);
  }
  const env = { ...process.env, DEMO_MODE: "false", APP_ORIGIN: base, BLOB_READ_WRITE_TOKEN: "", CRON_SECRET: "", WEEK1_NOTIFICATION_WEBHOOK_URL: "", WEEK1_COLLEGE_CONTACTS_JSON: "{}" };
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "-p", String(port)], { env, windowsHide: true });
  server.stdout.on("data", bytes => output += bytes); server.stderr.on("data", bytes => output += bytes);
  let ready = false;
  for (let n = 0; n < 80; n++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, output);
  const request = async (path, { cookie, college, body, method = body ? "POST" : "GET", status = 200 } = {}) => {
    const response = await fetch(base + path, { method, redirect: "manual", headers: {
      ...(cookie ? { Cookie: cookie } : {}), ...(college ? { "x-codewild-college": college._id } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    if(Array.isArray(status)) assert.ok(status.includes(response.status),`${method} ${path}: ${response.status}`);
    else assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 250)}`);
    checks++;
    return { response, text, json: () => JSON.parse(text) };
  };
  assert.equal((await request("/api/auth/me")).json().authenticated, false);
  assert.ok((await request(`/c/${colleges[0].slug}`)).text.includes(colleges[0].name));
  await request("/api/auth/login", { body: { identifier: "usr_g01", password }, status: 400 });
  await request("/api/auth/login", { body: { collegeSlug: "unknown-college", identifier: "usr_g01", password }, status: 404 });
  await request("/api/auth/login", { body: { collegeId: "nonexistent-college", collegeSlug: colleges[0].slug, identifier: "usr_g01", password }, status: 404 });
  const sessions = [];
  const launchSessions={};
  for(const id of ["launch-cc","launch-player"]){
    const login=await request("/api/auth/login",{body:{collegeId:colleges[0]._id,identifier:id,password}});
    launchSessions[id]={college:colleges[0],cookie:login.response.headers.get("set-cookie").split(";")[0]};
  }
  await request("/api/week1/program/open-first-part",{...launchSessions["launch-player"],body:{},status:403});
  assert.equal((await request("/api/week1/program/open-first-part",{...launchSessions["launch-cc"],body:{}})).json().opened,true);
  assert.equal((await request("/api/week1/program/open-first-part",{...launchSessions["launch-cc"],body:{}})).json().alreadyOpen,true);
  const flightState=(await request("/api/state",launchSessions["launch-player"])).json();
  assert.equal(flightState.weekOneProgram.progression.mode,"COMPLETION");
  assert.equal(flightState.weekOneProgram.progression.levels[0].available,true);
  assert.equal(flightState.weekOneProgram.progression.levels[1].available,false);
  assert.deepEqual(flightState.weekOneProgram.rules,[]);
  assert.equal(flightState.playSession.state,"FREE_PLAY");
  assert.equal(flightState.playSession.attendanceRequired,false);
  await request("/api/story/flight-intro",{...launchSessions["launch-player"],body:{}});
  await request("/api/day1/clock",{...launchSessions["launch-player"],body:{}});
  await request("/api/day1/genre-offer",{...launchSessions["launch-player"],body:{}});
  await runWithCollege({college:colleges[0],connection:connections[0],models:createModels(connections[0])},async()=>{
    await createModels(connections[0]).DayOneRecord.updateOne({cohortId:"launch",userId:"launch-player"},{$push:{"data.submissions":{$each:[{id:"history-first",at:"2026-11-27T10:00:00Z",url:"https://example.invalid/first-chat",transcript:"First saved conversation"},{id:"history-revised",at:"2026-11-27T11:00:00Z",url:"https://example.invalid/revised-chat",transcript:"Revised saved conversation"}]}}});
  });
  const completeHistory=await request("/api/week1/submission-history?userId=launch-player&day=1",launchSessions["launch-cc"]);
  assert.equal(completeHistory.response.headers.get("cache-control"),"private, no-store");
  assert.equal(completeHistory.json().attempts[0].missions[0].submissions.length,2);
  await request("/api/week1/submission-history?userId=launch-player&day=1",{...launchSessions["launch-player"],status:403});
  await request("/api/week1/submission-history?userId=launch-player&day=9",{...launchSessions["launch-cc"],status:400});
  const reviewState=(await request("/api/state",launchSessions["launch-cc"])).json();
  const reviewRecord=reviewState.dayOne.records.find(record=>record.userId==="launch-player");
  const reviewBody={userId:"launch-player",members:["launch-player"],versions:{"launch-player":reviewRecord.version},operation:"result",stars:2,reason:"Verified the saved synthetic submission evidence.",reviewedEvidence:true};
  await request("/api/day1/level-result",{...launchSessions["launch-cc"],body:reviewBody});
  const notified=(await request("/api/state",launchSessions["launch-player"])).json().notifications.items.filter(notice=>notice.id.startsWith("level-review:"));
  assert.equal(notified.length,1);assert.match(notified[0].message,/Centre Command launch-cc changed your Level 1 result from incomplete to 2\/3 stars/);
  await request("/api/notifications/read",{...launchSessions["launch-player"],body:{ids:[notified[0].id]}});
  await request("/api/day1/level-result",{...launchSessions["launch-cc"],body:reviewBody,status:409});
  const readState=(await request("/api/state",launchSessions["launch-player"])).json();
  assert.equal(readState.notifications.items.find(notice=>notice.id===notified[0].id).read,true);
  assert.equal(readState.notifications.items.filter(notice=>notice.id.startsWith("level-review:")).length,1,"a stale retry cannot create a second notice");
  for (const college of colleges) for (const id of ["usr_g01", "usr_mc01", "usr_cc01"]) {
    const login = await request("/api/auth/login", { body: { collegeId: college._id, identifier: id, password } });
    const cookie = login.response.headers.get("set-cookie").split(";")[0];
    assert.equal(login.json().user.collegeId, college._id);
    const state = (await request("/api/state", { cookie, college })).json();
    assert.equal(state.college.name, college.name);
    assert.equal(state.user.name, `${college.name} ${id}`);
    if(id==="usr_cc01")await request("/api/week1/submission-history?userId=launch-player&day=1",{cookie,college,status:403});
    const page = await request(`/${id === "usr_g01" ? "gamer" : id === "usr_mc01" ? "commander" : "centre-command"}/dashboard`, { cookie });
    assert.ok(page.text.includes(college.name), "SSR carries college identity");
    const file = await request("/api/pilot/files/same-file", { cookie, college });
    assert.equal(file.text, `Private evidence for ${college.name}`);
    assert.equal(file.response.headers.get("cache-control"), "private, no-store");
    sessions.push({ college, cookie });
  }
  await Promise.all(sessions.map(async ({ college, cookie }) => {
    const state = (await request("/api/state", { college, cookie })).json();
    assert.equal(state.college.id, college._id);
  }));
  await request("/api/map/layout", { ...sessions[2], body: { revision: 0, positions: {} } });
  assert.equal(await connections[0].db.collection("maplayouts").countDocuments(), 1);
  assert.equal(await connections[1].db.collection("maplayouts").countDocuments(), 0, "write stays in selected college");
  const { cookie } = sessions[0], college = colleges[0];
  await request("/api/state", { cookie, college: colleges[1], status: 409 });
  await request("/api/notifications/read", { cookie, body: { ids: ["anything"] }, status: 409 });
  const legacy = `codewild_session=${signToken("usr_g01")}`;
  assert.equal((await request("/api/auth/me", { cookie: legacy })).json().authenticated, false);
  const suspendedCookie = sessions[3].cookie;
  await College.updateOne({ _id: colleges[1]._id }, { $set: { status: "SUSPENDED" }, $inc: { accessRevision: 1 } });
  await request("/api/state", { cookie: suspendedCookie, status: 403 });
  await request("/api/auth/login", { body: { collegeSlug: colleges[1].slug, identifier: "usr_g01", password }, status: 403 });
  await request("/api/auth/logout", { cookie: suspendedCookie, body: {} });
  await request("/api/state", { cookie, college });
  const {PlatformAdmin}=await platformModels();
  await PlatformAdmin.create({_id:"http-owner",name:"Synthetic owner",email:"owner@http.invalid",passwordHash:await hashPassword(password),mustChangePassword:false});
  const cmsLogin=await request("/api/platform/auth/login",{body:{email:"owner@http.invalid",password}});
  const cmsCookie=cmsLogin.response.headers.get("set-cookie").split(";")[0];
  const collegePath=`/api/platform/colleges/${college._id}`;
  const lifecycle=async(action)=>{
    const detail=(await request(collegePath,{cookie:cmsCookie})).json().college;
    return request(`${collegePath}/access`,{cookie:cmsCookie,body:{action,version:detail.version,accessRevision:detail.accessRevision}});
  };
  await request(collegePath,{method:"DELETE",body:{confirmationSlug:college.slug,version:1,accessRevision:1},status:401});
  await lifecycle("deactivate");
  const inactiveEntry=await request(`/c/${college.slug}`,{status:[200,404]});
  assert.ok(inactiveEntry.text.includes("Signal lost."),"streamed Next not-found UI blocks inactive entry");
  assert.ok(!inactiveEntry.text.includes('name="identifier"'),"inactive entry never renders a college sign-in form");
  for(const session of sessions.filter(row=>row.college._id===college._id)) {
    await request("/api/state",{...session,status:403});
    await request("/api/pilot/files/same-file",{...session,status:403});
  }
  await request("/api/auth/login",{body:{collegeId:college._id,identifier:"usr_g01",password},status:403});
  const blocked=(await request(collegePath,{cookie:cmsCookie})).json();assert.equal(blocked.accessBlocked,true);assert.equal(blocked.people.length,0);
  assert.ok(await connections[0].db.collection("users").countDocuments()>0);
  await lifecycle("restore");
  for(const session of sessions.filter(row=>row.college._id===college._id)) await request("/api/state",{...session,status:401});
  const restoredLogin=await request("/api/auth/login",{body:{collegeId:college._id,identifier:"usr_g01",password}});
  const restoredCookie=restoredLogin.response.headers.get("set-cookie").split(";")[0];
  await request("/api/state",{cookie:restoredCookie,college});
  const latest=(await request(collegePath,{cookie:cmsCookie})).json().college;
  await request(collegePath,{method:"DELETE",cookie:cmsCookie,body:{confirmationSlug:"wrong",version:latest.version,accessRevision:latest.accessRevision},status:400});
  await request(collegePath,{method:"DELETE",cookie:cmsCookie,body:{confirmationSlug:college.slug,version:latest.version,accessRevision:latest.accessRevision}});
  await request(collegePath,{cookie:cmsCookie,status:404});
  const removedEntry=await request(`/c/${college.slug}`,{status:[200,404]});
  assert.ok(removedEntry.text.includes("Signal lost."));
  assert.ok(!removedEntry.text.includes('name="identifier"'));
  await request("/api/state",{cookie:restoredCookie,college,status:404});
  assert.ok(!(await connections[1].db.admin().listDatabases()).databases.some(db=>db.name===college.dbName));
  assert.ok(await connections[1].db.collection("users").countDocuments()>0,"other college data survives deletion");
  console.log(JSON.stringify({ checks, passed: true, colleges: 2, rolesPerCollege: 3, syntheticOnly: true }));
} finally {
  if (server && server.exitCode === null) { server.kill(); await new Promise(resolve => server.once("exit", resolve)); }
  for (const connection of connections) await connection.close();
  await closeCollegeConnections(); await mongoose.disconnect(); await replica.stop();
}

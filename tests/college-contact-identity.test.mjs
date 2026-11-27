import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collegeContactKeys, collegeContactKeyUpdate, planCollegeContactBackfill, rethrowCollegeContactConflict } from "../lib/college-contact-identity.js";
import { registryModels, closeCollegeConnections } from "../lib/college-registry.js";
import { platformModels } from "../lib/platform-auth.js";
import { platformCreateCollege, platformUpdateCollege } from "../lib/platform-management.js";
import { provisionCollege } from "../lib/college-admin.js";

test("contact identities ignore case and formatting while preserving explicit international numbers", () => {
  const expected = {contactEmailKey:"office@example.edu",contactPhoneKey:"919876543210"};
  for (const phone of ["+91 98765 43210","0091-98765-43210","98765 43210","09876543210","91 (98765) 43210"]) {
    assert.deepEqual(collegeContactKeys({contactEmail:" OFFICE@Example.EDU ",phone,country:"India"}),expected);
  }
  assert.equal(collegeContactKeys({phone:"+1 (415) 555-0123",country:"India"}).contactPhoneKey,"14155550123");
  assert.equal(collegeContactKeys({phone:"0044 20 7946 0958",country:"UK"}).contactPhoneKey,"442079460958");
  assert.deepEqual(collegeContactKeys({contactEmail:" ",phone:""}),{});
  assert.deepEqual(collegeContactKeyUpdate({phone:"9876543210"}).$unset,{contactEmailKey:""});
  assert.deepEqual(collegeContactKeyUpdate({}).$unset,{contactEmailKey:"",contactPhoneKey:""});
});

test("backfill reports duplicate college IDs without revealing contact values", () => {
  const plan=planCollegeContactBackfill([
    {_id:"a",profile:{contactEmail:"OFFICE@example.edu",phone:"+91 9876543210"}},
    {_id:"b",profile:{contactEmail:"office@example.edu",phone:"98765-43210"}},
    {_id:"c",profile:{}},
  ]);
  assert.deepEqual(plan.conflicts,[{field:"contactEmail",collegeIds:["a","b"]},{field:"phone",collegeIds:["a","b"]}]);
  assert.ok(!JSON.stringify(plan.conflicts).includes("example.edu"));
  for (const field of ["contactEmailKey","contactPhoneKey"]) assert.throws(
    ()=>rethrowCollegeContactConflict({code:11000,keyPattern:{[field]:1}}),error=>error.status===409 && /another college/.test(error.message),
  );
});

test("CMS enforces unique contacts on create, update and provisioning retry; indexes prevent concurrent duplicates", {skip:!process.env.TEST_MONGODB_URI,timeout:120000}, async () => {
  const previous={...process.env};
  Object.assign(process.env,{MASTER_MONGODB_URI:process.env.TEST_MONGODB_URI,MASTER_DB_NAME:`contact_${randomUUID().replaceAll("-","")}`,SESSION_SECRET:"test-college-contact-secret-longer-than-32-characters"});
  try {
    const {PlatformAdmin}=await platformModels();
    await PlatformAdmin.create({_id:"owner",name:"Owner",email:"owner@example.edu",passwordHash:"unused",mustChangePassword:false});
    const {College}=await registryModels();await College.init();
    const row=(id,profile={},status="ACTIVE")=>({_id:id,name:id,slug:id,dbName:`db_${id}`,status,profile});
    await College.create(row("legacy",{contactEmail:"OFFICE@example.edu",phone:"+91 98765 43210"},"ARCHIVED"));
    await College.create({...row("other",{contactEmail:"other@example.edu",phone:"+91 87654 32109"}),...collegeContactKeys({contactEmail:"other@example.edu",phone:"+91 87654 32109"})});
    const create={name:"New college",slug:"new-college",email:"cc@example.edu",password:"test-password-123",adminName:"CC",startDate:"2027-01-04"};
    const duplicate=error=>error.status===409 && /another college/.test(error.message);
    await assert.rejects(platformCreateCollege("owner",{...create,profile:{contactEmail:" office@EXAMPLE.edu "}}),duplicate);
    await assert.rejects(platformCreateCollege("owner",{...create,profile:{phone:"9876543210"}}),duplicate);
    assert.equal(await College.countDocuments(),2,"duplicates fail before a registry or tenant database is created");
    let saved=await platformUpdateCollege("owner","other",{version:1,accessRevision:1,profile:{city:"Chennai"}});
    assert.equal(saved.profile.phone,"+91 87654 32109");
    await assert.rejects(platformUpdateCollege("owner","other",{version:saved.version,accessRevision:1,profile:{contactEmail:"Office@example.edu"}}),duplicate);
    await assert.rejects(platformUpdateCollege("owner","other",{version:saved.version,accessRevision:1,profile:{phone:"0091 98765 43210"}}),duplicate);
    saved=await platformUpdateCollege("owner","other",{version:saved.version,accessRevision:1,profile:{contactEmail:"",phone:""}});
    assert.equal(saved.profile.city,"Chennai");
    const raw=await College.collection.findOne({_id:"other"});
    assert.equal(raw.contactEmailKey,undefined);assert.equal(raw.contactPhoneKey,undefined);
    const released={contactEmail:"other@example.edu",phone:"+91 87654 32109"};
    await College.create({...row("replacement",released),...collegeContactKeys(released)});
    await College.create(row("failed",{},"FAILED"));
    await assert.rejects(provisionCollege({...create,slug:"failed",profile:{phone:"98765-43210"}}),duplicate);
    assert.equal((await College.findById("failed").lean()).status,"FAILED");
    for (const profile of [{contactEmail:"race@example.edu"},{phone:"+91 76543 21098"}]) {
      const outcomes=await Promise.allSettled(["race-a","race-b"].map(id=>College.create({...row(`${id}-${profile.phone?"phone":"email"}`,profile),...collegeContactKeys(profile)})));
      assert.equal(outcomes.filter(outcome=>outcome.status==="fulfilled").length,1);
      assert.equal(outcomes.find(outcome=>outcome.status==="rejected").reason.code,11000);
    }
    await College.create([row("empty-a"),row("empty-b")]);
    await College.collection.insertOne(row("legacy-duplicate",{contactEmail:"office@example.edu"}));
    const execute=promisify(execFile), args=["scripts/college-contacts.mjs"];
    await assert.rejects(execute(process.execPath,args,{env:process.env,windowsHide:true}),error=>error.code===1 && error.stdout.includes("legacy-duplicate") && !error.stdout.includes("office@example.edu"));
    assert.equal((await College.collection.findOne({_id:"legacy"})).contactEmailKey,undefined,"audit does not change older records");
    await College.collection.deleteOne({_id:"legacy-duplicate"});
    const beforeProfile=(await College.collection.findOne({_id:"legacy"})).profile;
    await execute(process.execPath,[...args,"--apply"],{env:process.env,windowsHide:true});
    const backfilled=await College.collection.findOne({_id:"legacy"});
    assert.equal(backfilled.contactEmailKey,"office@example.edu");
    assert.equal(backfilled.contactPhoneKey,"919876543210");
    assert.deepEqual(backfilled.profile,beforeProfile,"backfill preserves displayed contact details");
  } finally {
    const {connection}=await registryModels();await connection.dropDatabase();await closeCollegeConnections();
    for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);
  }
});

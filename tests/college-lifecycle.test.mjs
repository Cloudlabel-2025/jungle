import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {randomUUID} from "node:crypto";
import {platformCollegeAccess,platformDeleteCollege,assertCollegeDeletionTarget,collegeEvidencePaths,eraseCollegeBlobs} from "../lib/college-lifecycle.js";
import {registryModels,contextForCollege,closeCollegeConnections} from "../lib/college-registry.js";
import {platformModels} from "../lib/platform-auth.js";
import {platformCollegeDetail,platformUpdateCollege} from "../lib/platform-management.js";
import {collegeContactKeys} from "../lib/college-contact-identity.js";

test("deletion refuses shared system databases and foreign college evidence paths",()=>{
  for(const dbName of ["jungle_platform","admin","local","config","../outside",""])assert.throws(()=>assertCollegeDeletionTarget({dbName},"jungle_platform"));
  assert.doesNotThrow(()=>assertCollegeDeletionTarget({dbName:"tenant_safe"},"jungle_platform"));
  assert.deepEqual(collegeEvidencePaths({_id:"a"},[{_id:"file",cohortId:"alpha",data:{path:"codewild/a/alpha/file.pdf"}},{_id:"old",cohortId:"alpha",data:{path:"codewild/alpha/old.pdf"}}]),["codewild/a/alpha/file.pdf","codewild/alpha/old.pdf"]);
  assert.throws(()=>collegeEvidencePaths({_id:"a"},[{_id:"file",cohortId:"alpha",data:{path:"codewild/b/alpha/file.pdf"}}]));
});

test("private file cleanup deletes owned files and all pages of the college prefix",async()=>{
  const removed=[], pages=[[{pathname:"codewild/a/orphan.pdf"}],[{pathname:"codewild/a/next.pdf"}],[]];
  await eraseCollegeBlobs("a",["codewild/alpha/legacy.pdf"],{scanPrefix:true,remove:async paths=>removed.push(...paths),scan:async options=>{assert.equal(options.prefix,"codewild/a/");assert.equal(options.cursor,undefined);return{blobs:pages.shift()};}});
  assert.deepEqual(removed,["codewild/alpha/legacy.pdf","codewild/a/orphan.pdf","codewild/a/next.pdf"]);
  await assert.rejects(eraseCollegeBlobs("a",[],{scanPrefix:true,remove:async()=>assert.fail("foreign files must not be deleted"),scan:async()=>({blobs:[{pathname:"codewild/b/private.pdf"}]})}));
});

test("deactivation retains tenant data, blocks warm contexts and requires fresh sessions after restore; permanent deletion is isolated and retryable",{skip:!process.env.TEST_MONGODB_URI,timeout:120000},async()=>{
  const previous={...process.env},suffix=randomUUID().replaceAll("-","");
  Object.assign(process.env,{MASTER_MONGODB_URI:process.env.TEST_MONGODB_URI,TENANT_MONGODB_URI:process.env.TEST_MONGODB_URI,MASTER_DB_NAME:`lifecycle_${suffix}`,BLOB_READ_WRITE_TOKEN:"",TENANCY_ENABLED:"true"});
  let otherConnection;
  try {
    const {PlatformAdmin}=await platformModels();
    await PlatformAdmin.create({_id:"owner",name:"Owner",email:"owner@example.edu",passwordHash:"unused",mustChangePassword:false});
    const {College,PlatformAudit,connection}=await registryModels();await College.init();
    const profile={contactEmail:"office@example.edu",phone:"+91 9876543210"};
    const college=await College.create({_id:"college-a",name:"College A",slug:"college-a",dbName:`tenant_a_${suffix}`,status:"ACTIVE",profile,...collegeContactKeys(profile)});
    await College.create({_id:"college-b",name:"College B",slug:"college-b",dbName:`tenant_b_${suffix}`,status:"ACTIVE"});
    const a=await contextForCollege({_id:college._id}),b=await contextForCollege({_id:"college-b"});
    otherConnection=b.connection;
    await Promise.all([...Object.values(a.models),...Object.values(b.models)].map(model=>model.init()));
    for(const ctx of [a,b])await ctx.models.User.create({_id:"shared-user",name:"Learner",email:"same@example.edu",role:"GAMER"});
    await a.connection.db.collection("customtenantdata").insertOne({_id:"custom",private:"erase me"});
    const version=async()=>{const row=await College.findById("college-a").lean();return{version:row.managementVersion||1,accessRevision:row.accessRevision||1};};
    await assert.rejects(platformCollegeAccess("not-an-admin","college-a",{action:"deactivate",...await version()}),error=>error.status===401);
    await assert.rejects(platformCollegeAccess("owner","college-a",{action:"deactivate",version:9,accessRevision:9}),error=>error.status===409);
    const inactive=await platformCollegeAccess("owner","college-a",{action:"deactivate",...await version()});
    assert.equal(inactive.status,"INACTIVE");assert.equal(inactive.accessRevision,2);
    await assert.rejects(contextForCollege({_id:"college-a"}),error=>error.status===403);
    await assert.rejects(contextForCollege({slug:"college-a"},{administrative:true}),error=>error.status===403);
    assert.equal(await a.models.User.countDocuments(),1);
    const detail=await platformCollegeDetail("owner","college-a");assert.equal(detail.accessBlocked,true);assert.deepEqual(detail.people,[]);
    await assert.rejects(platformUpdateCollege("owner","college-a",{name:"Bypass",status:"ACTIVE",...await version()}),error=>error.status===409);
    const active=await platformCollegeAccess("owner","college-a",{action:"restore",...await version()});assert.equal(active.accessRevision,3);
    assert.equal(await (await contextForCollege({slug:"college-a"})).models.User.countDocuments(),1);
    await assert.rejects(platformDeleteCollege("owner","college-a",{confirmationSlug:"wrong",...await version()}),error=>error.status===400);
    assert.equal((await College.findById("college-a").lean()).status,"ACTIVE");
    await assert.rejects(platformDeleteCollege("not-an-admin","college-a",{confirmationSlug:"college-a",...await version()}),error=>error.status===401);
    await assert.rejects(platformDeleteCollege("owner","college-a",{confirmationSlug:"college-a",version:99,accessRevision:99}),error=>error.status===409);
    await a.models.PilotEvidence.create({_id:"recent-blob",cohortId:"alpha",createdAt:new Date(),data:{provider:"BLOB",path:"codewild/college-a/alpha/recent-blob.pdf"}});
    process.env.BLOB_READ_WRITE_TOKEN="test-token-never-sent-to-storage";
    const pending=await platformDeleteCollege("owner","college-a",{confirmationSlug:"college-a",...await version()});
    assert.equal(pending.pending,true);assert.ok(new Date(pending.readyAt)>new Date());
    assert.equal((await College.findById("college-a").lean()).status,"DELETING");
    process.env.BLOB_READ_WRITE_TOKEN="";
    const pendingInspect=await mongoose.createConnection(process.env.TEST_MONGODB_URI,{dbName:college.dbName}).asPromise();
    assert.equal(await pendingInspect.db.collection("users").countDocuments(),1);
    await pendingInspect.db.collection("pilotevidences").deleteOne({_id:"recent-blob"});
    await pendingInspect.db.collection("pilotevidences").insertOne({_id:"blob",cohortId:"alpha",createdAt:new Date(0),data:{path:"codewild/alpha/blob.pdf"}});
    await pendingInspect.close();
    await College.updateOne({_id:"college-a"},{$set:{"deletion.readyAt":new Date(0)}});
    await assert.rejects(platformDeleteCollege("owner","college-a",{confirmationSlug:"college-a",...await version()}),error=>error.status===503);
    assert.equal((await College.findById("college-a").lean()).status,"DELETING");
    await assert.rejects(contextForCollege({_id:"college-a"}),error=>error.status===403);
    const inspect=await mongoose.createConnection(process.env.TEST_MONGODB_URI,{dbName:college.dbName}).asPromise();
    assert.equal(await inspect.db.collection("users").countDocuments(),1,"cleanup failure does not drop the tenant");
    await inspect.db.collection("pilotevidences").deleteOne({_id:"blob"});await inspect.close();
    await connection.db.collection("recoverycases").insertOne({_id:"recovery",collegeId:"college-a",email:"private@example.edu"});
    await PlatformAudit.create({_id:"private-audit",collegeId:"college-a",detail:{email:"private@example.edu"}});
    await connection.db.collection("collegejobleases").insertOne({_id:"college-a:test",expiresAt:new Date(Date.now()+60000)});
    const running=await platformDeleteCollege("owner","college-a",{confirmationSlug:"college-a",...await version()});assert.equal(running.pending,true);
    await connection.db.collection("collegejobleases").updateOne({_id:"college-a:test"},{$set:{expiresAt:new Date(0)}});
    await College.updateOne({_id:"college-a"},{$set:{"deletion.readyAt":new Date(0)}});
    const deleted=await platformDeleteCollege("owner","college-a",{confirmationSlug:"college-a",...await version()});assert.equal(deleted.deleted,true);
    assert.equal(await College.countDocuments({_id:"college-a"}),0);
    const databases=await connection.db.admin().listDatabases();assert.ok(!databases.databases.some(db=>db.name===college.dbName));
    assert.equal(await b.models.User.countDocuments(),1,"other college with identical account IDs is untouched");
    assert.equal(await connection.db.collection("recoverycases").countDocuments({collegeId:"college-a"}),0);
    assert.equal(await PlatformAudit.countDocuments({collegeId:"college-a"}),0);
    assert.equal(await connection.db.collection("collegejobleases").countDocuments({_id:"college-a:test"}),0);
    await College.create({_id:"new-college",name:"Replacement",slug:"college-a",dbName:`replacement_${suffix}`,status:"ACTIVE",profile,...collegeContactKeys(profile)});
    await assert.rejects(contextForCollege({_id:"college-a"}),error=>error.status===404,"old sessions cannot enter a replacement college using the same slug");
  }finally{
    await otherConnection?.dropDatabase();const{connection}=await registryModels();await connection.dropDatabase();await closeCollegeConnections();
    for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);
  }
});

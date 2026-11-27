import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { del, list } from "@vercel/blob";
import { registryModels, collegeError, closeCollegeConnection } from "./college-registry.js";
import { requirePlatformAdmin } from "./platform-auth.js";

const fail = (message, status = 409) => { throw collegeError(message, status); };
function versions(body) {
  if (!Number.isInteger(body.version) || body.version < 1 || !Number.isInteger(body.accessRevision) || body.accessRevision < 1)
    fail("Reload the college before changing its access.");
  return { accessRevision: body.accessRevision, ...(body.version === 1
    ? {$or:[{managementVersion:1},{managementVersion:{$exists:false}}]} : {managementVersion:body.version}) };
}
export function assertCollegeDeletionTarget(college, masterDbName = process.env.MASTER_DB_NAME || "jungle_platform") {
  if (!college.dbName || !/^[a-zA-Z0-9_-]+$/.test(college.dbName) || [masterDbName,"admin","local","config"].includes(college.dbName))
    fail("This college has an unsafe database mapping. Its data was not deleted.");
}
export function collegeEvidencePaths(college, evidence) {
  const prefix = `codewild/${college._id}/`;
  return evidence.map(row => {
    const path = row.data?.path;
    const legacy = `codewild/${row.cohortId}/${row._id}.`;
    if (typeof path !== "string" || path.includes("..") || path.includes("%") ||
      !(path.startsWith(prefix) || path.startsWith(legacy))) fail("An evidence file has an unsafe college path. Deletion was stopped.");
    return path;
  });
}
export async function eraseCollegeBlobs(collegeId, paths, {remove=del,scan=list,scanPrefix=Boolean(process.env.BLOB_READ_WRITE_TOKEN)}={}) {
  for(let offset=0;offset<paths.length;offset+=100) await remove(paths.slice(offset,offset+100));
  if(!scanPrefix)return;
  const prefix=`codewild/${collegeId}/`;
  for(let page=0;;page++) {
    if(page>=1000) fail("File cleanup is still in progress. Retry deletion to continue.",503);
    const result=await scan({prefix,limit:1000});
    if(!result.blobs.length)break;
    if(result.blobs.some(blob=>!blob.pathname.startsWith(prefix))) fail("File storage returned an unexpected college path.");
    await remove(result.blobs.map(blob=>blob.pathname));
  }
}

export async function platformCollegeAccess(adminId, collegeId, body) {
  await requirePlatformAdmin(adminId);
  if (!["deactivate","restore"].includes(body.action)) fail("Choose deactivate or restore.",400);
  const {College,PlatformAudit,connection}=await registryModels();
  const session=await connection.startSession();
  let result;
  try { await session.withTransaction(async()=>{
    const before=await College.findById(collegeId).session(session).lean();
    if (!before) fail("College not found.",404);
    if (["PROVISIONING","FAILED","DELETING"].includes(before.status)) fail("This college cannot change access in its current state.");
    if (body.action==="restore" && before.status!=="INACTIVE") fail("Only an inactive college can be restored.");
    if (body.action==="deactivate" && before.status==="INACTIVE") fail("This college is already inactive.");
    const status=body.action==="deactivate"?"INACTIVE":"ACTIVE";
    const changed=await College.findOneAndUpdate({_id:collegeId,...versions(body)},{$set:{status,managementVersion:(before.managementVersion||1)+1},$inc:{accessRevision:1}},{session,new:true}).lean();
    if(!changed) fail("College changed elsewhere. Reload before continuing.");
    await PlatformAudit.create([{_id:randomUUID(),actor:adminId,collegeId,action:body.action==="deactivate"?"COLLEGE_DEACTIVATED":"COLLEGE_RESTORED",detail:{state:"COMPLETED"}}],{session});
    result={id:collegeId,status,version:changed.managementVersion,accessRevision:changed.accessRevision};
  }); } finally {await session.endSession();}
  return result;
}

export async function platformDeleteCollege(adminId, collegeId, body) {
  await requirePlatformAdmin(adminId);
  const {College,PlatformAudit,connection:registry}=await registryModels();
  const before=await College.findById(collegeId).lean();
  if(!before) fail("College not found.",404);
  if(body.confirmationSlug!==before.slug) fail("Type the college code exactly to confirm permanent deletion.",400);
  if(before.status==="PROVISIONING") fail("Wait for college provisioning to finish before deleting it.");
  assertCollegeDeletionTarget(before,registry.name);
  const uri=before.connectionProfile==="LEGACY"?process.env.MONGODB_URI:process.env.TENANT_MONGODB_URI||process.env.MONGODB_URI;
  if(!uri) fail("College storage is not configured.",503);
  const owner=randomUUID(), now=new Date();
  const college=await College.findOneAndUpdate({_id:collegeId,...versions(body),$and:[{$or:[{status:{$ne:"DELETING"}},{"deletion.leaseUntil":{$lte:now}},{"deletion.leaseUntil":{$exists:false}}]}]},
    {$set:{status:"DELETING",managementVersion:(before.managementVersion||1)+1,"deletion.owner":owner,"deletion.startedAt":before.deletion?.startedAt||now,"deletion.leaseUntil":new Date(now.getTime()+10*60000)},$inc:{accessRevision:1}},{new:true}).lean();
  if(!college) fail("College changed or deletion is already running. Reload before retrying.");
  let tenant;
  try {
    await closeCollegeConnection(college);
    tenant=await mongoose.createConnection(uri,{dbName:college.dbName,autoCreate:false,autoIndex:false,maxPoolSize:2,serverSelectionTimeoutMS:8000}).asPromise();
    if(tenant.name!==college.dbName || tenant.name===registry.name) fail("College database mapping changed. Deletion was stopped.");
    // Older private Blob records predate the provider field; bytesFor uses the same fallback.
    const evidence=await tenant.db.collection("pilotevidences").find({"data.provider":{$ne:"MONGODB"}},{projection:{_id:1,cohortId:1,createdAt:1,"data.path":1}}).toArray();
    const paths=collegeEvidencePaths(college,evidence);
    if(paths.length && !process.env.BLOB_READ_WRITE_TOKEN) fail("Configure private file storage access before deleting this college.",503);
    // A recently issued direct-upload token can still create an object after cleanup.
    // Keep access blocked and finish deletion only after those tokens have expired.
    const recent=evidence.some(row=>!row.createdAt || new Date(row.createdAt).getTime()+16*60000>Date.now());
    const readyAt=college.deletion?.readyAt || (recent?new Date(new Date(college.deletion.startedAt).getTime()+16*60000):null);
    if(readyAt && new Date(readyAt)>new Date()) {
      await College.updateOne({_id:collegeId,"deletion.owner":owner},{$set:{"deletion.readyAt":readyAt,"deletion.leaseUntil":new Date()}});
      return {id:collegeId,pending:true,readyAt,status:"DELETING"};
    }
    const jobPrefix=new RegExp(`^${collegeId.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}:`);
    if(await registry.db.collection("collegejobleases").findOne({_id:jobPrefix,expiresAt:{$gt:new Date()}})) {
      const readyAt=new Date(Date.now()+30000);
      await College.updateOne({_id:collegeId,"deletion.owner":owner},{$set:{"deletion.readyAt":readyAt,"deletion.leaseUntil":new Date()}});
      return {id:collegeId,pending:true,readyAt,status:"DELETING"};
    }
    await eraseCollegeBlobs(collegeId,paths);
    const held=await College.exists({_id:collegeId,status:"DELETING","deletion.owner":owner,dbName:college.dbName});
    if(!held) fail("Deletion ownership changed. Reload before retrying.");
    await tenant.dropDatabase();
    const session=await registry.startSession();
    try { await session.withTransaction(async()=>{
      await registry.db.collection("recoverycases").deleteMany({collegeId},{session});
      await registry.db.collection("collegejobleases").deleteMany({_id:jobPrefix},{session});
      await PlatformAudit.deleteMany({collegeId},{session});
      const removed=await College.deleteOne({_id:collegeId,status:"DELETING","deletion.owner":owner},{session});
      if(!removed.deletedCount) fail("Deletion ownership changed. Reload before retrying.");
      // Keep only a minimal operation receipt, without the college profile or tenant data.
      await PlatformAudit.create([{_id:randomUUID(),actor:adminId,action:"COLLEGE_PERMANENTLY_DELETED",detail:{state:"COMPLETED"}}],{session});
    }); } finally {await session.endSession();}
    return {id:collegeId,deleted:true};
  } catch(error) {
    await College.updateOne({_id:collegeId,"deletion.owner":owner},{$set:{"deletion.leaseUntil":new Date()}});
    if(error.status) throw error;
    fail("Deletion could not finish. The college remains blocked. Retry permanent deletion to continue cleanup.",503);
  } finally {await tenant?.close();}
}

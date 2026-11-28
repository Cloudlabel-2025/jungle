import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {createModels} from "../lib/db.js";
import {workspaceStateSignature} from "../lib/workspace-state-signature.js";

test("cold tenant model sets compile only requested models and retain provisioning enumeration",async()=>{
  const left=mongoose.createConnection(),right=mongoose.createConnection();
  try{
    const models=createModels(left),other=createModels(right),names=Object.keys(models);
    assert.ok(names.length>50);
    assert.equal(Object.keys(left.models).length,0);
    const user=models.User;
    assert.deepEqual(Object.keys(left.models),["User"]);
    assert.equal(models.User,user);
    assert.ok(createModels(left).User===user,"warm connections reuse the exact registered model");
    assert.ok(other.User!==user,"different college connections never share models");
    assert.ok(user.db===left);assert.ok(other.User.db===right);
    assert.ok(user.schema.indexes().some(([fields,options])=>fields.username===1&&options.unique),"username uniqueness is retained");
    const all=Object.values(models);
    assert.equal(all.length,names.length,"provisioning still enumerates and initialises every model");
    assert.equal(Object.keys(left.models).length,names.length);
    assert.equal(Object.keys(right.models).length,1,"enumerating one college cannot compile models for another");
  }finally{await left.close();await right.close();}
});

test("unchanged polls keep workspace state stable while actual progress, tenant and presence changes remain visible",()=>{
  const first={serverTime:"2026-11-28T10:00:00Z",college:{id:"alpha"},user:{_id:"p",role:"GAMER"},dayOne:{serverTime:"2026-11-28T10:00:00Z",records:[{version:1}]}};
  const later=structuredClone(first);later.serverTime="2026-11-28T10:00:10Z";later.dayOne.serverTime=later.serverTime;
  assert.equal(workspaceStateSignature(first),workspaceStateSignature(later));
  later.dayOne.records[0].version=2;assert.notEqual(workspaceStateSignature(first),workspaceStateSignature(later));
  const differentCollege={...first,college:{id:"beta"}};assert.notEqual(workspaceStateSignature(first),workspaceStateSignature(differentCollege));
  const online={...first,roster:[{_id:"other",lastSeenAt:"2026-11-28T09:59:55Z"}]};
  assert.notEqual(workspaceStateSignature(online),workspaceStateSignature({...online,serverTime:"2026-11-28T10:00:20Z"}),"the 20-second online indicator must still expire");
  assert.notEqual(workspaceStateSignature(first),workspaceStateSignature({...first,user:{...first.user,active:false}}),"account state changes are never ignored");
});

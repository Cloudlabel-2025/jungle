import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { registerModel } from "../lib/model-registry.js";

test("hot reload replaces a cached pre-V3 User schema without deleting data", () => {
  const registry = new mongoose.Mongoose();
  const old = registry.model(
    "User",
    new mongoose.Schema({ name: String }, { strict: "throw" }),
  );
  assert.equal(old.schema.path("effortLock"), undefined);
  const schema = new mongoose.Schema(
    { name: String, effortLock: { type: Number, default: 0 } },
    { strict: "throw" },
  );
  const current = registerModel(registry, "User", schema);
  assert.notEqual(current, old);
  assert.equal(current.collection.name, old.collection.name);
  assert.equal(current.schema.path("effortLock").instance, "Number");
  assert.equal(
    new current({ name: "Learner", effortLock: 1 }).validateSync(),
    undefined,
  );
  assert.throws(() => new current({ unknownField: 1 }), /strict mode/);
  assert.equal(
    registerModel(
      registry,
      "User",
      new mongoose.Schema(
        { name: String, effortLock: { type: Number, default: 0 } },
        { strict: "throw" },
      ),
    ),
    current,
  );
});

test("changed field types and indexes also invalidate the cached model", () => {
  const registry = new mongoose.Mongoose();
  const original = registerModel(
    registry,
    "Record",
    new mongoose.Schema({ value: String }),
  );
  const changed = new mongoose.Schema({ value: Number });
  changed.index({ value: 1 });
  const replacement = registerModel(registry, "Record", changed);
  assert.notEqual(replacement, original);
  assert.equal(replacement.schema.path("value").instance, "Number");
  assert.equal(replacement.schema.indexes().length, 1);
});

test(
  "MongoDB: a cached legacy schema rejects effortLock, then reload allows updates without losing the learner",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const databaseName = `codewild_schema_reload_${Date.now()}`;
    const uri = new URL(process.env.TEST_MONGODB_URI);
    uri.pathname = `/${databaseName}`;
    const registry = new mongoose.Mongoose();
    const connection = await registry
      .createConnection(uri.toString())
      .asPromise();
    try {
      const legacy = connection.model(
        "User",
        new mongoose.Schema({ _id: String, name: String }, { strict: "throw" }),
      );
      await legacy.create({ _id: "learner", name: "Preserved learner" });
      await assert.rejects(
        legacy.updateOne({ _id: "learner" }, { $inc: { effortLock: 1 } }),
        /effortLock.*not in schema/,
      );
      const current = registerModel(
        connection,
        "User",
        new mongoose.Schema(
          {
            _id: String,
            name: String,
            effortLock: { type: Number, default: 0 },
          },
          { strict: "throw" },
        ),
      );
      const result = await current.updateOne(
        { _id: "learner" },
        { $inc: { effortLock: 1 } },
      );
      assert.equal(result.modifiedCount, 1);
      const learner = await current.findById("learner").lean();
      assert.equal(learner.name, "Preserved learner");
      assert.equal(learner.effortLock, 1);
      assert.equal(await current.countDocuments(), 1);
    } finally {
      assert.equal(connection.name, databaseName);
      await connection.dropDatabase();
      await connection.close();
    }
  },
);

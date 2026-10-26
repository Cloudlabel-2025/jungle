import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { connect } from "../lib/db.js";
if (!process.argv[2])
  throw new Error(
    "Provide an absolute output file path for the private backup.",
  );
const { EJSON } = mongoose.mongo.BSON;
const digest = (documents) =>
  createHash("sha256")
    .update(
      EJSON.stringify(
        documents.sort((a, b) => String(a._id).localeCompare(String(b._id))),
      ),
    )
    .digest("hex");
let restore;
try {
  await connect();
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  const snapshot = [];
  try {
    await session.withTransaction(
      async () => {
        snapshot.length = 0;
        const names = (
          await db.listCollections({}, { nameOnly: true }).toArray()
        ).map((c) => c.name);
        for (const name of names) {
          if (name.startsWith("system.")) continue;
          snapshot.push({
            name,
            indexes: await db.collection(name).indexes(),
            documents: await db
              .collection(name)
              .find({}, { session })
              .toArray(),
          });
        }
      },
      { readConcern: { level: "snapshot" } },
    );
  } finally {
    await session.endSession();
  }
  const backup = {
    format: "codewild-logical-v1",
    createdAt: new Date(),
    sourceDatabase: db.databaseName,
    collections: snapshot,
  };
  const output = resolve(process.argv[2]);
  await writeFile(output, EJSON.stringify(backup), { flag: "wx", mode: 0o600 });
  // Read the serialized artifact back: verify a restore from the actual file.
  const { readFile } = await import("node:fs/promises");
  const saved = EJSON.parse(await readFile(output, "utf8"));
  const restoreName = `codewild_restore_verify_${randomUUID().replaceAll("-", "")}`;
  restore = mongoose.connection.useDb(restoreName, { useCache: false });
  if (
    !restore.name.startsWith("codewild_restore_verify_") ||
    restore.name === db.databaseName
  )
    throw new Error("Unsafe restore target.");
  const evidence = [];
  for (const item of saved.collections) {
    const collection = restore.collection(item.name);
    await restore.db.createCollection(item.name);
    if (item.documents.length) await collection.insertMany(item.documents);
    for (const index of item.indexes.filter((i) => i.name !== "_id_")) {
      const { key, v, ns, ...options } = index;
      await collection.createIndex(key, options);
    }
    const restored = await collection.find().toArray();
    if (digest(restored) !== digest(item.documents))
      throw new Error(`Restore content mismatch: ${item.name}`);
    evidence.push({
      collection: item.name,
      count: restored.length,
      sha256: digest(restored),
    });
  }
  await writeFile(
    `${output}.verified.json`,
    JSON.stringify(
      {
        verifiedAt: new Date(),
        restoredInto: restoreName,
        collections: evidence,
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    `Backup restored and verified across ${evidence.length} collections. Evidence: ${output}.verified.json`,
  );
} finally {
  // Only the random, explicitly validated verification database is removed.
  if (restore?.name.startsWith("codewild_restore_verify_"))
    await restore.dropDatabase();
  await mongoose.disconnect();
}

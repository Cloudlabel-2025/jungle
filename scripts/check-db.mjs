import mongoose from "mongoose";

// Use the native client so diagnostics never create collections or indexes.
let client;
try {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required in .env.local.");
  const databaseName = new URL(uri).pathname.slice(1);
  if (!databaseName)
    throw new Error("Include the application database name in MONGODB_URI (for example /codewild).");
  client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 1,
  });
  await client.connect();
  const db = client.db();
  await db.command({ ping: 1 });
  const topology = await db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== "isdbgrid")
    throw new Error("This application requires a MongoDB replica set or sharded cluster for transactions.");
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("users").findOne({}, { session, projection: { _id: 1 } });
    });
  } finally {
    await session.endSession();
  }
  console.log(`MongoDB verified: ${db.databaseName}; ping and transactional read passed. No records changed.`);
} catch (error) {
  // Driver errors can contain connection details. Report codes without secrets.
  const codes = new Set();
  function collectCodes(cause) {
    if (!cause) return;
    codes.add(cause.code || cause.name);
    if (cause.cause && cause.cause !== cause) collectCodes(cause.cause);
  }
  collectCodes(error);
  for (const server of error.reason?.servers?.values() || [])
    collectCodes(server.error);
  const reason = client
    ? `Connection/transaction check failed (${[...codes].join(", ")}). Check Atlas credentials, Network Access, DNS, and database permissions.`
    : "Set a valid MONGODB_URI with an explicit database name in .env.local.";
  console.error(reason);
  process.exitCode = 1;
} finally {
  await client?.close();
}

import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { validate } from "./fields.mjs";

const seed = Array.from({ length: 20 }, (_, index) => ({
  firstName: "Fictional",
  lastName: `Alumnus ${String.fromCharCode(65 + index)}`,
  dob: "2000-01-01",
  email: `alumnus-${index + 1}@example.invalid`,
  mobile: "+919000000000",
  address1: "1 Fictional Lane",
  address2: "",
  city: "Test City",
  state: "Test State",
  country: "India",
  postcode: "560001",
  course: "BTech",
  year: "2022",
  registration: `QA-${index + 1}`,
  status: "Seeking work",
  skill: "Testing",
  title: "",
  organisation: "",
  linkedin: "",
}));
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alumni Connect | Sprint 2 staging</title><style>
body{font:16px system-ui;margin:0;background:#f3f6f6;color:#172c29}main{max-width:850px;margin:35px auto;padding:0 18px}section,form{background:white;padding:20px;margin:16px 0;border:1px solid #cad6d2;border-radius:10px}label{display:block;margin:8px 0}input,select,button{font:inherit;padding:8px;max-width:100%}button{cursor:pointer;margin:4px}a{color:#154b41}dl{display:grid;grid-template-columns:minmax(125px,1fr) 2fr;gap:8px}dd{margin:0;overflow-wrap:anywhere}fieldset{border:0;padding:0}.error{color:#a01616}
</style><div id="root"></div><script type="module" src="/app.js"></script></html>`;

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768)
      throw Object.assign(new Error("Request too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks));
  } catch {
    throw Object.assign(new Error("Submit valid JSON."), { status: 400 });
  }
}

export async function start(port = 0, { tls } = {}) {
  const protocol = tls ? "https" : "http";
  const cookieAttributes = `HttpOnly; SameSite=Strict; Path=/${tls ? "; Secure" : ""}`;
  const {
    outputFiles: [bundle],
  } = await build({
    entryPoints: [fileURLToPath(new URL("./ui.jsx", import.meta.url))],
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const mongo = await MongoMemoryServer.create({
    binary: { version: "7.0.24" },
    instance: { ip: "127.0.0.1" },
  });
  const db = mongoose.createConnection(mongo.getUri("alumni_connect_sprint2"));
  let server;
  async function close() {
    try {
      if (server?.listening)
        await new Promise((resolve) => server.close(resolve));
      await db.close();
    } finally {
      await mongo.stop();
    }
  }
  try {
    await db.asPromise();
    const collection = db.db.collection("alumni");
    await collection.createIndex({ email: 1 }, { unique: true });
    await collection.createIndex(
      { registration: 1 },
      {
        unique: true,
        partialFilterExpression: { registration: { $gt: "" } },
      },
    );
    const createdAt = new Date();
    await collection.insertMany(
      seed.map((data, index) => ({
        ...validate(data),
        _id: `AL-QA-${String(index + 1).padStart(3, "0")}`,
        createdAt,
        modifiedAt: createdAt,
      })),
    );
    const accounts = [
      { email: "administrator@example.invalid", role: "admin" },
      { email: seed[0].email, role: "alumnus", alumniId: "AL-QA-001" },
      { email: seed[1].email, role: "alumnus", alumniId: "AL-QA-002" },
    ].map((account) => ({
      ...account,
      password: randomBytes(12).toString("base64url"),
    }));
    const sessions = new Map();
    const handle = async (req, res) => {
      const send = (status, body) => {
        res.writeHead(status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(body));
      };
      try {
        const route = new URL(req.url, "http://localhost").pathname;
        if (req.method === "GET" && ["/", "/app.js"].includes(route)) {
          res.writeHead(200, {
            "Content-Type":
              route === "/" ? "text/html; charset=utf-8" : "text/javascript",
            "Cache-Control": "no-store",
          });
          return res.end(route === "/" ? page : bundle.contents);
        }
        if (req.method === "GET" && route === "/health")
          return send(200, { status: "ready" });
        if (
          req.method !== "GET" &&
          req.headers.origin &&
          req.headers.origin !== origin()
        )
          return send(403, { error: "Use the local staging application." });
        const cookie = req.headers.cookie?.match(
          /(?:^|;\s*)alumni_qa=([a-f0-9]+)(?:;|$)/,
        )?.[1];
        const session = sessions.get(cookie);
        const viewer = session?.expires > Date.now() ? session.viewer : null;
        if (req.method === "POST" && route === "/api/login") {
          const input = await readJson(req);
          const account = accounts.find(
            (item) =>
              item.email === input?.email && item.password === input?.password,
          );
          if (!account)
            return send(401, { error: "Invalid email or password." });
          sessions.delete(cookie);
          const { password, ...identity } = account;
          const token = randomBytes(32).toString("hex");
          sessions.set(token, {
            viewer: identity,
            expires: Date.now() + 3_600_000,
          });
          res.setHeader(
            "Set-Cookie",
            `alumni_qa=${token}; ${cookieAttributes}; Max-Age=3600`,
          );
          return send(200, identity);
        }
        if (req.method === "POST" && route === "/api/logout") {
          sessions.delete(cookie);
          res.setHeader(
            "Set-Cookie",
            `alumni_qa=; ${cookieAttributes}; Max-Age=0`,
          );
          return send(200, { ok: true });
        }
        if (!viewer) return send(401, { error: "Sign in first." });
        if (req.method === "GET" && route === "/api/session")
          return send(200, viewer);
        const id = /^\/api\/alumni\/(AL-[A-Za-z0-9-]+)$/.exec(route)?.[1];
        if (req.method === "GET" && route === "/api/alumni") {
          if (viewer.role !== "admin")
            return send(403, { error: "Administrator access required." });
          return send(
            200,
            await collection
              .find({}, { projection: { firstName: 1, lastName: 1, email: 1 } })
              .sort({ _id: 1 })
              .toArray(),
          );
        }
        if (req.method === "GET" && id) {
          if (viewer.role !== "admin" && viewer.alumniId !== id)
            return send(403, { error: "You can only view your own profile." });
          const record = await collection.findOne({ _id: id });
          return record
            ? send(200, record)
            : send(404, { error: "Profile not found." });
        }
        const create = req.method === "POST" && route === "/api/alumni";
        if (create || (req.method === "PUT" && id)) {
          if (viewer.role !== "admin")
            return send(403, { error: "Administrator access required." });
          const input = await readJson(req);
          let data;
          try {
            data = validate(input);
          } catch (error) {
            return send(400, { error: error.message });
          }
          if (create) {
            const at = new Date();
            const record = {
              ...data,
              _id: `AL-${randomUUID()}`,
              createdAt: at,
              modifiedAt: at,
            };
            await collection.insertOne(record);
            return send(201, record);
          }
          const before = await collection.findOne({ _id: id });
          if (!before) return send(404, { error: "Profile not found." });
          if (
            Object.entries(data).every(([key, value]) => before[key] === value)
          )
            return send(200, before);
          const record = await collection.findOneAndUpdate(
            { _id: id, modifiedAt: before.modifiedAt },
            {
              $set: {
                ...data,
                modifiedAt: new Date(
                  Math.max(Date.now(), +before.modifiedAt + 1),
                ),
              },
            },
            { returnDocument: "after" },
          );
          return record
            ? send(200, record)
            : send(409, { error: "Profile changed. Reopen it and retry." });
        }
        return send(404, { error: "Route not found." });
      } catch (error) {
        if (error.code === 11000)
          return send(409, {
            error: "Email or registration number already exists.",
          });
        return send(error.status || 500, {
          error: error.status ? error.message : "Staging request failed.",
        });
      }
    };
    server = tls
      ? createHttpsServer(
          { key: tls.key, cert: tls.cert, minVersion: "TLSv1.2" },
          handle,
        )
      : createHttpServer(handle);
    const origin = () => `${protocol}://127.0.0.1:${server.address().port}`;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    return {
      url: origin(),
      accounts,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const staging = await start(3112);
  console.log(`Private local staging: ${staging.url}`);
  console.table(
    staging.accounts.map(({ role, email, password }) => ({
      role,
      email,
      password,
    })),
  );
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      await staging.close();
    });
}

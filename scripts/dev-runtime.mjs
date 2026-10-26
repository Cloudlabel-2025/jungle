import net from "node:net";
import { open, readFile, unlink, realpath } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";

export function appPort(args, envPort = "3000") {
  let value = envPort;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" || args[i] === "-p") value = args[++i];
    else if (args[i].startsWith("--port=")) value = args[i].slice(7);
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(
      "The development port must be an integer between 1 and 65535.",
    );
  return port;
}
export async function portInUse(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolve(false);
      else reject(error);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`Timed out checking local port ${port}.`));
    });
  });
}
// A listening port alone is not enough evidence to reuse a database.
export async function existingWorkspaceMongo(port, dbPath) {
  const client = new mongoose.mongo.MongoClient(
    `mongodb://127.0.0.1:${port}/`,
    { directConnection: true, serverSelectionTimeoutMS: 2500 },
  );
  try {
    await client.connect();
    const admin = client.db("admin");
    const options = await admin.command({ getCmdLineOpts: 1 });
    const actual = options.parsed?.storage?.dbPath;
    if (!actual)
      throw new Error(
        `MongoDB on port ${port} did not identify its data directory.`,
      );
    const normalize = (p) =>
      process.platform === "win32" ? p.toLowerCase() : p;
    if (
      normalize(await realpath(path.resolve(actual))) !==
      normalize(await realpath(dbPath))
    )
      throw new Error(
        `Port ${port} belongs to a different MongoDB data directory. Set MONGODB_URI explicitly to use your own database.`,
      );
    const hello = await admin.command({ hello: 1 });
    if (!hello.setName)
      throw new Error("The existing workspace MongoDB is not a replica set.");
    return `mongodb://127.0.0.1:${port}/codewild?replicaSet=${encodeURIComponent(hello.setName)}`;
  } finally {
    await client.close();
  }
}
export async function claimLauncher(lockPath) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      await handle.close();
      return async () => {
        try {
          const owner = JSON.parse(await readFile(lockPath, "utf8"));
          if (owner.pid === process.pid) await unlink(lockPath);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = JSON.parse(await readFile(lockPath, "utf8"));
      } catch {
        throw new Error(
          "Another development launcher is initializing. Wait a moment and retry.",
        );
      }
      if (!Number.isInteger(owner.pid) || owner.pid < 1)
        throw new Error(
          "Invalid development launcher record. Check .data/dev-launcher.lock before restarting.",
        );
      try {
        process.kill(owner.pid, 0);
      } catch (probe) {
        if (probe.code === "ESRCH") {
          try {
            await unlink(lockPath);
          } catch (removal) {
            if (removal.code !== "ENOENT") throw removal;
          }
          continue;
        }
        throw probe;
      }
      throw new Error(
        `A CODEWILD launcher is already running (PID ${owner.pid}). Use its terminal to stop it with Ctrl+C before starting another.`,
      );
    }
  }
  throw new Error("Could not acquire the development launcher lock.");
}
export async function stopNext(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const { spawn } = await import("node:child_process");
    await new Promise((resolve, reject) => {
      const killer = spawn(
        "taskkill.exe",
        ["/PID", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      killer.once("error", reject);
      killer.once("exit", resolve);
    });
  } else {
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill("SIGTERM");
    });
  }
}

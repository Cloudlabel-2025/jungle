// Start/recover the local worker without restarting the app or its saved database.
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { existingWorkspaceMongo } from "./dev-runtime.mjs";
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!process.env.MONGODB_URI)
  process.env.MONGODB_URI = await existingWorkspaceMongo(
    27019,
    fileURLToPath(new URL("../.data/mongo", import.meta.url)),
  );
const { processAttendance } = await import("./process-attendance.mjs");
const parentArg = process.argv.find((arg) => arg.startsWith("--parent="));
const parent = parentArg ? Number(parentArg.slice(9)) : null;
if (parentArg && (!Number.isInteger(parent) || parent < 1))
  throw Error("Use a valid parent process ID.");
let running = false,
  timer;
async function close() {
  clearInterval(timer);
  await mongoose.disconnect();
  process.exit(0);
}
async function tick() {
  if (running) return;
  if (parent) {
    try {
      process.kill(parent, 0);
    } catch (error) {
      if (error.code === "ESRCH") return close();
      throw error;
    }
  }
  running = true;
  try {
    await processAttendance();
  } catch {
    console.error("Attendance processing failed; check database connectivity.");
  } finally {
    running = false;
  }
}
process.once("SIGINT", close);
process.once("SIGTERM", close);
await tick();
if (process.argv.includes("--watch")) {
  timer = setInterval(tick, 15000);
  console.log(
    "Attendance and absence worker running; checks every 15 seconds.",
  );
} else await mongoose.disconnect();

import mongoose from "mongoose";
import { collegeJob } from "../lib/college-jobs.js";
import { syncAttendance } from "../lib/attendance.js";

export async function processAttendance() {
  return collegeJob("attendance", () => syncAttendance());
}
if (
  process.argv[1]?.replaceAll("\\", "/").endsWith("/process-attendance.mjs")
) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processAttendance();
    } catch {
      console.error(
        "Attendance processing failed; check database connectivity.",
      );
    } finally {
      running = false;
    }
  };
  await tick();
  if (process.argv.includes("--watch")) {
    const timer = setInterval(tick, 15000);
    const close = async () => {
      clearInterval(timer);
      await mongoose.disconnect();
      process.exit(0);
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    console.log("Attendance worker running; checks every 15 seconds.");
  } else await mongoose.disconnect();
}

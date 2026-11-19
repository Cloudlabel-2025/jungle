// Execute an existing operator script within an explicitly selected college.
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { inCollege, closeCollegeConnections } from "../lib/college-registry.js";
const [slug, filename, ...args] = process.argv.slice(2);
const scripts = resolve("scripts"), target = resolve(filename || "");
const local = relative(scripts, target);
try {
  if (!slug || !filename || local.startsWith("..") || isAbsolute(local) || !target.endsWith(".mjs"))
    throw new Error("Use: in-college.mjs <college-code> scripts/<operator-script>.mjs [arguments]");
  process.argv = [process.execPath, target, ...args];
  await inCollege(slug, () => import(pathToFileURL(target).href));
} catch (error) { console.error(error.status ? error.message : "College operator command failed."); process.exitCode = 1; }
finally { await closeCollegeConnections(); }

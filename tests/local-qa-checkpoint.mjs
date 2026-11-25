// Opt-in, fictional disposable-test state for manual localhost rehearsals.
// Credentials and local sync grants are deliberately excluded.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { models } from "../lib/db.js";
export async function localQaCheckpoint(name, now) {
  if (process.env.LOCAL_QA_CHECKPOINTS !== "fictional-disposable-only") return;
  const directory = resolve("artifacts/local-readiness");
  await mkdir(directory, { recursive: true });
  const collections = {};
  for (const key of Object.keys(models).filter(
    (k) => !["Credential", "TeamLabLocalGrant"].includes(k),
  ))
    collections[key] = await models[key].find({}).lean();
  await writeFile(
    resolve(directory, `${name}.json`),
    JSON.stringify(
      {
        disclosure:
          "Synthetic integration-test accounts and evidence. This is not the recorded first-five-level browser player.",
        now,
        collections,
      },
      null,
      2,
    ),
  );
}

import { randomUUID } from "node:crypto";
import { tenancyEnabled, collegeContext, runWithCollege } from "./college-context.js";
import { registryModels, contextForCollege } from "./college-registry.js";

export async function collegeJob(kind, work) {
  if (!tenancyEnabled() || collegeContext()) return work();
  const { College, connection } = await registryModels();
  const leases = connection.db.collection("collegejobleases");
  const results = [];
  for (const college of await College.find({ status: "ACTIVE" }).select("_id").lean()) {
    const key = `${college._id}:${kind}`, owner = randomUUID();
    let lease;
    try {
      lease = await leases.findOneAndUpdate({ _id: key, expiresAt: { $lt: new Date() } },
        { $set: { owner, expiresAt: new Date(Date.now() + 300000) } },
        { upsert: true, returnDocument: "after" });
    } catch (error) { if (error.code !== 11000) throw error; }
    if (!lease || lease.owner !== owner) continue;
    const heartbeat = setInterval(() => {
      void leases.updateOne({ _id: key, owner }, { $set: { expiresAt: new Date(Date.now() + 300000) } }).catch(() => {});
    }, 30000);
    heartbeat.unref();
    try {
      const context = await contextForCollege({ _id: college._id });
      const result = await runWithCollege(context, work);
      results.push({ collegeId: college._id, result, ...(Array.isArray(result) && result.some(r => r.error) ? { error: "College job requires attention." } : {}) });
    } catch {
      results.push({ collegeId: college._id, error: "College job failed; inspect this college's operational records." });
    } finally {
      clearInterval(heartbeat);
      await leases.deleteOne({ _id: key, owner });
    }
  }
  return results;
}

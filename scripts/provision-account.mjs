// Provision existing seeded accounts without placing passwords in command arguments.
// Read {"email":"...", "password":"..."} from secure stdin. Never prints secrets.
import mongoose from "mongoose";
import { models, connect, transaction } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
let input = "";
for await (const chunk of process.stdin) {
  input += chunk;
  if (input.length > 4096) throw new Error("Provisioning input too large.");
}
try {
  const { email, password, active } = JSON.parse(input);
  await connect();
  const user = await models.User.findOne({ email });
  if (!user)
    throw new Error("Seed the account before provisioning its credentials.");
  if (password === undefined && typeof active !== "boolean")
    throw new Error("Supply a password or an explicit active status.");
  if (password !== undefined)
    await models.Credential.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: await hashPassword(password),
          failures: 0,
          lockedUntil: null,
        },
      },
      { upsert: true, runValidators: true },
    );
  if (typeof active === "boolean")
    await transaction(async (session) => {
      await models.Cohort.updateOne(
        { _id: "alpha" },
        { $inc: { rosterVersion: 1 } },
        { session },
      );
      await models.User.updateOne(
        { _id: user._id },
        { $set: { active } },
        { session },
      );
    });
  console.log("Account credentials/access updated.");
} finally {
  input = "";
  await mongoose.disconnect();
}

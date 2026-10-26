// Explicit operator action only; ordinary seeding never resets passwords.
// Supply the requested shared password on stdin, not as a command argument.
import mongoose from "mongoose";
import { writeFile } from "node:fs/promises";
import { models, connect, transaction } from "../lib/db.js";
import { hashPassword, checkPassword } from "../lib/password.js";
import { accountEmail } from "../lib/account-email.js";
let password = "";
for await (const chunk of process.stdin) {
  password += chunk;
  if (password.length > 1024) throw new Error("Input too large.");
}
password = password.replace(/\r?\n$/, "");
try {
  await connect();
  const users = await models.User.find().sort({ _id: 1 }).lean();
  if (!users.length)
    throw new Error("No accounts found; seed the project first.");
  const accounts = users.map((u) => ({ ...u, email: accountEmail(u.name) }));
  // Gmail ignores dots, so validate uniqueness using its canonical form too.
  if (
    new Set(accounts.map((u) => u.email.replaceAll(".", ""))).size !==
    accounts.length
  )
    throw new Error("Name-based email collision; no accounts changed.");
  const hashes = await Promise.all(accounts.map(() => hashPassword(password)));
  await transaction(async (session) => {
    await models.Cohort.updateOne(
      { _id: "alpha" },
      { $inc: { rosterVersion: 1 } },
      { session },
    );
    for (let i = 0; i < accounts.length; i++) {
      const user = accounts[i];
      await models.User.updateOne(
        { _id: user._id },
        { $set: { email: user.email, active: true } },
        { session, runValidators: true },
      );
      await models.Credential.updateOne(
        { _id: user._id },
        { $set: { passwordHash: hashes[i], failures: 0, lockedUntil: null } },
        { upsert: true, session, runValidators: true },
      );
    }
  });
  for (const account of accounts) {
    const saved = await models.User.findById(account._id).lean();
    const credential = await models.Credential.findById(account._id).lean();
    if (
      saved.email !== account.email ||
      !(await checkPassword(password, credential?.passwordHash))
    )
      throw new Error(`Verification failed for ${account._id}.`);
  }
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ["Name", "Email", "Role"],
    ...accounts.map((u) => [u.name, u.email, u.role]),
  ];
  await writeFile(
    new URL("../artifacts/account-logins.csv", import.meta.url),
    rows.map((row) => row.map(quote).join(",")).join("\r\n") + "\r\n",
  );
  console.log(
    `Updated and verified ${accounts.length} accounts. Login list: artifacts/account-logins.csv. Passwords stored only as salted hashes.`,
  );
} finally {
  password = "";
  await mongoose.disconnect();
}

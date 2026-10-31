import { randomUUID } from "node:crypto";
import { models } from "./db.js";
import { hashPassword } from "./password.js";
import { fail, requiredText } from "./day-one-rules.js";
import { rosterQuery, event } from "./week-one-store.js";

export async function provision(ctx) {
  if (ctx.release.days.some((d) => ["OPEN", "CLOSED"].includes(d.state)))
    fail("Provision accounts before the cohort starts.", 409);
  const { accounts, commander, confirmCredentialReset } = ctx.body;
  if (!Array.isArray(accounts) || accounts.length !== 25 || !commander)
    fail("Supply exactly 25 Gamer accounts and one Mission Commander.");
  const rows = [
    ...accounts.map((a) => ({ ...a, role: "GAMER" })),
    { ...commander, role: "MISSION_COMMANDER" },
  ].map((a) => {
    const name = requiredText(a.name, "Account name", 2, 100),
      email = requiredText(a.email, "Email", 5, 150).toLowerCase(),
      username = requiredText(a.username, "Username", 3, 32).toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      fail("Supply valid, distinct email addresses and usernames.");
    if (
      typeof a.password !== "string" ||
      a.password.length < 8 ||
      a.password.length > 256
    )
      fail("Passwords must contain 8–256 characters.");
    return { name, email, username, password: a.password, role: a.role };
  });
  if (
    new Set(rows.map((a) => a.username)).size !== 26 ||
    new Set(rows.map((a) => a.email)).size !== 26
  )
    fail("All 26 usernames and emails must be distinct.");
  const resolved = [];
  for (const a of rows) {
    const matches = await models.User.find({
      $or: [{ email: a.email }, { username: a.username }],
    }).session(ctx.session);
    if (matches.length > 1)
      fail(
        "An email and username resolve to different existing accounts.",
        409,
      );
    const existing = matches[0];
    if (
      existing &&
      ((existing.cohortId || "alpha") !== ctx.cohortId ||
        existing.role !== a.role)
    )
      fail("An existing account belongs to another cohort or role.", 409);
    if (
      existing &&
      (await models.Credential.exists({ _id: existing._id }).session(
        ctx.session,
      )) &&
      confirmCredentialReset !== true
    )
      fail("Existing credentials require an explicit reset confirmation.", 409);
    resolved.push({ ...a, existing, id: existing?._id || randomUUID() });
  }
  const roster = await models.User.find(rosterQuery(ctx.cohortId))
    .session(ctx.session)
    .lean();
  if (roster.some((u) => !resolved.some((r) => r.id === u._id)))
    fail(
      "The cohort already contains other active Gamers. Resolve its roster before importing; no accounts were removed.",
      409,
    );
  for (const a of resolved) {
    const user =
      a.existing ||
      new models.User({
        _id: a.id,
        cohortId: ctx.cohortId,
        role: a.role,
        name: a.name,
        email: a.email,
      });
    user.name = a.name;
    user.email = a.email;
    user.username = a.username;
    user.active = true;
    await user.save({ session: ctx.session });
    await models.Credential.updateOne(
      { _id: a.id },
      {
        $set: {
          passwordHash: await hashPassword(a.password),
          failures: 0,
          lockedUntil: null,
        },
      },
      { session: ctx.session, upsert: true },
    );
  }
  await event(ctx, "COHORT_ACCOUNTS_PROVISIONED", {
    gamerIds: resolved.filter((r) => r.role === "GAMER").map((r) => r.id),
    commanderId: resolved.find((r) => r.role === "MISSION_COMMANDER").id,
    credentialsResetConfirmed: confirmCredentialReset === true,
  });
}

import { randomUUID, randomBytes } from "node:crypto";
import { models, transaction } from "./db.js";
import { hashPassword } from "./password.js";
import { characters, characterKey } from "./characters.js";
import { teamRoles } from "./team-roles.js";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const label = (value, name, min = 2, max = 80) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    fail(`${name} must contain ${min}–${max} characters.`);
  return value.trim();
};
export function validateMembers(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 5)
    fail("Add between one and five members.");
  const members = input.map((row) => {
    const username = label(row?.username, "Username", 3, 32).toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))
      fail(
        "Usernames must be 3–32 letters, numbers, dots, underscores or hyphens, starting with a letter or number.",
      );
    if (
      !characters.some((c) => c.key === row.characterKey) ||
      !["male", "female"].includes(row.variant)
    )
      fail("Choose a character and male or female version for every member.");
    if (
      typeof row.password !== "string" ||
      row.password.length < 8 ||
      row.password.length > 256
    )
      fail("Passwords must contain 8–256 characters.");
    return {
      name: label(row.name, "Member name"),
      username,
      characterKey: row.characterKey,
      variant: row.variant,
      password: row.password,
    };
  });
  if (new Set(members.map((m) => m.username)).size !== members.length)
    fail("Every member needs a different username.");
  if (new Set(members.map((m) => m.characterKey)).size !== members.length)
    fail(
      "Use a different character for each teammate. Male and female versions share one character slot.",
    );
  return members;
}
export async function teamAction(actor, action, body) {
  if (!["create", "add-members"].includes(action))
    fail("Unknown team action.", 404);
  const authorized = await models.User.findById(actor?._id).lean();
  if (authorized?.role !== "CENTRE_COMMAND" || authorized.active === false)
    fail("Only Centre Command can create teams and player accounts.", 403);
  const name = action === "create" ? label(body.name, "Team name", 3) : null;
  const members = validateMembers(body.members);
  const prepared = await Promise.all(
    members.map(async ({ password, ...member }) => ({
      ...member,
      passwordHash: await hashPassword(password),
    })),
  );
  await Promise.all([models.User.init(), models.Credential.init()]);
  try {
    return await transaction(async (session) => {
      const council = await models.User.findById(actor._id).session(session);
      if (council?.role !== "CENTRE_COMMAND" || council.active === false)
        fail("Only Centre Command can create teams and player accounts.", 403);
      const lock = await models.Cohort.updateOne(
        { _id: "alpha" },
        { $inc: { rosterVersion: 1 } },
        { session },
      );
      if (!lock.matchedCount)
        fail("Configure the cohort before creating teams.");
      let team;
      if (action === "create") {
        const existing = await models.Team.find()
          .select("name code")
          .session(session)
          .lean();
        if (
          existing.some(
            (t) =>
              t.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
          )
        )
          fail("A team with this name already exists.", 409);
        const prefix =
          name
            .replace(/[^a-z0-9]/gi, "")
            .slice(0, 3)
            .toUpperCase() || "SQD";
        let code;
        do {
          code = `${prefix}-${randomBytes(2).toString("hex").toUpperCase()}`;
        } while (existing.some((t) => t.code === code));
        [team] = await models.Team.create(
          [
            {
              _id: `team_${randomUUID()}`,
              name,
              code,
              color: characters[existing.length % characters.length].color,
            },
          ],
          { session },
        );
      } else {
        if (typeof body.teamId !== "string") fail("Select a team.");
        team = await models.Team.findById(body.teamId).session(session);
        if (!team) fail("Team not found.", 404);
      }
      const current = await models.User.find({
        teamId: team._id,
        role: "GAMER",
      })
        .session(session)
        .lean();
      if (current.length + prepared.length > 5)
        fail("A team can have at most five members.", 409);
      const taken = new Set(current.map(characterKey).filter(Boolean));
      if (prepared.some((m) => taken.has(m.characterKey)))
        fail(
          "A selected character already belongs to this team. Choose an unused character.",
          409,
        );
      const names = prepared.map((m) => m.username);
      if (
        await models.User.exists({
          $or: [
            { username: { $in: names } },
            {
              email: { $in: names.map((n) => `${n}@players.codewild.invalid`) },
            },
          ],
        }).session(session)
      )
        fail(
          "One or more usernames are already in use. Choose different usernames.",
          409,
        );
      const result = [];
      for (const member of prepared) {
        const userId = `usr_${randomUUID()}`;
        const legacyRole =
          teamRoles[characters.findIndex((c) => c.key === member.characterKey)];
        await models.User.create(
          [
            {
              _id: userId,
              name: member.name,
              username: member.username,
              email: `${member.username}@players.codewild.invalid`,
              role: "GAMER",
              teamId: team._id,
              characterKey: member.characterKey,
              characterVariant: member.variant,
              teamRoleCode: legacyRole.code,
              assignment: "Full-stack explorer",
              rewardVersion: 2,
            },
          ],
          { session },
        );
        await models.Credential.create(
          [{ _id: userId, passwordHash: member.passwordHash }],
          { session },
        );
        result.push({
          _id: userId,
          name: member.name,
          username: member.username,
          characterKey: member.characterKey,
          variant: member.variant,
        });
      }
      return {
        teamId: team._id,
        name: team.name,
        code: team.code,
        memberCount: current.length + result.length,
        members: result,
      };
    });
  } catch (error) {
    if (error.code === 11000)
      fail("A username is already in use. No accounts were added.", 409);
    throw error;
  }
}

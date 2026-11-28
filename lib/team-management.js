import { randomUUID, randomBytes } from "node:crypto";
import {cohortOf,cohortFilter,permitted} from './access-scope.js';
import { models, transaction } from "./db.js";
import { hashPassword } from "./password.js";
import { assignmentSlots } from "./team-slots.js";
import { guideOwnsTeam } from "./management-actor.js";
import { normalizeAccountUsername } from "./account-username.js";

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
    const username = normalizeAccountUsername(row?.username);
    if (row.variant !== undefined && !["male", "female"].includes(row.variant))
      fail("Invalid retired avatar style. Players create their own appearance.");
    if (
      typeof row.password !== "string" ||
      row.password.length < 8 ||
      row.password.length > 256
    )
      fail("Passwords must contain 8–256 characters.");
    return {
      name: label(row.name, "Member name"),
      username,
      password: row.password,
    };
  });
  if (new Set(members.map((m) => m.username)).size !== members.length)
    fail("Every member needs a different username.");
  return members;
}
export async function teamAction(actor, action, body) {
  if (!["create", "add-members"].includes(action))
    fail("Unknown team action.", 404);
  const authorized = await models.User.findById(actor?._id).lean();
  if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(authorized?.role) || authorized.active === false ||
      (action === "create" && authorized.role !== "CENTRE_COMMAND"))
    fail("Only Centre Command can create teams. Guides add players to their assigned teams only.", 403);
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
      if (!["CENTRE_COMMAND", "MISSION_COMMANDER"].includes(council?.role) || council.active === false ||
          (action === "create" && council.role !== "CENTRE_COMMAND"))
        fail("Only Centre Command can create teams. Guides add players to their assigned teams only.", 403);
      if(!permitted(council,'roster:write'))fail('Roster permission required.',403);
      await models.User.updateOne({ _id: council._id }, { $inc: { managementFence: 1 } }, { session });
      const lock = await models.Cohort.updateOne(
        { _id: cohortOf(council) },
        { $inc: { rosterVersion: 1 } },
        { session },
      );
      if (!lock.matchedCount)
        fail("Configure the cohort before creating teams.");
      let team;
      if (action === "create") {
        const existing = await models.Team.find(cohortFilter(council))
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
              cohortId:cohortOf(council),
              name,
              code,
              color: assignmentSlots[existing.length % assignmentSlots.length].color,
            },
          ],
          { session },
        );
      } else {
        if (typeof body.teamId !== "string") fail("Select a team.");
        team = await models.Team.findOne({$and:[cohortFilter(council),{_id:body.teamId}]}).session(session);
        if (!team) fail("Team not found.", 404);
        if (council.role === "MISSION_COMMANDER" && !guideOwnsTeam(council, team))
          fail("You can create players only in your assigned teams.", 403);
      }
      const current = await models.User.find({
        teamId: team._id,
        role: "GAMER",
      })
        .session(session)
        .lean();
      if (current.length + prepared.length > 5)
        fail("A team can have at most five members.", 409);
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
        await models.User.create(
          [
            {
              _id: userId,
              cohortId:cohortOf(council),
              name: member.name,
              username: member.username,
              email: `${member.username}@players.codewild.invalid`,
              role: "GAMER",
              teamId: team._id,
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
        });
      }
      team.version = (team.version || 1) + 1;
      await team.save({ session });
      await models.PlatformManagementEvent.create([{ _id: randomUUID(), actorId: council._id,
        action: action === "create" ? "TEAM_CREATED" : "TEAM_PLAYERS_CREATED", cohortId: cohortOf(council), teamId: team._id,
        details: { playerIds: result.map(p => p._id), actorRole: council.role } }], { session });
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

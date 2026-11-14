import { bank, version } from "./research-bank.js";
import { createEngine } from "./research-engine.js";
import { models } from "./db.js";
import { fail } from "./day-one-rules.js";

export const researchMode = "research-2026-11-12";
export function researchConfig(config) {
  const questionSelection = config.questionSelection || "PLAYER_CHOICE";
  if (!["RANDOM", "PLAYER_CHOICE"].includes(questionSelection))
    fail("Unknown research question selection policy.");
  return {
    ...config,
    questionSelection,
    bankVersion: version,
    genres: bank.flatMap((g) =>
      g.questions.map((q) => ({
        id: q.id,
        genreId: g.id,
        name: `${g.name} · ${q.title}`,
        question: q.prompt,
        version,
      })),
    ),
  };
}

export async function provisionResearch(config, cohortId, session) {
  const groups = config.researchGroups;
  const roster = await models.User.find({
    role: "GAMER",
    active: { $ne: false },
    ...(cohortId === "alpha"
      ? { $or: [{ cohortId }, { cohortId: { $exists: false } }] }
      : { cohortId }),
  })
    .session(session)
    .lean();
  if (
    !Array.isArray(groups) ||
    !groups.length ||
    groups.some(
      (g) =>
        !g ||
        !Array.isArray(g.members) ||
        g.members.length !== 5 ||
        !g.members.every((id) => typeof id === "string"),
    )
  )
    fail("Supply separate research groups with five distinct Gamer IDs each.");
  const ids = groups.flatMap((g) => g.members);
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== roster.length ||
    roster.some((u) => !ids.includes(u._id))
  )
    fail(
      "Research groups must include every active cohort Gamer exactly once.",
    );
  config.researchRoundId = `${cohortId}:day1:${config.version}`;
  config.researchGroups = groups.map((g, i) => ({
    id: `research-${i + 1}`,
    members: g.members,
  }));
  for (const group of config.researchGroups) {
    await models.ResearchSelection.create(
      [
        {
          _id: JSON.stringify([config.researchRoundId, group.id]),
          cohortId,
          roundId: config.researchRoundId,
          teamId: group.id,
          bankVersion: version,
          questionSelection: config.questionSelection,
          members: group.members,
          revision: 0,
          offers: [],
          assignments: [],
        },
      ],
      { session },
    );
  }
}

export async function selectResearch(
  config,
  userId,
  genreId,
  session,
  questionId,
) {
  const group = config.researchGroups?.find((g) => g.members.includes(userId));
  if (!group)
    fail(
      "You are not in a released research group. Contact Centre Command.",
      403,
    );
  const store = {
    async get(id) {
      const doc = await models.ResearchSelection.findById(id)
        .session(session)
        .lean();
      if (
        doc &&
        (doc.questionSelection || "RANDOM") !==
          (config.questionSelection || "RANDOM")
      )
        fail(
          "The saved research selection policy differs from this release. Contact Centre Command.",
          409,
        );
      return doc;
    },
    async compareAndSwap(id, revision, next) {
      const { _id, ...fields } = next;
      const result = await models.ResearchSelection.updateOne(
        { _id: id, revision },
        { $set: fields },
        { session },
      );
      return result.modifiedCount === 1;
    },
  };
  return createEngine(store)(
    { roundId: config.researchRoundId, teamId: group.id, playerId: userId },
    genreId,
    questionId,
  );
}

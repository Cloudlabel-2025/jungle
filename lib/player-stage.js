import { collegeContext } from "./college-context.js";
import { models, connect, transaction } from "./db.js";
import { rosterDigest } from "./recovery.js";
import { flightApiAllowed } from "./flight-rules.js";
import { experienceLevel } from "./rewards.js";

export async function playerStage(user, session = null) {
  if (user.role !== "GAMER") return { stage: "STAFF", flight: false };
  await connect();
  const cohortId = user.cohortId || "alpha";
  const queries = [
    models.Cohort.findById(cohortId).select("currentWeek").session(session).lean(),
    models.WeekOneRelease.findById(cohortId).select("_id").session(session).lean(),
    models.WeekOneProgram.findById(cohortId)
      .select("data.locked data.correction data.publications data.recovery")
      .session(session).lean(),
    models.FlightOpening.findById(JSON.stringify([cohortId, user._id]))
      .session(session)
      .lean(),
    models.CrashArrival.findById(JSON.stringify([cohortId, user._id]))
      .session(session)
      .lean(),
  ];
  // MongoDB sessions must not run parallel operations inside a transaction.
  const records = [];
  if (session) {
    for (const query of queries) records.push(await query);
  } else records.push(...(await Promise.all(queries)));
  const [cohort, release, program, receipt, arrival] = records;
  const p = program?.data,
    pub = p?.publications?.at(-1),
    r = p?.recovery;
  const team = r?.published?.teams?.find(
    (t) => Array.isArray(t?.members) && t.members.includes(user._id),
  );
  const eligible = Boolean(
    p?.locked &&
    !p.correction &&
    pub &&
    team &&
    Array.isArray(r.participants) &&
    r.published.eligibleDigest === rosterDigest(r, pub),
  );
  // Existing post-foundation accounts retain their stage. Players who boarded
  // this story must complete its transition before revealing/selecting a character.
  const crashReady = Boolean(eligible && receipt && !arrival);
  const flight = Boolean(
    ((release || program || cohort?.currentWeek === 1) && !eligible) ||
    crashReady,
  );
  return {
    stage: crashReady ? "CRASH" : flight ? "FLIGHT" : "EXPEDITION",
    flight,
    crashReady,
    crashComplete: Boolean(arrival),
    characterSelectionRequired: Boolean(
      !flight && arrival && !arrival.characterSelectedAt,
    ),
    introComplete: Boolean(receipt),
    introCompletedAt: receipt?.completedAt || null,
    ...(flight
      ? {
          reason:
            "Complete Week 1 and wait for approved results and final team publication.",
        }
      : {}),
  };
}
export function flightIdentity(user, story) {
  return {
    ...user,
    level: experienceLevel(user.xp),
    ...(story.flight || story.characterSelectionRequired
      ? {
          characterHidden: true,
          characterKey: null,
          characterVariant: null,
          avatar: null,
        }
      : { characterHidden: false }),
    ...(story.flight
      ? {
          teamId: null,
          teamRole: null,
          teamRoleCode: null,
          assignment: null,
        }
      : {}),
    story,
  };
}
export async function publicPlayer(user) {
  if (user?.mustChangePassword) return { _id: user._id, name: user.name, role: user.role, mustChangePassword: true, ...(collegeContext() ? { collegeId: collegeContext().college._id } : {}) };
  return user ? { ...flightIdentity(user, await playerStage(user)), ...(collegeContext() ? { collegeId: collegeContext().college._id } : {}) } : null;
}
export async function requireExpedition(user, session = null) {
  const story = await playerStage(user, session);
  if (story.flight)
    throw Object.assign(
      new Error(
        "This activity opens after Week 1 clearance and approved final-team publication. Return to your flight learning.",
      ),
      { status: 403 },
    );
}
export async function guardFlightApi(user, route, method) {
  const story = await playerStage(user);
  if (story.flight && !flightApiAllowed(route, method, story.introComplete))
    throw Object.assign(
      new Error(
        story.introComplete
          ? "This module is not available during your Week 1 flight."
          : "Begin your helicopter journey before starting learning activities.",
      ),
      { status: 403 },
    );
}
export async function completeFlightIntro(user, body) {
  if (user.role !== "GAMER" || user.active === false)
    throw Object.assign(new Error("An active Player account is required."), {
      status: 403,
    });
  if (Object.keys(body).length)
    throw Object.assign(
      new Error("No identity or stage overrides are accepted."),
      { status: 400 },
    );
  const story = await playerStage(user);
  if (!story.flight)
    throw Object.assign(
      new Error("The flight opening is not active for this account."),
      { status: 409 },
    );
  try {
    await models.FlightOpening.updateOne(
      { _id: JSON.stringify([user.cohortId || "alpha", user._id]) },
      {
        $setOnInsert: {
          userId: user._id,
          cohortId: user.cohortId || "alpha",
          completedAt: new Date(),
        },
      },
      { upsert: true, writeConcern: { w: "majority" } },
    );
  } catch (error) {
    // Simultaneous first welcomes may race on the same unique personal receipt.
    if (error.code !== 11000) throw error;
  }
  return { success: true };
}

export async function completeCrashArrival(user, body) {
  if (user.role !== "GAMER" || user.active === false)
    throw Object.assign(new Error("An active Player account is required."), {
      status: 403,
    });
  if (Object.keys(body).length)
    throw Object.assign(
      new Error("No identity or stage overrides are accepted."),
      { status: 400 },
    );
  return transaction(async (session) => {
    const current = await models.User.findById(user._id)
      .session(session)
      .lean();
    if (!current || current.active === false || current.role !== "GAMER")
      throw Object.assign(new Error("An active Player account is required."), {
        status: 403,
      });
    const story = await playerStage(current, session);
    if (story.crashComplete && !story.flight) return { success: true };
    if (!story.crashReady)
      throw Object.assign(
        new Error("This story transition is not available yet."),
        { status: 403 },
      );
    await models.CrashArrival.updateOne(
      { _id: JSON.stringify([current.cohortId || "alpha", current._id]) },
      {
        $setOnInsert: {
          userId: current._id,
          cohortId: current.cohortId || "alpha",
          completedAt: new Date(),
        },
      },
      { upsert: true, session },
    );
    return { success: true };
  });
}

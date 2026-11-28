import { randomInt } from "node:crypto";
import { bank, version } from "./research-bank.js";
export class SelectionError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}
const fail = (status, code, message) => {
  throw new SelectionError(status, code, message);
};
const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
// Store must provide get(id) and compareAndSwap(id, revision, next).
// Mongo implementation performs one atomic conditional update; never use process memory in production.
export function createEngine(store) {
  return async function execute(context, genreId, questionId) {
    const { roundId, teamId, playerId } = context;
    if (
      ![roundId, teamId, playerId].every(
        (x) => typeof x === "string" && x.length > 0 && x.length <= 200,
      )
    )
      fail(401, "IDENTITY", "Verified player identity required.");
    const id = JSON.stringify([roundId, teamId]);
    for (let attempt = 0; attempt < 30; attempt++) {
      const doc = await store.get(id);
      if (!doc || !doc.members.includes(playerId))
        fail(403, "MEMBERSHIP", "You are not in this team.");
      if ((doc.flexibleGroup ? doc.members.length<1||doc.members.length>5 : doc.members.length!==5) || new Set(doc.members).size !== doc.members.length)
        fail(409, "ROSTER", "A team must have five distinct players.");
      if (doc.bankVersion !== version)
        fail(
          409,
          "VERSION",
          "This round uses a different question bank. Contact your MC.",
        );
      const assigned = doc.assignments.find((x) => x.playerId === playerId);
      const playerChoice = doc.questionSelection === "PLAYER_CHOICE";
      const offerCount = playerChoice ? 7 : 5;
      if (assigned) {
        const genre = bank.find((x) => x.id === assigned.genreId);
        if (
          playerChoice &&
          genreId !== undefined &&
          genreId !== assigned.genreId
        )
          fail(
            409,
            "GENRE_LOCKED",
            "Your genre is locked. Continue with its questions.",
          );
        if (!assigned.questionId) {
          if (!playerChoice)
            fail(409, "VERSION", "This assignment needs staff review.");
          if (questionId === undefined)
            return {
              assignment: null,
              genres: [],
              selection: {
                ...assigned,
                genreName: genre.name,
                questions: genre.questions,
              },
            };
          if (!genre.questions.some((q) => q.id === questionId))
            fail(
              400,
              "QUESTION",
              "Choose one of the three questions in your locked genre.",
            );
          const next = structuredClone(doc);
          Object.assign(
            next.assignments.find((x) => x.playerId === playerId),
            { questionId, assignedAt: new Date().toISOString() },
          );
          next.revision++;
          if (await store.compareAndSwap(id, doc.revision, next))
            return execute(context);
          continue;
        }
        if (questionId !== undefined && questionId !== assigned.questionId)
          fail(
            409,
            "QUESTION_LOCKED",
            "Your confirmed question is locked for this round.",
          );
        const question = genre.questions.find(
          (x) => x.id === assigned.questionId,
        );
        return {
          assignment: { ...assigned, genreName: genre.name, question },
          genres: [],
        };
      }
      if (questionId !== undefined)
        fail(409, "GENRE_REQUIRED", "Lock a genre before choosing a question.");
      const next = structuredClone(doc);
      let offer = next.offers.find((x) => x.playerId === playerId);
      const taken = new Set(next.assignments.map((x) => x.genreId));
      if (!offer) {
        offer = { playerId, genreIds: [] };
        next.offers.push(offer);
      }
      // Keep unclaimed choices stable. Replace only choices teammates have taken.
      const stillAvailable = offer.genreIds.filter((x) => !taken.has(x));
      offer.genreIds = [
        ...stillAvailable,
        ...shuffle(
          bank
            .map((x) => x.id)
            .filter((x) => !taken.has(x) && !stillAvailable.includes(x)),
        ).slice(0, offerCount - stillAvailable.length),
      ];
      if (genreId !== undefined) {
        if (!bank.some((x) => x.id === genreId))
          fail(400, "GENRE", "Unknown genre.");
        if (taken.has(genreId))
          fail(409, "TAKEN", "A teammate picked that genre. Choose another.");
        const previousOffer = doc.offers.find((x) => x.playerId === playerId);
        if (!previousOffer?.genreIds.includes(genreId))
          fail(409, "NOT_OFFERED", "Choose one of your displayed genres.");
        const genre = bank.find((x) => x.id === genreId);
        next.assignments.push({
          playerId,
          genreId,
          ...(playerChoice
            ? { questionId: null, claimedAt: new Date().toISOString() }
            : {
                questionId: genre.questions[randomInt(3)].id,
                assignedAt: new Date().toISOString(),
              }),
        });
      }
      next.revision++;
      if (await store.compareAndSwap(id, doc.revision, next)) {
        if (genreId !== undefined) return execute(context); // Always return the committed assignment.
        return {
          assignment: null,
          genres: offer.genreIds.map((id) => ({
            id,
            name: bank.find((x) => x.id === id).name,
          })),
        };
      }
    }
    fail(503, "BUSY", "Selection is busy. Please try again.");
  };
}

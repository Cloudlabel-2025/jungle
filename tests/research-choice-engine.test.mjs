import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../lib/research-engine.js";
import { bank, version } from "../lib/research-bank.js";
function fixture() {
  const docs = new Map();
  const add = (round = "round", team = "group") =>
    docs.set(JSON.stringify([round, team]), {
      _id: JSON.stringify([round, team]),
      members: ["p1", "p2", "p3", "p4", "p5"],
      bankVersion: version,
      questionSelection: "PLAYER_CHOICE",
      revision: 0,
      offers: [],
      assignments: [],
    });
  add();
  const store = {
    async get(id) {
      return structuredClone(docs.get(id));
    },
    async compareAndSwap(id, revision, next) {
      if (docs.get(id).revision !== revision) return false;
      docs.set(id, structuredClone(next));
      return true;
    },
  };
  return {
    docs,
    add,
    engine: createEngine(store),
    ctx: (playerId = "p1") => ({ roundId: "round", teamId: "group", playerId }),
  };
}
test("choice game offers seven stable unique genre-only cards", async () => {
  const { engine, ctx } = fixture();
  const offer = await engine(ctx());
  assert.equal(offer.genres.length, 7);
  assert.equal(new Set(offer.genres.map((g) => g.id)).size, 7);
  for (const g of offer.genres)
    assert.deepEqual(Object.keys(g).sort(), ["id", "name"]);
  assert.deepEqual(await engine(ctx()), offer);
  await assert.rejects(engine(ctx(), undefined, "travel-1"), {
    code: "GENRE_REQUIRED",
  });
});
test("genre reserves immediately, exposes exactly its three questions, and cannot reroll", async () => {
  const { engine, ctx, docs } = fixture();
  const offer = await engine(ctx());
  const choice = await engine(ctx(), offer.genres[0].id);
  assert.equal(choice.assignment, null);
  assert.deepEqual(choice.genres, []);
  assert.equal(choice.selection.questions.length, 3);
  assert.deepEqual(
    choice.selection.questions,
    bank.find((g) => g.id === offer.genres[0].id).questions,
  );
  assert.deepEqual(await engine(ctx()), choice);
  assert.deepEqual(await engine(ctx(), offer.genres[0].id), choice);
  await assert.rejects(engine(ctx(), offer.genres[1].id), {
    code: "GENRE_LOCKED",
  });
  assert.equal(docs.values().next().value.assignments[0].questionId, null);
});
test("a question from another genre is rejected; confirmation is permanent and idempotent", async () => {
  const { engine, ctx } = fixture();
  const offer = await engine(ctx());
  const choice = await engine(ctx(), offer.genres[0].id);
  const other = bank.find((g) => g.id !== choice.selection.genreId).questions[0]
    .id;
  await assert.rejects(engine(ctx(), undefined, other), { code: "QUESTION" });
  const selected = choice.selection.questions[1];
  const saved = await engine(ctx(), undefined, selected.id);
  assert.equal(saved.assignment.questionId, selected.id);
  assert.deepEqual(saved.assignment.question, selected);
  assert.equal(saved.selection, undefined);
  assert.deepEqual(await engine(ctx()), saved);
  assert.deepEqual(await engine(ctx(), undefined, selected.id), saved);
  await assert.rejects(
    engine(ctx(), undefined, choice.selection.questions[0].id),
    { code: "QUESTION_LOCKED" },
  );
});
test("parallel genre claims have one winner before either question is confirmed", async () => {
  const { engine, ctx, docs } = fixture();
  const first = await engine(ctx("p1"));
  await engine(ctx("p2"));
  const doc = docs.values().next().value;
  doc.offers.find((o) => o.playerId === "p2").genreIds = first.genres.map(
    (g) => g.id,
  );
  const genre = first.genres[0].id;
  const result = await Promise.allSettled([
    engine(ctx("p1"), genre),
    engine(ctx("p2"), genre),
  ]);
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    result.find((r) => r.status === "rejected").reason.code,
    "TAKEN",
  );
  const loser = result[0].status === "rejected" ? "p1" : "p2";
  const replacement = await engine(ctx(loser));
  assert.equal(replacement.genres.length, 7);
  assert.ok(!replacement.genres.some((g) => g.id === genre));
  assert.deepEqual(replacement.genres.slice(0, 6), first.genres.slice(1));
});
test("different parallel question confirmations commit exactly once", async () => {
  const { engine, ctx, docs } = fixture();
  const offer = await engine(ctx());
  const choice = await engine(ctx(), offer.genres[0].id);
  const result = await Promise.allSettled(
    choice.selection.questions
      .slice(0, 2)
      .map((q) => engine(ctx(), undefined, q.id)),
  );
  assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    result.find((r) => r.status === "rejected").reason.code,
    "QUESTION_LOCKED",
  );
  assert.equal(docs.values().next().value.assignments.length, 1);
});
test("seven offers remain available for the fifth teammate; groups/rounds and bank version remain scoped", async () => {
  const { engine, ctx, add, docs } = fixture();
  const ids = [];
  for (let i = 1; i <= 5; i++) {
    const offer = await engine(ctx(`p${i}`));
    assert.equal(offer.genres.length, 7);
    const claim = await engine(ctx(`p${i}`), offer.genres[0].id);
    ids.push(claim.selection.genreId);
    await engine(ctx(`p${i}`), undefined, claim.selection.questions[2].id);
  }
  assert.equal(new Set(ids).size, 5);
  add("round2");
  assert.equal(
    (await engine({ ...ctx(), roundId: "round2" })).assignment,
    null,
  );
  add("round", "other");
  assert.equal((await engine({ ...ctx(), teamId: "other" })).assignment, null);
  docs.get(JSON.stringify(["round", "other"])).bankVersion = "changed";
  await assert.rejects(engine({ ...ctx(), teamId: "other" }), {
    code: "VERSION",
  });
});

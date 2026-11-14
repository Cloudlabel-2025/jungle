import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../lib/research-engine.js";
import { bank, version } from "../lib/research-bank.js";

function setup() {
  const docs = new Map();
  const members = ["p1", "p2", "p3", "p4", "p5"];
  const ctx = (playerId) => ({ roundId: "r1", teamId: "t1", playerId });
  const add = (round = "r1", team = "t1") =>
    docs.set(JSON.stringify([round, team]), {
      _id: JSON.stringify([round, team]),
      members,
      bankVersion: version,
      revision: 0,
      offers: [],
      assignments: [],
    });
  add();
  const store = {
    async get(id) {
      return structuredClone(docs.get(id));
    },
    async compareAndSwap(id, rev, next) {
      if (docs.get(id).revision !== rev) return false;
      docs.set(id, structuredClone(next));
      return true;
    },
  };
  return { docs, ctx, add, engine: createEngine(store) };
}
test("bank: 17 genres, three questions each, stable unique IDs", () => {
  assert.equal(bank.length, 17);
  assert.equal(new Set(bank.map((g) => g.id)).size, 17);
  const qs = bank.flatMap((g) => {
    assert.equal(g.questions.length, 3);
    return g.questions;
  });
  assert.equal(new Set(qs.map((q) => q.id)).size, 51);
  qs.forEach((q) => assert.ok(q.prompt && q.title));
  assert.match(
    bank.find((g) => g.id === "money").questions[0].prompt,
    /₹1,000 pocket money/,
  );
  assert.match(
    bank.find((g) => g.id === "movies").questions[0].prompt,
    /three hours/,
  );
  assert.match(
    bank.find((g) => g.id === "relationships").questions[0].prompt,
    /brings a cake/,
  );
  assert.match(
    bank.find((g) => g.id === "mysteries").questions[1].title,
    /Area 51/,
  );
});
test("five unique genres, no question leakage, stable refresh", async () => {
  const { engine, ctx } = setup();
  const a = await engine(ctx("p1"));
  assert.equal(a.genres.length, 5);
  assert.equal(new Set(a.genres.map((g) => g.id)).size, 5);
  assert.deepEqual(Object.keys(a.genres[0]).sort(), ["id", "name"]);
  assert.deepEqual(await engine(ctx("p1")), a);
});
test("assigned question survives refresh and retries; no second genre", async () => {
  const { engine, ctx } = setup();
  const a = await engine(ctx("p1"));
  const chosen = a.genres[0].id;
  const result = await engine(ctx("p1"), chosen);
  assert.equal(result.assignment.genreId, chosen);
  assert.ok(
    bank
      .find((g) => g.id === chosen)
      .questions.some((q) => q.id === result.assignment.question.id),
  );
  assert.deepEqual(await engine(ctx("p1")), result);
  assert.deepEqual(await engine(ctx("p1"), a.genres[1].id), result);
});
test("not offered, invalid genre, outsider and invalid identity rejected", async () => {
  const { engine, ctx } = setup();
  const a = await engine(ctx("p1"));
  const hidden = bank.find((g) => !a.genres.some((o) => o.id === g.id)).id;
  await assert.rejects(engine(ctx("p1"), hidden), { code: "NOT_OFFERED" });
  await assert.rejects(engine(ctx("p1"), "fake"), { code: "GENRE" });
  await assert.rejects(engine(ctx("outsider")), { status: 403 });
  await assert.rejects(engine(ctx("")), { status: 401 });
});
test("simultaneous same-genre claims: exactly one winner; loser gets replacement", async () => {
  const { engine, ctx, docs } = setup();
  await engine(ctx("p1"));
  await engine(ctx("p2"));
  // Force a shared displayed card to exercise the collision deterministically.
  const doc = docs.values().next().value;
  const genre = doc.offers[0].genreIds[0];
  doc.offers[1].genreIds = [
    genre,
    ...bank
      .map((g) => g.id)
      .filter((id) => id !== genre)
      .slice(0, 4),
  ];
  const results = await Promise.allSettled([
    engine(ctx("p1"), genre),
    engine(ctx("p2"), genre),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "TAKEN",
  );
  const loser = results[0].status === "rejected" ? "p1" : "p2";
  const fresh = await engine(ctx(loser));
  assert.equal(fresh.genres.length, 5);
  assert.ok(!fresh.genres.some((g) => g.id === genre));
});
test("five teammates receive different genres; team and round isolation", async () => {
  const { engine, ctx, add } = setup();
  const assignments = [];
  for (let i = 1; i <= 5; i++) {
    const c = ctx("p" + i),
      offer = await engine(c);
    assignments.push((await engine(c, offer.genres[0].id)).assignment);
  }
  assert.equal(new Set(assignments.map((x) => x.genreId)).size, 5);
  add("r1", "t2");
  assert.equal((await engine({ ...ctx("p1"), teamId: "t2" })).assignment, null);
  add("r2", "t1");
  assert.equal(
    (await engine({ ...ctx("p1"), roundId: "r2" })).assignment,
    null,
  );
});
test("same player double click returns one identical assignment", async () => {
  const { engine, ctx } = setup();
  const offer = await engine(ctx("p1"));
  const [a, b] = await Promise.all([
    engine(ctx("p1"), offer.genres[0].id),
    engine(ctx("p1"), offer.genres[1].id),
  ]);
  assert.deepEqual(a, b);
});

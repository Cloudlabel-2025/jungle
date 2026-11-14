// Use only with the disposable scripts/preview-day-one.mjs --research fixture.
import assert from "node:assert/strict";
import { personas } from "../lib/catalog.js";
import { bank } from "../lib/research-bank.js";
const base = "http://127.0.0.1:3101";
async function login(persona) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: persona.email }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
async function post(cookie, path, body = {}) {
  const r = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cache: r.headers.get("cache-control"),
  };
}
const players = personas.filter((p) => p.role === "GAMER");
const cookies = [];
for (const player of players) {
  const cookie = await login(player);
  assert.equal((await post(cookie, "story/flight-intro")).status, 200);
  cookies.push(cookie);
}
const offers = await Promise.all(
  cookies.map((c) => post(c, "day1/genre-offer")),
);
for (const r of offers) {
  assert.equal(r.status, 200);
  assert.match(r.cache, /private.*no-store/);
  assert.equal(
    r.data.genres.length,
    r.data.assignment || r.data.selection ? 0 : 7,
  );
  for (const g of r.data.genres)
    assert.deepEqual(Object.keys(g).sort(), ["id", "name"]);
}
// Leave browser-confirmed assignments intact; this checker can resume them.
const pendingIndex = offers.findIndex(
  (r) => !r.data.assignment && !r.data.selection,
);
if (pendingIndex >= 0) {
  const cookie = cookies[pendingIndex];
  const offer = offers[pendingIndex].data;
  assert.equal(
    (await post(cookie, "day1/question", { questionId: "travel-1" })).status,
    409,
  );
  const claim = await post(cookie, "day1/genre", {
    genreId: offer.genres[0].id,
  });
  assert.equal(claim.status, 200);
  assert.equal(claim.data.selection.questions.length, 3);
  assert.equal(claim.data.assignment, null);
  assert.deepEqual(claim.data.genres, []);
  const other = bank.find((g) => g.id !== claim.data.selection.genreId);
  assert.equal(
    (await post(cookie, "day1/genre", { genreId: other.id })).status,
    409,
  );
  assert.equal(
    (await post(cookie, "day1/question", { questionId: other.questions[0].id }))
      .status,
    400,
  );
  assert.equal((await post(cookie, "day1/acknowledge")).status, 400);
  assert.equal(
    (
      await post(cookie, "day1/question", {
        questionId: claim.data.selection.questions[0].id,
        userId: players[(pendingIndex + 1) % 25]._id,
      })
    ).status,
    400,
  );
  const relogin = await login(players[pendingIndex]);
  cookies[pendingIndex] = relogin;
  assert.deepEqual(
    (await post(relogin, "day1/genre-offer")).data.selection,
    claim.data.selection,
  );
}
const assignments = [];
for (let group = 0; group < 5; group++) {
  const selected = await Promise.all(
    cookies.slice(group * 5, group * 5 + 5).map(async (cookie) => {
      for (let retry = 0; retry < 8; retry++) {
        let r = await post(cookie, "day1/genre-offer");
        assert.equal(r.status, 200);
        if (r.data.assignment) return r.data.assignment;
        if (!r.data.selection) {
          r = await post(cookie, "day1/genre", {
            genreId: r.data.genres[0].id,
          });
          if (r.status === 409) continue;
          assert.equal(r.status, 200);
        }
        const selection = r.data.selection;
        assert.equal(selection.questions.length, 3);
        assert.deepEqual(
          selection.questions,
          bank.find((g) => g.id === selection.genreId).questions,
        );
        const question = selection.questions[1];
        const saved = await post(cookie, "day1/question", {
          questionId: question.id,
          version: -1,
        });
        assert.equal(saved.status, 200);
        assert.equal(saved.data.assignment.questionId, question.id);
        assert.equal(saved.data.selection, undefined);
        assert.equal(
          (
            await post(cookie, "day1/question", {
              questionId: question.id,
              version: -99,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await post(cookie, "day1/question", {
              questionId: selection.questions[0].id,
            })
          ).status,
          409,
        );
        return saved.data.assignment;
      }
      assert.fail("Concurrent reservations did not settle.");
    }),
  );
  assert.equal(new Set(selected.map((a) => a.genreId)).size, 5);
  assignments.push(...selected);
}
const views = await Promise.all(
  cookies.map(async (cookie, i) => {
    const saved = await post(cookie, "day1/genre-offer");
    assert.equal(saved.status, 200);
    assert.equal(saved.data.selection, undefined);
    assert.deepEqual(saved.data.assignment, assignments[i]);
    const response = await fetch(`${base}/api/day1/state`, {
      headers: { cookie },
    });
    assert.equal(response.status, 200);
    return response.json();
  }),
);
for (let i = 0; i < 25; i++) {
  const record = views[i].records[0];
  assert.equal(record.userId, players[i]._id);
  assert.equal(record.genreId, assignments[i].questionId);
  assert.equal(record.config.genres.length, 1);
  assert.equal(record.config.questionSelection, "PLAYER_CHOICE");
  for (const q of bank
    .flatMap((g) => g.questions)
    .filter((q) => q.id !== record.genreId))
    assert.ok(!JSON.stringify(views[i]).includes(q.prompt));
}
for (const role of ["MISSION_COMMANDER", "CENTRE_COMMAND"]) {
  const cookie = await login(personas.find((p) => p.role === role));
  assert.equal(
    (
      await post(cookie, "day1/question", {
        questionId: assignments[0].questionId,
      })
    ).status,
    403,
  );
}
console.log(
  "PASS: seven saved genre offers, three-question reveal only after reservation, 25 chosen/locked questions across five groups, parallel claims, reconnect/retry, forged choice rejection, privacy and staff role boundaries.",
);

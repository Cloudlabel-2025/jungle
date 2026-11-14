// Historical five-card flow: preview-day-one.mjs --research --research-random.
import assert from "node:assert/strict";
import { personas } from "../lib/catalog.js";
import { bank } from "../lib/research-bank.js";
const base = "http://127.0.0.1:3101";
const gamers = personas.filter((p) => p.role === "GAMER");
async function login(persona) {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: persona.email }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
async function request(cookie, action, body = {}, origin = base) {
  const r = await fetch(`${base}${action.startsWith("/") ? action : `/api/day1/${action}`}`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cache: r.headers.get("cache-control"),
  };
}
const cookies = [];
for (const gamer of gamers) {
  const cookie=await login(gamer);
  assert.equal((await request(cookie,"/api/story/flight-intro")).status,200);
  cookies.push(cookie);
}
const cc = await login(personas.find((p) => p.role === "CENTRE_COMMAND"));
const mc = await login(personas.find((p) => p.role === "MISSION_COMMANDER"));
assert.equal((await request("", "genre-offer")).status, 401);
assert.equal(
  (await request(cookies[0], "genre-offer", {}, "https://wrong.example"))
    .status,
  403,
);
assert.equal((await request(cookies[0], "research-bank")).status, 403);
assert.equal((await request(mc, "genre-offer")).status, 403);
const offers = await Promise.all(cookies.map((c) => request(c, "genre-offer")));
for (const offer of offers) {
  assert.equal(offer.status, 200);
  assert.equal(offer.data.genres.length, offer.data.assignment ? 0 : 5);
  assert.match(offer.cache, /private.*no-store/);
  for (const g of offer.data.genres)
    assert.deepEqual(Object.keys(g).sort(), ["id", "name"]);
}
assert.equal(
  (
    await request(cookies[0], "genre", {
      genreId: offers[0].data.assignment?.genreId || offers[0].data.genres[0].id,
      teamId: "forged",
    })
  ).status,
  400,
);
const picks = [];
// Five authenticated teammates submit together; conflicts refresh the saved offer.
for (let group = 0; group < 5; group++) {
  const result = await Promise.all(
    cookies.slice(group * 5, group * 5 + 5).map(async (cookie) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const offer = await request(cookie, "genre-offer");
        assert.equal(offer.status, 200);
        if (offer.data.assignment) return offer.data.assignment;
        const chosen = await request(cookie, "genre", {
          genreId: offer.data.genres[0].id,
        });
        if (chosen.status === 409) continue;
        assert.equal(chosen.status, 200);
        const saved = await request(cookie, "genre-offer");
        assert.equal(saved.status, 200);
        assert.ok(saved.data.assignment);
        return saved.data.assignment;
      }
      assert.fail("Selection did not settle within eight retries.");
    }),
  );
  assert.equal(new Set(result.map((a) => a.genreId)).size, 5);
  picks.push(...result);
}
await Promise.all(
  cookies.map(async (cookie, i) => {
    assert.equal(
      (
        await request(cookie, "genre", {
          genreId: "retry-after-network-error",
          version: -1,
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (await request(cookie, "genre-offer")).data.assignment,
      picks[i],
    );
  }),
);
const views = await Promise.all(
  [...cookies, mc, cc].map(async (cookie) => {
    const r = await fetch(`${base}/api/day1/state`, { headers: { cookie } });
    assert.equal(r.status, 200);
    return r.json();
  }),
);
for (let i = 0; i < 25; i++) {
  const view = views[i];
  assert.equal(view.records.length, 1);
  assert.equal(view.records[0].userId, gamers[i]._id);
  const question = view.records[0].genreId;
  assert.equal(view.records[0].config.genres.length, 1);
  assert.ok(!JSON.stringify(view).includes('"researchGroups"'));
  for (const q of bank
    .flatMap((g) => g.questions)
    .filter((q) => q.id !== question))
    assert.ok(!JSON.stringify(view).includes(q.prompt));
}
assert.equal(views[25].records.length, 25);
assert.equal(views[26].records.length, 25);
console.log(
  "PASS: 25 authenticated learners / five independent research groups; concurrent claims, durable retries, 27 scoped reads, hidden bank, role and origin protections.",
);

// Read and validate only fictional accounts in the disposable browser fixture.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:3191";
async function client(identifier) {
  const response = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ identifier, password: "Fictional-QA-2026!" }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return async () => {
    const r = await fetch(origin + "/api/state", {
      headers: { Cookie: cookie },
    });
    assert.equal(r.status, 200);
    return r.json();
  };
}
const state = await (await client("g0@pilot.invalid"))();
const style = process.argv.includes("--male") ? "male" : "female";
const pack = process.argv.includes("--pack");
const profile = process.argv.includes("--profile");
const background = process.argv.includes("--background");
assert.equal(state.user.avatar.style, style);
assert.equal(
  state.user.avatar.hair,
  background ? "long" : profile ? "wolf" : pack ? "twinTails" : style === "male" ? "fade" : "spaceBuns",
);
assert.equal(
  state.user.avatar.outfit,
  profile || background ? "sari" : pack ? "cardigan" : style === "male" ? "bomber" : "lehenga",
);
assert.equal(
  state.user.avatar.topColor,
  profile || background ? "#aa526c" : style === "male" ? "#3264c8" : "#c0a3df",
);
assert.equal(
  state.user.avatar.bottomColor,
  profile || background ? "#293a46" : style === "male" ? "#293a46" : "#ddd5e8",
);
assert.equal(state.user.avatar.accentColor, profile || background ? "#e7bd70" : "#f4f0e6");
if(background) {
  assert.equal(state.user.avatar.profileBackground, "sunset");
  assert.equal(state.user.avatar.profilePose, "classic");
}
if(profile) assert.equal(state.user.avatar.profilePose, "book");
if (pack) {
  assert.equal(state.user.avatar.hairDye, "ombre");
  assert.equal(state.user.avatar.hairAccentColor, "#426cb0");
  assert.equal(state.user.avatar.accessory, "flower");
}
assert.equal(state.user.hp, 5);
assert.equal(state.user.energy, 3);
assert.equal(state.user.trophies, 0);
for (const who of [
  "g1@pilot.invalid",
  "mc@pilot.invalid",
  "cc@pilot.invalid",
]) {
  const snapshot = await (await client(who))();
  assert.deepEqual(
    snapshot.roster.find((p) => p._id === state.user._id).avatar,
    state.user.avatar,
  );
}
console.log(
  `${style}: new hairstyle, costume and coordinated colours persisted; teammate/MC/CC visibility and unchanged balances passed.`,
);

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3191";
async function client(identifier) {
  const r = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ identifier, password: "Fictional-QA-2026!" }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  return async (path, body) =>
    fetch(origin + "/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Cookie: cookie,
        Origin: origin,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
}
const own = await client("g0@pilot.invalid");
const state = await (await own("state")).json();
assert.equal(state.user.avatar.style, "female");
assert.equal(state.user.avatar.outfit, "sari");
assert.equal(state.user.avatar.expression, "grin");
assert.equal(state.user.avatar.pose, "confident");
assert.equal(state.user.avatar.body, "balanced");
assert.equal(state.user.avatar.skin, "#da9c7c");
assert.equal(state.user.hp, 5);
assert.equal(state.user.energy, 3);
assert.equal(state.user.trophies, 0);
await writeFile(
  ".data/avatar-qa/observed-avatar.json",
  JSON.stringify(
    { avatar: state.user.avatar, avatarVersion: state.user.avatarVersion },
    null,
    2,
  ),
);
for (const who of [
  "g1@pilot.invalid",
  "mc@pilot.invalid",
  "cc@pilot.invalid",
]) {
  const api = await client(who);
  const snapshot = await (await api("state")).json();
  const other = snapshot.roster.find((p) => p._id === state.user._id);
  assert.deepEqual(other.avatar, state.user.avatar);
  console.log(who + ": saved personal avatar visible in scoped roster");
  if (who.startsWith("mc") || who.startsWith("cc"))
    assert.equal(
      (await api("gamer/character", { avatar: state.user.avatar, version: 0 }))
        .status,
      403,
    );
}
assert.equal(
  (await own("gamer/character", { avatar: state.user.avatar, version: 0 }))
    .status,
  409,
);
assert.equal(
  (
    await own("gamer/character", {
      avatar: { ...state.user.avatar, photo: "data:image/jpeg,not-accepted" },
      version: state.user.avatarVersion,
    })
  ).status,
  400,
);
const html = await fetch(origin + "/gamer/dashboard");
assert.ok(html.headers.get("permissions-policy").includes("camera=(self)"));
console.log(
  "Avatar reload, proportions, team/MC/CC visibility, ownership, stale save, photo rejection, unchanged balances and camera policy passed.",
);
const model = await fetch(origin + "/models/face_landmarker.task");
assert.equal(model.status, 200);
assert.equal(Number(model.headers.get("content-length")), 3758596);
for (const asset of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"]) {
  const response = await fetch(origin + "/vendor/face/wasm/" + asset, {method:"HEAD"});
  assert.equal(response.status, 200);
}
console.log("Production face model and all WASM loader assets served successfully.");

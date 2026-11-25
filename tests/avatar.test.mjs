import test from "node:test";
import assert from "node:assert/strict";
import {
  avatarOptions,
  avatarRanges,
  defaultAvatar,
  validateAvatar,
  avatarImage,
  avatarFor,
  featuresFromLandmarks,
} from "../lib/avatar.js";
import { characterFor, characterKey } from "../lib/characters.js";
import { createExplorer, disposeExplorer } from "../lib/camp-explorer-3d.js";
import { sculptAvatar, poseSculpt } from "../lib/avatar-sculpt.js";
test("existing saved avatars retain their likeness when new personality settings are added", () => {
  const original = {
    ...defaultAvatar("female"),
    skin: "#663e2c",
    hair: "braids",
    outfit: "kurta",
    faceWidth: 0.9,
  };
  delete original.expression;
  delete original.pose;
  delete original.body;
  const migrated = validateAvatar(original);
  for (const key of Object.keys(original))
    assert.equal(migrated[key], original[key]);
  assert.equal(migrated.pose, "relaxed");
  assert.equal(migrated.expression, "smile");
  assert.equal(migrated.body, "balanced");
});
test("sculpted geometry stays finite across body types, expressions and saved poses", () => {
  for (const style of avatarOptions.style)
    for (const body of avatarOptions.body)
      for (const expression of avatarOptions.expression) {
        const rig = sculptAvatar(
          { ...defaultAvatar(style), body, expression, pose: "wave" },
          { detail: false },
        );
        poseSculpt(rig, 1, { animate: false });
        assert.equal(rig.gesture, "wave");
        assert.ok(rig.arms[0].hand.position.y > 0.8);
        rig.root.traverse((node) => {
          if (node.geometry)
            for (const v of node.geometry.attributes.position.array)
              assert.ok(Number.isFinite(v));
        });
        disposeExplorer(rig);
      }
});
test("male and female avatars support every wardrobe choice with strict, image-free settings", () => {
  for (const style of avatarOptions.style)
    for (const outfit of avatarOptions.outfit)
      for (const hair of avatarOptions.hair) {
        const a = validateAvatar({ ...defaultAvatar(style), outfit, hair });
        const image = decodeURIComponent(avatarImage(a, true));
        assert.ok(image.startsWith("data:image/svg+xml,<svg"));
        assert.ok(!image.includes("undefined"));
        assert.equal(a.style, style);
        const rig = createExplorer("personal", style, a);
        assert.ok(rig.root.children.length > 0);
        disposeExplorer(rig);
      }
  for (const bad of [
    { photo: "data:image/jpeg;base64,abc" },
    { landmarks: [] },
    { embedding: [] },
    { style: "inferred" },
    { skin: '" onload="alert(1)' },
    { faceWidth: Infinity },
    { version: 2 },
    { jaw: 0.1 },
  ])
    assert.throws(() => validateAvatar({ ...defaultAvatar(), ...bad }));
});
test("personal identity replaces preset portraits while preserving task slots", () => {
  const p = {
    name: "Asha",
    characterKey: "blaze",
    avatar: defaultAvatar("female"),
  };
  assert.equal(characterFor(p).name, "Asha");
  assert.equal(characterKey(p), "blaze");
  assert.equal(characterFor({ ...p, characterHidden: true }), null);
  assert.equal(avatarFor({ ...p, avatar: { photo: "discard" } }).version, 1);
  assert.equal(
    characterFor({ ...p, avatar: { ...p.avatar, outfit: "sari" } }).key,
    "blaze",
  );
});
function mesh() {
  const p = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const put = (i, x, y) => (p[i] = { x, y, z: 0 });
  put(234, 0.3, 0.47);
  put(454, 0.7, 0.47);
  put(10, 0.5, 0.2);
  put(152, 0.5, 0.83);
  put(1, 0.5, 0.5);
  put(33, 0.37, 0.43);
  put(133, 0.43, 0.43);
  put(362, 0.57, 0.43);
  put(263, 0.63, 0.43);
  put(172, 0.34, 0.65);
  put(397, 0.66, 0.65);
  put(98, 0.46, 0.54);
  put(327, 0.54, 0.54);
  put(61, 0.43, 0.65);
  put(291, 0.57, 0.65);
  put(70, 0.36, 0.38);
  put(105, 0.41, 0.37);
  put(300, 0.59, 0.37);
  put(334, 0.64, 0.38);
  return p;
}
test("scan rejects no face, groups, small faces, cut off faces and turned heads", () => {
  assert.throws(() => featuresFromLandmarks([], 960, 720), /No face/);
  assert.throws(
    () => featuresFromLandmarks([mesh(), mesh()], 960, 720),
    /just your face/,
  );
  assert.throws(() => featuresFromLandmarks([mesh()], 100, 100), /closer/);
  const cut = mesh();
  cut[10].y = 0;
  assert.throws(() => featuresFromLandmarks([cut], 960, 720), /whole face/);
  const turned = mesh();
  turned[1].x = 0.65;
  assert.throws(
    () => featuresFromLandmarks([turned], 960, 720),
    /straight ahead/,
  );
  const features = featuresFromLandmarks([mesh()], 960, 720);
  assert.deepEqual(Object.keys(features), Object.keys(avatarRanges));
  for (const [key, value] of Object.entries(features))
    assert.ok(value >= avatarRanges[key][0] && value <= avatarRanges[key][1]);
});

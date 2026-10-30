import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { levelImages, levelImage } from "../lib/level-images.js";
import { hazardLibrary } from "../lib/level-hazards.js";
import { validateLevel } from "../lib/level-definitions.js";
import { projectLevels } from "../lib/project-catalog.js";

test("every forest emblem has a generated scene, including variants and legacy attempts", async () => {
  for (const hazard of hazardLibrary)
    assert.equal(levelImage({ hazardKey: hazard.key }).key, hazard.artwork);
  for (const level of projectLevels) assert.ok(levelImage(level).src);
  for (const image of levelImages) await access(`public${image.src}`);
});
test("commanders can persist a library selection or use automatic emblem matching", () => {
  const source = {
    ...structuredClone(projectLevels[0]),
    hazardKey: "thorns",
    teamIds: ["a"],
  };
  const saved = validateLevel({ ...source, imageKey: "mud" });
  assert.equal(saved.imageKey, "mud");
  assert.equal(levelImage(saved).key, "mud");
  assert.equal(validateLevel(source).imageKey, "auto");
  assert.equal(levelImage(validateLevel(source)).key, "thorns");
  assert.throws(
    () =>
      validateLevel({ ...source, imageKey: "https://example.com/image.png" }),
    /available forest image/,
  );
});

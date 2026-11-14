import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { bank } from "../lib/research-bank.js";
import { missionImageIds, missionImageFor } from "../lib/mission-images.js";
test("all 51 questions have distinct, real local WebP backgrounds", async () => {
  const ids = bank.flatMap((g) => g.questions.map((q) => q.id));
  assert.deepEqual([...missionImageIds].sort(), ids.sort());
  const hashes = new Set();
  for (const id of ids) {
    const url = missionImageFor(id);
    assert.match(
      url,
      new RegExp(`^/images/research-missions/${id}(?:-v[1-9][0-9]*)?\\.webp$`),
    );
    const bytes = await readFile(new URL("../public" + url, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", id);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", id);
    assert.ok(bytes.length > 1024, `${id} must contain full artwork`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 51);
});
test("unknown question IDs cannot construct arbitrary image URLs", () => {
  assert.equal(missionImageFor("../outside"), null);
  assert.equal(missionImageFor("future-question"), null);
});

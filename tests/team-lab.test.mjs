import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeText,
  mergeTeamFiles,
  recoverTeamDraft,
} from "../lib/team-lab-merge.js";
import {
  teamInitialFiles,
  validateTeamFiles,
  fileTree,
} from "../lib/team-lab-project.js";

test("merges independent edits within the same source file", () => {
  const base = "one\ntwo\nthree\nfour\n";
  assert.deepEqual(
    mergeText(base, "ONE\ntwo\nthree\nfour\n", "one\ntwo\nthree\nFOUR\n"),
    { value: "ONE\ntwo\nthree\nFOUR\n" },
  );
  assert.deepEqual(
    mergeText(base, "ONE\ntwo\nthree\nFOUR\n", "one\nTWO\nthree\nfour\n"),
    { value: "ONE\nTWO\nthree\nFOUR\n" },
  );
});
test("overlapping changes retain both source versions for explicit review", () => {
  assert.deepEqual(mergeText("one\n", "ours\n", "theirs\n"), {
    conflict: true,
  });
  assert.deepEqual(mergeText("one\n", "new\none\n", "other\none\n"), {
    conflict: true,
  });
  assert.deepEqual(mergeText("one\n", undefined, "changed\n"), {
    conflict: true,
  });
  const result = mergeTeamFiles(
    { "a.js": "old" },
    { "a.js": "ours" },
    { "a.js": "theirs" },
  );
  assert.equal(result.files["a.js"], "ours");
  assert.deepEqual(result.conflicts, ["a.js"]);
});
test("merges additions, deletions and identical edits without resurrecting deleted files", () => {
  assert.deepEqual(
    mergeTeamFiles(
      { "a.js": "a", "b.js": "b" },
      { "b.js": "b", "new.js": "" },
      { "a.js": "a", "b.js": "B" },
    ),
    { files: { "b.js": "B", "new.js": "" }, conflicts: [] },
  );
  assert.deepEqual(mergeText("a\n", "A\n", "A\n"), { value: "A\n" });
  assert.deepEqual(mergeText("a", "a", "a\nb"), { value: "a\nb" });
});
test("workspace validation rejects traversal, sensitive folders, oversized files and missing entries", () => {
  assert.equal(validateTeamFiles(teamInitialFiles), true);
  for (const path of [
    "../secret.js",
    "/absolute.js",
    "src/../../secret",
    "node_modules/x.js",
    "src/__proto__/x.js",
    ".env",
    "src//x.js",
    "src/./x.js",
  ])
    assert.equal(
      validateTeamFiles({ ...teamInitialFiles, [path]: "x" }),
      false,
      path,
    );
  assert.equal(
    validateTeamFiles({ ...teamInitialFiles, "large.js": "x".repeat(50001) }),
    false,
  );
  assert.equal(
    validateTeamFiles({
      ...teamInitialFiles,
      src: "file conflicts with folder",
    }),
    false,
  );
  assert.equal(
    validateTeamFiles({ ...teamInitialFiles, "src/App.jsx": undefined }),
    false,
  );
  assert.equal(
    fileTree(teamInitialFiles).src.directory["App.jsx"].file.contents,
    teamInitialFiles["src/App.jsx"],
  );
});
test("many independent edits produce both authors changes regardless of save order", () => {
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i}\n`);
  for (let i = 0; i < 40; i++) {
    const a = [...lines],
      b = [...lines];
    a[i] = `a ${i}\n`;
    b[i + 50] = `b ${i + 50}\n`;
    const expected = [...a];
    expected[i + 50] = b[i + 50];
    assert.equal(
      mergeText(lines.join(""), a.join(""), b.join("")).value,
      expected.join(""),
    );
    assert.equal(
      mergeText(lines.join(""), b.join(""), a.join("")).value,
      expected.join(""),
    );
  }
});

test("recovering a device draft retains unresolved conflicts across reloads", () => {
  const draft = JSON.parse(
    JSON.stringify({
      base: { "a.js": "saved team text" },
      files: { "a.js": "unsaved local text" },
      conflicts: ["a.js"],
    }),
  );
  assert.deepEqual(recoverTeamDraft(draft, { "a.js": "saved team text" }), {
    files: { "a.js": "unsaved local text" },
    conflicts: ["a.js"],
  });
  assert.deepEqual(recoverTeamDraft(draft, { "a.js": "unsaved local text" }), {
    files: { "a.js": "unsaved local text" },
    conflicts: [],
  });
});

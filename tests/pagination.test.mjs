import test from "node:test";
import assert from "node:assert/strict";
import { pagination } from "../lib/pagination.js";

test("pagination visits every item once, including a partial final page", () => {
  const rows = Array.from({ length: 23 }, (_, i) => i);
  const visited = [];
  for (let page = 1; page <= 5; page++) {
    const state = pagination(rows.length, page, 5);
    visited.push(...rows.slice(state.start, state.end));
    assert.equal(state.page, page);
  }
  assert.deepEqual(visited, rows);
  assert.equal(pagination(23, 5, 5).end, 23);
});
test("pagination clamps after live data shrinks and handles empty queues", () => {
  assert.equal(pagination(3, 5, 5).page, 1);
  assert.deepEqual(pagination(0, 8, 5), { page: 1, pages: 1, start: 0, end: 0, size: 5, numbers: [1] });
  assert.equal(pagination(10, -2, 5).page, 1);
});
test("numbered controls stay bounded at both ends of a long list", () => {
  assert.deepEqual(pagination(100, 1, 5).numbers, [1, 2, 3, 4, 5]);
  assert.deepEqual(pagination(100, 10, 5).numbers, [8, 9, 10, 11, 12]);
  assert.deepEqual(pagination(100, 20, 5).numbers, [16, 17, 18, 19, 20]);
  assert.equal(pagination(23, 5, 10).page, 3);
});

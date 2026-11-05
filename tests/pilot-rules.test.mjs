import test from "node:test";
import assert from "node:assert/strict";
import {
  workingAt,
  validateCalendar,
  graph,
  cap,
  hash,
} from "../lib/pilot-rules.js";
import { parseCsv, workbookCsv, csv } from "../lib/pilot-assessment.js";
import manifests from "../lib/pilot-manifests.json" with { type: "json" };
import { zipSync, strToU8 } from "three/examples/jsm/libs/fflate.module.js";
test("frozen manifests preserve exact task counts, ownership, 54 hours and separate deployment gates", () => {
  for (const m of manifests.sprints) {
    assert.equal(m.tasks.length, 20);
    assert.ok(graph(m.tasks));
  }
  const s = manifests.sprints[1];
  assert.equal(s.tasks.filter((t) => t.tt === "TT1").length, 6);
  assert.equal(
    s.tasks.reduce((n, t) => n + t.hours, 0),
    54,
  );
  const op = s.tasks.find((t) => t.id === "OP-07");
  assert.deepEqual(op.depends, ["OP-06", "FE-06", "FE-07"]);
  assert.deepEqual(op.releaseGates, ["QA-06", "QA-08"]);
  assert.throws(() =>
    graph([
      { id: "FE-01", depends: ["FE-02"] },
      { id: "FE-02", depends: ["FE-01"] },
    ]),
  );
});
test("working calendar excludes lunch, holidays and weekends in both directions", () => {
  const c = {
    timeZone: "Asia/Kolkata",
    intervals: [
      { startMinute: 600, endMinute: 780 },
      { startMinute: 840, endMinute: 1020 },
    ],
    weekdays: [1, 2, 3, 4, 5],
    holidays: ["2026-11-09"],
  };
  assert.equal(
    workingAt("2026-11-06T07:00:00Z", c, 60),
    "2026-11-06T09:00:00.000Z",
  );
  assert.equal(
    workingAt("2026-11-06T11:00:00Z", c, 60),
    "2026-11-10T05:00:00.000Z",
  );
  assert.equal(
    workingAt("2026-11-06T09:00:00Z", c, -60),
    "2026-11-06T07:00:00.000Z",
  );
  assert.throws(() =>
    validateCalendar({
      ...c,
      intervals: [
        { startMinute: 600, endMinute: 800 },
        { startMinute: 780, endMinute: 900 },
      ],
    }),
  );
});
test("82.0 versus 82.2 cap uses complete five-person core marks only", () => {
  const ids = ["a", "b", "c", "d", "e"];
  assert.equal(
    cap(
      ids,
      ids.map((userId) => ({ userId, score: 82 })),
    ),
    3,
  );
  assert.equal(
    cap(
      ids,
      ids.map((userId) => ({ userId, score: 82.2 })),
    ),
    5,
  );
  assert.equal(cap(ids, []), 3);
  assert.equal(
    cap(
      ids.slice(0, 4),
      ids.map((userId) => ({ userId, score: 99 })),
    ),
    3,
  );
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
});
test("CSV quotes and XLSX literals preserve values; formulas are rejected", () => {
  assert.deepEqual(parseCsv("\uFEFFkey,total_score\r\na,0"), [
    { key: "a", total_score: "0" },
  ]);
  assert.deepEqual(
    parseCsv(csv([{ a: 'one,"two"', b: "three\nfour" }], ["a", "b"])),
    [{ a: 'one,"two"', b: "three\nfour" }],
  );
  const make = (formula) =>
    zipSync({
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>name</t></is></c></row><row r="2"><c r="A2" t="inlineStr">${formula ? "<f>1+1</f>" : ""}<is><t>QA &amp; test</t></is></c></row></sheetData></worksheet>`,
      ),
    });
  assert.equal(parseCsv(workbookCsv(make(false)))[0].name, "QA & test");
  assert.throws(() => workbookCsv(make(true)), /literal/);
});
test("marks workbooks reject self-closing formulas, duplicate cells and data beyond headers", () => {
  const book = (cells) =>
    zipSync({
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>score</t></is></c></row><row>${cells}</row></sheetData></worksheet>`,
      ),
    });
  assert.throws(
    () => workbookCsv(book('<c r="A2"><f/><v>100</v></c>')),
    /formulas/,
  );
  assert.throws(
    () => workbookCsv(book('<c r="A2"><v>0</v></c><c r="A2"><v>100</v></c>')),
    /Duplicate/,
  );
  assert.throws(
    () => workbookCsv(book('<c r="B2"><v>100</v></c>')),
    /header width/,
  );
});

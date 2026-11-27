import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { supportReportPdf } from "../lib/support-report-pdf.js";
import { supportConsoleFixture } from "./support-console-fixture.mjs";

test("support export produces a titled PDF with dynamically paginated evidence", async () => {
  const data = supportConsoleFixture();
  const options = { user: data.user, people: data.roster, generatedAt: new Date("2026-11-26T10:00:00Z") };
  const bytes = await supportReportPdf(data.support, options);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Campus support & discovery report");
  assert.ok(pdf.getPageCount() <= 2, "the eight-request sample and three knowledge cases fit into two pages");
  data.support.tickets.push({ ...data.support.tickets[0], description: "Long investigation notes including https://example.com/" + "unbrokentext".repeat(700) });
  const expanded = await PDFDocument.load(await supportReportPdf(data.support, options));
  assert.ok(expanded.getPageCount() > pdf.getPageCount(), "long records continue across pages without truncation");
  for (const page of expanded.getPages()) assert.deepEqual(page.getSize(), { width: 595.28, height: 841.89 });
});

test("knowledge tables paginate long case content instead of dropping it", async () => {
  const data = supportConsoleFixture();
  const options = { user: data.user, people: data.roster };
  const compact = await PDFDocument.load(await supportReportPdf(data.support, options));
  data.support.cases[0].content.successful = "Long resolution evidence ".repeat(1000);
  const expanded = await PDFDocument.load(await supportReportPdf(data.support, options));
  assert.ok(expanded.getPageCount() > compact.getPageCount());
});

test("empty support data still generates a readable report", async () => {
  const pdf = await PDFDocument.load(await supportReportPdf({}));
  assert.equal(pdf.getPageCount(), 1, "empty sections share one page");
});

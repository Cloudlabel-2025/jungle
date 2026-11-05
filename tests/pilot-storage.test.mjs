import test from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "three/examples/jsm/libs/fflate.module.js";
import { inspectEvidence } from "../lib/pilot-storage.js";
test("private evidence rejects forged types, oversize and expanding Office files; extracted text retains fidelity warning", () => {
  assert.throws(
    () => inspectEvidence(Buffer.from("not a PDF"), "pdf"),
    /signature/,
  );
  assert.throws(
    () => inspectEvidence(Buffer.alloc(5 * 1024 * 1024 + 1), "pdf"),
    /5 MB/,
  );
  assert.throws(
    () =>
      inspectEvidence(
        Buffer.from(zipSync({ "xl/workbook.xml": strToU8("<workbook/>") })),
        "docx",
      ),
    /Office file type/,
  );
  assert.throws(
    () =>
      inspectEvidence(
        Buffer.from(
          zipSync({ "word/document.xml": new Uint8Array(11 * 1024 * 1024) }),
        ),
        "docx",
      ),
    /expands/,
  );
  const result = inspectEvidence(
    Buffer.from(
      zipSync({
        "word/document.xml": strToU8(
          "<w:document><w:t>Actual learner evidence</w:t></w:document>",
        ),
      }),
    ),
    "docx",
  );
  assert.equal(result.extracted, "Actual learner evidence");
  assert.match(result.warning, /original-file review/);
});

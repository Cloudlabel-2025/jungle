import { PDFDocument, PDFString, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const green = rgb(0.08, 0.23, 0.17), muted = rgb(0.33, 0.40, 0.36);
const fontFiles = [
  join(process.cwd(), "node_modules/@fontsource/rajdhani/files/rajdhani-latin-400-normal.woff"),
  join(process.cwd(), "node_modules/@fontsource/rajdhani/files/rajdhani-devanagari-400-normal.woff"),
];
const normalise = value => String(value ?? "NOT_ASSESSED").replace(/[\u0000-\u001f]/g, " ").replace(/[\u2010-\u2015]/g, "-");

// Fixed page counts, embedded fonts, no browser/network renderer or public files.
// The complete source record is attached, so evidence references remain inspectable.
export async function finalReportPdf(report, kind = "PASSPORT") {
  if (!["PASSPORT", "CERTIFICATE"].includes(kind)) throw new Error("Unknown report kind.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(fontFiles.map(async path => {
    const bytes = await readFile(path);
    return { parsed: fontkit.create(bytes), embedded: await pdf.embedFont(bytes, { subset: true }) };
  }));
  const characterFonts = new Map(), characterWidths = new Map();
  const fontFor = char => {
    if (characterFonts.has(char)) return characterFonts.get(char);
    const font = fonts.find(row => row.parsed.hasGlyphForCodePoint(char.codePointAt(0)));
    if (!font) throw Object.assign(new Error(`PDF font does not support character ${char}. Use a supported spelling for this draft or configure a font covering that script.`), { status: 400 });
    characterFonts.set(char, font.embedded);
    return font.embedded;
  };
  const characterWidth = char => {
    if (!characterWidths.has(char)) characterWidths.set(char, fontFor(char).widthOfTextAtSize(char, 1));
    return characterWidths.get(char);
  };
  const runs = text => {
    const result = [];
    for (const char of text) {
      const font = fontFor(char);
      if (result.at(-1)?.font === font) result.at(-1).text += char;
      else result.push({ font, text: char });
    }
    return result;
  };
  const draw = (page, text, x, y, size, color = green) => {
    const origin = x;
    for (const run of runs(normalise(text))) {
      page.drawText(run.text, { x, y, size, font: run.font, color });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
    for (const match of normalise(text).matchAll(/\bE\d{3}\b/g)) {
      const ref = [...references].find(([, label]) => label === match[0])?.[0];
      if (!ref?.startsWith("https://")) continue;
      const left = origin + [...normalise(text).slice(0, match.index)].reduce((sum, char) => sum + characterWidth(char) * size, 0);
      page.node.addAnnot(pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Link",
        Rect: [left, y - 2, left + [...match[0]].reduce((sum, char) => sum + characterWidth(char) * size, 0), y + size],
        Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(ref) } })));
    }
  };
  const wrap = (value, size, maxWidth) => {
    const lines = []; let line = "", lineWidth = 0;
    for (const word of normalise(value).trim().split(/\s+/)) {
      const wordWidth = [...word].reduce((sum, char) => sum + characterWidth(char) * size, 0);
      const spaceWidth = line ? characterWidth(" ") * size : 0;
      if (line && lineWidth + spaceWidth + wordWidth > maxWidth) { lines.push(line); line = ""; lineWidth = 0; }
      if (line) { line += " "; lineWidth += spaceWidth; }
      for (const char of word) {
        const nextWidth = characterWidth(char) * size;
        if (line && lineWidth + nextWidth > maxWidth) { lines.push(line); line = ""; lineWidth = 0; }
        line += char; lineWidth += nextWidth;
      }
    }
    if (line) lines.push(line.trimEnd());
    return lines;
  };
  const { identity: i, dossier: d, approval: a } = report;
  pdf.setTitle(kind === "PASSPORT" ? "Private Capability Passport" : "Certificate of Assessed Completion");
  pdf.setAuthor("CODEWILD CAMPUS");
  pdf.setSubject(`Private assessed completion record - ${i.gamerId}`);
  const references = new Map();
  const refs = values => (values || []).map(ref => {
    if (!references.has(ref)) references.set(ref, `E${String(references.size + 1).padStart(3, "0")}`);
    return references.get(ref);
  }).join(", ") || "NOT_ASSESSED";
  const page = (title, number) => {
    const p = pdf.addPage([595.28, 841.89]);
    p.drawRectangle({ x: 0, y: 827, width: 596, height: 15, color: green });
    draw(p, "CODEWILD CAMPUS", 42, 789, 13);
    draw(p, title, 42, 756, 27);
    p.drawLine({ start: { x: 42, y: 738 }, end: { x: 553, y: 738 }, thickness: 0.6, color: muted });
    if (kind === "PASSPORT") draw(p, `PRIVATE  |  ${i.gamerId}  |  v${a.reportVersion}  |  ${number}`, 42, 31, 9, muted);
    return p;
  };
  const fill = (p, blocks, start = 714, bottom = 64) => {
    let layout;
    for (let size = 12; size >= 9; size -= 0.25) {
      const rows = blocks.map(block => ({ ...block, lines: wrap(block.text, size * (block.heading ? 1.15 : 1), 511) }));
      const height = rows.reduce((sum, row) => sum + row.lines.length * size * 1.27 * (row.heading ? 1.15 : 1) + (row.heading ? 9 : 5), 0);
      if (height <= start - bottom) { layout = { rows, size }; break; }
    }
    if (!layout) throw Object.assign(new Error("This report exceeds the fixed page layout. Shorten the approved observations or contribution descriptions and regenerate; no content was truncated."), { status: 400 });
    let y = start;
    for (const row of layout.rows) {
      const size = layout.size * (row.heading ? 1.15 : 1);
      for (const line of row.lines) { draw(p, line, 42, y, size, row.heading ? green : muted); y -= size * 1.27; }
      y -= row.heading ? 9 : 5;
    }
    return y;
  };
  if (kind === "CERTIFICATE") {
    const p = page("Certificate of Assessed Completion", "1 / 1");
    fill(p, [
      { text: "This certificate is awarded to" },
      { text: i.name, heading: true },
      { text: report.certificate.exact_body },
      { text: `Programme Dates: ${i.start} - ${i.end}` },
      { text: `Certificate ID: ${report.certificate.certificate_id}` },
    ], 665, 290);
    p.drawLine({ start: { x: 42, y: 195 }, end: { x: 257, y: 195 }, color: muted });
    p.drawLine({ start: { x: 335, y: 195 }, end: { x: 550, y: 195 }, color: muted });
    draw(p, "Mission Commander", 42, 176, 12);
    draw(p, "Centre Command", 335, 176, 12);
    // Certificate deliberately excludes marks, bonuses and the assessment dossier.
  } else {
    const scores = d.approved_core_assessment.criterion_scores;
    const dimensions = [...new Set(scores.map(row => row.dimension_id))].map(id => {
      const rows = scores.filter(row => row.dimension_id === id);
      const label = { technical_application: "Technical Application", ai_problem_solving: "AI-Enabled Problem-Solving",
        professional_collaboration: "Professional Collaboration", ownership_adaptability: "Ownership & Adaptability" }[id] || id;
      return `${label}: ${rows.every(row => row.approved_score !== null) ? Math.round(rows.reduce((sum, row) => sum + row.approved_score, 0) * 100) / 100 : "NOT_ASSESSED"} / ${rows.reduce((sum, row) => sum + row.max_score, 0)}`;
    });
    fill(page("Your Capability Profile", "1 / 2"), [
      { text: i.name, heading: true },
      { text: `${i.college} | ${i.cohortId} | ${i.teamId} | ${i.course}` },
      { text: `${i.start} - ${i.end} | Alumni Connect | ${i.projectId}` },
      { text: "Approved criterion scores", heading: true },
      ...scores.map(row => ({ text: `${row.display_name || row.criterion_id.replaceAll("_", " ")}: ${row.approved_score ?? "NOT_ASSESSED"} / ${row.max_score} | ${refs(row.evidence_refs)}` })),
      { text: `Approved CORE total: ${d.approved_core_assessment.total_out_of_100 ?? "NOT_ASSESSED"} / 100`, heading: true },
      ...dimensions.map(text => ({ text })),
      { text: `Additional bonuses (separate from core): ${report.bonuses.map(row => `${row.kind}: +${row.bonus}`).join("; ") || "None recorded"}` },
    ]);
    const p = page("Your Six-Week Journey", "2 / 2");
    const blocks = [
      { text: `Week 1 baseline: ${d.week1.baseline_score ?? "NOT_ASSESSED"} | Readiness: ${d.week1.readiness_score ?? "NOT_ASSESSED"} | Clearance: ${d.week1.clearance_status}` },
      { text: "Technical rotations", heading: true },
      { text: d.role_rotation_history.map(row => `Sprint ${row.sprint_number}: ${row.primary_role}`).join("; ") || "NOT_ASSESSED" },
      { text: "Verified contributions and progression", heading: true },
      ...[1, 2, 3, 4, 5].map(n => ({ text: `Sprint ${n}: ${d.task_evidence.filter(row => row.sprint_number === n).map(row => `${row.task_id} (${row.review_status}) ${refs(row.commit_or_test_ref)}`).join("; ") || "NOT_ASSESSED"}` })),
      { text: "Evidenced strengths", heading: true },
      ...d.strengths.map(row => ({ text: `${row.observation} | ${refs([row.evidence_ref])}` })),
      ...(!d.strengths.length ? [{ text: "Not yet evidenced" }] : []),
      { text: "Development priorities", heading: true },
      ...d.gaps.map(row => ({ text: `${row.recommended_exercise} | ${refs([row.evidence_ref])}` })),
      ...(!d.gaps.length ? [{ text: "Not yet evidenced" }] : []),
      { text: "Final Friday", heading: true },
      { text: `${d.assigned_persona} | Demo/private defence: ${report.witness?.decision || "NOT_ASSESSED"} | ${report.witness?.defenceMinutes ?? "NOT_ASSESSED"} minutes | ${refs(report.witness?.evidence ? [report.witness.evidence] : [])}` },
      { text: `Recognition: ${report.awards.join("; ") || "None recorded"}` },
      { text: `MC: ${a.mc} | CC: ${a.cc || "NOT_ASSESSED"} | Rubric: ${a.rubricVersion} | ${new Date(a.at).toISOString().slice(0, 10)}` },
      { text: "Evidence index and complete approved source record are attached to this PDF. Confirm current issuance before use." },
    ];
    fill(p, blocks);
    await pdf.attach(Buffer.from(JSON.stringify({ report, evidence_index: Object.fromEntries([...references].map(([ref, label]) => [label, ref])) }, null, 2)), "approved-source-record.json", { mimeType: "application/json", description: "Private report source and evidence index" });
    // Evidence labels in the attachment retain exact URLs/non-URL references.
  }
  return Buffer.from(await pdf.save());
}

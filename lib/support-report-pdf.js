import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { supportQueueCounts, supportTicketClosed } from "./support-queue.js";

const ink = rgb(.10, .19, .16), muted = rgb(.37, .43, .40);
const green = rgb(.12, .34, .25), pale = rgb(.94, .97, .95);
const label = key => ({ _id: "Reference", createdBy: "Requested by", assignedTo: "Assigned to", userId: "Participant", cohortId: "Cohort", createdAt: "Created", assignedAt: "Assigned", firstResponseAt: "First response", dueAt: "Response due", breachedAt: "Response deadline missed", remainingWorkingMinutes: "Working minutes remaining", unassignedWaitMinutes: "Minutes waiting for assignment", ticketId: "Request reference" }[key] || key.replace(/([a-z\d])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, c => c.toUpperCase()));
const words = value => String(value).replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());

/** A private, paginated report; no browser renderer or external service required. */
export async function supportReportPdf(support, { user, people = [], college = "", generatedAt = new Date() } = {}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(["latin", "devanagari"].map(async script => {
    const bytes = await readFile(join(process.cwd(), `node_modules/@fontsource/rajdhani/files/rajdhani-${script}-400-normal.woff`));
    return { parsed: fontkit.create(bytes), font: await pdf.embedFont(bytes, { subset: true }) };
  }));
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  const bodyCharacters = new Set(bodyFont.getCharacterSet());
  const fontFor = char => {
    if (bodyCharacters.has(char.codePointAt(0))) return bodyFont;
    const found = fonts.find(f => f.parsed.hasGlyphForCodePoint(char.codePointAt(0)));
    if (!found) throw Object.assign(new Error("The report contains characters outside the installed PDF fonts. Contact campus support to add font coverage for this language."), { status: 400 });
    return found.font;
  };
  const clean = value => String(value).replace(/[\u0000-\u001f]/g, " ").replace(/[\u2010-\u2015]/g, "-");
  const runs = value => {
    const result = [];
    for (const char of clean(value)) {
      const font = fontFor(char);
      if (result.at(-1)?.font === font) result.at(-1).text += char;
      else result.push({ font, text: char });
    }
    return result;
  };
  const width = (text, size) => runs(text).reduce((n, r) => n + r.font.widthOfTextAtSize(r.text, size), 0);
  const draw = (text, x, y, size = 12, color = ink, target = page) => {
    for (const run of runs(text)) {
      target.drawText(run.text, { x, y, size, color, font: run.font });
      x += run.font.widthOfTextAtSize(run.text, size);
    }
  };
  const wrap = (value, size, maxWidth = 499) => {
    const lines = []; let line = "";
    for (const word of clean(value).split(/\s+/)) {
      if (line && width(`${line} ${word}`, size) > maxWidth) { lines.push(line); line = ""; }
      if (line) line += " ";
      for (const char of word) {
        if (line && width(line + char, size) > maxWidth) { lines.push(line); line = ""; }
        line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  };
  const timeZone = support.calendar?.timeZone || "Asia/Kolkata";
  const date = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(d);
  };
  const names = new Map([...people, ...(support.operators || []), ...(user ? [user] : [])].map(p => [String(p._id), p.name]));
  const scalar = (value, key = "") => {
    if (value == null || value === "") return "Not recorded";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (value instanceof Date || /At$/.test(key)) return date(value);
    if (names.has(String(value))) return names.get(String(value));
    return typeof value === "string" && /^[A-Z][A-Z_]+$/.test(value) ? words(value) : String(value);
  };
  let page, y, currentSection = "Overview";
  const newPage = (continued = false) => {
    page = pdf.addPage([595.28, 841.89]); y = 744;
    page.drawRectangle({ x: 0, y: 829, width: 596, height: 13, color: green });
    draw("VOYAGE OF WILDERNESS", 48, 793, 11, green);
    draw("Campus support & discovery", 366, 793, 10, muted);
    if (continued) draw(`${currentSection} (continued)`, 48, 766, 10, muted);
  };
  const ensure = height => { if (y - height < 65) newPage(true); };
  const paragraph = (value, size = 10.5, color = ink, inset = 0) => {
    for (const line of wrap(value, size, 499 - inset)) {
      ensure(size * 1.3); draw(line, 48 + inset, y, size, color); y -= size * 1.3;
    }
    y -= 3;
  };
  const heading = title => {
    ensure(65); y -= 12;
    page.drawLine({ start: { x: 48, y: y + 16 }, end: { x: 547, y: y + 16 }, thickness: .5, color: rgb(.78, .84, .80) });
    paragraph(title, 14, green);
  };
  // Nested evidence is rendered as labelled text, never a JSON blob.
  const fields = (record, depth = 0) => {
    for (const [key, value] of Object.entries(record || {})) {
      if (key === "__v") continue;
      const inset = Math.min(depth * 12, 48);
      if (Array.isArray(value)) {
        if (!value.length) continue;
        if (value.every(v => v == null || typeof v !== "object")) paragraph(`${label(key)}: ${value.map(v => scalar(v)).join("; ")}`, 10.5, ink, inset);
        else { ensure(40); paragraph(label(key), 11, green, inset); value.forEach((v, i) => { paragraph(`Entry ${i + 1}`, 10, muted, inset + 8); typeof v === "object" && v !== null ? fields(v, depth + 1) : paragraph(scalar(v), 10.5, ink, inset + 8); }); }
      } else if (value && typeof value === "object" && !(value instanceof Date)) {
        ensure(40); paragraph(label(key), 11, green, inset); fields(value, depth + 1);
      } else paragraph(`${label(key)}: ${scalar(value, key)}`, 10.5, ink, inset);
    }
  };
  const emptySections = [];
  const section = (title, records, titleFor) => {
    currentSection = title;
    if (!records.length) { emptySections.push(title); return; }
    heading(`${title} | ${records.length} ${records.length === 1 ? "record" : "records"}`);
    records.forEach((record, i) => { heading(titleFor?.(record, i) || `Record ${i + 1}`); fields(record); });
  };
  const table = (columns, headers, rows) => {
    const size = 10, leading = 13;
    const wrapped = rows.map(values => values.map((cell, i) => cell.flatMap(text => wrap(text, size, columns[i] - 16))));
    const header = () => {
      page.drawRectangle({ x: 48, y: y - 24, width: 499, height: 24, color: green });
      let x = 48;
      headers.forEach((title, i) => { draw(title, x + 8, y - 16, size, rgb(1, 1, 1)); x += columns[i]; });
      y -= 24;
    };
    const next = () => { newPage(true); header(); };
    const firstHeight = Math.max(...wrapped[0].map(cell => cell.length)) * leading + 14;
    if (y - 24 - Math.min(firstHeight, 655) < 65) newPage(true);
    header();
    wrapped.forEach((lines, index) => {
      const count = Math.max(...lines.map(cell => cell.length));
      // Keep ordinary rows intact; split unusually long evidence without truncating it.
      if (count * leading + 14 <= 655 && y - count * leading - 14 < 65) next();
      let offset = 0;
      while (offset < count) {
        if (y - 14 - leading < 65) next();
        const length = Math.min(count - offset, Math.floor((y - 65 - 14) / leading));
        const height = length * leading + 14;
        page.drawRectangle({ x: 48, y: y - height, width: 499, height, color: index % 2 ? rgb(1, 1, 1) : pale });
        let x = 48;
        lines.forEach((cell, i) => {
          cell.slice(offset, offset + length).forEach((text, row) => draw(text, x + 8, y - 17 - row * leading, size));
          x += columns[i];
          if (i < columns.length - 1) page.drawLine({ start: { x, y }, end: { x, y: y - height }, thickness: .4, color: rgb(.80, .86, .82) });
        });
        page.drawLine({ start: { x: 48, y: y - height }, end: { x: 547, y: y - height }, thickness: .5, color: rgb(.78, .84, .80) });
        y -= height; offset += length;
        if (offset < count) next();
      }
    });
    y -= 10;
  };
  // Preserve extra evidence as labelled text, including nested records.
  const extra = (value, prefix = "") => {
    if (value == null || value === "") return [];
    if (Array.isArray(value)) return value.flatMap(v => extra(v, prefix));
    if (typeof value === "object" && !(value instanceof Date)) return Object.entries(value).filter(([key]) => key !== "__v").flatMap(([key, v]) => extra(v, `${prefix}${prefix ? " / " : ""}${label(key)}`));
    return [`${prefix}: ${scalar(value)}`];
  };
  const ticketTable = tickets => {
    currentSection = "Support requests";
    heading(`Support requests | ${tickets.length}`);
    if (!tickets.length) { paragraph("No support requests available for this cohort."); return; }
    const known = new Set(["_id", "__v", "description", "category", "tags", "createdBy", "assignedTo", "state", "createdAt", "assignedAt", "dueAt", "firstResponseAt", "breachedAt", "unassignedWaitMinutes", "remainingWorkingMinutes"]);
    table([232, 100, 167], ["Request / description", "People", "Status / timing"], tickets.map((t, index) => [
      [t._id ? `Ref: ${t._id}` : `Request ${index + 1}`, t.description || "No description recorded", ...(t.category ? [`Category: ${words(t.category)}`] : []), ...(t.tags?.length ? [`Tags: ${t.tags.join(", ")}`] : []), ...Object.entries(t).filter(([key]) => !known.has(key)).flatMap(([key, v]) => extra(v, label(key)))],
      [`From: ${scalar(t.createdBy)}`, `Owner: ${t.assignedTo ? scalar(t.assignedTo) : "Unassigned"}`],
      [words(t.state || "NEW"), ...["createdAt", "assignedAt", "dueAt", "firstResponseAt", "breachedAt"].filter(key => t[key]).map(key => `${label(key)}: ${date(t[key])}`), ...(t.unassignedWaitMinutes != null ? [`Assignment wait: ${t.unassignedWaitMinutes} min`] : []), ...(t.remainingWorkingMinutes != null ? [`Working time left: ${t.remainingWorkingMinutes} min`] : [])],
    ]));
  };
  const knowledgeTable = cases => {
    currentSection = "Knowledge library";
    heading(`Knowledge library | ${cases.length}`);
    if (!cases.length) { paragraph("No knowledge cases available for this cohort."); return; }
    const contentKeys = new Set(["title", "cause", "unsuccessful", "successful", "applicability", "prerequisites", "anonymisation", "validationEvidence"]);
    const metadataKeys = new Set(["_id", "__v", "content", "status", "version", "ticketId"]);
    table([120, 205, 174], ["Knowledge case", "Diagnosis / resolution", "Use / evidence"], cases.map(c => {
      const content = c.content || {};
      return [
        [content.title || "Untitled case", `${words(c.status || "DRAFT")} | v${c.version ?? "Not recorded"}`, ...extra(c._id, "Ref"), ...extra(c.ticketId, "Request"), ...Object.entries(c).filter(([key]) => !metadataKeys.has(key)).flatMap(([key, v]) => extra(v, label(key)))],
        [...extra(content.cause, "Cause"), ...extra(content.unsuccessful, "Did not work"), ...extra(content.successful, "What worked")],
        [...extra(content.applicability, "When to use"), ...extra(content.prerequisites, "Prerequisites"), ...extra(content.validationEvidence, "Validation"), ...extra(content.anonymisation, "Privacy review"), ...Object.entries(content).filter(([key]) => !contentKeys.has(key)).flatMap(([key, v]) => extra(v, label(key)))],
      ];
    }));
  };
  pdf.setTitle("Campus support & discovery report"); pdf.setAuthor("Voyage of Wilderness");
  pdf.setSubject("Private campus support and discovery records"); pdf.setCreationDate(new Date(generatedAt));
  newPage();
  paragraph("Campus support & discovery", 23, green);
  paragraph(`${college || "Centre Command"} | Cohort: ${user?.cohortId || "alpha"} | Prepared by: ${user?.name || "Centre Command"}`, 10.5, muted);
  paragraph(`Generated: ${date(generatedAt)} (${timeZone})`, 10, muted);
  y -= 8;
  const tickets = support.tickets || [], counts = supportQueueCounts(tickets);
  page.drawRectangle({ x: 48, y: y - 51, width: 499, height: 60, color: pale });
  [[counts.open, "Open requests"], [counts.unassigned, "Unassigned"], [counts.overdue, "Overdue"], [tickets.filter(supportTicketClosed).length, "Resolved / closed"]].forEach(([value, title], i) => {
    draw(String(value), 61 + i * 124, y - 14, 22, green); draw(title, 61 + i * 124, y - 34, 10, muted);
  });
  y -= 66;
  paragraph("Private campus records. Open requests exclude resolved and closed requests.", 9, muted);
  ticketTable(tickets);
  knowledgeTable(support.cases || []);
  section("Discovery & growth", [
    ...(support.discovery?.prompt ? [{ discoveryPrompt: support.discovery.prompt, version: support.discovery.version }] : []),
    ...(support.baselines || []).map(b => ({ recordType: "Discovery baseline", ...b })),
    ...(support.growth || []).map(g => ({ recordType: "Growth report", ...g })),
  ], r => r.recordType || "Current discovery prompt");
  section("Learning effort", Object.entries(support.effort || {}).filter(([, v]) => Array.isArray(v) && v.length).flatMap(([key, values]) => values.map(v => ({ recordType: label(key), ...(typeof v === "object" && v !== null ? v : { value: v }) }))), r => r.recordType);
  section("Supporting evidence", ["attempts", "interventions", "events", "issues", "caseVersions", "governance"].flatMap(key => (support[key] || []).map(v => ({ recordType: label(key), ...v }))), r => r.recordType);
  if (emptySections.length) paragraph(`No records available: ${emptySections.join("; ")}.`, 9, muted);
  for (const [index, p] of pdf.getPages().entries()) {
    draw("PRIVATE CAMPUS REPORT", 48, 35, 10, muted, p);
    draw(`Page ${index + 1} of ${pdf.getPageCount()}`, 475, 35, 10, muted, p);
  }
  return pdf.save();
}

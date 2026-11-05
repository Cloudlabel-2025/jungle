import { unzipSync, strFromU8 } from "three/examples/jsm/libs/fflate.module.js";
export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(value.replace(/\r$/, ""));
      value = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else value += c;
  }
  if (quoted) throw new Error("Unterminated CSV value.");
  row.push(value.replace(/\r$/, ""));
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const header = rows.shift();
  if (new Set(header).size !== header.length)
    throw new Error("Duplicate CSV column.");
  return rows.map((row) => {
    if (row.length !== header.length)
      throw new Error("CSV row width mismatch.");
    return Object.fromEntries(header.map((k, i) => [k, row[i]]));
  });
}
export const csv = (rows, columns) =>
  [columns, ...rows.map((r) => columns.map((k) => r[k] ?? ""))]
    .map((row) =>
      row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
    )
    .join("\n");
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, v) =>
    v[0] === "#"
      ? String.fromCodePoint(
          v[1] === "x" ? parseInt(v.slice(2), 16) : +v.slice(1),
        )
      : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[v],
  );
export function workbookCsv(bytes) {
  let total = 0;
  const zip = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      if (total > 30 * 1024 * 1024 || f.originalSize > 10 * 1024 * 1024)
        throw new Error("Workbook expands beyond the allowed size.");
      return true;
    },
  });
  const sheets = Object.keys(zip).filter((k) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(k),
  );
  if (sheets.length !== 1) throw new Error("Return one worksheet.");
  const strings = [
    ...strFromU8(zip["xl/sharedStrings.xml"] || new Uint8Array()).matchAll(
      /<si[ >][\s\S]*?<\/si>/g,
    ),
  ].map((m) =>
    [...m[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((m) => decode(m[1]))
      .join(""),
  );
  const xml = strFromU8(zip[sheets[0]]);
  if (/<f(?:\s|\/?>)/i.test(xml) || /<!DOCTYPE|<!ENTITY/.test(xml))
    throw new Error("Use literal values without formulas or XML entities.");
  const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((m) => {
    const values = [];
    for (const cell of m[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const ref = cell[1].match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) throw new Error("Explicit cell references required.");
      const index =
        [...ref].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
      if (index > 100) throw new Error("Too many columns.");
      if (Object.hasOwn(values, index))
        throw new Error("Duplicate worksheet cell.");
      const type = cell[1].match(/\bt="([^"]+)"/)?.[1],
        v = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      values[index] =
        type === "s"
          ? (strings[+v] ?? "")
          : type === "inlineStr"
            ? [...cell[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
                .map((m) => decode(m[1]))
                .join("")
            : decode(v);
    }
    return values;
  });
  if (rows.length > 10001 || !rows.length)
    throw new Error("Invalid worksheet row count.");
  const width = rows[0].length;
  if (rows.some((r) => r.length > width))
    throw new Error("Worksheet row exceeds the header width.");
  return rows
    .map((r) =>
      Array.from(
        { length: width },
        (_, i) => '"' + String(r[i] ?? "").replaceAll('"', '""') + '"',
      ).join(","),
    )
    .join("\n");
}

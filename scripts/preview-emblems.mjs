// Render the actual React artwork into a standalone art-direction preview.
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { createServer } from "node:http";
import {
  hazardLibrary,
  levelHazards,
  levelHazard,
} from "../lib/level-hazards.js";
import { terrainStops, terrainPosition } from "../lib/map-terrain.js";
import sharp from "sharp";

const compiled = new URL("../artifacts/.emblem-preview.cjs", import.meta.url);
await build({
  entryPoints: ["components/LevelEmblem.js"],
  bundle: true,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  loader: { ".js": "jsx" },
  alias: { "@": process.cwd() },
  external: ["react", "react/jsx-runtime"],
  outfile: fileURLToPath(compiled),
});
let Emblem;
try {
  Emblem = createRequire(import.meta.url)(fileURLToPath(compiled)).default;
} finally {
  await unlink(compiled);
}
const motifs = [
  ...levelHazards,
  ...hazardLibrary.filter(
    (h) => h.key === h.artwork && !levelHazards.some((d) => d.artwork === h.artwork),
  ),
];
const css = await readFile(
  new URL("../app/level-emblems.css", import.meta.url),
  "utf8",
);
const cards = motifs
  .map(
    (h, i) =>
      `<article><small>${i < 10 ? `LEVEL ${String(i + 1).padStart(2, "0")}` : "EXTRA MOTIF"} / ${h.category.toUpperCase()}</small>${renderToStaticMarkup(React.createElement(Emblem, { level: { hazardKey: h.key } }))}<h2>${h.name}</h2></article>`,
  )
  .join("");
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CODEWILD · Forest danger insignia</title><style>${css}body{margin:0;background:#091712;color:#e4dcc1;font-family:Georgia,serif;padding:32px}header{max-width:1000px;margin:0 auto 26px}header small{font:10px monospace;letter-spacing:2px;color:#c3a36b}h1{font-weight:400;font-size:34px;margin:12px 0}header p{font:13px/1.7 system-ui;color:#aabbab}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:14px;max-width:1000px;margin:auto}article{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#10241c;border:1px solid #766b493d;padding:22px 12px;min-height:180px}article small{font:8px monospace;letter-spacing:1px;color:#ad9b72}article .level-emblem{width:100px;height:100px;margin:20px 0 10px}h2{font-size:16px;font-weight:400;margin:6px 0;text-align:center}@media(max-width:500px){body{padding:22px 16px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:28px}article{padding:18px 8px}article small{font-size:7px}}</style><header><small>CODEWILD / EXPEDITION INSIGNIA</small><h1>Read the warning. Face the wild.</h1><p>14 engraved motifs · 42 reusable hazards · Animal tracks, insects, terrain, vegetation, structures, water and weather.</p></header><main class="gallery">${cards}</main></html>`;
await writeFile(
  new URL("../artifacts/forest-danger-emblems.html", import.meta.url),
  html,
);
const contactSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="810" viewBox="0 0 1120 810"><style>.emblem-frame{fill:#101c18;stroke:#9c895e;stroke-width:1.5}.emblem-score{fill:none;stroke:#c6a76c;stroke-width:1}.hazard-solid{fill:currentColor;stroke:none}.hazard-cut{stroke:#101c18}.hazard-eye{fill:#101c18;stroke:none}</style><rect width="1120" height="810" fill="#091712"/><text x="35" y="40" fill="#c3a36b" font-size="12" font-family="monospace" letter-spacing="3">CODEWILD / FOREST DANGER INSIGNIA</text><text x="35" y="79" fill="#e4dcc1" font-size="28" font-family="Georgia">Read the warning. Face the wild.</text>${motifs
  .map((h, i) => {
    const x = 30 + (i % 5) * 219,
      y = 110 + Math.floor(i / 5) * 225;
    const icon = renderToStaticMarkup(
      React.createElement(Emblem, { level: { hazardKey: h.key } }),
    )
      .match(/<svg[\s\S]*<\/svg>/)[0]
      .replace("<svg ", '<svg x="55" y="36" width="100" height="100" ');
    return `<g transform="translate(${x} ${y})" color="#e3d4aa"><rect width="205" height="208" fill="#10241c" stroke="#766b49" stroke-opacity=".35"/><text x="102" y="23" text-anchor="middle" fill="#ad9b72" font-family="monospace" font-size="9">${i < 10 ? `LEVEL ${String(i + 1).padStart(2, "0")}` : "EXTRA MOTIF"} / ${h.category.toUpperCase()}</text>${icon}<text x="102" y="169" text-anchor="middle" fill="#e4dcc1" font-family="Georgia" font-size="16">${h.name}</text></g>`;
  })
  .join("")}</svg>`;
await writeFile(
  new URL("../artifacts/forest-danger-emblems.svg", import.meta.url),
  contactSheet,
);
await sharp(Buffer.from(contactSheet))
  .png()
  .toFile(
    fileURLToPath(
      new URL("../artifacts/forest-danger-emblems.png", import.meta.url),
    ),
  );
if (process.argv.includes("--map")) {
  const rows = [];
  for (const [region, name] of ["west", "valley", "east"].entries()) {
    const markers = terrainStops
      .flatMap((anchor, i) => {
        if (anchor.region !== region) return [];
        const level = { number: i + 1 },
          hazard = levelHazard(level);
        const point = terrainPosition(level, { width: 6000, height: 2000 / 3 });
        const x = (point.x - region * 2000) * 0.7,
          y = point.y * 0.7;
        const icon = renderToStaticMarkup(
          React.createElement(Emblem, { level }),
        )
          .match(/<svg[\s\S]*<\/svg>/)[0]
          .replace("<svg ", '<svg x="-29" y="-29" width="58" height="58" ');
        const labelY =
          point.labelPlacement === "right" ? -13 : point.labelAbove ? -64 : 36;
        const labelX = point.labelPlacement === "right" ? 45 : -79;
        return `<g transform="translate(${x} ${y})" color="#e3d4aa">${icon}<rect x="-37" y="-34" width="21" height="17" rx="2" fill="#0b2825" stroke="#b5985e"/><text x="-26.5" y="-22" text-anchor="middle" fill="#ead7a0" font-size="9" font-family="monospace">${String(i + 1).padStart(2, "0")}</text><rect x="${labelX}" y="${labelY}" width="158" height="26" rx="3" fill="#08252d" fill-opacity=".95" stroke="#718c70"/><text x="${labelX + 79}" y="${labelY + 17}" text-anchor="middle" fill="#e4dcc1" font-family="Georgia" font-size="12">${hazard.name}</text></g>`;
      })
      .join("");
    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="467"><style>.emblem-frame{fill:#101c18;stroke:#9c895e;stroke-width:1.5}.emblem-score{fill:none;stroke:#c6a76c}.hazard-solid{fill:currentColor;stroke:none}.hazard-cut{stroke:#101c18}.hazard-eye{fill:#101c18;stroke:none}</style>${markers}<rect x="15" y="15" width="210" height="29" fill="#091712" fill-opacity=".85"/><text x="27" y="35" fill="#d6bd85" font-size="12" font-family="monospace">${["WEST / ROOTS & CANOPY", "CENTRE / CROSSING & CHASM", "EAST / CLIFFS & RUINS"][region]}</text></svg>`;
    const image = await sharp(
      fileURLToPath(
        new URL(`../public/images/uncharted-${name}.webp`, import.meta.url),
      ),
    )
      .resize(1400, 467)
      .composite([{ input: Buffer.from(overlay.replaceAll(" & ", " &amp; ")) }])
      .png()
      .toBuffer();
    rows.push({ input: image, left: 0, top: region * 487 });
  }
  await sharp({
    create: { width: 1400, height: 1441, channels: 3, background: "#091712" },
  })
    .composite(rows)
    .png()
    .toFile(
      fileURLToPath(
        new URL("../artifacts/terrain-level-placement.png", import.meta.url),
      ),
    );
  console.log(
    "Terrain-aligned placement preview: artifacts/terrain-level-placement.png",
  );
}
console.log(
  `Rendered all ${motifs.length} artwork motifs. Preview: artifacts/forest-danger-emblems.html`,
);
if (process.argv.includes("--serve")) {
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
  server.listen(3104, "127.0.0.1", () =>
    console.log("Preview: http://127.0.0.1:3104"),
  );
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

import { readFile, mkdir, stat } from "node:fs/promises";
import sharp from "sharp";
const sources = JSON.parse(
  (
    await readFile(process.argv[2] || "tmp/mission-image-sources.json", "utf8")
  ).replace(/^\uFEFF/, ""),
);
await mkdir("public/images/research-missions", { recursive: true });
let bytes = 0;
for (const source of sources) {
  const suffix = source.revision ? `-v${source.revision}` : "";
  const output = `public/images/research-missions/${source.id}${suffix}.webp`;
  await sharp(source.path)
    .resize(640, 960, { fit: "cover" })
    .webp({ quality: 82, effort: 5 })
    .toFile(output);
  bytes += (await stat(output)).size;
}
console.log(
  `Optimized ${sources.length} mission backgrounds (${Math.round(bytes / 1024)} KB total).`,
);

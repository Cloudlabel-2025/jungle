import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const sources = JSON.parse(
  await readFile("docs/character-image-sources.json", "utf8"),
);
await mkdir("public/images/characters", { recursive: true });
const tiles = [];
for (const [i, { key, variant, path }] of sources.entries()) {
  const output = await sharp(path)
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  await writeFile(`public/images/characters/${key}-${variant}.webp`, output);
  tiles.push({
    input: await sharp(output).resize(220, 220).toBuffer(),
    left: Math.floor(i / 2) * 220,
    top: (i % 2) * 220,
  });
}
await sharp({
  create: { width: 1100, height: 440, channels: 3, background: "#0b211a" },
})
  .composite(tiles)
  .jpeg({ quality: 88 })
  .toFile("artifacts/cartoon-3d-characters.jpg");
console.log(`Saved ${sources.length} optimized 3D cartoon portraits.`);

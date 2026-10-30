import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const manifest = JSON.parse(
  await readFile("docs/level-image-sources.json", "utf8"),
);
await mkdir("public/images/levels", { recursive: true });
for (const { key, path } of manifest) {
  const output = await sharp(path)
    .resize(960, 640, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(`public/images/levels/${key}.webp`, output);
  console.log(`${key}: ${Math.round(output.length / 1024)} KB`);
}

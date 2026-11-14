import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile("artifacts/pip-character-generation.json", "utf8"),
);
await mkdir("artifacts/pip-characters", { recursive: true });
await mkdir("public/images/pip", { recursive: true });
let total = 0;
for (const asset of manifest.assets) {
  // Preserve the generated master and its alpha; resize only for web delivery.
  await copyFile(asset.source, asset.original);
  const metadata = await sharp(asset.original).metadata();
  if (!metadata.hasAlpha)
    throw new Error(`${asset.expression} is missing transparency`);
  await sharp(asset.original)
    .resize(600, 400, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 88, alphaQuality: 100, effort: 6 })
    .toFile(asset.web);
  const alpha = await sharp(asset.web).extractChannel("alpha").stats();
  if (alpha.channels[0].min !== 0 || alpha.channels[0].max !== 255)
    throw new Error(`${asset.expression} alpha is not usable`);
  const bytes = (await stat(asset.web)).size;
  total += bytes;
  console.log(
    `${asset.expression}: transparent 600x400 WebP, ${Math.round(bytes / 1024)} KB`,
  );
}
console.log(`Five Pip expressions: ${Math.round(total / 1024)} KB total.`);

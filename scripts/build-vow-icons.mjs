// Deterministic SVG clipping keeps the existing VOW artwork unchanged.
// PNG exports are used by browsers and installed-app manifests.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const directory = new URL("../public/brand/", import.meta.url);
const artwork = await sharp(
  await readFile(new URL("vow-logo-v2.webp", directory)),
)
  .resize(512, 512)
  .png()
  .toBuffer();
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512"><defs><clipPath id="vow-circle"><circle cx="256" cy="256" r="256"/></clipPath></defs><image width="512" height="512" xlink:href="data:image/png;base64,${artwork.toString("base64")}" clip-path="url(#vow-circle)"/></svg>`;
await writeFile(new URL("vow-logo-round-v3.svg", directory), svg);
for (const size of [16, 32, 64, 180, 192, 512]) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3];
  if (
    [
      alpha(0, 0),
      alpha(size - 1, 0),
      alpha(0, size - 1),
      alpha(size - 1, size - 1),
    ].some((value) => value !== 0) ||
    alpha(size >> 1, size >> 1) !== 255
  )
    throw new Error(
      `The ${size}px icon must have transparent corners and opaque artwork.`,
    );
  await writeFile(new URL(`vow-icon-round-v3-${size}.png`, directory), png);
}
console.log(
  "Generated the circular VOW SVG logo and six transparent PNG icon sizes.",
);

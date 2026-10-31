import fs from 'node:fs/promises';
import sharp from 'sharp';
const sources = JSON.parse(await fs.readFile(new URL('../docs/camp-character-sprites.json', import.meta.url), 'utf8'));
const directory = new URL('../public/images/characters/camp/', import.meta.url);
await fs.mkdir(directory, {recursive:true});
for (const {key,path} of sources) {
  const metadata = await sharp(path).metadata();
  if (!metadata.hasAlpha) throw Error(`Sprite ${key} must have alpha transparency.`);
  await sharp(path).resize(768,1024,{fit:'fill'}).webp({quality:90,alphaQuality:100}).toFile(new URL(`${key}.webp`,directory).pathname.replace(/^\/(\w:)/,'$1'));
  console.log(`${key}: 6 frames, alpha, 768x1024`);
}

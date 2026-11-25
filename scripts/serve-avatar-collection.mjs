// Original sticker artwork preview only; no accounts or gameplay state.
import { createServer } from "node:http";
import { defaultAvatar, avatarColorways } from "../lib/avatar.js";
import { stickerImage } from "../lib/avatar-stickers.js";
const looks = [
  ["male", "slickBack", "cardigan", "Slicked back · Camp scarf"],
  ["female", "bixie", "puffer", "Bixie highlights · Ribbon bow"],
  ["male", "cornrows", "sweater", "Ombré cornrows · Star studs"],
  ["female", "twinTails", "polo", "Split dye · Flower clip"],
  ["male", "topKnot", "jumpsuit", "Utility jumpsuit · Beanie"],
  ["female", "fishtail", "sherwani", "Fishtail braid · Artist beret"],
  ["female", "shag", "lehenga", "Curly shag · Explorer crown"],
  ["male", "sidePart", "denim", "Classic side part · Bucket hat"],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Explorer wardrobe collection</title><style>body{margin:0;padding:22px;background:#102b20;color:#ead7a6;font:14px Georgia}h1{font-size:25px;font-weight:400;margin:0 0 8px}p{margin:0 0 18px;color:#acbf97}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{padding:12px;border:1px solid #899e5b66;border-radius:20px;background:radial-gradient(ellipse,#56753b55,#18392a);text-align:center}img{display:block;width:100%;height:235px;object-fit:contain}strong{display:block;margin-top:8px;font-size:14px;font-weight:400}</style></head><body><h1>New looks for your voyage</h1><p>Fictional character preview · Every hairstyle and outfit is available for both styles.</p><main>${looks.map(([style, hair, outfit, label], i) => `<article><img src="${stickerImage({ ...defaultAvatar(style), ...Object.fromEntries(Object.entries(avatarColorways[i % 6]).filter(([k]) => k !== "name")), hair, outfit, hairDye: ["solid", "highlights", "ombre", "split"][i % 4], hairAccentColor: "#c75d87", accessory: ["scarf", "bow", "studs", "flower", "beanie", "beret", "crown", "bucket"][i], expression: i % 2 ? "grin" : "smile", skin: ["#ae754f", "#ce966b", "#653d2c", "#e6b58e"][i % 4], hairColor: ["#211916", "#79533a", "#c99455", "#76558c"][i % 4] }, { mood: i % 3 === 0 ? "celebrate" : "ready" })}" alt="${label}"><strong>${label}</strong></article>`).join("")}</main></body></html>`;
createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(3193, "127.0.0.1", () =>
  console.log("Fictional wardrobe preview http://127.0.0.1:3193"),
);

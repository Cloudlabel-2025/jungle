import { createServer } from "node:http";
import { defaultAvatar } from "../lib/avatar.js";
import { profilePoses } from "../lib/avatar-profile-poses.js";
import { stickerImage } from "../lib/avatar-stickers.js";
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Profile pose collection</title><style>body{margin:0;padding:18px;background:#102b20;color:#ead7a6;font:14px Georgia}h1{font-size:24px;margin:0 0 12px;font-weight:400}main{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}article{text-align:center;background:#1a3929;border:1px solid #6b855755;border-radius:16px;padding:7px}img{height:120px;width:100%;object-fit:contain;display:block}span{display:block;margin-top:4px;font-size:12px}</style></head><body><h1>Your profile. Your signature pose. · Fictional art review</h1><main>${profilePoses.map(({ key, label }, i) => `<article><img src="${stickerImage({ ...defaultAvatar(i % 2 ? "female" : "male"), hair: i % 2 ? "butterfly" : "wolf", hairDye: "ombre", hairAccentColor: i % 2 ? "#76558c" : "#79533a", profilePose: key, outfit: i % 2 ? "cardigan" : "denim" }, { portrait: true })}" alt="${label}"><span>${label}</span></article>`).join("")}</main></body></html>`;
createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  if (req.url === "/details") {
    const chosen = ["hello", "peace", "heart", "folded", "salute", "book"];
    const cards = profilePoses
      .filter((p) => chosen.includes(p.key))
      .map(
        ({ key, label }, i) =>
          `<article><img src="${stickerImage({ ...defaultAvatar(i % 2 ? "female" : "male"), hair: i % 2 ? "braids" : "locs", hairDye: "ombre", hairAccentColor: i % 2 ? "#76558c" : "#79533a", profilePose: key, outfit: i % 2 ? "jersey" : "hoodie", accessory: i % 2 ? "flower" : "headphones" }, { portrait: true })}" alt="${label}"><span>${label}</span></article>`,
      )
      .join("");
    res.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>Refined hand gestures</title><style>body{margin:0;padding:16px;background:#102b20;color:#ead7a6;font:15px Georgia}h1{font-size:24px;font-weight:400;margin:0 0 12px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}article{text-align:center;background:#1a3929;border:1px solid #6b855755;border-radius:16px;padding:9px}img{height:265px;width:100%;object-fit:contain;display:block}span{display:block;margin-top:3px}</style></head><body><h1>Refined hands · Selected hair, clothes and accessories retained</h1><main>${cards}</main></body></html>`,
    );
  } else res.end(html);
}).listen(3194, "127.0.0.1", () =>
  console.log("Fictional profile pose preview http://127.0.0.1:3194"),
);

import { createServer } from "node:http";
import { defaultAvatar } from "../lib/avatar.js";
import { profileBackgrounds } from "../lib/avatar-profile-backgrounds.js";
import { stickerImage } from "../lib/avatar-stickers.js";
const avatar = {
  ...defaultAvatar("female"),
  hair: "braids",
  hairDye: "ombre",
  hairAccentColor: "#76558c",
  outfit: "jersey",
  profilePose: "peace",
  accessory: "flower",
};
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Profile background collection</title><style>body{margin:0;padding:16px;background:#102b20;color:#ead7a6;font:14px Georgia}h1{font-size:24px;font-weight:400;margin:0 0 12px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}article{text-align:center;border:1px solid #6b855755;background:#1a3929;border-radius:16px;padding:7px}img{display:block;width:100%;height:174px;object-fit:contain}span{display:block;margin:4px 0;font-size:13px}</style></head><body><h1>Your profile, your scenery · Fictional character preview</h1><main>${profileBackgrounds.map(({ key, label }) => `<article><img src="${stickerImage({ ...avatar, profileBackground: key }, { portrait: true })}" alt="${label}"><span>${label}</span></article>`).join("")}</main></body></html>`;
createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(3195, "127.0.0.1", () =>
  console.log("Fictional profile backgrounds http://127.0.0.1:3195"),
);

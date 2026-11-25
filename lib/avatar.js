// The only persisted likeness data is this bounded, editable cartoon recipe.
// Never store selfies, raw landmarks, embeddings or a detected gender here.
import { profilePoses } from "./avatar-profile-poses.js";
import { profileBackgrounds } from "./avatar-profile-backgrounds.js";
export const avatarOptions = {
  style: ["male", "female"],
  hair: [
    "crop",
    "swept",
    "curls",
    "afro",
    "bob",
    "long",
    "braids",
    "bun",
    "bald",
    "fade",
    "curtains",
    "wolf",
    "pixie",
    "locs",
    "ponytail",
    "spaceBuns",
    "wavy",
    "quiff",
    "buzz",
    "frenchCrop",
    "mullet",
    "butterfly",
    "sideBraid",
    "doublePuffs",
    "halfUp",
    "slickBack", "bixie", "fishtail", "cornrows", "twinTails", "shag", "topKnot", "sidePart",
  ],
  outfit: [
    "explorer",
    "hoodie",
    "varsity",
    "shirt",
    "suit",
    "kurta",
    "dress",
    "sari",
    "bomber",
    "denim",
    "tracksuit",
    "cargo",
    "dungarees",
    "jersey",
    "lehenga",
    "robe",
    "cardigan", "puffer", "sweater", "polo", "jumpsuit", "sherwani",
  ],
  glasses: ["none", "round", "square", "sunglasses"],
  facialHair: ["none", "stubble", "beard", "moustache"],
  accessory: ["none", "earrings", "headphones", "cap", "beanie", "bucket", "beret", "bow", "flower", "studs", "crown", "scarf"],
  hairDye: ["solid", "highlights", "ombre", "split"],
  shoes: ["boots", "sneakers", "formal"],
  expression: ["soft", "smile", "grin"],
  pose: ["relaxed", "confident", "wave"],
  profilePose: profilePoses.map(p=>p.key),
  profileBackground: profileBackgrounds.map(b=>b.key),
  body: ["balanced", "slender", "broad"],
};
export const avatarColors = {
  skin: [
    "#f4d5b7",
    "#e6b58e",
    "#ce966b",
    "#ae754f",
    "#8c5538",
    "#653d2c",
    "#43291f",
  ],
  hairColor: [
    "#211916",
    "#493025",
    "#79533a",
    "#c99455",
    "#dcc7a1",
    "#a94535",
    "#73757b",
    "#76558c",
    "#c75d87",
    "#547b8a",
    "#b36b40",
    "#c8c7d2",
    "#426cb0", "#3a9b89", "#9b425b", "#f0b58e", "#b1a0da", "#e8ddd0",
  ],
  hairAccentColor: ["#dcc7a1", "#c8c7d2", "#c75d87", "#76558c", "#426cb0", "#3a9b89", "#f0b58e", "#b1a0da", "#e8ddd0", "#a94535"],
  eyeColor: ["#38271e", "#78563a", "#667749", "#52798a", "#69717e"],
  topColor: [
    "#d78642",
    "#588d76",
    "#4d7597",
    "#aa526c",
    "#795d9b",
    "#e0c797",
    "#303d48",
    "#e9e0ce",
    "#3264c8",
    "#be373f",
    "#258b88",
    "#c0a3df",
    "#eb9dba",
    "#a9bd64",
    "#f2b645",
    "#322b45",
  ],
  bottomColor: ["#293a46", "#535544", "#755645", "#dad0b9", "#272b32", "#466f9d", "#ddd5e8", "#874354", "#f1e5ce", "#304d42"],
  accentColor: ["#e7bd70", "#d9e6df", "#e48c92", "#80c5bc", "#aa9dd1", "#f4f0e6", "#e78345", "#c5dc72", "#477dcc", "#e55777"],
};
export const avatarColorways = [
  { name: "Forest gold", topColor: "#588d76", bottomColor: "#304d42", accentColor: "#e7bd70" },
  { name: "Cobalt club", topColor: "#3264c8", bottomColor: "#293a46", accentColor: "#f4f0e6" },
  { name: "Sunset", topColor: "#be373f", bottomColor: "#755645", accentColor: "#f2b645" },
  { name: "Lilac dream", topColor: "#c0a3df", bottomColor: "#ddd5e8", accentColor: "#f4f0e6" },
  { name: "Midnight", topColor: "#303d48", bottomColor: "#272b32", accentColor: "#d9e6df" },
  { name: "Rose bloom", topColor: "#eb9dba", bottomColor: "#874354", accentColor: "#e7bd70" },
];
export const avatarRanges = {
  faceWidth: [0.84, 1.16],
  faceLength: [0.88, 1.12],
  jaw: [0.8, 1.18],
  eyeSize: [0.8, 1.2],
  eyeSpacing: [0.85, 1.15],
  nose: [0.75, 1.25],
  mouth: [0.8, 1.2],
  brows: [0.7, 1.3],
};
export function defaultAvatar(style = "male") {
  return {
    version: 1,
    style: style === "female" ? "female" : "male",
    hair: style === "female" ? "long" : "swept",
    outfit: "explorer",
    glasses: "none",
    facialHair: "none",
    accessory: "none",
    shoes: "boots",
    expression: "smile",
    pose: "relaxed",
    profilePose: "classic",
    profileBackground: "forest",
    body: "balanced",
    skin: "#ae754f",
    hairColor: "#211916",
    hairDye: "solid",
    hairAccentColor: "#dcc7a1",
    eyeColor: "#38271e",
    topColor: "#588d76",
    bottomColor: "#293a46",
    accentColor: "#e7bd70",
    ...Object.fromEntries(Object.keys(avatarRanges).map((k) => [k, 1])),
  };
}
export function validateAvatar(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Create an avatar before saving.");
  const allowed = new Set(Object.keys(defaultAvatar()));
  if (Object.keys(input).some((k) => !allowed.has(k)))
    throw new Error(
      "Only avatar settings can be saved. Photos and scan data are not accepted.",
    );
  if (input.version !== 1)
    throw new Error("This avatar version is not supported.");
  const result = { version: 1 };
  for (const [key, options] of Object.entries(avatarOptions)) {
    const value = input[key] ?? (["expression", "pose", "body", "hairDye", "profilePose", "profileBackground"].includes(key) ? defaultAvatar()[key] : undefined);
    if (!options.includes(value))
      throw new Error(`Choose a valid ${key}.`);
    result[key] = value;
  }
  for (const key of Object.keys(avatarColors)) {
    const value = input[key] ?? (key === "hairAccentColor" ? defaultAvatar()[key] : undefined);
    if (typeof value !== "string" || !/^#[a-f0-9]{6}$/i.test(value))
      throw new Error(`Choose a valid ${key} color.`);
    result[key] = value.toLowerCase();
  }
  for (const [key, [min, max]] of Object.entries(avatarRanges)) {
    if (
      typeof input[key] !== "number" ||
      !Number.isFinite(input[key]) ||
      input[key] < min ||
      input[key] > max
    )
      throw new Error(`Choose a valid ${key} shape.`);
    result[key] = Math.round(input[key] * 100) / 100;
  }
  return result;
}
export function avatarFor(player = {}) {
  try {
    return validateAvatar(
      player.avatar?.toObject ? player.avatar.toObject() : player.avatar,
    );
  } catch {
    return defaultAvatar(player.characterVariant);
  }
}
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
// Convert a transient landmark mesh to eight coarse, user-editable proportions.
export function featuresFromLandmarks(faces, width, height) {
  if (!faces?.length)
    throw new Error(
      "No face found. Face the camera in even light and try again.",
    );
  if (faces.length !== 1)
    throw new Error("Keep just your face in the frame and try again.");
  const p = faces[0];
  if (
    p.length < 468 ||
    p.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y))
  )
    throw new Error("The scan was incomplete. Please try again.");
  const d = (a, b) =>
    Math.hypot((p[a].x - p[b].x) * width, (p[a].y - p[b].y) * height);
  const fw = d(234, 454),
    fh = d(10, 152),
    left = d(1, 234),
    right = d(1, 454);
  if (
    fw < 110 ||
    fh < 140 ||
    p[10].y < 0.03 ||
    p[152].y > 0.97 ||
    p[234].x < 0.02 ||
    p[454].x > 0.98
  )
    throw new Error("Move closer and keep your whole face inside the frame.");
  if (
    Math.abs(left - right) / fw > 0.2 ||
    (Math.abs(p[33].y - p[263].y) * height) / fw > 0.12
  )
    throw new Error(
      "Look straight ahead and keep your head level for the scan.",
    );
  const quantize = (key, n) =>
    Math.round(clamp(n, ...avatarRanges[key]) * 100) / 100;
  return {
    faceWidth: quantize("faceWidth", fw / fh / 0.75),
    faceLength: quantize("faceLength", fh / fw / 1.34),
    jaw: quantize("jaw", d(172, 397) / fw / 0.78),
    eyeSize: quantize("eyeSize", (d(33, 133) + d(362, 263)) / fw / 0.43),
    eyeSpacing: quantize("eyeSpacing", d(133, 362) / fw / 0.25),
    nose: quantize("nose", d(98, 327) / fw / 0.23),
    mouth: quantize("mouth", d(61, 291) / fw / 0.38),
    brows: quantize("brows", (d(70, 105) + d(300, 334)) / fw / 0.25),
  };
}

// All interpolated values below pass through validateAvatar; no user markup.
export function avatarSvg(input, fullBody = false) {
  let a;
  try {
    a = validateAvatar(input);
  } catch {
    a = defaultAvatar();
  }
  const shade = (hex, factor) => "#" + [1,3,5].map(i => Math.max(0,Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*factor))).toString(16).padStart(2,"0")).join("");
  const f = a.style === "female",
    w = 55 * a.faceWidth,
    h = 68 * a.faceLength,
    eye = 9 * a.eyeSize,
    spacing = 22 * a.eyeSpacing;
  const long = ["long", "braids", "bob"].includes(a.hair),
    skirt = ["dress", "sari"].includes(a.outfit),
    casual = ["hoodie", "varsity", "explorer"].includes(a.outfit);
  const stroke =
    'stroke="#30271f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const eyes = [-1, 1]
    .map(
      (s) =>
        `<g transform="translate(${150 + s * spacing} 121)"><path d="M ${-eye - 3} 0 Q 0 ${-eye * 1.4} ${eye + 3} 0 Q 0 ${eye} ${-eye - 3} 0" fill="#fff5e5" ${stroke}/><ellipse rx="${eye * 0.55}" ry="${eye * 0.72}" fill="${a.eyeColor}"/><ellipse rx="${eye * 0.25}" ry="${eye * 0.55}" fill="#211c19"/><circle cx="-2" cy="-3" r="2" fill="white"/><path d="M -12 -15 Q 0 ${-20 * a.brows} 12 -15" fill="none" stroke="${a.hairColor}" stroke-width="4" stroke-linecap="round"/></g>`,
    )
    .join("");
  const hairFront = {
    bald: "",
    crop: `<path d="M 94 103 Q 90 44 150 45 Q 211 44 207 101 L 192 81 Q 147 66 108 83 Z"/>`,
    swept: `<path d="M 94 108 Q 77 51 125 38 Q 166 16 207 59 L 216 82 Q 185 70 172 58 Q 145 99 102 89 Z"/>`,
    curls: Array.from(
      { length: 13 },
      (_, i) =>
        `<circle cx="${99 + i * 8.5}" cy="${64 + Math.sin(i * 1.7) * 10}" r="17"/>`,
    ).join(""),
    afro: `<path d="M 89 116 Q 61 99 76 72 Q 60 43 94 35 Q 103 6 131 22 Q 157 -1 179 23 Q 212 14 221 49 Q 244 73 214 116 L 198 82 Q 148 59 103 83 Z"/>`,
    bob: `<path d="M 88 163 Q 74 46 129 39 Q 194 15 215 89 L 211 166 L 197 146 L 195 79 Q 131 97 109 72 L 103 153 Z"/>`,
    long: `<path d="M 87 196 Q 72 76 103 49 Q 150 15 194 49 Q 224 74 216 197 L 196 176 L 193 78 Q 153 95 119 68 L 106 178 Z"/>`,
    braids:
      `<path d="M 92 95 Q 83 41 145 37 Q 209 33 207 97 L 191 78 Q 145 66 108 82 Z"/>` +
      [-1, 1]
        .map((s) =>
          Array.from(
            { length: 9 },
            (_, i) =>
              `<ellipse cx="${150 + s * (53 + Math.sin(i) * 3)}" cy="${100 + i * 12}" rx="9" ry="10"/>`,
          ).join(""),
        )
        .join(""),
    bun: `<circle cx="150" cy="35" r="27"/><path d="M 93 110 Q 80 44 148 44 Q 215 42 207 107 L 192 82 Q 142 80 108 82 Z"/>`,
  }[a.hair] ?? '<path d="M94 105 Q80 40 150 38 Q220 38 207 105 L192 80 Q150 65 108 85Z"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fullBody ? "0 0 300 540" : "65 22 170 185"}"><defs><linearGradient id="skin" x2=".9" y2="1"><stop stop-color="${shade(a.skin,1.08)}"/><stop offset="1" stop-color="${shade(a.skin,.88)}"/></linearGradient><linearGradient id="cloth" x2="1" y2="1"><stop stop-color="${shade(a.topColor,1.12)}"/><stop offset="1" stop-color="${shade(a.topColor,.8)}"/></linearGradient></defs>
  ${fullBody ? '<ellipse cx="150" cy="516" rx="80" ry="12" fill="#000" opacity=".15"/>' : ""}
  ${long ? `<path d="M 96 80 Q 69 160 91 243 L 211 243 Q 235 137 201 72 Z" fill="${a.hairColor}"/>` : ""}
  <g ${stroke}><path d="M 112 326 L 111 476 L 144 478 L 153 348 L 160 478 L 193 476 L 187 326 Z" fill="${a.bottomColor}"/>
  ${[110, 161].map((x) => `<path d="M ${x} 470 L ${x + 31} 470 L ${x + 36} 504 Q ${x + 15} 518 ${x - 13} 507 L ${x - 12} 492 Z" fill="${a.shoes === "sneakers" ? a.accentColor : "#303333"}"/><path d="M ${x - 10} 506 L ${x + 35} 506" stroke="#e3d8bc" stroke-width="5"/>${[482, 488, 494].map((y) => `<path d="M ${x + 2} ${y} l 16 0" stroke="${a.accentColor}"/>`).join("")}`).join("")}
  <path d="M 103 202 Q 78 207 74 238 L 61 328 Q 57 349 69 358 Q 83 367 87 346 L 109 260 M 197 202 Q 221 208 226 238 L 239 328 Q 243 349 231 358 Q 217 367 213 346 L 192 260" fill="${a.skin}"/>
  <path d="${f ? "M 124 188 L 106 198 Q 89 211 85 244 L 106 252 Q 119 284 103 330 Q 151 350 198 330 Q 182 284 195 252 L 215 244 Q 210 211 194 198 L 177 188 Z" : "M 124 188 L 100 198 Q 85 211 81 244 L 101 254 L 105 330 Q 151 347 194 330 L 198 254 L 219 244 Q 214 210 200 199 L 177 188 Z"}" fill="url(#cloth)"/>
  ${skirt ? `<path d="M 106 293 Q 94 356 83 423 Q 150 446 218 423 L 193 294 Z" fill="${a.topColor}"/><path d="M 113 319 L 104 417 M 136 322 L 132 425 M 163 322 L 169 425 M 185 319 L 197 417" opacity=".3"/>` : ""}
  ${a.outfit === "kurta" ? `<path d="M 104 267 L 99 387 L 201 387 L 195 267" fill="${a.topColor}"/><path d="M 150 208 L 150 273 M 143 215 L 157 215" stroke="${a.accentColor}" stroke-width="4"/>` : ""}
  ${a.outfit === "sari" ? `<path d="M 188 196 L 113 328 L 83 423 L 109 428 L 207 211 Z" fill="${a.accentColor}"/><path d="M 182 202 L 109 330 L 89 415" fill="none" stroke="${a.topColor}" stroke-width="5"/>` : ""}
  ${a.outfit === "suit" ? `<path d="M 127 195 L 149 264 L 174 194 L 162 244 L 150 289 L 134 244 Z" fill="#e9dfcf"/><path d="M 148 212 L 140 250 L 151 269 L 161 250 L 154 212 Z" fill="${a.accentColor}"/>` : ""}
  ${casual ? `<path d="M 150 215 L 150 332" stroke="${a.accentColor}" stroke-width="3"/><path d="M 110 281 L 136 281 L 136 305 L 110 305 Z M 166 281 L 190 281 L 190 305 L 166 305 Z" fill="${a.accentColor}" opacity=".7"/>` : ""}
  ${a.outfit === "hoodie" ? `<path d="M 117 196 Q 91 203 115 239 L 150 219 L 183 239 Q 208 204 177 195" fill="${a.topColor}"/><path d="M 134 220 L 132 258 M 166 220 L 168 258" stroke="${a.accentColor}"/>` : ""}
  ${a.outfit === "varsity" ? `<path d="M 88 214 L 77 244 L 98 252 L 108 220 M 193 220 L 202 252 L 222 244 L 212 213" fill="${a.accentColor}"/><path d="M 175 246 L 183 228 L 191 246" fill="none" stroke="${a.accentColor}" stroke-width="4"/>` : ""}
  ${["shirt", "suit", "explorer"].includes(a.outfit) ? `<path d="M 123 195 L 150 216 L 130 237 L 111 205 M 177 195 L 150 216 L 169 237 L 189 205" fill="${a.accentColor}"/>` : ""}
  <path d="M 132 169 L 131 198 Q 151 219 171 198 L 168 169" fill="${a.skin}"/>
  <ellipse cx="${150 - w}" cy="126" rx="10" ry="17" fill="${a.skin}"/><ellipse cx="${150 + w}" cy="126" rx="10" ry="17" fill="${a.skin}"/>
  <path d="M 150 ${121 - h} C ${150 + w * 1.2} ${121 - h}, ${150 + w} 137, ${150 + w * a.jaw * 0.8} 157 Q 150 ${125 + h * 1.2} ${150 - w * a.jaw * 0.8} 157 C ${150 - w} 137, ${150 - w * 1.2} ${121 - h}, 150 ${121 - h} Z" fill="url(#skin)"/>
  <path d="M ${150 - 6 * a.nose} 129 Q ${150 - 9 * a.nose} 145 150 146 L ${150 + 8 * a.nose} 143" fill="none" stroke="#623c2c" opacity=".6"/>
  ${eyes}<path d="M ${150 - 16 * a.mouth} 160 Q 150 ${f ? 173 : 169} ${150 + 16 * a.mouth} 160 Q 150 163 ${150 - 16 * a.mouth} 160" fill="${f ? "#a35354" : "#7f4738"}" stroke="#75432f" stroke-width="1.5"/>
  <path d="M 134 179 Q 150 186 166 179" fill="none" opacity=".15"/>
  <g fill="${a.hairColor}" stroke="${a.hairColor}">${hairFront}</g>
  ${a.facialHair === "beard" || a.facialHair === "stubble" ? `<path d="M 103 141 Q 116 184 150 191 Q 184 185 197 141 L 185 169 Q 150 205 115 169 Z" fill="${a.hairColor}" opacity="${a.facialHair === "stubble" ? ".45" : ".9"}" stroke="none"/>` : ""}
  ${["beard", "moustache"].includes(a.facialHair) ? `<path d="M 126 155 Q 142 143 150 152 Q 160 143 175 155 Q 157 161 150 155 Q 140 161 126 155" fill="${a.hairColor}" stroke="none"/>` : ""}
  ${a.glasses !== "none" ? [-1, 1].map((s) => `<${a.glasses === "round" ? "ellipse" : "rect"} ${a.glasses === "round" ? `cx="${150 + s * spacing}" cy="122" rx="19" ry="17"` : `x="${150 + s * spacing - 19}" y="107" width="38" height="29" rx="6"`} fill="${a.glasses === "sunglasses" ? "#25343c" : "#c6e6ed"}" fill-opacity="${a.glasses === "sunglasses" ? ".9" : ".13"}" stroke="#3c3934" stroke-width="3"/>`).join("") + '<path d="M 145 117 Q 150 112 155 117" fill="none"/>' : ""}
  ${a.accessory === "earrings" ? [-1, 1].map((s) => `<circle cx="${150 + s * (w + 1)}" cy="145" r="6" fill="none" stroke="${a.accentColor}" stroke-width="4"/>`).join("") : ""}
  ${a.accessory === "headphones" ? `<path d="M 84 127 L 84 88 Q 94 25 150 29 Q 210 29 216 88 L 216 127" fill="none" stroke="${a.accentColor}" stroke-width="10"/><rect x="76" y="103" width="18" height="39" rx="8" fill="${a.topColor}"/><rect x="206" y="103" width="18" height="39" rx="8" fill="${a.topColor}"/>` : ""}
  ${a.accessory === "cap" ? `<path d="M 88 78 Q 90 26 151 27 Q 213 26 212 78 Z" fill="${a.topColor}"/><path d="M 90 77 Q 166 52 223 86 Q 156 99 90 77" fill="${a.accentColor}"/>` : ""}</g></svg>`;
}
export function avatarImage(avatar, fullBody = false) {
  return `data:image/svg+xml,${encodeURIComponent(avatarSvg(avatar, fullBody))}`;
}

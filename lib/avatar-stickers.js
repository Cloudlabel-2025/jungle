import { avatarFor } from "./avatar.js";
import { profileSticker } from "./avatar-profile-renderer.js";
import { refinedHair } from "./avatar-hair-refinements.js";
import {
  expandedHair,
  expandedOutfit,
  expandedAccessory,
  hairGradient,
} from "./avatar-expansion.js";

export const stickerMoods = [
  "ready",
  "celebrate",
  "cheer",
  "sad",
  "determined",
  "wave",
];
export function resultSticker(result) {
  if (!result) return null;
  if (result.completed === true || result.status === "CLEARED")
    return "celebrate";
  if (
    ["FAILED", "RETURNED", "RETRY", "INCORRECT", "NOT_COMPLETED"].includes(
      result.status,
    )
  )
    return "sad";
  if (
    ["PENDING", "REVIEW", "REVIEW_REQUIRED", "AWAITING_REVIEW"].includes(
      result.status,
    )
  )
    return "determined";
  return result.completed === false ? "sad" : null;
}
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function stickerSvg(
  input,
  {
    mood = "ready",
    portrait = false,
    animated = false,
    profile = portrait,
  } = {},
) {
  const a = avatarFor({ avatar: input }),
    emotion = stickerMoods.includes(mood) ? mood : "ready";
  if (portrait && profile)
    return profileSticker(a, stickerSvg(a, { profile: false }));
  const hairPaint = a.hairDye === "solid" ? a.hairColor : "url(#sticker-hair)";
  const win = emotion === "celebrate" || emotion === "cheer",
    sad = emotion === "sad",
    wave = emotion === "wave" || (emotion === "ready" && a.pose === "wave");
  const female = a.style === "female",
    ink = "#352b25",
    long = ["long", "wavy", "butterfly", "halfUp"].includes(a.hair),
    scale = a.body === "broad" ? 1.08 : a.body === "slender" ? 0.93 : 1;
  const w = 57 * a.faceWidth,
    h = 66 * a.faceLength,
    xEye = 25 * a.eyeSpacing,
    eye = 10 * a.eyeSize;
  const outline = `stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const mouthWidth = 17 * a.mouth,
    iris = a.eyeColor;
  const eyebrow = [-1, 1]
    .map((s) => {
      const x = 160 + s * xEye;
      const brow = sad
        ? `M ${x - 13} 117 Q ${x - s * 9} ${s === -1 ? 104 : 108} ${x + 13} 116`
        : `M ${x - 14} 112 Q ${x} ${101 - (a.brows - 1) * 12} ${x + 14} 112`;
      const eyeShape = win
        ? `<path d="M ${x - eye - 2} 132 Q ${x} 115 ${x + eye + 2} 132" fill="none" stroke="${ink}" stroke-width="4"/>`
        : `<path d="M ${x - eye - 5} 130 Q ${x} ${sad ? 119 : 115} ${x + eye + 5} 130 Q ${x} ${sad ? 141 : 143} ${x - eye - 5} 130 Z" fill="#fff9e9" stroke="${ink}" stroke-width="1.8"/><ellipse cx="${x}" cy="${sad ? 133 : 130}" rx="${eye * 0.65}" ry="${eye * 0.83}" fill="${iris}"/><ellipse cx="${x}" cy="${sad ? 134 : 131}" rx="${eye * 0.32}" ry="${eye * 0.65}" fill="${ink}"/><circle cx="${x - 3}" cy="${sad ? 130 : 127}" r="2.8" fill="#fffdf2"/>`;
      return `<g><g class="sticker-eye eye-${s < 0 ? "left" : "right"}">${eyeShape}</g><path d="${brow}" fill="none" stroke="${a.hairColor}" stroke-width="${female ? 4 : 5.5}" stroke-linecap="round"/>${female && !win ? `<path d="M ${x + s * (eye + 3)} 127 l ${s * 5} -5 M ${x + s * (eye + 1)} 124 l ${s * 3} -5" stroke="${ink}" stroke-width="1.8" fill="none"/>` : ""}</g>`;
    })
    .join("");
  let mouth;
  if (sad)
    mouth = `<path d="M ${160 - mouthWidth * 0.65} 174 Q 160 160 ${160 + mouthWidth * 0.65} 174" fill="none" stroke="#864b40" stroke-width="3.5"/><path d="M 197 146 C 190 158 189 164 197 165 C 205 164 204 158 197 146 Z" fill="#73c7d5" stroke="#3c8a9a" stroke-width="1.4" class="sticker-tear"/>`;
  else if (win)
    mouth = `<g class="sticker-smile"><path d="M ${160 - mouthWidth} 168 Q 160 175 ${160 + mouthWidth} 168 Q 160 192 ${160 - mouthWidth} 168 Z" fill="#784b43" stroke="#70473d" stroke-width="1.8"/><path d="M ${162 - mouthWidth} 170 Q 160 176 ${158 + mouthWidth} 170 L ${157 + mouthWidth * 0.72} 175 Q 160 179 ${163 - mouthWidth * 0.72} 175 Z" fill="#fff1db"/><path d="M ${155 - mouthWidth} 165l-3 3 M ${165 + mouthWidth} 165l3 3" stroke="#a06b53" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`;
  else if (a.expression === "grin")
    mouth = `<g class="sticker-smile"><path d="M ${160 - mouthWidth * 0.88} 170 Q160 176 ${160 + mouthWidth * 0.88} 169 Q162 184 ${160 - mouthWidth * 0.88} 170Z" fill="#87584a" stroke="#805143" stroke-width="1.5"/><path d="M ${162 - mouthWidth * 0.88} 171 Q160 176 ${158 + mouthWidth * 0.88} 171 Q160 180 ${162 - mouthWidth * 0.88} 171Z" fill="#fff1db"/></g>`;
  else if (a.expression === "soft")
    mouth = `<path d="M ${160 - mouthWidth * 0.65} 171 Q 160 175 ${160 + mouthWidth * 0.65} 170" fill="none" stroke="#925147" stroke-width="3"/>`;
  else
    mouth = `<path class="sticker-smile" d="M ${160 - mouthWidth * 0.8} 170 Q 160 180 ${160 + mouthWidth * 0.8} 169" fill="none" stroke="#87594a" stroke-width="2.3" stroke-linecap="round"/>`;
  const hair = {
    ...expandedHair(a),
    quiff: `<path d="M102 112Q91 86 103 66Q93 48 115 37L114 25Q136 38 151 24Q182 6 207 32Q230 47 218 85L215 111L203 92L200 65Q164 89 117 79L112 106Z"/><path d="M117 59Q153 72 193 43 M126 48Q158 57 184 34" fill="none" stroke="#fff1d4" stroke-opacity=".24" stroke-width="3"/>`,
    buzz: `<path d="M102 112Q89 55 157 48Q222 44 219 112L208 100L202 79Q160 64 117 83L112 105Z"/><path d="M109 83Q155 52 209 81" fill="none" stroke="#fff1d4" stroke-opacity=".25" stroke-width="4"/>${Array.from({ length: 19 }, (_, i) => `<path d="M${116 + i * 5} ${70 + Math.sin(i) * 5}l1 3" stroke="#fff1d4" stroke-opacity=".2" stroke-width="1.5"/>`).join("")}`,
    frenchCrop: `<path d="M101 113Q89 60 125 47Q182 26 214 57Q226 77 219 111L207 98L204 85L195 96L185 88L176 98L165 88L153 97L141 87L129 94L117 88L112 105Z"/><path d="M117 66Q157 47 203 67 M125 76l4-7 M145 78l3-9 M165 79l2-10 M187 78l-1-9" fill="none" stroke="#fff1d4" stroke-opacity=".22" stroke-width="2.5"/>`,
    mullet: `<path d="M99 196L96 164L103 120Q86 80 109 57L105 43L130 45L143 30L158 44L182 33L199 46L215 45L215 62Q230 87 215 120L224 171L220 200L205 190L197 98L184 76L165 91L145 75L122 95L114 191Z"/><path d="M106 126L107 180 M213 126L216 182 M125 61l15-7 M158 60l17-8" fill="none" stroke="#fff1d4" stroke-opacity=".24" stroke-width="3"/>`,
    butterfly: `<path d="M95 216Q77 200 88 178Q72 157 92 131Q76 87 105 54Q136 24 160 49Q189 24 215 58Q240 89 224 129Q244 156 229 178Q245 202 221 218L201 203L214 181L202 168L216 144L203 106L193 78Q179 110 164 122L160 61Q145 105 117 122L111 148L123 170L109 188L120 205Z"/><path d="M150 57Q139 86 114 104 M170 57Q185 83 213 105 M101 136L110 154 M219 137L212 155 M98 183L107 198 M223 183L216 200" fill="none" stroke="#fff1d4" stroke-opacity=".25" stroke-width="3"/>`,
    sideBraid: `<path d="M101 115Q85 56 140 41Q205 23 221 104L206 94L196 73Q164 101 118 89L112 108Z"/>${Array.from({ length: 10 }, (_, i) => `<path d="M${211 + Math.sin(i * 0.6) * 5} ${113 + i * 11}q17-8 22 4q-6 16-20 10q-10-4-2-14Z"/>`).join("")}<path d="M218 226l13 1" stroke="${a.accentColor}" stroke-width="6"/><path d="M117 69Q146 50 183 54 M218 134l11 3 M221 166l11 3 M217 199l11 3" fill="none" stroke="#fff1d4" stroke-opacity=".25" stroke-width="3"/>`,
    doublePuffs: `<path d="M104 63Q77 77 66 55Q44 48 55 26Q51 7 76 11Q90-4 105 13Q128 16 120 39Z M203 61Q179 47 196 25Q200 5 222 13Q242 1 252 22Q273 34 258 51Q258 75 232 72Z"/><path d="M100 111Q86 52 157 43Q223 41 222 111L207 93L196 76Q158 95 124 77L113 107Z"/><path d="M69 29q10-10 17 0 M88 44q10-12 17 0 M211 29q10-10 17 0 M235 43q10-12 17 0" fill="none" stroke="#fff1d4" stroke-opacity=".2" stroke-width="2.5"/>`,
    halfUp: `<path d="M140 45Q122 22 145 15Q171 3 185 28Q188 43 175 48Z"/><path d="M94 213Q81 126 99 76Q116 31 160 46Q211 27 225 81Q242 138 226 213L208 202L211 153L201 90Q158 111 122 80L111 151L113 207Z"/><path d="M140 44Q159 54 180 43" stroke="${a.accentColor}" stroke-width="5" fill="none"/><path d="M108 113Q101 159 105 194 M217 114Q225 162 220 198 M145 29Q158 21 172 33" stroke="#fff1d4" stroke-opacity=".24" stroke-width="3" fill="none"/>`,
    fade: `<path d="M100 117 Q90 70 111 57 Q160 25 211 55 Q230 72 220 117 L207 98 L201 74 Q156 95 118 80 L112 104Z"/><path d="M107 89L109 110 M213 88L212 111" stroke="#fff5dd" stroke-opacity=".3" stroke-width="5"/><path d="M112 62q12-18 24-8q14-20 26-9q15-13 26-1q20-7 25 16L200 77Q158 87 116 76Z"/><path d="M125 64l9-8 M151 62l10-10 M178 62l10-8" fill="none" stroke="#fff5dd" stroke-opacity=".22" stroke-width="3"/>`,
    curtains: `<path d="M100 125Q82 74 110 52Q136 29 160 47Q188 28 213 54Q239 85 219 126L204 105L194 77Q182 99 166 108L160 63Q153 93 121 111L114 95Z"/><path d="M153 53Q141 78 116 90 M169 53Q189 65 210 95" stroke="#fff5dd" stroke-opacity=".23" stroke-width="3" fill="none"/>`,
    wolf: `<path d="M93 193L85 172L97 140Q80 82 107 53Q157 14 209 50Q236 74 224 137L238 170L222 166L232 193L206 185L199 99L187 75L174 99L159 69L144 101L130 77L119 111L113 193Z"/><path d="M105 116L100 169 M216 115L224 165 M128 56L119 76 M193 54L205 78" fill="none" stroke="#fff5dd" stroke-opacity=".2" stroke-width="3"/>`,
    pixie: `<path d="M102 116Q85 82 108 55L104 41L127 48L142 29L156 43L180 27L184 43L207 39L210 57Q229 78 218 113L202 93L198 73L176 91L177 70L151 94L154 72L121 101L116 86Z"/><path d="M119 67L139 52 M161 59L179 47 M195 61L204 70" fill="none" stroke="#fff5dd" stroke-opacity=".24" stroke-width="3"/>`,
    locs: `<path d="M100 104Q85 47 146 36Q212 29 223 101L206 88Q159 70 115 90Z"/>${[-1, 1].map((s) => Array.from({ length: 5 }, (_, i) => `<path d="M${160 + s * (43 + i * 5)} ${64 + i * 9}Q${160 + s * (73 + i * 2)} 127 ${160 + s * (56 + i * 4)} ${191 + i * 4}" fill="none" stroke="${ink}" stroke-width="12" stroke-linecap="round"/><path d="M${160 + s * (43 + i * 5)} ${64 + i * 9}Q${160 + s * (73 + i * 2)} 127 ${160 + s * (56 + i * 4)} ${191 + i * 4}" fill="none" stroke="${hairPaint}" stroke-width="8" stroke-linecap="round"/>`).join("")).join("")}<path d="M132 57Q146 73 158 91 M153 48Q172 65 190 83" stroke="#fff5dd" stroke-opacity=".2" stroke-width="3" fill="none"/>`,
    ponytail: `<path d="M192 49Q239 16 249 68Q255 108 233 160L214 178Q231 106 208 88Z"/><path d="M101 110Q84 53 146 39Q207 27 221 104L207 90L198 75Q152 93 117 81L113 106Z"/><path d="M200 50L215 58" stroke="${a.accentColor}" stroke-width="8"/><path d="M112 70Q149 47 192 57 M224 58Q243 95 224 140" fill="none" stroke="#fff5dd" stroke-opacity=".23" stroke-width="3"/>`,
    spaceBuns: `<path d="M114 59Q78 64 79 36Q79 10 109 17Q134 17 131 44Z M190 54Q178 19 207 16Q238 8 241 37Q243 63 212 66Z"/><path d="M100 110Q84 48 158 40Q224 38 221 111L207 93L196 75Q160 96 125 74L113 108Z"/><path d="M90 33Q109 23 119 40 M201 30Q219 24 230 43 M159 43L159 72" fill="none" stroke="#fff5dd" stroke-opacity=".23" stroke-width="3"/>`,
    wavy: `<path d="M100 211Q72 198 89 170Q72 143 91 119Q76 76 107 51Q157 10 207 49Q241 78 227 112Q247 139 229 165Q247 193 222 214L204 196Q221 177 207 157Q222 135 204 111L197 81Q161 101 126 69L113 113Q96 137 111 158Q95 180 113 198Z"/><path d="M103 103Q91 126 103 145T103 190 M217 102Q231 126 218 147T220 192 M130 56Q157 43 187 55" fill="none" stroke="#fff5dd" stroke-opacity=".23" stroke-width="3"/>`,
    bald: "",
    crop: `<path d="M 101 110 Q 91 48 157 46 Q 225 46 220 110 L 205 83 Q 157 72 114 87 Z"/>`,
    swept: `<path d="M 101 119 Q 88 76 110 55 Q 135 28 171 37 Q 207 30 226 67 L 217 88 Q 199 83 185 64 Q 163 100 111 96 Z"/><path d="M 113 76 Q 150 61 173 48 M 119 84 Q 154 74 175 57 M 182 49 Q 204 54 216 73" stroke="${a.hairColor === "#211916" ? "#594435" : "#ffffff"}" stroke-opacity=".28" stroke-width="2" fill="none"/>`,
    curls:
      Array.from(
        { length: 14 },
        (_, i) =>
          `<path d="M ${103 + i * 8} ${78 + Math.sin(i * 2) * 10} c -15 -22 10 -33 20 -16 c 12 15 -9 27 -16 12"/>`,
      ).join("") +
      `<path d="M 103 100 Q 101 64 125 68 L 202 68 Q 222 76 218 109 L 206 88 Q 160 105 115 87 Z"/>`,
    afro:
      `<path d="M 102 121 Q 75 116 82 91 Q 62 76 83 58 Q 77 35 105 32 Q 114 12 138 25 Q 159 7 180 25 Q 209 13 219 39 Q 243 41 238 65 Q 258 87 234 103 Q 237 124 216 125 L 205 91 Q 156 75 115 94 Z"/>` +
      Array.from(
        { length: 9 },
        (_, i) =>
          `<path d="M ${96 + i * 15} ${58 + Math.sin(i * 2) * 11} q -7 -10 1 -15 q 11 -4 12 7" stroke="#ffffff" stroke-opacity=".12" stroke-width="2" fill="none"/>`,
      ).join(""),
    bob: `<path d="M 94 178 Q 84 69 112 48 Q 160 16 204 50 Q 232 82 224 179 L 206 184 L 203 85 Q 153 103 123 70 L 113 184 Z"/><path d="M 100 116 L 106 172 M 217 117 L 214 171" stroke="#ffffff" stroke-opacity=".2" stroke-width="2" fill="none"/>`,
    long: `<path d="M 92 207 Q 77 79 108 50 Q 159 10 207 50 Q 239 79 229 213 L 207 201 L 202 83 Q 167 104 125 69 L 112 208 Z"/><path d="M 100 111 Q 99 164 105 191 M 218 110 Q 225 165 218 199 M 124 58 Q 150 43 178 48" stroke="#fff3d4" stroke-opacity=".18" stroke-width="2.5" fill="none"/>`,
    braids:
      `<path d="M 101 100 Q 89 52 144 39 Q 209 24 221 101 L 206 86 Q 153 70 116 87 Z"/>` +
      [-1, 1]
        .map((s) =>
          Array.from(
            { length: 10 },
            (_, i) =>
              `<path d="M ${160 + s * (55 + Math.sin(i) * 3) - 8} ${101 + i * 10} q 10 -8 17 1 q -4 12 -15 10 q -7 -4 -2 -11"/>`,
          ).join(""),
        )
        .join(""),
    bun: `<path d="M 139 44 C 111 32 127 8 151 15 C 178 -1 201 31 179 45 Z"/><path d="M 100 111 Q 83 50 147 40 Q 215 32 221 110 L 204 84 Q 158 91 116 85 Z"/><path d="M 139 30 Q 158 19 180 30 M 112 72 Q 150 52 196 67" stroke="#fff3d4" stroke-opacity=".18" stroke-width="2" fill="none"/>`,
    ...refinedHair(a),
  }[a.hair];
  const cheerArm = (side) =>
    `<g class="sticker-arm-${side < 0 ? "left" : "right"}" style="transform-origin:${160 + side * 47}px 239px"><path d="M ${160 + side * 47} 233 Q ${160 + side * 77} 212 ${160 + side * 91} 165" fill="none" stroke="${ink}" stroke-width="29"/><path d="M ${160 + side * 47} 233 Q ${160 + side * 77} 212 ${160 + side * 91} 165" fill="none" stroke="${a.topColor}" stroke-width="24"/><path d="M ${160 + side * 87} 174 L ${160 + side * 96} 149" stroke="${ink}" stroke-width="20"/><path d="M ${160 + side * 87} 174 L ${160 + side * 96} 149" stroke="${a.skin}" stroke-width="15"/><path d="M ${160 + side * 96} 152 q ${side * 5} -13 0 -23 l ${side * 8} -8 q 5 -7 9 -2 q 3 3 -1 9 l -3 7 q 12 -5 15 3 q 7 7 -4 17 l -13 11 Z" fill="${a.skin}" ${outline}/></g>`;
  const restArm = (side) => {
    if (side === -1 && wave) return cheerArm(side);
    if (
      side === -1 &&
      !sad &&
      (emotion === "determined" || a.pose === "confident")
    )
      return `<g transform="translate(320 0) scale(-1 1)">${restArm(1)}</g>`;
    if (side === 1 && !sad)
      return `<g class="sticker-arm-right"><path d="M 205 232 Q 240 249 247 276 Q 229 298 204 301 L 196 286 L 224 272 L 201 254 Z" fill="${a.topColor}" ${outline}/><path d="M 223 278 Q 211 279 201 287 l -12 5 q -6 6 1 9 l 14 -2 l -1 7 q 6 8 12 -2 l 15 -15 Z" fill="${a.skin}" ${outline}/><path d="M 211 289 l -13 7 M 215 294 l -11 6" fill="none" stroke="#8a5945" stroke-width="1.3"/></g>`;
    return `<g class="sticker-arm-${side < 0 ? "left" : "right"}"><path d="M ${160 + side * 46} 231 Q ${160 + side * 68} 251 ${160 + side * 69} 284 L ${160 + side * 75} 329 Q ${160 + side * 78} 343 ${160 + side * 67} 345 Q ${160 + side * 55} 346 ${160 + side * 56} 329 L ${160 + side * 50} 279 L ${160 + side * 37} 251 Z" fill="${a.skin}" ${outline}/><path d="M ${160 + side * 46} 228 Q ${160 + side * 68} 235 ${160 + side * 69} 267 L ${160 + side * 48} 275 L ${160 + side * 36} 244 Z" fill="${a.topColor}" ${outline}/><path d="M ${160 + side * 68} 333 l 2 6 M ${160 + side * 64} 334 l 1 7" stroke="#89543c" stroke-width="1.4" fill="none"/></g>`;
  };
  const dress = ["dress", "sari", "lehenga", "robe"].includes(a.outfit);
  const body = `<g class="sticker-body" transform="translate(${160 * (1 - scale)} -18) scale(${scale} 1)">
  <path d="M 121 328 L 116 429 L 148 429 L 161 350 L 169 429 L 201 429 L 192 328 Z" fill="${a.bottomColor}" ${outline}/><path d="M 132 349 L 129 418 M 182 350 L 187 418" stroke="#fff4d8" opacity=".17" fill="none" stroke-width="2"/>
  ${[114, 170].map((x) => `<path d="M ${x} 424 L ${x + 30} 424 L ${x + 35} 449 Q ${x + 5} 460 ${x - 12} 450 L ${x - 12} 442 Z" fill="${a.shoes === "sneakers" ? a.accentColor : "#35413b"}" ${outline}/><path d="M ${x - 10} 450 Q ${x + 12} 454 ${x + 34} 449" fill="none" stroke="#f1e3bf" stroke-width="5"/>${a.shoes !== "formal" ? [431, 436, 441].map((y) => `<path d="M ${x + 3} ${y} l 15 -1" stroke="${a.shoes === "sneakers" ? "#fff6dc" : a.accentColor}" stroke-width="2.5"/>`).join("") : ""}`).join("")}
  ${win ? cheerArm(-1) + (emotion === "cheer" ? restArm(1) : cheerArm(1)) : restArm(-1) + restArm(1)}
  <path d="M 130 212 Q 111 215 105 239 L 116 277 L 114 334 Q 160 350 204 334 L 202 278 L 216 241 Q 207 218 189 212 Z" fill="url(#sticker-cloth)" ${outline}/>
  <path d="M 131 217 Q 160 231 189 217" stroke="#fff4d9" stroke-opacity=".25" stroke-width="3" fill="none"/>
  ${dress ? `<path d="M 116 305 Q 108 350 91 414 Q 160 434 226 414 L 203 305 Z" fill="url(#sticker-cloth)" ${outline}/><path d="M 125 330 L 115 408 M 146 334 L 142 418 M 176 334 L 183 418 M 194 328 L 209 408" fill="none" stroke="${ink}" stroke-opacity=".2" stroke-width="2"/>` : ""}
  ${a.outfit === "sari" ? `<path d="M 190 214 L 130 306 L 97 414 L 118 420 L 207 230 Z" fill="${a.accentColor}" ${outline}/><path d="M 187 220 L 124 313 L 106 410" fill="none" stroke="${a.topColor}" stroke-width="3"/>` : ""}
  ${a.outfit === "kurta" ? `<path d="M 114 278 L 108 386 L 209 386 L 203 278" fill="url(#sticker-cloth)" ${outline}/><path d="M 151 224 L 151 284 M 167 224 L 167 284 M 112 377 L 205 377" stroke="${a.accentColor}" stroke-width="3"/>${[240, 251, 262].map((y) => `<circle cx="159" cy="${y}" r="2.3" fill="${a.accentColor}"/>`).join("")}` : ""}
  ${["shirt", "explorer", "suit"].includes(a.outfit) ? `<path d="M 135 213 L 160 230 L 141 251 L 124 224 M 184 213 L 160 230 L 178 251 L 196 224" fill="${a.accentColor}" ${outline}/><path d="M 160 235 L 160 338" stroke="${ink}" stroke-width="1.8"/>` : ""}
  ${a.outfit === "explorer" ? `<path d="M 123 272 L 149 272 L 149 298 L 123 298 Z M 172 272 L 197 272 L 197 298 L 172 298 Z" fill="${a.accentColor}" ${outline}/><path d="M 123 277 l 13 8 l 13 -8 M 172 277 l 12 8 l 13 -8" fill="none" stroke="${ink}" stroke-width="1.4"/>` : ""}
  ${a.outfit === "suit" ? `<path d="M 136 215 L 160 270 L 185 215 L 183 263 L 160 293 L 137 263 Z" fill="#f3ead6" ${outline}/><path d="M 157 240 L 150 271 L 160 282 L 169 271 L 164 240 Z" fill="${a.accentColor}"/>` : ""}
  ${a.outfit === "hoodie" ? `<path d="M 135 212 Q 102 217 124 244 L 158 229 L 194 245 Q 215 217 186 212" fill="${a.topColor}" ${outline}/><path d="M 142 236 L 140 269 M 178 236 L 180 269" fill="none" stroke="${a.accentColor}" stroke-width="3"/><path d="M 135 292 L 129 317 L 190 317 L 185 292 Z" fill="${a.topColor}" stroke="${ink}" stroke-width="1.6"/>` : ""}
  ${a.outfit === "varsity" ? `<path d="M 114 328 Q 160 342 204 328 L 204 337 Q 160 351 114 337 Z" fill="${a.accentColor}"/><path d="M 159 225 L 159 338 M 180 275 L 187 256 L 195 275" fill="none" stroke="${a.accentColor}" stroke-width="4"/>${[248, 271, 294, 317].map((y) => `<circle cx="166" cy="${y}" r="2.4" fill="${a.accentColor}"/>`).join("")}` : ""}
  ${a.outfit === "bomber" ? `<path d="M135 214Q160 239 187 214L183 232Q160 251 138 232Z M114 326Q160 341 204 326L204 338Q160 351 114 338Z" fill="${a.accentColor}" ${outline}/><path d="M160 240V335 M126 285l16 18 M194 285l-16 18" fill="none" stroke="${ink}" stroke-width="3"/><path d="M172 255h20v13h-20Z" fill="${a.accentColor}"/>` : ""}
  ${a.outfit === "denim" ? `<path d="M137 213L160 250L184 213L182 329H138Z" fill="${a.accentColor}" ${outline}/><path d="M135 214L125 233L148 264L141 235Z M184 214L196 233L173 264L180 235Z M119 266H140V292H119Z M181 266H202V292H181Z" fill="${a.topColor}" ${outline}/><path d="M121 277h17 M183 277h17 M147 268v65 M174 268v65" stroke="#fff2d3" stroke-width="2" fill="none"/>` : ""}
  ${a.outfit === "tracksuit" ? `<path d="M135 215Q160 238 186 215 M159 233V338 M124 350L119 422 M192 350L198 422" stroke="${a.accentColor}" stroke-width="6" fill="none"/><path d="M115 257L151 282 M205 257L169 282 M126 302l16 13 M194 302l-16 13" stroke="${a.accentColor}" stroke-width="4" fill="none"/>` : ""}
  ${a.outfit === "cargo" ? `<path d="M136 215L146 236L160 228L175 236L187 215" fill="${a.accentColor}" ${outline}/><path d="M118 278H144V310H118Z M177 278H202V310H177Z M118 361H143V394H116Z M177 361H202L204 394H178Z" fill="${a.bottomColor}" ${outline}/><path d="M119 285h24 M178 285h23 M118 368h24 M179 368h22 M116 330h88" stroke="${a.accentColor}" stroke-width="4"/>` : ""}
  ${a.outfit === "dungarees" ? `<path d="M128 217L143 219L143 263H177V219L191 217L192 281L204 337Q160 351 114 337L128 280Z" fill="${a.bottomColor}" ${outline}/><path d="M139 274H181V303Q160 313 139 303Z" fill="${a.bottomColor}" stroke="${a.accentColor}" stroke-width="2"/><circle cx="136" cy="257" r="4" fill="${a.accentColor}"/><circle cx="184" cy="257" r="4" fill="${a.accentColor}"/><path d="M160 315v27" stroke="${a.accentColor}" stroke-width="2"/>` : ""}
  ${a.outfit === "jersey" ? `<path d="M135 214L160 240L186 214 M119 321H201" stroke="${a.accentColor}" stroke-width="8" fill="none"/><path d="M142 264H155V300H147V272H142Z M165 264H183V273L174 300H165L175 272H165Z" fill="${a.accentColor}"/><path d="M125 246l9 7 M195 246l-9 7" stroke="${a.accentColor}" stroke-width="4"/>` : ""}
  ${a.outfit === "lehenga" ? `<path d="M116 302Q160 315 203 302L207 324Q160 339 112 324Z" fill="${a.accentColor}" ${outline}/><path d="M188 215L125 298L103 414L118 417L205 231Z" fill="${a.accentColor}" fill-opacity=".85" ${outline}/><path d="M99 400Q160 419 219 400" stroke="${a.accentColor}" stroke-width="7" fill="none"/>${[122, 146, 172, 198].map((x, i) => `<path d="M${x} ${365 + (i % 2) * 10}l5 7l-5 7l-5-7Z" fill="${a.accentColor}"/>`).join("")}<path d="M138 217Q160 244 183 217" stroke="${a.accentColor}" stroke-width="4" fill="none"/>` : ""}
  ${a.outfit === "robe" ? `<path d="M133 214L160 256L187 214 M160 254V423 M99 407Q160 428 220 407" fill="none" stroke="${a.accentColor}" stroke-width="7"/><path d="M115 307Q160 323 205 307" stroke="${a.bottomColor}" stroke-width="12" fill="none"/><circle cx="160" cy="316" r="7" fill="${a.accentColor}" ${outline}/><path d="M185 270l3 8l8 1l-6 5l2 8l-7-4l-7 4l2-8l-6-5l8-1Z M129 357l3 7l8 1l-6 5l2 8l-7-4l-7 4l2-8l-6-5l8-1Z" fill="${a.accentColor}"/>` : ""}
  ${expandedOutfit(a, outline)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portrait ? "50 -6 220 220" : "0 0 320 480"}" role="img" aria-label="${escape(`${a.style} explorer ${emotion}`)}"><defs><linearGradient id="sticker-skin" x1="0" x2=".9" y2="1"><stop stop-color="${a.skin}"/><stop offset="1" stop-color="${a.skin}"/></linearGradient><linearGradient id="sticker-cloth" x1="0" x2=".9" y2="1"><stop stop-color="${a.topColor}"/><stop offset="1" stop-color="${a.topColor}"/></linearGradient><filter id="sticker-edge" x="-30%" y="-25%" width="160%" height="160%"><feMorphology in="SourceAlpha" operator="dilate" radius="3.3" result="edge"/><feFlood flood-color="#fff5db"/><feComposite in2="edge" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>${hairGradient(a)}</defs>
  ${animated ? `<style>@keyframes hooray{0%,100%{transform:rotate(0deg)}35%{transform:rotate(-11deg)}70%{transform:rotate(7deg)}}@keyframes wave{0%,100%{transform:rotate(0deg)}30%{transform:rotate(-13deg)}65%{transform:rotate(10deg)}}@keyframes tear{0%{opacity:0;transform:translateY(-3px)}40%{opacity:1}100%{opacity:0;transform:translateY(13px)}}@media(prefers-reduced-motion:no-preference){${win ? ".sticker-arm-left{animation:hooray .75s ease-in-out 3}.sticker-arm-right{animation:hooray .75s ease-in-out 3 reverse}" : wave ? ".sticker-arm-left{animation:wave .8s ease-in-out 3}" : ""}${sad ? ".sticker-tear{animation:tear 1.6s ease-out 2}" : ""}}</style>` : ""}
  ${!portrait ? '<ellipse cx="160" cy="442" rx="71" ry="10" fill="#0a1e14" opacity=".17"/>' : ""}
  <g filter="url(#sticker-edge)">
  ${long ? `<path d="M 106 73 Q 76 133 96 232 L 226 232 Q 244 130 207 68 Z" fill="${hairPaint}" ${outline}/>` : ""}
  ${!portrait ? body : ""}
  <path class="sticker-neck" d="M146 181L145 197Q160 208 175 197L174 181Z" fill="${a.skin}" ${outline}/>
  ${a.accessory === "scarf" ? `<path d="M140 187Q160 201 180 187L184 203L171 208L184 244L169 249L156 210L138 203Z" fill="${a.accentColor}" ${outline}/><path d="M146 199L172 201 M173 237l8-3" fill="none" stroke="${a.topColor}" stroke-width="3"/>` : ""}
  <g class="sticker-head" transform="rotate(${sad ? -5 : win ? -4 : 0} 160 150)"><ellipse cx="${160 - w}" cy="135" rx="10" ry="16" fill="${a.skin}" ${outline}/><ellipse cx="${160 + w}" cy="135" rx="10" ry="16" fill="${a.skin}" ${outline}/><path d="M 160 ${128 - h} C ${160 + w * 1.16} ${128 - h}, ${160 + w * 1.1} 137, ${160 + w * a.jaw * 0.79} 170 Q 160 ${136 + h * 1.05} ${160 - w * a.jaw * 0.79} 170 C ${160 - w * 1.1} 137, ${160 - w * 1.16} ${128 - h}, 160 ${128 - h} Z" fill="url(#sticker-skin)" ${outline}/>
  <path d="M ${160 - w * 0.8} 148 Q ${160 - w * 0.6} 177 143 186" fill="none" stroke="#743b29" stroke-opacity=".13" stroke-width="7"/>
  ${eyebrow}<path d="M ${160 - 5 * a.nose} 137 Q ${160 - 11 * a.nose} 153 160 154 L ${160 + 7 * a.nose} 151" fill="none" stroke="#925b43" stroke-width="2" stroke-linecap="round"/>
  ${win ? '<ellipse cx="119" cy="151" rx="11" ry="5" fill="#d47a67" opacity=".28"/><ellipse cx="201" cy="151" rx="11" ry="5" fill="#d47a67" opacity=".28"/>' : ""}${mouth}
  ${a.facialHair !== "none" ? (a.facialHair === "moustache" ? `<path d="M 137 163 Q 152 153 160 160 Q 170 153 185 163 Q 170 169 160 164 Q 147 170 137 163" fill="${a.hairColor}"/>` : `<path d="M 111 147 Q 126 178 160 184 Q 196 176 210 147 L 198 181 Q 160 218 122 181 Z" fill="${a.hairColor}" opacity="${a.facialHair === "stubble" ? 0.35 : 0.92}"/>`) : ""}
  <g transform="translate(${160 * (1 - a.faceWidth)} 0) scale(${a.faceWidth} 1)" fill="${hairPaint}" ${outline}>${hair}${a.hair === "locs" ? [-1, 1].map((s) => [0, 1, 2, 3, 4].map((i) => `<path d="M${160 + s * (44 + i * 5)} ${70 + i * 9}Q${160 + s * (70 + i * 2)} 130 ${160 + s * (55 + i * 4)} ${186 + i * 4}" fill="none" stroke="#fff3d4" stroke-opacity=".28" stroke-width="1.3"/>`).join("") + `<path d="M${160 + s * 65} 168l${s * 8} 1 M${160 + s * 71} 187l${s * 7} 1" stroke="${a.accentColor}" stroke-width="4"/>`).join("") : ""}</g>
  ${a.glasses !== "none" ? [-1, 1].map((s) => `<${a.glasses === "round" ? "ellipse" : "rect"} ${a.glasses === "round" ? `cx="${160 + s * xEye}" cy="130" rx="21" ry="19"` : `x="${160 + s * xEye - 21}" y="113" width="42" height="33" rx="6"`} fill="${a.glasses === "sunglasses" ? "#263c3b" : "#cde8dc"}" fill-opacity="${a.glasses === "sunglasses" ? 0.92 : 0.12}" stroke="#49463b" stroke-width="3.5"/>`).join("") + `<path d="M 152 126 Q 160 121 168 126" fill="none" stroke="#49463b" stroke-width="3"/>` : ""}
  ${a.accessory === "earrings" ? [-1, 1].map((s) => `<circle cx="${160 + s * (w + 1)}" cy="152" r="7" fill="none" stroke="${a.accentColor}" stroke-width="4"/>`).join("") : ""}
  ${a.accessory === "cap" ? `<path d="M 99 87 Q 104 38 161 39 Q 219 38 222 87 Z" fill="${a.topColor}" ${outline}/><path d="M 99 86 Q 165 61 234 96 Q 166 108 99 86" fill="${a.accentColor}" ${outline}/>` : ""}
  ${a.accessory === "headphones" ? `<path d="M 91 132 L 91 95 Q 96 32 160 33 Q 223 33 229 95 L 229 132" fill="none" stroke="${a.accentColor}" stroke-width="9"/><rect x="83" y="111" width="16" height="38" rx="7" fill="${a.topColor}" ${outline}/><rect x="221" y="111" width="16" height="38" rx="7" fill="${a.topColor}" ${outline}/>` : ""}
  ${expandedAccessory(a, outline)}</g></g></svg>`;
}
export function stickerImage(avatar, options) {
  return `data:image/svg+xml,${encodeURIComponent(stickerSvg(avatar, options))}`;
}

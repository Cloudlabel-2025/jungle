// Wrist-anchored hands and shoulder/elbow/wrist chains for the saved portraits.
// Appearance is supplied by the validated character recipe, never by a preset.
export function profileGestures(a) {
  const ink = "#352b25",
    skin = a.skin,
    cloth = a.topColor;
  const line = `stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const longSleeves = [
    "hoodie",
    "varsity",
    "suit",
    "bomber",
    "denim",
    "tracksuit",
    "robe",
    "cardigan",
    "sweater",
    "sherwani",
  ].includes(a.outfit);
  const breadth = a.body === "broad" ? 1.08 : a.body === "slender" ? 0.93 : 1;
  const arm = (side, elbow, wrist) => {
    const shoulder = [160 + side * 43 * breadth, 213];
    const d = `M${shoulder}Q${shoulder[0] + side * 8} ${shoulder[1] + 4} ${elbow}Q${elbow[0] + (wrist[0] - elbow[0]) * 0.5} ${elbow[1] + (wrist[1] - elbow[1]) * 0.35} ${wrist}`;
    const cuff = [
      shoulder[0] + (elbow[0] - shoulder[0]) * 0.68,
      shoulder[1] + (elbow[1] - shoulder[1]) * 0.68,
    ];
    return `<g class="profile-limb" data-sleeves="${longSleeves ? "long" : "short"}"><path d="${d}" fill="none" stroke="${ink}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${longSleeves ? cloth : skin}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>${!longSleeves ? `<path d="M${shoulder}Q${shoulder[0] + side * 5} ${shoulder[1] + 3} ${cuff}" fill="none" stroke="${ink}" stroke-width="21" stroke-linecap="round"/><path d="M${shoulder}Q${shoulder[0] + side * 5} ${shoulder[1] + 3} ${cuff}" fill="none" stroke="${cloth}" stroke-width="17" stroke-linecap="round"/>` : ""}</g>`;
  };
  const silhouettes = {
    palm: "M-5 2L-9-8L-18-18Q-21-23-17-25Q-14-26-10-21L-7-17L-10-31Q-11-36-7-36Q-4-36-3-31L-1-21L-2-39Q-2-43 2-43Q5-42 5-38L5-22L8-36Q9-40 12-38Q15-37 13-32L11-19L15-29Q17-33 20-31Q22-29 19-25L14-10Q12-3 6 2Z",
    peace:
      "M-5 2L-10-9L-12-15Q-13-20-9-21L-7-20L-10-35Q-11-40-7-41Q-3-41-2-36L2-21L9-39Q11-44 15-42Q18-40 15-35L10-19Q16-20 17-15Q21-13 17-5L9 3Z",
    thumb:
      "M-6 2L-10-8L-10-18L-8-32Q-7-37-3-36Q0-35-1-29L0-22L9-23Q15-23 16-19L17-7Q17-1 9 3Z",
    point:
      "M-6 2L-10-9L-9-18L-5-21L-5-38Q-5-43-1-43Q3-43 3-38L4-23L11-22Q16-22 16-18L18-10Q18-2 9 3Z",
    rock: "M-6 2L-10-12L-9-37Q-9-42-5-42Q-1-41-2-36L-1-23Q3-27 7-23L10-22L14-34Q15-39 19-37Q22-36 20-31L17-10Q16-1 8 3Z",
    fist: "M-6 2L-11-8L-12-17Q-12-23-7-23Q-3-27 1-23Q6-27 10-22Q16-23 17-17L17-7Q16 0 8 3Z",
    flat: "M-5 2L-10-9L-11-27Q-11-32-7-32L-6-14L-5-35Q-5-39-1-39L0-15L1-35Q2-39 5-36L6-14L8-30Q10-34 13-31L12-12Q20-20 22-16Q23-13 17-7L8 3Z",
    finger:
      "M-6 2L-11-10L-9-19Q-8-23-4-20L1-13L5-31Q7-36 11-33Q13-31 11-27L7-17L14-24Q18-27 20-23Q22-20 17-17L10-9L12-3L7 3Z",
    grip: "M-6 2L-10-8L-10-18Q-8-24-3-21L2-17L9-19Q16-20 16-15L15-7Q14 0 7 3Z",
  };
  const creases = {
    palm: "M-7-13Q0-17 8-12 M-3-6Q0-11 2-17",
    peace: "M-6-17Q1-12 10-15 M-7-9Q0-5 7-10",
    thumb: "M3-17L13-17 M3-11L14-11 M3-5L12-5 M-5-15Q0-11 0-6",
    point: "M4-18L13-17 M4-12L14-11 M4-6L12-5",
    rock: "M0-19L9-16 M1-12L10-10",
    fist: "M-5-20L-4-14 M2-21L2-14 M9-20L9-14 M-8-11Q-2-15 7-8",
    flat: "M-4-14L-3-28 M2-14L2-29 M8-14L9-25 M-6-9Q2-7 10-9",
    finger: "M-3-18L8-10 M-6-9Q0-5 6-8",
    grip: "M0-14L12-14 M0-8L12-8",
  };
  const hand = (x, y, gesture = "palm", rotation = 0, mirror = 1, size = 1) =>
    `<g class="profile-hand" data-gesture="${gesture}" transform="translate(${x} ${y}) rotate(${rotation}) scale(${mirror * size} ${size})"><path d="${silhouettes[gesture]}" fill="${skin}" ${line}/><path d="${creases[gesture]}" fill="none" stroke="${ink}" stroke-opacity=".42" stroke-width="1.15" stroke-linecap="round"/></g>`;
  const raised = (gesture = "palm", side = 1, low = false) => {
    const wrist = [160 + side * (low ? 78 : 76), low ? 215 : 181];
    return {
      back: arm(side, [160 + side * 88, low ? 264 : 235], wrist),
      front: hand(...wrist, gesture, side * (low ? 22 : 12), side),
    };
  };
  const combine = (...parts) => ({
    back: parts.map((p) => p.back || "").join(""),
    front: parts.map((p) => p.front || "").join(""),
  });
  const relaxed = {
    back: arm(-1, [105, 260], [117, 300]) + arm(1, [215, 260], [203, 300]),
    front: "",
  };
  const heartHalf = `<path d="M137 251L128 237Q126 229 133 224Q141 219 149 223L160 231Q164 235 160 237Q157 239 153 235L144 229Q140 227 137 232L145 240L160 247Q164 249 162 252Q160 255 156 253L145 248L143 253Z" fill="${skin}" ${line}/><path d="M133 233L142 241 M138 246L143 247" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="1.1"/>`;
  const props = {
    classic: relaxed,
    hello: raised(),
    peace: raised("peace"),
    thumbsUp: raised("thumb"),
    thinker: {
      back: arm(1, [232, 263], [184, 204]),
      front: hand(184, 204, "flat", -64, 1, 0.8),
    },
    heart: {
      back: arm(-1, [112, 263], [138, 249]) + arm(1, [208, 263], [182, 249]),
      front: `<g class="profile-hand" data-gesture="heart">${heartHalf}<g transform="translate(320 0) scale(-1 1)">${heartHalf}</g></g>`,
    },
    doublePeace: combine(raised("peace", -1), raised("peace", 1)),
    folded: {
      back: arm(1, [216, 256], [132, 239]),
      front:
        hand(132, 239, "grip", -78, -1, 0.8) +
        arm(-1, [104, 258], [188, 245]) +
        hand(188, 245, "grip", 75, 1, 0.8),
    },
    victory: {
      back: arm(-1, [73, 170], [99, 109]) + arm(1, [247, 176], [225, 116]),
      front: hand(99, 109, "thumb", -14, -1) + hand(225, 116, "thumb", 17),
    },
    salute: {
      back: arm(1, [249, 184], [229, 124]),
      front: hand(229, 124, "flat", -66, 1, 0.85),
    },
    pointUp: raised("point"),
    rockOn: raised("rock"),
    cheek: {
      back: arm(1, [243, 263], [222, 205]),
      front: hand(222, 205, "flat", -15, 1, 0.84),
    },
    clasped: {
      back: arm(-1, [115, 264], [153, 252]) + arm(1, [205, 264], [167, 252]),
      front: `<g class="profile-hand" data-gesture="clasped"><path d="M150 254L146 244L151 227L155 216Q158 211 160 217V248L157 255Z M170 254L174 244L169 227L165 216Q162 211 160 217V248L163 255Z" fill="${skin}" ${line}/><path d="M155 223L153 241 M165 223L167 241 M154 248L158 246 M166 248L162 246" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="1.1"/></g>`,
    },
    wink: raised("palm", 1),
    sideWave: raised("palm", 1, true),
    fingerHeart: raised("finger", 1, true),
    confident: {
      back: arm(-1, [97, 243], [127, 271]) + arm(1, [223, 243], [193, 271]),
      front:
        hand(127, 271, "grip", -58, -1, 0.8) +
        hand(193, 271, "grip", 58, 1, 0.8),
    },
    fistBump: {
      back: arm(1, [242, 266], [220, 233]),
      front: hand(220, 233, "fist", -12, 1, 1.18),
    },
    kiss: {
      back: arm(1, [238, 253], [191, 200]),
      front:
        hand(191, 200, "flat", -53, 1, 0.82) +
        `<path d="M225 160C215 148 206 159 225 173C244 159 235 148 225 160Z" fill="${a.accentColor}" ${line}/>`,
    },
    book: {
      back: arm(-1, [101, 267], [119, 258]) + arm(1, [219, 267], [202, 258]),
      front: `<path d="M115 224Q139 218 160 232Q182 218 205 224V274Q181 270 160 281Q139 270 115 274Z" fill="${a.accentColor}" ${line}/><path d="M160 232V281 M125 238L150 244 M171 244L196 238 M125 249L150 255 M171 255L196 249" fill="none" stroke="${ink}" stroke-width="1.8"/>${hand(118, 261, "grip", -10, -1, 0.65)}${hand(203, 261, "grip", 10, 1, 0.65)}`,
    },
    coffee: {
      back: arm(1, [240, 278], [222, 261]),
      front: `<path d="M195 225H226L222 264H199Z" fill="${a.accentColor}" ${line}/><path d="M226 231Q245 229 242 243Q240 251 224 250 M204 217Q199 209 206 202 M217 217Q212 209 219 202" fill="none" ${line}/>${hand(220, 264, "grip", -10, 1, 0.75)}`,
    },
    camera: {
      back: arm(-1, [105, 265], [133, 258]) + arm(1, [215, 265], [190, 258]),
      front: `<rect x="127" y="224" width="66" height="42" rx="7" fill="${a.accentColor}" ${line}/><path d="M143 224L149 216H172L179 224" fill="${a.accentColor}" ${line}/><circle cx="160" cy="245" r="14" fill="${cloth}" ${line}/><circle cx="160" cy="245" r="7" fill="#80b8ac"/>${hand(132, 261, "grip", -8, -1, 0.67)}${hand(189, 261, "grip", 8, 1, 0.67)}`,
    },
    stretch: {
      back:
        arm(-1, [78, 207], [116, 154]) +
        arm(1, [242, 207], [204, 154]) +
        hand(116, 154, "grip", -45, -1, 0.8) +
        hand(204, 154, "grip", 45, 1, 0.8),
      front: "",
    },
  };
  return props[a.profilePose] || relaxed;
}

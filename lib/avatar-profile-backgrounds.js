export const profileBackgrounds = [
  ["forest", "Forest glade", "#234936", "#789459"],
  ["canopy", "Jungle canopy", "#163e38", "#4b8870"],
  ["sunset", "Golden sunset", "#a65351", "#efbb78"],
  ["night", "Moonlit forest", "#202b49", "#647d97"],
  ["lagoon", "Blue lagoon", "#286878", "#87c6be"],
  ["mountains", "Mountain trail", "#536d83", "#b4c6bb"],
  ["dunes", "Desert dunes", "#b77a51", "#f1d4a0"],
  ["blossom", "Blossom garden", "#866b87", "#e8c1c8"],
  ["meadow", "Wildflower meadow", "#60794a", "#d4d9a4"],
  ["aurora", "Northern lights", "#153b4b", "#6fb7a1"],
  ["parchment", "Explorer parchment", "#aa9068", "#efe0bb"],
  ["starlight", "Starlight", "#363151", "#afa0d0"],
].map(([key, label, color, light]) => ({ key, label, color, light }));

export function profileBackgroundSvg(key) {
  const bg =
    profileBackgrounds.find((b) => b.key === key) || profileBackgrounds[0];
  const stars = Array.from(
    { length: 15 },
    (_, i) =>
      `<circle cx="${52 + ((i * 53) % 215)}" cy="${5 + ((i * 31) % 160)}" r="${i % 3 ? 1.2 : 2}" fill="#fff0ce" opacity=".7"/>`,
  ).join("");
  const leaves = [-1, 1]
    .map(
      (s) =>
        `<g transform="translate(${160 + s * 108} 25) scale(${s} 1)"><path d="M0 0Q-24 46-8 112" fill="none" stroke="${bg.light}" stroke-width="3"/><path d="M-2 18Q-40-3-32 27Q-21 39-2 28 M-7 43Q-42 25-37 55Q-22 67-6 53 M-8 70Q-36 57-32 82Q-20 94-8 82" fill="${bg.light}" opacity=".55"/></g>`,
    )
    .join("");
  const mountain = `<path d="M40 190L108 72L170 175L225 89L280 176V288H40Z" fill="${bg.color}" opacity=".8"/><path d="M88 107L108 72L129 109L108 100Z M207 121L225 89L245 120L226 111Z" fill="#eee8cf" opacity=".75"/>`;
  const scenes = {
    forest: `<circle cx="160" cy="110" r="107" fill="${bg.light}" opacity=".14"/><path d="M42 288V55L54 12L64 58V288 M257 288V60L267 0L277 58V288" fill="#102f24" opacity=".55"/>${leaves}`,
    canopy: `${leaves}<path d="M40 4Q70 54 98 17Q132 47 160 10Q190 42 216 9Q250 49 280 0V-12H40Z" fill="#102e26"/><path d="M62 12Q98 58 65 129 M253 9Q215 69 250 151" fill="none" stroke="#8caf75" stroke-opacity=".45" stroke-width="3"/>`,
    sunset: `<circle cx="226" cy="69" r="35" fill="#ffdf9b"/><path d="M40 180Q104 120 174 183Q230 133 280 161V288H40Z" fill="#71454b" opacity=".55"/><path d="M40 230Q135 172 280 221V288H40Z" fill="#4f4c43" opacity=".75"/>`,
    night: `${stars}<circle cx="226" cy="56" r="24" fill="#f5e3ae"/><circle cx="236" cy="48" r="23" fill="${bg.color}"/><path d="M40 288V147L56 95L72 147H63L81 182H69V288 M248 288V160L266 110L283 160H273L289 195H278V288" fill="#122738"/>`,
    lagoon: `<path d="M40 149Q92 120 146 149T280 145V288H40Z" fill="#3b9699"/><path d="M40 211Q94 193 149 212T280 207 M40 249Q125 230 280 249" fill="none" stroke="#bce0c9" stroke-width="4" opacity=".5"/><path d="M40 188Q65 165 83 184L99 213H40Z M237 178Q261 157 280 180V210H224Z" fill="#254e4b"/>${leaves}`,
    mountains:
      mountain + `<path d="M40 248Q118 198 280 237V288H40Z" fill="#37594f"/>`,
    dunes: `<circle cx="226" cy="54" r="25" fill="#ffe7b3"/><path d="M40 175Q107 127 176 182Q233 151 280 169V288H40Z" fill="#cc945e"/><path d="M40 237Q153 166 280 225V288H40Z" fill="#9c663f"/><path d="M58 240L58 192M58 218Q43 219 44 202 M58 211Q73 212 73 192" fill="none" stroke="#52664a" stroke-width="7" stroke-linecap="round"/>`,
    blossom: `<path d="M46 288Q71 183 50 63 M50 108Q77 71 99 60 M266 288Q241 167 271 46 M264 105Q236 73 217 68" fill="none" stroke="#665451" stroke-width="7"/>${Array.from({ length: 18 }, (_, i) => `<circle cx="${i % 2 ? 252 + ((i * 7) % 25) : 47 + ((i * 9) % 43)}" cy="${25 + ((i * 29) % 190)}" r="${5 + (i % 4)}" fill="${i % 3 ? "#edbdc8" : "#f5ddce"}" opacity=".8"/>`).join("")}`,
    meadow: `<path d="M40 217Q130 159 280 207V288H40Z" fill="#527442"/><path d="M40 261Q139 206 280 249V288H40Z" fill="#3e5f39"/>${Array.from({ length: 20 }, (_, i) => `<path d="M${46 + ((i * 37) % 230)} ${250 + ((i * 13) % 35)}v-13" stroke="#9bb46b" stroke-width="2"/><circle cx="${46 + ((i * 37) % 230)}" cy="${237 + ((i * 13) % 35)}" r="3" fill="${i % 2 ? "#e8c878" : "#e3abc4"}"/>`).join("")}`,
    aurora: `${stars}<path d="M28 24Q104 149 174 30T295 67 M22 57Q107 176 178 60T300 97" fill="none" stroke="#77d3b0" stroke-width="24" opacity=".24"/><path d="M40 239L104 158L163 223L229 147L280 234V288H40Z" fill="#142f3c"/>`,
    parchment: `<path d="M51 0H269V276H51Z" fill="none" stroke="#7c7555" stroke-opacity=".45" stroke-width="2"/><circle cx="234" cy="48" r="22" fill="none" stroke="#8d805b" stroke-width="2"/><path d="M234 20V76M206 48H262 M234 31L239 48L234 66L229 48Z" fill="#8d805b"/><path d="M65 245Q111 222 87 191T111 136" stroke="#8d805b" stroke-dasharray="5 6" fill="none" stroke-width="2"/>`,
    starlight: `${stars}<circle cx="160" cy="128" r="107" fill="none" stroke="#c9b7dd" stroke-opacity=".3"/><path d="M57 68L79 94L55 124 M235 181L263 208L240 237" fill="none" stroke="#e9cf91" stroke-width="2"/><circle cx="79" cy="94" r="3" fill="#e9cf91"/><circle cx="263" cy="208" r="3" fill="#e9cf91"/>`,
  };
  return `<g class="profile-background" data-background="${bg.key}"><defs><linearGradient id="profile-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${bg.light}"/><stop offset="1" stop-color="${bg.color}"/></linearGradient><clipPath id="profile-scene-clip"><rect x="40" y="-12" width="240" height="300" rx="35"/></clipPath></defs><g clip-path="url(#profile-scene-clip)"><rect x="40" y="-12" width="240" height="300" fill="${bg.key === "forest" ? bg.color : "url(#profile-sky)"}"/>${scenes[bg.key]}</g></g>`;
}

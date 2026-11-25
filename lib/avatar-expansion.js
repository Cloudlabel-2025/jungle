// Original SVG wardrobe additions. Inputs have passed validateAvatar.
export function expandedHair(a) {
  const light =
    'fill="none" stroke="#fff1d4" stroke-opacity=".25" stroke-width="3"';
  return {
    slickBack: `<path d="M101 112Q86 62 122 44Q167 20 210 49Q229 68 219 112L205 94L200 71Q155 79 118 77L112 105Z"/><path d="M110 69Q150 43 207 62 M111 78Q157 55 210 73 M119 53Q155 31 194 48" ${light}/>`,
    bixie: `<path d="M96 161Q82 99 99 67Q125 29 165 42Q205 28 223 70L219 155L204 166L201 102L188 77L174 106L163 79L146 103L135 76L117 112L115 161Z"/><path d="M107 120L105 146 M214 116L212 145 M120 61L137 51 M182 51L200 66" ${light}/>`,
    fishtail: `<path d="M101 112Q84 55 145 40Q209 29 221 109L205 94L197 76Q156 94 119 82L112 105Z"/>${Array.from({ length: 11 }, (_, i) => `<path d="M${210 + i * 0.4} ${113 + i * 10}l19 9l-17 9l-14-10Z"/><path d="M${203 + i * 0.4} ${116 + i * 10}l14 9l13-6" ${light}/>`).join("")}<path d="M214 228l12 1" stroke="${a.accentColor}" stroke-width="5"/>`,
    cornrows: `<path d="M102 115Q89 49 157 40Q224 36 220 115L207 99L202 78Q160 67 117 84L112 105Z"/>${[-2, -1, 0, 1, 2].map((s) => `<path d="M${160 + s * 18} ${43 + Math.abs(s) * 6}Q${160 + s * 26} 64 ${160 + s * 24} 89" ${light}/><path d="M${165 + s * 18} ${45 + Math.abs(s) * 6}Q${165 + s * 26} 64 ${165 + s * 24} 87" fill="none" stroke="#352b25" stroke-width="3"/>`).join("")}`,
    twinTails: `<path d="M106 69Q68 53 68 108Q60 161 88 200L109 211Q86 150 113 101Z M210 68Q248 52 251 108Q260 164 231 202L211 211Q234 152 209 103Z"/><path d="M101 112Q85 52 158 41Q224 38 221 112L204 95L194 75Q159 99 126 76L113 107Z"/><path d="M92 81L108 89 M211 89L229 80" stroke="${a.accentColor}" stroke-width="6"/><path d="M80 100Q71 148 94 184 M239 100Q249 148 225 185" ${light}/>`,
    shag: `<path d="M91 200L98 175L83 164L96 143Q80 100 95 73L90 59L113 58L120 36L142 44L161 26L177 42L201 35L210 58L231 61L224 80Q238 113 222 143L235 163L222 177L231 204L205 196L197 103L184 79L171 105L156 79L140 104L128 80L115 111L114 198Z"/><path d="M107 118q-10 12 0 22t0 22 M215 118q10 12 0 22t0 22 M118 63q10-12 20-2 M165 56q10-12 20-2" ${light}/>`,
    topKnot: `<path d="M143 47Q122 28 143 14Q165 2 185 19Q201 36 179 48Z"/><path d="M101 113Q89 54 146 43Q212 31 220 111L205 94L199 75Q160 91 118 81L112 107Z"/><path d="M140 44Q160 53 182 43" stroke="${a.accentColor}" stroke-width="5" fill="none"/><path d="M144 27Q159 17 177 30 M114 68Q154 46 197 65" ${light}/>`,
    sidePart: `<path d="M101 115Q84 66 123 48Q163 22 202 45Q229 62 220 111L205 95L199 74L181 62Q162 92 116 94L112 108Z"/><path d="M180 46Q181 60 175 69 M169 50Q147 72 112 79 M190 55Q205 63 211 79" ${light}/>`,
  };
}
export function hairGradient(a) {
  const ends = {
    bob: 180,
    bixie: 166,
    long: 220,
    braids: 210,
    locs: 210,
    ponytail: 180,
    wavy: 220,
    wolf: 195,
    mullet: 200,
    butterfly: 220,
    sideBraid: 235,
    halfUp: 220,
    fishtail: 235,
    twinTails: 215,
    shag: 205,
  };
  const stops =
    a.hairDye === "split"
      ? [
          [0, a.hairColor],
          [0.499, a.hairColor],
          [0.5, a.hairAccentColor],
          [1, a.hairAccentColor],
        ]
      : a.hairDye === "highlights"
        ? [
            [0, a.hairColor],
            [0.18, a.hairColor],
            [0.2, a.hairAccentColor],
            [0.25, a.hairAccentColor],
            [0.29, a.hairColor],
            [0.57, a.hairColor],
            [0.6, a.hairAccentColor],
            [0.65, a.hairAccentColor],
            [0.69, a.hairColor],
            [1, a.hairColor],
          ]
        : [
            [0, a.hairColor],
            [0.3, a.hairColor],
            [1, a.hairAccentColor],
          ];
  return `<linearGradient id="sticker-hair" gradientUnits="userSpaceOnUse" x1="70" y1="40" x2="${a.hairDye === "ombre" ? 70 : 250}" y2="${a.hairDye === "ombre" ? ends[a.hair] || 112 : 40}">${stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join("")}</linearGradient>`;
}
export function expandedOutfit(a, outline) {
  const trim = `fill="none" stroke="${a.accentColor}" stroke-width="3"`;
  return (
    {
      cardigan: `<path d="M134 214L160 267L186 214L181 337H138Z" fill="${a.accentColor}" ${outline}/><path d="M134 214L157 267V338 M186 214L164 267V338 M120 293H139V315H120Z M181 293H200V315H181Z" ${trim}/>${[281, 300, 319].map((y) => `<circle cx="159" cy="${y}" r="2.5" fill="${a.bottomColor}"/>`).join("")}`,
      puffer: `<path d="M131 213L144 230H178L190 213L202 337Q160 351 116 337Z" fill="${a.topColor}" ${outline}/><path d="M159 230V339 M121 253H198 M119 277H200 M117 302H202 M116 325H204" ${trim}/><path d="M131 213L144 230H178L190 213" fill="none" stroke="${a.accentColor}" stroke-width="8"/>`,
      sweater: `<path d="M136 215Q160 236 185 215 M118 328Q160 340 203 328" fill="none" stroke="${a.accentColor}" stroke-width="7"/>${[132, 158, 184].map((x) => `<path d="M${x} 247q-9 9 0 18t0 18t0 18t0 18 M${x + 5} 247q9 9 0 18t0 18t0 18t0 18" ${trim}/>`).join("")}`,
      polo: `<path d="M136 214L160 230L146 247L127 222 M184 214L160 230L175 247L194 222" fill="${a.accentColor}" ${outline}/><path d="M160 231V267 M119 321H201" ${trim}/><circle cx="160" cy="245" r="2" fill="${a.bottomColor}"/><circle cx="160" cy="256" r="2" fill="${a.bottomColor}"/><path d="M181 263l4-7l4 7l-4 5Z" fill="${a.accentColor}"/>`,
      jumpsuit: `<path d="M116 307H203L201 429H171L160 351L148 429H116Z" fill="${a.topColor}" ${outline}/><path d="M160 228V340 M120 305H201 M122 269H143V290H122Z M178 269H198V290H178Z M127 349V412 M191 349V412" ${trim}/><rect x="151" y="301" width="19" height="10" rx="2" fill="${a.accentColor}"/>`,
      sherwani: `<path d="M115 275L106 393Q160 405 214 393L203 275Z" fill="${a.topColor}" ${outline}/><path d="M139 214L142 231H179L183 214 M160 234V397 M110 384Q160 396 210 384" ${trim}/>${[247, 267, 287, 307, 327, 347].map((y) => `<circle cx="165" cy="${y}" r="3" fill="${a.accentColor}"/>`).join("")}<path d="M184 252l4 6l-4 6l-4-6Z M126 357l4 6l-4 6l-4-6Z M190 357l4 6l-4 6l-4-6Z" fill="${a.accentColor}"/>`,
    }[a.outfit] || ""
  );
}
export function expandedAccessory(a, outline) {
  const c = a.accentColor;
  return (
    {
      beanie: `<path d="M96 88Q88 30 157 29Q226 26 226 88Z" fill="${a.topColor}" ${outline}/><path d="M96 80Q160 66 226 81L226 101Q160 86 96 101Z" fill="${c}" ${outline}/>${[115, 132, 150, 168, 186, 204].map((x) => `<path d="M${x} 48V77" stroke="${c}" stroke-width="2" fill="none"/>`).join("")}`,
      bucket: `<path d="M112 45Q160 32 207 45L216 86L236 104Q159 119 83 104L103 86Z" fill="${a.topColor}" ${outline}/><path d="M105 80Q160 91 215 80" stroke="${c}" stroke-width="8" fill="none"/>`,
      beret: `<path d="M94 81Q71 52 115 34Q185 5 224 44Q244 67 217 87L113 93Z" fill="${a.topColor}" ${outline}/><path d="M111 83Q161 68 217 82" stroke="${c}" stroke-width="7" fill="none"/><path d="M172 29L176 18" stroke="${c}" stroke-width="5"/>`,
      bow: `<path d="M195 62Q173 29 170 61Q166 88 195 72Q220 94 223 68Q226 42 198 62Z" fill="${c}" ${outline}/><circle cx="196" cy="67" r="6" fill="${a.topColor}" ${outline}/><path d="M193 72L184 95L198 88L208 99L202 73" fill="${c}" ${outline}/>`,
      flower: `${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="209" cy="75" rx="6" ry="12" transform="rotate(${r} 209 86)" fill="${c}" ${outline}/>`).join("")}<circle cx="209" cy="86" r="6" fill="${a.topColor}" ${outline}/>`,
      studs: [-1, 1]
        .map(
          (s) =>
            `<path d="M${160 + s * 59} 145l2 5l6 1l-4 4l1 5l-5-3l-5 3l1-5l-4-4l6-1Z" fill="${c}" ${outline}/>`,
        )
        .join(""),
      crown: `<path d="M105 73L100 44L128 58L158 28L188 58L219 44L214 78Z" fill="${c}" ${outline}/><path d="M108 70Q160 81 212 72" fill="none" stroke="${a.topColor}" stroke-width="5"/><path d="M159 48l6 8l-6 8l-6-8Z" fill="${a.topColor}"/>`,
      scarf: "",
    }[a.accessory] || ""
  );
}

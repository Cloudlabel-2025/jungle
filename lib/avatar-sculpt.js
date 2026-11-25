import * as T from "three";
import { avatarFor } from "./avatar.js";

// Original procedural character art. All surfaces are generated from the saved
// cartoon recipe; no portrait texture, face embedding or remote avatar service.
export function sculptAvatar(input, { detail = true } = {}) {
  const a = avatarFor({ avatar: input }),
    female = a.style === "female";
  const root = new T.Group(),
    body = new T.Group();
  root.name = `personal-${a.style}`;
  root.add(body);
  body.position.y = 1.04;
  const materials = new Map(),
    sphere = new T.SphereGeometry(1, detail ? 32 : 20, detail ? 24 : 16);
  const tint = (hex, light) =>
    new T.Color(hex).lerp(
      new T.Color(light > 0 ? "#fff3e3" : "#201516"),
      Math.abs(light),
    );
  const mat = (color, kind = "cloth") => {
    const key = `${new T.Color(color).getHexString()}-${kind}`;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshPhysicalMaterial({
          color,
          roughness:
            kind === "skin"
              ? 0.57
              : kind === "hair"
                ? 0.62
                : kind === "metal"
                  ? 0.25
                  : 0.82,
          metalness: kind === "metal" ? 0.72 : 0,
          clearcoat: kind === "hair" ? 0.05 : kind === "skin" ? 0.08 : 0,
          clearcoatRoughness: 0.65,
          sheen: kind === "cloth" ? 0.28 : 0,
          sheenColor: new T.Color(color),
          side: T.DoubleSide,
        }),
      );
    return materials.get(key);
  };
  const mesh = (parent, geometry, color, kind) => {
    const m = new T.Mesh(geometry, mat(color, kind));
    parent.add(m);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const ball = (parent, color, p, s, kind = "skin") => {
    const m = mesh(parent, sphere, color, kind);
    m.position.set(...p);
    m.scale.set(...s);
    return m;
  };
  function curve(parent, points, radius, color, kind = "cloth", segments = 24) {
    return mesh(
      parent,
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        segments,
        radius,
        detail ? 8 : 5,
        false,
      ),
      color,
      kind,
    );
  }
  function surface(
    parent,
    rows,
    color,
    { kind = "cloth", pleat = 0, segments = 48, facial = false } = {},
  ) {
    const originals = rows;
    const profile = new T.CatmullRomCurve3(
      rows.map(([y, rx, rz]) => new T.Vector3(rx, y, rz)),
      false,
      "centripetal",
    );
    const vertical = detail ? (facial ? 64 : 40) : 22;
    rows = Array.from({ length: vertical + 1 }, (_, i) => {
      const p = profile.getPoint(i / vertical),
        j = (i / vertical) * (originals.length - 1),
        lo = Math.floor(j),
        hi = Math.min(originals.length - 1, lo + 1),
        t = j - lo;
      return [
        p.y,
        Math.max(0.001, p.x),
        Math.max(0.001, p.z),
        (originals[lo][3] || 0) * (1 - t) + (originals[hi][3] || 0) * t,
        (originals[lo][4] || 0) * (1 - t) + (originals[hi][4] || 0) * t,
      ];
    });
    const positions = [],
      indices = [],
      n = detail ? segments : 24;
    rows.forEach(([y, rx, rz, cx = 0, cz = 0], j) => {
      for (let i = 0; i <= n; i++) {
        const t = (i / n) * Math.PI * 2,
          fold = 1 + pleat * Math.cos(t * 18) * (j / (rows.length - 1));
        positions.push(
          cx + Math.sin(t) * rx * fold,
          y,
          cz +
            (facial
              ? Math.sign(Math.cos(t)) *
                  Math.pow(Math.abs(Math.cos(t)), 0.35) *
                  rz +
                Math.pow(Math.max(0, Math.cos(t)), 12) *
                  (0.018 *
                    Math.exp(
                      -Math.pow((Math.sin(t) * rx) / 0.025, 2) -
                        Math.pow((y + 0.008) / 0.08, 2),
                    ) +
                    0.049 *
                      Math.exp(
                        -Math.pow((Math.sin(t) * rx) / (0.038 * a.nose), 2) -
                          Math.pow((y + 0.072) / 0.035, 2),
                      ))
              : Math.cos(t) * rz * fold),
        );
        if (j && i) {
          const k = j * (n + 1) + i;
          indices.push(k, k - 1, k - n - 2, k, k - n - 2, k - n - 1);
        }
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    smoothSeam(g, n);
    const result = mesh(parent, g, color, kind);
    result.userData.profile = profile;
    return result;
  }
  function smoothSeam(g, n) {
    const normal = g.attributes.normal;
    for (let j = 0; j < normal.count / (n + 1); j++) {
      const first = j * (n + 1),
        last = first + n;
      const v = new T.Vector3(
        normal.getX(first) + normal.getX(last),
        normal.getY(first) + normal.getY(last),
        normal.getZ(first) + normal.getZ(last),
      ).normalize();
      normal.setXYZ(first, v.x, v.y, v.z);
      normal.setXYZ(last, v.x, v.y, v.z);
    }
  }
  function patch(parent, points, color, depth = 0.007, kind = "cloth") {
    const s = new T.Shape();
    points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    const m = mesh(
      parent,
      new T.ExtrudeGeometry(s, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.005,
        bevelThickness: 0.003,
        bevelSegments: 3,
        steps: 1,
      }),
      color,
      kind,
    );
    return m;
  }
  function segment(parent, from, to, radius, color, kind = "cloth") {
    const start = new T.Vector3(...from),
      end = new T.Vector3(...to),
      delta = end.clone().sub(start);
    const m = mesh(
      parent,
      new T.CylinderGeometry(radius * 0.88, radius, delta.length(), 20, 4),
      color,
      kind,
    );
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return m;
  }
  const width = a.body === "slender" ? 0.9 : a.body === "broad" ? 1.12 : 1;
  const shoulder = (female ? 0.265 : 0.29) * width;
  const clothDark = tint(a.topColor, -0.2),
    trim = a.accentColor;
  const torso = surface(
    body,
    [
      [0.015, 0.21, 0.137],
      [0.06, 0.235, 0.147],
      [0.18, female ? 0.185 : 0.218, 0.137],
      [0.33, 0.23, 0.151],
      [0.48, shoulder, 0.145],
      [0.56, shoulder * 0.91, 0.13],
      [0.61, 0.13, 0.095],
      [0.625, 0.088, 0.078],
    ],
    a.topColor,
  );
  // Garment construction: collar, seams, pockets, fasteners and ribbed trim.
  const front = 0.159;
  if (["shirt", "suit", "explorer"].includes(a.outfit)) {
    const shirt = a.outfit === "suit" ? "#efe9dd" : tint(a.topColor, 0.35);
    const bib = patch(
      body,
      [
        [-0.086, 0.6],
        [0.086, 0.6],
        [0.1, 0.3],
        [-0.1, 0.3],
      ],
      shirt,
    );
    bib.position.z = front;
    for (const s of [-1, 1]) {
      const collar = patch(
        body,
        [
          [s * 0.016, 0.59],
          [s * 0.095, 0.61],
          [s * 0.145, 0.51],
          [s * 0.055, 0.48],
        ],
        a.outfit === "suit" ? "#f5efdf" : trim,
      );
      collar.position.z = front + 0.018;
    }
    curve(
      body,
      [
        [0, 0.47, front + 0.025],
        [0, 0.3, front + 0.018],
        [0, 0.09, front + 0.002],
      ],
      0.004,
      trim,
    );
    for (let i = 0; i < 4; i++)
      ball(
        body,
        trim,
        [0.018, 0.38 - i * 0.075, front + 0.013],
        [0.008, 0.008, 0.005],
        "metal",
      );
    if (a.outfit === "suit") {
      for (const s of [-1, 1]) {
        const lapel = patch(
          body,
          [
            [s * 0.1, 0.6],
            [s * 0.2, 0.48],
            [s * 0.12, 0.41],
            [s * 0.15, 0.36],
            [0, 0.18],
          ],
          clothDark,
        );
        lapel.position.z = front + 0.017;
      }
      const tie = patch(
        body,
        [
          [0, 0.51],
          [-0.025, 0.39],
          [0, 0.33],
          [0.025, 0.39],
        ],
        trim,
      );
      tie.position.z = front + 0.037;
      ball(
        body,
        trim,
        [0.06, 0.18, front + 0.011],
        [0.012, 0.012, 0.006],
        "metal",
      );
    }
    if (a.outfit === "explorer") {
      for (const s of [-1, 1]) {
        const pocket = patch(
          body,
          [
            [s * 0.09, 0.37],
            [s * 0.205, 0.37],
            [s * 0.2, 0.25],
            [s * 0.09, 0.25],
          ],
          clothDark,
        );
        pocket.position.z = front + 0.004;
        const flap = patch(
          body,
          [
            [s * 0.085, 0.385],
            [s * 0.21, 0.385],
            [s * 0.2, 0.35],
            [s * 0.14, 0.335],
            [s * 0.085, 0.35],
          ],
          a.topColor,
        );
        flap.position.z = front + 0.014;
        ball(
          body,
          trim,
          [s * 0.15, 0.354, front + 0.027],
          [0.007, 0.007, 0.004],
          "metal",
        );
        curve(
          body,
          [
            [s * 0.18, 0.55, 0.13],
            [s * 0.25, 0.52, 0.1],
          ],
          0.016,
          trim,
        );
      }
    }
  }
  if (a.outfit === "hoodie") {
    const hood = surface(
      body,
      [
        [0.51, 0.17, 0.13, 0, -0.04],
        [0.61, 0.2, 0.15, 0, -0.06],
        [0.7, 0.15, 0.12, 0, -0.07],
        [0.73, 0.075, 0.06, 0, -0.07],
      ],
      clothDark,
    );
    hood.name = "sculpted-hood";
    for (const s of [-1, 1])
      curve(
        body,
        [
          [s * 0.055, 0.59, 0.155],
          [s * 0.075, 0.49, 0.175],
          [s * 0.066, 0.36, 0.17],
        ],
        0.0065,
        "#e9dec5",
      );
    const pocket = patch(
      body,
      [
        [-0.13, 0.25],
        [-0.15, 0.11],
        [0.15, 0.11],
        [0.13, 0.25],
        [0.095, 0.27],
        [-0.095, 0.27],
      ],
      tint(a.topColor, -0.08),
    );
    pocket.position.z = 0.152;
    for (const s of [-1, 1])
      curve(
        body,
        [
          [s * 0.12, 0.245, 0.17],
          [s * 0.08, 0.18, 0.177],
        ],
        0.0035,
        clothDark,
      );
    for (let i = 0; i < 4; i++)
      curve(
        body,
        [
          [-0.21, 0.035 + i * 0.008, 0.13],
          [0, 0.018 + i * 0.008, 0.146],
          [0.21, 0.035 + i * 0.008, 0.13],
        ],
        0.0025,
        clothDark,
      );
  }
  if (a.outfit === "varsity") {
    for (let i = 0; i < 3; i++)
      curve(
        body,
        [
          [-0.21, 0.025 + i * 0.014, 0.13],
          [0, 0.018 + i * 0.014, 0.147],
          [0.21, 0.025 + i * 0.014, 0.13],
        ],
        0.004,
        trim,
      );
    curve(
      body,
      [
        [0, 0.58, 0.15],
        [0, 0.29, 0.165],
        [0, 0.04, 0.145],
      ],
      0.007,
      trim,
    );
    for (let i = 0; i < 5; i++)
      ball(
        body,
        trim,
        [0.018, 0.48 - i * 0.085, 0.17],
        [0.009, 0.009, 0.005],
        "metal",
      );
    curve(
      body,
      [
        [-0.19, 0.44, 0.16],
        [-0.15, 0.34, 0.17],
        [-0.11, 0.44, 0.16],
      ],
      0.009,
      trim,
    );
  }
  if (a.outfit === "kurta") {
    surface(
      body,
      [
        [-0.47, 0.255, 0.16],
        [-0.43, 0.25, 0.16],
        [-0.15, 0.23, 0.15],
        [0.05, 0.23, 0.146],
        [0.23, 0.21, 0.14],
      ],
      a.topColor,
      { pleat: 0.012 },
    );
    for (const s of [-1, 1])
      curve(
        body,
        [
          [s * 0.035, 0.59, 0.145],
          [s * 0.043, 0.4, 0.163],
          [s * 0.032, 0.29, 0.16],
        ],
        0.004,
        trim,
      );
    for (let i = 0; i < 7; i++)
      ball(
        body,
        trim,
        [0, 0.52 - i * 0.031, 0.165],
        [0.005, 0.006, 0.003],
        "metal",
      );
    curve(
      body,
      [
        [-0.25, -0.44, 0.06],
        [-0.15, -0.46, 0.14],
        [0, -0.465, 0.165],
        [0.15, -0.46, 0.14],
        [0.25, -0.44, 0.06],
      ],
      0.007,
      trim,
    );
  }
  if (["dress", "sari"].includes(a.outfit)) {
    const sari = a.outfit === "sari";
    surface(
      body,
      [
        [sari ? -0.86 : -0.56, sari ? 0.31 : 0.37, 0.21],
        [sari ? -0.8 : -0.5, sari ? 0.3 : 0.35, 0.205],
        [-0.28, 0.29, 0.18],
        [0.02, 0.236, 0.158],
        [0.16, 0.197, 0.148],
      ],
      a.topColor,
      { pleat: 0.035 },
    );
    curve(
      body,
      [
        [-0.19, 0.16, 0.1],
        [0, 0.15, 0.146],
        [0.19, 0.16, 0.1],
      ],
      0.013,
      trim,
    );
    if (sari) {
      const drape = patch(
        body,
        [
          [-0.24, 0.61],
          [-0.13, 0.64],
          [0.22, 0.14],
          [0.22, -0.28],
          [0.12, -0.35],
          [0.12, 0.04],
        ],
        trim,
        0.014,
      );
      drape.position.z = 0.19;
      curve(
        body,
        [
          [-0.22, 0.61, 0.213],
          [-0.05, 0.37, 0.216],
          [0.15, 0.11, 0.216],
          [0.15, -0.27, 0.216],
        ],
        0.006,
        tint(trim, -0.24),
      );
      for (let i = 0; i < 9; i++)
        curve(
          body,
          [
            [0.125 + i * 0.011, -0.29, 0.215],
            [0.13 + i * 0.01, -0.39, 0.213],
          ],
          0.003,
          trim,
        );
      curve(
        body,
        [
          [-0.27, -0.82, 0.09],
          [-0.18, -0.86, 0.175],
          [0, -0.865, 0.22],
          [0.18, -0.86, 0.175],
          [0.27, -0.82, 0.09],
        ],
        0.012,
        trim,
      );
    }
  }
  // A smooth neck and sculpted face, rather than an oval with glued-on eyes.
  segment(body, [0, 0.55, 0], [0, 0.77, 0.005], 0.074, a.skin, "skin");
  const head = new T.Group();
  head.position.set(0, 0.94, 0.008);
  head.scale.set(a.faceWidth, a.faceLength, 1);
  body.add(head);
  const face = surface(
    head,
    [
      [-0.335, 0.035, 0.075],
      [-0.3, 0.125 * a.jaw, 0.13],
      [-0.24, 0.195 * a.jaw, 0.175],
      [-0.14, 0.251, 0.205],
      [-0.025, 0.277, 0.226],
      [0.1, 0.276, 0.223],
      [0.23, 0.248, 0.203],
      [0.32, 0.18, 0.15],
      [0.36, 0.02, 0.025],
    ],
    a.skin,
    { kind: "skin", segments: 96, facial: true },
  );
  const faceFront = (x, y) => {
    const profile = face.userData.profile;
    let low = 0,
      high = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (low + high) / 2;
      if (profile.getPoint(mid).y < y) low = mid;
      else high = mid;
    }
    const p = profile.getPoint((low + high) / 2),
      cos = Math.sqrt(Math.max(0, 1 - Math.pow(x / Math.max(0.001, p.x), 2)));
    return (
      Math.pow(cos, 0.35) * p.z +
      Math.pow(cos, 12) *
        (0.018 *
          Math.exp(-Math.pow(x / 0.025, 2) - Math.pow((y + 0.008) / 0.08, 2)) +
          0.049 *
            Math.exp(
              -Math.pow(x / (0.038 * a.nose), 2) -
                Math.pow((y + 0.072) / 0.035, 2),
            ))
    );
  };
  function projectFace(g, offset) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++)
      pos.setZ(i, faceFront(pos.getX(i), pos.getY(i)) + offset);
    g.computeVertexNormals();
  }
  const lipCurve = (parent, points, radius, color, kind) =>
    curve(
      parent,
      points.map(([x, y]) => [x, y, faceFront(x, y) + 0.006]),
      radius,
      color,
      kind,
    );
  for (const s of [-1, 1]) {
    const ear = ball(
      head,
      a.skin,
      [s * 0.276, -0.025, 0],
      [0.051, 0.083, 0.045],
    );
    ear.rotation.z = -s * 0.15;
    ball(
      head,
      tint(a.skin, -0.16),
      [s * 0.291, -0.024, 0.034],
      [0.024, 0.048, 0.014],
    );
    curve(
      head,
      [
        [s * 0.288, -0.07, 0.04],
        [s * 0.311, -0.01, 0.04],
        [s * 0.294, 0.028, 0.035],
      ],
      0.007,
      tint(a.skin, 0.12),
      "skin",
    );
  }
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new T.Group();
    eye.position.set(s * 0.112 * a.eyeSpacing, 0.035, 0.21);
    eye.scale.setScalar(a.eyeSize);
    head.add(eye);
    eyes.push(eye);
    const shape = new T.Shape();
    shape.moveTo(-0.069, 0);
    shape.bezierCurveTo(-0.036, 0.043, 0.039, 0.043, 0.07, 0.002);
    shape.bezierCurveTo(0.035, -0.029, -0.035, -0.03, -0.069, 0);
    const white = mesh(
      eye,
      new T.ExtrudeGeometry(shape, {
        depth: 0.012,
        bevelEnabled: true,
        bevelSize: 0.005,
        bevelThickness: 0.004,
        bevelSegments: 3,
      }),
      "#f7eee3",
      "skin",
    );
    white.name = "almond-eye";
    ball(eye, tint(a.eyeColor, -0.4), [0, 0.004, 0.024], [0.027, 0.029, 0.009]);
    ball(eye, a.eyeColor, [0, 0.004, 0.03], [0.023, 0.025, 0.008]);
    ball(eye, "#191b1b", [0, 0.004, 0.037], [0.012, 0.018, 0.005]);
    ball(eye, "#fffdf5", [-0.008, 0.015, 0.043], [0.006, 0.007, 0.003]);
    ball(eye, "#ffefcc", [0.009, -0.005, 0.043], [0.0025, 0.003, 0.002]);
    curve(
      eye,
      [
        [-0.07, 0, 0.02],
        [-0.035, 0.03, 0.024],
        [0.012, 0.035, 0.025],
        [0.05, 0.022, 0.024],
        [0.07, 0.002, 0.019],
      ],
      female ? 0.0045 : 0.0032,
      tint(a.skin, -0.48),
      "skin",
    );
    curve(
      eye,
      [
        [-0.062, -0.005, 0.014],
        [0, -0.023, 0.021],
        [0.062, -0.004, 0.017],
      ],
      0.0025,
      tint(a.skin, -0.15),
      "skin",
    );
    const browY = 0.112 + (a.brows - 1) * 0.045;
    curve(
      head,
      [
        [s * 0.052, browY - 0.003, 0.216],
        [s * 0.105, browY + 0.015, 0.222],
        [s * 0.157, browY + 0.011, 0.211],
        [s * 0.185, browY - 0.002, 0.192],
      ],
      female ? 0.008 : 0.012,
      a.hairColor,
      "hair",
    );
    if (female)
      for (let i = 0; i < 3; i++)
        curve(
          eye,
          [
            [s * (0.048 + i * 0.007), 0.02 - i * 0.004, 0.026],
            [s * (0.057 + i * 0.008), 0.031 - i * 0.003, 0.023],
          ],
          0.002,
          tint(a.hairColor, -0.2),
          "hair",
          6,
        );
  }
  for (const side of [-1, 1])
    ball(
      head,
      tint(a.skin, -0.2),
      [side * 0.022 * a.nose, -0.091, 0.257],
      [0.005, 0.0025, 0.0025],
    );
  const lip = tint(a.skin, female ? -0.29 : -0.23).lerp(
      new T.Color("#a65a50"),
      0.38,
    ),
    m = 0.085 * a.mouth;
  if (a.expression === "soft") {
    lipCurve(
      head,
      [
        [-m, -0.177, 0.185],
        [-m * 0.35, -0.184, 0.2],
        [0, -0.179, 0.204],
        [m * 0.35, -0.184, 0.2],
        [m, -0.177, 0.185],
      ],
      female ? 0.009 : 0.006,
      lip,
      "skin",
    );
    lipCurve(
      head,
      [
        [-m * 0.8, -0.185, 0.193],
        [0, -0.194, 0.204],
        [m * 0.8, -0.185, 0.193],
      ],
      0.009,
      tint(lip, 0.12),
      "skin",
    );
  } else {
    const grin = a.expression === "grin",
      depth = grin ? 0.047 : 0.025;
    const mouth = new T.Shape();
    mouth.moveTo(-m, -0.169);
    mouth.quadraticCurveTo(0, -0.193, m, -0.169);
    mouth.quadraticCurveTo(0, -0.21 - depth, -m, -0.169);
    const gap = mesh(head, new T.ShapeGeometry(mouth), "#623630", "skin");
    projectFace(gap.geometry, 0.005);
    lipCurve(
      head,
      [
        [-m, -0.169, 0.19],
        [0, -0.181, 0.208],
        [m, -0.169, 0.19],
      ],
      0.0025,
      lip,
      "skin",
    );
    lipCurve(
      head,
      [
        [-m * 0.95, -0.174, 0.191],
        [0, -0.185 - depth * 0.65, 0.199],
        [m * 0.95, -0.174, 0.191],
      ],
      female ? 0.0045 : 0.003,
      lip,
      "skin",
    );
    if (grin) {
      const teeth = new T.Shape();
      teeth.moveTo(-m * 0.85, -0.179);
      teeth.quadraticCurveTo(0, -0.197, m * 0.85, -0.179);
      teeth.lineTo(m * 0.7, -0.197);
      teeth.quadraticCurveTo(0, -0.21, -m * 0.7, -0.197);
      teeth.closePath();
      const t = mesh(head, new T.ShapeGeometry(teeth), "#fff4e4", "skin");
      projectFace(t.geometry, 0.009);
    }
  }
  const tail = new T.Group();
  head.add(tail);
  // A continuous hairline conforms to the sculpted head, including side views.
  if (a.hair !== "bald") {
    const positions = [],
      indices = [],
      n = detail ? 96 : 48,
      rings = detail ? 32 : 20,
      profile = face.userData.profile;
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i <= n; i++) {
        const phi = (i / n) * Math.PI * 2,
          cos = Math.cos(phi),
          edge = -0.12 + Math.pow(Math.max(0, cos), 0.5) * 0.35,
          y = 0.36 - ((0.36 - edge) * j) / rings;
        let lo = 0,
          hi = 1;
        for (let k = 0; k < 15; k++) {
          const mid = (lo + hi) / 2;
          if (profile.getPoint(mid).y < y) lo = mid;
          else hi = mid;
        }
        const p = profile.getPoint((lo + hi) / 2);
        positions.push(
          Math.sin(phi) * p.x * 1.035,
          y + 0.011,
          Math.sign(cos) * Math.pow(Math.abs(cos), 0.35) * p.z * 1.045,
        );
        if (i && j) {
          const k = j * (n + 1) + i;
          indices.push(k, k - 1, k - n - 2, k, k - n - 2, k - n - 1);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    smoothSeam(g, n);
    mesh(head, g, a.hairColor, "hair");
  }
  function lock(points, radius, color = a.hairColor) {
    const c = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
      g = new T.TubeGeometry(c, 28, radius, 8, false);
    // Taper each lock around its centerline to avoid blunt plastic tube ends.
    const attr = g.attributes.position;
    for (let j = 0; j <= 28; j++) {
      const center = c.getPointAt(j / 28),
        scale =
          0.18 +
          0.82 * Math.pow(Math.sin(Math.PI * (0.08 + (0.89 * j) / 28)), 0.55);
      for (let k = 0; k <= 8; k++) {
        const i = j * 9 + k;
        attr.setXYZ(
          i,
          center.x + (attr.getX(i) - center.x) * scale,
          center.y + (attr.getY(i) - center.y) * scale,
          center.z + (attr.getZ(i) - center.z) * scale,
        );
      }
    }
    g.computeVertexNormals();
    return mesh(tail, g, color, "hair");
  }
  if (["swept", "long", "bob", "bun", "braids"].includes(a.hair))
    for (let i = 0; i < 11; i++) {
      const d = i * 0.017;
      lock(
        [
          [-0.247 + d, 0.16, 0.13],
          [-0.22 + d, 0.3, 0.17],
          [-0.08 + d, 0.39, 0.15],
          [0.12 + d * 0.3, 0.29, 0.19],
          [0.24, 0.12 - d * 0.08, 0.1],
        ],
        0.025 + (a.hair === "swept" ? 0.008 : 0),
      );
    }
  if (["long", "bob"].includes(a.hair)) {
    const end = a.hair === "long" ? -0.53 : -0.19;
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const d = i * 0.022;
        lock(
          [
            [side * (0.22 + d * 0.25), 0.25, -0.045 - d],
            [side * (0.282 + d * 0.15), 0.01, -0.04 - d],
            [side * (0.27 + d * 0.1), end * 0.65, -0.02 - d],
            [side * (0.23 + d * 0.14), end, -0.018 - d],
          ],
          0.035,
        );
      }
    for (let i = 0; i < 9; i++)
      lock(
        [
          [(i - 4) * 0.045, 0.25, -0.17],
          [(i - 4) * 0.061, -0.04, -0.22],
          [(i - 4) * 0.055, end, -0.19],
        ],
        0.04,
      );
  }
  if (a.hair === "braids")
    for (const side of [-1, 1])
      for (let strand = 0; strand < 3; strand++) {
        const points = Array.from({ length: 28 }, (_, i) => [
          side * 0.27 + Math.sin(i * 0.95 + strand * 2.094) * 0.024,
          0.08 - i * 0.023,
          -0.02 + Math.cos(i * 0.95 + strand * 2.094) * 0.024,
        ]);
        lock(points, 0.018);
      }
  if (a.hair === "bun") {
    ball(tail, a.hairColor, [0, 0.36, -0.15], [0.125, 0.12, 0.108], "hair");
    for (let k = 0; k < 8; k++)
      curve(
        tail,
        Array.from({ length: 25 }, (_, i) => {
          const t = (i / 24) * Math.PI * 2;
          return [
            Math.cos(t) * (0.07 + k * 0.006),
            0.36 + Math.sin(t) * (0.07 + k * 0.006),
            -0.09 - k * 0.012,
          ];
        }),
        0.004,
        tint(a.hairColor, k % 2 ? 0.06 : -0.08),
        "hair",
      );
  }
  if (["curls", "afro"].includes(a.hair)) {
    const count = a.hair === "afro" ? 65 : 38;
    for (let i = 0; i < count; i++) {
      const phi = i * 2.39996,
        r = Math.sqrt((i + 0.5) / count),
        theta = r * 1.65,
        rx = a.hair === "afro" ? 0.32 : 0.275;
      const x = Math.sin(theta) * Math.cos(phi) * rx,
        z = Math.sin(theta) * Math.sin(phi) * rx * 0.84 - 0.025,
        y = Math.cos(theta) * rx + 0.13;
      ball(tail, a.hairColor, [x, y, z], [0.058, 0.06, 0.055], "hair");
      if (detail)
        curve(
          tail,
          Array.from({ length: 12 }, (_, k) => {
            const t = (k / 11) * Math.PI * 1.8;
            return [x + Math.cos(t) * 0.033, y + Math.sin(t) * 0.03, z + 0.043];
          }),
          0.004,
          tint(a.hairColor, 0.1),
          "hair",
          12,
        );
    }
  }
  if (a.hair === "crop")
    for (let i = 0; i < 25; i++)
      curve(
        tail,
        [
          [(i - 12) * 0.019, 0.17, 0.2],
          [(i - 12) * 0.017, 0.28, 0.19],
          [(i - 12) * 0.013, 0.35, 0.12],
        ],
        0.002,
        tint(a.hairColor, 0.1),
        "hair",
      );
  if (a.facialHair !== "none") {
    if (a.facialHair !== "moustache") {
      const beard = surface(
        head,
        [
          [-0.319, 0.065, 0.112],
          [-0.29, 0.13 * a.jaw, 0.159],
          [-0.25, 0.19 * a.jaw, 0.185],
          [-0.2, 0.222, 0.197],
          [-0.15, 0.238, 0.196],
        ],
        a.hairColor,
        { kind: "hair" },
      );
      if (a.facialHair === "stubble") {
        beard.material = beard.material.clone();
        beard.material.transparent = true;
        beard.material.opacity = 0.26;
      }
    }
    if (["moustache", "beard"].includes(a.facialHair))
      for (const s of [-1, 1])
        lock(
          [
            [s * 0.006, -0.123, 0.235],
            [s * 0.042, -0.128, 0.24],
            [s * 0.073, -0.15, 0.213],
          ],
          0.012,
        );
  }
  if (a.glasses !== "none")
    for (const s of [-1, 1]) {
      const round = a.glasses === "round",
        x = s * 0.112 * a.eyeSpacing,
        framePoints = Array.from({ length: 49 }, (_, i) => {
          const t = (i / 48) * Math.PI * 2;
          return [
            x + Math.cos(t) * 0.081,
            0.036 + Math.sin(t) * (round ? 0.065 : 0.049),
            0.258 + Math.sin(t) * 0.003,
          ];
        });
      if (!round)
        for (const p of framePoints) {
          p[0] =
            x +
            Math.sign(p[0] - x) * Math.min(0.078, Math.abs(p[0] - x) * 1.25);
          p[1] =
            0.036 +
            Math.sign(p[1] - 0.036) *
              Math.min(0.047, Math.abs(p[1] - 0.036) * 1.4);
        }
      curve(
        head,
        framePoints,
        0.006,
        a.glasses === "sunglasses" ? "#202c2a" : "#665441",
        "metal",
        48,
      );
      if (a.glasses === "sunglasses")
        ball(
          head,
          "#243c42",
          [x, 0.036, 0.252],
          [0.073, 0.043, 0.008],
          "metal",
        );
      curve(
        head,
        [
          [s * 0.035, 0.048, 0.26],
          [0, 0.063, 0.257],
          [-s * 0.035, 0.048, 0.26],
        ],
        0.0045,
        "#665441",
        "metal",
      );
      curve(
        head,
        [
          [s * 0.19, 0.06, 0.252],
          [s * 0.27, 0.055, 0.15],
          [s * 0.29, 0.035, 0.01],
        ],
        0.0045,
        "#665441",
        "metal",
      );
    }
  if (a.accessory === "earrings")
    for (const s of [-1, 1]) {
      const hoop = mesh(
        head,
        new T.TorusGeometry(0.032, 0.005, 10, 32),
        trim,
        "metal",
      );
      hoop.position.set(s * 0.293, -0.107, 0.025);
    }
  if (a.accessory === "headphones") {
    curve(
      head,
      Array.from({ length: 33 }, (_, i) => {
        const t = (i / 32) * Math.PI;
        return [Math.cos(t) * 0.32, Math.sin(t) * 0.4 + 0.01, -0.012];
      }),
      0.021,
      a.accentColor,
      "cloth",
      40,
    );
    for (const s of [-1, 1]) {
      ball(
        head,
        "#263a37",
        [s * 0.302, -0.01, 0],
        [0.045, 0.08, 0.065],
        "cloth",
      );
      ball(
        head,
        a.topColor,
        [s * 0.33, -0.01, 0],
        [0.022, 0.065, 0.052],
        "cloth",
      );
    }
  }
  if (a.accessory === "cap") {
    const cap = mesh(
      head,
      new T.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.44),
      a.topColor,
    );
    cap.position.y = 0.06;
    cap.scale.set(0.303, 0.34, 0.25);
    const brim = ball(
      head,
      a.topColor,
      [0, 0.136, 0.225],
      [0.275, 0.018, 0.145],
      "cloth",
    );
    brim.rotation.x = 0.1;
    curve(
      head,
      [
        [0, 0.39, -0.04],
        [0, 0.35, 0.1],
        [0, 0.18, 0.25],
      ],
      0.003,
      tint(a.topColor, 0.2),
    );
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(s * 0.12, 1.06, 0);
    root.add(leg);
    legs.push(leg);
    surface(
      leg,
      [
        [-0.88, 0.078, 0.075],
        [-0.8, 0.083, 0.079],
        [-0.57, 0.088, 0.084],
        [-0.43, 0.094, 0.092],
        [-0.23, 0.108, 0.105],
        [0, 0.116, 0.11],
      ],
      a.bottomColor,
    );
    curve(
      leg,
      [
        [s * 0.095, -0.18, 0.045],
        [s * 0.083, -0.48, 0.025],
        [s * 0.076, -0.82, 0.025],
      ],
      0.0025,
      tint(a.bottomColor, 0.19),
    );
    for (let k = 0; k < 2; k++)
      curve(
        leg,
        [
          [-0.065, -0.43 - k * 0.025, 0.079],
          [0.01, -0.45 - k * 0.025, 0.097],
          [0.055, -0.44 - k * 0.025, 0.078],
        ],
        0.002,
        tint(a.bottomColor, -0.15),
      );
    const shoe = new T.Group();
    shoe.position.set(0, -0.923, 0.05);
    leg.add(shoe);
    const sneaker = a.shoes === "sneakers",
      formal = a.shoes === "formal",
      base = sneaker ? trim : "#3a3732";
    ball(shoe, base, [0, 0.005, 0.045], [0.1, 0.071, 0.18], "cloth");
    ball(
      shoe,
      sneaker ? "#e9e4d9" : "#292d2c",
      [0, -0.046, 0.04],
      [0.103, 0.025, 0.185],
      "cloth",
    );
    if (!formal) {
      surface(
        shoe,
        [
          [0.015, 0.085, 0.085],
          [0.11, 0.072, 0.068],
          [0.14, 0.07, 0.068],
        ],
        base,
      );
      for (let k = 0; k < 4; k++)
        curve(
          shoe,
          [
            [-0.043, 0.075 - k * 0.011, 0.085 + k * 0.018],
            [0, 0.071 - k * 0.009, 0.09 + k * 0.018],
            [0.043, 0.075 - k * 0.011, 0.085 + k * 0.018],
          ],
          0.004,
          sneaker ? "#f5eee1" : trim,
        );
    }
    if (sneaker)
      curve(
        shoe,
        [
          [s * 0.087, 0.0, -0.035],
          [s * 0.096, 0.012, 0.035],
          [s * 0.09, 0.005, 0.1],
        ],
        0.008,
        a.topColor,
      );
  }
  function arm(s) {
    const group = new T.Group();
    body.add(group);
    const upper = new T.Group(),
      lower = new T.Group();
    group.add(upper, lower);
    const sleeveColor = a.outfit === "varsity" ? trim : a.topColor;
    const shoulderV = new T.Vector3(s * (shoulder + 0.005), 0.49, 0);
    const upperMesh = surface(
      upper,
      [
        [-0.17, 0.059, 0.061],
        [-0.15, 0.073, 0.074],
        [0.04, 0.088, 0.085],
        [0.17, 0.075, 0.073],
      ],
      sleeveColor,
    );
    const lowerMesh = surface(
      lower,
      [
        [-0.17, 0.042, 0.043],
        [-0.14, 0.047, 0.049],
        [0.1, 0.061, 0.061],
        [0.17, 0.059, 0.061],
      ],
      a.outfit === "dress" || a.outfit === "sari" ? a.skin : sleeveColor,
      { kind: a.outfit === "dress" || a.outfit === "sari" ? "skin" : "cloth" },
    );
    const hand = new T.Group();
    group.add(hand);
    ball(hand, a.skin, [0, -0.039, 0], [0.045, 0.065, 0.027]);
    for (let i = 0; i < 4; i++) {
      const f = ball(
        hand,
        a.skin,
        [(i - 1.5) * 0.021, -0.099 + Math.abs(i - 1.5) * 0.008, 0.002],
        [0.011, 0.038, 0.013],
      );
      f.rotation.z = (i - 1.5) * 0.045;
    }
    const thumb = ball(
      hand,
      a.skin,
      [s * 0.043, -0.035, 0.012],
      [0.017, 0.035, 0.017],
    );
    thumb.rotation.z = s * 0.6;
    const cuff = ball(
      lower,
      sleeveColor,
      [0, -0.15, 0],
      [0.049, 0.025, 0.052],
      "cloth",
    );
    for (let k = 0; k < 3; k++)
      curve(
        lower,
        [
          [-0.037, -0.13 - k * 0.008, 0.034],
          [0, -0.13 - k * 0.008, 0.048],
          [0.037, -0.13 - k * 0.008, 0.034],
        ],
        0.0025,
        a.outfit === "varsity" ? a.topColor : tint(sleeveColor, -0.16),
      );
    return {
      side: s,
      shoulder: shoulderV,
      upper,
      lower,
      upperMesh,
      lowerMesh,
      hand,
      cuff,
      target: new T.Vector3(),
      pole: new T.Vector3(),
      elbow: { position: new T.Vector3() },
    };
  }
  const arms = [arm(-1), arm(1)];
  const rig = {
    root,
    body,
    torso,
    head,
    eyes,
    tail,
    legs,
    arms,
    avatar: a,
    sculpted: true,
    torsoBaseScale: 1,
    phase: 0,
    yaw: 0,
    waveAt: -Infinity,
    gesture: "idle",
  };
  poseSculpt(rig, 1);
  return rig;
}

export function poseSculpt(rig, time, { animate = true, studio = false } = {}) {
  const a = rig.avatar,
    t = time + rig.phase,
    cycle = ((t % 25) + 25) % 25,
    since = time - rig.waveAt;
  let gesture =
    since >= 0 && since < 2.8
      ? "wave"
      : cycle >= 5 && cycle < 10
        ? "outfit"
        : cycle >= 11 && cycle < 16
          ? "hair"
          : cycle >= 17 && cycle < 21
            ? "stretch"
            : cycle >= 21
              ? "look"
              : "idle";
  if (!animate) gesture = a.pose === "wave" ? "wave" : "idle";
  if (studio) gesture = a.pose === "wave" ? "wave" : "idle";
  rig.gesture = gesture;
  rig.root.rotation.y = rig.yaw + (animate ? Math.sin(t * 0.43) * 0.055 : 0);
  rig.body.rotation.z = animate ? Math.sin(t * 0.8) * 0.008 : 0;
  rig.head.rotation.set(
    gesture === "outfit" ? 0.24 : animate ? Math.sin(t * 0.85) * 0.025 : 0,
    animate ? Math.sin(t * 0.51) * 0.09 : 0,
    animate ? Math.sin(t) * 0.016 : 0,
  );
  rig.torso.scale.y = 1 + (animate ? Math.sin(t * 1.5) * 0.003 : 0);
  const blink = animate && Math.cos(t * 1.31) > 0.997 ? 0.12 : 1;
  rig.eyes.forEach((eye) => (eye.scale.y = blink * a.eyeSize));
  for (const arm of rig.arms) {
    const s = arm.side,
      shoulder = arm.shoulder.clone();
    let wrist = new T.Vector3(
        s * 0.34,
        -0.15,
        0.045 + (animate ? Math.sin(t * 1.2 + s) * 0.018 : 0),
      ),
      elbow = new T.Vector3(s * 0.37, 0.2, 0);
    if (a.pose === "confident") {
      wrist.set(s * 0.22, 0.1, 0.17);
      elbow.set(s * 0.47, 0.27, 0.03);
    }
    if (gesture === "wave" && s === -1) {
      wrist.set(-0.47, 0.99, 0.16);
      elbow.set(-0.57, 0.59, 0.04);
    }
    if (gesture === "hair" && s === -1) {
      wrist.set(-0.22, 0.94, 0.1);
      elbow.set(-0.49, 0.59, 0.09);
    }
    if (gesture === "stretch") {
      wrist.set(s * 0.62, 0.91 + Math.sin(t * 3) * 0.008, 0.02);
      elbow.set(s * 0.51, 0.61, 0);
    }
    if (gesture === "outfit") {
      wrist.set(s * 0.16, 0.28, 0.27);
      elbow.set(s * 0.44, 0.25, 0.12);
    }
    function align(group, from, to, length) {
      const d = to.clone().sub(from);
      group.position.copy(from).add(to).multiplyScalar(0.5);
      group.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        from.clone().sub(to).normalize(),
      );
      group.scale.y = d.length() / length;
    }
    align(arm.upper, shoulder, elbow, 0.34);
    align(arm.lower, elbow, wrist, 0.34);
    arm.elbow.position.copy(elbow);
    arm.hand.position.copy(wrist);
    arm.hand.quaternion.setFromUnitVectors(
      new T.Vector3(0, -1, 0),
      wrist.clone().sub(elbow).normalize(),
    );
    if (gesture === "wave" && s === -1)
      arm.hand.rotateZ(Math.sin(t * 6) * 0.22);
  }
  return gesture;
}

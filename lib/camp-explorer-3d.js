import * as THREE from "three";

const appearances = {
  blaze: {
    skin: "#9d5938",
    hair: "#211510",
    coat: "#d77a24",
    accent: "#efb34c",
  },
  glitch: {
    skin: "#d9b18a",
    hair: "#171b23",
    coat: "#20b7c7",
    accent: "#83e7da",
  },
  shade: {
    skin: "#663a2b",
    hair: "#201716",
    coat: "#7139a1",
    accent: "#b6a2d0",
  },
  pulse: {
    skin: "#b77b53",
    hair: "#3b251b",
    coat: "#d54f5d",
    accent: "#f78c8d",
  },
  rune: {
    skin: "#ae704c",
    hair: "#211b18",
    coat: "#788c32",
    accent: "#bbca69",
  },
};
const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (value) => {
  const n = Math.max(0, Math.min(1, value));
  return n * n * (3 - 2 * n);
};

export function createExplorer(key, variant = "male") {
  const colors = appearances[key] || appearances.blaze;
  const female = variant === "female";
  const root = new THREE.Group();
  root.name = `${key}-${variant}`;
  const body = new THREE.Group();
  body.position.y = 1.04;
  root.add(body);
  const geometry = {
    ball: new THREE.SphereGeometry(1, 16, 12),
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  };
  const materials = new Map();
  function material(color, metal = false) {
    const token = `${color}-${metal}`;
    if (!materials.has(token))
      materials.set(
        token,
        new THREE.MeshStandardMaterial({
          color,
          roughness: metal ? 0.4 : 0.85,
          metalness: metal ? 0.45 : 0,
        }),
      );
    return materials.get(token);
  }
  function shape(parent, type, color, position, size) {
    const mesh = new THREE.Mesh(geometry[type], material(color));
    mesh.position.set(...position);
    mesh.scale.set(...size);
    parent.add(mesh);
    return mesh;
  }
  const ball = (parent, color, position, size) =>
    shape(parent, "ball", color, position, size);
  const box = (parent, color, position, size) =>
    shape(parent, "box", color, position, size);
  const pipe = (parent, color, from, to, radius) => {
    const mesh = shape(
      parent,
      "cylinder",
      color,
      [0, 0, 0],
      [radius, 1, radius],
    );
    setSegment(
      mesh,
      new THREE.Vector3(...from),
      new THREE.Vector3(...to),
      radius,
    );
    return mesh;
  };
  const trousers = "#303532",
    boots = "#292b28",
    straps = "#45483a";
  ball(body, trousers, [0, 0.01, 0], [female ? 0.245 : 0.255, 0.16, 0.155]);
  const torso = ball(
    body,
    colors.coat,
    [0, 0.32, 0],
    [female ? 0.245 : 0.28, 0.34, 0.175],
  );
  ball(body, "#e3d8bd", [0, 0.36, 0.15], [0.115, 0.255, 0.04]);
  for (const side of [-1, 1]) {
    const lapel = box(
      body,
      colors.accent,
      [side * 0.145, 0.42, 0.155],
      [0.055, 0.42, 0.045],
    );
    lapel.rotation.z = side * -0.12;
    const strap = box(
      body,
      straps,
      [side * 0.21, 0.37, 0.16],
      [0.045, 0.48, 0.045],
    );
    strap.rotation.z = side * 0.12;
    box(body, "#b0aa8a", [side * 0.21, 0.4, 0.19], [0.06, 0.055, 0.018]);
    box(body, colors.coat, [side * 0.16, 0.12, 0.171], [0.13, 0.12, 0.045]);
  }
  // The backpack and rear hair remain visible when the player turns the model.
  ball(body, "#424a36", [0, 0.34, -0.21], [0.23, 0.29, 0.13]);
  box(body, "#5b6546", [0, 0.27, -0.33], [0.3, 0.19, 0.055]);
  box(body, colors.accent, [0, 0.49, -0.34], [0.12, 0.04, 0.018]);
  pipe(body, colors.skin, [0, 0.57, 0], [0, 0.7, 0], 0.075);

  const head = new THREE.Group();
  head.position.set(0, 0.83, 0.015);
  body.add(head);
  ball(head, colors.skin, [0, 0, 0], [female ? 0.205 : 0.215, 0.245, 0.195]);
  for (const side of [-1, 1])
    ball(head, colors.skin, [side * 0.211, -0.005, 0], [0.045, 0.065, 0.042]);
  ball(head, colors.skin, [0, -0.015, 0.195], [0.036, 0.05, 0.045]);
  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.085, 0.035, 0.176);
    head.add(eye);
    eyes.push(eye);
    ball(eye, "#f8f0df", [0, 0, 0], [0.055, 0.045, 0.036]);
    ball(eye, "#30221c", [side * -0.004, -0.002, 0.028], [0.024, 0.028, 0.013]);
    ball(eye, "#fff9de", [-0.007, 0.01, 0.039], [0.007, 0.008, 0.004]);
    const brow = box(
      head,
      colors.hair,
      [side * 0.088, 0.112, 0.186],
      [0.1, 0.018, 0.025],
    );
    brow.rotation.z = -side * 0.13;
  }
  const smileCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.068, -0.094, 0.18),
    new THREE.Vector3(0, -0.13, 0.211),
    new THREE.Vector3(0.068, -0.089, 0.18),
  );
  const smileGeometry = new THREE.TubeGeometry(smileCurve, 10, 0.009, 5, false);
  head.add(new THREE.Mesh(smileGeometry, material("#6a3627")));
  ball(head, colors.hair, [0, 0.147, -0.044], [0.225, 0.148, 0.181]);
  const tail = new THREE.Group();
  head.add(tail);
  function curls(parent, count, size, seed = 0) {
    const mesh = new THREE.InstancedMesh(
      geometry.ball,
      material(colors.hair),
      count,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399 + seed;
      const radial = Math.sqrt((i + 0.5) / count) * 0.2;
      const x = Math.cos(angle) * radial,
        z = Math.sin(angle) * radial * 0.8;
      matrix.compose(
        new THREE.Vector3(
          x,
          0.19 + Math.sqrt(Math.max(0, 0.04 - radial * radial)) * 0.35,
          z - 0.025,
        ),
        new THREE.Quaternion(),
        new THREE.Vector3(size, size * 0.9, size),
      );
      mesh.setMatrixAt(i, matrix);
    }
    parent.add(mesh);
  }
  if (key === "blaze" || key === "shade" || key === "pulse")
    curls(head, key === "shade" ? 26 : 18, key === "shade" ? 0.061 : 0.066);
  if (key === "blaze" && female) {
    tail.position.set(0, 0.18, -0.16);
    for (let i = 0; i < 5; i++)
      ball(
        tail,
        colors.hair,
        [0, -i * 0.085, -0.05 - Math.sin(i * 0.4) * 0.08],
        [0.09 - i * 0.009, 0.085, 0.085],
      );
    ball(tail, colors.accent, [0, -0.025, -0.01], [0.095, 0.025, 0.07]);
  }
  if (key === "glitch") {
    if (female) {
      for (const side of [-1, 1])
        ball(
          head,
          colors.hair,
          [side * 0.184, -0.035, -0.02],
          [0.067, 0.215, 0.14],
        );
    } else {
      for (let i = 0; i < 5; i++) {
        const tuft = ball(
          head,
          colors.hair,
          [(i - 2) * 0.07, 0.225, 0],
          [0.07, 0.13, 0.07],
        );
        tuft.rotation.z = -0.5;
      }
    }
    const streak = box(
      head,
      colors.accent,
      [-0.085, 0.21, 0.14],
      [0.035, 0.18, 0.025],
    );
    streak.rotation.z = -0.42;
    box(head, "#263b3d", [0, 0.2, 0.163], [0.36, 0.105, 0.06]);
    box(head, "#73d6d7", [0, 0.2, 0.202], [0.29, 0.065, 0.015]);
  }
  if (key === "shade") {
    const hoodGeometry = new THREE.TorusGeometry(0.245, 0.046, 8, 20);
    const hood = new THREE.Mesh(hoodGeometry, material(colors.coat));
    hood.position.set(0, 0.015, -0.1);
    head.add(hood);
    if (female) {
      for (const side of [-1, 1])
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 9; i++)
            ball(
              tail,
              colors.hair,
              [side * (0.185 + j * 0.018), 0.08 - i * 0.075, -0.01 + j * 0.055],
              [0.023, 0.052, 0.026],
            );
    }
  }
  if (key === "pulse") {
    if (female)
      for (const side of [-1, 1])
        ball(
          head,
          colors.hair,
          [side * 0.18, 0.22, -0.04],
          [0.11, 0.11, 0.105],
        );
    for (const side of [-1, 1])
      ball(
        body,
        colors.accent,
        [side * 0.17, 0.61, 0.085],
        [0.075, 0.1, 0.055],
      );
    const phonesGeometry = new THREE.TorusGeometry(0.145, 0.026, 6, 18);
    const phones = new THREE.Mesh(phonesGeometry, material(colors.coat));
    phones.rotation.x = Math.PI / 2;
    phones.position.set(0, 0.64, 0);
    body.add(phones);
  }
  if (key === "rune") {
    tail.position.set(female ? 0.17 : 0, 0.12, -0.16);
    for (let i = 0; i < 12; i++)
      ball(
        tail,
        colors.hair,
        [Math.sin((i * Math.PI) / 2) * 0.019, -i * 0.065, -0.035],
        [0.043, 0.048, 0.042],
      );
    for (let i = 0; i < 3; i++) {
      const leaf = ball(
        body,
        colors.accent,
        [-0.13 + i * 0.02, 0.37 + i * 0.025, 0.204],
        [0.018, 0.043, 0.008],
      );
      leaf.rotation.z = -0.5;
    }
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, 1.015, 0);
    root.add(leg);
    legs.push(leg);
    pipe(leg, trousers, [0, 0, 0], [0, -0.43, 0], 0.115);
    ball(leg, trousers, [0, -0.43, 0], [0.105, 0.1, 0.105]);
    pipe(leg, trousers, [0, -0.43, 0], [0, -0.81, 0.012], 0.09);
    ball(leg, boots, [0, -0.895, 0.09], [0.125, 0.105, 0.215]);
    ball(leg, "#6b6c59", [0, -0.963, 0.095], [0.128, 0.026, 0.218]);
    for (let i = 0; i < 3; i++)
      box(
        leg,
        colors.accent,
        [0, -0.82 - i * 0.025, 0.17],
        [0.13, 0.012, 0.015],
      );
    box(leg, "#464b41", [side * 0.103, -0.24, 0.035], [0.045, 0.19, 0.14]);
  }

  function arm(side) {
    const group = new THREE.Group();
    body.add(group);
    const shoulder = new THREE.Vector3(side * 0.292, 0.49, 0);
    ball(group, colors.coat, shoulder.toArray(), [0.115, 0.115, 0.115]);
    const sleeve = shape(
      group,
      "cylinder",
      key === "rune" ? "#c2b493" : colors.coat,
      [0, 0, 0],
      [0.087, 1, 0.087],
    );
    const elbow = ball(group, colors.skin, [0, 0, 0], [0.077, 0.077, 0.077]);
    const forearm = shape(
      group,
      "cylinder",
      colors.skin,
      [0, 0, 0],
      [0.065, 1, 0.065],
    );
    const cuff = ball(group, colors.accent, [0, 0, 0], [0.072, 0.04, 0.072]);
    const hand = new THREE.Group();
    group.add(hand);
    ball(hand, colors.skin, [0, -0.055, 0], [0.065, 0.083, 0.033]);
    for (let i = 0; i < 4; i++) {
      const finger = ball(
        hand,
        colors.skin,
        [(i - 1.5) * 0.029, -0.145 + Math.abs(i - 1.5) * 0.012, 0],
        [0.014, 0.052, 0.014],
      );
      finger.rotation.z = (i - 1.5) * 0.055;
    }
    const thumb = ball(
      hand,
      colors.skin,
      [side * 0.064, -0.055, 0.004],
      [0.02, 0.052, 0.02],
    );
    thumb.rotation.z = side * 0.65;
    return {
      side,
      shoulder,
      sleeve,
      elbow,
      forearm,
      cuff,
      hand,
      target: new THREE.Vector3(),
      pole: new THREE.Vector3(),
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
    colors,
    key,
    variant,
    yaw: 0,
    phase: 0,
    waveAt: -Infinity,
    gesture: "idle",
  };
  poseExplorer(rig, 0);
  return rig;
}

function setSegment(mesh, from, to, radius) {
  const direction = new THREE.Vector3().subVectors(to, from);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(Y, direction.clone().normalize());
  mesh.scale.set(radius, direction.length(), radius);
}

function solveArm(arm, target, pole) {
  const direction = target.clone().sub(arm.shoulder);
  const distance = THREE.MathUtils.clamp(direction.length(), 0.05, 0.699);
  direction.normalize();
  const perpendicular = pole.clone().sub(arm.shoulder);
  perpendicular
    .addScaledVector(direction, -perpendicular.dot(direction))
    .normalize();
  const along =
    (0.37 * 0.37 - 0.34 * 0.34 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, 0.37 * 0.37 - along * along));
  const elbow = arm.shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(perpendicular, height);
  const wrist = arm.shoulder.clone().addScaledVector(direction, distance);
  setSegment(arm.sleeve, arm.shoulder, elbow, 0.087);
  setSegment(arm.forearm, elbow, wrist, 0.065);
  arm.elbow.position.copy(elbow);
  arm.hand.position.copy(wrist);
  arm.cuff.position.copy(wrist);
  arm.hand.quaternion.setFromUnitVectors(
    DOWN,
    wrist.clone().sub(elbow).normalize(),
  );
}

export function poseExplorer(rig, time) {
  const t = time + rig.phase;
  const cycle = ((t % 25) + 25) % 25;
  const sinceWave = time - rig.waveAt;
  let gesture = "idle",
    progress = 0,
    weight = 0;
  if (sinceWave >= 0 && sinceWave < 2.8) {
    gesture = "wave";
    progress = sinceWave / 2.8;
    weight = smooth(sinceWave / 0.4) * smooth((2.8 - sinceWave) / 0.5);
  } else if (cycle >= 5 && cycle < 10) {
    gesture = "outfit";
    progress = (cycle - 5) / 5;
    weight = Math.sin(Math.PI * progress);
  } else if (cycle >= 11 && cycle < 16) {
    gesture = "hair";
    progress = (cycle - 11) / 5;
    weight = Math.sin(Math.PI * progress);
  } else if (cycle >= 17 && cycle < 21) {
    gesture = "stretch";
    progress = (cycle - 17) / 4;
    weight = Math.sin(Math.PI * progress);
  } else if (cycle >= 21) {
    gesture = "look";
    progress = (cycle - 21) / 4;
    weight = Math.sin(Math.PI * progress);
  }
  rig.gesture = gesture;
  rig.root.rotation.y =
    rig.yaw +
    Math.sin(t * 0.43) * 0.12 +
    (gesture === "look" ? Math.sin(progress * Math.PI * 2) * 0.65 * weight : 0);
  rig.body.position.x = Math.sin(t * 0.75) * 0.018;
  rig.body.rotation.set(
    gesture === "outfit" ? 0.13 * weight : 0.012 * Math.sin(t * 1.7),
    0,
    Math.sin(t * 0.8) * 0.015,
  );
  rig.torso.scale.y = 0.34 * (1 + 0.012 * Math.sin(t * 2));
  rig.head.rotation.set(
    gesture === "outfit" ? 0.32 * weight : 0.04 * Math.sin(t * 0.85),
    Math.sin(t * 0.51) * 0.24,
    gesture === "hair" ? -0.1 * weight : 0.025 * Math.sin(t),
  );
  rig.tail.rotation.set(
    0.035 * Math.sin(t * 1.4),
    0,
    0.045 * Math.sin(t * 1.2),
  );
  const blink = Math.cos(t * 1.31) > 0.992 ? 0.14 : 1;
  rig.eyes.forEach((eye) => {
    eye.scale.y = blink;
  });
  for (const arm of rig.arms) {
    const side = arm.side;
    const target = arm.target.set(
      side * 0.35,
      -0.17,
      0.04 + Math.sin(t * 1.2 + side) * 0.07,
    );
    arm.pole.set(side * 0.65, 0.12, 0.3);
    let actionTarget = null;
    if (gesture === "outfit")
      actionTarget = new THREE.Vector3(
        side * 0.14,
        0.24 + Math.sin(t * 5) * 0.015,
        0.29,
      );
    if (gesture === "hair" && side === -1) {
      actionTarget = new THREE.Vector3(
        -0.18,
        0.89 + Math.sin(t * 7) * 0.02,
        0.13,
      );
      arm.pole.set(-0.65, 0.65, 0.32);
    }
    if (gesture === "stretch") {
      actionTarget = new THREE.Vector3(side * 0.63, 0.86, 0.03);
      arm.pole.set(side * 0.9, 0.6, 0.3);
    }
    if (gesture === "wave" && side === -1) {
      actionTarget = new THREE.Vector3(-0.43, 0.94, 0.24);
      arm.pole.set(-0.75, 0.65, 0.36);
    }
    if (actionTarget) target.lerp(actionTarget, weight);
    solveArm(arm, target, arm.pole);
    if (gesture === "wave" && side === -1)
      arm.hand.rotateZ(Math.sin(sinceWave * 12) * 0.45 * weight);
    if (gesture === "hair" && side === -1)
      arm.hand.rotateZ(Math.sin(t * 7) * 0.12 * weight);
  }
  return gesture;
}

export function disposeExplorer(rig) {
  const geometries = new Set(),
    materials = new Set();
  rig.root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
    if (object.isInstancedMesh) object.dispose();
  });
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
}

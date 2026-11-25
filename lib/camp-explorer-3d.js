import * as THREE from "three";
import { sculptAvatar, poseSculpt } from "./avatar-sculpt.js";
import { defaultAvatar } from "./avatar.js";

const Y = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (value) => {
  const n = Math.max(0, Math.min(1, value));
  return n * n * (3 - 2 * n);
};

export function createExplorer(key, variant="male", appearance) {
  return sculptAvatar(appearance || defaultAvatar(variant), { detail: false });
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
  if (rig.sculpted) return poseSculpt(rig, time);
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

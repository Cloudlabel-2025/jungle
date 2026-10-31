import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Vector3 } from "three";
import {
  createExplorer,
  disposeExplorer,
  poseExplorer,
} from "../lib/camp-explorer-3d.js";

test("all ten explorers are dimensional models with articulated arms and distinct variants", () => {
  for (const key of ["blaze", "glitch", "shade", "pulse", "rune"])
    for (const variant of ["male", "female"]) {
      const rig = createExplorer(key, variant);
      const size = new Box3().setFromObject(rig.root).getSize(new Vector3());
      assert.ok(
        size.x > 0.4 && size.y > 2 && size.z > 0.3,
        `${key}-${variant} has volume`,
      );
      assert.equal(rig.root.name, `${key}-${variant}`);
      assert.equal(rig.arms.length, 2);
      assert.ok(rig.arms.every((arm) => arm.hand.children.length >= 5));
      assert.equal(
        rig.root.children.some((child) => child.isSprite),
        false,
      );
      disposeExplorer(rig);
    }
});

test("idle gestures continuously reposition joints instead of swapping images", () => {
  const rig = createExplorer("blaze", "male");
  poseExplorer(rig, 0);
  const rest = rig.arms[0].hand.position.clone();
  assert.equal(poseExplorer(rig, 7.5), "outfit");
  assert.ok(rig.arms[0].hand.position.distanceTo(rest) > 0.3);
  assert.ok(rig.head.rotation.x > 0.2);
  assert.equal(poseExplorer(rig, 13.5), "hair");
  assert.ok(rig.arms[0].hand.position.y > 0.7);
  assert.equal(poseExplorer(rig, 19), "stretch");
  assert.ok(rig.arms.every((arm) => arm.hand.position.y > 0.6));
  const atA = rig.arms[0].hand.position.clone();
  poseExplorer(rig, 19.1);
  assert.ok(rig.arms[0].hand.position.distanceTo(atA) > 0);
  disposeExplorer(rig);
});

test("greeting overrides the idle pose then returns to the independent idle cycle", () => {
  const rig = createExplorer("shade", "female");
  rig.waveAt = 10;
  assert.equal(poseExplorer(rig, 11), "wave");
  const rotation = rig.arms[0].hand.quaternion.clone();
  poseExplorer(rig, 11.1);
  assert.ok(rotation.angleTo(rig.arms[0].hand.quaternion) > 0.01);
  assert.notEqual(poseExplorer(rig, 13), "wave");
  rig.yaw = Math.PI * 2;
  poseExplorer(rig, 0);
  assert.ok(Math.abs(rig.root.rotation.y - Math.PI * 2) < 0.2);
  disposeExplorer(rig);
});

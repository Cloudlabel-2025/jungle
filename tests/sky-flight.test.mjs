import test from "node:test";
import assert from "node:assert/strict";
import { createSkyFlight } from "../lib/sky-flight.js";
function fixture() {
  let id = 0;
  const frames = new Map(),
    positions = [],
    arrivals = [],
    cancellations = [];
  let available = true;
  const controller = createSkyFlight({
    requestFrame: (cb) => {
      frames.set(++id, cb);
      return id;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  const options = {
    from: { x: 10, y: 50 },
    to: { x: 590, y: 80 },
    duration: 1000,
    isAvailable: () => available,
    onFrame: (p) => positions.push(p),
    onArrive: () => arrivals.push(true),
    onCancel: (reason) => cancellations.push(reason),
  };
  const tick = (time) => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((cb) => cb(time));
  };
  return {
    controller,
    options,
    tick,
    positions,
    arrivals,
    cancellations,
    frames,
    setAvailable: (value) => {
      available = value;
    },
  };
}
test("flight moves before arrival and repeated clicks cannot start another trip", () => {
  const f = fixture();
  assert.equal(f.controller.start(f.options), true);
  assert.equal(f.controller.start(f.options), false);
  f.tick(100);
  f.tick(600);
  assert.equal(f.arrivals.length, 0);
  assert.ok(f.positions.at(-1).x > 10 && f.positions.at(-1).x < 590);
  assert.ok(f.positions.at(-1).y < 65); // Curved flight above the direct line.
  f.tick(1100);
  f.tick(2000);
  assert.deepEqual(f.positions.at(-1), { x: 590, y: 80 });
  assert.equal(f.arrivals.length, 1);
});
test("locked targets never depart and revocation during travel prevents mission opening", () => {
  const f = fixture();
  f.setAvailable(false);
  assert.equal(f.controller.start(f.options), false);
  assert.equal(f.frames.size, 0);
  f.setAvailable(true);
  f.controller.start(f.options);
  f.tick(0);
  f.tick(500);
  f.setAvailable(false);
  f.tick(1000);
  assert.equal(f.arrivals.length, 0);
  assert.deepEqual(f.cancellations, ["locked"]);
});
test("eligibility is rechecked immediately before opening at arrival", () => {
  const f = fixture();
  f.options.onFrame = (point) => {
    if (point.x === 590) f.setAvailable(false);
  };
  f.controller.start(f.options);
  f.tick(0);
  f.tick(1000);
  assert.equal(f.arrivals.length, 0);
  assert.deepEqual(f.cancellations, ["locked"]);
});
test("cancel/unmount clears animation and never opens a delayed mission; retry is possible", () => {
  const f = fixture();
  f.controller.start(f.options);
  f.tick(0);
  f.controller.cancel();
  f.controller.cancel();
  f.tick(1000);
  assert.equal(f.frames.size, 0);
  assert.equal(f.arrivals.length, 0);
  assert.deepEqual(f.cancellations, ["cancelled"]);
  assert.equal(f.controller.start(f.options), true);
  f.tick(2000);
  f.tick(3000);
  assert.equal(f.arrivals.length, 1);
});
test("reduced motion keeps a static departure state, then places the aircraft before opening", () => {
  const f = fixture();
  f.controller.start({ ...f.options, reducedMotion: true, duration: 180 });
  f.tick(0);
  f.tick(90);
  assert.deepEqual(f.positions.at(-1), f.options.from);
  assert.equal(f.arrivals.length, 0);
  f.tick(180);
  assert.deepEqual(f.positions.at(-1), f.options.to);
  assert.equal(f.arrivals.length, 1);
});

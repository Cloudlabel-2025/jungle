import test from "node:test";
import assert from "node:assert/strict";
import { findPipTarget, pipPointerPosition } from "../lib/pip-pointer.js";

test("pointer stays within desktop and landscape viewports and points toward its control", () => {
  const desktop = pipPointerPosition(
    { left: 300, right: 420, top: 300, bottom: 350 },
    { width: 1440, height: 900 },
  );
  assert.equal(desktop.direction, "down");
  assert.equal(desktop.top + 66 + 8, 300);
  const compact = pipPointerPosition(
    { left: 300, right: 420, top: 300, bottom: 350 },
    { width: 1440, height: 900 },
    false,
  );
  assert.equal(compact.top + 40 + 8, 300);
  const mobile = pipPointerPosition(
    { left: 2, right: 40, top: 10, bottom: 48 },
    { width: 667, height: 320 },
  );
  assert.equal(mobile.direction, "up");
  assert.equal(mobile.left, 8);
  assert.equal(mobile.top, 56);
  assert.equal(
    pipPointerPosition(
      { left: 200, right: 250, top: 400, bottom: 450 },
      { width: 667, height: 320 },
    ),
    null,
  );
});

test("world and question pointers move to confirmation only after it is enabled", () => {
  const choice = {
    getClientRects: () => [{}],
    closest: () => null,
    matches: () => false,
  };
  const confirm = { ...choice };
  let enabled = false;
  const document = {
    querySelectorAll: (selector) =>
      selector.includes("confirm") ? (enabled ? [confirm] : []) : [choice],
  };
  for (const target of ["genres", "questions"]) {
    enabled = false;
    assert.equal(findPipTarget(document, { target }), choice);
    enabled = true;
    assert.equal(findPipTarget(document, { target }), confirm);
  }
});

test("hidden and disabled controls never receive the pointer", () => {
  const hidden = {
    getClientRects: () => [],
    closest: () => null,
    matches: () => false,
  };
  const disabled = {
    getClientRects: () => [{}],
    closest: () => null,
    matches: () => true,
  };
  const document = { querySelectorAll: () => [hidden, disabled] };
  assert.equal(findPipTarget(document, { target: "accept" }), null);
});
test("transmission guidance waits until the chat link passes form validation", () => {
  let invalid = true;
  const target = {
    getClientRects: () => [{}],
    closest: () => null,
    matches: () => false,
    form: { querySelector: () => (invalid ? {} : null) },
  };
  const document = { querySelectorAll: () => [target] };
  assert.equal(findPipTarget(document, { target: "transmit" }), null);
  invalid = false;
  assert.equal(findPipTarget(document, { target: "transmit" }), target);
});
test("Level 1 guidance targets its Play button, never its station shortcut", () => {
  let selector;
  const button = {
    getClientRects: () => [{}],
    closest: () => null,
    matches: () => false,
  };
  const document = {
    querySelectorAll: (value) => {
      selector = value;
      return [button];
    },
  };
  assert.equal(
    findPipTarget(document, { target: "level-one-play", action: "mission" }),
    button,
  );
  assert.equal(selector, '[data-pip-target="level-one-play"]');
});

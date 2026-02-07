const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, getEventVariant } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);
  assert.equal(isTextInputTarget(null), false);
});

test("getEventVariant: default drift", () => {
  assert.deepEqual(getEventVariant("DRIFT_START"), {
    eventType: "DRIFT_START",
    label: "DRIFT",
    patternBreak: false,
  });
});

test("getEventVariant: drift persist pattern-break", () => {
  assert.deepEqual(getEventVariant("DRIFT_PERSIST"), {
    eventType: "DRIFT_PERSIST",
    label: "DRIFT — AGAIN",
    patternBreak: true,
  });
});

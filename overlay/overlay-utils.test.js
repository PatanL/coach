const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveControlTarget,
  shouldHandleGlobalEnter,
  getEventVariant,
} = require("./overlay-utils");

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

test("isInteractiveControlTarget: recognizes buttons, links, and role=button", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveControlTarget({ tagName: "a" }), true);
  assert.equal(
    isInteractiveControlTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "button" : null),
    }),
    true
  );
});

test("shouldHandleGlobalEnter: false when typing or on interactive control", () => {
  assert.equal(shouldHandleGlobalEnter({ tagName: "INPUT" }), false);
  assert.equal(shouldHandleGlobalEnter({ tagName: "BUTTON" }), false);
  assert.equal(shouldHandleGlobalEnter({ tagName: "DIV" }), true);
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

const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveTarget, getEnterAction } = require("./overlay-utils");

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

test("isInteractiveTarget: recognizes controls with their own Enter semantics", () => {
  assert.equal(isInteractiveTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveTarget({ tagName: "a" }), true);
  assert.equal(isInteractiveTarget({ tagName: "INPUT" }), true);
  assert.equal(isInteractiveTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveTarget(null), false);
});

test("getEnterAction: defaults to back_on_track", () => {
  assert.equal(getEnterAction({ eventType: "DRIFT_START", mode: "" }), "back_on_track");
  assert.equal(getEnterAction({ eventType: null, mode: null }), "back_on_track");
});

test("getEnterAction: DRIFT_PERSIST maps Enter to recover", () => {
  assert.equal(getEnterAction({ eventType: "DRIFT_PERSIST" }), "recover");
});

test("getEnterAction: align mode disables global Enter action", () => {
  assert.equal(getEnterAction({ eventType: "DRIFT_PERSIST", mode: "align" }), null);
  assert.equal(getEnterAction({ eventType: "DRIFT_START", mode: "align" }), null);
});

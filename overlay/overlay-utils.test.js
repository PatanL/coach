const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveTarget, shouldIgnoreGlobalHotkeys } = require("./overlay-utils");

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

test("isInteractiveTarget: recognizes controls where Enter/Space should not trigger global hotkeys", () => {
  assert.equal(isInteractiveTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveTarget({ tagName: "a" }), true);
  assert.equal(isInteractiveTarget({ tagName: "INPUT", type: "checkbox" }), true);
  assert.equal(isInteractiveTarget({ tagName: "INPUT", type: "submit" }), true);
});

test("isInteractiveTarget: ignores plain non-control nodes", () => {
  assert.equal(isInteractiveTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveTarget(null), false);
});

test("shouldIgnoreGlobalHotkeys: respects defaultPrevented + typing + interactive", () => {
  assert.equal(shouldIgnoreGlobalHotkeys({ defaultPrevented: true }), true);
  assert.equal(shouldIgnoreGlobalHotkeys({ defaultPrevented: false, target: { tagName: "TEXTAREA" } }), true);
  assert.equal(shouldIgnoreGlobalHotkeys({ defaultPrevented: false, target: { tagName: "BUTTON" } }), true);
  assert.equal(shouldIgnoreGlobalHotkeys({ defaultPrevented: false, target: { tagName: "DIV" } }), false);
});

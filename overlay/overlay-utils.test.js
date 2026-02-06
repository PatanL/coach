const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveTarget } = require("./overlay-utils");

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

test("isInteractiveTarget: recognizes common interactive targets", () => {
  assert.equal(isInteractiveTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveTarget({ tagName: "A" }), true);
  assert.equal(isInteractiveTarget({ tagName: "INPUT" }), true);
  assert.equal(
    isInteractiveTarget({ tagName: "DIV", getAttribute: (k) => (k === "role" ? "button" : "") }),
    true
  );
});

test("isInteractiveTarget: ignores non-interactive targets", () => {
  assert.equal(isInteractiveTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveTarget(null), false);
});

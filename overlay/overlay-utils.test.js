const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, shouldHandleGlobalHotkey } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  // Rich-editor style widgets.
  assert.equal(isTextInputTarget({ tagName: "DIV", role: "textbox" }), true);
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "textbox" : null)
    }),
    true
  );
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);
  assert.equal(isTextInputTarget(null), false);
});

test("shouldHandleGlobalHotkey: returns false while typing", () => {
  assert.equal(shouldHandleGlobalHotkey({ tagName: "INPUT" }), false);
  assert.equal(shouldHandleGlobalHotkey({ tagName: "DIV", isContentEditable: true }), false);
  assert.equal(shouldHandleGlobalHotkey({ target: { tagName: "textarea" } }), false);
});

test("shouldHandleGlobalHotkey: returns true for non-typing targets", () => {
  assert.equal(shouldHandleGlobalHotkey({ tagName: "DIV" }), true);
  assert.equal(shouldHandleGlobalHotkey({ target: { tagName: "BUTTON" } }), true);
  assert.equal(shouldHandleGlobalHotkey(null), true);
});

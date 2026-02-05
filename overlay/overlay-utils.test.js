const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  assert.equal(
    isTextInputTarget({
      tagName: "SPAN",
      closest: (selector) => (selector.includes("contenteditable") ? { tagName: "DIV" } : null)
    }),
    true
  );

  assert.equal(isTextInputTarget({ tagName: "DIV", getAttribute: (key) => (key === "role" ? "textbox" : null) }), true);
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);
  assert.equal(isTextInputTarget(null), false);
});

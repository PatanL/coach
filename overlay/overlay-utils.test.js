const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveControlTarget } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  // Nested target inside a contenteditable ancestor.
  assert.equal(
    isTextInputTarget({
      tagName: "SPAN",
      closest: (selector) => (selector.includes("contenteditable") ? { tagName: "DIV" } : null)
    }),
    true
  );

  // Nested target inside a role=textbox ancestor.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      closest: (selector) => (selector.includes('role="textbox"') ? { tagName: "DIV" } : null)
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

test("isInteractiveControlTarget: recognizes buttons + links (including nested targets)", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveControlTarget({ tagName: "a" }), true);
  assert.equal(
    isInteractiveControlTarget({
      tagName: "SPAN",
      closest: (selector) => (selector.includes("button") ? { tagName: "BUTTON" } : null)
    }),
    true
  );
});

test("isInteractiveControlTarget: ignores plain elements", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveControlTarget(null), false);
});

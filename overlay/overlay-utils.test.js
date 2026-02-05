const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isTypingContext } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  // ARIA-role based text entry.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "textbox" : null)
    }),
    true
  );

  // contenteditable attribute (string) should also be treated as typing.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "contenteditable" ? "true" : null)
    }),
    true
  );
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);
  assert.equal(isTextInputTarget(null), false);
});

test("isTypingContext: prefers activeElement over eventTarget", () => {
  assert.equal(
    isTypingContext({
      eventTarget: { tagName: "DIV" },
      activeElement: { tagName: "INPUT" }
    }),
    true
  );
});

test("isTypingContext: falls back to eventTarget when no activeElement", () => {
  assert.equal(isTypingContext({ eventTarget: { tagName: "TEXTAREA" } }), true);
  assert.equal(isTypingContext({ eventTarget: { tagName: "DIV" } }), false);
});

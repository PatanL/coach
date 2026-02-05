const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveControlTarget,
  isTypingContext,
  isHotkeySafeContext,
  labelForEventType
} = require("./overlay-utils");

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

test("isInteractiveControlTarget: recognizes common controls", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "button" }), true);
  assert.equal(isInteractiveControlTarget({ tagName: "A" }), true);
  assert.equal(
    isInteractiveControlTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "button" : null)
    }),
    true
  );
});

test("isInteractiveControlTarget: ignores non-controls", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "INPUT" }), false);
  assert.equal(isInteractiveControlTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveControlTarget(null), false);
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

test("isHotkeySafeContext: false when typing or focused on a control", () => {
  assert.equal(isHotkeySafeContext({ activeElement: { tagName: "INPUT" } }), false);
  assert.equal(isHotkeySafeContext({ activeElement: { tagName: "BUTTON" } }), false);
  assert.equal(isHotkeySafeContext({ eventTarget: { tagName: "A" } }), false);
});

test("isHotkeySafeContext: true for generic non-typing targets", () => {
  assert.equal(isHotkeySafeContext({ activeElement: { tagName: "DIV" } }), true);
});

test("labelForEventType: formats event types for the overlay label", () => {
  assert.equal(labelForEventType("DRIFT_PERSIST"), "DRIFT PERSISTS");
  assert.equal(labelForEventType("drift_start"), "DRIFT");
  assert.equal(labelForEventType("RECOVER_SCHEDULE"), "RECOVER SCHEDULE");
  assert.equal(labelForEventType(""), "DRIFT");
  assert.equal(labelForEventType(null), "DRIFT");
});

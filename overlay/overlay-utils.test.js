const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isControlTarget, shouldTriggerBackOnTrackFromKeydown } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "textbox" : null)
    }),
    true
  );

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

test("isControlTarget: recognizes common non-typing controls", () => {
  assert.equal(isControlTarget({ tagName: "BUTTON" }), true);
  assert.equal(isControlTarget({ tagName: "A" }), true);

  assert.equal(
    isControlTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "button" : null)
    }),
    true
  );

  assert.equal(
    isControlTarget({
      tagName: "INPUT",
      getAttribute: (name) => (name === "type" ? "submit" : null)
    }),
    true
  );
});

test("shouldTriggerBackOnTrackFromKeydown: triggers only when safe", () => {
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false }, null),
    true
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Escape", isComposing: false }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", defaultPrevented: true, isComposing: false }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: true }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, metaKey: true }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, shiftKey: true }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "BUTTON" } }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnKeydownTypingTarget({ tagName: "INPUT" }),
    false
  );
});

function shouldTriggerBackOnKeydownTypingTarget(activeEl) {
  return shouldTriggerBackOnTrackFromKeydown(
    { key: "Enter", isComposing: false, target: { tagName: "DIV" } },
    activeEl
  );
}

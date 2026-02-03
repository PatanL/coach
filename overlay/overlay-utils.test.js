const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isControlTarget,
  shouldTriggerBackOnTrackFromKeydown,
  shouldTriggerBackOnTrack,
  shouldTriggerSnoozeFromKeydown,
  shouldTriggerSnooze
} = require("./overlay-utils");

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

  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "contenteditable" ? "" : null)
    }),
    true
  );
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);

  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "contenteditable" ? "false" : null)
    }),
    false
  );

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
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "link" : null)
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

  assert.equal(
    isControlTarget({
      tagName: "INPUT",
      getAttribute: (name) => (name === "type" ? "checkbox" : null)
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
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, repeat: true }, null),
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

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown(
      { key: "Enter", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "BUTTON" }
    ),
    false
  );
});

test("shouldTriggerBackOnTrack: requires a short dwell after show", () => {
  const event = { key: "Enter", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerBackOnTrack(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerBackOnTrack(event, null, 1000, 2000), true);

  // If we don't know shownAt, fall back to the keydown-only safety checks.
  assert.equal(shouldTriggerBackOnTrack(event, null, null, 1200), true);
});

test("shouldTriggerSnoozeFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false }, null), true);

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Enter", isComposing: false }, null), false);

  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", defaultPrevented: true, isComposing: false }, null),
    false
  );

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: true }, null), false);

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, metaKey: true }, null), false);

  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  assert.equal(
    shouldTriggerSnoozeFromKeydown(
      { key: "Escape", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "TEXTAREA" }
    ),
    false
  );

  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, target: { tagName: "BUTTON" } }, null),
    false
  );
});

test("shouldTriggerSnooze: requires a short dwell after show", () => {
  const event = { key: "Escape", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerSnooze(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerSnooze(event, null, 1000, 2000), true);

  // If we don't know shownAt, fall back to the keydown-only safety checks.
  assert.equal(shouldTriggerSnooze(event, null, null, 1200), true);
});

function shouldTriggerBackOnKeydownTypingTarget(activeEl) {
  return shouldTriggerBackOnTrackFromKeydown(
    { key: "Enter", isComposing: false, target: { tagName: "DIV" } },
    activeEl
  );
}

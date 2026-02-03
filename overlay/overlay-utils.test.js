const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isControlTarget,
  shouldTriggerBackOnTrackFromKeydown,
  shouldTriggerBackOnTrack,
  shouldTriggerSnoozeFromKeydown,
  shouldTriggerSnooze,
  getHotkeyHints,
  choiceIndexFromKey,
  shouldTriggerChoiceFromKeydown
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

  // If Enter is on a control element, don't double-trigger.
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "BUTTON" } }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "A" } }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown(
      {
        key: "Enter",
        isComposing: false,
        target: { tagName: "DIV", getAttribute: (n) => (n === "role" ? "button" : null) }
      },
      null
    ),
    false
  );

  // If Enter is being pressed while typing, never treat it as "Back on track".
  assert.equal(shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "INPUT" } }, null), false);
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "TEXTAREA" } }, null),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "SELECT" } }, null),
    false
  );

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown(
      {
        key: "Enter",
        isComposing: false,
        target: { tagName: "DIV", getAttribute: (n) => (n === "role" ? "textbox" : null) }
      },
      null
    ),
    false
  );

  // Same logic when focus is elsewhere (activeElement).
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "DIV" } }, { tagName: "INPUT" }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown(
      { key: "Enter", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "DIV", getAttribute: (n) => (n === "contenteditable" ? "true" : null) }
    ),
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

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, repeat: true }, null), false);

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

test("getHotkeyHints: switches hints based on mode/focus", () => {
  assert.deepEqual(getHotkeyHints({ mode: "", activeElement: null, snoozeOpen: false }), {
    enterHint: "Enter: Back on track",
    quickHint: null,
    escHint: "Esc: Snooze"
  });

  // In align mode we auto-focus an input; while typing, numeric hotkeys are disabled.
  assert.deepEqual(getHotkeyHints({ mode: "align", activeElement: { tagName: "INPUT" }, snoozeOpen: false }), {
    enterHint: "Enter: Submit",
    quickHint: null,
    escHint: "Esc: Snooze"
  });

  // If focus isn't on a typing target, show numeric hotkey hint.
  assert.deepEqual(getHotkeyHints({ mode: "align", activeElement: { tagName: "DIV" }, snoozeOpen: false }), {
    enterHint: "Enter: Submit",
    quickHint: "1-9: Choose",
    escHint: "Esc: Snooze"
  });

  assert.deepEqual(getHotkeyHints({ mode: "", activeElement: { tagName: "INPUT" }, snoozeOpen: false }), {
    enterHint: "Enter: Submit",
    quickHint: null,
    escHint: "Esc: Snooze"
  });

  // Snooze open overrides Esc hint and hides quick hint.
  assert.deepEqual(getHotkeyHints({ mode: "align", activeElement: { tagName: "DIV" }, snoozeOpen: true }), {
    enterHint: "Enter: Submit",
    quickHint: null,
    escHint: "Esc: Close snooze"
  });

  assert.deepEqual(getHotkeyHints({ mode: "", activeElement: null, snoozeOpen: true }), {
    enterHint: "Enter: Back on track",
    quickHint: null,
    escHint: "Esc: Close snooze"
  });
});

function shouldTriggerBackOnKeydownTypingTarget(activeEl) {
  return shouldTriggerBackOnTrackFromKeydown(
    { key: "Enter", isComposing: false, target: { tagName: "DIV" } },
    activeEl
  );
}

test("shouldTriggerChoiceFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerChoiceFromKeydown({ key: "1", isComposing: false }, null), true);

  assert.equal(shouldTriggerChoiceFromKeydown({ key: "0", isComposing: false }, null), false);

  assert.equal(
    shouldTriggerChoiceFromKeydown({ key: "2", defaultPrevented: true, isComposing: false }, null),
    false
  );

  assert.equal(shouldTriggerChoiceFromKeydown({ key: "3", isComposing: true }, null), false);

  assert.equal(shouldTriggerChoiceFromKeydown({ key: "4", isComposing: false, repeat: true }, null), false);

  assert.equal(shouldTriggerChoiceFromKeydown({ key: "5", isComposing: false, ctrlKey: true }, null), false);

  assert.equal(
    shouldTriggerChoiceFromKeydown({ key: "6", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "7", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "TEXTAREA" }
    ),
    false
  );

  // ContentEditable / ARIA textbox should also be treated as typing targets.
  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "8", isComposing: false, target: { tagName: "DIV", isContentEditable: true } },
      null
    ),
    false
  );

  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "8", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "DIV", getAttribute: (n) => (n === "role" ? "textbox" : null) }
    ),
    false
  );

  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "8", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "DIV", getAttribute: (n) => (n === "contenteditable" ? "" : null) }
    ),
    false
  );

  // When a non-typing control is focused (e.g., Back on track button), still allow
  // quick number-based choice selection.
  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "8", isComposing: false, target: { tagName: "DIV" } },
      { tagName: "BUTTON" }
    ),
    true
  );

  // Even if the keydown target is a button, number keys don't have a meaningful
  // default action, so allow choice selection.
  assert.equal(
    shouldTriggerChoiceFromKeydown({ key: "8", isComposing: false, target: { tagName: "BUTTON" } }, null),
    true
  );

  assert.equal(
    shouldTriggerChoiceFromKeydown(
      { key: "8", isComposing: false, target: { tagName: "DIV", getAttribute: (n) => (n === "role" ? "button" : null) } },
      null
    ),
    true
  );
});

test("choiceIndexFromKey: maps 1-9 to zero-based indices", () => {
  assert.equal(choiceIndexFromKey("1"), 0);
  assert.equal(choiceIndexFromKey("2"), 1);
  assert.equal(choiceIndexFromKey("9"), 8);
});

test("choiceIndexFromKey: returns null for non-choice keys", () => {
  assert.equal(choiceIndexFromKey("0"), null);
  assert.equal(choiceIndexFromKey("a"), null);
  assert.equal(choiceIndexFromKey("Enter"), null);
  assert.equal(choiceIndexFromKey(null), null);
});

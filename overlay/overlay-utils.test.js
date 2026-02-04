const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isControlTarget,
  shouldTriggerBackOnTrackFromKeydown,
  shouldTriggerBackOnTrack,
  shouldTriggerSnoozeFromKeydown,
  shouldTriggerSnooze,
  shouldTriggerDetailsToggleFromKeydown,
  shouldTriggerDetailsToggle,
  getHotkeyHints,
  choiceIndexFromKey,
  shouldTriggerChoiceFromKeydown,
  shouldTriggerChoice,
  shouldTriggerAlignSubmitFromKeydown,
  shouldTriggerBackOnTrackInMode
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

  // Role check should be case-insensitive.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "role" ? "TextBox" : null)
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

  // contenteditable without a value still means editable.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "contenteditable" ? "" : null)
    }),
    true
  );

  // contenteditable supports non-boolean values like plaintext-only.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      getAttribute: (name) => (name === "contenteditable" ? "plaintext-only" : null)
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

test("isControlTarget: recognizes common control targets", () => {
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

  assert.equal(isControlTarget({ tagName: "DIV" }), false);
});

test("shouldTriggerBackOnTrackFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false }, null), true);

  assert.equal(shouldTriggerBackOnTrackFromKeydown({ key: "Escape", isComposing: false }, null), false);

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", defaultPrevented: true, isComposing: false }, null),
    false
  );

  assert.equal(shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: true }, null), false);

  assert.equal(shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, repeat: true }, null), false);

  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, metaKey: true }, null),
    false
  );

  // If Enter is on a control element, don't double-trigger.
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "BUTTON" } }, null),
    false
  );

  // If Enter is being pressed while typing, never treat it as "Back on track".
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  // Same logic when focus is elsewhere (activeElement).
  assert.equal(
    shouldTriggerBackOnTrackFromKeydown({ key: "Enter", isComposing: false, target: { tagName: "DIV" } }, { tagName: "INPUT" }),
    false
  );
});

test("shouldTriggerBackOnTrack: requires a short dwell after show", () => {
  const event = { key: "Enter", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerBackOnTrack(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerBackOnTrack(event, null, 1000, 2000), true);
});

test("shouldTriggerBackOnTrackInMode: never triggers in align mode", () => {
  const event = { key: "Enter", isComposing: false, target: { tagName: "DIV" } };

  assert.equal(shouldTriggerBackOnTrackInMode("align", event, null, 1000, 2000), false);

  // Outside align mode, it delegates to the normal safety + dwell logic.
  assert.equal(shouldTriggerBackOnTrackInMode("", event, null, 1000, 2000), true);
});

test("shouldTriggerSnoozeFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false }, null), true);

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Enter", isComposing: false }, null), false);

  // Don't hijack modified Escape.
  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, shiftKey: true }, null), false);

  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", defaultPrevented: true, isComposing: false }, null),
    false
  );

  assert.equal(shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: true }, null), false);

  // Don't hijack Escape while typing.
  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  // Don't double-trigger on controls.
  assert.equal(
    shouldTriggerSnoozeFromKeydown({ key: "Escape", isComposing: false, target: { tagName: "BUTTON" } }, null),
    false
  );
});

test("shouldTriggerDetailsToggleFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false }, null), true);

  // Allow Shift+/ (event.key='?' with shiftKey true).
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, shiftKey: true }, null), true);

  // Only '?'.
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "/", isComposing: false }, null), false);

  // Never while typing.
  assert.equal(
    shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  // Avoid repeat and modifier combos.
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, repeat: true }, null), false);
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, metaKey: true }, null), false);
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, ctrlKey: true }, null), false);
  assert.equal(shouldTriggerDetailsToggleFromKeydown({ key: "?", isComposing: false, altKey: true }, null), false);
});

test("shouldTriggerDetailsToggle: requires a short dwell after show", () => {
  const event = { key: "?", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerDetailsToggle(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerDetailsToggle(event, null, 1000, 2000), true);
});

test("shouldTriggerSnooze: requires a short dwell after show", () => {
  const event = { key: "Escape", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerSnooze(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerSnooze(event, null, 1000, 2000), true);
});

test("getHotkeyHints: switches hints based on mode/focus", () => {
  assert.deepEqual(getHotkeyHints({ mode: "", activeElement: null, snoozeOpen: false }), {
    enterHint: "Enter: Back on track",
    quickHint: null,
    detailsHint: null,
    escHint: "Esc: Snooze"
  });

  assert.deepEqual(getHotkeyHints({ mode: "align", activeElement: { tagName: "INPUT" }, snoozeOpen: false }), {
    enterHint: "Enter: Submit",
    quickHint: null,
    detailsHint: null,
    escHint: "Esc: Snooze"
  });

  // When focus is on a control, Enter should be described as activating that control.
  assert.deepEqual(getHotkeyHints({ mode: "", activeElement: { tagName: "BUTTON" }, snoozeOpen: false }), {
    enterHint: "Enter: Activate",
    quickHint: null,
    detailsHint: null,
    escHint: "Esc: Snooze"
  });

  assert.deepEqual(
    getHotkeyHints({ mode: "align", activeElement: { tagName: "DIV" }, snoozeOpen: false, detailsAvailable: true }),
    {
      enterHint: "Enter: Activate",
      quickHint: "1-9: Choose",
      detailsHint: "?: Details",
      escHint: "Esc: Snooze"
    }
  );

  assert.deepEqual(
    getHotkeyHints({ mode: "align", activeElement: { tagName: "DIV" }, snoozeOpen: false, detailsAvailable: false }),
    {
      enterHint: "Enter: Activate",
      quickHint: "1-9: Choose",
      detailsHint: null,
      escHint: "Esc: Snooze"
    }
  );

  // When snooze is open, hide other hints that aren't actionable.
  assert.deepEqual(
    getHotkeyHints({ mode: "align", activeElement: { tagName: "DIV" }, snoozeOpen: true, detailsAvailable: true }),
    {
      enterHint: "Enter: Activate",
      quickHint: null,
      detailsHint: null,
      escHint: "Esc: Close snooze"
    }
  );

  // When snooze is open and a reason button is focused, make Enter behavior explicit.
  assert.deepEqual(
    getHotkeyHints({ mode: "align", activeElement: { tagName: "BUTTON" }, snoozeOpen: true, detailsAvailable: true }),
    {
      enterHint: "Enter: Select",
      quickHint: null,
      detailsHint: null,
      escHint: "Esc: Close snooze"
    }
  );
});

test("choiceIndexFromKey: maps 1-9 to zero-based indices", () => {
  assert.equal(choiceIndexFromKey("1"), 0);
  assert.equal(choiceIndexFromKey("2"), 1);
  assert.equal(choiceIndexFromKey("9"), 8);
  assert.equal(choiceIndexFromKey("0"), null);
  assert.equal(choiceIndexFromKey("a"), null);
});

test("shouldTriggerChoiceFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerChoiceFromKeydown({ key: "1", isComposing: false }, null), true);

  // Only 1-9.
  assert.equal(shouldTriggerChoiceFromKeydown({ key: "0", isComposing: false }, null), false);

  // Never while typing.
  assert.equal(
    shouldTriggerChoiceFromKeydown({ key: "2", isComposing: false, target: { tagName: "INPUT" } }, null),
    false
  );

  // Avoid auto-repeat and modifier keys.
  assert.equal(shouldTriggerChoiceFromKeydown({ key: "3", isComposing: false, repeat: true }, null), false);
  assert.equal(shouldTriggerChoiceFromKeydown({ key: "4", isComposing: false, ctrlKey: true }, null), false);
});

test("shouldTriggerChoice: requires a short dwell after show", () => {
  const event = { key: "1", isComposing: false, target: { tagName: "DIV" } };

  // Within the dwell window → do not trigger.
  assert.equal(shouldTriggerChoice(event, null, 1000, 1200), false);

  // After the dwell window → ok.
  assert.equal(shouldTriggerChoice(event, null, 1000, 2000), true);
});

test("shouldTriggerAlignSubmitFromKeydown: triggers only when safe", () => {
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false }), true);

  // Only Enter.
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Escape", isComposing: false }), false);

  // Don't submit while composing (IME).
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: true }), false);

  // Avoid auto-repeat.
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false, repeat: true }), false);

  // Don't hijack modified Enter.
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false, metaKey: true }), false);
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false, ctrlKey: true }), false);
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false, altKey: true }), false);
  assert.equal(shouldTriggerAlignSubmitFromKeydown({ key: "Enter", isComposing: false, shiftKey: true }), false);
});

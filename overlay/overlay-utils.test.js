const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  normalizeTwoMinuteStep,
  normalizeFreeform,
  shouldTriggerBackOnTrackOnEnter,
  isPauseShortcut,
  enterHintForState,
  labelForPayload,
  getOverlayHotkeyAction,
  isAppleSilicon,
  shouldAutoRehydrateRenderer
} = require("./overlay-utils");

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

test("normalizeTwoMinuteStep: trims, collapses whitespace, clamps length", () => {
  assert.equal(normalizeTwoMinuteStep("   write   one\nline  "), "write one line");
  assert.equal(normalizeTwoMinuteStep(""), "");
  assert.equal(normalizeTwoMinuteStep(null), "");
  assert.equal(normalizeTwoMinuteStep("a".repeat(10), { maxLen: 5 }), "aaaaa");
});

test("normalizeFreeform: trims, collapses whitespace, clamps length", () => {
  assert.equal(normalizeFreeform("  hello\n\tworld  "), "hello world");
  assert.equal(normalizeFreeform(""), "");
  assert.equal(normalizeFreeform(undefined), "");
  assert.equal(normalizeFreeform("b".repeat(10), { maxLen: 4 }), "bbbb");
});

test("shouldTriggerBackOnTrackOnEnter: blocks Enter during align and 2-min flows", () => {
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "DIV" }, mode: "align", twoMinOpen: false }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "DIV" }, mode: "", twoMinOpen: true }),
    false
  );
});

test("shouldTriggerBackOnTrackOnEnter: blocks Enter while typing; allows otherwise", () => {
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "INPUT" }, mode: "", twoMinOpen: false }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "DIV" }, mode: "", twoMinOpen: false }),
    true
  );
});

test("shouldTriggerBackOnTrackOnEnter: does not fire when focus on buttons/links", () => {
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "BUTTON" }, mode: "", twoMinOpen: false }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrackOnEnter({ target: { tagName: "A" }, mode: "", twoMinOpen: false }),
    false
  );
});

test("isPauseShortcut: detects Cmd/Ctrl+Shift+P", () => {
  assert.equal(isPauseShortcut({ key: "p", metaKey: true, ctrlKey: false, shiftKey: true }), true);
  assert.equal(isPauseShortcut({ key: "P", metaKey: false, ctrlKey: true, shiftKey: true }), true);
  assert.equal(isPauseShortcut({ key: "p", metaKey: true, ctrlKey: false, shiftKey: false }), false);
  assert.equal(isPauseShortcut({ key: "x", metaKey: true, ctrlKey: false, shiftKey: true }), false);
  assert.equal(isPauseShortcut(null), false);
});

test("enterHintForState: returns context-specific Enter hint", () => {
  assert.equal(enterHintForState({ mode: "align", twoMinOpen: false }), "Enter: Submit answer");
  assert.equal(enterHintForState({ mode: "", twoMinOpen: true }), "Enter: Set 2‑min step");
  // 2‑min panel should win even during align mode (prevents misleading hints).
  assert.equal(enterHintForState({ mode: "align", twoMinOpen: true }), "Enter: Set 2‑min step");
  assert.equal(enterHintForState({ mode: "", twoMinOpen: false }), "Enter: Back on track");
});

test("labelForPayload: derives a clear primary label", () => {
  assert.equal(labelForPayload({ mode: "", canUndoRecover: false }), "DRIFT");
  assert.equal(labelForPayload({ mode: "align", canUndoRecover: false }), "ALIGN");
  assert.equal(labelForPayload({ mode: "", canUndoRecover: true }), "RECOVERED");
});

test("labelForPayload: prefers custom label and normalizes it", () => {
  assert.equal(labelForPayload({ customLabel: "  focus  " }), "FOCUS");
  assert.equal(labelForPayload({ customLabel: "make  it\nsmall" }), "MAKE IT SMALL");
  assert.equal(labelForPayload({ customLabel: "x".repeat(50) }), "X".repeat(16));
});

test("getOverlayHotkeyAction: ignores hotkeys while overlay hidden", () => {
  assert.equal(getOverlayHotkeyAction({ key: "Enter", target: { tagName: "DIV" } }, { overlayHidden: true }), null);
  assert.equal(getOverlayHotkeyAction({ key: "Escape", target: { tagName: "DIV" } }, { overlayHidden: true }), null);
});

test("getOverlayHotkeyAction: Enter maps to back_on_track only in safe contexts", () => {
  assert.equal(
    getOverlayHotkeyAction({ key: "Enter", target: { tagName: "DIV" } }, { overlayHidden: false, mode: "", twoMinOpen: false }),
    "back_on_track"
  );
  assert.equal(
    getOverlayHotkeyAction({ key: "Enter", target: { tagName: "INPUT" } }, { overlayHidden: false, mode: "", twoMinOpen: false }),
    null
  );
  assert.equal(
    getOverlayHotkeyAction({ key: "Enter", target: { tagName: "DIV" } }, { overlayHidden: false, mode: "align", twoMinOpen: false }),
    null
  );
});

test("getOverlayHotkeyAction: suppresses while overlayBusy", () => {
  assert.equal(
    getOverlayHotkeyAction(
      { key: "Enter", target: { tagName: "DIV" } },
      { overlayHidden: false, overlayBusy: true, mode: "", twoMinOpen: false }
    ),
    null
  );
  assert.equal(
    getOverlayHotkeyAction(
      { key: "Escape", target: { tagName: "DIV" } },
      { overlayHidden: false, overlayBusy: true, mode: "", twoMinOpen: false }
    ),
    null
  );
});

test("getOverlayHotkeyAction: Escape shows snooze unless typing", () => {
  assert.equal(
    getOverlayHotkeyAction({ key: "Escape", target: { tagName: "DIV" } }, { overlayHidden: false }),
    "show_snooze"
  );
  assert.equal(
    getOverlayHotkeyAction({ key: "Escape", target: { tagName: "TEXTAREA" } }, { overlayHidden: false }),
    null
  );
});

test("platform helpers: detect Apple Silicon + gate rehydration", () => {
  assert.equal(isAppleSilicon({ platform: "darwin", arch: "arm64" }), true);
  assert.equal(isAppleSilicon({ platform: "darwin", arch: "arm64e" }), true);
  assert.equal(isAppleSilicon({ platform: "darwin", arch: "x64" }), false);
  assert.equal(isAppleSilicon({ platform: "linux", arch: "arm64" }), false);

  assert.equal(shouldAutoRehydrateRenderer({ platform: "darwin", arch: "arm64" }), true);
  assert.equal(shouldAutoRehydrateRenderer({ platform: "darwin", arch: "x64" }), false);
});

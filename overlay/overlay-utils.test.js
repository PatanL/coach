const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  normalizeTwoMinuteStep,
  shouldTriggerBackOnTrackOnEnter
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

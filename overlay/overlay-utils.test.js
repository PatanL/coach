const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isPatternBreakEvent,
  isTypingContext,
  primaryEnterAction,
  shouldTriggerBackOnTrack
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

test("isPatternBreakEvent: true only for DRIFT_PERSIST", () => {
  assert.equal(isPatternBreakEvent("DRIFT_PERSIST"), true);
  assert.equal(isPatternBreakEvent("drift_persist"), true);
  assert.equal(isPatternBreakEvent("DRIFT_START"), false);
  assert.equal(isPatternBreakEvent(null), false);
});

test("isTypingContext: true if either event target or active element is a typing target", () => {
  assert.equal(isTypingContext({ tagName: "DIV" }, { tagName: "INPUT" }), true);
  assert.equal(isTypingContext({ tagName: "TEXTAREA" }, { tagName: "DIV" }), true);
  assert.equal(isTypingContext({ tagName: "DIV" }, { tagName: "DIV" }), false);
});

test("primaryEnterAction: DRIFT_PERSIST biases toward recover", () => {
  assert.equal(primaryEnterAction("DRIFT_START"), "back_on_track");
  assert.equal(primaryEnterAction("DRIFT_PERSIST"), "recover");
  assert.equal(primaryEnterAction("drift_persist"), "recover");
});

test("shouldTriggerBackOnTrack: blocks accidental Enter within the safety window", () => {
  assert.equal(
    shouldTriggerBackOnTrack({ eventTarget: { tagName: "DIV" }, activeElement: { tagName: "DIV" }, sinceShownMs: 0 }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrack({ eventTarget: { tagName: "DIV" }, activeElement: { tagName: "DIV" }, sinceShownMs: 399 }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrack({ eventTarget: { tagName: "DIV" }, activeElement: { tagName: "DIV" }, sinceShownMs: 400 }),
    true
  );
});

test("shouldTriggerBackOnTrack: never triggers while typing", () => {
  assert.equal(
    shouldTriggerBackOnTrack({ eventTarget: { tagName: "INPUT" }, activeElement: { tagName: "DIV" }, sinceShownMs: 1000 }),
    false
  );
  assert.equal(
    shouldTriggerBackOnTrack({ eventTarget: { tagName: "DIV" }, activeElement: { tagName: "TEXTAREA" }, sinceShownMs: 1000 }),
    false
  );
});

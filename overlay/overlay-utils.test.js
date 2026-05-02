const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveTarget,
  shouldIgnoreGlobalEnter,
  requiresModifiedEnter,
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

test("isInteractiveTarget: recognizes common clickable targets", () => {
  assert.equal(isInteractiveTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveTarget({ tagName: "a" }), true);
  assert.equal(isInteractiveTarget({ tagName: "DIV", getAttribute: (k) => (k === "role" ? "button" : null) }), true);
});

test("isInteractiveTarget: ignores non-interactive targets", () => {
  assert.equal(isInteractiveTarget({ tagName: "INPUT" }), false);
  assert.equal(isInteractiveTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveTarget(null), false);
});

test("shouldIgnoreGlobalEnter: typing or clicking should block global Enter action", () => {
  assert.equal(shouldIgnoreGlobalEnter({ tagName: "INPUT" }), true);
  assert.equal(shouldIgnoreGlobalEnter({ tagName: "BUTTON" }), true);
  assert.equal(shouldIgnoreGlobalEnter({ tagName: "DIV" }), false);
});

test("shouldIgnoreGlobalEnter: child of button/link should still block global Enter", () => {
  const button = { tagName: "BUTTON" };
  const spanInsideButton = {
    tagName: "SPAN",
    closest: (selector) => {
      // Return the button for any closest() selector query.
      // We don't parse selectors here; we just validate that shouldIgnoreGlobalEnter uses closest.
      return selector ? button : null;
    }
  };
  assert.equal(shouldIgnoreGlobalEnter(spanInsideButton), true);
});

test("requiresModifiedEnter: DRIFT_PERSIST requires Cmd/Ctrl modifier", () => {
  assert.equal(requiresModifiedEnter("DRIFT_PERSIST"), true);
  assert.equal(requiresModifiedEnter("drift_persist"), true);
  assert.equal(requiresModifiedEnter("DRIFT"), false);
  assert.equal(requiresModifiedEnter(""), false);
});

test("shouldTriggerBackOnTrack: DRIFT_PERSIST blocks plain Enter but allows Cmd/Ctrl+Enter", () => {
  const base = { eventType: "DRIFT_PERSIST", target: { tagName: "DIV" }, key: "Enter" };
  assert.equal(shouldTriggerBackOnTrack({ ...base, metaKey: false, ctrlKey: false }), false);
  assert.equal(shouldTriggerBackOnTrack({ ...base, metaKey: true, ctrlKey: false }), true);
  assert.equal(shouldTriggerBackOnTrack({ ...base, metaKey: false, ctrlKey: true }), true);
});

test("shouldTriggerBackOnTrack: non-DRIFT_PERSIST allows plain Enter when not focused in input/control", () => {
  assert.equal(
    shouldTriggerBackOnTrack({ eventType: "DRIFT", target: { tagName: "DIV" }, key: "Enter", metaKey: false, ctrlKey: false }),
    true
  );
  assert.equal(
    shouldTriggerBackOnTrack({ eventType: "DRIFT", target: { tagName: "INPUT" }, key: "Enter", metaKey: false, ctrlKey: false }),
    false
  );
});

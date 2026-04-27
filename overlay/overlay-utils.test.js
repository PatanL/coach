const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveTarget,
  shouldIgnoreGlobalEnter,
  shouldTriggerBackOnTrackEnter
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

test("shouldTriggerBackOnTrackEnter: only unmodified Enter on non-interactive targets", () => {
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "DIV" } }), true);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "INPUT" } }), false);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "DIV" }, metaKey: true }), false);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "DIV" }, ctrlKey: true }), false);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "DIV" }, altKey: true }), false);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Enter", target: { tagName: "DIV" }, isComposing: true }), false);
  assert.equal(shouldTriggerBackOnTrackEnter({ key: "Escape", target: { tagName: "DIV" } }), false);
});

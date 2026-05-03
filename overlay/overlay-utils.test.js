const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveTarget, shouldIgnoreGlobalEnter, getGlobalEnterAction } = require("./overlay-utils");

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

test("getGlobalEnterAction: DRIFT_PERSIST defaults to recover when not interacting", () => {
  assert.equal(getGlobalEnterAction({ target: { tagName: "DIV" }, eventType: "DRIFT_PERSIST" }), "recover");
  assert.equal(getGlobalEnterAction({ target: { tagName: "DIV" }, eventType: "drift_persist" }), "recover");
});

test("getGlobalEnterAction: other events default to back_on_track", () => {
  assert.equal(getGlobalEnterAction({ target: { tagName: "DIV" }, eventType: "DRIFT" }), "back_on_track");
  assert.equal(getGlobalEnterAction({ target: { tagName: "DIV" }, eventType: "" }), "back_on_track");
});

test("getGlobalEnterAction: interactive/typing targets disable global Enter", () => {
  assert.equal(getGlobalEnterAction({ target: { tagName: "INPUT" }, eventType: "DRIFT_PERSIST" }), null);
  assert.equal(getGlobalEnterAction({ target: { tagName: "BUTTON" }, eventType: "DRIFT_PERSIST" }), null);
});

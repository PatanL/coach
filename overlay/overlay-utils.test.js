const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveTarget,
  shouldIgnoreGlobalHotkey,
  shouldIgnoreGlobalEnter
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

test("shouldIgnoreGlobalHotkey: typing or clicking should block global hotkeys", () => {
  assert.equal(shouldIgnoreGlobalHotkey({ tagName: "INPUT" }), true);
  assert.equal(shouldIgnoreGlobalHotkey({ tagName: "BUTTON" }), true);
  assert.equal(shouldIgnoreGlobalHotkey({ tagName: "DIV" }), false);
});

test("shouldIgnoreGlobalEnter: alias stays consistent", () => {
  assert.equal(shouldIgnoreGlobalEnter({ tagName: "INPUT" }), true);
  assert.equal(shouldIgnoreGlobalEnter({ tagName: "DIV" }), false);
});

test("shouldIgnoreGlobalHotkey: child of button/link should still block global hotkeys", () => {
  const button = { tagName: "BUTTON" };
  const spanInsideButton = {
    tagName: "SPAN",
    closest: (selector) => {
      // Return the button for any closest() selector query.
      // We don't parse selectors here; we just validate that shouldIgnoreGlobalHotkey uses closest.
      return selector ? button : null;
    }
  };
  assert.equal(shouldIgnoreGlobalHotkey(spanInsideButton), true);
});

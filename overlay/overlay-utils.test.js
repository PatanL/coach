const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveTarget, shouldIgnoreGlobalEnter, shouldAllowGlobalEnter } = require("./overlay-utils");

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

test("shouldAllowGlobalEnter: debounces immediately after show (default)", () => {
  const target = { tagName: "DIV" };
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 1000, nowMs: 1200, eventType: "DRIFT" }),
    false
  );
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 1000, nowMs: 1600, eventType: "DRIFT" }),
    true
  );
});

test("shouldAllowGlobalEnter: stronger debounce for DRIFT_PERSIST", () => {
  const target = { tagName: "DIV" };
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 1000, nowMs: 1750, eventType: "DRIFT_PERSIST" }),
    false
  );
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 1000, nowMs: 1800, eventType: "DRIFT_PERSIST" }),
    true
  );
});

test("shouldAllowGlobalEnter: never allows when typing/clicking", () => {
  const target = { tagName: "INPUT" };
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 1000, nowMs: 99999, eventType: "DRIFT" }),
    false
  );
});

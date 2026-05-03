const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveTarget,
  shouldIgnoreGlobalEnter,
  shouldAllowGlobalEnter,
  getDefaultEnterAction
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

test("getDefaultEnterAction: DRIFT_PERSIST prefers recover (pattern-break)", () => {
  assert.equal(getDefaultEnterAction("DRIFT_PERSIST"), "recover");
  assert.equal(getDefaultEnterAction("drift_persist"), "recover");
});

test("getDefaultEnterAction: other events default to back_on_track", () => {
  assert.equal(getDefaultEnterAction("DRIFT_START"), "back_on_track");
  assert.equal(getDefaultEnterAction(""), "back_on_track");
  assert.equal(getDefaultEnterAction(null), "back_on_track");
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

test("shouldAllowGlobalEnter: 0 timestamps are treated as real times (do not bypass debounce)", () => {
  const target = { tagName: "DIV" };
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 0, nowMs: 200, eventType: "DRIFT" }),
    false
  );
  assert.equal(
    shouldAllowGlobalEnter(target, { shownAtMs: 0, nowMs: 500, eventType: "DRIFT" }),
    true
  );
});

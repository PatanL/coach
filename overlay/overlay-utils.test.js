const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  isInteractiveTarget,
  shouldIgnoreGlobalEnter,
  decideGlobalEnterAction
} = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", getAttribute: (k) => (k === "role" ? "textbox" : null) }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", getAttribute: (k) => (k === "role" ? "searchbox" : null) }), true);
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

test("shouldIgnoreGlobalEnter: child of role=textbox/searchbox should block global Enter", () => {
  const textbox = { tagName: "DIV", getAttribute: (k) => (k === "role" ? "textbox" : null) };
  const searchbox = { tagName: "DIV", getAttribute: (k) => (k === "role" ? "searchbox" : null) };

  const spanInTextbox = { tagName: "SPAN", closest: () => textbox };
  const spanInSearchbox = { tagName: "SPAN", closest: () => searchbox };

  assert.equal(shouldIgnoreGlobalEnter(spanInTextbox), true);
  assert.equal(shouldIgnoreGlobalEnter(spanInSearchbox), true);
});

test("decideGlobalEnterAction: DRIFT_PERSIST defaults Enter to recover (pattern-break)", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "DIV" } }), "recover");
  assert.equal(decideGlobalEnterAction({ eventType: "drift_persist", target: { tagName: "DIV" } }), "recover");
});

test("decideGlobalEnterAction: ignores Enter while typing/clicking", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "INPUT" } }), null);
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "BUTTON" } }), null);
});

test("decideGlobalEnterAction: ignores key-repeat (prevents accidental spam)", () => {
  assert.equal(
    decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "DIV" }, isRepeat: true }),
    null
  );
  assert.equal(
    decideGlobalEnterAction({ eventType: "DRIFT_START", target: { tagName: "DIV" }, isRepeat: true }),
    null
  );
});

test("decideGlobalEnterAction: defaults Enter to back_on_track for other events", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_START", target: { tagName: "DIV" } }), "back_on_track");
  assert.equal(decideGlobalEnterAction({ eventType: null, target: { tagName: "DIV" } }), "back_on_track");
});

test("decideGlobalEnterAction: default is back_on_track when safe", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_START", target: { tagName: "DIV" } }), "back_on_track");
});

test("decideGlobalEnterAction: DRIFT_PERSIST becomes recover (pattern-break)", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "DIV" } }), "recover");
  assert.equal(decideGlobalEnterAction({ eventType: "drift_persist", target: { tagName: "DIV" } }), "recover");
});

test("decideGlobalEnterAction: returns null when Enter should be ignored", () => {
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_PERSIST", target: { tagName: "INPUT" } }), null);
  assert.equal(decideGlobalEnterAction({ eventType: "DRIFT_START", target: { tagName: "BUTTON" } }), null);
});

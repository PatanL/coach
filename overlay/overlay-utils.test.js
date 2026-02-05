const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, isInteractiveControlTarget, shouldTriggerBackOnTrackOnEnter } = require("./overlay-utils");

test("isTextInputTarget: recognizes common typing targets", () => {
  assert.equal(isTextInputTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextInputTarget({ tagName: "textarea" }), true);
  assert.equal(isTextInputTarget({ tagName: "Select" }), true);
  assert.equal(isTextInputTarget({ tagName: "DIV", isContentEditable: true }), true);

  // Nested target inside a contenteditable ancestor.
  assert.equal(
    isTextInputTarget({
      tagName: "SPAN",
      closest: (selector) => (selector.includes("contenteditable") ? { tagName: "DIV" } : null)
    }),
    true
  );

  // Nested target inside a role=textbox ancestor.
  assert.equal(
    isTextInputTarget({
      tagName: "DIV",
      closest: (selector) => (selector.includes('role="textbox"') ? { tagName: "DIV" } : null)
    }),
    true
  );

  assert.equal(isTextInputTarget({ tagName: "DIV", getAttribute: (key) => (key === "role" ? "textbox" : null) }), true);
});

test("isTextInputTarget: ignores non-input targets", () => {
  assert.equal(isTextInputTarget({ tagName: "BUTTON" }), false);
  assert.equal(isTextInputTarget({ tagName: "DIV" }), false);
  assert.equal(isTextInputTarget(null), false);
});

test("isInteractiveControlTarget: recognizes buttons + links (including nested targets)", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "BUTTON" }), true);
  assert.equal(isInteractiveControlTarget({ tagName: "a" }), true);

  // Nested target inside a <button>.
  assert.equal(
    isInteractiveControlTarget({
      tagName: "SPAN",
      closest: (selector) => (selector.includes("button") ? { tagName: "BUTTON" } : null)
    }),
    true
  );

  // Direct role=button target (no closest available).
  assert.equal(
    isInteractiveControlTarget({
      tagName: "DIV",
      getAttribute: (key) => (key === "role" ? "button" : null)
    }),
    true
  );
});

test("isInteractiveControlTarget: ignores plain elements", () => {
  assert.equal(isInteractiveControlTarget({ tagName: "DIV" }), false);
  assert.equal(isInteractiveControlTarget(null), false);
});

test("shouldTriggerBackOnTrackOnEnter: triggers immediately for non-persist drift", () => {
  const res = shouldTriggerBackOnTrackOnEnter({ eventType: "DRIFT_START", nowMs: 1000, lastEnterMs: 0 });
  assert.deepEqual(res, { trigger: true, nextLastEnterMs: 0 });
});

test("shouldTriggerBackOnTrackOnEnter: requires double-enter for DRIFT_PERSIST", () => {

  // First press arms the confirmation window.
  const first = shouldTriggerBackOnTrackOnEnter({ eventType: "DRIFT_PERSIST", nowMs: 1000, lastEnterMs: 0 });
  assert.deepEqual(first, { trigger: false, nextLastEnterMs: 1000 });

  // Second press within the window triggers.
  const second = shouldTriggerBackOnTrackOnEnter({ eventType: "DRIFT_PERSIST", nowMs: 1800, lastEnterMs: first.nextLastEnterMs });
  assert.deepEqual(second, { trigger: true, nextLastEnterMs: 0 });

  // Too slow: re-arm.
  const slow = shouldTriggerBackOnTrackOnEnter({ eventType: "DRIFT_PERSIST", nowMs: 2500, lastEnterMs: 1000 });
  assert.deepEqual(slow, { trigger: false, nextLastEnterMs: 2500 });
});

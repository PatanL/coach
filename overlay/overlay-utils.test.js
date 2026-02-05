const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTextInputTarget,
  shouldImplicitEnterTriggerBackOnTrack,
  shouldEscapeToggleSnooze
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

test("shouldImplicitEnterTriggerBackOnTrack: blocks enter while typing", () => {
  assert.equal(
    shouldImplicitEnterTriggerBackOnTrack({
      target: { tagName: "INPUT" },
      overlayHidden: false,
      mode: "",
      snoozeVisible: false
    }),
    false
  );
});

test("shouldImplicitEnterTriggerBackOnTrack: blocks enter in align mode", () => {
  assert.equal(
    shouldImplicitEnterTriggerBackOnTrack({
      target: { tagName: "DIV" },
      overlayHidden: false,
      mode: "align",
      snoozeVisible: false
    }),
    false
  );
});

test("shouldImplicitEnterTriggerBackOnTrack: blocks enter when snooze is open", () => {
  assert.equal(
    shouldImplicitEnterTriggerBackOnTrack({
      target: { tagName: "DIV" },
      overlayHidden: false,
      mode: "",
      snoozeVisible: true
    }),
    false
  );
});

test("shouldImplicitEnterTriggerBackOnTrack: allows enter for non-typing, normal mode", () => {
  assert.equal(
    shouldImplicitEnterTriggerBackOnTrack({
      target: { tagName: "DIV" },
      overlayHidden: false,
      mode: "",
      snoozeVisible: false
    }),
    true
  );
});

test("shouldEscapeToggleSnooze: blocks escape while typing", () => {
  assert.equal(
    shouldEscapeToggleSnooze({
      target: { tagName: "TEXTAREA" },
      overlayHidden: false,
      mode: ""
    }),
    false
  );
});

test("shouldEscapeToggleSnooze: blocks escape when overlay is hidden", () => {
  assert.equal(
    shouldEscapeToggleSnooze({
      target: { tagName: "DIV" },
      overlayHidden: true,
      mode: ""
    }),
    false
  );
});

test("shouldEscapeToggleSnooze: blocks escape in align mode", () => {
  assert.equal(
    shouldEscapeToggleSnooze({
      target: { tagName: "DIV" },
      overlayHidden: false,
      mode: "align"
    }),
    false
  );
});

test("shouldEscapeToggleSnooze: allows escape in normal mode", () => {
  assert.equal(
    shouldEscapeToggleSnooze({
      target: { tagName: "DIV" },
      overlayHidden: false,
      mode: ""
    }),
    true
  );
});

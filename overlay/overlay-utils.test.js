const test = require("node:test");
const assert = require("node:assert/strict");

const { isTextInputTarget, shouldImplicitEnterTriggerBackOnTrack } = require("./overlay-utils");

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

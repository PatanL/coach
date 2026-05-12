const test = require("node:test");
const assert = require("node:assert/strict");

const { shouldBlockGlobalEnter } = require("./overlay-utils");

test("shouldBlockGlobalEnter: DRIFT_PERSIST always blocks Enter to avoid accidental dismissal", () => {
  assert.equal(shouldBlockGlobalEnter("DRIFT_PERSIST", { tagName: "DIV" }), true);
  assert.equal(shouldBlockGlobalEnter("drift_persist", { tagName: "INPUT" }), true);
});

test("shouldBlockGlobalEnter: other events defer to target-based ignore rules", () => {
  assert.equal(shouldBlockGlobalEnter("DRIFT", { tagName: "INPUT" }), true);
  assert.equal(shouldBlockGlobalEnter("DRIFT", { tagName: "DIV" }), false);
});

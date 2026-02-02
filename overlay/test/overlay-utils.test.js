// Focused, dependency-free tests for overlay-utils helpers using Node's test runner.
const { test } = require('node:test');
const assert = require('assert');
const overlayUtils = require('../overlay-utils');

test('isAppleSilicon detects darwin arm64', () => {
  assert.strictEqual(overlayUtils.isAppleSilicon({ platform: 'darwin', arch: 'arm64' }), true);
  assert.strictEqual(overlayUtils.isAppleSilicon({ platform: 'darwin', arch: 'arm64e' }), true);
  assert.strictEqual(overlayUtils.isAppleSilicon({ platform: 'darwin', arch: 'x64' }), false);
  assert.strictEqual(overlayUtils.isAppleSilicon({ platform: 'win32', arch: 'arm64' }), false);
});

test('shouldAutoRehydrateRenderer true only on Apple Silicon', () => {
  assert.strictEqual(overlayUtils.shouldAutoRehydrateRenderer({ platform: 'darwin', arch: 'arm64' }), true);
  assert.strictEqual(overlayUtils.shouldAutoRehydrateRenderer({ platform: 'darwin', arch: 'x64' }), false);
});

test('enterHintForState reflects two-min and align modes', () => {
  assert.strictEqual(overlayUtils.enterHintForState({ mode: '', twoMinOpen: true }), 'Enter: Set 2‑min step');
  assert.strictEqual(overlayUtils.enterHintForState({ mode: 'align', twoMinOpen: false }), 'Enter: Submit answer');
  assert.strictEqual(overlayUtils.enterHintForState({}), 'Enter: Back on track');
});

test('labelForOverlayState shows CONFIRM when recover armed', () => {
  assert.strictEqual(overlayUtils.labelForOverlayState({ recoverArmed: true }), 'CONFIRM');
});

test('buildOverlayDataErrorPayload includes actionable next step on Apple Silicon', () => {
  const p = overlayUtils.buildOverlayDataErrorPayload({ error: 'bad json', rawLine: '{', env: { platform: 'darwin', arch: 'arm64' } });
  assert.ok(p.next_action.toLowerCase().includes('copy diagnostics'));
});

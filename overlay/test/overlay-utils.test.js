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
  // When recover is armed, Enter should hint confirm.
  assert.strictEqual(overlayUtils.enterHintForState({ mode: '', twoMinOpen: false, recoverArmed: true }), 'Enter: Confirm');
});

test('labelForOverlayState shows CONFIRM when recover armed', () => {
  assert.strictEqual(overlayUtils.labelForOverlayState({ recoverArmed: true }), 'CONFIRM');
});

test('buildOverlayDataErrorPayload includes actionable next step on Apple Silicon', () => {
  const p = overlayUtils.buildOverlayDataErrorPayload({ error: 'bad json', rawLine: '{', env: { platform: 'darwin', arch: 'arm64' } });
  assert.ok(p.next_action.toLowerCase().includes('copy diagnostics'));
});

test('buildOverlayDataErrorPayload uses OS-appropriate restart hint', () => {
  const mac = overlayUtils.buildOverlayDataErrorPayload({ error: 'bad', rawLine: '{', env: { platform: 'darwin', arch: 'x64' } });
  assert.ok(mac.next_action.toLowerCase().includes('cmd+q'));

  const win = overlayUtils.buildOverlayDataErrorPayload({ error: 'bad', rawLine: '{', env: { platform: 'win32', arch: 'x64' } });
  assert.ok(!win.next_action.toLowerCase().includes('cmd+q'));
});

test('shouldShowRelaunchButton true only on Apple Silicon + overlay data error payload', () => {
  assert.strictEqual(
    overlayUtils.shouldShowRelaunchButton({ env: { platform: 'darwin', arch: 'arm64' }, payload: { headline: 'Overlay data error' } }),
    true
  );
  assert.strictEqual(
    overlayUtils.shouldShowRelaunchButton({ env: { platform: 'darwin', arch: 'x64' }, payload: { headline: 'Overlay data error' } }),
    false
  );
  assert.strictEqual(
    overlayUtils.shouldShowRelaunchButton({ env: { platform: 'darwin', arch: 'arm64' }, payload: { headline: 'Other' } }),
    false
  );
});

test('getOverlayHotkeyAction: Enter confirms recover when armed in safe contexts', () => {
  // Safe: not typing, not align mode, no panels open
  assert.strictEqual(
    overlayUtils.getOverlayHotkeyAction(
      { key: 'Enter', target: { tagName: 'DIV' } },
      { overlayHidden: false, overlayBusy: false, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: true }
    ),
    'confirm_recover'
  );
  // Unsafe while typing into inputs
  assert.strictEqual(
    overlayUtils.getOverlayHotkeyAction(
      { key: 'Enter', target: { tagName: 'INPUT' } },
      { overlayHidden: false, overlayBusy: false, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: true }
    ),
    null
  );
  // Unsafe during align mode
  assert.strictEqual(
    overlayUtils.getOverlayHotkeyAction(
      { key: 'Enter', target: { tagName: 'DIV' } },
      { overlayHidden: false, overlayBusy: false, mode: 'align', twoMinOpen: false, snoozeOpen: false, recoverArmed: true }
    ),
    null
  );
});

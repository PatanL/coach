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

test('recoverAriaLabel reflects armed state', () => {
  assert.strictEqual(overlayUtils.recoverAriaLabel({ armed: false }), 'Recover schedule');
  assert.strictEqual(overlayUtils.recoverAriaLabel({ armed: true }), 'Confirm recover');
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

test('shouldShowRelaunchButton true only on Apple Silicon, with opt-in payload flag', () => {
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

  // Main process can explicitly request the relaunch affordance for other recovery cases.
  assert.strictEqual(
    overlayUtils.shouldShowRelaunchButton({ env: { platform: 'darwin', arch: 'arm64' }, payload: { headline: 'Other', relaunch_overlay: true } }),
    true
  );
  // Also allow the renderer-issue headline to show relaunch on Apple Silicon.
  assert.strictEqual(
    overlayUtils.shouldShowRelaunchButton({ env: { platform: 'darwin', arch: 'arm64' }, payload: { headline: 'Overlay renderer issue' } }),
    true
  );
});

test('livePolitenessForPayload asserts for recovery/error overlays', () => {
  const u = overlayUtils;
  assert.strictEqual(u.livePolitenessForPayload({ headline: 'Overlay data error' }), 'assertive');
  assert.strictEqual(u.livePolitenessForPayload({ headline: 'Overlay renderer issue' }), 'assertive');
  assert.strictEqual(u.livePolitenessForPayload({ headline: 'Something else' }), 'polite');
});

test('shouldFocusRecoveryFirst true on Apple Silicon when relaunch visible', () => {
  const env = { platform: 'darwin', arch: 'arm64' };
  assert.strictEqual(overlayUtils.shouldFocusRecoveryFirst({ env, payload: { headline: 'Overlay data error' } }), true);
  assert.strictEqual(overlayUtils.shouldFocusRecoveryFirst({ env: { platform: 'darwin', arch: 'x64' }, payload: { headline: 'Overlay data error' } }), false);
  assert.strictEqual(overlayUtils.shouldFocusRecoveryFirst({ env, payload: { headline: 'Other' } }), false);
  assert.strictEqual(overlayUtils.shouldFocusRecoveryFirst({ env, payload: { headline: 'Other', relaunch_overlay: true } }), true);
});

test('buildOverlayRendererRecoveryPayload sets relaunch_overlay + actionable next step', () => {
  const p = overlayUtils.buildOverlayRendererRecoveryPayload({ reason: 'throttled', env: { platform: 'darwin', arch: 'arm64' } });
  assert.strictEqual(p.relaunch_overlay, true);
  assert.ok(String(p.next_action).toLowerCase().includes('relaunch'));
});

test('shouldShowSnoozeOnEscape disables snooze while typing', () => {
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'INPUT' } }), false);
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'TEXTAREA' } }), false);
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'SELECT' } }), false);
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'DIV', isContentEditable: true } }), false);
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'DIV' } }), true);
  // ARIA role-based inputs should also suppress snooze.
  assert.strictEqual(overlayUtils.shouldShowSnoozeOnEscape({ target: { tagName: 'DIV', getAttribute: (n) => n === 'role' ? 'textbox' : '' } }), false);
});

test('shouldSuppressEnterAfterShow gates carry-over Enter presses', () => {
  assert.strictEqual(overlayUtils.shouldSuppressEnterAfterShow({ msSinceShow: 0 }), true);
  assert.strictEqual(overlayUtils.shouldSuppressEnterAfterShow({ msSinceShow: 200 }), true);
  assert.strictEqual(overlayUtils.shouldSuppressEnterAfterShow({ msSinceShow: 260 }), false);
  assert.strictEqual(overlayUtils.shouldSuppressEnterAfterShow({ msSinceShow: -10 }), false);
});

test('getOverlayHotkeyAction: Escape maps to show_snooze only when safe', () => {
  assert.strictEqual(
    overlayUtils.getOverlayHotkeyAction(
      { key: 'Escape', target: { tagName: 'DIV' } },
      { overlayHidden: false, overlayBusy: false, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: false }
    ),
    'show_snooze'
  );
  assert.strictEqual(
    overlayUtils.getOverlayHotkeyAction(
      { key: 'Escape', target: { tagName: 'INPUT' } },
      { overlayHidden: false, overlayBusy: false, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: false }
    ),
    null
  );
});

test('shouldTriggerBackOnTrackOnEnter does not fire for interactive targets', () => {
  assert.strictEqual(
    overlayUtils.shouldTriggerBackOnTrackOnEnter({ target: { tagName: 'BUTTON' }, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: false }),
    false
  );
  assert.strictEqual(
    overlayUtils.shouldTriggerBackOnTrackOnEnter({ target: { tagName: 'A' }, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: false }),
    false
  );
  assert.strictEqual(
    overlayUtils.shouldTriggerBackOnTrackOnEnter({ target: { tagName: 'DIV' }, mode: '', twoMinOpen: false, snoozeOpen: false, recoverArmed: false }),
    true
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

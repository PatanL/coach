(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.overlayUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Platform helpers kept intentionally tiny and dependency-free so we can
  // reuse them in both renderer and main processes (and unit tests).
  function isAppleSilicon(env) {
    const p = (typeof process !== "undefined" ? process : null);
    const platform = (env && env.platform) || (p && p.platform) || "";
    const arch = (env && env.arch) || (p && p.arch) || "";
    // On macOS, Apple Silicon reports arm64/arm64e.
    return platform === "darwin" && (arch === "arm64" || arch === "arm64e");
  }

  // We currently only auto-rehydrate the overlay renderer on Apple Silicon
  // where GPU handoffs can occasionally blank the transparent window.
  function shouldAutoRehydrateRenderer(env) {
    return isAppleSilicon(env) === true;
  }
  function isTextInputTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (target.isContentEditable) return true;
    // Guard against non-string tagNames or custom elements with input roles.
    // Include BUTTON to avoid global Enter handler firing while a focused button
    // is activated via keyboard (prevents accidental "Back on track").
    if (tag === "input" || tag === "textarea" || tag === "select" || tag === "button") return true;
    // Minimal role check for better keyboard safety in custom UIs.
    try {
      const role = String(target.getAttribute && target.getAttribute('role') || '').toLowerCase();
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox') return true;
    } catch (_e) {}
    return false;
  }

  function normalizeTwoMinuteStep(value, opts = {}) {
    const maxLen = Number.isFinite(opts.maxLen) ? opts.maxLen : 160;
    const str = String(value || "").replace(/\s+/g, " ").trim();
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen).trimEnd() : str;
  }

  function normalizeFreeform(value, opts = {}) {
    const maxLen = Number.isFinite(opts.maxLen) ? opts.maxLen : 240;
    const str = String(value || "").replace(/\s+/g, " ").trim();
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen).trimEnd() : str;
  }

  function safeParseJson(value) {
    try {
      return { ok: true, value: JSON.parse(String(value)) };
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      return { ok: false, error: msg };
    }
  }

  function recoveryNextAction(env) {
    // Make the next action more actionable on Apple Silicon where renderers can
    // be lost after GPU handoffs: suggest copying diagnostics and reloading.
    // On non-macOS platforms avoid mentioning Cmd+Q.
    const platform = (env && env.platform) || (typeof process !== "undefined" ? process.platform : "");
    if (isAppleSilicon(env)) {
      // Keep the primary action quick and clickable, but still mention the
      // fallback that actually recovers stubborn renderer failures. This copy
      // is intentionally specific to the overlay’s buttons and the M1 flow.
      return "Press D (or click ‘Copy diagnostics’), then Cmd+R (or click ‘Relaunch overlay’). If it stays blank, restart Coach.";
    }
    if (platform === "darwin") {
      return "Restart coach (Cmd+Q) then relaunch.";
    }
    return "Restart coach, then relaunch.";
  }

  // Accessibility: Recovery/error states should announce promptly. We use a
  // conservative policy: assertive only for explicit error/recovery overlays,
  // polite for everything else to avoid interrupting the user unnecessarily.
  function livePolitenessForPayload(payload) {
    const h = String(payload?.headline || "");
    if (h === "Overlay data error" || h === "Overlay renderer issue") return "assertive";
    return "polite";
  }

  // When actionable recovery is available on Apple Silicon (M1+), prefer to
  // focus the diagnostics copy affordance first so users can capture context
  // before relaunching the renderer.
  function shouldFocusRecoveryFirst({ env, payload } = {}) {
    if (!isAppleSilicon(env)) return false;
    return shouldShowRelaunchButton({ env, payload }) === true;
  }

  function buildOverlayDataErrorPayload({ error, rawLine, env } = {}) {
    const errStr = String(error || "").trim();
    const raw = String(rawLine || "").trim();
    const diagnosis = normalizeFreeform(
      errStr ? `Failed to parse overlay payload: ${errStr}` : "Failed to parse overlay payload.",
      { maxLen: 220 }
    );

    const human = raw
      ? normalizeFreeform(`Raw: ${raw}`, { maxLen: 180 })
      : "Coach couldn’t read the latest overlay update.";

    return {
      level: "B",
      headline: "Overlay data error",
      human_line: human,
      diagnosis,
      next_action: recoveryNextAction(env),
      relaunch_overlay: true,
      block_id: null,
      block_name: "",
      cmd_id: null,
      source_event_id: null
    };
  }

  function buildOverlayRendererRecoveryPayload({ reason, env } = {}) {
    const why = normalizeFreeform(String(reason || "renderer_issue"), { maxLen: 120 });

    const human = isAppleSilicon(env)
      ? "Overlay became unresponsive (common after an M1 GPU handoff). Recovery is available."
      : "Overlay became unresponsive. Recovery is available.";

    return {
      level: "B",
      headline: "Overlay renderer issue",
      human_line: human,
      diagnosis: normalizeFreeform(`Renderer recovery: ${why}`, { maxLen: 220 }),
      next_action: recoveryNextAction(env),
      relaunch_overlay: true,
      block_id: null,
      block_name: "",
      cmd_id: null,
      source_event_id: null
    };
  }

  function shouldShowRelaunchButton({ env, payload } = {}) {
    if (!isAppleSilicon(env)) return false;
    // Allow the main process (or payload builder helpers) to opt-in to showing
    // the relaunch affordance for other renderer recovery scenarios.
    if (payload && payload.relaunch_overlay === true) return true;
    const h = String(payload?.headline || "");
    return h === "Overlay data error" || h === "Overlay renderer issue";
  }

  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (isTextInputTarget(target)) return true;
    // Treat buttons and links as interactive so Enter activates them,
    // not the global "Back on track" shortcut.
    if (tag === "button" || tag === "a") return true;
    return false;
  }

  function shouldTriggerBackOnTrackOnEnter({ target, mode, twoMinOpen, snoozeOpen, recoverArmed } = {}) {
    // When Recover is armed, Enter should not trigger Back on track.
    if (recoverArmed) return false;
    if (mode === "align") return false;
    if (twoMinOpen) return false;
    if (snoozeOpen) return false;
    return !isInteractiveTarget(target);
  }

  function isPauseShortcut(event) {
    if (!event) return false;
    const key = String(event.key || "").toLowerCase();
    const hasModifier = Boolean(event.metaKey || event.ctrlKey);
    return hasModifier && event.shiftKey && key === "p";
  }

  function enterHintForState({ mode, twoMinOpen, recoverArmed } = {}) {
    // Highest priority: when the 2‑min panel is open, Enter should map to setting that step.
    // This avoids misleading hints even if other modes (e.g. align) are active.
    if (twoMinOpen) return "Enter: Set 2‑min step";
    // When Recover is armed, hint that Enter will confirm it.
    if (recoverArmed) return "Enter: Confirm";
    if (mode === "align") return "Enter: Submit answer";
    return "Enter: Back on track";
  }

  function shouldShowSnoozeOnEscape({ target } = {}) {
    // If the user is typing into any text input, Esc should not pop the snooze panel.
    return !isTextInputTarget(target);
  }

  function shouldSuppressEnterAfterShow({ msSinceShow, thresholdMs = 250 } = {}) {
    const ms = Number(msSinceShow);
    const threshold = Number(thresholdMs);
    if (!Number.isFinite(ms) || !Number.isFinite(threshold)) return false;
    return ms >= 0 && ms < threshold;
  }

  // Input-focus safety: when the overlay steals focus, a carry-over keypress from
  // another app can accidentally trigger a hotkey (e.g. "R" to recover).
  // Suppress risky, non-modified hotkeys for a very short window after show.
  function shouldSuppressHotkeyAfterShow({ key, msSinceShow, thresholdMs = 250 } = {}) {
    const ms = Number(msSinceShow);
    const threshold = Number(thresholdMs);
    if (!Number.isFinite(ms) || !Number.isFinite(threshold)) return false;
    if (!(ms >= 0 && ms < threshold)) return false;

    const k = String(key || '');
    if (!k) return false;

    // Keep Escape available so users can dismiss/cancel even if focus was stolen.
    if (k === 'Escape') return false;

    // Risky hotkeys we support in the overlay UI.
    // - Enter triggers primary actions
    // - Single-letter shortcuts trigger stateful actions (recover/snooze/etc)
    const low = k.toLowerCase();
    if (k === 'Enter') return true;
    if (low === 'r' || low === 'u' || low === 'k' || low === 's' || low === 'd') return true;
    if (low === 't' || low === '2') return true;

    return false;
  }

  function getOverlayHotkeyAction(
    event,
    { overlayHidden = false, overlayBusy = false, mode, twoMinOpen, snoozeOpen, recoverArmed = false } = {}
  ) {
    if (overlayHidden) return null;
    // While the overlay is dispatching an action (buttons disabled),
    // suppress global hotkeys that could accidentally submit actions.
    if (overlayBusy) return null;
    const key = event?.key;
    if (key === "Enter") {
      // If Recover is armed, prefer confirming it via Enter in safe contexts.
      if (recoverArmed) {
        const unsafe = mode === "align" || twoMinOpen || snoozeOpen || isInteractiveTarget(event?.target);
        return unsafe ? null : "confirm_recover";
      }
      return shouldTriggerBackOnTrackOnEnter({
        target: event?.target,
        mode,
        twoMinOpen,
        snoozeOpen,
        recoverArmed
      })
        ? "back_on_track"
        : null;
    }
    if (key === "Escape") {
      return shouldShowSnoozeOnEscape({ target: event?.target }) ? "show_snooze" : null;
    }
    return null;
  }

  function labelForPayload({ mode, canUndoRecover, customLabel } = {}) {
    const cleaned = String(customLabel || "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned) {
      const upper = cleaned.toUpperCase();
      return upper.length > 16 ? upper.slice(0, 16).trimEnd() : upper;
    }
    // When recover has already been applied, we surface that state clearly
    // (and show an undo affordance in the UI).
    if (canUndoRecover) return "RECOVERED";
    if (mode === "align") return "ALIGN";
    return "DRIFT";
  }

  // Slightly higher-level label helper that can incorporate transient UI state
  // (like the "Recover" two-step confirmation) in addition to payload-derived state.
  function labelForOverlayState({ mode, canUndoRecover, customLabel, recoverArmed } = {}) {
    if (recoverArmed) return "CONFIRM";
    return labelForPayload({ mode, canUndoRecover, customLabel });
  }

  // Accessibility: provide a clear, concise aria-label for the Recover button
  // that reflects its two-step confirmation state. Keeps screen readers aligned
  // with the visual "Confirm recover" UI.
  function recoverAriaLabel({ armed } = {}) {
    return armed ? "Confirm recover" : "Recover schedule";
  }

  return {
    isTextInputTarget,
    // not exported but kept here for potential embedding contexts
    // isInteractiveTarget is intentionally not part of the public API
    // to avoid widening usage surface area.
    normalizeTwoMinuteStep,
    normalizeFreeform,
    safeParseJson,
    buildOverlayDataErrorPayload,
    buildOverlayRendererRecoveryPayload,
    shouldShowRelaunchButton,
    livePolitenessForPayload,
    shouldFocusRecoveryFirst,
    shouldTriggerBackOnTrackOnEnter,
    shouldShowSnoozeOnEscape,
    getOverlayHotkeyAction,
    isPauseShortcut,
    enterHintForState,
    labelForPayload,
    labelForOverlayState,
    recoverAriaLabel,
    shouldSuppressEnterAfterShow,
    shouldSuppressHotkeyAfterShow,
    // Platform helpers exported for main-process reliability guards.
    isAppleSilicon,
    shouldAutoRehydrateRenderer
  };
});

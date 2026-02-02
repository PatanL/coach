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
    return tag === "input" || tag === "textarea" || tag === "select";
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

    // Make the next action more actionable on Apple Silicon where renderers can
    // be lost after GPU handoffs: suggest copying diagnostics and reloading.
    // On non-macOS platforms avoid mentioning Cmd+Q.
    const platform = (env && env.platform) || (typeof process !== "undefined" ? process.platform : "");
    let nextAction;
    if (isAppleSilicon(env)) {
      nextAction = "Click ‘Copy diagnostics’, then ‘Relaunch overlay’.";
    } else if (platform === "darwin") {
      nextAction = "Restart coach (Cmd+Q) then relaunch.";
    } else {
      nextAction = "Restart coach, then relaunch.";
    }

    return {
      level: "B",
      headline: "Overlay data error",
      human_line: human,
      diagnosis,
      next_action: nextAction,
      block_id: null,
      block_name: "",
      cmd_id: null,
      source_event_id: null
    };
  }

  function shouldShowRelaunchButton({ env, payload } = {}) {
    return isAppleSilicon(env) && String(payload?.headline || "") === "Overlay data error";
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

  return {
    isTextInputTarget,
    // not exported but kept here for potential embedding contexts
    // isInteractiveTarget is intentionally not part of the public API
    // to avoid widening usage surface area.
    normalizeTwoMinuteStep,
    normalizeFreeform,
    safeParseJson,
    buildOverlayDataErrorPayload,
    shouldShowRelaunchButton,
    shouldTriggerBackOnTrackOnEnter,
    shouldShowSnoozeOnEscape,
    getOverlayHotkeyAction,
    isPauseShortcut,
    enterHintForState,
    labelForPayload,
    labelForOverlayState,
    // Platform helpers exported for main-process reliability guards.
    isAppleSilicon,
    shouldAutoRehydrateRenderer
  };
});

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.overlayUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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

  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (isTextInputTarget(target)) return true;
    // Treat buttons and links as interactive so Enter activates them,
    // not the global "Back on track" shortcut.
    if (tag === "button" || tag === "a") return true;
    return false;
  }

  function shouldTriggerBackOnTrackOnEnter({ target, mode, twoMinOpen } = {}) {
    if (mode === "align") return false;
    if (twoMinOpen) return false;
    return !isInteractiveTarget(target);
  }

  function isPauseShortcut(event) {
    if (!event) return false;
    const key = String(event.key || "").toLowerCase();
    const hasModifier = Boolean(event.metaKey || event.ctrlKey);
    return hasModifier && event.shiftKey && key === "p";
  }

  function enterHintForState({ mode, twoMinOpen } = {}) {
    // Highest priority: when the 2‑min panel is open, Enter should map to setting that step.
    // This avoids misleading hints even if other modes (e.g. align) are active.
    if (twoMinOpen) return "Enter: Set 2‑min step";
    if (mode === "align") return "Enter: Submit answer";
    return "Enter: Back on track";
  }

  function shouldShowSnoozeOnEscape({ target } = {}) {
    // If the user is typing into any text input, Esc should not pop the snooze panel.
    return !isTextInputTarget(target);
  }

  function getOverlayHotkeyAction(event, { overlayHidden = false, mode, twoMinOpen } = {}) {
    if (overlayHidden) return null;
    const key = event?.key;
    if (key === "Enter") {
      return shouldTriggerBackOnTrackOnEnter({ target: event?.target, mode, twoMinOpen })
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

  return {
    isTextInputTarget,
    // not exported but kept here for potential embedding contexts
    // isInteractiveTarget is intentionally not part of the public API
    // to avoid widening usage surface area.
    normalizeTwoMinuteStep,
    normalizeFreeform,
    shouldTriggerBackOnTrackOnEnter,
    shouldShowSnoozeOnEscape,
    getOverlayHotkeyAction,
    isPauseShortcut,
    enterHintForState,
    labelForPayload
  };
});

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

    // Prefer explicit indicators over tag name when available.
    if (target.isContentEditable) return true;

    const getAttr = typeof target.getAttribute === "function" ? target.getAttribute.bind(target) : null;
    if (getAttr) {
      const role = String(getAttr("role") || "").toLowerCase();
      if (role === "textbox") return true;

      const contentEditableAttr = getAttr("contenteditable");
      if (contentEditableAttr != null && String(contentEditableAttr).toLowerCase() !== "false") {
        return true;
      }
    }

    return tag === "input" || tag === "textarea" || tag === "select";
  }

  function isControlTarget(target) {
    if (!target) return false;

    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "button" || tag === "a") return true;

    const getAttr = typeof target.getAttribute === "function" ? target.getAttribute.bind(target) : null;
    if (getAttr) {
      const role = String(getAttr("role") || "").toLowerCase();
      if (role === "button" || role === "link") return true;

      if (tag === "input") {
        const type = String(getAttr("type") || "").toLowerCase();
        if (["button", "submit", "reset", "checkbox", "radio"].includes(type)) return true;
      }
    }

    return false;
  }

  function shouldTriggerBackOnTrackFromKeydown(event, activeElement) {
    if (!event) return false;

    if (event.key !== "Enter") return false;
    if (event.defaultPrevented) return false;
    if (event.isComposing) return false;
    // Avoid auto-repeat (holding Enter) accidentally confirming multiple times.
    if (event.repeat) return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

    // If Enter is being used to activate a focused control, let the control handle it
    // (avoids double-triggering via both keydown and click/default action).
    if (isControlTarget(event.target) || isControlTarget(activeElement)) return false;

    const isTypingTarget = isTextInputTarget(event.target) || isTextInputTarget(activeElement);
    return !isTypingTarget;
  }

  function shouldTriggerSnoozeFromKeydown(event, activeElement) {
    if (!event) return false;

    if (event.key !== "Escape") return false;
    if (event.defaultPrevented) return false;
    if (event.isComposing) return false;
    // Avoid auto-repeat (holding Escape) accidentally toggling multiple times.
    if (event.repeat) return false;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

    // Don't hijack Escape while the user is typing into an input.
    const isTypingTarget = isTextInputTarget(event.target) || isTextInputTarget(activeElement);
    if (isTypingTarget) return false;

    // If Escape is being used to interact with a focused control/dialog, let it handle it.
    if (isControlTarget(event.target) || isControlTarget(activeElement)) return false;

    return true;
  }

  function shouldTriggerDetailsToggleFromKeydown(event, activeElement) {
    if (!event) return false;

    // On most keyboards this is Shift+/ (event.key becomes '?').
    if (event.key !== "?") return false;
    if (event.defaultPrevented) return false;
    if (event.isComposing) return false;
    if (event.repeat) return false;

    // Don't hijack when a modifier combo is intended.
    if (event.metaKey || event.ctrlKey || event.altKey) return false;

    // If the user is typing, allow '?' to be entered normally.
    const isTypingTarget = isTextInputTarget(event.target) || isTextInputTarget(activeElement);
    if (isTypingTarget) return false;

    return true;
  }


  // Avoid accidental confirmation when the overlay steals focus mid-typing.
  // If the overlay has *just* shown, require a short dwell before a hotkey triggers.
  function shouldTriggerBackOnTrack(event, activeElement, shownAtMs, nowMs = Date.now()) {
    const safeKeydown = shouldTriggerBackOnTrackFromKeydown(event, activeElement);
    if (!safeKeydown) return false;

    const dwellMs = typeof shownAtMs === "number" ? nowMs - shownAtMs : null;
    if (dwellMs != null && dwellMs >= 0 && dwellMs < 450) return false;

    return true;
  }

  function shouldTriggerSnooze(event, activeElement, shownAtMs, nowMs = Date.now()) {
    const safeKeydown = shouldTriggerSnoozeFromKeydown(event, activeElement);
    if (!safeKeydown) return false;

    const dwellMs = typeof shownAtMs === "number" ? nowMs - shownAtMs : null;
    if (dwellMs != null && dwellMs >= 0 && dwellMs < 450) return false;

    return true;
  }

  // Global Enter hotkey should never confirm "Back on track" while in align mode.
  // This helper centralizes the mode gate so it can be unit tested.
  function shouldTriggerBackOnTrackInMode(mode, event, activeElement, shownAtMs, nowMs = Date.now()) {
    if (mode === "align") return false;
    return shouldTriggerBackOnTrack(event, activeElement, shownAtMs, nowMs);
  }

  function getHotkeyHints({ mode, activeElement, snoozeOpen, detailsAvailable } = {}) {
    const isTyping = isTextInputTarget(activeElement);

    // Prefer context-specific hints when the overlay is asking for input.
    let enterHint = mode === "align" || isTyping ? "Enter: Submit" : "Enter: Back on track";

    // When the snooze panel is open, Enter usually activates a focused reason button.
    // Make that explicit so the user doesn't think Enter will confirm the primary action.
    if (snoozeOpen && isControlTarget(activeElement)) {
      enterHint = "Enter: Select";
    }

    // Only show numeric hotkey hint when it's actually usable.
    // (In align mode we auto-focus the text box; while typing, numeric hotkeys are disabled.)
    const quickHint = mode === "align" && !snoozeOpen && !isTyping ? "1-9: Choose" : null;

    // Only show the details hint when it's actionable and won't interrupt typing.
    const detailsHint = detailsAvailable && !snoozeOpen && !isTyping ? "?: Details" : null;

    if (snoozeOpen) {
      return { enterHint, quickHint: null, detailsHint: null, escHint: "Esc: Close snooze" };
    }

    return { enterHint, quickHint, detailsHint, escHint: "Esc: Snooze" };
  }

  // Map a single keypress ("1".."9") to a zero-based choice index.
  // Returns null when the key isn't a valid choice selector.
  function choiceIndexFromKey(key) {
    if (typeof key !== "string" || key.length !== 1) return null;
    if (key < "1" || key > "9") return null;
    return Number(key) - 1;
  }

  function shouldTriggerChoiceFromKeydown(event, activeElement) {
    if (!event) return false;

    if (choiceIndexFromKey(event.key) == null) return false;
    if (event.defaultPrevented) return false;
    if (event.isComposing) return false;
    // Avoid auto-repeat (holding a number key) accidentally firing multiple times.
    if (event.repeat) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) return false;

    // Don't trigger choice hotkeys while the user is typing.
    const isTypingTarget = isTextInputTarget(event.target) || isTextInputTarget(activeElement);
    if (isTypingTarget) return false;

    return true;
  }

  function shouldTriggerAlignSubmitFromKeydown(event) {
    if (!event) return false;

    if (event.key !== "Enter") return false;
    if (event.defaultPrevented) return false;

    // Enter is commonly used to finish IME composition; don't treat that as submit.
    if (event.isComposing) return false;

    // Avoid auto-repeat (holding Enter) accidentally submitting multiple times.
    if (event.repeat) return false;

    // If the user is using a modified Enter (e.g. Cmd+Enter), don't hijack it.
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

    return true;
  }

  return {
    isTextInputTarget,
    isControlTarget,
    shouldTriggerBackOnTrackFromKeydown,
    shouldTriggerBackOnTrack,
    shouldTriggerBackOnTrackInMode,
    shouldTriggerSnoozeFromKeydown,
    shouldTriggerSnooze,
    shouldTriggerDetailsToggleFromKeydown,
    getHotkeyHints,
    choiceIndexFromKey,
    shouldTriggerChoiceFromKeydown,
    shouldTriggerAlignSubmitFromKeydown
  };
});

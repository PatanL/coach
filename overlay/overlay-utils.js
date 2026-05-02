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

  // Treat common interactive elements as "hands-off" for global hotkeys.
  // If focus is on a button/link, Enter should activate that control—not trigger a global overlay action.
  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "button" || tag === "a") return true;
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    return role === "button" || role === "link";
  }

  function findHotkeyRelevantTarget(target) {
    if (!target) return null;
    // If event.target is a child (e.g. <span> inside <button>), walk up to the nearest
    // element that should "own" the keyboard interaction.
    if (typeof target.closest === "function") {
      const hit = target.closest(
        'input,textarea,select,[contenteditable="true"],button,a,[role="button"],[role="link"]'
      );
      if (hit) return hit;
    }
    return target;
  }

  function shouldIgnoreGlobalEnter(target) {
    const t = findHotkeyRelevantTarget(target);
    return isTextInputTarget(t) || isInteractiveTarget(t);
  }

  function normalizeEventType(payload) {
    const raw = payload?.source_event_type || payload?.event_type || payload?.type || "";
    return String(raw).toUpperCase();
  }

  // DRIFT_PERSIST should feel "actionable". If the user is already off-task for a while,
  // default focus should land on the recovery action (not the quick-dismiss path).
  function shouldAutofocusRecover(payload, activeElement) {
    const eventType = normalizeEventType(payload);
    const hasChoices = Array.isArray(payload?.choices) && payload.choices.length > 0;
    if (hasChoices) return false;

    // Never steal focus from a typing surface outside the overlay.
    // (If focus is already within the overlay, it's safe to move it.)
    if (activeElement) {
      const isInsideOverlay = typeof activeElement.closest === "function" && !!activeElement.closest("#overlay");
      if (!isInsideOverlay && isTextInputTarget(activeElement)) return false;
    }

    return eventType === "DRIFT_PERSIST";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    normalizeEventType,
    shouldAutofocusRecover
  };
});

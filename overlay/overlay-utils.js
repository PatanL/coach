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

  function isPatternBreakEvent(eventType) {
    return String(eventType || "").toUpperCase() === "DRIFT_PERSIST";
  }

  function isTypingContext(eventTarget, activeElement) {
    return isTextInputTarget(eventTarget) || isTextInputTarget(activeElement);
  }

  function isButtonLikeTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "button") return true;
    if (tag === "a") return true;
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    return role === "button";
  }

  // When Enter is allowed, which "primary" action should it trigger?
  // DRIFT_PERSIST should bias toward a concrete recovery action.
  function primaryEnterAction(eventType) {
    return isPatternBreakEvent(eventType) ? "recover" : "back_on_track";
  }

  // Prevent accidental "Enter" confirms right as the overlay steals focus.
  // This is a tiny safety window to reduce unintended actions.
  function shouldTriggerBackOnTrack({ eventTarget, activeElement, sinceShownMs, minDelayMs = 400 }) {
    if (sinceShownMs != null && sinceShownMs < minDelayMs) return false;
    if (isTypingContext(eventTarget, activeElement)) return false;

    // If a button is focused, let the browser's default "press Enter to click" behavior win.
    // Otherwise we can double-fire: button click + global handler.
    if (isButtonLikeTarget(eventTarget) || isButtonLikeTarget(activeElement)) return false;

    return true;
  }

  return {
    isTextInputTarget,
    isPatternBreakEvent,
    isTypingContext,
    primaryEnterAction,
    shouldTriggerBackOnTrack,
    isButtonLikeTarget
  };
});

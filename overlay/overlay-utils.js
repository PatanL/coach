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

  // When Enter is allowed, which "primary" action should it trigger?
  // DRIFT_PERSIST should bias toward a concrete recovery action.
  function primaryEnterAction(eventType) {
    return isPatternBreakEvent(eventType) ? "recover" : "back_on_track";
  }

  // Prevent accidental "Enter" confirms right as the overlay steals focus.
  // This is a tiny safety window to reduce unintended actions.
  function shouldTriggerBackOnTrack({ eventTarget, activeElement, sinceShownMs, minDelayMs = 400 }) {
    if (sinceShownMs != null && sinceShownMs < minDelayMs) return false;
    return !isTypingContext(eventTarget, activeElement);
  }

  return {
    isTextInputTarget,
    isPatternBreakEvent,
    isTypingContext,
    primaryEnterAction,
    shouldTriggerBackOnTrack
  };
});

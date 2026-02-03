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

  // Avoid accidental confirmation when the overlay steals focus mid-typing.
  // If the overlay has *just* shown, require a short dwell before "Enter" triggers.
  function shouldTriggerBackOnTrack(event, activeElement, shownAtMs, nowMs = Date.now()) {
    const safeKeydown = shouldTriggerBackOnTrackFromKeydown(event, activeElement);
    if (!safeKeydown) return false;

    const dwellMs = typeof shownAtMs === "number" ? nowMs - shownAtMs : null;
    if (dwellMs != null && dwellMs >= 0 && dwellMs < 450) return false;

    return true;
  }

  return {
    isTextInputTarget,
    isControlTarget,
    shouldTriggerBackOnTrackFromKeydown,
    shouldTriggerBackOnTrack
  };
});

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

  function isNonActionableTarget(target) {
    if (!target) return true;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "body" || tag === "html") return true;
    // If focus falls back to the overlay container, treat it as non-actionable.
    if (String(target.id || "") === "overlay") return true;
    return false;
  }

  function shouldIgnoreGlobalEnter(target) {
    const t = findHotkeyRelevantTarget(target);
    return isNonActionableTarget(t) || isTextInputTarget(t) || isInteractiveTarget(t);
  }

  // Pure selection logic so we can unit test overlay focus behavior.
  // mode: "align" when the user must answer; default action buttons otherwise.
  function getInitialFocusId({ eventType, mode } = {}) {
    const t = String(eventType || "").toUpperCase();
    const m = String(mode || "").toLowerCase();
    if (m === "align") return "alignText";
    // DRIFT_PERSIST should feel like a clear escalation: bias focus toward recovery.
    if (t === "DRIFT_PERSIST") return "recoverBtn";
    return "backBtn";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    getInitialFocusId
  };
});

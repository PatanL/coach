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

  // Decide what action (if any) a global Enter press should trigger.
  // Returns an action string (e.g. "back_on_track", "recover") or null to do nothing.
  function getGlobalEnterAction({ eventType, mode, target } = {}) {
    if (shouldIgnoreGlobalEnter(target)) return null;
    const t = String(eventType || "").toUpperCase();
    const m = String(mode || "").toLowerCase();

    // In "align" mode we never want global Enter to accidentally confirm an action.
    if (m === "align") return null;

    // Pattern-break: DRIFT_PERSIST Enter should bias to recovery, not dismissal.
    if (t === "DRIFT_PERSIST") return "recover";

    return "back_on_track";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    getGlobalEnterAction
  };
});

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

  function normalizeEventType(raw) {
    return String(raw || "").trim().toUpperCase();
  }

  // Centralize focus rules so overlay.js stays dumb and we can unit test the behavior.
  // Returns one of: "alignText" | "recoverBtn" | "backBtn".
  function getPreferredInitialFocus({ eventType, mode } = {}) {
    const t = normalizeEventType(eventType);
    if (mode === "align") return "alignText";
    if (t === "DRIFT_PERSIST") return "recoverBtn";
    return "backBtn";
  }

  // Decide what the global Enter key should do when not focused in an interactive control.
  // Returns an overlay action string, e.g. "recover" | "back_on_track".
  function getPrimaryEnterAction({ eventType, mode } = {}) {
    const t = normalizeEventType(eventType);
    // In align mode, Enter should prefer submitting the answer rather than dismissing the overlay.
    // overlay.js will route this to alignSubmit.click(), which is a no-op if the input is empty.
    if (mode === "align") return "align_submit";
    if (t === "DRIFT_PERSIST") return "recover";
    return "back_on_track";
  }

  function getEnterHintText({ eventType, mode } = {}) {
    const t = normalizeEventType(eventType);
    if (mode === "align") return "Enter: Submit";
    if (t === "DRIFT_PERSIST") return "Enter: Recover schedule";
    return "Enter: Back on track";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    normalizeEventType,
    getPreferredInitialFocus,
    getPrimaryEnterAction,
    getEnterHintText
  };
});

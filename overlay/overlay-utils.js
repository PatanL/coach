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

  // We should NOT treat Enter as a global default action when the user is already
  // interacting with a control that has its own Enter semantics (e.g. <button>).
  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "button" || tag === "a") return true;
    // If it's a text input, it's also interactive.
    if (isTextInputTarget(target)) return true;
    return false;
  }

  // Map the global Enter key to a safe "default" action.
  // Returns null when Enter should do nothing.
  function getEnterAction({ eventType, mode } = {}) {
    const normalizedType = eventType ? String(eventType) : "";
    const normalizedMode = mode ? String(mode) : "";

    // While aligning (choices / freeform input), Enter is handled by the input itself.
    if (normalizedMode === "align") return null;

    // Persistent drift needs a stronger pattern-break: Enter should push recovery,
    // not accidentally "mark it done".
    if (normalizedType === "DRIFT_PERSIST") return "recover";

    return "back_on_track";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    getEnterAction
  };
});

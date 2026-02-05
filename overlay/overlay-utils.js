(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.overlayUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isTextInputTarget(target) {
    if (!target) return false;

    // In real DOM events, `isContentEditable` is true for descendants of a
    // contenteditable region too. (So this catches the common "typing" cases.)
    if (target.isContentEditable) return true;

    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;

    // Support for ARIA textbox widgets (common in rich editors).
    const role = String(target.getAttribute?.("role") || target.role || "").toLowerCase();
    if (role === "textbox") return true;

    return false;
  }

  // Returns true when it's safe for the overlay to interpret global hotkeys
  // (e.g. Enter => back_on_track, Escape => snooze menu) without stealing input.
  function shouldHandleGlobalHotkey(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    return !isTextInputTarget(target);
  }

  return {
    isTextInputTarget,
    shouldHandleGlobalHotkey
  };
});

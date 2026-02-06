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

  // Used to suppress global hotkeys when the user is interacting with controls.
  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (isTextInputTarget(target)) return true;
    if (tag === "button" || tag === "a") return true;
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    return role === "button" || role === "link";
  }

  return {
    isTextInputTarget,
    isInteractiveTarget
  };
});

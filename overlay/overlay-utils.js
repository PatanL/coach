(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.overlayUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isTextInputTarget(target) {
    if (!target) return false;

    // Support both DOM nodes and test doubles.
    const tag = String(target.tagName || "").toLowerCase();
    const role = String(
      (typeof target.getAttribute === "function" && target.getAttribute("role")) || target.role || ""
    ).toLowerCase();

    if (target.isContentEditable) return true;
    if (role === "textbox") return true;

    if (tag === "textarea" || tag === "select") return true;

    if (tag === "input") {
      const type = String(target.type || "text").toLowerCase();
      // Treat non-typing inputs as not typing targets so hotkeys remain safe.
      const nonTyping = new Set([
        "button",
        "checkbox",
        "color",
        "file",
        "hidden",
        "image",
        "radio",
        "range",
        "reset",
        "submit"
      ]);
      return !nonTyping.has(type);
    }

    return false;
  }

  return {
    isTextInputTarget
  };
});

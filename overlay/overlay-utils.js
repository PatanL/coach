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
    const role = String(
      (typeof target.getAttribute === "function" && target.getAttribute("role")) ||
        target.role ||
        ""
    ).toLowerCase();
    if (target.isContentEditable) return true;
    if (role === "textbox") return true;
    if (tag === "textarea" || tag === "select") return true;
    if (tag !== "input") return false;

    // Only treat actual typing inputs as "text input targets".
    // (Avoid disabling global hotkeys for e.g. checkboxes and buttons.)
    const type = String(target.type || "text").toLowerCase();
    const nonTextTypes = new Set([
      "button",
      "submit",
      "reset",
      "checkbox",
      "radio",
      "range",
      "file",
      "color",
      "image",
      "hidden"
    ]);
    return !nonTextTypes.has(type);
  }

  return {
    isTextInputTarget
  };
});

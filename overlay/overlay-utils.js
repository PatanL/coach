(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.overlayUtils = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isTextInputTarget(target) {
    if (!target) return false;

    // Contenteditable can bubble keydown from nested spans, so check ancestors too.
    if (target.isContentEditable) return true;
    if (typeof target.closest === "function") {
      const editableAncestor = target.closest('[contenteditable="true"], [role="textbox"]');
      if (editableAncestor) return true;
    }

    const tag = String(target.tagName || "").toLowerCase();
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    if (role === "textbox") return true;

    return tag === "input" || tag === "textarea" || tag === "select";
  }

  return {
    isTextInputTarget
  };
});

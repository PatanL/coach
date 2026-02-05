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

    // contentEditable can show up as boolean or string attribute depending on context.
    if (target.isContentEditable) return true;
    if (typeof target.getAttribute === "function") {
      const ce = target.getAttribute("contenteditable");
      if (ce && String(ce).toLowerCase() !== "false") return true;

      // Some UI libs implement text entry via ARIA roles.
      const role = target.getAttribute("role");
      if (role && String(role).toLowerCase() === "textbox") return true;
    }

    return tag === "input" || tag === "textarea" || tag === "select";
  }

  // For global hotkeys, `event.target` is not always the element the user is typing into.
  // Prefer `document.activeElement` when provided.
  function isTypingContext({ eventTarget, activeElement } = {}) {
    return isTextInputTarget(activeElement || eventTarget);
  }

  return {
    isTextInputTarget,
    isTypingContext
  };
});

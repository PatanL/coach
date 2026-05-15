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

    // contenteditable can be: element.isContentEditable=true, or attribute present ("", "true").
    if (target.isContentEditable) return true;
    const contentEditableAttr = target.getAttribute?.("contenteditable");
    if (contentEditableAttr !== undefined && contentEditableAttr !== null && String(contentEditableAttr) !== "false") {
      return true;
    }

    // ARIA textbox/combobox commonly used by custom inputs.
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    if (role === "textbox" || role === "combobox" || role === "searchbox") return true;

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
        'input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"],[role="searchbox"],button,a,[role="button"],[role="link"]'
      );
      if (hit) return hit;
    }
    return target;
  }

  function shouldIgnoreGlobalEnter(target) {
    const t = findHotkeyRelevantTarget(target);
    return isTextInputTarget(t) || isInteractiveTarget(t);
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter
  };
});

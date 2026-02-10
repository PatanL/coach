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

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter
  };
});

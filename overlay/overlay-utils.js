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

  function isWithinRoot(target, root) {
    if (!target || !root) return false;
    if (target === root) return true;
    if (typeof target.closest === "function" && root.id) {
      // If the root has an id, use it for a stable closest() selector.
      const hit = target.closest(`#${root.id}`);
      return Boolean(hit);
    }
    return false;
  }

  // Options:
  // - modalRoot: Element
  // - modalVisible: boolean
  // If a modal is visible, global Enter should be ignored unless the event target is within the modal.
  function shouldIgnoreGlobalEnter(target, options = null) {
    const t = findHotkeyRelevantTarget(target);
    const modalVisible = Boolean(options?.modalVisible);
    const modalRoot = options?.modalRoot || null;
    if (modalVisible) {
      return !isWithinRoot(t, modalRoot);
    }
    return isTextInputTarget(t) || isInteractiveTarget(t);
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    isWithinRoot
  };
});

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

  function shouldIgnoreGlobalEnter(target) {
    const t = findHotkeyRelevantTarget(target);
    return isTextInputTarget(t) || isInteractiveTarget(t);
  }

  // When an in-overlay panel is open (e.g. Snooze reason), treat global Enter as unsafe.
  // This avoids accidental "Back on track" confirmations while the user is deciding.
  function hasOpenOverlayPanel(overlayRoot) {
    if (!overlayRoot || typeof overlayRoot.querySelector !== "function") return false;
    return !!overlayRoot.querySelector(".snooze:not(.hidden), .align-input:not(.hidden)");
  }

  function shouldIgnoreGlobalEnterWithOverlay(target, overlayRoot) {
    return shouldIgnoreGlobalEnter(target) || hasOpenOverlayPanel(overlayRoot);
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    hasOpenOverlayPanel,
    shouldIgnoreGlobalEnterWithOverlay
  };
});

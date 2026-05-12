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

  // Only allow the global Enter hotkey when the event is coming from a "neutral" surface.
  // This avoids accidental confirmations when focus is on an arbitrary element.
  //
  // We treat the overlay chrome itself as neutral (e.g., a click on the card background),
  // so Enter still works even if focus/target is a non-interactive div inside the overlay.
  function isNeutralHotkeySurface(target) {
    if (!target) return true;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "body" || tag === "html") return true;

    // If the event is originating from inside the overlay container, allow global Enter.
    // Interactive targets are still blocked by shouldIgnoreGlobalEnter().
    if (typeof target.closest === "function") {
      const inOverlay = target.closest("#overlay");
      if (inOverlay) return true;
    }

    // Fallback for simple mock objects / non-DOM targets.
    const id = String(target.id || "");
    return id === "overlay";
  }

  function shouldTriggerGlobalEnter(target) {
    return !shouldIgnoreGlobalEnter(target) && isNeutralHotkeySurface(target);
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalEnter,
    shouldTriggerGlobalEnter
  };
});

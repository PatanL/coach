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

  // Used to avoid global hotkeys firing while the user is interacting with a UI control.
  // Example: pressing Enter on a focused <button> should not also trigger the global
  // "Back on track" action.
  function isInteractiveControlTarget(target) {
    if (!target) return false;

    if (typeof target.closest === "function") {
      const controlAncestor = target.closest("button, [role='button'], a");
      if (controlAncestor) return true;
    }

    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    if (role === "button") return true;

    const tag = String(target.tagName || "").toLowerCase();
    return tag === "button" || tag === "a";
  }

  function shouldTriggerBackOnTrackOnEnter({ eventType, nowMs, lastEnterMs }) {
    const type = String(eventType || "");
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const last = Number.isFinite(lastEnterMs) ? lastEnterMs : 0;

    // For DRIFT_PERSIST, require a deliberate double-press to avoid accidental recovery.
    // This creates a small visual+interaction pattern-break without adding motion.
    if (type === "DRIFT_PERSIST") {
      const windowMs = 1200;
      if (last && now - last <= windowMs) {
        return { trigger: true, nextLastEnterMs: 0 };
      }
      return { trigger: false, nextLastEnterMs: now };
    }

    return { trigger: true, nextLastEnterMs: 0 };
  }

  return {
    isTextInputTarget,
    isInteractiveControlTarget,
    shouldTriggerBackOnTrackOnEnter
  };
});

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

  /**
   * Determines whether the overlay should treat Enter as an implicit "Back on track".
   *
   * Safety rules:
   * - Never while typing in a text input.
   * - Never in align mode (choices / freeform answer use Enter for submit).
   * - Never while the snooze reason picker is open.
   */
  function shouldImplicitEnterTriggerBackOnTrack({ target, overlayHidden, mode, snoozeVisible }) {
    if (overlayHidden) return false;
    if (mode === "align") return false;
    if (snoozeVisible) return false;
    if (isTextInputTarget(target)) return false;
    return true;
  }

  /**
   * Determines whether Escape should toggle the snooze panel.
   *
   * Safety rules:
   * - Only when overlay is visible.
   * - Never while typing in a text input.
   * - Never in align mode (Escape should not accidentally hide/interrupt the prompt).
   */
  function shouldEscapeToggleSnooze({ target, overlayHidden, mode }) {
    if (overlayHidden) return false;
    if (mode === "align") return false;
    if (isTextInputTarget(target)) return false;
    return true;
  }

  return {
    isTextInputTarget,
    shouldImplicitEnterTriggerBackOnTrack,
    shouldEscapeToggleSnooze
  };
});

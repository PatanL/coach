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

    if (tag === "input" || tag === "textarea" || tag === "select") return true;

    // Some UIs use non-input elements with ARIA roles for text entry.
    const role = String(target.getAttribute?.("role") || "").toLowerCase();
    if (role === "textbox" || role === "combobox") return true;

    return false;
  }

  /**
   * Determines whether the overlay should treat Enter as an implicit "Back on track".
   *
   * Safety rules:
   * - Never while typing in a text input.
   * - Never in align mode (choices / freeform answer use Enter for submit).
   * - Never while the snooze picker is visible.
   */
  function shouldImplicitEnterTriggerBackOnTrack({
    target,
    overlayHidden,
    mode,
    snoozeVisible,
  }) {
    if (overlayHidden) return false;
    if (mode === "align") return false;
    if (snoozeVisible) return false;
    if (isTextInputTarget(target)) return false;
    return true;
  }

  /**
   * Determines whether Escape should toggle the snooze picker.
   *
   * Safety rules:
   * - Never while typing.
   * - Never when the overlay is hidden.
   * - Never in align mode (Escape may be used to cancel text entry / dialog semantics).
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
    shouldEscapeToggleSnooze,
  };
});

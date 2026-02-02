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

  function normalizeTwoMinuteStep(value, opts = {}) {
    const maxLen = Number.isFinite(opts.maxLen) ? opts.maxLen : 160;
    const str = String(value || "").replace(/\s+/g, " ").trim();
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen).trimEnd() : str;
  }

  function normalizeFreeform(value, opts = {}) {
    const maxLen = Number.isFinite(opts.maxLen) ? opts.maxLen : 240;
    const str = String(value || "").replace(/\s+/g, " ").trim();
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen).trimEnd() : str;
  }

  function shouldTriggerBackOnTrackOnEnter({ target, mode, twoMinOpen } = {}) {
    if (mode === "align") return false;
    if (twoMinOpen) return false;
    return !isTextInputTarget(target);
  }

  function isPauseShortcut(event) {
    if (!event) return false;
    const key = String(event.key || "").toLowerCase();
    const hasModifier = Boolean(event.metaKey || event.ctrlKey);
    return hasModifier && event.shiftKey && key === "p";
  }

  return {
    isTextInputTarget,
    normalizeTwoMinuteStep,
    normalizeFreeform,
    shouldTriggerBackOnTrackOnEnter,
    isPauseShortcut
  };
});

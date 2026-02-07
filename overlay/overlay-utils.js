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

  function getEventVariant(eventType) {
    const type = String(eventType || "");
    const isPersist = type === "DRIFT_PERSIST";
    return {
      eventType: type,
      label: isPersist ? "DRIFT — AGAIN" : "DRIFT",
      patternBreak: isPersist,
    };
  }

  return {
    isTextInputTarget,
    getEventVariant,
  };
});

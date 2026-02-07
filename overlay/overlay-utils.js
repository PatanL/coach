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

  function isInteractiveTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "button") return true;
    if (tag === "a") return true;

    if (tag === "input") {
      const type = String(target.type || "").toLowerCase();
      // Inputs that aren't primarily "typing" still often use Enter/Space and should not
      // trigger global overlay hotkeys.
      return ["button", "submit", "checkbox", "radio", "range", "file"].includes(type);
    }

    return false;
  }

  function shouldIgnoreGlobalHotkeys(event) {
    if (!event) return false;
    if (event.defaultPrevented) return true;
    const target = event.target;
    return isTextInputTarget(target) || isInteractiveTarget(target);
  }

  return {
    isTextInputTarget,
    isInteractiveTarget,
    shouldIgnoreGlobalHotkeys
  };
});

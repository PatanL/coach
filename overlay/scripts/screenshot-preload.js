// Minimal preload for deterministic overlay screenshots.
// Provides the same window.overlayAPI surface that overlay.js expects.

function makeOverlayAPI() {
  let onShowHandler = null;

  return {
    onShow(cb) {
      onShowHandler = cb;
    },
    onPause() {
      // no-op for screenshots
    },
    sendAction() {
      // no-op for screenshots
    },
    _triggerShow(payload) {
      if (typeof onShowHandler === "function") onShowHandler(payload);
    }
  };
}

window.overlayAPI = makeOverlayAPI();
window.__overlayScreenshot = {
  show(payload) {
    window.overlayAPI._triggerShow(payload);
  }
};

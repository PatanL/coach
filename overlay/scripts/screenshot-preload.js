// Preload for deterministic screenshot capture.
// Runs with contextIsolation=false in the screenshot harness.

window.__overlayScreenshot = {
  show(payload) {
    if (typeof window.__overlayShow === "function") {
      window.__overlayShow(payload);
    }
  }
};

const { contextBridge } = require("electron");

function parsePayload() {
  const raw = process.env.OVERLAY_SCREENSHOT_PAYLOAD || "{}";
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

const payload = parsePayload();

contextBridge.exposeInMainWorld("overlayAPI", {
  onShow: (handler) => {
    // Fire once, deterministically, on next tick.
    setTimeout(() => handler(payload), 0);
  },
  onPause: () => {},
  sendAction: () => {}
});

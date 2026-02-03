const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  onShow: (handler) => ipcRenderer.on("overlay:show", (event, payload) => handler(payload)),
  onPause: (handler) => ipcRenderer.on("overlay:pause", () => handler()),
  onAck: (handler) => ipcRenderer.on("overlay:ack", (_event, payload) => handler(payload)),
  sendAction: (action) => ipcRenderer.send("overlay:action", action),
  // Fire-and-forget UI telemetry for low-friction diagnostics.
  logUIEvent: (name, meta) => {
    try {
      ipcRenderer.send("overlay:ui_event", { name: String(name || ""), meta: meta || null });
    } catch (_e) {
      // Best-effort only; never throw into renderer.
    }
  },
  // Minimal diagnostics helpers for actionable recovery on Apple Silicon.
  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    versions: { ...process.versions }
  }),
  copyText: (text) => {
    try {
      clipboard.writeText(String(text ?? ""));
      return true;
    } catch (e) {
      return false;
    }
  },
  relaunchOverlay: () => {
    try {
      ipcRenderer.send("overlay:relaunch", { source: "renderer_button" });
      return true;
    } catch (e) {
      return false;
    }
  }
});

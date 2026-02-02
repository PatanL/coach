const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  onShow: (handler) => ipcRenderer.on("overlay:show", (event, payload) => handler(payload)),
  onPause: (handler) => ipcRenderer.on("overlay:pause", () => handler()),
  sendAction: (action) => ipcRenderer.send("overlay:action", action)
});

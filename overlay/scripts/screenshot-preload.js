const { contextBridge } = require("electron");

let onShowHandler = null;
let onPauseHandler = null;

contextBridge.exposeInMainWorld("overlayAPI", {
  onShow: (handler) => {
    onShowHandler = handler;
  },
  onPause: (handler) => {
    onPauseHandler = handler;
  },
  sendAction: () => {},
});

contextBridge.exposeInMainWorld("__screenshotHarness", {
  triggerShow: (payload) => {
    if (onShowHandler) onShowHandler(payload);
  },
  triggerPause: (payload) => {
    if (onPauseHandler) onPauseHandler(payload);
  },
});

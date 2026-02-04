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
  // Test/screenshot-only hook.
  __triggerShow: (payload) => {
    if (typeof onShowHandler === "function") onShowHandler(payload);
  },
  __triggerPause: () => {
    if (typeof onPauseHandler === "function") onPauseHandler();
  }
});

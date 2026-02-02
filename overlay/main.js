const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

const LOG_DIR = path.join(__dirname, "..", "logs");
const OVERLAY_BASE = path.join(LOG_DIR, "overlay_cmd.ndjson");
const ACTIONS_BASE = path.join(LOG_DIR, "overlay_actions.ndjson");

function logPathForToday(basePath) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const stamp = `${year}-${month}-${day}`;
  const ext = path.extname(basePath);
  const stem = basePath.slice(0, -ext.length);
  return `${stem}_${stamp}${ext}`;
}

const OVERLAY_PATH = logPathForToday(OVERLAY_BASE);
const ACTIONS_PATH = logPathForToday(ACTIONS_BASE);
const TRAY_ICON = path.join(__dirname, "..", "..", "readthistext.png");

let overlayWindow = null;
let tray = null;
let currentPayload = null;
let lastCmdId = null;

const OVERLAY_SIZE = { width: 640, height: 360 };
const BANNER_SIZE = { width: 360, height: 140 };

function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }
}

function appendAction(action) {
  ensureFile(ACTIONS_PATH);
  fs.appendFileSync(ACTIONS_PATH, JSON.stringify(action) + "\n", "utf8");
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_SIZE.width,
    height: OVERLAY_SIZE.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreenable: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.on("blur", () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.focus();
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
}

function positionOverlay(level) {
  if (!overlayWindow) return;
  if (level === "A") {
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const bounds = display.workArea;
    overlayWindow.setSize(BANNER_SIZE.width, BANNER_SIZE.height, false);
    const x = Math.round(bounds.x + bounds.width - BANNER_SIZE.width - 20);
    const y = Math.round(bounds.y + 24);
    overlayWindow.setPosition(x, y, false);
  } else {
    const display = screen.getPrimaryDisplay();
    const bounds = display.workArea;
    overlayWindow.setSize(OVERLAY_SIZE.width, OVERLAY_SIZE.height, false);
    const x = Math.round(bounds.x + (bounds.width - OVERLAY_SIZE.width) / 2);
    const y = Math.round(bounds.y + (bounds.height - OVERLAY_SIZE.height) / 2);
    overlayWindow.setPosition(x, y, false);
  }
}

function showOverlay(payload) {
  if (!overlayWindow) return;
  currentPayload = payload;
  lastCmdId = payload.cmd_id || null;
  positionOverlay(payload.level);
  overlayWindow.show();
  overlayWindow.focus();
  overlayWindow.webContents.send("overlay:show", payload);
  const now = new Date().toISOString();
  appendAction({
    ts: now,
    type: "OVERLAY_SHOWN",
    cmd_id: lastCmdId,
    source_event_id: payload.source_event_id || null,
    level: payload.level || "B",
    action: "shown",
    source: "overlay"
  });
}

function hideOverlay() {
  if (!overlayWindow) return;
  overlayWindow.hide();
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+P", () => {
    const now = new Date().toISOString();
    appendAction({ ts: now, action: "pause_15", time_to_action_ms: 0, level: currentPayload?.level || "A" });
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayWindow.webContents.send("overlay:pause", {});
      hideOverlay();
    }
  });
}

function createTray() {
  if (!fs.existsSync(TRAY_ICON)) return;
  const image = nativeImage.createFromPath(TRAY_ICON);
  tray = new Tray(image);
  const menu = Menu.buildFromTemplate([
    { label: "Pause 15 minutes", click: () => {
      const now = new Date().toISOString();
      appendAction({ ts: now, action: "pause_15", time_to_action_ms: 0, level: currentPayload?.level || "A" });
    } },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);
  tray.setToolTip("Coach Overlay");
  tray.setContextMenu(menu);
}

function watchOverlayCommands() {
  ensureFile(OVERLAY_PATH);
  let lastSize = fs.existsSync(OVERLAY_PATH) ? fs.statSync(OVERLAY_PATH).size : 0;
  if (lastSize > 0) {
    try {
      fs.truncateSync(OVERLAY_PATH, 0);
      lastSize = 0;
    } catch (err) {
      lastSize = 0;
    }
  }
  fs.watchFile(OVERLAY_PATH, { interval: 500 }, () => {
    try {
      const stats = fs.statSync(OVERLAY_PATH);
      if (stats.size < lastSize) {
        lastSize = 0;
      }
      if (stats.size === lastSize) return;
      const stream = fs.createReadStream(OVERLAY_PATH, {
        start: lastSize,
        end: stats.size
      });
      let data = "";
      stream.on("data", (chunk) => {
        data += chunk.toString();
      });
      stream.on("end", () => {
        lastSize = stats.size;
        const lines = data.split("\n").filter(Boolean);
        for (const line of lines) {
          try {
            const payload = JSON.parse(line);
            showOverlay(payload);
          } catch (err) {
            // ignore malformed lines
          }
        }
        if (lastSize > 0) {
          try {
            fs.truncateSync(OVERLAY_PATH, 0);
            lastSize = 0;
          } catch (err) {
            // ignore
          }
        }
      });
    } catch (err) {
      // ignore
    }
  });
}

ipcMain.on("overlay:action", (event, action) => {
  const now = new Date().toISOString();
  appendAction({
    ts: now,
    type: "OVERLAY_ACTION",
    cmd_id: lastCmdId,
    source_event_id: currentPayload?.source_event_id || null,
    ...action,
    level: currentPayload?.level || "A",
    block_id: currentPayload?.block_id || null,
    source: "overlay"
  });
  if (action.action !== "pause_15") {
    hideOverlay();
  }
});

app.whenReady().then(() => {
  ensureFile(OVERLAY_PATH);
  ensureFile(ACTIONS_PATH);
  createOverlayWindow();
  registerShortcuts();
  createTray();
  watchOverlayCommands();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const overlayUtils = require("./overlay-utils");

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

// Exposed for renderer-triggered recovery actions (e.g. manual relaunch button).
let rehydrateRendererFn = null;

// Apple Silicon reliability guard: transparent always-on-top windows can lose
// their renderer after GPU handoffs. We auto-rehydrate, but must avoid getting
// stuck in a rapid reload loop if something is fundamentally broken.
let lastRehydrateAt = 0;
let rehydrateCount = 0;
const REHYDRATE_WINDOW_MS = 30_000;
const REHYDRATE_MAX_PER_WINDOW = 3;

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

  // On Apple Silicon, transparent overlays can occasionally lose their renderer
  // after GPU handoffs. When that happens, auto-rehydrate by reloading and
  // re-sending the last payload so recovery steps remain actionable.
  function rehydrateRenderer(reason, { force = false } = {}) {
    if (!force && !overlayUtils.shouldAutoRehydrateRenderer({ platform: process.platform, arch: process.arch })) return;

    const nowMs = Date.now();
    if (nowMs - lastRehydrateAt > REHYDRATE_WINDOW_MS) {
      rehydrateCount = 0;
    }
    lastRehydrateAt = nowMs;
    rehydrateCount += 1;

    if (rehydrateCount > REHYDRATE_MAX_PER_WINDOW) {
      appendAction({
        ts: new Date().toISOString(),
        type: "OVERLAY_REHYDRATE_THROTTLED",
        reason: reason || null,
        platform: process.platform,
        arch: process.arch,
        window_ms: REHYDRATE_WINDOW_MS,
        max_per_window: REHYDRATE_MAX_PER_WINDOW
      });

      // If we are stuck rehydrating, surface an actionable recovery overlay so the
      // user can manually relaunch (especially important on Apple Silicon).
      try {
        showOverlay(
          overlayUtils.buildOverlayRendererRecoveryPayload({
            reason,
            env: { platform: process.platform, arch: process.arch }
          })
        );
      } catch (_e) {
        // ignore
      }
      return;
    }

    const wasVisible = Boolean(
      overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()
    );

    const now = new Date().toISOString();
    appendAction({
      ts: now,
      type: "OVERLAY_REHYDRATE",
      reason: reason || null,
      platform: process.platform,
      arch: process.arch,
      was_visible: wasVisible
    });

    try {
      if (!overlayWindow || overlayWindow.isDestroyed()) {
        createOverlayWindow();
      } else {
        overlayWindow.reload();
      }

      overlayWindow.webContents.once("did-finish-load", () => {
        try {
          if (currentPayload) {
            overlayWindow.webContents.send("overlay:show", currentPayload);
          }
          // Preserve prior visibility so rehydration doesn't cause the overlay
          // to unexpectedly pop up if it was hidden.
          // Also re-apply size/position derived from the payload level so the
          // overlay keeps its intended placement (e.g., A-banner vs centered)
          // after a reload or window recreation.
          try {
            if (currentPayload && currentPayload.level) {
              positionOverlay(currentPayload.level);
            }
          } catch (_posErr) {
            // ignore positioning errors
          }
          if (wasVisible) {
            overlayWindow.show();
            overlayWindow.focus();
          } else {
            overlayWindow.hide();
          }
        } catch (err) {
          // ignore post-rehydrate errors
        }
      });
    } catch (err) {
      // ignore reload errors
    }
  }

  // Allow renderer/UI to request a relaunch (e.g. actionable recovery overlay).
  rehydrateRendererFn = (reason, opts) => rehydrateRenderer(reason, opts);

  overlayWindow.webContents.on("render-process-gone", (_event, details) => {
    rehydrateRenderer(details?.reason);
  });

  overlayWindow.on("unresponsive", () => {
    rehydrateRenderer("unresponsive");
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

function emitPause15({ source } = {}) {
  const now = new Date().toISOString();

  // When the overlay is visible, route through the renderer so we get:
  // - consistent UI feedback (busy state)
  // - exactly one action log entry (via ipcMain overlay:action)
  if (overlayWindow && overlayWindow.isVisible()) {
    try {
      overlayWindow.webContents.send("overlay:pause", {});
      hideOverlay();
      return;
    } catch (_err) {
      // fall through
    }
  }

  // If the overlay is hidden/unavailable, log the action directly.
  appendAction({
    ts: now,
    type: "OVERLAY_ACTION",
    cmd_id: lastCmdId,
    source_event_id: currentPayload?.source_event_id || null,
    action: "pause_15",
    minutes: 15,
    time_to_action_ms: 0,
    level: currentPayload?.level || "B",
    block_id: currentPayload?.block_id || null,
    source: source || "overlay"
  });
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+Shift+P", () => {
    emitPause15({ source: "overlay_shortcut" });
  });
}

function createTray() {
  if (!fs.existsSync(TRAY_ICON)) return;
  const image = nativeImage.createFromPath(TRAY_ICON);
  tray = new Tray(image);
  const menu = Menu.buildFromTemplate([
    { label: "Pause 15 minutes", click: () => emitPause15({ source: "overlay_tray" }) },
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
        // `end` is inclusive; stats.size is an offset *past* the last byte.
        end: Math.max(lastSize, stats.size - 1)
      });
      let data = "";
      stream.on("data", (chunk) => {
        data += chunk.toString();
      });
      stream.on("end", () => {
        lastSize = stats.size;
        // Be tolerant of whitespace (some writers may append spaces).
        const lines = data
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        for (const line of lines) {
          try {
            const payload = JSON.parse(line);
            showOverlay(payload);
          } catch (err) {
            const now = new Date().toISOString();
            appendAction({
              ts: now,
              type: "OVERLAY_CMD_PARSE_ERROR",
              error: err && err.message ? String(err.message) : String(err),
              raw: String(line || "").slice(0, 400),
              platform: process.platform,
              arch: process.arch
            });
            try {
              showOverlay(
                overlayUtils.buildOverlayDataErrorPayload({
                  error: err && err.message ? String(err.message) : String(err),
                  rawLine: line,
                  env: { platform: process.platform, arch: process.arch }
                })
              );
            } catch (_e) {
              // ignore
            }
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
    level: currentPayload?.level || "B",
    block_id: currentPayload?.block_id || null,
    source: "overlay"
  });
  // Best-effort ack so the renderer can safely clear retry timers.
  try {
    event?.sender?.send("overlay:ack", { id: action?.action_id || null });
  } catch (_e) {
    // ignore ack errors
  }
  // Pause actions should also dismiss the overlay so the user can get back to work.
  hideOverlay();
});

ipcMain.on("overlay:relaunch", (_event, meta) => {
  const now = new Date().toISOString();
  appendAction({
    ts: now,
    type: "OVERLAY_RELAUNCH_REQUESTED",
    source: meta?.source || "renderer",
    cmd_id: lastCmdId,
    platform: process.platform,
    arch: process.arch
  });
  try {
    if (typeof rehydrateRendererFn === "function") {
      rehydrateRendererFn("manual_relaunch", { force: true });
    } else if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.reload();
    }
  } catch (_e) {
    // ignore
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

// Lightweight UI telemetry from the renderer for reliability analysis.
ipcMain.on("overlay:ui_event", (_event, { name, meta }) => {
  const now = new Date().toISOString();
  appendAction({
    ts: now,
    type: "OVERLAY_UI",
    name: String(name || ""),
    meta: meta || null,
    cmd_id: lastCmdId,
    source_event_id: currentPayload?.source_event_id || null,
    platform: process.platform,
    arch: process.arch,
    source: "overlay"
  });
});

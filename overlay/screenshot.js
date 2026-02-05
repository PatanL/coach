const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");
const OVERLAY_HTML = path.join(__dirname, "overlay.html");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture(win, fileName) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, fileName), image.toPNG());
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
    },
  });

  try {
    await win.loadFile(OVERLAY_HTML);

    const basePayload = {
      ts: new Date().toISOString(),
      cmd_id: "screenshot-cmd",
      source_event_id: "screenshot-event",
      source: "screenshot",
      level: "B",
      style_id: "strict",
      headline: "Reset.",
      human_line: "You drifted off the current block.",
      diagnosis: "Resume the scheduled task.",
      next_action: "Return to the planned work block now.",
      block_id: "block-123",
      block_name: "Deep Work",
    };

    // DRIFT_START (baseline)
    win.webContents.send("overlay:show", {
      ...basePayload,
      event_type: "DRIFT_START",
      headline: "Drift detected",
    });
    await sleep(250);
    await capture(win, "drift-start.png");

    // DRIFT_PERSIST (pattern-break)
    win.webContents.send("overlay:show", {
      ...basePayload,
      event_type: "DRIFT_PERSIST",
      headline: "Drift persists",
    });
    await sleep(250);
    await capture(win, "drift-persist.png");
  } catch (err) {
    console.error("screenshot:error", err);
    process.exitCode = 1;
  } finally {
    win.destroy();
    app.quit();
  }
});

const path = require("path");
const fs = require("fs");
const { app, BrowserWindow } = require("electron");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function basePayload(overrides = {}) {
  return {
    ts: new Date(0).toISOString(),
    cmd_id: "00000000-0000-0000-0000-000000000000",
    source_event_id: "00000000-0000-0000-0000-000000000000",
    event_type: "DRIFT_START",
    source: "screenshot",
    level: "B",
    style_id: "calm",
    headline: "Reset.",
    human_line: "You drifted off the planned task.",
    diagnosis: "Return to the current block.",
    next_action: "Open the planned doc and do the next smallest step.",
    block_id: "block-123",
    block_name: "Deep Work",
    ...overrides,
  };
}

async function showAndCapture(win, payload, outName) {
  win.webContents.send("overlay:show", payload);
  // Give the renderer a tick to apply DOM + styles.
  await new Promise((r) => setTimeout(r, 80));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, outName), image.toPNG());
}

async function main() {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  await showAndCapture(
    win,
    basePayload({
      event_type: "DRIFT_START",
      headline: "Drift detected",
      diagnosis: "One quick correction now prevents a long spiral.",
    }),
    "drift_start.png"
  );

  await showAndCapture(
    win,
    basePayload({
      event_type: "DRIFT_PERSIST",
      headline: "Still drifting",
      diagnosis: "Pattern-break: interrupt the loop and re-enter the block.",
      next_action: "Close the distracting tab. Start a 2-minute re-entry timer.",
    }),
    "drift_persist.png"
  );

  await win.close();
}

app.whenReady().then(main).then(() => app.quit());

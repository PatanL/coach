const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureOverlay(name, payload) {
  const win = new BrowserWindow({
    width: 640,
    height: 360,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  // Small delay to ensure layout is stable before capture.
  win.webContents.send("overlay:show", payload);
  await wait(150);

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());

  win.close();
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const base = {
    ts: new Date().toISOString(),
    cmd_id: "00000000-0000-4000-8000-000000000000",
    source_event_id: "evt_test",
    source: "screenshot",
    level: "B",
    style_id: "strict",
    block_id: "block_test",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "You drifted off your focus block.",
    diagnosis: "Your attention is sliding.",
    next_action: "Close the tab and return to the next tiny step."
  };

  await captureOverlay("drift_start.png", {
    ...base,
    event_type: "DRIFT_START",
    headline: "Drift detected",
    diagnosis: "One quick correction now prevents a long spiral."
  });

  await captureOverlay("drift_persist.png", {
    ...base,
    event_type: "DRIFT_PERSIST",
    headline: "Still drifting",
    diagnosis: "Pattern-break: stand up, reset posture, and restart the block."
  });

  app.quit();
});

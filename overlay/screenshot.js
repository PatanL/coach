const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");
const SIZE = { width: 640, height: 360 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function showAndCapture(win, name, payload) {
  // Give renderer a beat to attach listeners, then show deterministic payload.
  await new Promise((r) => setTimeout(r, 50));
  win.webContents.send("overlay:show", payload);
  await new Promise((r) => setTimeout(r, 75));

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());
  return outPath;
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: SIZE.width,
    height: SIZE.height,
    show: false,
    resizable: false,
    fullscreenable: false,
    transparent: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  const basePayload = {
    ts: new Date("2026-02-06T21:30:00.000Z").toISOString(),
    cmd_id: "00000000-0000-4000-8000-000000000000",
    source_event_id: "event-000",
    source: "screenshot",
    level: "B",
    block_id: "deep_work",
    block_name: "Deep work",
    headline: "Reset.",
    human_line: "You drifted.",
    diagnosis: "One tiny action to restart momentum.",
    next_action: "Close the tab. Open the editor. Start for 2 minutes."
  };

  await showAndCapture(win, "drift_start.png", {
    ...basePayload,
    source_event_type: "DRIFT_START"
  });

  await showAndCapture(win, "drift_persist_pattern_break.png", {
    ...basePayload,
    source_event_type: "DRIFT_PERSIST",
    headline: "Pattern break.",
    human_line: "Still drifting — interrupt the loop.",
    diagnosis: "You don't need motivation. You need a different move.",
    next_action: "Stand up. Breathe once. Then do the next 30 seconds."
  });

  win.destroy();
  app.quit();
});

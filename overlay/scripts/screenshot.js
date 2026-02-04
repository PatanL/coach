const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function renderAndCapture(win, name, payload) {
  win.webContents.send("overlay:show", payload);
  await new Promise((r) => setTimeout(r, 75));
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, name), image.toPNG());
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, "..", "overlay.html"));

  const base = {
    ts: new Date().toISOString(),
    cmd_id: "screenshot-cmd",
    source_event_id: "evt-1",
    source: "screenshot",
    level: "B",
    style_id: "alarm",
    headline: "Cut it",
    human_line: "You opened Reddit during Deep Work.",
    diagnosis: "You were scrolling. You must write the next paragraph.",
    next_action: "Close Reddit → type 2 sentences.",
    block_id: "block-1",
    block_name: "Deep Work"
  };

  await renderAndCapture(win, "drift-start.png", {
    ...base,
    source_event_type: "DRIFT_START"
  });

  await renderAndCapture(win, "drift-persist.png", {
    ...base,
    source_event_id: "evt-2",
    source_event_type: "DRIFT_PERSIST",
    headline: "DRIFT PERSIST",
    human_line: "Still on Reddit."
  });

  win.destroy();
  app.quit();
});

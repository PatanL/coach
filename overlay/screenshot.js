const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function capture(name, payload) {
  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  // Drive the same codepath as production: send the ipc "overlay:show" event.
  win.webContents.send("overlay:show", payload);

  // Give the renderer a beat to layout.
  await new Promise((r) => setTimeout(r, 150));

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());
  win.destroy();
  return outPath;
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const base = {
    level: "B",
    block_id: "block_demo",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "You drifted. Let\"s snap back.",
    diagnosis: "Context switch detected.",
    next_action: "Close the tab and open your editor.",
  };

  await capture(
    "drift_start.png",
    {
      ...base,
      cmd_id: "00000000-0000-0000-0000-000000000001",
      source_event_id: "evt_demo_start",
      event_type: "DRIFT_START",
    }
  );

  await capture(
    "drift_persist.png",
    {
      ...base,
      cmd_id: "00000000-0000-0000-0000-000000000002",
      source_event_id: "evt_demo_persist",
      event_type: "DRIFT_PERSIST",
      headline: "Reset — again.",
      diagnosis: "Drift is persisting. Make a single decisive move.",
    }
  );

  app.quit();
});

const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const outDir = path.join(__dirname, "screenshots");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function paintAndCapture(win, name, payload, outPath) {
  win.webContents.send("overlay:show", payload);
  // Give the renderer a tick to paint.
  await new Promise((r) => setTimeout(r, 60));

  const image = await win.webContents.capturePage();
  fs.writeFileSync(outPath, image.toPNG());
  // eslint-disable-next-line no-console
  console.log(`wrote ${name}: ${path.relative(process.cwd(), outPath)}`);
}

app.whenReady().then(async () => {
  ensureDir(outDir);

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));
  // Disable animations/transitions for deterministic screenshots.
  await win.webContents.executeJavaScript('document.body.classList.add("screenshot")');

  const base = {
    ts: new Date().toISOString(),
    cmd_id: "00000000-0000-0000-0000-000000000000",
    source_event_id: "evt-1",
    source: "runner",
    level: "B",
    style_id: "alarm",
    headline: "Reset now",
    human_line: "You drifted to YouTube.",
    diagnosis: "You were watching videos. You must do the scheduled block.",
    next_action: "Open your editor and write the next 2 lines.",
    block_id: "block-123",
    block_name: "Deep Work"
  };

  await paintAndCapture(
    win,
    "drift_start",
    { ...base, event_type: "DRIFT_START" },
    path.join(outDir, "drift_start.png")
  );

  await paintAndCapture(
    win,
    "drift_persist",
    { ...base, event_type: "DRIFT_PERSIST" },
    path.join(outDir, "drift_persist.png")
  );

  win.destroy();
  app.quit();
});

const { app, BrowserWindow, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function capture(win, filename) {
  const image = await win.webContents.capturePage();
  const png = image.toPNG();
  fs.writeFileSync(path.join(OUT_DIR, filename), png);
}

async function showPayload(win, payload) {
  const serialized = JSON.stringify(payload);
  await win.webContents.executeJavaScript(
    `window.__overlayScreenshotShow && window.__overlayScreenshotShow(${serialized});`,
    true
  );
}

async function main() {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  // A baseline drift overlay.
  await showPayload(win, {
    level: "B",
    style_id: "calm",
    source_event_type: "DRIFT_START",
    headline: "Reset.",
    human_line: "You got pulled off-task.",
    diagnosis: "One click to re-enter the work loop.",
    next_action: "Close the distraction tab and reopen your editor.",
    block_id: "block-123",
    block_name: "Deep work",
  });
  await capture(win, "drift_start.png");

  // Pattern-break: persisting drift.
  await showPayload(win, {
    level: "B",
    style_id: "strict",
    source_event_type: "DRIFT_PERSIST",
    headline: "Stop the slide.",
    human_line: "You're still drifting.",
    diagnosis: "This is the moment to interrupt the loop.",
    next_action: "Pick ONE next action: close it, recover schedule, or ask for help.",
    block_id: "block-123",
    block_name: "Deep work",
  });
  await capture(win, "drift_persist.png");

  win.close();
}

app.whenReady().then(() => {
  main()
    .then(() => app.quit())
    .catch((err) => {
      console.error(err);
      app.exit(1);
    });
});

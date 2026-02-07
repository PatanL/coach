const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");
const OVERLAY_HTML = path.join(__dirname, "overlay.html");
const PRELOAD = path.join(__dirname, "preload.js");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    fullscreenable: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // eslint-disable-next-line no-console
  console.log("screenshot: loading", {
    file: OVERLAY_HTML,
    preload: PRELOAD,
    preloadExists: fs.existsSync(PRELOAD)
  });

  win.webContents.on("did-fail-load", (_evt, errorCode, errorDesc, validatedURL) => {
    // eslint-disable-next-line no-console
    console.error("did-fail-load", { errorCode, errorDesc, validatedURL });
  });

  await win.loadFile(OVERLAY_HTML);
  return win;
}

async function renderAndCapture(win, name, payload) {
  win.webContents.send("overlay:show", payload);
  await sleep(150);

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, image.toPNG());
  return outPath;
}

(async () => {
  ensureDir(OUT_DIR);
  await app.whenReady();

  const base = {
    ts: new Date("2026-02-06T18:30:00.000Z").toISOString(),
    cmd_id: "00000000-0000-4000-8000-000000000000",
    source_event_id: "11111111-1111-4111-8111-111111111111",
    source: "runner",
    level: "B",
    style_id: "strict",
    headline: "Reset.",
    human_line: "You drifted off the current block.",
    diagnosis: "Resume the scheduled task.",
    next_action: "Return to the planned work block now.",
    block_id: "block:demo",
    block_name: "Deep Work"
  };

  const win = await createWindow();
  const written = [];

  written.push(
    await renderAndCapture(win, "drift_start", {
      ...base,
      event_type: "DRIFT_START",
      headline: "Reset.",
      diagnosis: "You drifted off the current block.",
      next_action: "Return to the planned work block now."
    })
  );

  written.push(
    await renderAndCapture(win, "drift_persist", {
      ...base,
      event_type: "DRIFT_PERSIST",
      headline: "Pattern break",
      diagnosis: "This is the second drift in a row. Don’t negotiate—reset.",
      next_action: "Take 30 seconds: close the tab, open the doc, write 1 line."
    })
  );

  win.destroy();

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, written }, null, 2));

  app.quit();
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
  try {
    app.quit();
  } catch (_) {
    // ignore
  }
});

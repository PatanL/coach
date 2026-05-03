const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: "#06080A",
    resizable: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  const htmlPath = path.join(__dirname, "overlay.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`overlay.html not found at ${htmlPath}`);
  }

  await win.loadFile(htmlPath);

  // Inject deterministic CSS for screenshot runs.
  // We want stable pixels even if the overlay uses animations (e.g. DRIFT_PERSIST pulse).
  await win.webContents.insertCSS(`
    * { animation: none !important; transition: none !important; }
  `);

  async function capture(name, payload) {
    // Give the DOM a moment to settle, then render the payload.
    await new Promise((r) => setTimeout(r, 50));
    win.webContents.send("overlay:show", payload);

    // Allow layout + paint.
    await new Promise((r) => setTimeout(r, 80));

    const image = await win.capturePage();
    fs.writeFileSync(path.join(OUT_DIR, name), image.toPNG());
  }

  const common = {
    level: "B",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "You drifted. Let’s snap back.",
    diagnosis: "Detected off-task activity.",
    next_action: "Close the tab and reopen your task doc.",
    cmd_id: "screenshot",
    block_id: "block_screenshot"
  };

  await capture("drift_start.png", {
    ...common,
    event_type: "DRIFT_START"
  });

  await capture("drift_persist.png", {
    ...common,
    event_type: "DRIFT_PERSIST",
    headline: "Interrupt the loop."
  });

  await capture("drift_persist_pattern_break.png", {
    ...common,
    event_type: "DRIFT_PERSIST",
    headline: "Interrupt the loop.",
    human_line: "Pattern-break: persistent drift needs a stronger snap-back.",
    diagnosis: "You’ve been off-task for a bit — treat this like an interruption.",
    next_action: "Stand up, close the distraction, and reopen your task doc."
  });

  await capture("align_mode.png", {
    ...common,
    event_type: "DRIFT_PERSIST",
    headline: "Pick the next best move.",
    human_line: "Option B: choose a clean, actionable step.",
    diagnosis: "If you’re not sure what to do next, choose a reset action.",
    next_action: "Pick one option (or type your own).",
    choices: ["Close distraction + reopen task", "Stand up (30s) then resume", "Snooze 5 min (intentional)"]
  });

  win.destroy();
  app.quit();
}

app.whenReady().then(() => {
  main().catch((err) => {
    console.error(err);
    app.exit(1);
  });
});

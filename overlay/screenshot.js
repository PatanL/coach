const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Rendering determinism: avoid GPU/hardware acceleration to reduce run-to-run diffs.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");

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

  // Make screenshots deterministic: freeze animations/transitions so we always capture the same frame.
  await win.webContents.insertCSS(`
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  `);

  // Explicitly lock zoom.
  win.webContents.setZoomFactor(1);

  async function capture(name, payload) {
    win.webContents.send("overlay:show", payload);

    // Wait until the overlay has applied the payload (avoid flaky timing-based screenshots).
    const want = String(payload.event_type || payload.source_event_type || "").toUpperCase();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const have = await win.webContents.executeJavaScript(
        "document.getElementById('overlay')?.dataset?.eventType || ''",
        true
      );
      if (String(have).toUpperCase() === want) break;
      await new Promise((r) => setTimeout(r, 25));
    }

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

  win.destroy();
  app.quit();
}

app.whenReady().then(() => {
  main().catch((err) => {
    console.error(err);
    app.exit(1);
  });
});

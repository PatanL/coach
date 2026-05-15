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

  win.webContents.on("console-message", (event, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });

  await win.loadFile(htmlPath);

  async function waitForOverlayReady() {
    const start = Date.now();
    while (Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      const ready = await win.webContents.executeJavaScript(
        "document.getElementById('eventLabel') && typeof window.overlayAPI !== 'undefined'"
      );
      if (ready) return;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("Timed out waiting for overlay renderer to become ready");
  }

  async function waitForOverlay(expectedEventType) {
    const start = Date.now();
    while (Date.now() - start < 2000) {
      // eslint-disable-next-line no-await-in-loop
      const eventType = await win.webContents.executeJavaScript(
        "document.getElementById('overlay')?.dataset?.eventType || ''"
      );
      if (String(eventType).trim() === expectedEventType) return;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out waiting for overlay eventType: ${expectedEventType}`);
  }

  async function capture(name, payload, expectedEventType) {
    await waitForOverlayReady();

    // Give the DOM a moment to settle, then render the payload.
    await new Promise((r) => setTimeout(r, 50));
    win.webContents.send("overlay:show", payload);

    if (expectedEventType) {
      await waitForOverlay(expectedEventType);
    }

    // Allow any CSS animations to reach a stable frame.
    await new Promise((r) => setTimeout(r, 250));

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

  await capture(
    "drift_start.png",
    {
      ...common,
      event_type: "DRIFT_START"
    },
    "DRIFT_START"
  );

  await capture(
    "drift_persist.png",
    {
      ...common,
      event_type: "DRIFT_PERSIST",
      headline: "Interrupt the loop."
    },
    "DRIFT_PERSIST"
  );

  win.destroy();
  app.quit();
}

app.whenReady().then(() => {
  main().catch((err) => {
    console.error(err);
    app.exit(1);
  });
});

const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "..", "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function captureScenario(win, payload, outName) {
  // Disable animations/transitions via ?screenshot flag + CSS.
  await win.loadFile(path.join(__dirname, "..", "overlay.html"), {
    search: "?screenshot=1"
  });

  await win.webContents.executeJavaScript(
    `(() => {
      document.documentElement.dataset.screenshot = "1";
      if (typeof window.__overlayOnShow === "function") {
        window.__overlayOnShow(${JSON.stringify(payload)});
      }
    })()`
  );

  // Give layout a moment to settle.
  await new Promise((r) => setTimeout(r, 150));

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, outName);
  fs.writeFileSync(outPath, image.toPNG());
  return outPath;
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    transparent: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const basePayload = {
    level: "B",
    style_id: "strict",
    headline: "Reset.",
    human_line: "You drifted off the current block.",
    diagnosis: "Resume the scheduled task.",
    next_action: "Return to the planned work block now.",
    block_id: "block-123",
    block_name: "Deep Work"
  };

  const outputs = [];
  outputs.push(
    await captureScenario(
      win,
      { ...basePayload, event_type: "DRIFT_START", style_id: "strict" },
      "drift_start.png"
    )
  );

  outputs.push(
    await captureScenario(
      win,
      { ...basePayload, event_type: "DRIFT_PERSIST", style_id: "pattern_break", headline: "Still off track" },
      "drift_persist_pattern_break.png"
    )
  );

  // Print paths for CI logs / local sanity.
  // eslint-disable-next-line no-console
  console.log(outputs.map((p) => `wrote ${p}`).join("\n"));

  await win.close();
  app.quit();
});

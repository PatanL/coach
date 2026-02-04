const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function captureScenario(win, { name, payload }) {
  // Mark screenshot mode to disable animations.
  await win.webContents.executeJavaScript("document.body.dataset.screenshot='true';", true);
  win.webContents.send("overlay:show", payload);
  // Let layout settle deterministically.
  await new Promise((r) => setTimeout(r, 250));
  const image = await win.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());
  return outPath;
}

async function main() {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "overlay.html"));

  const basePayload = {
    ts: "2026-02-04T23:00:00.000Z",
    cmd_id: "00000000-0000-0000-0000-000000000000",
    source_event_id: "11111111-1111-1111-1111-111111111111",
    source: "runner",
    level: "B",
    style_id: "calm",
    block_id: "block-123",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "You drifted off your intended block.",
    diagnosis: "Likely a quick context-switch that stuck.",
    next_action: "Close the tab + resume the next 5 minutes.",
  };

  const outputs = [];
  outputs.push(
    await captureScenario(win, {
      name: "drift_start_level_b.png",
      payload: { ...basePayload, source_event_type: "DRIFT_START" },
    })
  );

  outputs.push(
    await captureScenario(win, {
      name: "drift_persist_pattern_break.png",
      payload: {
        ...basePayload,
        source_event_type: "DRIFT_PERSIST",
        headline: "Pattern break.",
        human_line: "Same drift again — let’s interrupt it cleanly.",
        next_action: "Stand up, breathe once, then open the next 5-minute step.",
      },
    })
  );

  await win.close();
  return outputs;
}

app.whenReady().then(() => {
  main()
    .then((outs) => {
      // Print paths for CI / humans.
      for (const p of outs) console.log(p);
      app.quit();
    })
    .catch((err) => {
      console.error(err);
      app.exit(1);
    });
});

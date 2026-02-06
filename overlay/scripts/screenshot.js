const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OVERLAY_ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(OVERLAY_ROOT, "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function renderAndCapture({ name, payload, size }) {
  const win = new BrowserWindow({
    width: size.width,
    height: size.height,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const filePath = path.join(OVERLAY_ROOT, "overlay.html");
  await win.loadFile(filePath, { query: { screenshot: "1" } });

  // Ensure deterministic viewport sizing.
  win.setContentSize(size.width, size.height);

  // Wait a tick so styles apply.
  await new Promise((r) => setTimeout(r, 50));

  // Render the overlay via the test harness hook.
  const js = `window.__overlayOnShow && window.__overlayOnShow(${JSON.stringify(payload)});`;
  await win.webContents.executeJavaScript(js, true);

  // Give layout a moment.
  await new Promise((r) => setTimeout(r, 50));

  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());

  win.close();
  return outPath;
}

app.whenReady().then(async () => {
  ensureDir(OUT_DIR);

  const base = {
    ts: "2026-02-06T03:30:00.000Z",
    cmd_id: "cmd_screenshot",
    source_event_id: "evt_screenshot",
    source: "runner",
    level: "B",
    block_id: "block_screenshot",
    block_name: "Research",
    headline: "Reset.",
    human_line: "You’re drifting—let’s interrupt autopilot.",
    diagnosis: "Quick correction beats a long spiral.",
    next_action: "Recover the schedule, then do 5 minutes of the next step."
  };

  try {
    const outputs = [];

    outputs.push(
      await renderAndCapture({
        name: "drift_start.png",
        payload: { ...base, event_type: "DRIFT_START", style_id: "calm" },
        size: { width: 640, height: 360 }
      })
    );

    outputs.push(
      await renderAndCapture({
        name: "drift_persist_pattern_break.png",
        payload: { ...base, event_type: "DRIFT_PERSIST", style_id: "pattern_break" },
        size: { width: 640, height: 360 }
      })
    );

    // eslint-disable-next-line no-console
    console.log("wrote screenshots:\n" + outputs.map((p) => "- " + p).join("\n"));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("screenshot failed", err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});

const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Make screenshots stable across retina/non-retina.
app.commandLine.appendSwitch("force-device-scale-factor", "1");

const OUT_DIR = path.join(__dirname, "..", "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PAYLOADS = [
  {
    name: "overlay_level-b_strict.png",
    payload: {
      ts: "2026-02-06T05:30:00.000Z",
      cmd_id: "00000000-0000-0000-0000-000000000000",
      source_event_id: "11111111-1111-1111-1111-111111111111",
      source_event_type: "DRIFT_START",
      source: "screenshot",
      level: "B",
      style_id: "strict",
      headline: "Off schedule",
      human_line: "You drifted off the current block.",
      diagnosis: "Resume the scheduled task.",
      next_action: "Return to the planned work block now.",
      block_id: "block-123",
      block_name: "Deep work",
    },
  },
  {
    name: "overlay_drift_persist_pattern-break.png",
    payload: {
      ts: "2026-02-06T05:30:00.000Z",
      cmd_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      source_event_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      source_event_type: "DRIFT_PERSIST",
      source: "screenshot",
      level: "B",
      style_id: "strict",
      headline: "Still off track",
      human_line: "This drift is persisting — time for a reset.",
      diagnosis: "Pick one recovery step and do it now.",
      next_action: "Close the distractor and restart the block.",
      block_id: "block-123",
      block_name: "Deep work",
    },
  },
  {
    name: "overlay_level-a_calm.png",
    payload: {
      ts: "2026-02-06T05:30:00.000Z",
      cmd_id: "22222222-2222-2222-2222-222222222222",
      source_event_id: "33333333-3333-3333-3333-333333333333",
      source: "screenshot",
      level: "A",
      style_id: "calm",
      headline: "Start now",
      human_line: "Begin Coding block",
      diagnosis: "",
      next_action: "Start now",
      block_id: "block-999",
      block_name: "Coding",
    },
  },
];

async function captureOne(win, { name, payload }) {
  await win.webContents.send("overlay:show", payload);
  // Give layout a moment. Disable animations for determinism.
  await wait(50);
  const image = await win.webContents.capturePage();
  const outPath = path.join(OUT_DIR, name);
  fs.writeFileSync(outPath, image.toPNG());
  process.stdout.write(`wrote ${outPath}\n`);
}

async function main() {
  ensureDir(OUT_DIR);

  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadFile(path.join(__dirname, "..", "overlay.html"));
  await win.webContents.setZoomFactor(1);
  await win.webContents.insertCSS("*{animation:none!important;transition:none!important;caret-color:transparent!important;}");

  for (const item of PAYLOADS) {
    // Re-size for each capture: level A uses the banner size.
    if (item.payload.level === "A") {
      win.setSize(360, 140, false);
    } else {
      win.setSize(640, 360, false);
    }
    await wait(25);
    await captureOne(win, item);
  }

  win.destroy();
  app.quit();
}

app.whenReady().then(main).catch((err) => {
  console.error(err);
  app.exit(1);
});

/*
Deterministic overlay screenshots.

Usage:
  npm --prefix overlay run screenshot

Writes PNGs to overlay/screenshots/.
*/

const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "screenshots");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function capture({ name, payload }) {
  const win = new BrowserWindow({
    width: 800,
    height: 520,
    useContentSize: true,
    show: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(ROOT, "overlay.html"));

  // Render a stable frame.
  win.webContents.send("overlay:show", payload);
  await new Promise((r) => setTimeout(r, 200));

  const image = await win.webContents.capturePage();
  const filePath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(filePath, image.toPNG());

  await win.close();
  return filePath;
}

(async () => {
  ensureDir(OUT_DIR);

  await app.whenReady();

  const base = {
    level: "B",
    headline: "Reset.",
    human_line: "You drifted — let’s snap back.",
    diagnosis: "Small reset beats perfect plans.",
    next_action: "Do 1 minute of the next real step.",
    block_id: "block-demo",
    block_name: "Writing"
  };

  const outputs = [];
  outputs.push(
    await capture({
      name: "drift-start",
      payload: { ...base, event_type: "DRIFT_START" }
    })
  );
  outputs.push(
    await capture({
      name: "drift-persist-pattern-break",
      payload: { ...base, event_type: "DRIFT_PERSIST", headline: "Pattern break." }
    })
  );

  // Print paths for CI logs / humans.
  for (const out of outputs) console.log(out);

  await app.quit();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

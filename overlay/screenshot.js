const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const OUT_DIR = path.join(__dirname, "screenshots");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function stripPngChunks(pngBuffer, dropTypes) {
  const sig = pngBuffer.subarray(0, 8);
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (sig.length !== 8 || !sig.equals(PNG_SIG)) return pngBuffer;

  let offset = 8;
  const out = [sig];

  while (offset + 8 <= pngBuffer.length) {
    const length = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkTotal = 12 + length; // len + type + data + crc
    const chunkStart = offset;
    const chunkEnd = offset + chunkTotal;
    if (chunkEnd > pngBuffer.length) break;

    if (!dropTypes.has(type)) {
      out.push(pngBuffer.subarray(chunkStart, chunkEnd));
    }

    offset = chunkEnd;
    if (type === "IEND") break;
  }

  return Buffer.concat(out);
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

  // Make screenshots deterministic by disabling animations/transitions.
  await win.webContents.executeJavaScript('document.documentElement.dataset.screenshot = "1";');

  async function capture(name, payload) {
    // Give the DOM a moment to settle, then render the payload.
    await new Promise((r) => setTimeout(r, 50));
    win.webContents.send("overlay:show", payload);

    // Allow any CSS animations to reach a stable frame.
    await new Promise((r) => setTimeout(r, 250));

    const image = await win.capturePage();

    // Electron may embed non-deterministic metadata chunks (e.g. tIME). Strip those so screenshots
    // are stable across runs and suitable for PR review.
    const rawPng = image.toPNG();
    const stablePng = stripPngChunks(rawPng, new Set(["tIME", "iTXt", "tEXt", "zTXt"]));

    fs.writeFileSync(path.join(OUT_DIR, name), stablePng);
  }

  const common = {
    screenshot: true,
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

  await capture("drift_persist_align.png", {
    ...common,
    event_type: "DRIFT_PERSIST",
    headline: "Interrupt the loop.",
    question_id: "screenshot_q",
    choices: ["Close it now", "One-minute reset", "I need to recover schedule"]
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

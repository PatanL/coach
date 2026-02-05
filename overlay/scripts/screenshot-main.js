const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const outPath = process.env.OVERLAY_SCREENSHOT_OUT;
if (!outPath) {
  console.error("Missing OVERLAY_SCREENSHOT_OUT");
  process.exit(2);
}

const width = Number(process.env.OVERLAY_SCREENSHOT_WIDTH || 640);
const height = Number(process.env.OVERLAY_SCREENSHOT_HEIGHT || 360);

async function ensureDir(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.commandLine.appendSwitch("force-device-scale-factor", "1");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "screenshot-preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(__dirname, "..", "overlay.html"));

  // Give the renderer a moment to apply layout/styles.
  await wait(150);

  const image = await win.webContents.capturePage({ x: 0, y: 0, width, height });
  await ensureDir(outPath);
  await fs.promises.writeFile(outPath, image.toPNG());
  await win.destroy();
  app.quit();
});

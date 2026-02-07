const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Deterministic, local-only screenshots.
// Strategy:
// - Build a fully inlined HTML document (CSS + JS) so no relative assets are fetched.
// - Do a single navigation (data: URL) and reuse the same window for multiple captures.
//   This avoids repeated navigations, which can be flaky in some Electron setups.

const OVERLAY_ROOT = process.env.SCREENSHOT_ROOT || path.join(__dirname, "..");
const OUT_DIR = process.env.SCREENSHOT_OUT || path.join(__dirname, "..", "screenshots");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInlinedHtml() {
  const htmlPath = path.join(OVERLAY_ROOT, process.env.SCREENSHOT_HTML || "overlay.html");
  console.log("[screenshot] read", htmlPath, { exists: fs.existsSync(htmlPath) });

  const overlayHtml = fs.readFileSync(htmlPath, "utf8");
  const css = fs.readFileSync(path.join(OVERLAY_ROOT, "overlay.css"), "utf8");
  const utilsJs = fs.readFileSync(path.join(OVERLAY_ROOT, "overlay-utils.js"), "utf8");
  const overlayJs = fs.readFileSync(path.join(OVERLAY_ROOT, "overlay.js"), "utf8");

  // Define a deterministic bridge so overlay.js can run unchanged.
  const bridge = `
    <script>
      (function(){
        let onShow=null; let onPause=null;
        window.overlayAPI = {
          onShow: (h)=>{onShow=h;},
          onPause: (h)=>{onPause=h;},
          sendAction: ()=>{},
        };
        window.__screenshotHarness = {
          triggerShow: (p)=>{ if(onShow) onShow(p); },
          triggerPause: (p)=>{ if(onPause) onPause(p); },
        };
      })();
    </script>
  `;

  return overlayHtml
    .replace(/<link[^>]*href="overlay\.css"[^>]*>/, `<style>${css}</style>`)
    .replace(/<script\s+src="overlay-utils\.js"><\/script>/, `<script>${utilsJs}<\/script>`)
    .replace(/<script\s+src="overlay\.js"><\/script>/, `<script>${overlayJs}<\/script>`)
    .replace(/<\/head>/, `${bridge}\n</head>`);
}

async function triggerShow(win, payload) {
  await win.webContents.executeJavaScript(
    `window.__screenshotHarness && window.__screenshotHarness.triggerShow(${JSON.stringify(payload)});undefined;`,
    true
  );
}

async function createWindowAndLoad() {
  const win = new BrowserWindow({
    width: 640,
    height: 360,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("did-fail-load", { errorCode, errorDescription, validatedURL });
  });

  const inlined = buildInlinedHtml();
  const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(inlined);
  await win.loadURL(dataUrl);

  // Let layout settle deterministically.
  await sleep(200);

  return win;
}

async function captureTo(win, name, payload) {
  await triggerShow(win, payload);
  await sleep(250);

  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT_DIR, name), image.toPNG());
}

async function main() {
  await app.whenReady();
  ensureDir(OUT_DIR);

  const base = {
    ts: "2026-02-06T00:00:00.000Z",
    cmd_id: "00000000-0000-0000-0000-000000000000",
    source_event_id: "evt-0000",
    source: "screenshot",
    level: "B",
    style_id: "strict",
    block_id: "block-1",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "You drifted. Let’s recover.",
    diagnosis: "You’re looping on low-reward inputs.",
    next_action: "Close the tab, open your editor, do 5 minutes.",
  };

  const win = await createWindowAndLoad();

  await captureTo(win, "overlay-drift-start.png", {
    ...base,
    source_event_type: "DRIFT_START",
  });

  await captureTo(win, "overlay-drift-persist.png", {
    ...base,
    source_event_type: "DRIFT_PERSIST",
    headline: "Interrupt the loop.",
    human_line: "Same drift pattern. Break it hard.",
  });

  win.destroy();
  await app.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

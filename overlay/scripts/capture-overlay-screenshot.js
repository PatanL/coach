const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");

async function main() {
  await app.whenReady();

  const outDir = path.join(__dirname, "..", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "overlay-align-choices.png");

  const win = new BrowserWindow({
    width: 620,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "screenshot-preload.js")
    }
  });

  const htmlPath = path.join(__dirname, "..", "overlay.html");
  await win.loadFile(htmlPath);

  const payload = {
    level: "B",
    block_id: "block:demo",
    block_name: "Deep Work",
    headline: "Reset.",
    human_line: "Quick check-in.",
    diagnosis: "You drifted from the plan.",
    next_action: "Pick one and do it for 2 minutes.",
    question_id: "q:demo",
    choices: ["Close tabs", "Open task doc", "Start 2-min timer", "Write next step"],
  };

  // Trigger the same render path as the real overlay.
  await win.webContents.executeJavaScript(
    `window.__overlayScreenshot && window.__overlayScreenshot.show(${JSON.stringify(payload)})`
  );

  // Give the UI a moment to settle.
  await new Promise((r) => setTimeout(r, 150));

  const image = await win.webContents.capturePage();
  fs.writeFileSync(outPath, image.toPNG());

  await win.close();
  app.quit();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  app.quit();
  process.exitCode = 1;
});

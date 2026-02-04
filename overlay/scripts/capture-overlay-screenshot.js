const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow } = require("electron");

async function main() {
  await app.whenReady();

  const outDir = path.join(__dirname, "..", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: 620,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      preload: path.join(__dirname, "screenshot-preload.js")
    }
  });

  const htmlPath = path.join(__dirname, "..", "overlay.html");
  await win.loadFile(htmlPath);

  const scenarios = [
    {
      name: "overlay-align-choices.png",
      payload: {
        level: "B",
        block_id: "block:demo",
        block_name: "Deep Work",
        headline: "Reset.",
        human_line: "Quick check-in.",
        diagnosis: "You drifted from the plan.",
        next_action: "Pick one and do it for 2 minutes.",
        question_id: "q:demo",
        choices: ["Close tabs", "Open task doc", "Start 2-min timer", "Write next step"]
      },
      // Move focus off the text box so the "1-9: Choose" hint is visible.
      postScript: "document.getElementById('backBtn')?.focus?.()"
    },
    {
      name: "overlay-align-typing.png",
      payload: {
        level: "B",
        block_id: "block:demo",
        block_name: "Deep Work",
        headline: "Reset.",
        human_line: "Quick check-in.",
        diagnosis: "You drifted from the plan.",
        next_action: "Pick one and do it for 2 minutes.",
        question_id: "q:demo",
        choices: ["Close tabs", "Open task doc", "Start 2-min timer", "Write next step"]
      }
    },
    {
      name: "overlay-snooze-open.png",
      payload: {
        level: "B",
        block_id: "block:demo",
        block_name: "Deep Work",
        headline: "Reset.",
        human_line: "Quick check-in.",
        diagnosis: "You drifted from the plan.",
        next_action: "Pick one and do it for 2 minutes."
      },
      postScript: "document.getElementById('snoozeBtn')?.click?.()"
    },
    {
      name: "overlay-off-schedule.png",
      payload: {
        level: "B",
        block_id: "block:demo",
        block_name: "Deep Work",
        headline: "Off schedule",
        human_line: "You drifted: YouTube — LoFi Beats.",
        diagnosis: "Resume the scheduled task.",
        next_action: "Return to the planned work block now."
      }
    }
  ];

  for (const scenario of scenarios) {
    const outPath = path.join(outDir, scenario.name);

    await win.webContents.executeJavaScript(
      `window.__overlayScreenshot && window.__overlayScreenshot.show(${JSON.stringify(scenario.payload)})`
    );

    if (scenario.postScript) {
      await win.webContents.executeJavaScript(scenario.postScript);
    }

    // Give the UI a moment to settle.
    await new Promise((r) => setTimeout(r, 150));

    const image = await win.webContents.capturePage();
    fs.writeFileSync(outPath, image.toPNG());
  }

  await win.close();
  app.quit();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  app.quit();
  process.exitCode = 1;
});

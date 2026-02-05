const path = require("path");
const { spawnSync } = require("child_process");

const electronBinary = require("electron");

function runShot(name, payload) {
  const outPath = path.join(__dirname, "..", "screenshots", name);
  const result = spawnSync(
    electronBinary,
    [path.join(__dirname, "screenshot-main.js")],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        OVERLAY_SCREENSHOT_OUT: outPath,
        OVERLAY_SCREENSHOT_WIDTH: "640",
        OVERLAY_SCREENSHOT_HEIGHT: "360",
        OVERLAY_SCREENSHOT_PAYLOAD: JSON.stringify(payload)
      }
    }
  );
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

runShot("drift_start.png", {
  level: "B",
  style_id: "strict",
  event_type: "DRIFT_START",
  headline: "Reset now",
  human_line: "You drifted off the current block.",
  diagnosis: "Return to the plan. No debate.",
  next_action: "Close the tab and reopen your editor.",
  block_id: "block-demo",
  block_name: "Coding"
});

runShot("drift_persist.png", {
  level: "B",
  style_id: "strict",
  event_type: "DRIFT_PERSIST",
  headline: "Stop the spiral",
  human_line: "You’ve been off-task for 10+ minutes.",
  diagnosis: "This is DRIFT_PERSIST. Pattern-break: choose recovery.",
  next_action: "Stand up. 10 breaths. Then click Recover schedule.",
  block_id: "block-demo",
  block_name: "Coding"
});

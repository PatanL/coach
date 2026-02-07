const path = require("path");
const { spawnSync } = require("child_process");

function main() {
  const overlayDir = path.join(__dirname, "..");
  const outDir = path.join(overlayDir, "screenshots");

  const electronBin = process.platform === "win32"
    ? path.join(overlayDir, "node_modules", ".bin", "electron.cmd")
    : path.join(overlayDir, "node_modules", ".bin", "electron");

  const runner = path.join(__dirname, "screenshot-runner.js");
  const res = spawnSync(electronBin, [runner], {
    stdio: "inherit",
    env: {
      ...process.env,
      SCREENSHOT_ROOT: overlayDir,
      SCREENSHOT_OUT: outDir,
    },
  });

  process.exitCode = res.status || 0;
}

main();

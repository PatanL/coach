const { spawn } = require("node:child_process");
const path = require("node:path");

function runElectron() {
  return new Promise((resolve, reject) => {
    const electronBin = path.join(__dirname, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");
    const child = spawn(electronBin, [__dirname], {
      stdio: "inherit",
      env: {
        ...process.env,
        OVERLAY_SCREENSHOT: "1"
      }
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`electron exited with code ${code}`));
    });
  });
}

runElectron().catch((err) => {
  console.error(err);
  process.exit(1);
});

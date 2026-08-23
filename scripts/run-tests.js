"use strict";

const path = require("node:path");
const childProcess = require("node:child_process");

const env = { ...process.env };

// WSL can inherit Windows TMP/TEMP values. Vitest creates its worker
// directories before loading vitest.config.mjs, so normalize them here while
// the child process environment can still be changed in time.
if (process.platform === "linux" && [env.TMPDIR, env.TMP, env.TEMP]
  .some(value => typeof value === "string" && value.startsWith("/mnt/"))) {
  env.TMPDIR = "/tmp";
  env.TMP = "/tmp";
  env.TEMP = "/tmp";
}

const vitestBin = process.platform === "win32"
  ? path.join(__dirname, "..", "node_modules", ".bin", "vitest.cmd")
  : path.join(__dirname, "..", "node_modules", ".bin", "vitest");
const result = childProcess.spawnSync(vitestBin, ["run", ...process.argv.slice(2)], {
  cwd: path.join(__dirname, ".."),
  env,
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

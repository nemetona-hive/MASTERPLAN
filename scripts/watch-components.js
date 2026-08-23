"use strict";

const path = require("path");
const fs = require("fs");
const { build } = require("./build-components");
const { buildStyles, STYLE_SOURCES } = require("./build-styles");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
let timer = null;
let running = false;
let queued = false;

// The build no longer has a hand-maintained source list to watch — esbuild
// follows the import graph from src/App.jsx — so walk the tree instead. A new
// file picked up by an import is then watched without touching this script.
function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "styles") continue;
      files.push(...listSourceFiles(absPath));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      files.push(absPath);
    }
  }

  return files;
}

async function runBuild() {
  if (running) {
    queued = true;
    return;
  }

  running = true;
  try {
    await build();
    buildStyles();
    process.stdout.write(`[watch] Built components.js and app.css at ${new Date().toLocaleTimeString()}\n`);
  } catch (err) {
    process.stderr.write(`[watch] Build failed: ${err.message}\n`);
  } finally {
    running = false;
    if (queued) {
      queued = false;
      runBuild();
    }
  }
}

function scheduleBuild() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(runBuild, 120);
}

runBuild();

const filesToWatch = [
  ...listSourceFiles(SRC_DIR),
  ...STYLE_SOURCES.map(relPath => path.join(ROOT, relPath))
];
filesToWatch.forEach(absPath => {
  fs.watch(absPath, { persistent: true }, scheduleBuild);
});

process.stdout.write(`[watch] Watching ${filesToWatch.length} JS/CSS source files...\n`);

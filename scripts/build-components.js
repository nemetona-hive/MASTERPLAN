"use strict";

const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const ROOT = path.resolve(__dirname, "..");
const SOURCES = [
  "src/shared.jsx",
  "src/Visualization.jsx",
  "src/Controls.jsx",
  "src/utils/timesheet.js",
  "src/components/Timesheet.jsx",
  "src/components/PipeWrapCalculator.jsx",
  "src/Sheets.jsx",
  "src/Nav.jsx",
  "themes.js",
  "src/App.jsx"
];
const OUT_FILE = "components.js";

function build() {
  const sourceCode = SOURCES.map(relPath => {
    const absPath = path.join(ROOT, relPath);
    return fs.readFileSync(absPath, "utf8");
  }).join("\n\n");

  const result = babel.transformSync(sourceCode, {
    filename: "components.jsx",
    presets: ["@babel/preset-react"],
    comments: true,
    compact: false
  });

  if (!result || typeof result.code !== "string") {
    throw new Error("Babel did not return compiled output.");
  }

  fs.writeFileSync(path.join(ROOT, OUT_FILE), result.code, "utf8");
}

if (require.main === module) {
  try {
    build();
    process.stdout.write("Built components.js\n");
  } catch (err) {
    process.stderr.write(`Build failed: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  build,
  SOURCES
};


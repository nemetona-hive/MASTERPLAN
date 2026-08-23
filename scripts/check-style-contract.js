"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_FILE = path.join(ROOT, "app.css");

/* Selectors the markup depends on structurally: lose one and a page loses its
   frame rather than a colour, which is the failure a diff of a 3,600-line
   stylesheet hides best. Only load-bearing layout selectors belong here — this
   is a contract, not an inventory. */
const REQUIRED_SELECTORS = [
  ".app",
  ".app-head",
  ".page-main-full",
  ".main-data",
  ".control-panel",
  ".num-wrap",
  ".nav-btn",
  ".ts-page",
  ".ts-btn"
];

if (!fs.existsSync(STYLE_FILE)) {
  console.error("Missing generated app.css. Run npm run build first.");
  process.exit(1);
}

const css = fs.readFileSync(STYLE_FILE, "utf8");
const missing = REQUIRED_SELECTORS.filter(selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !new RegExp(`(?:^|[,{\\s])${escaped}(?:[,{\\s:])`).test(css);
});

if (missing.length) {
  console.error(`❌ Missing shared style contract: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`✅ Shared style contract intact (${REQUIRED_SELECTORS.length} selectors)`);

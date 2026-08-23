"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/* Budgets, not limits. Both bundles are committed and served straight off
   GitHub Pages, so growth here is growth in what every visitor downloads. Set
   with roughly 50% headroom over the current size: enough that ordinary work
   never trips it, tight enough that something accidentally vendored does. */
const BUDGETS = [
  ["components.js", 250 * 1024],
  ["app.css", 150 * 1024]
];

let failed = false;
for (const [file, budget] of BUDGETS) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) {
    console.error(`Missing generated asset: ${file}. Run npm run build first.`);
    failed = true;
    continue;
  }

  const bytes = fs.statSync(target).size;
  const sizeKb = (bytes / 1024).toFixed(1);
  const budgetKb = (budget / 1024).toFixed(0);
  if (bytes > budget) {
    console.error(`❌ ${file}: ${sizeKb} KiB exceeds ${budgetKb} KiB budget`);
    failed = true;
  } else {
    console.log(`✅ ${file}: ${sizeKb} KiB / ${budgetKb} KiB budget`);
  }
}

if (failed) process.exit(1);

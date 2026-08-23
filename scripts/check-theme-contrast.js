"use strict";

/*
 * Contrast gate for the theme palettes.
 *
 * Reads themes.js rather than carrying its own copy. It used to carry one, and
 * the copy had drifted badly — graphite's --bg, verdant's --surface-1, and both
 * themes' --accent-2 and --warning were all different from what actually
 * shipped. Every run was green against a palette no visitor ever saw, which is
 * worse than no check at all.
 *
 * Targets follow how a token is used, not what it is called:
 *   4.5:1  a word is drawn in it, or sits on it
 *   3:1    it only draws a mark — a border, a glow, a fill behind a shape
 * Bold at 14px is not WCAG "large text", so nothing here gets the 3:1 pass for
 * being bold.
 *
 * Exits non-zero on a miss. It is a gate.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "themes.js"), "utf8");
const THEMES = new Function(`${source}\n;return THEMES;`)();

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
}

const pairsToTest = [
  { fg: "--text", bg: "--bg", target: 7 },
  { fg: "--text", bg: "--surface-1", target: 4.5 },
  { fg: "--text-muted", bg: "--surface-1", target: 4.5 },
  { fg: "--brand", bg: "--bg", target: 3 },
  { fg: "--accent", bg: "--bg", target: 3 },
  // These three are drawn as text: --danger on .ts-duration--error and
  // .ts-copy--error, --success on .num-btn--ok and .ts-copy--done, --warning on
  // .ts-duration--warn. They were on the 3:1 mark tier, which is the tier for a
  // border or a glow, not for a word.
  { fg: "--danger", bg: "--surface-1", target: 4.5 },
  { fg: "--success", bg: "--surface-1", target: 4.5 },
  { fg: "--warning", bg: "--surface-1", target: 4.5 }
];

let failed = false;
for (const [themeName, theme] of Object.entries(THEMES)) {
  const colors = theme.colors || theme;
  console.log(`\n=== Theme: ${themeName} ===`);
  for (const { fg, bg, target } of pairsToTest) {
    const fgColor = colors[fg];
    const bgColor = colors[bg];
    if (!fgColor || !bgColor) {
      console.log(`⚠️  ${fg} on ${bg}: not defined in this theme`);
      continue;
    }

    const ratio = contrastRatio(fgColor, bgColor);
    const pass = ratio >= target;
    if (!pass) failed = true;
    console.log(`${pass ? "✅" : "❌"} ${fg} on ${bg}: ${ratio.toFixed(2)}:1 (Target: ${target}:1)`);
  }
}

if (failed) {
  console.error("\n❌ Contrast targets missed. Adjust the palette in themes.js.");
  process.exit(1);
}
console.log("\n✅ All themes meet their contrast targets.");

"use strict";

/*
 * MASTERPLAN font check.
 *
 * vendor/fonts/fonts.css makes claims about font files, and nothing in the
 * browser tells you when one is false. A face that claims a weight its file
 * cannot draw is clamped or faked in silence; a letter the file does not
 * carry drops to a system face mid-word; a variable font declared once per
 * weight is downloaded once per weight. Every one of those shipped here:
 *
 *   - IBM Plex Sans and JetBrains Mono are variable fonts, and sat in the
 *     repo as four and three byte-identical copies, one per weight. Most
 *     pages fetched the Plex file twice and the JetBrains Mono file three
 *     times.
 *   - only the latin subset was vendored, so the š and ž in a room or
 *     project name were drawn by a system face between letters of
 *     JetBrains Mono, on screen and on the printed take-off.
 *
 * So this reads the binaries (scripts/woff2.js) and holds the stylesheet to
 * them:
 *
 *   ERROR  a face points at a file that is missing
 *   ERROR  a woff2 in vendor/fonts/ that no face uses — dead weight
 *   ERROR  two files with identical bytes — a variable font copied per weight
 *   ERROR  a file whose family name is not the family it is declared as
 *   ERROR  a weight descriptor the file cannot draw
 *   ERROR  a subset that does not offer every weight the family's other
 *          subsets do — bold ž would switch face mid-word
 *   ERROR  a --fw-* weight with no face, or upright faces reaching past
 *          the heaviest --fw-* token — a weight nothing asks for
 *   ERROR  a REQUIRED character no face of a family draws
 *   ERROR  a font token (--mono, --sans, --font-ui) whose first family has
 *          no @font-face
 *
 * Ported from MONEYFLOW's scripts/check-fonts.js. Differences: the tokens
 * live in 00-base.css, and the required set carries what MASTERPLAN's cut
 * lists and take-offs print (× ° Ø ± ¼ ² ³) and the Greek it shows (α φ π).
 *
 * Usage: npm run fonts:check      (exit 1 if any ERROR)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { describeFont } = require("./woff2");

const ROOT = path.resolve(__dirname, "..");
const FONT_DIR = path.join(ROOT, "vendor", "fonts");
const TOKEN_CSS = path.join(ROOT, "src", "styles", "00-base.css");

/* Characters every face family has to draw itself. ASCII, the letters of
   the language the data is written in (Estonian: õ ä ö ü, and š ž in
   names), the typography the formatters emit — the dashes and ellipsis in
   empty cells, the minus, € on take-offs — and what the cut lists, take-offs
   and calculators print beside a figure: × between dimensions, ° on angles,
   Ø on pipes, ± on tolerances, ¼ on the timesheet, ² and ³ on areas and
   volumes. And the Greek the app shows: α on the downpipe guider, φ in
   "Golden Ratio φ", π in the pipe-wrap formula.

   Deliberately absent, because no subset of any of the three faces
   carries them and the system face is where they come from:
     → ↔ ≈ ✓ ◇ ⅓ ⅔   arrows and symbols (cut list headers, the Guider, the
                       gypsum skim rate, the step marker, the pattern names)
     ⚫ and friends    the theme icons, which are emoji. */
const REQUIRED = [
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)).join(""),
  "õÕäÄöÖüÜšŠžŽ",
  "€–—‘’“”…·×°−Ø±¼²³",
  "αφπ"
].join("");

/* --------------------------------------------------------------- parsing */

const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every @font-face in a stylesheet, as plain descriptors. */
function parseFaces(css) {
  const faces = [];
  for (const m of stripComments(css).matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const desc = {};
    for (const decl of m[1].split(";")) {
      const i = decl.indexOf(":");
      if (i > 0) desc[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
    const [lo, hi = lo] = (desc["font-weight"] || "400").split(/\s+/).map(w =>
      w === "normal" ? 400 : w === "bold" ? 700 : Number(w));
    faces.push({
      family: (desc["font-family"] || "").replace(/["']/g, ""),
      style: desc["font-style"] || "normal",
      weight: { min: lo, max: hi },
      src: (/url\(\s*["']?([^"')]+)["']?\s*\)/.exec(desc.src || "") || [])[1],
      ranges: parseUnicodeRange(desc["unicode-range"])
    });
  }
  return faces;
}

/** "U+0000-00FF, U+0131" -> [[0, 255], [305, 305]]; absent means everything. */
function parseUnicodeRange(value) {
  if (!value) return [[0, 0x10ffff]];
  return value.split(",").map(part => {
    const [a, b = a] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(a, 16), parseInt(b, 16)];
  });
}

const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);

/** The font tokens and the --fw-* scale, from :root in the token stylesheet. */
function parseTokens(css) {
  const text = stripComments(css);
  const families = {};
  for (const name of ["mono", "sans", "font-ui"]) {
    const m = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(text);
    if (m) families[name] = m[1].split(",")[0].trim().replace(/["']/g, "");
  }
  const weights = [...text.matchAll(/--fw-[\w-]+\s*:\s*(\d+)\s*;/g)].map(m => Number(m[1]));
  return { families, weights: [...new Set(weights)].sort((a, b) => a - b) };
}

/* ---------------------------------------------------------------- checks */

function checkFonts({ fontDir = FONT_DIR, tokenCss = TOKEN_CSS } = {}) {
  const findings = [];
  const error = (where, message) => findings.push({ where, message });

  const faces = parseFaces(fs.readFileSync(path.join(fontDir, "fonts.css"), "utf8"));
  const { families: tokens, weights: scale } = fs.existsSync(tokenCss)
    ? parseTokens(fs.readFileSync(tokenCss, "utf8"))
    : { families: {}, weights: [] };

  // Files on disk vs files referenced.
  const onDisk = fs.readdirSync(fontDir).filter(f => /\.(woff2?|ttf|otf)$/.test(f));
  const used = new Set(faces.map(f => f.src));
  for (const file of onDisk) {
    if (!used.has(file)) error(file, "no @font-face uses this file — delete it or declare it");
  }

  // Identical bytes.
  const byHash = new Map();
  for (const file of onDisk) {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(fontDir, file))).digest("hex");
    if (byHash.has(hash)) {
      error(file, `identical to ${byHash.get(hash)} — a variable font is ONE face with a weight range, not one copy per weight`);
    } else byHash.set(hash, file);
  }

  // Each face against its file.
  const fonts = new Map();
  for (const face of faces) {
    const where = `${face.family} ${face.weight.min}${face.weight.max !== face.weight.min ? "-" + face.weight.max : ""} (${face.src})`;
    if (!face.src || !fs.existsSync(path.join(fontDir, face.src))) {
      error(where, "the file this face points at does not exist");
      continue;
    }
    if (!fonts.has(face.src)) fonts.set(face.src, describeFont(path.join(fontDir, face.src)));
    const font = fonts.get(face.src);
    face.font = font;

    if (font.family !== face.family) {
      error(where, `the file is "${font.family}", not "${face.family}"`);
    }
    if (face.weight.min < font.weight.min || face.weight.max > font.weight.max) {
      error(where, font.variable
        ? `declares ${face.weight.min}-${face.weight.max}; the file's wght axis is ${font.weight.min}-${font.weight.max}`
        : `declares ${face.weight.min}-${face.weight.max}; the file is a static ${font.weight.min} — it would be drawn at the wrong weight`);
    }
  }

  /* Per family and style: subset parity, coverage, and — for the upright
     style only — the weight scale. An italic face would be a partial set on
     purpose (fonts.css would say which surface needs which weight), so it is
     held to parity and coverage but not to every --fw-* token. */
  const familyNames = [...new Set(faces.map(f => f.family))];
  const groups = [...new Map(faces.map(f => [`${f.family}|${f.style}`, [f.family, f.style]])).values()];
  for (const [family, style] of groups) {
    const own = faces.filter(f => f.family === family && f.style === style && f.font);
    const label = style === "normal" ? family : `${family} ${style}`;
    const covers = (weight, list = own) => list.some(f => weight >= f.weight.min && weight <= f.weight.max);

    // Group faces into subsets by their unicode-range.
    const subsets = new Map();
    for (const face of own) {
      const key = JSON.stringify(face.ranges);
      if (!subsets.has(key)) subsets.set(key, []);
      subsets.get(key).push(face);
    }
    const reach = list => scale.filter(w => covers(w, list)).join("/");
    const reaches = [...subsets.values()].map(reach);
    if (new Set(reaches).size > 1) {
      error(label, `subsets offer different weights (${[...subsets.values()].map((l, i) => `${l[0].src}: ${reaches[i] || "none"}`).join("; ")}) — a letter from the thinner subset would switch face mid-word`);
    }

    if (style === "normal" && own.length) {
      /* Exactly the scale, not more. A face that stops short clamps the
         heavier tokens in silence — JetBrains Mono stopped at 600 and every
         --fw-bold figure drew semibold. A face reaching past it declares
         weights nothing in src/ can ask for. */
      const missing = scale.filter(w => !covers(w));
      if (missing.length) error(label, `no face draws --fw-* weight ${missing.join(", ")} — it would be clamped to a lighter one`);
      const top = Math.max(...own.map(f => f.weight.max));
      const heaviest = Math.max(...scale);
      if (top > heaviest) error(label, `faces reach ${top}, past the heaviest --fw-* token (${heaviest})`);
    }

    const undrawn = [];
    for (const ch of REQUIRED) {
      const cp = ch.codePointAt(0);
      if (!own.some(f => inRanges(cp, f.ranges) && f.font.codepoints.has(cp))) undrawn.push(ch);
    }
    if (undrawn.length) {
      error(label, `no face draws ${undrawn.map(c => `${JSON.stringify(c)} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(", ")} — it falls back to a system face`);
    }
  }

  // Tokens name families that exist.
  for (const [token, family] of Object.entries(tokens)) {
    if (!familyNames.includes(family)) error(`--${token}`, `names "${family}", which has no @font-face in vendor/fonts/fonts.css`);
  }

  return { findings, faces: faces.length, files: onDisk.length, families: familyNames, styles: groups.length };
}

module.exports = { checkFonts, parseFaces, parseTokens, parseUnicodeRange, REQUIRED };

if (require.main === module) {
  const { findings, faces, files, families } = checkFonts();
  for (const f of findings) console.log(`❌ ${f.where}\n   ${f.message}`);
  if (findings.length) {
    console.error(`\n${findings.length} font problem(s).`);
    process.exit(1);
  }
  console.log(`✅ ${faces} faces over ${files} files, ${families.length} families (${families.join(", ")}) — every weight drawable, every required letter covered.`);
}

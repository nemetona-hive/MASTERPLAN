"use strict";

/*
 * Font Awesome subset builder.
 *
 * vendor/fontawesome.min.css defines 1,895 icons in 72 KB of render-blocking
 * CSS. This app uses about thirty of them. Lighthouse costed the full sheet at
 * 401 ms of blocked render on desktop and 2,130 ms on throttled mobile — it was
 * the single largest blocking request on the page, ahead of app.css.
 *
 * So the sheet that ships is generated: the @font-face and glyph values are
 * read out of the upstream file, and only the icons ICONS actually names are
 * emitted. Upstream stays in the repo unreferenced, as the source this reads —
 * it costs nothing on the wire, because nothing links it.
 *
 * The font binary gets the same treatment. fa-solid-900.woff2 carries 1,403
 * glyphs in 155 KB to draw thirty of them, so it is subset here too, through
 * harfbuzz (subset-font). Same source-and-generated split: the full face stays
 * in vendor/ as the input, fa-solid-900.subset.woff2 is what the page loads.
 * The output is byte-identical run to run, which is what lets the pre-push
 * staleness gate diff it like any other committed build output.
 *
 * The point of generating rather than hand-maintaining: a missing icon is
 * silent. The class simply matches nothing and the glyph renders as a blank
 * box, which is how "fa-circle-0" — an icon Font Awesome has never had — sat in
 * config.js unnoticed. This script exits non-zero instead.
 *
 * Usage: node scripts/build-icons.js   (runs as part of npm run build)
 */

const fs = require("node:fs");
const path = require("node:path");
const subsetFont = require("subset-font");

const ROOT = path.resolve(__dirname, "..");
const UPSTREAM = path.join(ROOT, "vendor", "fontawesome.min.css");
const OUT = path.join(ROOT, "vendor", "fontawesome.subset.css");
const FONT_IN = path.join(ROOT, "vendor", "fa-solid-900.woff2");
const FONT_OUT_NAME = "fa-solid-900.subset.woff2";
const FONT_OUT = path.join(ROOT, "vendor", FONT_OUT_NAME);

const upstream = fs.readFileSync(UPSTREAM, "utf8");

/* ICONS lives in config.js as a classic-script global, and shared.jsx's Icon
   falls back to fa-circle-question for a name ICONS does not carry. That
   fallback only helps if the glyph ships, so it is seeded here rather than
   discovered. */
const configSource = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
const ICONS = new Function(`${configSource}\n;return ICONS;`)();

const FALLBACK = "fa-circle-question";
const wanted = new Set([FALLBACK]);
const families = new Set();
for (const value of Object.values(ICONS)) {
  for (const cls of String(value).split(/\s+/).filter(Boolean)) {
    if (/^fa-(solid|regular|brands)$/.test(cls)) families.add(cls);
    else if (cls.startsWith("fa-")) wanted.add(cls);
  }
}

/* Every `.a,.b{--fa:"\f00c"}` in upstream, flattened to name -> glyph. Aliases
   share one rule (.fa-circle-question,.fa-question-circle), so the selector
   list has to be split rather than matched whole. */
const glyphs = new Map();
for (const m of upstream.matchAll(/([^{}]+)\{--fa:("(?:[^"\\]|\\.)*")\}/g)) {
  for (const sel of m[1].split(",")) {
    const name = sel.trim();
    if (name.startsWith(".fa-")) glyphs.set(name.slice(1), m[2]);
  }
}

const missing = [...wanted].filter(name => !glyphs.has(name));
if (missing.length) {
  console.error(`✖ build-icons: Font Awesome has no icon named ${missing.join(", ")}.`);
  console.error("  Named in config.js ICONS (or the Icon fallback in shared.jsx).");
  console.error("  A class with no glyph renders as a blank box, silently — fix the name.");
  process.exit(1);
}

/* Only the solid face is emitted, so anything else would ship a font-family
   with no @font-face behind it and fall back to the page font. */
const unsupported = [...families].filter(f => f !== "fa-solid");
if (unsupported.length) {
  console.error(`✖ build-icons: ICONS uses ${unsupported.join(", ")}, but only fa-solid ships.`);
  console.error("  fa-brands-400.woff2 was 115 KB for a single icon and was removed.");
  console.error("  Either pick a fa-solid equivalent, or restore that face here and in vendor/.");
  process.exit(1);
}

const face = upstream.match(
  /@font-face\{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;[^}]*\}/
);
/* Upstream lists a .ttf after the .woff2; only the woff2 is vendored here, so
   the ttf url is dropped rather than shipped as a 404 waiting for a browser old
   enough to reach for it. The remaining url is repointed at the subset face
   this script writes below — the full one is input, not output. */
const faceCss = face && face[0]
  .replace(/,url\(fa-solid-900\.ttf\)\s*format\("truetype"\)/, "")
  .replace("url(fa-solid-900.woff2)", `url(${FONT_OUT_NAME})`);

if (!face) {
  console.error("✖ build-icons: could not find the Free/900 @font-face upstream.");
  process.exit(1);
}
if (!upstream.includes("content:var(--fa)")) {
  console.error("✖ build-icons: upstream no longer drives content from var(--fa).");
  console.error("  The base rules below were written for that shape — re-check them.");
  process.exit(1);
}

const names = [...wanted].sort();
const css = [
  "/*! Generated by scripts/build-icons.js from vendor/fontawesome.min.css — do not edit.",
  "    Font Awesome Free 6, CC BY 4.0 / SIL OFL 1.1 / MIT — https://fontawesome.com",
  `    ${names.length} of ${glyphs.size} icons, the ones config.js ICONS names. */`,
  faceCss,
  ".fa-solid,.fas{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;" +
    "display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;" +
    'line-height:1;text-rendering:auto;font-family:"Font Awesome 6 Free";font-weight:900}',
  ".fa-solid:before,.fas:before{content:var(--fa)}",
  ...names.map(name => `.${name}{--fa:${glyphs.get(name)}}`)
].join("\n") + "\n";

const kb = n => (n / 1024).toFixed(1) + " KiB";

/* The glyphs are addressed by the characters themselves, which is what the
   \f00c escapes in the CSS above are — turn each back into a codepoint and hand
   harfbuzz the string. Anything not in it is dropped from cmap, glyf and hmtx. */
const text = names
  .map(name => glyphs.get(name).slice(1, -1))
  .map(esc => String.fromCodePoint(parseInt(esc.replace(/^\\/, ""), 16)))
  .join("");

subsetFont(fs.readFileSync(FONT_IN), text, { targetFormat: "woff2" }).then(font => {
  fs.writeFileSync(OUT, css);
  fs.writeFileSync(FONT_OUT, font);
  console.log(`Built vendor/fontawesome.subset.css — ${names.length} icons, ` +
    `${kb(css.length)} (from ${kb(upstream.length)})`);
  console.log(`Built vendor/${FONT_OUT_NAME} — ` +
    `${kb(font.length)} (from ${kb(fs.statSync(FONT_IN).size)})`);
}).catch(err => {
  console.error("✖ build-icons: subsetting the font failed — " + err.message);
  process.exit(1);
});

"use strict";

/*
 * MASTERPLAN UI system audit.
 *
 * Mechanical conformance checks over src/styles/*.css and the markup that
 * references it.
 *
 * Ported from MONEYFLOW's audit, deliberately as a subset. That version also
 * checks money-grid --mg-* tokens and the --ctl-* control tiers; neither token
 * system exists here (grep src/styles for either and you get nothing), so those
 * checks would only ever emit noise about rules that are correct. They belong
 * back if MASTERPLAN ever adopts the systems.
 *
 * Findings are split by confidence:
 *   ERROR - deterministic. A theme token exists for this and a literal is used,
 *           or JS and the stylesheets disagree about the mobile breakpoint.
 *   WARN  - heuristic. Usually real, but read it before acting; a class only
 *           ever assembled at runtime looks dead when it is not.
 *
 * Usage: npm run audit:ui              (exit 1 if any ERROR)
 *        npm run audit:ui -- --unused  (also list the dead-class tail)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const STYLE_DIR = path.join(ROOT, "src", "styles");
const COMPONENT_DIR = path.join(ROOT, "src");

const findings = [];
const add = (level, check, file, line, message) =>
  findings.push({ level, check, file, line, message });

/* ---------------------------------------------------------------- helpers */

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, ext, out);
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

const rel = f => path.relative(ROOT, f);

/** Blank out comments but keep line numbering intact. */
const stripComments = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, " "));

const cssFiles = walk(STYLE_DIR, ".css");

// Class names are not only written in JSX. config.js returns some as strings
// (PAL_CLASSES, getSegmentClass), simulation.js tags segments by type, and the
// shell carries its own. Miss any of these and live classes read as dead, which
// is the one way this check can do damage.
const markupFiles = [
  ...walk(COMPONENT_DIR, ".jsx"),
  ...walk(COMPONENT_DIR, ".js"),
  ...["index.html", "config.js", "simulation.js", "themes.js"]
    .map(f => path.join(ROOT, f))
    .filter(fs.existsSync)
];
const markupText = markupFiles.map(f => fs.readFileSync(f, "utf8")).join("\n");

/** Split a stylesheet into { selector, body, line } rule blocks. */
function rules(text) {
  const clean = stripComments(text);
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    if (!selector || selector.startsWith("@")) continue;
    out.push({ selector, body: m[2], line: clean.slice(0, m.index).split("\n").length });
  }
  return out;
}

/* ------------------------------------------------------- 1. hardcoded colour
 * Theme tokens exist so a value works on every theme. A literal hex or a tinted
 * rgba() is what leaves a colour frozen at whatever one theme says. Neutral
 * rgba (equal channels) is fine — those are shadows and edge lights. */

for (const file of cssFiles) {
  const text = stripComments(fs.readFileSync(file, "utf8"));
  text.split("\n").forEach((code, i) => {
    // A custom-property definition is where literal colour is supposed to
    // live — :root and themes.js are the palette. Only usages are findings.
    if (/^\s*--[\w-]+\s*:/.test(code)) return;

    const hex = /(?<!&)#[0-9a-fA-F]{3,8}\b/.exec(code);
    if (hex && !/#f{3,8}\b/i.test(hex[0])) {
      add("ERROR", "hardcoded-colour", file, i + 1,
        `${hex[0]} — use a theme token (--color-primary/--color-gray/--color-white/…).`);
    }

    const rgba = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(code);
    if (rgba) {
      const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map(Number);
      if (!(r === g && g === b)) {
        add("ERROR", "hardcoded-colour", file, i + 1,
          `${rgba[0]}…) is a tinted literal — use a theme token. Neutral rgba (shadows) is fine.`);
      }
    }
  });
}

/* ------------------------------ 1b. hardcoded colour outside the stylesheets
 * The check above reads .css and nothing else, so a colour written into a
 * component or an SVG was invisible to it — and to theme:check, which only
 * reads tokens. Same rule, same intent: a TINTED literal is the finding.
 *
 * themes.js and config.js are the palette, so literals there are the point. */

const isNeutralHex = hex => {
  const h = hex.replace("#", "");
  const pairs = h.length <= 4
    ? [...h.slice(0, 3)].map(c => c + c)
    : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  return pairs[0] === pairs[1] && pairs[1] === pairs[2];
};

for (const file of markupFiles) {
  if (!/\.(jsx?|html)$/.test(file)) continue;
  if (/(^|[\\/])(themes|config)\.js$/.test(file)) continue;
  // Comments are stripped for the same reason the stylesheet pass strips them:
  // a note recording the value it replaced is prose about a colour, not a
  // colour being used. Line count is preserved so the report still points at
  // the right line. A `//` not preceded by a colon, so a `https://…` URL does
  // not blank the rest of its line and take a real finding with it.
  const text = stripComments(fs.readFileSync(file, "utf8"))
    .replace(/(?<!:)\/\/[^\n]*/g, m => " ".repeat(m.length));
  text.split("\n").forEach((code, i) => {
    // Not preceded by `&`: an HTML numeric entity is a code point, not a
    // colour. `&#128161;` is the light-bulb emoji in Visualization.jsx and was
    // reported as the hex #128161 until this landed.
    for (const m of code.matchAll(/(?<!&)#[0-9a-fA-F]{3,8}\b/g)) {
      if (isNeutralHex(m[0])) continue;
      add("ERROR", "hardcoded-colour", file, i + 1,
        `${m[0]} in markup — use a theme token, or read one off the computed style at runtime.`);
    }
    for (const m of code.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) {
      const [r, g, b] = [m[1], m[2], m[3]].map(Number);
      if (r === g && g === b) continue;
      add("ERROR", "hardcoded-colour", file, i + 1,
        `${m[0]}…) in markup is a tinted literal — use a theme token.`);
    }
  });
}

/* ----------------------------------------------------------- 2. unused CSS
 * Substring search against all markup, matching how these classes are actually
 * built (template strings, concatenation). Heuristic by nature: a name that is
 * only ever assembled at runtime will look unused. */

const IGNORE_UNUSED = /^(is-|has-|u-|active|selected|open|collapsed|dimmed|on$|hovered|mirror)/;

/* Where a class sits in the selector decides what its being dead MEANS.
 *
 * A class inside :not() / :is() / :where() / :has() is a guard, not a target.
 * If the guard's class is gone from the markup the rule still applies to
 * everything it always did — the guard has merely become a no-op — so the fix
 * is to drop the guard and KEEP the rule. Deleting the rule instead silently
 * removes styling from everything that still matches.
 *
 * One level of nesting, which is all this repo's selectors use. */
const GUARD_RE = /:(?:not|is|where|has)\(([^()]*)\)/g;
const CLASS_RE = /\.[a-zA-Z][\w-]+/g;
const classesIn = str => (str.match(CLASS_RE) || []).map(c => c.slice(1));

for (const file of cssFiles) {
  const text = fs.readFileSync(file, "utf8");

  // name -> first line seen as a target, and as a guard. A class used as a
  // target anywhere in the file is judged as a target, even if some other rule
  // also guards on it.
  const where = new Map();
  const at = name => {
    if (!where.has(name)) where.set(name, { target: null, guard: null });
    return where.get(name);
  };

  for (const rule of rules(text)) {
    const sel = rule.selector;
    for (const m of sel.matchAll(GUARD_RE)) {
      for (const name of classesIn(m[1])) {
        const e = at(name);
        if (e.guard === null) e.guard = rule.line;
      }
    }
    for (const name of classesIn(sel.replace(GUARD_RE, " "))) {
      const e = at(name);
      if (e.target === null) e.target = rule.line;
    }
  }

  for (const [name, e] of where) {
    if (IGNORE_UNUSED.test(name)) continue;
    /* Whole class token, not a substring. `.ts-remove` read as alive purely
       because the markup contained `ts-remove-wrap`, so three grid-placement
       rules keyed off a class no element carried and nothing reported it. A
       name assembled from a prefix is handled below, deliberately separately —
       that check knows it is looking at a prefix; this one must not. */
    if (new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(markupText)) continue;

    /* A name assembled at runtime never appears literally. Two shapes:
       a BEM-ish modifier concatenated onto its base, and a template hole —
       `gr-control-card-${tone}` builds gr-control-card-a..d, none of which is
       a substring of anything in the markup.

       Cut at every dash and test the prefix with the dash and without it: the
       hole in `gr-control-card-${…}` sits AFTER the dash, so a prefix that
       stops before it never matches. Three characters minimum, or a prefix
       short enough to appear by accident marks half the sheet reachable. */
    const mod = name.indexOf("--");
    if (mod > 0 && markupText.includes(name.slice(0, mod + 2))) continue;

    let built = false;
    for (let i = name.length; i > 0 && !built; i--) {
      if (i < name.length && name[i] !== "-") continue;
      for (const prefix of [name.slice(0, i), name.slice(0, i) + "-"]) {
        if (prefix.replace(/-$/, "").length < 3) continue;
        const p = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`${p}\\$\\{`).test(markupText) || new RegExp(`${p}["'\\s]*\\+`).test(markupText)) {
          built = true; break;
        }
      }
    }
    if (built) continue;

    if (e.target !== null) {
      add("WARN", "unused-css", file, e.target,
        `.${name} has no reference in src/ or the root scripts — likely dead.`);
    } else {
      add("WARN", "stale-guard", file, e.guard,
        `.${name} is gone from the markup but is only used here to EXCLUDE. ` +
        `The rule still applies — drop the :not(.${name}) and keep it. Do not delete the rule.`);
    }
  }
}

/* --------------------------------------------- 3. breakpoint drift (JS <-> CSS)
 * The nav is told which layout it is in by JS and painted by CSS, so the two
 * have to name the same breakpoint. For a while they did not: isMobileViewport()
 * said 1024px while every @media said 768px, and each tablet in between got the
 * mobile branch of the component tree under desktop styling — a combination
 * neither side had rules for. Nothing caught it, because nothing read both.
 *
 * shared.jsx now builds MOBILE_MEDIA_QUERY out of named constants, and app.css
 * opens its mobile blocks with that same string. This is the invariant: the
 * query JS builds must exist verbatim as an @media prelude. Verbatim, not
 * equivalent — a differently-spelled query selects the same viewports today and
 * is exactly what drifts the next time one side alone is edited. */

const BREAKPOINT_SOURCE = path.join(COMPONENT_DIR, "shared.jsx");

/** `const NAME = 123;` declarations in a source file, as name -> literal. */
function numericConsts(src) {
  const out = new Map();
  for (const m of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/** Every @media prelude in the stylesheets, with where it was seen, plus the
 *  raw px numbers they test. */
const mediaPreludes = new Map();
const cssBreakpoints = new Set();
for (const file of cssFiles) {
  const text = stripComments(fs.readFileSync(file, "utf8"));
  for (const m of text.matchAll(/@media([^{]*)\{/g)) {
    const prelude = m[1].trim().replace(/\s+/g, " ");
    if (!mediaPreludes.has(prelude)) mediaPreludes.set(prelude, []);
    mediaPreludes.get(prelude).push({ file, line: lineAt(text, m.index) });
    for (const px of prelude.matchAll(/\((?:min|max)-(?:width|height):\s*(\d+)px\)/g)) {
      cssBreakpoints.add(px[1]);
    }
  }
}

if (fs.existsSync(BREAKPOINT_SOURCE)) {
  const src = fs.readFileSync(BREAKPOINT_SOURCE, "utf8");
  const decl = /MOBILE_MEDIA_QUERY\s*=\s*`([^`]*)`/.exec(src);

  if (!decl) {
    add("ERROR", "breakpoint-drift", BREAKPOINT_SOURCE, 1,
      "MOBILE_MEDIA_QUERY is gone. The mobile breakpoint is shared with app.css " +
      "through that constant — without it, nothing holds JS and CSS together.");
  } else {
    /* Fill the template holes from the constants declared alongside it. Only
       `${NAME}` is understood, and an unresolvable hole is reported rather than
       skipped: a check that quietly passes when it cannot read its own input is
       worse than no check, because the badge still says clean. */
    const unresolved = [];
    const consts = numericConsts(src);
    const query = decl[1].replace(/\$\{([^}]*)\}/g, (whole, expr) => {
      const name = expr.trim();
      if (consts.has(name)) return consts.get(name);
      unresolved.push(whole);
      return whole;
    });

    if (unresolved.length) {
      add("ERROR", "breakpoint-drift", BREAKPOINT_SOURCE, lineAt(src, decl.index),
        `cannot resolve ${unresolved.join(", ")} in MOBILE_MEDIA_QUERY, so the query ` +
        "it builds cannot be compared against app.css. Keep it a template over " +
        "plain numeric consts declared in this file.");
    } else {
      if (!mediaPreludes.has(query)) {
        add("ERROR", "breakpoint-drift", BREAKPOINT_SOURCE, lineAt(src, decl.index),
          `JS builds "@media ${query}" but no rule in src/styles opens with it. ` +
          "The nav reads this query and is painted by those blocks, so viewports " +
          "between the two versions land in a state neither side styles. Update " +
          "whichever side is stale — the string has to match character for character.");
      }

      /* Finding the query SOMEWHERE is too weak on its own: four stylesheets
         open with it, and editing one of them leaves the other three matching
         so the check above still passes. What actually needs holding is that
         the breakpoint has exactly one spelling.

         A `max-height` arm is how this codebase says "mobile" — no other rule
         has a reason to test viewport height — so every prelude carrying one
         must be the shared query or its landscape half, which 80-mobile.css
         uses alone to reach landscape phones only. Anything else is a second
         opinion about which viewports are mobile, and shared.jsx cannot
         follow it. (min-height is untouched: 00-base.css tests it for very
         large displays, which is a different question.) */
      const sanctioned = new Set([query, ...query.split(",").map(part => part.trim())]);
      for (const [prelude, sites] of mediaPreludes) {
        if (!/max-height:/.test(prelude) || sanctioned.has(prelude)) continue;
        for (const site of sites) {
          add("ERROR", "breakpoint-drift", site.file, site.line,
            `@media ${prelude} tests viewport height, which in this codebase means ` +
            `it is spelling the mobile breakpoint — but not the way shared.jsx does. ` +
            `Use "${query}", or its landscape half alone for landscape-only rules.`);
        }
      }
    }
  }
}

/* The same drift written the other way: a viewport number compared straight off
   `window` that no media query tests. Heuristic, because not every read of
   innerWidth is a layout breakpoint — but a layout one belongs in the shared
   query, where the stylesheet can see it. */

for (const file of markupFiles) {
  if (!/\.jsx?$/.test(file)) continue;
  const src = stripComments(fs.readFileSync(file, "utf8"))
    .replace(/(?<!:)\/\/[^\n]*/g, m => " ".repeat(m.length));
  const consts = numericConsts(src);
  for (const m of src.matchAll(/\binner(Width|Height)\s*(?:<=|<|>=|>)\s*([A-Za-z_$][\w$]*|\d+)/g)) {
    const value = /^\d+$/.test(m[2]) ? m[2] : consts.get(m[2]);
    if (value === undefined || cssBreakpoints.has(value)) continue;
    add("WARN", "breakpoint-drift", file, lineAt(src, m.index),
      `inner${m[1]} is compared against ${value}px, which no @media in src/styles tests. ` +
      "If that is a layout breakpoint it belongs in MOBILE_MEDIA_QUERY, so CSS shares it.");
  }
}

/* -------------------------------------------------------------- report out */

const order = { ERROR: 0, WARN: 1 };
findings.sort((a, b) =>
  order[a.level] - order[b.level] ||
  a.check.localeCompare(b.check) ||
  a.file.localeCompare(b.file));

const errors = findings.filter(f => f.level === "ERROR");
const warns = findings.filter(f => f.level === "WARN");

if (!findings.length) {
  console.log("✅ UI audit clean — no system violations found.");
  process.exit(0);
}

// Dead CSS is real but long-tailed. Listing it every run buries the actionable
// findings, so it collapses to a count unless asked for.
const showUnused = process.argv.includes("--unused");
const unused = findings.filter(f => f.check === "unused-css");
const shown = showUnused ? findings : findings.filter(f => f.check !== "unused-css");

let lastCheck = "";
for (const f of shown) {
  if (f.check !== lastCheck) {
    console.log(`\n── ${f.check} ─────────────────────────────`);
    lastCheck = f.check;
  }
  const tag = f.level === "ERROR" ? "❌" : "⚠️ ";
  console.log(`${tag} ${rel(f.file)}:${f.line}\n   ${f.message}`);
}

if (!showUnused && unused.length) {
  console.log(`\n── unused-css ─────────────────────────────`);
  console.log(`   ${unused.length} class(es) with no reference in the markup.`);
  console.log(`   Re-run with --unused to list them.`);
}

console.log(`\n${errors.length} error(s), ${warns.length} warning(s).`);
console.log("ERROR = deterministic violation. WARN = read it first; some are legitimate.");
process.exit(errors.length ? 1 : 0);

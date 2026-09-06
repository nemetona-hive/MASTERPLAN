"use strict";

/*
 * MASTERPLAN UI system audit.
 *
 * Mechanical conformance checks over src/styles/*.css and the markup that
 * references it.
 *
 * Ported from MONEYFLOW's audit, deliberately as a subset. That version also
 * checks the money-grid --mg-* token system, which does not exist here — grep
 * src/styles for --mg- and you get nothing — so those checks would only ever
 * emit noise about rules that are correct.
 *
 * Its four --ctl-* control-tier checks are a different case and ARE owed: this
 * repo grew that system after the first port and now has 80-odd --ctl-* uses
 * and a documented tier table, with nothing mechanically holding a control to
 * it. They are the next thing to bring over.
 *
 * Findings are split by confidence:
 *   ERROR - deterministic. A theme token exists for this and a literal is used,
 *           or JS and the stylesheets disagree about the mobile breakpoint.
 *   WARN  - heuristic. Usually real, but read it before acting; a class only
 *           ever assembled at runtime looks dead when it is not.
 *
 * Usage: npm run audit:ui                 (exit 1 if any ERROR)
 *        npm run audit:ui -- --unused     (also list the dead-class tail)
 *        npm run audit:ui -- --undefined  (also list baselined styleless names)
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
   innerWidth is a layout breakpoint — but a layout one belongs in a shared
   query, where the stylesheet can see it.

   A number feeding an exported *_MEDIA_QUERY is exempt. That is a declared
   breakpoint with a name, which is the opposite of the ad-hoc literal this is
   looking for, and not every one of them has a CSS counterpart to match:
   COMPACT_NAV_MEDIA_QUERY collapses the sidebar, which is a JS state rather
   than a width, so no @media tests it and none should. Without the exemption
   the check punishes exactly the pattern it is meant to encourage. */

/** Constants interpolated into an exported `*_MEDIA_QUERY` in this file. */
function declaredBreakpointConsts(src) {
  const names = new Set();
  for (const q of src.matchAll(/[A-Z][A-Z0-9_]*_MEDIA_QUERY\s*=\s*`([^`]*)`/g)) {
    for (const hole of q[1].matchAll(/\$\{([^}]*)\}/g)) names.add(hole[1].trim());
  }
  return names;
}

for (const file of markupFiles) {
  if (!/\.jsx?$/.test(file)) continue;
  const src = stripComments(fs.readFileSync(file, "utf8"))
    .replace(/(?<!:)\/\/[^\n]*/g, m => " ".repeat(m.length));
  const consts = numericConsts(src);
  const declared = declaredBreakpointConsts(src);
  for (const m of src.matchAll(/\binner(Width|Height)\s*(?:<=|<|>=|>)\s*([A-Za-z_$][\w$]*|\d+)/g)) {
    if (declared.has(m[2])) continue;
    const value = /^\d+$/.test(m[2]) ? m[2] : consts.get(m[2]);
    if (value === undefined || cssBreakpoints.has(value)) continue;
    add("WARN", "breakpoint-drift", file, lineAt(src, m.index),
      `inner${m[1]} is compared against ${value}px, which no @media in src/styles tests ` +
      "and which is not a named *_MEDIA_QUERY. If it is a layout breakpoint, declare it " +
      "as one so CSS can share it.");
  }
}

/* --------------------------------------------- 4. markup with no CSS
 * The mirror of check 2, and the reason it exists: check 2 finds CSS nothing
 * uses, which is tidiness. This finds markup naming a rule nothing defines,
 * which is a bug — the element renders with none of the styling its name
 * implies, and nothing else in `verify` looks in this direction. Tests assert
 * structure, theme:check reads tokens, and neither reads markup against CSS.
 *
 * WARN rather than ERROR, matching check 2's confidence. A class can be
 * legitimately styleless, so two exemptions are automatic and neither is a
 * list somebody maintains:
 *
 *   - a name the SUITE selects on is a deliberate hook, and reading tests/ for
 *     it keeps the exemption honest — the class is spared because something
 *     actually depends on it.
 *   - a BEM anchor: a base whose modifier carries the styling, or a modifier
 *     on a styled base. Deleting either half leaves the other naming a thing
 *     that no longer exists.
 *
 * Vendor CSS is read too, so Font Awesome's classes resolve.
 *
 * Only LITERAL class names are checked. Anything assembled at runtime is
 * invisible here, which is the safe direction to be wrong in: this can miss a
 * broken class and must never invent one.
 */

const vendorDir = path.join(ROOT, "vendor");
const vendorCss = fs.existsSync(vendorDir) ? walk(vendorDir, ".css") : [];

// Any appearance in a selector counts as defining a class, guard position
// included: `.ctl-ghost:not(.on)` means something styles that name.
const definedClasses = new Set();
for (const file of [...cssFiles, ...vendorCss]) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/\.([a-zA-Z][\w-]*)/g)) definedClasses.add(m[1]);
}

/* Pulls the literal class names out of one file.
 *
 * Two forms: a plain attribute, and the string literals inside a
 * `className={...}` expression — the array-and-filter shape this repo uses for
 * conditional classes (see `Icon` in shared.jsx) puts real class names in
 * quotes there. Strings from anywhere else in the file are ignored, so a
 * `direction === "V"` comparison cannot be mistaken for a class. */
function literalClassNames(text) {
  const found = [];
  const push = (value, index) => {
    for (const name of value.split(/\s+/)) {
      if (name) found.push({ name, index });
    }
  };

  for (const m of text.matchAll(/(?:className|class)\s*=\s*"([^"]*)"/g)) {
    push(m[1], m.index);
  }

  // className={ ... }, brace-matched so a nested object or ternary cannot end
  // the region early.
  const re = /className\s*=\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < text.length && depth > 0) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") depth--;
      i++;
    }
    const expr = text.slice(start, i - 1);
    for (const lit of expr.matchAll(/"([^"]*)"/g)) {
      // A fragment being concatenated onto is not a class name yet.
      if (lit[1].endsWith("-")) continue;
      /* `page === "home"` and `direction === "V"` sit inside className
         expressions and are operands, not class names. Reading them as classes
         is how this check invents work that does not exist. */
      const before = expr.slice(0, lit.index).trimEnd();
      const after = expr.slice(lit.index + lit[0].length).trimStart();
      if (/[=!]==?$/.test(before) || /^[=!]==?/.test(after)) continue;
      push(lit[1], m.index + lit.index);
    }
  }
  return found;
}

const TEST_DIR = path.join(ROOT, "tests");
const testText = fs.existsSync(TEST_DIR)
  ? walk(TEST_DIR, ".jsx").concat(walk(TEST_DIR, ".js"))
      .map(f => fs.readFileSync(f, "utf8")).join("\n")
  : "";

/* Two BEM shapes are styleless on purpose and are not findings.
 *
 * A BASE whose modifier is styled: the base carries nothing and
 * `.base--variant` carries the colour. Dropping the base would leave the
 * modifier naming a thing that no longer exists.
 *
 * A MODIFIER on a styled base: one half removes a border the base draws, so
 * its opposite has nothing to say and exists to mark the pair. Deleting one
 * half of a symmetry is how the other half stops making sense. */
function isBemAnchor(name) {
  const mod = name.indexOf("--");
  if (mod > 0 && definedClasses.has(name.slice(0, mod))) return true;
  for (const defined of definedClasses) {
    if (defined.startsWith(`${name}--`)) return true;
  }
  return false;
}

/* Names reviewed and deliberately left styleless.
 *
 * The baseline is what makes this a tripwire: anything reported is new. Add a
 * name only after deciding it is styleless on purpose — a test hook and a BEM
 * anchor are both exempt already, so the bar for landing here is high.
 * `--undefined` lists every finding, baselined or not, with its reason.
 *
 * MONEYFLOW keeps this as a flat array of names, with the reasoning in prose in
 * the script. That works while the list is empty, which theirs is. Ours is not,
 * so it is an OBJECT of name -> reason instead: an exemption whose reason lives
 * somewhere else is one nobody re-reads, and an exemption nobody re-reads just
 * hides the check. */
const BASELINE_FILE = path.join(__dirname, "undefined-class-baseline.json");
const baselineReasons = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : {};
const baseline = new Set(Object.keys(baselineReasons));

const stillUndefined = new Set();

for (const file of markupFiles) {
  const text = fs.readFileSync(file, "utf8");
  const seen = new Set();
  for (const { name, index } of literalClassNames(text)) {
    if (definedClasses.has(name) || seen.has(name)) continue;
    if (testText.includes(name)) continue;
    if (isBemAnchor(name)) continue;
    seen.add(name);
    stillUndefined.add(name);
    // `--undefined` shows the reviewed ones too, so the list can be re-read.
    if (baseline.has(name)) {
      if (!process.argv.includes("--undefined")) continue;
      add("WARN", "undefined-class", file, lineAt(text, index),
        `.${name} is styleless on purpose — ${baselineReasons[name]}`);
      continue;
    }
    add("WARN", "undefined-class", file, lineAt(text, index),
      `.${name} is in the markup and no stylesheet defines it — ` +
      `the element gets none of the styling the name implies.`);
  }
}

// A baseline that outlives what it excused starts hiding real findings. If a
// name has been styled or deleted since it was reviewed, say so.
for (const name of baseline) {
  if (!stillUndefined.has(name)) {
    add("WARN", "stale-baseline", BASELINE_FILE, 1,
      `.${name} is in the baseline but is no longer an undefined class — ` +
      `it has been styled or removed. Drop it from the list.`);
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
/* undefined-class is NOT collapsed with the dead-CSS tail. A collapsed count
   moving from 3 to 4 is not something anyone reads, and this is the half that
   finds bugs rather than untidiness. */
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

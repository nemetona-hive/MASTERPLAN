import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { STYLE_SOURCES } = require("../scripts/build-styles.js");
const ROOT = path.resolve(import.meta.dirname, "..");

/* An unbalanced brace is the one CSS defect that is both silent and total: the
   browser folds every following rule into the unclosed block, so a stylesheet
   edited near the top takes out every page whose styles load after it. Nothing
   else here catches it — the audit uses its own scanner, and jsdom applies no
   CSS at all, so a page can render byte-identical DOM while looking destroyed.
   That is exactly how a regex that ate a media query's closing brace shipped. */
function scan(css) {
  let depth = 0, min = 0, i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      i += 1;
      while (i < css.length) {
        if (css[i] === "\\") i += 2;
        else if (css[i] === quote || css[i] === "\n") { i += 1; break; }
        else i += 1;
      }
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") { depth -= 1; if (depth < min) min = depth; }
    i += 1;
  }
  return { depth, min };
}

describe("stylesheet integrity", () => {
  for (const rel of STYLE_SOURCES) {
    it(`${rel.split("/").pop()} closes every block it opens`, () => {
      const { depth, min } = scan(fs.readFileSync(path.join(ROOT, rel), "utf8"));
      expect(depth, "unclosed blocks at end of file").toBe(0);
      expect(min, "closes more blocks than it opens").toBe(0);
    });
  }

  it("the generated bundle is balanced too", () => {
    const { depth, min } = scan(fs.readFileSync(path.join(ROOT, "app.css"), "utf8"));
    expect(depth).toBe(0);
    expect(min).toBe(0);
  });

  /*
   * An absolutely positioned element needs its containing block to say so, and
   * nothing in a jsdom suite can see where a box actually landed.
   *
   * This shipped broken once: .header-actions is pinned to .app-head's right
   * edge, .app-head carried no `position`, and the cluster resolved against the
   * viewport — `top: 50%` put it halfway down the page. 80-mobile.css sets
   * position: relative on .app-head, so it was correct below 768px and wrong
   * everywhere above. It reached a user because the browser checks measured the
   * buttons' own boxes and the logo's centring, and never asked the one
   * question that mattered: is the cluster inside the header.
   */
  it("a pinned cluster has a containing block to pin to", () => {
    const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
    const rule = css.match(/(?:^|\})\s*\.app-head\s*\{([^}]*)\}/);
    expect(rule, ".app-head rule not found").toBeTruthy();
    expect(rule[1]).toMatch(/position:\s*relative/);
  });

  it("every var() the bundle reads is defined in it", () => {
    // A typo'd token is silent in the same way: the declaration is simply
    // dropped and the control renders with no fill or no height.
    const css = fs.readFileSync(path.join(ROOT, "app.css"), "utf8");
    const used = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map(m => m[1]));
    const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
    // Set at runtime by applyTheme rather than declared in the sheet.
    const themeSource = fs.readFileSync(path.join(ROOT, "themes.js"), "utf8");
    for (const m of themeSource.matchAll(/'(--[a-z0-9-]+)'\s*:/g)) defined.add(m[1]);
    /* Set per element by the markup, so no stylesheet can declare it and the
       check would report it forever. Each needs a reason, because an exemption
       that is wrong just hides the typo this test exists to catch.

       --i  the cloned shape's index in the wordmark, written by LogoLayer
            (App.jsx) so the molten-lift stagger has something to multiply. */
    const FROM_MARKUP = new Set(["--i"]);
    for (const name of FROM_MARKUP) defined.add(name);
    expect([...used].filter(v => !defined.has(v))).toEqual([]);
  });
});

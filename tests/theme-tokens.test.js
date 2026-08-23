import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const themesSource = fs.readFileSync(path.join(ROOT, "themes.js"), "utf8");
const THEMES = new Function(`${themesSource}\n;return THEMES;`)();

// themes.js is the palette. Two other places restate parts of it, and both had
// silently drifted before these tests existed: scripts/check-theme-contrast.js
// carried a whole stale copy and passed every run against colours no visitor
// ever saw, and :root in 00-base.css — the fallback the page renders with
// before applyTheme runs — disagreed with naviPro on --text-subtle.
describe("theme palette", () => {
  const themeNames = Object.keys(THEMES);

  it("defines the same token set in every theme", () => {
    const reference = Object.keys(THEMES[themeNames[0]].colors).sort();
    for (const name of themeNames) {
      expect(Object.keys(THEMES[name].colors).sort(), `${name} token set`).toEqual(reference);
    }
  });

  it("uses six-digit hex everywhere, so the contrast check can read it", () => {
    for (const name of themeNames) {
      for (const [token, value] of Object.entries(THEMES[name].colors)) {
        expect(value, `${name} ${token}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it("keeps the :root fallback in step with the default theme", () => {
    // Before applyTheme runs there is no data-theme attribute, so whatever
    // :root says is what the first paint uses. If it disagrees with the theme
    // that is about to be applied, the page flashes the wrong colours.
    const base = fs.readFileSync(path.join(ROOT, "src", "styles", "00-base.css"), "utf8");
    const rootBlock = base.slice(base.indexOf(":root"), base.indexOf("}", base.indexOf(":root")));
    const rootValues = Object.fromEntries(
      [...rootBlock.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)]
        .map(m => [m[1], m[2].toLowerCase()])
    );

    const defaultTheme = THEMES[themeNames[0]].colors;
    for (const [token, value] of Object.entries(defaultTheme)) {
      if (!(token in rootValues)) continue;
      expect(rootValues[token], `:root ${token} vs ${themeNames[0]}`).toBe(value.toLowerCase());
    }
  });

  it("has no second copy of the palette in the contrast checker", () => {
    // The checker reads themes.js now. If a literal palette reappears there,
    // it will drift again — that is exactly how the last one got away.
    const checker = fs.readFileSync(path.join(ROOT, "scripts", "check-theme-contrast.js"), "utf8");
    const literals = checker.match(/#[0-9a-fA-F]{6}/g) || [];
    expect(literals, "hex literals in check-theme-contrast.js").toEqual([]);
  });
});

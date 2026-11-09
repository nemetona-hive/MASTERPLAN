import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { checkFonts, parseFaces, parseUnicodeRange } = require("../scripts/check-fonts.js");
const { describeFont } = require("../scripts/woff2.js");

const ROOT = path.resolve(import.meta.dirname, "..");
const VENDOR = path.join(ROOT, "vendor", "fonts");
const TOKENS = path.join(ROOT, "src", "styles", "00-base.css");

// fonts.css makes claims about binaries that nothing in the browser checks:
// a wrong weight is clamped in silence, a missing letter drops to a system
// face. These pin the reader and the rules against real woff2 files. Faults
// are planted in a temp copy — no test writes a tracked file.

describe("describeFont", () => {
  it("reads a variable font's wght axis, not its default instance", () => {
    const plex = describeFont(path.join(VENDOR, "ibmplexsans-latin-wght.woff2"));
    expect(plex.family).toBe("IBM Plex Sans");
    expect(plex.variable).toBe(true);
    expect(plex.weight.max).toBe(700);
  });

  it("reads Google's trimmed JetBrains Mono axis", () => {
    // fonts.gstatic.com cuts the axis to 400–800; faces declare 400–700.
    expect(describeFont(path.join(VENDOR, "jetbrainsmono-latin-wght.woff2")).weight).toEqual({ min: 400, max: 800 });
  });

  it("reads a static font's weight from OS/2 and its typographic family", () => {
    const inter = describeFont(path.join(VENDOR, "inter-latin-500.woff2"));
    expect(inter.family).toBe("Inter"); // name id 1 says "Inter Medium"
    expect(inter.variable).toBe(false);
    expect(inter.weight).toEqual({ min: 500, max: 500 });
  });

  it("reads the cmap: š is in latin-ext and not in latin", () => {
    const s = "š".codePointAt(0);
    expect(describeFont(path.join(VENDOR, "inter-latin-400.woff2")).codepoints.has(s)).toBe(false);
    expect(describeFont(path.join(VENDOR, "inter-latin-ext-400.woff2")).codepoints.has(s)).toBe(true);
  });
});

describe("parseFaces", () => {
  it("reads a weight range and a single weight", () => {
    const [a, b] = parseFaces(`
      @font-face { font-family: 'A'; font-weight: 400 600; src: url(a.woff2) format('woff2'); }
      /* @font-face { font-family: 'Commented'; } */
      @font-face { font-family: "B"; font-style: italic; font-weight: bold; src: url("b.woff2"); }`);
    expect(a).toMatchObject({ family: "A", style: "normal", weight: { min: 400, max: 600 }, src: "a.woff2" });
    expect(b).toMatchObject({ family: "B", style: "italic", weight: { min: 700, max: 700 }, src: "b.woff2" });
  });

  it("reads unicode-range lists, and no range as everything", () => {
    expect(parseUnicodeRange("U+0000-00FF, U+0131")).toEqual([[0, 255], [305, 305]]);
    expect(parseUnicodeRange(undefined)).toEqual([[0, 0x10ffff]]);
  });
});

describe("checkFonts", () => {
  it("passes on the vendored fonts", () => {
    const { findings, families } = checkFonts();
    expect(findings).toEqual([]);
    expect(families.sort()).toEqual(["IBM Plex Sans", "Inter", "JetBrains Mono"]);
  });

  describe("against a planted fault", () => {
    let dir;
    const copy = file => fs.copyFileSync(path.join(VENDOR, file), path.join(dir, file));
    const face = (family, weight, file, extra = "") =>
      `@font-face { font-family: '${family}'; font-weight: ${weight}; src: url(${file}); ${extra} }\n`;
    const run = css => {
      fs.writeFileSync(path.join(dir, "fonts.css"), css);
      return checkFonts({ fontDir: dir, tokenCss: TOKENS }).findings.map(f => `${f.where}: ${f.message}`).join("\n");
    };

    beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "mp-fonts-")); });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it("catches a variable font copied once per weight", () => {
      copy("jetbrainsmono-latin-wght.woff2");
      fs.copyFileSync(path.join(dir, "jetbrainsmono-latin-wght.woff2"), path.join(dir, "jetbrainsmono-500.woff2"));
      const out = run(face("JetBrains Mono", 400, "jetbrainsmono-latin-wght.woff2") +
        face("JetBrains Mono", 500, "jetbrainsmono-500.woff2"));
      expect(out).toMatch(/identical to/);
    });

    it("catches a static file declared at a weight it is not", () => {
      copy("inter-latin-400.woff2");
      expect(run(face("Inter", 700, "inter-latin-400.woff2"))).toMatch(/static 400/);
    });

    it("catches a family name that does not match the file", () => {
      copy("inter-latin-400.woff2");
      expect(run(face("IBM Plex Sans", 400, "inter-latin-400.woff2"))).toMatch(/the file is "Inter"/);
    });

    it("catches a missing greek subset as an undrawn φ", () => {
      copy("inter-latin-400.woff2");
      expect(run(face("Inter", 400, "inter-latin-400.woff2"))).toMatch(/no face draws .*"φ"/);
    });

    it("catches a missing latin-ext subset as undrawn letters", () => {
      copy("ibmplexsans-latin-wght.woff2");
      expect(run(face("IBM Plex Sans", "400 700", "ibmplexsans-latin-wght.woff2"))).toMatch(/no face draws "š"/);
    });

    it("catches subsets that offer different weights", () => {
      copy("ibmplexsans-latin-wght.woff2"); copy("ibmplexsans-latin-ext-wght.woff2");
      const out = run(face("IBM Plex Sans", "400 700", "ibmplexsans-latin-wght.woff2", "unicode-range: U+0000-00FF;") +
        face("IBM Plex Sans", "400 600", "ibmplexsans-latin-ext-wght.woff2", "unicode-range: U+0100-02BA;"));
      expect(out).toMatch(/subsets offer different weights/);
    });

    it("catches an orphan file and a face pointing at nothing", () => {
      copy("inter-latin-400.woff2");
      const out = run(face("Inter", 400, "gone.woff2"));
      expect(out).toMatch(/inter-latin-400\.woff2: no @font-face uses this file/);
      expect(out).toMatch(/does not exist/);
    });

    it("catches a face that stops short of the weight scale", () => {
      // JetBrains Mono at 400 600 is how every --fw-bold figure drew semibold.
      copy("jetbrainsmono-latin-ext-wght.woff2");
      expect(run(face("JetBrains Mono", "400 600", "jetbrainsmono-latin-ext-wght.woff2"))).toMatch(/no face draws --fw-\* weight 700/);
    });

    it("catches a face reaching past the weight scale", () => {
      copy("jetbrainsmono-latin-ext-wght.woff2"); // its axis reaches 800
      expect(run(face("JetBrains Mono", "400 800", "jetbrainsmono-latin-ext-wght.woff2"))).toMatch(/past the heaviest/);
    });
  });
});

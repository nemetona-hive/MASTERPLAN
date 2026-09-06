import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// The audit is the gate for colour and dead CSS, so its own blind spots are
// the interesting thing. Both of these were live bugs: the first reported the
// light-bulb entity &#128161; as the colour #128161, and the second reported
// every gr-control-card-a..d as dead because the name is only ever assembled
// from `gr-control-card-${tone}` and so appears nowhere as a literal.
describe("audit-ui", () => {
  const run = () => {
    try {
      return execFileSync("node", [path.join(ROOT, "scripts", "audit-ui.js"), "--unused"],
        { cwd: ROOT, encoding: "utf8" });
    } catch (err) {
      return `${err.stdout || ""}${err.stderr || ""}`;
    }
  };

  it("passes on the current tree", () => {
    const out = run();
    expect(out).toMatch(/0 error\(s\)|UI audit clean/);
  });

  it("does not read an HTML numeric entity as a hex colour", () => {
    // Visualization.jsx renders &#128161; — if this regresses it reports as
    // "#128161 in markup".
    expect(fs.readFileSync(path.join(ROOT, "src", "Visualization.jsx"), "utf8"))
      .toContain("&#128161;");
    expect(run()).not.toContain("#128161");
  });

  /* ── undefined-class ────────────────────────────────────────────────────
   * The half that finds bugs rather than untidiness: markup naming a rule
   * nothing defines. These pin the two ways it could do damage — inventing a
   * finding out of a string that is not a class, and reporting a name the
   * suite itself depends on. */

  it("does not read a comparison operand inside className as a class", () => {
    // `areaMode === "dims"` and friends live inside className={...}
    // expressions all over this codebase.
    const out = run();
    for (const operand of ["dims", "direct", "corners", "avg", "home", "bottom"]) {
      expect(out, operand).not.toContain(`.${operand} is in the markup`);
    }
  });

  it("does not report a class the suite selects on", () => {
    // ts-grid-row carries styling, but the exemption exists for hooks that do
    // not — the rule is that something depending on a name is enough.
    const out = run();
    expect(out).not.toContain("ts-grid-row is in the markup");
  });

  it("keeps every baselined name reviewable, with its reason", () => {
    const baseline = JSON.parse(fs.readFileSync(
      path.join(ROOT, "scripts", "undefined-class-baseline.json"), "utf8"));
    // An exemption with no reason is one nobody can re-read, which is how a
    // baseline turns into a place findings go to be forgotten.
    for (const [name, reason] of Object.entries(baseline)) {
      expect(typeof reason, name).toBe("string");
      expect(reason.length, name).toBeGreaterThan(30);
    }
    // And --undefined has to actually surface them again.
    const listed = execFileSync("node",
      [path.join(ROOT, "scripts", "audit-ui.js"), "--undefined"],
      { cwd: ROOT, encoding: "utf8" });
    for (const name of Object.keys(baseline)) {
      expect(listed, name).toContain(`.${name} is styleless on purpose`);
    }
  });

  /* ── the two contrast checks a pair test structurally cannot make ────── */

  it("catches a word painted in an edge token, through an alias", () => {
    // --color-gray-light IS --border. Matching on the token name alone only
    // ever catches the honest spellings, and both real findings here were
    // wearing the alias.
    const base = fs.readFileSync(path.join(ROOT, "src", "styles", "00-base.css"), "utf8");
    expect(base).toMatch(/--color-gray-light:\s*var\(--border\)/);

    const probe = path.join(ROOT, "src", "styles", "99-audit-probe.css");
    fs.writeFileSync(probe, ".probe-edge { color: var(--color-gray-light); }\n");
    try {
      const out = run();
      expect(out).toContain("text-in-edge-token");
      expect(out).toContain("which is --border");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("catches text dimmed with opacity, in a stylesheet and inline", () => {
    const probe = path.join(ROOT, "src", "styles", "99-audit-probe.css");
    fs.writeFileSync(probe, ".probe-dim { opacity: 0.6; }\n");
    try {
      expect(run()).toContain("text-dimmed-with-opacity");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("exempts a keyframe, a disabled control, and a marked decoration", () => {
    const probe = path.join(ROOT, "src", "styles", "99-audit-probe.css");
    fs.writeFileSync(probe, [
      "@keyframes probe-fade { from { opacity: 0.2; } to { opacity: 1; } }",
      ".probe-off:disabled { opacity: 0.4; }",
      ".probe-mark {",
      "\t/* a drawn line, no words. audit-ui: decorative */",
      "\topacity: 0.5;",
      "}",
      ""
    ].join("\n"));
    try {
      // An animation's start state is not a resting state, WCAG exempts an
      // inactive control, and a marked decoration has given its reason.
      expect(run()).not.toContain("text-dimmed-with-opacity");
    } finally {
      fs.unlinkSync(probe);
    }
  });

  it("treats a class assembled from a template hole as reachable", () => {
    const gr = fs.readFileSync(path.join(ROOT, "src", "components", "GoldenRatio.jsx"), "utf8");
    expect(gr).toContain("gr-control-card-${tone}");
    const out = run();
    for (const tone of ["a", "b", "c", "d"]) {
      expect(out, `gr-control-card-${tone}`).not.toContain(`.gr-control-card-${tone} has no reference`);
      expect(out, `gr-preview-card-${tone}`).not.toContain(`.gr-preview-card-${tone} has no reference`);
    }
  });

  it("still reports a class that nothing builds", () => {
    // A guard against the reachability heuristic being loosened until it
    // marks everything alive: a name with no prefix in the markup must fail.
    //
    // audit-ui.js walks src/styles for *.css, so the probe goes into a scratch
    // file of its own rather than being appended to a tracked stylesheet. If
    // this process is killed mid-test the worst case is a stray untracked file,
    // not a corrupted source file. build-styles.js reads an explicit
    // STYLE_SOURCES list, so the scratch file never reaches app.css.
    const probe = path.join(ROOT, "src", "styles", "zz-audit-probe.tmp.css");
    try {
      fs.writeFileSync(probe, ".zzz-definitely-not-used { color: red; }\n");
      expect(run()).toContain(".zzz-definitely-not-used has no reference");
    } finally {
      fs.rmSync(probe, { force: true });
    }
  });
});

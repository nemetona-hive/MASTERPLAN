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
    const styles = path.join(ROOT, "src", "styles", "94-utilities.css");
    const original = fs.readFileSync(styles, "utf8");
    try {
      fs.writeFileSync(styles, `${original}\n.zzz-definitely-not-used { color: red; }\n`);
      expect(run()).toContain(".zzz-definitely-not-used has no reference");
    } finally {
      fs.writeFileSync(styles, original);
    }
  });
});

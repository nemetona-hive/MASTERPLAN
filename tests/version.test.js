import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildId, render, HASHED_FILES } from "../scripts/build-version.js";

const ROOT = path.resolve(import.meta.dirname, "..");

// The build id exists to answer "are the bytes online the bytes I have". Every
// property below is load-bearing for that, and the first one is load-bearing
// for githooks/pre-push: that hook rebuilds and refuses the push if any
// generated file moved, so a build id that changed on its own would wedge the
// gate shut permanently.
describe("build-version", () => {
  it("is deterministic — the same tree hashes the same twice", () => {
    expect(buildId()).toBe(buildId());
  });

  it("does not read a clock or the git history", () => {
    // The two tempting implementations, both of which break pre-push. Asserted
    // against the source because the behaviour they cause is invisible until a
    // push is blocked days later.
    const src = fs.readFileSync(path.join(ROOT, "scripts", "build-version.js"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/Date\.|Date\(|toISOString|now\(/);
    expect(code).not.toMatch(/execFile|execSync|spawn|rev-parse/);
  });

  it("changes when any hashed file changes", () => {
    const before = buildId();
    const target = path.join(ROOT, "app.css");
    const original = fs.readFileSync(target);
    try {
      fs.writeFileSync(target, Buffer.concat([original, Buffer.from("\n/* probe */\n")]));
      expect(buildId()).not.toBe(before);
    } finally {
      fs.writeFileSync(target, original);
    }
    expect(buildId()).toBe(before);
  });

  it("covers every generated file the deploy serves", () => {
    // If a build output is added without being hashed here, two different
    // deploys can carry the same id and deploy:check goes quietly wrong.
    for (const rel of ["index.html", "components.js", "app.css"]) {
      expect(HASHED_FILES).toContain(rel);
    }
    for (const rel of HASHED_FILES) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("folds the path in, so two files swapping contents do not collide", () => {
    const bytesOnly = files => {
      const h = crypto.createHash("sha256");
      for (const rel of files) h.update(fs.readFileSync(path.join(ROOT, rel)));
      return h.digest("hex").slice(0, 8);
    };
    // Same bytes in a different order hash the same without the path; the real
    // buildId must not agree with that weaker scheme.
    expect(buildId()).not.toBe(bytesOnly(HASHED_FILES));
  });

  it("writes a file the checker can parse and the browser can load", () => {
    const out = render("deadbeef");
    expect(out).toMatch(/const BUILD = \{ id: "deadbeef" \};/);
    // check-deploy.js reads the live file with this exact regex rather than
    // evaluating it — keep the two in step.
    expect(out.match(/const BUILD = \{ id: "([0-9a-f]+)" \}/)[1]).toBe("deadbeef");
  });

  it("matches the committed version.js", () => {
    // The same staleness githooks/pre-push blocks on, surfaced as a test so it
    // fails at commit time instead of at push time.
    const committed = fs.readFileSync(path.join(ROOT, "version.js"), "utf8");
    expect(committed).toBe(render(buildId()));
  });
});

"use strict";

const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = "components.js";

// React and ReactDOM are loaded as plain <script> tags in index.html, not
// bundled — src/react-globals.js re-exports those window globals so the source
// can import them like any other module. jsxFactory therefore has to name the
// global, since nothing imports the react package itself.
//
// ── Minified, and read through the sourcemap beside it ──────────────────────
//
// The bundle has always been minified: it is committed and GitHub Pages serves
// it, so every byte here is a byte every visitor downloads. What was missing is
// any way back to the source from it. A React warning names a component and a
// minified one is called `e`; a stack trace from the live site lands somewhere
// in column 40,000 of line 1 and tells you nothing.
//
// `sourcemap` writes components.js.map next to the bundle, and devtools reads
// the original src/ files through it — a trace lands on the line in the .jsx
// that raised it. `keepNames` is the part a sourcemap cannot do: React reads a
// component's name at runtime rather than resolving it from a position, so
// without it every warning in the console names `e` no matter what the map
// says. It costs a few KiB against a 250 KiB budget.
//
// The map is NOT committed — see .gitignore. Every other build output here is,
// because Pages serves the tree, but the map is 300 KiB of generated JSON
// rewritten in full on every build, three times the bundle it describes, and it
// would dominate the history of a repo whose diffs are otherwise source. The
// `//# sourceMappingURL` comment esbuild appends therefore points at a file the
// live site does not serve: harmless, because nothing requests it until someone
// opens devtools, and locally the map is always there next to the bundle.
const buildOptions = {
  entryPoints: [path.join(ROOT, "src/App.jsx")],
  bundle: true,
  format: "iife",
  outfile: path.join(ROOT, OUT_FILE),
  charset: "utf8",
  logLevel: "warning",
  keepNames: true,
  sourcemap: true,
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment"
};

async function build(options = {}) {
  await esbuild.build({ ...buildOptions, ...options });
}

if (require.main === module) {
  build({ minify: true })
    .then(() => process.stdout.write("Built components.js\n"))
    .catch(err => {
      process.stderr.write(`Build failed: ${err.message}\n`);
      process.exit(1);
    });
}

module.exports = {
  build,
  buildOptions
};

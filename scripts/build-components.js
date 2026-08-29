"use strict";

const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = "components.js";

// React and ReactDOM are loaded as plain <script> tags in index.html, not
// bundled — src/react-globals.js re-exports those window globals so the source
// can import them like any other module. jsxFactory therefore has to name the
// global, since nothing imports the react package itself.
const buildOptions = {
  entryPoints: [path.join(ROOT, "src/App.jsx")],
  bundle: true,
  format: "iife",
  outfile: path.join(ROOT, OUT_FILE),
  charset: "utf8",
  logLevel: "warning",
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

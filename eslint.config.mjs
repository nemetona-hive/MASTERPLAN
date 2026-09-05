/*
 * A linter, kept deliberately narrow.
 *
 * Ported from MONEYFLOW, which added one for a reason that applies here with
 * less cover: this repo has no TypeScript and had no linter, so every refactor
 * was verified by running the suite and looking. MONEYFLOW could half-afford
 * that with 1200-odd tests behind it. MASTERPLAN has sixteen test files and
 * four audit checks, and none of them can see a stale hook dependency or a name
 * that stopped existing, because both are still valid JavaScript.
 *
 * The rules here are the ones that catch a real defect, and none of the ones
 * that have an opinion about style. Formatting is not enforced anywhere in this
 * project and this is not the place to start: a lint run that reports on
 * indentation is a lint run nobody reads to the end of.
 *
 * It is NOT in pre-commit. That hook is a build, audit:ui and the suite, about
 * a second, and it stays that way. This runs in `npm run verify`, beside the
 * other checks that are worth waiting for.
 *
 * ── Where this diverges from MONEYFLOW's copy ──────────────────────────────
 *
 * The root classic scripts are linted here and are not there. MONEYFLOW's
 * config.js and themes.js are matched by no block and so get no rules;
 * MASTERPLAN's four carry more than a palette. simulation.js alone is the
 * layout maths — the largest body of pure logic in the repo, and the only one
 * not under src/. All four are already treated as source by pre-commit, which
 * rebuilds and reruns the suite when any of them is staged, because each is
 * hashed into the build id and read by the tests as a global. Leaving the file
 * that computes every layout out of the one check that reads for dead names
 * would be leaving out the part that matters.
 *
 * There is no server/ block: this app has no server. scripts/local-dev-server.js
 * is CommonJS like the rest of scripts/ and is covered there.
 */
import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/* index.html loads version.js, config.js, simulation.js and themes.js as
   classic scripts before components.js, so their top-level consts are globals
   that src/ reads without importing. tests/setup.js discovers the same names by
   parsing those four files; this list is hand-kept because ESLint needs them
   statically, so a new global read from src/ has to be added here too — the
   symptom is a no-undef on the name. */
const APP_GLOBALS = {
  // version.js
  BUILD: "readonly",
  // config.js
  ICONS: "readonly", PAGES: "readonly", SYSTEMS: "readonly",
  PAL_CLASSES: "readonly", SUMMARY_LABELS: "readonly",
  DEFAULT_SH: "readonly", DEFAULT_SYM: "readonly", DEFAULT_GR: "readonly",
  DEFAULT_MATERIAL_PRESETS: "readonly", DEFAULT_CONCRETE_PRESETS: "readonly",
  fmt: "readonly", fmtFixed: "readonly",
  getDescription: "readonly", getSegmentClass: "readonly",
  canSaveStaticDefaults: "readonly", saveStaticDefaults: "readonly",
  // simulation.js
  simulate: "readonly", computeS0: "readonly", computeS1: "readonly",
  computeS2: "readonly", computeS3: "readonly", computeS4: "readonly",
  makeStats: "readonly", countSegs: "readonly", sumSegWidth: "readonly",
  gapWidth: "readonly", exceedsSimCap: "readonly", MAX_SIM_STEPS: "readonly",
  symEdge: "readonly", mkRowHeights: "readonly", getSourceId: "readonly",
  simulateS4: "readonly", emptyLayoutResult: "readonly",
  cappedLayoutResult: "readonly", computeStandard: "readonly",
  // themes.js
  THEMES: "readonly", applyTheme: "readonly",
  getNextTheme: "readonly", getThemeOrder: "readonly"
};

const BROWSER_GLOBALS = {
  window: "readonly", document: "readonly", navigator: "readonly",
  localStorage: "readonly", location: "readonly", history: "readonly",
  fetch: "readonly", Blob: "readonly", URL: "readonly", URLSearchParams: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly",
  clearInterval: "readonly", requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly", console: "readonly", performance: "readonly",
  HTMLElement: "readonly", HTMLInputElement: "readonly", HTMLCanvasElement: "readonly",
  HTMLTextAreaElement: "readonly", HTMLAnchorElement: "readonly",
  SVGElement: "readonly", Element: "readonly", Image: "readonly",
  TextEncoder: "readonly", DOMParser: "readonly", getComputedStyle: "readonly",
  matchMedia: "readonly", MutationObserver: "readonly", ResizeObserver: "readonly",
  CustomEvent: "readonly", Event: "readonly", KeyboardEvent: "readonly",
  MouseEvent: "readonly", PointerEvent: "readonly", TouchEvent: "readonly",
  Node: "readonly", NodeFilter: "readonly", AbortController: "readonly",
  structuredClone: "readonly", queueMicrotask: "readonly"
};

const NODE_GLOBALS = {
  require: "readonly", module: "writable", exports: "writable",
  process: "readonly", __dirname: "readonly", __filename: "readonly",
  console: "readonly", Buffer: "readonly", setTimeout: "readonly",
  clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
  setImmediate: "readonly", URL: "readonly", TextEncoder: "readonly",
  TextDecoder: "readonly", fetch: "readonly", globalThis: "readonly",
  AbortController: "readonly", AbortSignal: "readonly"
};

/* The rules that pay for this file, shared by every block that holds app code.
   Correctness only — see the header. */
const CORRECTNESS = {
  "no-empty": ["error", { allowEmptyCatch: true }],
  "no-constant-binary-expression": "error",
  "no-self-compare": "error",
  "no-unmodified-loop-condition": "error",
  "no-template-curly-in-string": "warn"
};

export default [
  {
    ignores: [
      "node_modules/**",
      // Build output. components.js and app.css are committed here because
      // Pages serves the tree, but they are still generated and there is
      // nothing to fix in a minified bundle.
      "components.js",
      "components.js.map",
      "app.css",
      "vendor/**",
      "_temp_masterplan/**"
    ]
  },

  // ── The app: ES modules, JSX, browser + the classic-script globals ────────
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...BROWSER_GLOBALS, ...APP_GLOBALS }
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      /* Without this, no-unused-vars cannot see that a component is used: JSX
         compiles to React.createElement(Foo), and the plain rule reads `Foo` as
         an import nobody touched. That is how a linter gets turned off in its
         first week. */
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",

      /* The two this file was installed for. A stale dependency array is the
         bug class this codebase is most exposed to — the viewport listeners,
         the click-outside handlers and the timed-state cleanups in shared.jsx
         are all subscriptions inside effects — and it is invisible in a diff.
         A warning rather than an error: some are deliberate and documented, and
         a rule that fails the build on a considered decision gets switched off
         rather than read. */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // JSX compiles to React.createElement, so a component used only in markup
      // is not "unused" — but an unused import or variable still is.
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^React$" }],
      "no-undef": "error",

      ...CORRECTNESS
    }
  },

  /* The four classic scripts at the root. One shared runtime scope, loaded in
     index.html before the bundle, so `sourceType: "script"` and every name any
     of them defines is in scope for all of them — simulation.js reads `fmt`,
     `SUMMARY_LABELS` and `PAL_CLASSES` straight out of config.js.

     Two rules have to bend to that, both for the same reason — a top-level
     declaration in these files is an export, not a local:

     no-redeclare, because each file necessarily redeclares the names this
     block hands it as globals, and the rule would report every top-level const
     in all four as a redeclaration of itself.

     no-unused-vars in `vars: "local"` mode, because a name declared here is
     consumed from another file — `simulate` from Visualization.jsx, `BUILD`
     from shared.jsx — and nothing in this file can see that. Locals inside
     functions are still checked, which is where a dead name in the layout
     maths would actually hide. The dead-export check these files opt out of is
     `npm run analyze:code`, which reads the whole tree and can tell. */
  {
    files: ["config.js", "simulation.js", "themes.js", "version.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: { ...BROWSER_GLOBALS, ...APP_GLOBALS }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", vars: "local" }],
      "no-undef": "error",
      "no-redeclare": "off",
      ...CORRECTNESS
    }
  },

  // ── Build and check scripts: CommonJS, node globals ──────────────────────
  {
    files: ["scripts/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: NODE_GLOBALS },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none" }],
      ...CORRECTNESS
    }
  },

  // vitest.config.mjs and anything else ESM at the root.
  {
    files: ["*.mjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: NODE_GLOBALS },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none" }],
      ...CORRECTNESS
    }
  },

  /* The suite. Same language as src/, plus vitest's globals and the DOM the
     jsdom-environment files get. Linted for the same reason the app is: a test
     that references a name that no longer exists still parses, and a test that
     silently stops asserting is worse than no test. */
  {
    files: ["tests/**/*.js", "tests/**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...BROWSER_GLOBALS,
        ...NODE_GLOBALS,
        ...APP_GLOBALS,
        globalThis: "readonly",
        describe: "readonly", it: "readonly", expect: "readonly", vi: "readonly",
        beforeEach: "readonly", afterEach: "readonly",
        beforeAll: "readonly", afterAll: "readonly", test: "readonly"
      }
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      ...js.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["error", { args: "none", varsIgnorePattern: "^React$" }],
      // A test file redeclaring a helper is a real smell, but `const` shadowing
      // across describe blocks is idiomatic here and not worth failing over.
      "no-redeclare": "warn",
      ...CORRECTNESS
    }
  }
];

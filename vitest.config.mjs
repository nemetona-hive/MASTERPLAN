import { defineConfig } from "vitest/config";

// Tests live in tests/, deliberately not colocated under src/. audit-ui.js walks
// all of src/ and concatenates it to decide which CSS classes are still
// referenced; a test file mentioning a class name would keep a dead class alive.
export default defineConfig({
  // Mirror scripts/build-components.js. React is a vendored global here, not an
  // npm package, so the automatic JSX runtime would try to resolve
  // "react/jsx-dev-runtime" and fail on any util that imports shared.jsx.
  oxc: {
    jsx: {
      runtime: "classic",
      pragma: "React.createElement",
      pragmaFrag: "React.Fragment"
    }
  },
  test: {
    include: ["tests/**/*.test.js", "tests/**/*.test.jsx"],
    // Default is node; component tests opt into a DOM with a
    // `// @vitest-environment jsdom` docblock at the top of the file, so the
    // util suites stay fast and never pay for jsdom setup.
    environment: "node",
    setupFiles: ["tests/setup.js"],
    restoreMocks: true
  }
});

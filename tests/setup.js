// src/react-globals.js reads window.React / window.ReactDOM at module load and
// throws if either is missing, because in the real app React arrives from
// vendor/*.js as a global rather than as an npm import. Every component and any
// util that imports shared.jsx pulls that in, so the globals have to exist
// before a test file is imported.
//
// react/react-dom are devDependencies pinned to 18.3.1 — the same version as
// vendor/react.production.min.js. Keep them in step: if the vendored build is
// upgraded, upgrade these too, or tests start passing against a React the app
// does not actually run.
import React from "react";
import ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach } from "vitest";

globalThis.window = globalThis.window || {};
globalThis.window.React = React;
globalThis.window.ReactDOM = { ...ReactDOM, createRoot };

// index.html loads version.js, config.js, simulation.js and themes.js as
// classic scripts before components.js, so their top-level `const`s (BUILD,
// ICONS, PAGES, SYSTEMS, THEMES, simulate, …) are plain globals that the rest of
// the app reads without importing — shared.jsx's Icon reads ICONS that way, and simulation.js reads
// SUMMARY_LABELS and fmt straight out of config.js.
//
// Exposed for every test, not just the DOM ones, because the layout maths in
// simulation.js is a classic script too: it exports nothing and cannot be
// imported, so a plain-node test of computeS0/simulate has no other way in.
// None of the three touches document at load — only inside functions — so this
// is safe before jsdom exists.
//
// Names are discovered rather than hard-coded, so a new global added to any of
// the three files is picked up without editing this file. They are evaluated in
// order, and each file's names are published before the next runs, because
// simulation.js reads constants that config.js defines.
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = path.resolve(import.meta.dirname, "..");

  for (const file of ["version.js", "config.js", "simulation.js", "themes.js"]) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    const names = [...source.matchAll(/^(?:const|var|let|function)\s+([A-Za-z_$][\w$]*)/gm)]
      .map(match => match[1]);
    if (!names.length) continue;
    const expose = new Function(`${source}\n;return { ${names.join(", ")} };`);
    Object.assign(globalThis, expose());
  }
}

// Component tests declare `// @vitest-environment jsdom` per file; util tests
// run in plain node with no document. Only register DOM teardown when there is
// a DOM to tear down.
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  await import("@testing-library/jest-dom/vitest");
  afterEach(() => cleanup());

  // jsdom implements no layout, so scrollIntoView does not exist.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
  }
}

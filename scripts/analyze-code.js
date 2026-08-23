"use strict";

/* Read-only inventory. It reports candidates; it never deletes code. */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const sourceFiles = walk(SRC, file => /\.(js|jsx)$/.test(file));
const cssFiles = walk(path.join(SRC, "styles"), file => file.endsWith(".css"));
const sourceSet = new Set(sourceFiles);
const rel = file => path.relative(ROOT, file).replaceAll(path.sep, "/");
const searchableFiles = [
  ...walk(SRC, file => /\.(js|jsx)$/.test(file)),
  ...walk(path.join(ROOT, "tests"), file => /\.(js|jsx)$/.test(file)),
  ...walk(path.join(ROOT, "scripts"), file => file.endsWith(".js")),
  path.join(ROOT, "config.js"),
  path.join(ROOT, "simulation.js"),
  path.join(ROOT, "themes.js")
].filter(fs.existsSync);
const searchableText = searchableFiles.map(file => fs.readFileSync(file, "utf8")).join("\n");

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.json`, path.join(base, "index.js")];
  return candidates.find(candidate => sourceSet.has(candidate)) || null;
}

function importsFrom(file) {
  const text = fs.readFileSync(file, "utf8");
  const imports = [];
  const re = /(?:import(?:[\s\S]*?from\s*)?|require\s*\(\s*)["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(text))) imports.push(match[1]);
  return imports;
}

const entry = path.join(SRC, "App.jsx");
const reachable = new Set();
const missingImports = [];
const visit = file => {
  if (!file || reachable.has(file)) return;
  reachable.add(file);
  for (const specifier of importsFrom(file)) {
    const target = resolveImport(file, specifier);
    if (specifier.startsWith(".") && !target) missingImports.push(`${rel(file)} -> ${specifier}`);
    else if (target) visit(target);
  }
};
visit(entry);

const unreachable = sourceFiles.filter(file => !reachable.has(file));
const exportCandidates = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    const name = match[1];
    const references = searchableText.match(new RegExp(`\\b${name.replace(/[$]/g, "\\$&")}\\b`, "g")) || [];
    // One occurrence is the export declaration itself. Anything above one is
    // a repository reference (including a test import or a deliberate reuse).
    if (references.length <= 1) exportCandidates.push(`${rel(file)}: ${name}`);
  }
}

const buildStyles = fs.readFileSync(path.join(ROOT, "scripts", "build-styles.js"), "utf8");
const registeredStyles = new Set([...buildStyles.matchAll(/"(src\/styles\/[^"']+\.css)"/g)].map(match => match[1]));
const unregisteredStyles = cssFiles.map(rel).filter(file => !registeredStyles.has(file));

const config = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
// Only the PAGES array, not every `id:` in config.js — DEFAULT_GR's items are
// keyed a/b/c and would otherwise read as three undefined pages. Bracket
// matching rather than a regex, because PAGES opens `[{` on the declaration
// line and no cheap pattern finds the right closing bracket.
function arrayLiteral(text, name) {
  const open = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=\\s*\\[`).exec(text);
  if (!open) return "";
  const start = open.index + open[0].length - 1;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]" && --depth === 0) return text.slice(start, i + 1);
  }
  return "";
}
const pageIds = [...arrayLiteral(config, "PAGES").matchAll(/\bid:\s*["']([^"']+)["']/g)]
  .map(match => match[1]);

const routeIds = [...app.matchAll(/page\s*===\s*["']([\w-]+)["']/g)].map(match => match[1]);
// MainPageContent ends in `else if (pageMeta)`, which sends anything named in
// PAGES to the surface-layout sheet. With that catch-all present an unlisted id
// is handled rather than broken, so it is reported as such — the check that
// still matters is a route for an id PAGES does not define.
const hasCatchAll = /else if \(pageMeta\)/.test(app);
const fallbackRoutes = pageIds.filter(id => id !== "home" && !routeIds.includes(id));
const missingRoutes = hasCatchAll ? [] : fallbackRoutes;
const unregisteredRoutes = routeIds.filter(id => id !== "home" && !pageIds.includes(id));

console.log("MASTERPLAN code inventory");
console.log(`Source modules: ${sourceFiles.length}`);
console.log(`Reachable from src/App.jsx: ${reachable.size}`);
console.log(`Unreachable source candidates: ${unreachable.length}`);
for (const file of unreachable) console.log(`  - ${rel(file)}`);
console.log(`\nExport candidates with no local references: ${exportCandidates.length}`);
for (const item of exportCandidates) console.log(`  - ${item}`);
console.log(`\nMissing relative imports: ${missingImports.length}`);
for (const item of missingImports) console.log(`  - ${item}`);
console.log(`\nUnregistered styles: ${unregisteredStyles.length}`);
for (const file of unregisteredStyles) console.log(`  - ${file}`);
console.log(`\nPage ids without App routes: ${missingRoutes.length}`);
for (const id of missingRoutes) console.log(`  - ${id}`);
if (hasCatchAll && fallbackRoutes.length) {
  console.log(`Page ids served by the pageMeta fallback: ${fallbackRoutes.length}`);
  for (const id of fallbackRoutes) console.log(`  - ${id}`);
}
console.log(`App routes without page ids: ${unregisteredRoutes.length}`);
for (const id of unregisteredRoutes) console.log(`  - ${id}`);
console.log("\nClassification reminders:");
console.log("  - Export candidates can be consumed by tests or classic-global build behavior; verify before removal.");
console.log("  - Dynamic class names and runtime route behavior require manual review.");

# NEMETONA MASTERPLAN — Developer Guide

Construction layout and estimating tools, served as a static site from this
repository. No server, no build step on the far side, no user data: GitHub
Pages hands out the tree exactly as committed.

**This file is the hub.** It holds what is true of the whole app — how it is
assembled, how to run it, and the conventions that apply everywhere. Everything
that belongs to one system has a file of its own under `docs/`, listed below.
Read this page, then the topic file your change touches.

| Topic | Read it before |
|---|---|
| [How it is put together](docs/architecture.md) | following an import, adding a module, or reaching for a global |
| [Checks](docs/testing.md) | trusting a green run — each gate sees a different thing, and one of them needs a browser |
| [Controls and buttons](docs/controls.md) | adding or restyling anything clickable |
| [Layout, spacing and mobile](docs/layout.md) | changing a page's shape, or anything below 768px |
| [Stylesheets and the theme](docs/theme.md) | writing CSS, or touching a colour |
| [Shared components](docs/components.md) | reaching for a primitive, a modal, an icon, or the SVG |
| [Pages and routing](docs/pages.md) | adding a page or changing the nav |
| [Documents the app produces](docs/exports.md) | changing a printed sheet, a report model, or the manifest |
| [Deploying, and what is kept](docs/deploying.md) | pushing, or wondering where state goes |

## Architecture

**Bundled with esbuild.** `src/App.jsx` is the entry point; esbuild follows the
`import` graph from there and emits a single IIFE into `components.js`. Run
`npm run build` after any edit under `src/`, or `npm run watch` to rebuild on
save. `components.js` is generated output — never hand-edit it, the next build
overwrites it silently. It is committed anyway, because GitHub Pages serves the
repo directly and there is no build step on that side.

The bundle is **minified**, so grep it only for a component name or a string
literal — every other identifier is a letter or two. `components.js.map` is
written beside it and devtools reads the original `src/` files through it, so a
stack trace lands on the line in the `.jsx` that raised it. The build also sets
`keepNames`, which is the half a map cannot do: React reads a component's name
at runtime, so without it every warning in the console names `e`. The map is
the one build output that is **not** committed — 300 KiB of generated JSON
rewritten on every build — so the live site 404s the `sourceMappingURL`
comment, which costs visitors nothing and leaves the map in place locally.

React and ReactDOM are plain `<script>` tags in `index.html`, loaded from
`vendor/`, not bundled. Both carry `defer`, and must keep it — unmarked they
block first paint, which Lighthouse costed at 400ms on desktop and 4.4s on
throttled mobile. Deferred scripts still run in document order, so React is in
place before `components.js` reads `window.React`. `src/react-globals.js` re-exports those two window
globals so source files can `import { React } from "./react-globals.js"` like
any other module. This is also why the build sets `jsxFactory` to
`React.createElement` rather than importing the react package.

Everything that lives *outside* `src/` — `config.js`, `simulation.js`,
`themes.js` — is still loaded as its own `<script>` and reached as a bare
global. Do NOT import those; they are not modules.

## Running it

`./run.sh` from WSL, or the desktop shortcut.

The shortcut is a three-part chain, matching MONEYFLOW and VLOGBOOK:

```
Desktop\MASTERPLAN.lnk  ->  wscript.exe  %LOCALAPPDATA%\MASTERPLAN\launch-hidden.vbs
                                            -> wsl.exe -d Ubuntu --cd <repo> -e bash ./run.sh
```

Two constraints explain the shape. A `.lnk` has no "hidden" window style — only
Normal, Maximized or Minimized — so pointing one at `wsl.exe` always leaves a
console somewhere; `WScript.Shell.Run` takes `0` for hidden, which is the only
way to get none. And the `.vbs` is **copied to `%LOCALAPPDATA%`** rather than
run from the repo, because a script on a `\\wsl.localhost\...` UNC path sits in
an untrusted zone and trips Windows' security prompt.

`launch-hidden.vbs` and `masterplan.ico` live in the repo as the source of
truth; the copies under `%LOCALAPPDATA%\MASTERPLAN\` are what the shortcut
actually uses. Change one, copy it across.

The icon is generated, not drawn: `npm run icon` renders the
`fa-compass-drafting` glyph (U+F568, the same one `ICONS.home` uses) out of the
vendored `fa-solid-900.woff2`, so it is the face the app itself renders with
rather than a lookalike. `node scripts/make-icon.js --deploy` also copies it
across. Windows caches shortcut icons, so the desktop may keep showing the old
one until the cache is cleared.

The cost of hiding the console is that a failed start is silent — the browser
opens and fails to connect, and that is the only signal. Run `./run.sh` from a
WSL shell to see why. The likeliest cause is node: it is **not** on PATH in the
non-interactive shell the shortcut spawns, which is what the NVM block at the
top of `run.sh` is for.

## The three things that bite

Everything below is in a topic file too. These are here because they are what
goes wrong when somebody has not read one.

**Rebuild after editing `src/`.** The app loads compiled `components.js` and
`app.css` from the repo root; editing source has no effect until `npm run
build`. Both are committed, because Pages serves them.

**Colour comes from a theme token, never a literal**, and a control picks a tier
and a step rather than inventing a hover or a height. `npm run audit:ui` blocks
on both. These are token systems — do not hand-write what they generate.

**Driving the app in a browser rewrites `config.js`.** The dev server's
`/api/save-defaults` writes `DEFAULT_SH` straight into tracked source, and
`canSaveStaticDefaults()` is a hostname check that localhost passes. Run
`git status` after any browser session. `npm run layout` serves the tree
statically for exactly this reason.

## Important conventions

- Hooks come from `react-globals.js`. Most call sites use `React.useXxx`, which
  reaches every hook; `useState` is additionally re-exported by name because two
  files import it that way. It is the only one — re-export another only when
  something actually imports it, rather than keeping a set nothing reads.
- After editing anything under `src/`, run `npm run build` — it regenerates
  `components.js`, `app.css`, `vendor/fontawesome.subset.css` and
  `vendor/fa-solid-900.subset.woff2` and `version.js`. `npm run watch` does the
  first two on save.
- All five are generated output. Never hand-edit them; the next build overwrites
  it. They are committed anyway, because GitHub Pages serves the tree directly,
  and `githooks/pre-push` refuses a push where any of them has gone stale.
- The build writes a sixth file, `components.js.map`, and it is the one that is
  **not** committed — it is gitignored, so `pre-push` never looks at it and it
  cannot go stale in a way anyone would see. It is for devtools on this machine.

- Colour comes from a theme token, never a literal. `npm run audit:ui` blocks on
  a hex or a tinted `rgba()` in `src/`.
- Three Lighthouse findings need **context before you act on them** — do not
  "fix" any of them without reading this first:
  - *Minify CSS / JavaScript.* Half done, on purpose. `components.js` **is**
    minified (esbuild, since the mobile brand-mark fix); `app.css` is not, only
    comment-stripped, so it stays readable in a public repo that GitHub Pages
    serves directly. `githooks/pre-push` diffs both against a fresh build, which
    works either way because the build is deterministic. Read the sources under
    `src/`, never the two generated files.
  - *Reduce unused CSS / JavaScript.* One bundle serves eight pages; everything
    is "unused" from the perspective of whichever page you landed on.
  - *Use efficient cache lifetimes.* Measured against the dev server's headers.
    GitHub Pages sends its own, so the finding does not transfer — re-run against
    the deployed URL before believing it.
- A Lighthouse score can be vacuously high. A mobile run once reported
  Accessibility 100 while three real defects were live, because its audits came
  back `notApplicable` with zero items — the elements were not rendered at that
  width. Check that an audit evaluated something before trusting that it passed.
- If changing pattern layout visualization, preserve the split between grouped labels and ungrouped physical chart rows. Reusing `rowGroups` for the chart breaks straight layout.
- Enter key in inputs triggers data commit/blur. The visual "icon flash" (switching to a checkmark) has been removed to maintain UI stability.
- Interactive means a real `<button>`, and one never nests inside another. The
  nav header used to be a `<div role="button">` (go home) wrapping a
  `<span role="button" tabIndex={0}>` (toggle sidebar): two overlapping focus
  stops that looked like one target. It is now two sibling buttons, with the
  label taking `flex: 1` so the click area is unchanged and `disabled` — not
  `tabIndex={-1}` plus an early return — keeping it out of the tab order when
  collapsed. `.nav-btn`, `.nav-toggle-label` and `.nav-menu-icon` all strip the
  default button chrome (`border: none; background: transparent`); do the same
  for any new one rather than reaching for a `<div>`.
- A `<button>` already fires `onClick` on Enter and Space. Adding an `onKeyDown`
  for them is redundant.
- `role="img"` needs an accessible name. Per-part `<title>`s do not supply one
  for the whole graphic.
- The sidebar is **not** a `menubar`. It links to pages rather than issuing
  commands, and its buttons were never `menuitem`s — axe fails a `menubar` whose
  children are plain buttons. `<nav aria-label="Main navigation">` carries the
  semantics; arrow-key roving is plain JS over `.nav-btn` and does not need the
  role. `aria-haspopup` went with it: without a menu, it announces a popup that
  never opens. Parent buttons keep `aria-expanded`, which is the disclosure they
  actually are.
- `#page-main` is a `<main>` element — one main landmark per page is what lets a
  screen reader skip the nav. Nothing selects on the tag, so it is safe to move.
- Contrast is judged on the rendered pair, not the token name.
  `check-theme-contrast` gates a fixed list of pairs, so a colour outside that
  list can fail silently: `.home-footer` drew 10px text in `--color-gray-light`
  (which is `--border`) at 60% and shipped at 1.34:1. Prefer an already-gated
  token — `--color-gray-opa80` is `--text-muted` — over mixing a new one.
- Anything reached only through `navigator.clipboard` needs a fallback. It is
  undefined outside a secure context — `file://`, plain http on a LAN address —
  which is how this app often gets opened.
- No CSS-in-JS except inline style for dynamic values; use className strings
- Local persistence uses `saveStaticDefaults` for dev-mode configuration updates.
- CSS class names follow BEM-ish patterns: block, block-element, modifier

## What does NOT exist yet (possible future work)

- A machine-readable export. Both documents print (see
  [Export](docs/exports.md)), but `downloadFile` in `shared.jsx`
  is still uncalled — a CSV would consume the same report models rather than
  building one, which is what they were shaped for
- UI interaction tests for the calculator pages. `AppNav` and `SheetHome` have
  them; none of the other `Sheet*` components do. See [Checks](docs/testing.md) for what is uncovered — this is
  the largest remaining gap and the reason `verify` cannot catch an interaction
  regression on a page
- Element-level descriptions inside the Guider wiring diagrams. Both carry a
  top-level `aria-label`, but the individual lines and connection paths convey
  nothing — a real gap in a technical reference drawing
- A Content Security Policy. `index.html` has none. Weighed and deferred rather
  than missed: the app leans on inline `style` attributes throughout and a
  data-URI favicon, so any workable policy would still need `unsafe-inline` and
  would buy close to nothing. One of the three blockers is gone — the logo SVG
  no longer carries an inline `<style>` — but attributes are the bulk of it,
  and the wordmark itself now writes one per cloned shape (`--i`)

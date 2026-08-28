# NEMETONA MASTERPLAN — Developer Guide

React app for surface covering layout calculators (tiles, panels, etc.).
Hosted on GitHub Pages at: https://nemetona-hive.github.io/MASTERPLAN/

## Architecture

**Bundled with esbuild.** `src/App.jsx` is the entry point; esbuild follows the
`import` graph from there and emits a single IIFE into `components.js`. Run
`npm run build` after any edit under `src/`, or `npm run watch` to rebuild on
save. `components.js` is generated output — never hand-edit it, the next build
overwrites it silently. It is committed anyway, because GitHub Pages serves the
repo directly and there is no build step on that side.

React and ReactDOM are plain `<script>` tags in `index.html`, loaded from
`vendor/`, not bundled. `src/react-globals.js` re-exports those two window
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

## Checks

`npm test` runs the vitest suite (`tests/`), covering the layout maths in
`simulation.js`, the timesheet parsers, the number coercions and the shared
primitives. `npm run verify` runs everything: tests, build, bundle budgets, the
style contract, theme contrast, the code inventory, and the UI audit.

| Command | What it guards |
|---|---|
| `npm test` | behaviour — parsers, layout maths, primitives |
| `npm run audit:ui` | hardcoded colour, dead CSS classes (`-- --unused` to list them), JS/CSS breakpoint drift |
| `npm run theme:check` | contrast ratios across all three themes |
| `npm run perf:check` | download budgets for the two committed bundles |
| `npm run style:check` | load-bearing selectors still exist in `app.css` |
| `npm run analyze:code` | unreachable modules, unreferenced exports, unrouted pages |

What none of these cover is UI interaction. The suite tests the computation
engine and the primitives; preset application, direction switching with
per-direction state save, panel collapse and the `LayoutPanel` controlled /
uncontrolled toggle have no test behind them, so `verify` going green says the
build is sound, not that the page still works. Check a UI change in the browser
as well.

Git hooks live in `githooks/` and are wired by `core.hooksPath`, which
`npm install` sets via `prepare`. `pre-commit` rebuilds, then blocks on a UI
audit error or a test failure. `pre-push` matters more here than in most repos:
GitHub Pages serves this tree directly, so a push **is** the deploy — the hook
refuses if the committed `components.js` or `app.css` no longer matches `src/`,
which is a staleness only visitors would ever see. Bypass either with
`--no-verify`.

Colour comes from theme tokens, never a literal — `--danger`, `--success`,
`--warning`, `--brand`, `--accent`, or the `--color-*` aliases onto them. The
audit blocks on a hex or a tinted `rgba()` anywhere in `src/`, and
`theme:check` gates the palette itself: **4.5:1** for a colour a word is drawn
in, **3:1** for one that only draws a mark. It reads `themes.js` directly, so
there is no second copy to drift.

## Controls And Buttons

Every interactive control composes from one shared set of tokens. **Do not
write a new hover or active recipe** — reach for these.

**Four tiers, picked by what the control *does*, never by which page it is on:**

| Tier | Looks like | For |
|---|---|---|
| Raised | `--ctl-raised-bg` fill + `--ctl-raised` shadow | it does something — add, apply, confirm. Push it. |
| Ghost | transparent, inset ring only | secondary next to a raised one, or a selector at rest |
| Solid active | `--btn-active-bg` plate + `--btn-active-fg` label + `--ctl-active` | a selector that is on |
| Pressed | 1px nudge + `--ctl-pressed` | while held |

Getting the tier wrong is the failure worth guarding against: the same action
looking like two different kinds of control on two pages. **Match the tier to
the role, then check the same role elsewhere renders identically.**

| Control | Tier | Step |
|---|---|---|
| `.ts-btn`, `.num-btn`, `.ts-copy`, `.viz-expand-btn` | raised | md |
| `.ctl-ghost` (composable), `.ctrl-dir`, `.pill-btn`, `.mp-modal-close` | ghost | lg / md |
| `.ctrl-dir.on`, `.pill-btn.on`, `.ctl-ghost.on` | solid active | — |
| `.nav-*` | the rail, `--nav-ctl-h` | 40px, off the data scale |

Compose `.ctl-ghost`, `.ctl-danger` (destructive hover), `.ctl-sm` and
`.ctl-icon` in the markup rather than writing a bespoke recipe — Timesheet's
remove is `num-btn ctl-ghost ctl-sm ctl-icon ctl-danger` and owns no CSS of its
own. `.seg-group` is neither tier: it is a recessed track, and its segments
carry no ring because the track supplies the edge.

**A control picks a step off the scale; it does not invent a height — and not
stating one is the same mistake**, because the box then comes out as padding
plus line-height, near a step without being on it.

| Step | Token | For |
|---|---|---|
| sm | `--ctl-h-sm` (24px) | an action **on** a data row |
| md | `--ctl-h-md` (32px) | the default; `.ts-btn`/`.num-btn` already are |
| lg | `--ctl-h-lg` (36px) | page-level and segmented controls |

`.ctl-icon` squares a control off its own height, so there has to be one:
compose it with a base that carries a height or with `.ctl-sm`. With only a
tier class the width falls back to 32px and the height to the glyph — a 32×19
pill, not a square.

`.ctrl-dir`'s `flex: 1` assumes a row (`.seg-group`, or a `Stack
direction="row"`) — it lets siblings share the width axis and leaves height
alone. Stood in a plain column `Stack` instead, `flex: 1`'s `flex-basis: 0%`
collapses the *height* axis to content instead, since an auto-sized column
has no spare cross space to grow into: the control comes out a squashed
~17px sliver instead of the standard 36px, its 8px radius reading as a
near-full pill. Add `ctrl-list` to the wrapping `Stack` for a vertical list
of `.ctrl-dir` entries (a `ControlPanel`'s selectable list, a lone button
stacked with inputs) to get the real height back.

`.ctrl-dir`/`.ts-btn` icon+label buttons (`<Icon .../> Label`) need a real
`gap` between the two — both classes already carry `gap: var(--sp-2)` for
this. A flex container drops a whitespace-only text run sitting at a
flex-item boundary instead of rendering it, so relying on the JSX space
between the icon and the label collapses it to zero width and runs the icon
into the text.

Classes live in `65-controls.css`, deliberately after the base controls in
30/40/60 — every one is a single class, so source order is what decides. Tokens
live in `:root` in `00-base.css`; four are per-theme in `themes.js`
(`--btn-active-bg`, `--btn-active-fg`, `--edge-hi`, `--shadow-rgb`) because the
active fill flips in kind between light and dark. **A new theme must state all
four**, and `theme:check` gates the label on the plate at 4.5:1.

## Shared layout vocabulary

MONEYFLOW grew out of this app, so the page-shell classes are the same on both
sides: `.ts-page`, `.ts-body`, `.calc-main-stack`, `.layout-split`, `.section`,
`.section-head`, `.section-body`, `.result-card`, `.u-sticky`. 172 class
selectors exist in both repos.

**A shared name is a place where a fix can land on one side and not the
other.** Everything that can be forced wider needs a floor stated, because the
CSS defaults do not give it one:

- a flex child's `min-width` defaults to `auto`, so wide content pushes the
  column wider instead of being clipped or scrolled — `.ts-body` takes
  `min-width: 0` and `overflow-x: hidden`, matching the `min-height: 0` it
  already had on the other axis
- a `1fr` grid track floors at its content's min-content width, so it is
  `minmax(0, 1fr)` on `.layout-split`
- a control's `height` is not a floor: a crowded flex or grid row compresses it
  below its step, so `.ctl-sm` states `min-height`/`min-width`, and `.ts-btn`
  takes `min-height` rather than a fixed `height` so a label that needs the room
  grows the box instead of overflowing it

Deliberately **not** matched to MONEYFLOW, so don't "fix" these:

| | Why |
|---|---|
| `.section-head` uses `--mono` | this app is mono-first; MONEYFLOW moved to `--font-ui` |
| `.section-body` draws a border, not a ring | MONEYFLOW's `--ring-soft` does not exist here |
| `.result-card` | a stripped inline row here, a glass card there — different roles |
| `.layout-split` result column is `340px` | MONEYFLOW clamps to 260–300px, tuned to its money grids |

The money-grid `--mg-*` system is **not** used here and should not be adopted:
it parameterises `lead | N repeating same-kind columns | total | action` across
six grids, and this app has two data grids whose columns are each a different
quantity. Its invariants — derived `min-width`, no-scrollbar fit, column role
classes — solve problems these grids do not have, since they reflow on mobile
rather than scroll.

## Stylesheets

`app.css` is generated too, by `scripts/build-styles.js` from `src/styles/*.css`.
It is a plain concatenation in the order that script lists, with comments
stripped on the way out — so **order is the cascade**. Moving a file in
`STYLE_SOURCES`, or moving a rule between files, changes which rule wins.
Nothing else enforces that order; the numeric prefixes only leave room to
insert without renumbering.

Read and edit the sources. Comments are roughly a fifth of them and none of it
survives into the bundle, so the reasoning behind a rule lives in `src/styles/`
and nowhere else. Like `components.js`, the generated `app.css` is committed
because GitHub Pages serves the tree directly.

```
00-base.css            root variables, legend colours, form elements
10-nav.css             nav buttons, collapse, theme toggle and menu
20-shell.css           header, wrapper, page, layout
30-data.css            main data area, num input, data row
40-control.css         control panel, segmented controls, golden-ratio cards
50-preview.css         sys block, panel row/seg, strip visualisation
60-timesheet.css       timesheet page
70-home.css            home page
80-mobile.css          @media: mobile, landscape, ultra-small
85-accessibility.css   reduced motion and focus preferences
90-range-slider.css    lockable range slider
92-pipe-wrap.css       pipe wrap calculator
94-utilities.css       small shared helpers
96-detail-layout.css   shared tool styles, primary-result/progressive-detail
98-layout-svg.css      SVG layout visualisation
```

## Module graph

There is no hand-maintained file order any more: esbuild derives it from the
imports, so adding a file means importing it, nothing else.

```
react-globals.js  → React, ReactDOM, hooks (re-exported window globals)
shared.jsx        → Icon, RangeSlider, NumInput, Collapsible, Section, ControlPanel,
                    DetailSection, Row, Stack, MaterialPresetDropdown, SaveDefaultsButton,
                    useTimedState, useTimedSet, useClickOutside, useDropdownKeyboard,
                    useLinkedCardHighlight, getLinkedCardTone, getLinkedCardMarker,
                    isMobileViewport, safeSaveStaticDefaults, toNumber, clampNumber
Visualization.jsx → PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
Controls.jsx      → LAYOUT_REGISTRY
utils/timesheet.js→ parseTime, parseLunch, fmtHHMM, fmtDecimal
components/*.jsx  → one Sheet* per page (plus PipeWrapCalculator)
Nav.jsx           → AppNav
App.jsx           → entry point; mounts via ReactDOM.createRoot
```

`themes.js` is loaded directly in `index.html` so themes apply before React
renders.

## Key globals (defined outside src/, treat as read-only)

| Global | Purpose |
|---|---|
| `PAGES` | Navigation page definitions (id, label, title, desc, icon, parentId, isParent, noNav) |
| `SYSTEMS` | Layout system metadata (id, title, icon, subtitle — subtitle can be a function) |
| `DEFAULT_SH` | Default state for surface layout (W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short, rowStart) |
| `DEFAULT_SYM` | Default state for symmetric layout (roomWidth, panelWidth, oneFullEdge, customFirstPieceWidth) |
| `DEFAULT_GR` | Default items for golden ratio tool |
| `ICONS` | Map of icon name → FontAwesome class string (defined in config.js) |
| `PAL_CLASSES` | Palette class maps for segment coloring (s1, s4l, s4s) |
| `fmt` | Formatting helpers: fmt.decimals(v,n), fmt.area(v), fmt.decimal(v), fmt.mm(v). Renders `—` for a non-finite value rather than letting `.toFixed()` print `NaN` next to a unit |
| `SUMMARY_LABELS` | Label maps for result summary rows (s0, s1s2s3, s4 keys) |
| `computeS0` | Symmetric layout compute (takes sym state) |
| `computeS1/S2/S3/S4` | Surface layout computes (each takes sh state) |
| `getDescription(id, sh)` | Human-readable description for a layout system |
| `getSegmentClass(seg, palClasses)` | Returns CSS class for a row segment |
| `THEMES` | Theme definitions (name, label, icon, colors map of CSS vars) |
| `DEFAULT_CONCRETE_PRESETS` | Initial product list for Concrete calculator (name, rate, bagKg, bagPrice) |
| `DEFAULT_MATERIAL_PRESETS` | Initial material list for Surface Layout (name, length, width) |
| `canSaveStaticDefaults()` | Boolean check for local dev environment |
| `saveStaticDefaults(key, value)` | API call to persist config changes to disk during development |
| `getThemeOrder()` | Ordered list of theme keys |
| `getNextTheme(current)` | Next theme name in rotation |
| `applyTheme(name)` | Applies a theme's CSS custom properties to `documentElement` |

## State shape

**sh (surface layout state)**
```js
{ W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short, rowStart }
// W/H = surface mm, PPi/PLa = panel mm, direction = "V"|"H", rowStart = "top"|"bottom"
```

**sym (symmetric layout state)**
```js
{ roomWidth, panelWidth, oneFullEdge, customFirstPieceWidth }
// oneFullEdge = bool, customFirstPieceWidth = number|null
```

**grItems (golden ratio items)**
```js
[{ id, value, suffix, saved, savedCommitted }]
// id = "a"|"b"|"c"|"d", PHI = 1.6180339887499
```

## Pages & routing

Hash-based routing (`#page-id`). Home = no hash.
Page render is handled in `MainPageContent` in App.jsx — add new pages there.
Nav items come from `PAGES` global — add new pages in config (outside src/).
`PAGES` entries can still nest under a parent via `parentId`/`isParent` —
Nav.jsx's group machinery (expand/collapse, auto-open on navigate) is generic
and unused today, not removed; nothing is currently grouped.

Current pages: `home`, `pattern-layout`, `symmetric-layout`, `concrete`,
`golden-ratio`, `pipe-wrap`, `guider`, `timesheet`.

Sidebar interaction (Nav.jsx): Ctrl/Cmd+B toggles collapse globally (App.jsx);
double-clicking any nav button does the same. Collapsed-nav tooltips mount
into `document.body` via a portal on hover/focus rather than sitting inside
`.nav` — that container is `overflow-y: auto`, and a tooltip parked inside it
either clips or forces the sidebar itself into horizontal scroll. The
collapsed header disables click-to-home (Home stays reachable via its own
nav item, which renders in every state) since the header shrinks to just the
toggle icon but the div still spans the full strip.

## Page components

All calculators and pages are stored as standalone files inside `src/components/`:

| Page ID | Component | Location | Description |
|---|---|---|---|
| `home` | `SheetHome` | `components/Home.jsx` | Main landing page menu |
| `pattern-layout` | `SheetSurfaceLayout` | `components/SurfaceLayout.jsx` | Compares straight, shifted, stepped, and long-short layout strategies |
| `symmetric-layout` | `SheetSymmetricLayout` | `components/SymmetricLayout.jsx` | Equal edge pieces with full panels in the center |
| `golden-ratio` | `SheetGoldenRatio` | `components/GoldenRatio.jsx` | Calculates Phi sequences |
| `pipe-wrap` | `PipeWrapCalculator` | `components/PipeWrapCalculator.jsx` | Pipe wrap length calculator with SVG diagram |
| `concrete` | `SheetConcrete` | `components/Concrete.jsx` | Concrete consumption estimator |
| `guider` | `SheetGuider` | `components/Guider.jsx` | Reference/guide pages (e.g. electrical wiring diagrams) with an entry list panel |
| `timesheet` | `SheetTimesheet` | `components/Timesheet.jsx` | Work hours calculator |

## Layout systems

| ID | Name | Controls |
|---|---|---|
| s0 | Symmetric Layout | roomWidth, panelWidth, oneFullEdge, customFirstPieceWidth (in SheetSymmetricLayout) |
| s1 | Straight Layout | none |
| s2 | Shifted Layout | offset slider (0.1–0.9 × panel length) via RangeSlider |
| s3 | Stepped Layout | none |
| s4 | Long/Short | s4Long, s4Short (two panel sizes) |

LAYOUT_REGISTRY in Controls.jsx maps s1–s4 to their compute functions and control components.
Best layout = fewest total pieces among valid results.

Every `compute*` returns one of three shapes, and a caller that only looks at
`rows` cannot tell them apart:

| Shape | When | Marker |
|---|---|---|
| A real layout | normal | `valid: true` (or `false` for uncovered gaps) |
| `emptyLayoutResult()` | a dimension is zero or missing | `valid: false`, no summary rows |
| `cappedLayoutResult()` | geometry exceeds `MAX_SIM_STEPS` (2000) pieces per axis | `valid: false`, `capped: true`, one danger summary row |

The cap exists because `simulate`/`simulateS4` loop per piece and `s4Long` is
unclamped in the UI, so a typo is an unbounded loop. Both simulators share
`exceedsSimCap`, and `computeStandard`/`computeS4` check it up front — do not
infer "capped" from an empty `rows`, because `nGap([])` is `0`, which reads as
a *valid* zero-panel layout. That was a real bug: the panel showed "Valid" over
nothing.

`SheetSurfaceLayout` runs all four computes inside a `useMemo` keyed on `sh`.
Each is a full `simulate()` pass, so unmemoized they re-ran on every hover,
panel collapse and preset flash. `setSh` always replaces `sh` wholesale, which
is what makes the identity key sound — keep it that way.

## Mobile / responsive

- Mobile breakpoint: width ≤ 768px, OR height ≤ 500px on a viewport ≤ 950px wide
- The breakpoint is written once, as `MOBILE_MEDIA_QUERY` in shared.jsx, and the
  `@media` rules in app.css open with the same string. Change one and you must
  change the other — when they drifted (JS 1024px, CSS 768px), tablets in
  between got the nav's mobile props under desktop styling. `npm run audit:ui`
  now blocks on that: the query JS builds must appear verbatim as an `@media`
  prelude, and any prelude testing `max-height` must be that query or its
  landscape half, so one spelling cannot quietly fork into two
- The height arm is bounded by width on purpose: a soft keyboard shrinks a
  landscape tablet below 500px too, and unbounded it collapsed the nav mid-edit
- Two further thresholds sit above the mobile one, because the desktop split is
  a 260px sidebar plus a fixed 384px `.data-control` and the preview column is
  only what is left over:
  - **≤ 1280px** — the nav auto-collapses to its icon strip, handing ~200px back
    to the preview. Covers tablet landscape (an 11" iPad on its side is
    1194–1210px) as well as portrait, and leaves 1366px laptops alone. JS-driven
    (`COMPACT_NAV_MEDIA_QUERY`, read by App.jsx), because collapsed is a state —
    `.nav-collapsed`, icon-only buttons, tooltips instead of labels — not just a
    narrower width. Styling it collapsed from CSS alone recreates the 768/1024
    class of bug. It has no `@media` counterpart on purpose, and `audit:ui`
    exempts named `*_MEDIA_QUERY` constants from its stray-literal warning
  - **≤ 1024px** — the control and preview columns stack (`80-mobile.css`,
    structure only). Even with the nav collapsed the preview is only `W - 444`
    below this, so the split is not worth defending; stacking gives it the full
    width instead. Side by side resumes at 1025px with 581px, which is the
    narrowest the preview gets at any width above the phone breakpoint. Reuses
    the 1024px line rather than adding one, and the mobile block inherits this
    stacking rather than restating it
- Nav collapses to hamburger on mobile, sidebar on desktop
- `isMobile` state in App.jsx tracks the media query itself (`change`), not
  `resize` — one re-render per real crossing rather than one per URL-bar nudge.
  `orientationchange` closes the drawer separately, since a rotate usually stays
  on the same side of the query
- Hover is treated as a capability, not an assumption. Every `:hover` rule sits
  inside `@media (hover: hover)`, so a tap does not leave a button stuck in its
  hover state. Where a selector list mixed `:hover` with a real state
  (`.active`, `.focused`, `.hovered`, `.home-card-active`) the two were split —
  the state half stays unconditional, or touch would lose it
- Collapsed-nav tooltips are gated the same way: `canHover()` for the pointer,
  `isKeyboardFocus()` (i.e. `:focus-visible`) for the keyboard. A tap fires
  `mouseenter` and focus with no `mouseleave`/blur behind them, so an ungated
  tooltip appeared and then stayed over the page the tap navigated to
- The linked highlight (summary row <-> matching layout segments) goes through
  `linkedHighlightProps`. Hover devices get `mouseenter`/`mouseleave` as before;
  touch gets a tap that toggles, since there is no `mouseleave` to clear it.
  Pass `toggleOnTap: false` where a tap already means something — the layout
  segments use it, because the `<g>` above them already handles selection
- `RangeSlider` starts locked; distinguishes horizontal drag (slider) from vertical swipe (scroll) on mobile
- Large Preview modal is optimized for mobile by hiding non-essential controls and prioritizing visualization and statistics.

## UI components (from shared.jsx)

- `<Icon name="..." />` — renders FontAwesome icon via ICONS map
- `<NumInput id label value onChange step min unit req onFocus labelIcon />` — controlled number input with commit-on-blur and optional icon.
- `<RangeSlider id value onChange min max step className />` — lockable range slider with lock/unlock toggle. Starts locked; click the row or tap the lock icon to unlock.
- `<ControlPanel id title open setOpen>` — collapsible panel for controls sidebar
  (`Section`, `ControlPanel` and `DetailSection` are one internal `Collapsible`
  wearing three variants; the base is not exported). Pass **both** `open` and
  `setOpen` to control it. `open` on its own is read once as the initial state
  and never again — every such call site passes a literal, and the effect that
  used to copy it on change only bought a second render and a way to clobber a
  user's toggle mid-interaction.
- `<Section title bg>` — collapsible section for preview area
- `<DetailSection title open>` — collapsible section for secondary information or management UI
- `<Row label value unit hi danger hoverType hoveredType setHoveredType />` — data display row
- `<Stack gap direction className as>` — flex layout primitive; gap uses spacing scale (0.5–7); direction = "column"|"row"
- `<Text size weight variant color as>` — typography primitive; size = xs–xxl, weight = reg–black, variant = sans|mono
- `<MaterialPresetDropdown anchorRef presets activePreset onApply field />` — floating portal dropdown for material quick-select.
- `<SaveDefaultsButton status onClick errorMessage labels />` — renders nothing
  unless `canSaveStaticDefaults()`. `status` is `""|"saving"|"saved"|"error"`;
  pass `errorMessage` so the failure reason reaches a tooltip instead of only
  the console.
- `useTimedState(initial, delay)` — state that reverts to `initial` after
  `delay`. The setter takes a **per-call delay** as its second argument
  (`set("saving", 0)` means "hold until I say otherwise"). This is the reason to
  reach for it over `useState`: a plain `useState` setter silently ignores that
  second argument, which is exactly how a save badge got stuck on "saving"
  forever. If you pass a delay, make sure the hook is this one.
- `useClickOutside(refs, handler, active)` — closes on a click away, listening to both `mousedown` and `touchstart` so a tap counts.
- `useModeExit(inside, onExit, active)` — the other half: `useClickOutside` plus Escape. An armed mode should take both ways out. `inside` is an array of refs, or a CSS selector for a subtree that cannot forward one.
- `downloadFile(name, data, mimeType)` — hands the browser a generated file. Revokes the object URL a tick late, because doing it in the same turn cancels the save in Firefox and Safari.
- `useDropdownKeyboard(count, onSelect, onClose)` — Specialized hook for keyboard navigation (Arrow keys, Enter, Esc) within custom dropdowns.
- `.seg-group` — a recessed track for exclusive mode switches. Its segments carry no ring of their own; the track supplies the edge.
- `.pill-btn`, `.ctrl-dir`, `.ts-btn`, `.num-btn` — see [Controls And Buttons](#controls-and-buttons). Pick a tier by what the control does; do not write a new hover or active recipe.

## Icons

- Icons are rendered via `<Icon name="..." />`, which maps a logical name to a FontAwesome class string through the `ICONS` global (`config.js`).
- FontAwesome is vendored locally (`vendor/fontawesome.min.css`), not loaded from a CDN — the app must work fully offline.
- Only the **Solid** (`vendor/fa-solid-900.woff2`), **Regular** (`vendor/fa-regular-400.woff2`), and **Brands** (`vendor/fa-brands-400.woff2`) webfonts are vendored. Using an icon class outside these three styles (e.g. Duotone, Sharp) will render as a fallback box — check which style a FontAwesome class belongs to before using it, and vendor the matching webfont if it's missing.

## Visualization

- `LayoutVisualization` — renders row-by-row or strip view depending on `result.meta.visualization`.
- **Large Preview Modal**: Full-screen analytical dashboard.
  - **Live Synchronization**: Edits to material or surface inputs within the modal reflect immediately in the visualization and stats.
  - **Dashboard Layout**: Uses a 3-column split (Material/Surface, Layout Engine, and Detailed Statistics).
  - `MaterialSpecification` takes an `isLargePreview` flag (set by the
    `LargePreviewMaterialSpec` wrapper); it hides the "Manage Presets" button
    there, since preset management belongs to the main control panel, not the
    modal.
  - **Mobile Optimization**: Hides secondary settings on mobile to maximize visualization space; enables horizontal scrolling for wide room layouts.
- **Horizontal Mode (H mode)**: Intentionally gives each row a standard lane height for readability. Partial final rows are drawn inside that lane so narrow rows remain visible.
- `PanelSummary` — displays detailed statistics and counts for segments.
- Segments have types: `full`, `cut`, `edge`, `offcut`, `gap`.
- Gap segments get red hatched styling; others get palette classes from PAL_CLASSES.
- `hoveredType` cross-highlights between summary rows and visualization segments.
- Pattern layout chart geometry must render real physical rows/columns, not grouped rows.
- `rowGroups` is for label grouping only. The visible chart must use one visual row/column per real `orderedRows` item so straight layout keeps all panel boundaries visible.
- In `direction === "V"`, the visualization keeps surface width horizontal and surface length vertical; rows render as vertical columns and segment positions use `top`/`height`.
- In `direction === "H"`, rows render horizontally and segment positions use `left`/`width`.

## Local Static Defaults (Dev environment only)

When running the application locally, a specialized persistence mechanism allows saving UI state (presets, defaults) directly back into the source code (`config.js`).

- `canSaveStaticDefaults()`: Returns `true` if the app is running on `localhost`
  or `127.0.0.1`. This decides whether the Save Defaults **button renders** —
  it runs in the browser and is not a security control. Do not add a second
  caller that treats it as one.
- `saveStaticDefaults(key, value)`: Asynchronous function that sends a POST request to `/api/save-defaults`. This endpoint is provided by the development server to update the project's static configuration files.
- The endpoint writes to a tracked source file and has no credentials, so the
  server is what keeps it private, in two layers:
  - It binds `127.0.0.1` explicitly. Listening on every interface handed any
    machine on the network an unauthenticated write to `config.js`.
  - `isLocalRequest()` additionally requires a loopback `Host` and, when one is
    sent, a loopback `Origin` — loopback alone still leaves the endpoint
    reachable from the user's own browser, so any page could post to it, and a
    DNS-rebinding host resolving to `127.0.0.1` would satisfy the bind. A
    *missing* `Origin` is allowed: browsers always send it on a cross-origin
    POST, so its absence means a non-browser client like curl.
- `safeSaveStaticDefaults(key, value)` in `shared.jsx` is what components call: it
  rejects rather than throwing when the hook is absent, which is the case on
  GitHub Pages, where there is no dev server behind the page.
- The server **rewrites `config.js` in place** — a tracked source file — after
  validating the payload. There is no backup snapshot, unlike MONEYFLOW's
  `_personal/.backups/`. Check `git diff config.js` after a save you did not
  intend.
- Currently utilized by:
  - **Concrete Calculator**: To persist product presets.
  - **Surface Layout**: To persist material presets.
  - **Golden Ratio Tool**: To persist saved value series.

## Theme system

Defined in `themes.js` (loaded as global, not inside `src/`).
- `THEMES` object maps theme keys to `{ name, label, icon, colors }` where `colors` is CSS var → value
- `applyTheme(name)` sets CSS custom properties on `:root` and a `data-theme` attribute
- App.jsx holds `theme` state (default: `"graphite"`, persisted to `localStorage`), applies via `useEffect`
- `:root` in `00-base.css` restates the default theme as the pre-JS fallback —
  whatever it says is what the first paint uses, before `applyTheme` runs. A
  test keeps the two in step; they had already drifted once
- **To add a theme:** add an entry to `THEMES`, then run `npm run theme:check`.
  It reads `themes.js` directly — there is no second copy of the palette, and
  the one that used to exist reported green against colours nobody ever saw.
  A theme must state all four control tokens (`--btn-active-bg`,
  `--btn-active-fg`, `--edge-hi`, `--shadow-rgb`): the active fill flips in kind
  between light and dark, so it cannot be derived. The gate is 4.5:1 for any
  colour a word is drawn in, 3:1 for one that only draws a mark

## Golden Ratio tool

PHI = 1.6180339887499. Builds 7 descending steps: `base / PHI^n`.
Cards use tone system (a/b/c/d) for visual identity.
`useLinkedCardHighlight` hook links control cards to preview cards on click.

## Guider tool

Reference/guide page with a selectable entry list (`ControlPanel` on the left, detail view on the right).
Currently ships wiring-diagram entries (`Lihtlüliti`, `Veksellüliti`) built as inline SVG schematics
inside `components/Guider.jsx` — square dashed switch boxes with open-circle contacts and a floating
lever, consistent stroke widths (`r=4.5`, `strokeWidth=2`), and a legend/Ühendused list below each
diagram. New entries are added to the `ENTRIES` array in `SheetGuider`.

## Important conventions

- Hooks come from `react-globals.js`. Most call sites use `React.useXxx`; two
  files import `useState` by name. Either is fine — import what you use.
- After editing anything under `src/`, run `npm run build` — it regenerates both
  `components.js` and `app.css`. `npm run watch` does it on save.
- Both are generated output. Never hand-edit them; the next build overwrites it.
  They are committed anyway, because GitHub Pages serves the tree directly.
- Colour comes from a theme token, never a literal. `npm run audit:ui` blocks on
  a hex or a tinted `rgba()` in `src/`.
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

- Export / print functionality — `downloadFile` in `shared.jsx` is the piece it
  would build on
- Advanced user persistence. `saveStaticDefaults` writes to `config.js` from the
  dev server only, and localStorage holds nothing but the theme choice. There is
  no per-user data and no backup path for it, unlike MONEYFLOW's `_personal/`
- A `Dialog` primitive. MONEYFLOW has one, but its recipe reads seven tokens
  this theme has no answer for, so it is a design decision rather than a port
- UI interaction tests. See [Checks](#checks) for what is uncovered; this is the
  largest remaining gap and the reason `verify` cannot catch an interaction
  regression
- Element-level descriptions inside the Guider wiring diagrams. Both carry a
  top-level `aria-label`, but the individual lines and connection paths convey
  nothing — a real gap in a technical reference drawing
- A Content Security Policy. `index.html` has none. Weighed and deferred rather
  than missed: the app leans on inline `style` attributes throughout, an inline
  `<style>` in the logo SVG and a data-URI favicon, so any workable policy would
  need `unsafe-inline` and would buy close to nothing

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

## Checks

`npm test` runs the vitest suite (`tests/`), covering the layout maths in
`simulation.js`, the timesheet parsers, the number coercions and the shared
primitives. `npm run verify` runs everything: tests, build, bundle budgets, the
style contract, theme contrast, the code inventory, and the UI audit.

| Command | What it guards |
|---|---|
| `npm test` | behaviour — parsers, layout maths, primitives |
| `npm run audit:ui` | hardcoded colour, dead CSS classes (`-- --unused` to list them) |
| `npm run theme:check` | contrast ratios across all three themes |
| `npm run perf:check` | download budgets for the two committed bundles |
| `npm run style:check` | load-bearing selectors still exist in `app.css` |
| `npm run analyze:code` | unreachable modules, unreferenced exports, unrouted pages |

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
| `fmt` | Formatting helpers: fmt.decimals(v,n), fmt.area(v), fmt.decimal(v), fmt.mm(v) |
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

Current pages: `home`, `layout` (parent), `pattern-layout`, `symmetric-layout`,
`concrete`, `golden-ratio`, `pipe-wrap`, `guider`, `timesheet`.

## Page components

All calculators and pages are stored as standalone files inside `src/components/`:

| Page ID | Component | Location | Description |
|---|---|---|---|
| `home` | `SheetHome` | `components/Home.jsx` | Main landing page menu |
| `layout` | `SheetSurfaceLayout` | `components/SurfaceLayout.jsx` | Compares straight, shifted, stepped, and long-short layout strategies |
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

## Mobile / responsive

- Mobile/Tablet breakpoint: width ≤ 1024px OR height ≤ 500px
- Nav collapses to hamburger on mobile, sidebar on desktop
- `isMobile` state in App.jsx drives nav behavior reactively on resize/rotate
- `RangeSlider` starts locked; distinguishes horizontal drag (slider) from vertical swipe (scroll) on mobile
- Large Preview modal is optimized for mobile by hiding non-essential controls and prioritizing visualization and statistics.

## UI components (from shared.jsx)

- `<Icon name="..." />` — renders FontAwesome icon via ICONS map
- `<NumInput id label value onChange step min unit req onFocus labelIcon />` — controlled number input with commit-on-blur and optional icon.
- `<RangeSlider id value onChange min max step className />` — lockable range slider with lock/unlock toggle; uses `useProtectedRangeSlider` for mobile touch-scroll protection. Starts locked; click row or tap lock icon to unlock.
- `<ControlPanel id title open setOpen>` — collapsible panel for controls sidebar
- `<Section title bg>` — collapsible section for preview area
- `<DetailSection title open>` — collapsible section for secondary information or management UI
- `<Collapsible>` — base for Section, ControlPanel, and DetailSection (variant="section"|"panel"|"detail")
- `<Row label value unit hi danger hoverType hoveredType setHoveredType />` — data display row
- `<SLabel>` — simple label div for section headings in controls
- `<Stack gap direction className as>` — flex layout primitive; gap uses spacing scale (0.5–7); direction = "column"|"row"
- `<Text size weight variant color as>` — typography primitive; size = xs–xxl, weight = reg–black, variant = sans|mono
- `<MaterialPresetDropdown anchorRef presets activePreset onApply field />` — floating portal dropdown for material quick-select.
- `useClickOutside(refs, handler, active)` — Unified interaction hook using `pointerdown` for robust cross-device detection.
- `useDropdownKeyboard(count, onSelect, onClose)` — Specialized hook for keyboard navigation (Arrow keys, Enter, Esc) within custom dropdowns.
- `.seg-group` — Container for exclusive mode-switch toggles; provides a unified border/boundary for grouped buttons.
- `.pill-btn` — Minimalist, rounded buttons used for quick-select presets.
- `.ctrl-dir` / `.ts-btn` — Standardized button styles with "premium glow" hover/active feedback. Standalone buttons use `var(--fs-md)` while segmented controls are bumped for legibility.

## Icons

- Icons are rendered via `<Icon name="..." />`, which maps a logical name to a FontAwesome class string through the `ICONS` global (`config.js`).
- FontAwesome is vendored locally (`vendor/fontawesome.min.css`), not loaded from a CDN — the app must work fully offline.
- Only the **Solid** (`vendor/fa-solid-900.woff2`), **Regular** (`vendor/fa-regular-400.woff2`), and **Brands** (`vendor/fa-brands-400.woff2`) webfonts are vendored. Using an icon class outside these three styles (e.g. Duotone, Sharp) will render as a fallback box — check which style a FontAwesome class belongs to before using it, and vendor the matching webfont if it's missing.

## Visualization

- `LayoutVisualization` — renders row-by-row or strip view depending on `result.meta.visualization`.
- **Large Preview Modal**: Full-screen analytical dashboard.
  - **Live Synchronization**: Edits to material or surface inputs within the modal reflect immediately in the visualization and stats.
  - **Dashboard Layout**: Uses a 3-column split (Material/Surface, Layout Engine, and Detailed Statistics).
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

- `canSaveStaticDefaults()`: Returns `true` if the app is running on `localhost` or `127.0.0.1`.
- `saveStaticDefaults(key, value)`: Asynchronous function that sends a POST request to `/api/save-defaults`. This endpoint is provided by the development server to update the project's static configuration files.
- Currently utilized by:
  - **Concrete Calculator**: To persist product presets.
  - **Surface Layout**: To persist material presets.
  - **Golden Ratio Tool**: To persist saved value series.

## Theme system

Defined in `themes.js` (loaded as global, not inside `src/`).
- `THEMES` object maps theme keys to `{ name, label, icon, colors }` where `colors` is CSS var → value
- `applyTheme(name)` sets CSS custom properties on `:root` and a `data-theme` attribute
- App.jsx holds `theme` state (default: `"naviPro"`, persisted to `localStorage`), applies via `useEffect`
- To add a theme: add entry to `THEMES` in `themes.js`

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
- After editing files under `src/`, run `npm run build` so `components.js` is regenerated.
- Treat `components.js` as generated output; do not hand-edit it except for emergency inspection/debugging.
- If changing pattern layout visualization, preserve the split between grouped labels and ungrouped physical chart rows. Reusing `rowGroups` for the chart breaks straight layout.
- Enter key in inputs triggers data commit/blur. The visual "icon flash" (switching to a checkmark) has been removed to maintain UI stability.
- Buttons use the "Premium Glow" interaction language — subtle box-shadows and color-mix transitions.
- No CSS-in-JS except inline style for dynamic values; use className strings
- Local persistence uses `saveStaticDefaults` for dev-mode configuration updates.
- CSS class names follow BEM-ish patterns: block, block-element, modifier

## What does NOT exist yet (possible future work)

- Export / print functionality
- Advanced User Persistence (localStorage is only used for theme choice, no database for end-users)
- Unit tests

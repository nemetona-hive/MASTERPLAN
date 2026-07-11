# NEMETONA MASTERPLAN — Developer Guide

React app for surface covering layout calculators (tiles, panels, etc.).
Hosted on GitHub Pages at: https://nemetona-hive.github.io/MASTERPLAN/

## Architecture

**No bundler.** JSX files are concatenated by a custom build script
into a single output file. Run `npm.cmd run build` on Windows, or `npm run build`
when the shell permits npm scripts. React and ReactDOM are loaded from CDN.
All global state (config, constants, compute functions) lives outside `src/`
and is available as globals — do NOT import them.

Any edit under `src/` requires a rebuild (`npm.cmd run build`) before it shows up
in the browser — there is no bundler/hot-reload watching source files. Use
`npm.cmd run watch` to rebuild automatically on save. `components.js` is a
generated build artifact; never hand-edit it — edits will be silently
overwritten on the next build.

## File load order (defined in components.jsx)

```
1.  shared.jsx                       → Icon, useProtectedRangeSlider, RangeSlider, NumInput, SLabel,
                                        Collapsible, Section, ControlPanel, Row,
                                        getLinkedCardTone, getLinkedCardMarker, useLinkedCardHighlight,
                                        Stack, Text
2.  Visualization.jsx                → PanelRowVis, PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
3.  Controls.jsx                     → S2Controls, S4Controls, LAYOUT_REGISTRY
4.  utils/timesheet.js               → parseTime, parseLunch, parseSumTime, roundMins, fmtHHMM, fmtDecimal
5.  components/Timesheet.jsx         → SheetTimesheet
6.  components/Concrete.jsx          → SheetConcrete
7.  components/PipeWrapCalculator.jsx → PipeWrapCalculator
8.  components/Home.jsx              → SheetHome
9.  components/GoldenRatio.jsx       → SheetGoldenRatio
10. components/Guider.jsx            → SheetGuider
11. components/SymmetricLayout.jsx   → SheetSymmetricLayout
12. components/SurfaceLayout.jsx     → SheetSurfaceLayout
13. Nav.jsx                          → isNavPageActive, NavButton, initOpenGroups, AppNav
14. App.jsx                          → MainPageContent, App, ReactDOM.createRoot
```

`components.jsx` is the manifest — it documents order but contains no logic.
**Never add logic to components.jsx.**
Note: `themes.js` is loaded directly in `index.html` to ensure themes apply early before React renders.

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

- `useState` destructured from React at top of shared.jsx — use directly
- All other React hooks via `React.useXxx`
- After editing files under `src/`, run `npm.cmd run build` so `components.js` is regenerated.
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

# NEMETONA MASTERPLAN — Project Context

React app for surface covering layout calculators (tiles, panels, etc.).
Hosted on GitHub Pages at: https://nemetona-hive.github.io/MASTERPLAN/

## Architecture

**No bundler / no npm.** JSX files are concatenated by a custom build script
into a single output file. React and ReactDOM are loaded from CDN.
All global state (config, constants, compute functions) lives outside `src/`
and is available as globals — do NOT import them.

## File load order (defined in components.jsx)

```
shared.jsx        → UI primitives (Icon, NumInput, Row, Section, ControlPanel, Collapsible)
Visualization.jsx → PanelRowVis, PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
Controls.jsx      → S2Controls, S4Controls, LAYOUT_REGISTRY
Sheets.jsx        → SheetHome, SheetArea, SheetSymmetricLayout, SheetSurfaceLayout, SheetConcrete, SheetNewTool
Nav.jsx           → NavButton, AppNav
App.jsx           → MainPageContent, App, ReactDOM.createRoot
```

`components.jsx` is the manifest — it documents order but contains no logic.
**Never add logic to components.jsx.**

## Key globals (defined outside src/, treat as read-only)

| Global | Purpose |
|---|---|
| `PAGES` | Navigation page definitions (id, label, title, desc, icon, parentId, isParent, noNav) |
| `SYSTEMS` | Layout system metadata (id, title, icon) |
| `DEFAULT_SH` | Default state for surface layout (W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short, rowStart) |
| `DEFAULT_SYM` | Default state for symmetric layout (roomWidth, panelWidth) |
| `DEFAULT_GR` | Default items for golden ratio tool |
| `ICONS` | Map of icon name → FontAwesome class string |
| `PAL_CLASSES` | Palette class maps for segment coloring (s1, s4l, s4s) |
| `fmt` | Formatting helpers: fmt.decimals(v,n), fmt.area(v), fmt.decimal(v), fmt.mm(v) |
| `computeS0` | Symmetric layout compute (takes sym state) |
| `computeS1/S2/S3/S4` | Surface layout computes (each takes sh state) |
| `getDescription(id, sh)` | Human-readable description for a layout system |
| `getSegmentClass(seg, palClasses)` | Returns CSS class for a row segment |

## State shape

**sh (surface layout state)**
```js
{ W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short, rowStart }
// W/H = surface mm, PPi/PLa = panel mm, direction = "V"|"H", rowStart = "top"|"bottom"
```

**sym (symmetric layout state)**
```js
{ roomWidth, panelWidth }
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

## UI components (from shared.jsx)

- `<Icon name="..." />` — renders FontAwesome icon via ICONS map
- `<NumInput id label value onChange step min />` — controlled number input with commit-on-blur
- `<ControlPanel id title open setOpen>` — collapsible panel for controls sidebar
- `<Section title bg>` — collapsible section for preview area
- `<Row label value unit hi hoverType hoveredType setHoveredType />` — data display row
- `<Collapsible>` — base for both Section and ControlPanel (variant="section"|"panel")

## Layout systems

| ID | Name | Controls |
|---|---|---|
| s0 | Symmetric | roomWidth, panelWidth (in SheetSymmetricLayout) |
| s1 | Standard | none |
| s2 | Offset | offset slider (0.1–0.9 × panel length) |
| s3 | Brick | none |
| s4 | Long/Short | s4Long, s4Short (two panel sizes) |

LAYOUT_REGISTRY in Controls.jsx maps s1–s4 to their compute functions and control components.
Best layout = fewest total pieces among valid results.

## Visualization

- `LayoutVisualization` — renders row-by-row or strip view depending on `result.meta.visualization`
- `PanelRowVis` — renders one row of segments as positioned divs
- Segments have types: `full`, `cut`, `edge`, `offcut`, `gap`
- Gap segments get red hatched styling; others get palette classes from PAL_CLASSES
- `hoveredType` cross-highlights between summary rows and visualization segments

## Mobile / responsive

- Mobile breakpoint: width ≤ 768px OR height ≤ 500px
- Nav collapses to hamburger on mobile, sidebar on desktop
- `isMobile` state in App.jsx drives nav behavior reactively on resize/rotate

## Golden Ratio tool

PHI = 1.6180339887499. Builds 7 descending steps: `base / PHI^n`.
Cards use tone system (a/b/c/d) for visual identity.
`useLinkedCardHighlight` hook links control cards to preview cards on click.

## Important conventions

- `useState` destructured from React at top of shared.jsx — use directly
- All other React hooks via `React.useXxx`
- Enter key in inputs triggers blur (global handler in App.jsx) — do not add separate Enter handlers
- No CSS-in-JS except inline style for dynamic values; use className strings
- CSS class names follow BEM-ish patterns: block, block-element, modifier

## What does NOT exist yet (possible future work)

- Concrete page (SheetConcrete) — placeholder divs only, no logic
- Export / print functionality
- Persistence (no localStorage)
- Unit tests

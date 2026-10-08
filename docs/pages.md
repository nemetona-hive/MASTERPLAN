# Pages and routing

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## Pages & routing

Hash-based routing (`#page-id`). Home = no hash.
Page render is handled in `MainPageContent` in App.jsx — add new pages there.
Nav items come from `PAGES` global — add new pages in config (outside src/).
The list is **flat**: there is no nested or grouped nav, and none should be
added without a real grouped page to build it against.

`App.jsx` reads the page from `location.hash` on load (`getHashPage`, which
falls back to `home` for an unknown id), `setPage` calls `history.pushState`,
and a `popstate` listener restores the page on back/forward. In
`MainPageContent` any `PAGES` id without its own branch renders
`SheetSurfaceLayout` (this is how `pattern-layout` is served), so a new page
needs its own branch. `setPage` ignores the page already shown, so it adds no history entry, and an
effect sets `document.title` from `PAGES`. The routed page sits inside
`PageErrorBoundary` (`components/PageErrorBoundary.jsx`), keyed by page: a render
error shows a message with "Try again" and leaves the nav, header and theme
control working. Hash links need no server support, so deep links work
under the `/MASTERPLAN/` base path on Pages.

Current pages: `home`, `pattern-layout`, `symmetric-layout`, `concrete`,
`golden-ratio`, `pipe-wrap`, `guider`, `timesheet`.

Sidebar interaction (Nav.jsx): Ctrl/Cmd+B toggles collapse globally (App.jsx);
double-clicking any nav button does the same. Arrow keys rove the list on both
axes — Down/Right step forward, Up/Left step back — over `.nav-btn` elements
found in the DOM. Roving
deliberately stops at both ends rather than wrapping.

Collapsed-nav tooltips mount
into `document.body` via a portal on hover/focus rather than sitting inside
`.nav` — that container is `overflow-y: auto`, and a tooltip parked inside it
either clips or forces the sidebar itself into horizontal scroll. Home stays
out of the ordinary list: HIVE is the expanded Home action, while the collapsed
rail renders its own icon-only Home button. This preserves one current-page mark
in either state and keeps the header toggle independent of navigation.

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

## Golden Ratio tool

PHI = 1.6180339887499. Builds 7 descending steps: `base / PHI^n`.
Cards use tone system (a/b/c/d) for visual identity.
`useLinkedCardHighlight` hook links control cards to preview cards on click.

## Guider tool

Reference/guide page. The left column holds one `ControlPanel` per category,
built from the `CATEGORIES` array in `SheetGuider` (each with its own `panelId`
and open state); the right column shows the selected entry. Add an entry to a
category's `entries` and route its id in the preview branch. An entry with no
branch shows a placeholder card.

- **Electrism** (`control-guider-list`): `Lihtlüliti`, `Veksellüliti` — inline
  SVG schematics inside `components/Guider.jsx`: square dashed switch boxes
  with open-circle contacts and a floating lever, consistent stroke widths
  (`r=4.5`, `strokeWidth=2`), and a legend/Ühendused list below each diagram.
- **Ruukki** (`control-guider-ruukki`): `Vihmaveesüsteemid` opens
  Toru põlv 70° (`components/guider/ToruPolv70.jsx`), a two-way calculator
  for a downpipe offset made of two 70° elbows: `B = L·sin α + C`, with B
  measured from the wall as the chart measures it (the lower pipe's ~30 mm
  stand-off is inside C, not added on top). The maths is
  in `utils/downpipe-offset.js` and tested against the manufacturer's chart;
  the field typed last stays fixed and the other follows it as you type
  (`NumInput live`). C = 152 mm was fitted to that chart (±5 mm), so outside
  L 100–1150 the answer is shown with an extrapolation warning. The drawing is
  the manufacturer's schematic, deliberately not scaled to the input; its B and
  L labels carry the current values. The page is laid out as a datasheet: a
  ruled strip of L and B with a summary of α and C (their fields open from
  **Muuda**, since they are rarely changed), the drawing and the graph
  side by side, and a footer with the formula and the chart's limits. Its
  breakpoints are container queries on `.guider-sheet`, since the preview's
  width depends on the sidebar and the control column. Beside the drawing, a
  graph of L against B (B 200–1250, L 50–1150, 100 mm grid) draws the line for
  the current α and C and marks the result; pressing or dragging on it sets
  the value through whichever field is the entered one. It is drawn at its
  measured pixel width (ResizeObserver) rather than a scaled viewBox, so tick
  labels stay legible on a phone.

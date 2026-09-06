# How it is put together

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## Module graph

There is no hand-maintained file order any more: esbuild derives it from the
imports, so adding a file means importing it, nothing else.

```
react-globals.js  → React, ReactDOM, useState (re-exported window globals)
shared.jsx        → Icon, RangeSlider, NumInput, Collapsible, Section, ControlPanel,
                    DetailSection, Row, Stack, MaterialPresetDropdown, SaveDefaultsButton,
                    useTimedState, useTimedSet, useClickOutside, useDropdownKeyboard,
                    useLinkedCardHighlight, getLinkedCardTone, getLinkedCardMarker,
                    isMobileViewport, safeSaveStaticDefaults, getBuildId, toNumber, clampNumber
Visualization.jsx → PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
Controls.jsx      → LAYOUT_REGISTRY
utils/timesheet.js→ parseTime, parseLunch, fmtHHMM, fmtDecimal
utils/grid-nav.js → useGridNav, arrowExitsField, nextGridPosition, GRID_NAV_KEYS
components/*.jsx  → one Sheet* per page (plus PipeWrapCalculator)
Nav.jsx           → AppNav
App.jsx           → entry point; mounts via ReactDOM.createRoot
```

`themes.js` is loaded directly in `index.html` so themes apply before React
renders.

### Arrow keys in the timesheet grid (`utils/grid-nav.js`)

Up and Down step between rows in the same column; Left and Right cross to the
neighbouring column, but only once the caret has run out of field — so fixing a
digit in the middle of `08:30` still works, which a plain "arrows always move
cells" rule would take away. An empty cell is crossed on the first press, which
is the move the feature exists for. Nothing wraps: the last column does not roll
into the next row's first, because Lunch and the following Start are unrelated
cells.

The hook finds cells with `document.getElementById(cellId(row, col))` over the
ids the page already gives its inputs (`ts-start-4`), so a renamed input breaks
the arrows silently — `tests/timesheet-grid.test.jsx` exists to catch that.

Ported from MONEYFLOW's `utils/grid-nav.js` as a subset. That version also roves
the tabindex so a thirteen-column grid is one Tab stop; not ported here, because
Tab already walks start → end → lunch → next row and adds a row off the end, and
three columns were never the walk that made roving worth it. The half that was
left behind is the half to bring over with the first grid wide enough to need it.

### Undo inside a text field (`utils/field-undo.js`)

Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y in any text field in the app, five steps deep.
Installed once from `App.jsx` and delegated: **one** listener set on the
document covers all 25 `NumInput` call sites and the 8 raw inputs, so a new
field gets undo without knowing this exists. Do not add a per-field hook.

It replaces the browser's own, which half-worked here. Writing `value`
programmatically truncates the native undo stack, and this app does it
constantly: `commitValue` clamps and reformats on blur and on Enter,
`NumInput`'s effect on `[value]` rewrites the field whenever page state moves
under it, `cleanNumericInput` restores a rejected character, and the timesheet
turns `9` into `09:00` on the way out of the cell. Undo therefore worked right
up until you blurred, pressed Enter, mistyped, or applied a preset.

Two design points worth knowing before changing it:

- **A step is an edit run, not a keystroke.** Five character-steps would be
  less than one dimension. A run breaks when the kind of edit changes, the
  caret jumps, a selection is replaced, or the field goes quiet for 800ms.
- **The "before" value is read live off the node at keydown**, never tracked
  across events. A tracked baseline goes stale the moment React writes `value`
  itself, and a stale baseline hands back a value the field never held.

Histories hang off the DOM nodes in a `WeakMap`, so a field's history dies
exactly when its node does and there is no cleanup to forget.

It is half of a pair with `doc-undo.js` below, and the two meet in exactly two
places: the generation stamp on a history, and a Ctrl+Z pressed with the focus
outside a field. Both are reachable from the keyboard and from the header pair
(`components/UndoButtons.jsx`), and both routes call the same
`stepOutsideAField`, so the button and the shortcut cannot disagree about what
"undo" means.

### Undo for what a button did (`utils/doc-undo.js`)

The other half. Snapshot-based, twenty steps, **one history at a time**, keyed
by the document on screen. A page registers through `useDocHistory`
(`shared.jsx`) and gets back `markStep(label)`, which it calls at the top of a
structural handler — before the `setState`, because the snapshot is read
synchronously off the current render's closure.

Four documents are wired: `timesheet`, `golden-ratio`, `surface-layout` and
`symmetric-layout`. What earns a step is **what a button did**, not what kind of
state changed — the timesheet's lunch presets write a text field and still take
one, because nobody typed them and field-undo never saw them. Typing never takes
one; that would be two systems answering for the same edit.

Snapshots, not inverses. The direction switch on a surface layout writes five
keys of `sh` at once and reads four more, and a hand-written inverse that missed
one would restore a layout that looked right and was not. The pages replace
their state wholesale and never mutate it, so a snapshot is a few pointers.

Two things to know before extending it:

- **The key is the document, not the route.** Every pattern-layout page edits
  the one `sh` document, so they share `surface-layout` and the history survives
  moving between them. A key that changed with the URL would throw away steps
  whose data is still on screen.
- **Snapshot the data, not the view**, and include anything the data's identity
  depends on. `SheetTimesheet` snapshots `nextCalcId` alongside its rows because
  "Clear all" resets it: an undo that restored seven rows without it would hand
  the next "Add row" an id two rows already answer to.

Concrete and Pipe Wrap are deliberately not wired. Their state is a dozen
separate `useState`s of text that field-undo already covers, and Concrete's one
destructive action is already behind an armed two-press confirm.

Both files are ported from MONEYFLOW, and both headers list what was left
behind. The short version for this pair: there is no `markDirty`, because
nothing here persists — and nothing is going to. See
[What this app deliberately does not keep](deploying.md#what-this-app-deliberately-does-not-keep).
That makes undo the **only** way back from a destructive action: there is no
file to restore from behind it.

Each module publishes its own read model — `fieldUndoState`, `docUndoState` —
and a `subscribe*` to go with it. The header pair is the only reader today. A
step is announced **only on a real change**, because a page re-registers its
history on every render and a store that woke the header each time to say the
same thing would be a cost with no reader.

## Key globals (defined outside src/, treat as read-only)

| Global | Purpose |
|---|---|
| `PAGES` | Navigation page definitions (id, label, title, desc, icon, noNav) — a flat list |
| `SYSTEMS` | Layout system metadata (id, title, icon, subtitle — subtitle can be a function) |
| `DEFAULT_SH` | Default state for surface layout (W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short, rowStart) |
| `DEFAULT_SYM` | Default state for symmetric layout (roomWidth, panelWidth, oneFullEdge, customFirstPieceWidth) |
| `DEFAULT_GR` | Default items for golden ratio tool |
| `ICONS` | Map of icon name → FontAwesome class string (defined in config.js) |
| `PAL_CLASSES` | Palette class maps for segment coloring (s1, s2, s3, s4l, s4s — the three row systems deliberately share one colour) |
| `fmt` | Formatting helpers: fmt.decimals(v,n), fmt.area(v), fmt.decimal(v), fmt.mm(v). Renders `—` for a non-finite value rather than letting `.toFixed()` print `NaN` next to a unit |
| `SUMMARY_LABELS` | Label maps for result summary rows (s0, s1s2s3, s4 keys) |
| `computeS0` | Symmetric layout compute (takes sym state) |
| `computeS1/S2/S3/S4` | Surface layout computes (each takes sh state) |
| `getDescription(id, sh)` | Human-readable description for a layout system |
| `getSegmentClass(seg, palClasses)` | Returns CSS class for a row segment |
| `THEMES` | Theme definitions (name, label, icon, colors map of CSS vars) |
| `BUILD` | `{ id }` — content hash of the deployed files, from the generated `version.js`. Read it through `typeof BUILD !== "undefined"`: a browser on a cached pre-versioning `index.html` never loaded the script |
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

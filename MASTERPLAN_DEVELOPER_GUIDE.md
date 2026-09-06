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

## Checks

`npm test` runs the vitest suite (`tests/`), covering the layout maths in
`simulation.js`, the timesheet parsers, the number coercions, the shared
primitives and the nav. `npm run verify` runs everything: tests, build, bundle
budgets, the style contract, theme contrast, the code inventory, and the UI
audit.

| Command | What it guards |
|---|---|
| `npm test` | behaviour — parsers, layout maths, primitives, nav interaction |
| `npm run audit:ui` | hardcoded colour, a word painted in an edge token, text dimmed with opacity, control edges/heights/hover recipes, dead CSS classes (`-- --unused` to list them), markup naming a class no stylesheet defines (`-- --undefined` to re-read the reviewed ones), JS/CSS breakpoint drift |
| `npm run lint` | stale hook dependencies, hooks called conditionally, names that stopped existing |
| `npm run theme:check` | contrast ratios across all three themes |
| `npm run perf:check` | download budgets for the two committed bundles |
| `npm run build` | rebuilds `components.js`, `app.css` and the icon subset |
| `npm run style:check` | load-bearing selectors still exist in `app.css` |
| `npm run analyze:code` | unreachable modules, unreferenced exports, unrouted pages |
| `npm run deploy:check` | whether the live site is serving the build you have (network; not part of `verify`) |

UI interaction is covered in four places, all jsdom. `tests/nav.test.jsx`
drives `AppNav` — roving focus, the collapsed strip, the portalled tooltip, the
mobile/desktop split. `tests/home.test.jsx` covers `SheetHome`'s cards and build
stamp. `tests/timesheet-grid.test.jsx` drives `SheetTimesheet` for the arrow-key
grid, and `tests/preset-dropdown.test.jsx` drives `SheetSymmetricLayout` and
`SheetSurfaceLayout` for the preset list — opening it, walking it, applying from
it, and the click paths that used to need two clicks.
`tests/field-undo.test.jsx` drives a real `NumInput` through keydown/input
pairs rather than `fireEvent.change`, because the module hangs on the order a
real edit arrives in — a test written with `change` would pass against a module
that could not work. `tests/doc-undo.test.jsx` drives `SheetTimesheet` through
its own buttons for the same reason: it asserts what a person gets back, not
what the store recorded. `tests/undo-buttons.test.jsx` renders the header pair
over a real page and covers the states it spends most of its life in — dead,
and dead again once the page is gone.

The rest of the calculator pages have no equivalent: Concrete, Golden Ratio and
Pipe Wrap are untouched by any render test, and so are direction switching with
its per-direction state save, panel collapse and the `LayoutPanel` controlled /
uncontrolled toggle. `verify` going green says the build is sound, not that
every page still works. Check a UI change in the browser as well — jsdom has no
layout engine, so anything that depends on a real box (the collapsed strip's
width, where a tooltip lands) is asserted structurally here and verified only by
eye.

`npm run lint` is ESLint, ported from MONEYFLOW and kept deliberately narrow:
the rules that catch a defect, none that have an opinion about style.
`eslint.config.mjs` explains each block, including why the four root classic
scripts are linted here and are not there. It is in `verify`, **not** in
`pre-commit` — that hook is about a second and stays that way.

Two rules are the reason it exists, and both are invisible in a diff.
`react-hooks/rules-of-hooks` found a real crash on its first run:
`LayoutVisualization` called three hooks before its early returns and six
after, so any layout the simulation could not use — an empty field, a surface
over the step cap — took the component from six hooks to three and back, and
React threw over the page. `react-hooks/exhaustive-deps` is a **warning**, not
an error: some stale deps here are deliberate, and a gate that fails on a
considered decision gets switched off rather than read. Read the three standing
warnings before acting on them.

Git hooks live in `githooks/` and are wired by `core.hooksPath`, which
`npm install` sets via `prepare`. `pre-commit` rebuilds, then blocks on a UI
audit error or a test failure. `pre-push` matters more here than in most repos:
GitHub Pages serves this tree directly, so a push **is** the deploy — the hook
refuses if the committed `components.js` or `app.css` no longer matches `src/`,
which is a staleness only visitors would ever see. Bypass either with
`--no-verify`.

`undefined-class` is the mirror of the dead-CSS check and the half that finds
bugs rather than untidiness: an element whose class no stylesheet defines gets
none of the styling its name implies, and nothing else in `verify` looks that
way — tests assert structure, `theme:check` reads tokens, and neither reads
markup against CSS. It is a WARN, and two exemptions are automatic: a name the
suite selects on (a deliberate hook, and reading `tests/` for it keeps the
exemption honest) and a BEM anchor. Anything else goes in
`scripts/undefined-class-baseline.json`, which is an object of name → reason —
an exemption whose reason lives somewhere else is one nobody re-reads, and one
nobody re-reads just hides the check. A baselined name that later gets styled
or deleted is reported as `stale-baseline`, so the list cannot outlive what it
excused.

Two of the audit's checks exist because **`theme:check` structurally cannot
make them**. It compares the token pairs somebody thought to list, and neither
of these is a pair anyone would think to list:

- **`text-in-edge-token`** — a word painted in `--border`, `--edge`, `--divider`
  or an alias onto one. A border token is tuned to be *just* visible as a line,
  so it is fine as a border and far under 4.5:1 as text; a pair test cannot tell
  the two apart, because what is wrong is which property the token is in. It
  resolves one level of aliasing first, which is what catches
  `--color-gray-light` — a name that says "grey" and *is* `--border`. A token
  mixed toward `transparent` is reported for the same reason: the thinned value
  is one the palette never cleared.
- **`text-dimmed-with-opacity`** — `opacity` thins text as well as its
  background, and the result is a colour no gate measured. There is no useful
  alpha between "no dim" and "unreadable", so the check has no threshold. Three
  things are exempt automatically — `:disabled` (WCAG exempts inactive
  controls), `opacity: 0` (hiding is not dimming), and `@keyframes` (a start
  state is not a resting state). Anything else says so at the site with
  `audit-ui: decorative` (paints no words) or `audit-ui: contrast-ok` **with the
  measured ratio**, and the marker has to sit on the declaration or the two
  lines above it — the window is tight so a marker cannot reach past its own
  rule. Inline `style={{ opacity }}` in JSX is checked too, since nothing else
  in `verify` can see it.

Both are ERROR. Dim text by choosing a lighter token, not by thinning the one
you have.

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

`npm run audit:ui` enforces four of these mechanically, and they find what a
review cannot: `control-border` (an edge drawn as a `border` rather than an
inset ring, so a tier swap shifts layout), `control-size` (a height written by
hand instead of taken off the scale), `control-icon-height` (`.ctl-icon`
composed with no height source, which gives a 32px-wide box as tall as its
glyph) and `control-no-height` (a tiered control that states no height at all —
the opposite shape, and the one thing every other check reads as clean).

They find a control by asking the **markup**, not the name: anything rendered as
a `<button>` counts, whatever it is called. Names are used as well, never
instead, because a class can be styled here and only ever rendered through a
variable.

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
| touch | `--ctl-h-touch` (44px) | **not a visual step** — the floor a finger needs (WCAG 2.5.5), applied as a `min-height` inside the mobile queries so a control grows to meet it without leaving the step it is on |

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

**The `.result-card` mobile contract.** Below 1024px the `.layout-split` result
column stops being a sidebar and becomes a fixed bottom bar, so everything in it
competes for one 360px-wide row. Build cards out of the shared vocabulary rather
than inline styles, or the bar's rules cannot reach them:

| Class | Role | In the bar |
|---|---|---|
| `.result-card-title` / `-value` | the headline stat | kept, shrunk |
| `.result-card-footer-item` | a label/value detail pair | hidden |
| `.result-card-note` | a secondary reading of the headline | hidden |
| `.result-card-split` | a second stat under a rule | rule turns vertical, sits beside |

Inline styles are the trap: a `style` attribute outranks any rule, so a card
built with them keeps its desktop spacing in the bar and pushes the row wide.
Concrete's card did exactly that — its Global Reset was clipped off the right
edge at 360px — while Timesheet's, built from these classes, was fine.

Destructive actions arm before they fire. Concrete's Global Reset clears every
field, so the first click swaps its label to "Confirm reset?" and gives it the
danger treatment; the second does the work. It disarms on a timeout and on focus
leaving, both via `useTimedState`, which is how this codebase already holds
transient UI state. No modal — a button that changes its own label needs no focus
trap and keeps working from the keyboard.

Put in the column only what belongs to the *result*. Everything there lands in
the bar, so it must be worth the width and safe to tap above the thumb.
Timesheet's Copy button qualifies. Concrete's Global Reset did not — it clears
every field without confirming — and now closes the form column instead, as
`.form-action`.

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
10-nav.css             nav buttons, collapse and menu
20-shell.css           header, wrapper, page, layout
30-data.css            main data area, num input, data row
40-control.css         control panel, segmented controls, golden-ratio cards
50-preview.css         sys block, panel row/seg, strip visualisation
60-timesheet.css       timesheet page
70-home.css            home page
80-mobile.css          @media: narrow-stacking, mobile, landscape, ultra-small
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
nothing here persists. When localStorage autosave lands it goes into the history
entry beside `apply`, because an undo has to be saved like any other change or
what is on disk keeps the action you just took back.

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

## Pages & routing

Hash-based routing (`#page-id`). Home = no hash.
Page render is handled in `MainPageContent` in App.jsx — add new pages there.
Nav items come from `PAGES` global — add new pages in config (outside src/).
The list is **flat**. Nav.jsx used to carry generic group machinery — nested
pages via `parentId`/`isParent`, expand/collapse, a chevron, auto-open on
navigating to a child — kept against a grouped page that was never added. It is
gone, along with its stylesheet half (`.nav-parent`, `.nav-sub-btn`,
`.child-active`, `.nav-parent-chevron`). Grouping the nav means writing it
again, deliberately, against a real requirement.

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
infer "capped" from an empty `rows`, because `countSegs([], "gap")` is `0`,
which reads as a *valid* zero-panel layout. That was a real bug: the panel
showed "Valid" over nothing.

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
- `<NumInput id label value onChange min max unit req labelIcon presetsOpen onTogglePresets />` — controlled number input with commit-on-blur and optional icon.
  It is `type="text"` with `inputMode="decimal"`, not `type="number"`: a number
  input steps its value on ArrowUp/ArrowDown and on a wheel scroll while focused,
  so reaching for the caret rewrote a dimension the layout is drawn from. Non-numeric
  characters are filtered as they are typed, and `min`/`max` clamp on commit rather
  than reaching the DOM. There is no `step`: it belonged to the spinner, which the
  stylesheet always hid. Ported from MONEYFLOW's `MoneyInput`.
  Pass `onTogglePresets` on a field that has a preset list and it grows a
  chevron button next to the commit button; `presetsOpen` turns the chevron
  over and sets `aria-expanded`. The page still owns whether the list is
  open — see below.
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
  **It opens from the field's chevron button and nothing else.** It used to
  open on focus or on a click anywhere in the field, so the list covered the
  controls below it whenever somebody went to type a number, and clicking
  elsewhere was the only way to dismiss it. The three fields that carry a
  list — Surface Layout's width and length, Symmetric Layout's product
  width, Concrete's consumption — pass `onTogglePresets` to `NumInput` and
  keep owning the open/closed state themselves. The toggle hands focus back
  to the input on the way, because `useDropdownKeyboard` is wired to the
  field's keydown: a button that kept focus would leave the list open and
  unwalkable. **It focuses before it toggles, and the order is load-bearing:**
  moving focus blurs whichever field had it, which commits that field, and a
  page whose fields share one open-list value closes the list from there —
  toggle first and that close lands second and undoes it, which is how opening
  another field's list came to need two clicks. `tests/preset-dropdown.test.jsx`
  pins every part of this.
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
- Font Awesome is vendored, never a CDN — the app must work fully offline.
- **Solid only.** The regular and brands faces are gone. `fa-brands-400.woff2`
  was 115 KB downloaded to draw a single nav icon, and regular was declared but
  never requested. An icon class from any other style (brands, regular, duotone,
  sharp) has no face behind it, so `build-icons.js` fails the build rather than
  letting it render as a blank box.
- What ships is generated, not the vendored originals. `scripts/build-icons.js`
  reads `vendor/fontawesome.min.css` and `vendor/fa-solid-900.woff2` and writes:
  - `vendor/fontawesome.subset.css` — the 30 icons `ICONS` names, 1.4 KiB, from
    a 72 KiB sheet of 1,895 that was the largest render-blocking request on the
    page
  - `vendor/fa-solid-900.subset.woff2` — 3.0 KiB, from 155 KiB, subset through
    harfbuzz (`subset-font`) to just the glyphs that CSS emits

  The two originals stay in the repo as inputs. Nothing links them, so they cost
  nothing on the wire. With the brands face dropped that is 342 KB of icon
  assets down to 4.4 KB, and 35% off the page.
- Add an icon by editing `ICONS` in `config.js`, then rebuild. If the name is not
  a real Font Awesome icon the build fails — which is how `fa-circle-0`, an icon
  Font Awesome has never had, sat in `ICONS` drawing nothing on the Symmetric
  Layout title. A missing glyph is silent in the browser; that is the whole
  reason this is generated rather than hand-maintained.
- The font output is byte-identical run to run, which is what lets
  `githooks/pre-push` diff it like any other committed build output. If that ever
  stops holding, the fix is to drop it from that diff — not to bypass the hook.

## Visualization

- `LayoutVisualization` — renders row-by-row or strip view depending on `result.meta.visualization`.
- **Large Preview Modal**: Full-screen analytical dashboard.
  - **Live Synchronization**: Edits to material or surface inputs within the modal reflect immediately in the visualization and stats.
  - **Dashboard Layout**: Uses a 3-column split (Material/Surface, Layout Engine, and Detailed Statistics).
  - `MaterialSpecification` takes an `isLargePreview` flag (set by the
    `LargePreviewMaterialSpec` wrapper); it hides the "Manage Presets" button
    there, since preset management belongs to the main control panel, not the
    modal.
  - The main-page instance also takes `largePreviewOpen`, which disables its
    `useClickOutside` while the modal is up so it cannot swallow clicks aimed
    at the modal's own dropdown. Pass the state, not a DOM probe: this was a
    `document.querySelector` for a class that never existed, so the guard was
    dead for as long as it had been written — and a query during render reads
    the *previous* commit even when the selector is right.
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

## Build stamp — verifying what is live

A push is the deploy, and nothing on the far side reports back, so the app
carries a build id: `version.js` defines a `BUILD` global, read through
`getBuildId()` in `shared.jsx`.

It is displayed in **two mutually exclusive places, one per breakpoint** —
never both at once:

| | Where | Gated by |
|---|---|---|
| Desktop | bottom of the nav rail | JS — `NavBuildStamp` bails when `mobile`, and when the rail is collapsed (the strip is 60px and this is the one nav item with no icon to shrink to) |
| Mobile | Home page footer, under `NEMETONA HIVE` | CSS — `.home-build` is `display: none` until the mobile media query, so it re-evaluates on resize without the component tracking the viewport |

Mobile does not use the nav for this: the drawer is shut by default, which puts
the stamp two taps behind a hamburger for anyone who does not already know it is
there. A test in `home.test.jsx` reads `70-home.css` to pin the exclusion — if
that default stopped being `none`, desktop would render the stamp twice and
nothing else would catch it.

The rail's copy only reaches the bottom because `.nav` takes `flex: 1`: it is a
column flex item in `.page-side` with no height of its own, so without that it
is content-sized and `.nav-bottom`'s `margin-top: auto` has no free space to
push into. `min-height: 0` alongside it is what lets the nav's `overflow-y`
scroll rather than the item just growing.

```
npm run deploy:check     # fetches <site>/version.js and compares to local
```

`OK live matches local — 788db7e4`, or it names both ids. Override the URL with
`MASTERPLAN_SITE` if the Pages address ever changes.

**The id is a content hash, not a timestamp, and that is load-bearing.**
`scripts/build-version.js` hashes `index.html`, the three classic scripts it
loads by hand — `config.js`, `simulation.js`, `themes.js` — and the generated
`components.js`, `app.css` and two font subsets: everything a visitor loads that
this repo owns, which is wider than what the build generates. The three are the
app as much as the bundle is (defaults and the page registry, the layout maths,
the theme tokens), so hashing only generated files would let a deploy that
changed any of them pass `deploy:check` as already live. `githooks/pre-commit`
therefore triggers on all four as well as `src/`, so a commit touching only one
still rebuilds the stamp rather than leaving it for `pre-push` to reject — and
still runs the tests, which read all three as globals. That hook rebuilds and refuses
the push if a generated file moved, so a stamp that read the clock would change
on every build and wedge the gate shut permanently.
`git rev-parse HEAD` fails the same way and is wrong besides: at `pre-commit`
time HEAD is still the *parent* commit, so the stamp would ship one commit
behind. A hash of the output is stable for a given source tree, which is the
property the hooks already assume.

It also answers a better question. A date says when someone ran a build; a
content hash of the served bytes says whether the live site *is* the tree you
have. `tests/version.test.js` pins the determinism and asserts the generator
touches neither `Date` nor git — the failure mode is a push blocked days later,
long after the cause is obvious.

### The two clocks

A push does not become visible all at once, and the stamp reads differently
depending on where you look at it. Measured across three deploys:

| | Delay | What it reflects |
|---|---|---|
| `npm run deploy:check` | **40–50 s** | the Pages *origin* — it fetches with `cache: "no-store"` |
| The nav footer in your browser | **up to 10 min** | whatever your browser has cached |

The gap is `cache-control: max-age=600`, which Pages sets on HTML and gives no
way to override — there is no header configuration on Pages. Within that window
a browser that visited before the push keeps its old `index.html`, which has no
`version.js` tag, so no stamp renders at all. That is the case `NavBuildStamp`'s
`typeof BUILD` guard exists for: the nav renders intact and the stamp is simply
absent, rather than a `ReferenceError` taking the sidebar down.

**So when the two disagree, neither is broken — the gap *is* the propagation
delay.** `deploy:check` is authoritative for what is deployed; a missing or
stale footer on a site it has called current means your own cache. Skip the wait
with a hard reload, or with a query string, which changes the cache key:

```
https://nemetona-hive.github.io/MASTERPLAN/?v=<build id>
```

Diagnosing a deploy that really has not landed: `curl -s <site>/version.js`
shows the id at the origin, and `curl -sI <site>/index.html` reports `age`, how
many seconds the edge has been holding its copy.

Two consequences worth knowing:

- `version.js` must be committed with the rebuild, like `components.js`. A test
  fails at commit time if it is stale, rather than leaving it for `pre-push`.
- Editing `index.html` changes the id even when nothing else moved, because the
  page itself is part of what gets served.

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

### The header actions cluster

`.header-actions` is one cluster pinned to the right of `app-head`, holding
`.hdr-group`s. It is **absolute, not in the flow**, and that is load-bearing:
`.app-head` centres the logo, so a cluster taking part in the layout would push
the wordmark off centre by its own width.

Groups are divided by **reach** — undo acts on the page or the field you were
in, the theme on the whole app — with an `.hdr-sep` between. Ordering them that
way puts the narrowest action furthest from the app-wide one, so the two least
alike are never adjacent. A third group goes on the end and takes another
separator, which is the same 1px `--edge` the ghost ring is drawn with: a second
tone would be a new kind of line in a header that has exactly one.

`.hdr-btn` is the header's base control and contributes **only the step** —
md, per the size scale's own note that md is "the default, and any standalone".
Everything else is composed in the markup: `hdr-btn ctl-ghost ctl-icon`, so the
tier, the hover, the active plate and the press all come from `65-controls.css`.
This is deliberately *not* a port of MONEYFLOW's `.hdr-btn`, which carries its
own fill, ring, hover and colour — that would be the second recipe the control
system exists to prevent. Its radius comes from the shared rectangular-controls
rule, which `.hdr-btn` joins rather than restating.

The disabled state is the one place dimming with `opacity` is right: the pair is
disabled most of the time, a disabled control is *meant* to fall below the
contrast a live one owes, and WCAG exempts it for that reason.

`.hdr-btn.is-wide` is the variant for a control carrying a word — it drops
`.ctl-icon`'s squaring and takes the md horizontal padding. The theme toggle is
the only one: an icon-only toggle says what it does and never what it is set to,
and with Graphite and Verdant close in weight, "which am I on" is a fair
question to answer without clicking.

**In landscape (`max-height: 500px and max-width: 950px`) the logo is hidden and
the bar is kept.** It used to be the whole header that went — right while the
header held only a wordmark, and wrong the moment it held controls, because it
took undo, redo and the theme off the screen with no other way to reach the
theme at all. The cluster leaves its absolute pin there (there is no centred
logo left to avoid) and the buttons pick the `sm` step, so the bar costs about
33px instead of 48.

Both header controls are components under `src/components/`, not markup inside
`App.jsx`. That file mounts itself on import and exports nothing, so anything
written inline in it cannot be rendered by a test.

### The header wordmark (the molten lift)

The NEMETONA mark in `app-head` is a token system, not a drawing. Set the
`--logo-*` tokens on `.header-logo` (`src/styles/20-shell.css`); never restate
the layer opacities, the keyframes or the stagger.

Emission is coupled to elevation: as a glyph lights it also rises, and its
shadow drops further away and fades. That inverse pairing is the effect — a
shadow that merely darkened as the glyph brightened reads as a glow being
switched on, not as a letter leaving the header plane.

The geometry is declared once in `LOGO_GEOMETRY` (`App.jsx`) as inert shapes
carrying no fill or stroke, and three `<g>` layers clone it with `<use>`:
`.logo-drop` the cast shadow, `.logo-glow` the bloom, `.logo-core` the glyph.
`LOGO_SHAPE_IDS` is **reading order**, which is neither the declaration order
nor the order the original export used — `--i` is a shape's place in the word,
and the stagger runs along it.

Two things that are easy to get wrong:

- **`--logo-rise` is in viewBox units, not pixels.** The 410×63.9 viewBox drawn
  32px tall scales by about 0.078, so the default `3.2` is a quarter of a screen
  pixel. Anything that looks like a sane px value here is enormous.
- **`.header-logo` needs `overflow: visible`.** The bloom and the shadow are
  both larger than the viewBox, and without it the SVG viewport clips them to a
  visible rectangle.

Ported whole from MONEYFLOW, tokens and keyframes unchanged — the two repos
draw the same mark from byte-identical geometry. It replaced a flat fill piped
through a linear gradient, declared twice: in an inline `<style>` inside the SVG
and again as `.cls-1` in `10-nav.css`, a stylesheet about the nav.

Colour comes from `--brand`, `--text` and `--shadow-rgb`, so a new theme gets
the mark for free. `--shadow-rgb` is why: a hardcoded black cast shadow goes
muddy on Verdant's light page.

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

- Export / print functionality — `downloadFile` in `shared.jsx` is the piece it
  would build on
- Advanced user persistence. `saveStaticDefaults` writes to `config.js` from the
  dev server only, and localStorage holds nothing but the theme choice. There is
  no per-user data and no backup path for it, unlike MONEYFLOW's `_personal/`
- A `Dialog` primitive. MONEYFLOW has one, but its recipe reads seven tokens
  this theme has no answer for, so it is a design decision rather than a port
- UI interaction tests for the calculator pages. `AppNav` and `SheetHome` have
  them; none of the other `Sheet*` components do. See [Checks](#checks) for what is uncovered — this is
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

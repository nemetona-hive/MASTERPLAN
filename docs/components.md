# Shared components

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## UI components (from shared.jsx)

- `<Icon name="..." />` — renders FontAwesome icon via ICONS map
- `<NumInput id label value onChange min max unit req labelIcon presetsOpen onTogglePresets />` — controlled number input with commit-on-blur and optional icon. A parent that clears state in `onChange` must compare first, because blur re-commits an unchanged value.
  `live` also reports each keystroke that already reads as an in-range number (blank otherwise), for two-way calculators such as Guider's Toru põlv 70°; blur and Enter still clamp and round, and the field is not rewritten from its own live value, so a trailing `.` survives.
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
  `showActionLabels` adds visible **Presets** and **Apply** words to those two
  buttons. Pattern Layouts uses it on its four required dimension fields,
  Axial Alignment on its area and product widths, and Concrete on consumption.
  Other numeric fields keep their compact single-action presentation.
- `<RangeSlider id value onChange min max step className />` — lockable range slider with lock/unlock toggle. Starts locked; click the row or tap the lock icon to unlock.
- `<ControlPanel id title headerDetail headerAction open setOpen noToggle>` — collapsible panel for controls sidebar;
  `headerDetail` renders optional contextual metadata directly below the panel heading.
  `headerAction` puts a control at the head's right end (the Projects button,
  so the project name below gets the whole width). It renders only with
  `noToggle`: a folding card's whole head is its toggle button, and a button
  cannot sit inside another. `Section` takes it the same way.
  (`Section` and `ControlPanel` are one internal `Collapsible`
  wearing two variants; the base is not exported). Pass **both** `open` and
  `setOpen` to control it. `open` on its own is read once as the initial state
  and never again — every such call site passes a literal, and the effect that
  used to copy it on change only bought a second render and a way to clobber a
  user's toggle mid-interaction.
- `<Section title bg>` — collapsible section for preview area
- **Preset libraries** (`components/PresetLibrary.jsx`): one hook and four pieces for every page with a product list — Concrete's one library, Gypsum's three, Pattern Layouts' two (materials and inputs, both sizes: no `describe`, so the dropdown draws width × length; `validate` gives the page's range message; `nameLabel` titles the inputs table "Configuration Name"), and Axial Alignment's two (the same defaults, width only, with `draftKey: null`: a list the page has no dialog to edit is read from its defaults and kept by nobody, while the applied preset is kept). `useSessionState(null, …)` is plain state for exactly that case. `usePresetLibrary(lib, { onApply, active, setActive })` holds the list (as a draft under `lib.draftKey`) and applies or saves it; the page keeps which one is applied, since Gypsum keeps that per room. `PresetField` is a field with the shared `MaterialPresetDropdown`, `presetHeader(library)` names the applied preset through `SelectedPresetDetail`, `ManagePresetsButton` shows only where Save Defaults can write, and `PresetManager` is the table, in a `Modal`. A library is data; its fields are listed in the file's header.
- `<Row label value unit hi danger hoverType hoveredType setHoveredType />` — data display row
- `<SegGroup id value options onChange label inline disabled />` — a segmented choice: `.ctrl-dir` segments in a `.seg-group` track, named by `label` as a `role="group"`, the chosen one `.on` and `aria-pressed`. `options` are `[id, text]` pairs, or `[id, text, name]` when the text is too short to name the option (Pattern Layouts' `V` is "Vertical"). `onChange` hears only a change, so a re-click of the chosen option spends no undo step. `inline` sizes the segments to their text, for a switch in a section heading. `disabled` maps an option id to the reason it cannot be chosen now: the segment is disabled and the reason is its title. Every segmented control in the app is one; do not hand-write the markup.
- Result card units: `.result-card-unit` after a headline figure (`pcs`, `h`) and `.result-card-currency` before a price, both in `96-detail-layout.css`; `.result-card-detail` is a secondary line that stays in the phone's bar, where `.result-card-note` is hidden. Not inline styles: the phone's result bar has to be able to size them.
- `<DocHead title>{sub}</DocHead>` (`components/DocHead.jsx`) — the head of every printed sheet: title, the line under it, and the date and build stamp. The cut list, the concrete take-off and both gypsum sheets use it.
- Layout classes the calculator pages share, in place of the inline styles they replaced: `.pw-grid-2col` has no margin of its own (it sits in a Stack); `.pw-formula-wrap--lead` sets the first note off from the rows above; `.calc-details` sets Calculation Details further off than the Stack gap; `.result-sticky` is the result card's column (sticky, level with the first section heading).
- **Formats** (`utils/format.js`): `nf(value, places)` a grouped figure, `mm(value, places)` millimetres (no grouping, decimal comma only for a fraction), `eur(value)` two-decimal euros. Use these rather than another `toLocaleString`.
- `<Stack gap direction className as>` — flex layout primitive; gap uses spacing scale (0.5–7); direction = "column"|"row"
- `<Text size weight variant color as>` — typography primitive; size = xs–xxl, weight = reg–black, variant = sans|mono
- `<MaterialPresetDropdown anchorRef presets activePreset onApply field title describe />` — floating portal dropdown for width/length quick-select; `title` distinguishes material and input libraries. Presets are `{ name, width, length }`; for a library that is not sizes, `describe(preset)` returns `{ meta, value, unit }` for the row instead (Gypsum's fillers and adhesives). It is portalled to `<body>` in document coordinates, so it re-places itself under its field on any scroll (captured, since scroll does not bubble) and on resize: measured once, it stayed put while the desktop control column, its own scroller, carried the field away.
- `<SelectedPresetDetail preset />` — the applied preset's line in a form card's `headerDetail`. `preset` is `{ name, width, length }` (a trailing size in the name is not repeated) or `{ name, detail }` for a preset that is not a size.
  **It opens from the field's chevron button and nothing else.** It used to
  open on focus or on a click anywhere in the field, so the list covered the
  controls below it whenever somebody went to type a number, and clicking
  elsewhere was the only way to dismiss it. The dimension fields in Pattern
  Layouts and Axial Alignment, plus Concrete's consumption, pass
  `onTogglePresets` to `NumInput` and keep owning the open/closed state
  themselves. Desktop clicks and keyboard
  activation hand focus to the input, because `useDropdownKeyboard` is wired
  to the field's keydown. A mobile tap opens the list without focusing the
  input or summoning the numeric keyboard; tapping the input still permits
  manual entry. **It settles focus before it toggles, and the order is load-bearing:**
  moving focus blurs whichever field had it, which commits that field, and a
  page whose fields share one open-list value closes the list from there —
  toggle first and that close lands second and undoes it, which is how opening
  another field's list came to need two clicks. `tests/preset-dropdown.test.jsx`
  pins every part of this.
  With presets enabled the field exposes the combobox pattern: `aria-expanded`
  and `aria-controls` identify the list, and `aria-activedescendant` follows the
  option walked with the arrow keys while DOM focus stays in the editable field.
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
- `useDropdownKeyboard(count, onSelect, onClose)` — Specialized hook for keyboard navigation (Arrow keys, Enter, Esc) within custom dropdowns.
- `.seg-group` — a recessed track for exclusive mode switches. Its segments carry no ring of their own; the track supplies the edge.
- `.pill-btn`, `.ctrl-dir`, `.ts-btn`, `.num-btn` — see [Controls and buttons](controls.md). Pick a tier by what the control does; do not write a new hover or active recipe.

## Modals

Both overlays on the pattern-layout page — the material presets editor and the
large preview — go through `Modal` in `shared.jsx`. It wraps the `.mp-modal-*`
chrome the app already had; the markup was never the missing part, but having it
in one place is what made the behaviour arrive in both at once. Before that each
call site wrote its own overlay, and consequently **neither had a role, a focus
trap, an Escape, or focus restored on close**.

`useDialogFocus(panelRef)` is the behavioural half, ported from MONEYFLOW.
MONEYFLOW's `Dialog` component is deliberately **not** ported: that recipe reads
several tokens this theme has no answer for, and this app has its own chrome.

Three things it does, each for a reason worth keeping:

- **Traps Tab.** `aria-modal="true"` is a promise about behaviour that the
  markup alone does not keep. Here it was concrete rather than theoretical: the
  large preview renders its own copy of the material fields over a page that
  still holds the originals, so tabbing out landed you on the same three inputs
  you thought you were editing — the ones underneath, changing the layout behind
  the dialog. The dropdowns already needed `isBackground` to stop the two copies
  fighting; this was the same collision on the keyboard.
- **Gives focus back on close**, guarded on `document.contains` — focusing a
  detached node silently moves focus to `<body>`, which is the state it exists
  to avoid, reached another way.
- **Parks focus on the panel**, which is why the panel carries `tabIndex={-1}`.
  It is also where the trap holds focus in a dialog with nothing focusable.
- **Counts only rendered tab stops.** The large preview contains desktop-only
  controls hidden by the mobile stylesheet; including them as the first or last
  stop lets a mobile browser skip the trap boundary and leave the dialog.

Escape and the scrim click both come from `useModeExit`, so the two ways of
dismissing a dialog cannot drift apart. That replaced a hand-written
`onMouseDown` comparing `e.target === e.currentTarget` at each call site — the
same rule stated twice.

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
  Props beyond `result`: `rowStart` ("top"/"bottom" — which side R1 is drawn
  on), `maxHeight`, `onLargePreview`, `alwaysShowLabels`, and two optional
  ones only the Gypsum page passes:
  - `onSelect(pick | null)` — told the selected piece (`{ seg, row, rowIndex }`)
    after every render, and null once nothing is selected or the piece is no
    longer drawn. Keep a primitive from it (a string): the parent's state
    update then bails out instead of re-rendering in a loop, since the result
    object is usually rebuilt each render.
  - `onRowToggle(lane)` — turns each row label into a checkbox
    (`role="checkbox"`, ticked unless `row.excluded`). Passing it also
    switches the labels, piece numbers and door/window names to fixed screen
    pixels (the component measures its own scale with a ResizeObserver after
    every render) and adds edge padding; without it everything is sized in
    drawing units, as Pattern Layouts has it.
  `meta.exactRows` draws each row at its real width (Gypsum, to scale);
  without it H mode gives every row a standard lane (below).
- **Large Preview Modal**: Full-screen analytical dashboard.
  - **Live Synchronization**: Edits to material or surface inputs within the modal reflect immediately in the visualization and stats.
  - **Dashboard Layout**: Uses a 3-column split (Material/Surface, Layout Engine, and Detailed Statistics).
  - The modal draws the page's own material and surface cards again
    (`MaterialCard` / `SurfaceCard` with `manage={false}`): preset management
    belongs to the main control panel, not the modal. Both copies share the
    page's two preset libraries, so a preset applied in either is the same
    choice.
  - Each field keeps its own "list open" state (`PresetField`), so the page's
    copy behind the scrim cannot close the modal's list. The page used to share
    one such state between its two fields and needed a `largePreviewOpen`
    guard to stop its click-outside swallowing the modal's clicks; with the
    state per field there is nothing to guard.
  - Modal copies use a `large-` ID prefix. The background fields still exist
    behind the scrim, so reusing their IDs can send label and ARIA relationships
    to the wrong copy even while keyboard focus is trapped.
  - **Mobile Optimization**: Hides secondary settings on mobile to maximize visualization space; enables horizontal scrolling for wide room layouts.
- **Horizontal Mode (H mode)**: Intentionally gives each row a standard lane height for readability. Partial final rows are drawn inside that lane so narrow rows remain visible.
- `PanelSummary` — displays detailed statistics and counts for segments.
- Segments have types: `full`, `cut`, `edge`, `offcut`, `gap`, `joint`.
- `gap` means uncovered/invalid geometry and gets red hatched styling. `joint`
  is intentional spacing between material pieces and uses the neutral joint
  treatment; it is not material and must never enter a cut list.
- `hoveredType` cross-highlights between summary rows and visualization segments.
  Pattern-layout state also carries its layout ID, because a type such as
  `full` occurs in every system and must not highlight sibling previews.
  A segment is matched on its `hoverKey`, which is its type everywhere except
  long-short (S4): there it is `long` or `short`, the two things its summary
  rows count, and long pieces take the S4 colour. When the stock allocation
  still retyped long pieces cut from longer stock as `cut`, matching on type
  drew long and short alike and lit all of them from one row.
- Pattern layout chart geometry must render real physical rows/columns, not grouped rows.
- `rowGroups` is for label grouping only. The visible chart must use one visual row/column per real `orderedRows` item so straight layout keeps all panel boundaries visible.
- In `direction === "V"`, the visualization keeps surface width horizontal and surface length vertical; rows render as vertical columns and segment positions use `top`/`height`.
- In `direction === "H"`, rows render horizontally and segment positions use `left`/`width`.

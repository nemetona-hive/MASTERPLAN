# Shared components

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

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

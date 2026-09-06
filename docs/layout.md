# Layout, spacing and the mobile split

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

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

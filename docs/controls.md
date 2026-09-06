# Controls and buttons

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

# Controls And Buttons

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

# Stylesheets and the theme system

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

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

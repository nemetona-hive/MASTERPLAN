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

## Type faces

Three faces, one role each, all self-hosted in `vendor/fonts/` — the app makes
no font request off the machine:

| Token | Face | Role, as the browser inventory found it |
|---|---|---|
| `--mono` | JetBrains Mono | **Data and controls**: inputs, field labels, data rows, results' small print, segmented controls, buttons, the SVG layout labels |
| `--sans` | IBM Plex Sans | **Content**: the `body` face — page and card titles, result figures, the home wordmark, and **every printed document** (`.doc-sheet` sets it) |
| `--font-ui` | Inter | **Chrome**: the nav labels, and nothing else today |

Text that sets no family inherits `--sans` from `body` — except a form control.
A `<button>`, `<input>` or `<select>` takes the browser's own font unless a
rule gives it one, and that font is Arial: a control that forgets to state a
family draws in a face that was never vendored. No stylesheet check can see a
declaration that is missing, which is why the inventory below is done in a
browser.

Every `font-family` in `src/` is one of the three tokens or `inherit`, with no
literal fallback inside the `var()`, and every `font-weight` is a `--fw-*`
token (400 / 500 / 600 / 700) or `inherit`. `audit:ui`'s `type-token` check
enforces both, in stylesheets, inline styles and SVG attributes. There is no
800: `--fw-black` drew 700 everywhere it was used, because no face goes past
it, and was removed.

`b` and `strong` are left on the UA's relative `bolder`. MONEYFLOW pinned them,
because there `bolder` inside a bold parent computed 900; here both uses
(`GypsumTakeOffSheet`'s wall captions and `ProjectMenu`'s open project) sit in
regular text and compute 700. Pin them in `00-base.css` the day one lands in a
bold parent.

### The files behind the faces

`vendor/fonts/fonts.css` is the only place a font file is declared.
`index.html` loads it before `app.css`; it is not part of the build, and it is
not generated — but `build-version.js` hashes it and every woff2 beside it, so
a font-only deploy moves the build id.

- **Two subsets per family**, split as Google Fonts splits them: `latin` and
  `latin-ext`. The browser fetches latin-ext only when a page draws one of its
  letters. It is not optional — Estonian names carry š and ž, and before
  latin-ext was vendored those two letters were drawn by a system face between
  letters of JetBrains Mono in a room-name field, and on the take-off it
  printed.
- **Plex and JetBrains Mono are variable fonts**, so each subset is **one**
  face with a weight range (`font-weight: 400 700`), never one face per weight.
  They used to be declared per weight over byte-identical copies, and a
  calculator page fetched the Plex file twice and the JetBrains Mono file three
  times.
- **Inter is static**, one file per weight per subset, the exact upstream 4.001
  subsets.
- **Provenance**, each file byte-identical to its source: JetBrains Mono's latin
  file comes from fonts.gstatic.com (2.211; Google trims the axis to 400–800 and
  drops HVAR, 9 KB lighter than @fontsource's); every other file is @fontsource
  5.3.0 (Plex 3.201, JetBrains Mono 2.211, Inter 4.001). The OFL licence for
  each family sits beside its files. MONEYFLOW ships the same bytes.
- **No italic face.** One surface sets italic — the cut list's Gap chip, in
  print — and Chrome slants the upright Plex for it.

**JetBrains Mono stops at 600.** Its files reach 800, but its faces are
declared 400–600, so every `--fw-bold` figure draws semibold — the weight the
figures were tuned against. Measured in Chromium (canvas ink per weight): 600
and 700 draw the same pixels. Raising it is a visible change to every bold
figure; it is written down twice on purpose, in `fonts.css` and in `CEILING`
in `scripts/check-fonts.js`, and the check fails if the two disagree.

**Why the files are not subset here**, the way `build-icons.js` subsets Font
Awesome. Measured with `subset-font` on 2026-11-09: re-subsetting a file to
its own cmap saves 1–2 KB (4–8%), and cutting it to the latin + latin-ext
range saves 3–6 KB more. User-typed text — project, room and preset names — can
hold any letter, so a subset cannot go below that range, and merging the two
subsets would make every visit download the latin-ext glyphs that today load
only when a page draws š or ž. A few KB does not buy a generated step, a
committed output for `pre-push` to police, and bytes that move when harfbuzz
does. Google's split stays.

**What falls back to a system face, by design.** No latin or latin-ext subset
of these faces carries them:

- arrows and symbols: `→` (cut-list headers and rows, the Guider), `↔` (the
  Guider), `≈` (gypsum skim rate), `✓` (the step marker), `◇` (theme fallback
  icon), `⅓ ⅔` (pattern names);
- Greek: `φ` ("Golden Ratio φ" in the nav and on its home card), `π` (pipe
  wrap), `α` (downpipe guider). A greek subset exists for all three families;
  vendoring it would change how those letters look, so it is a design decision,
  not a gap;
- the theme icons, which are emoji.

**The inventory.** Done in Chromium through `npm run layout`'s static server:
every visible text node and form field on every page and Guider entry, plus the
three printed documents under print media, with the family, weight and style
the cascade computed and the fonts DevTools reports actually drawing each node
(`CSS.getPlatformFontsForNode`). That is how the Arial button, the clamped mono
bold and the fallbacks above were found; the stylesheets show none of them.

`npm run fonts:check` (in `verify`, and through `tests/check-fonts.test.js` in
pre-commit, which triggers on `vendor/fonts`) reads the woff2 binaries with
`scripts/woff2.js` and holds `fonts.css` to them: every file exists and is
used, no two files are identical, each face's family and weight are ones its
file can draw, every subset of a family offers the same weights, every `--fw-*`
weight has an upright face up to the family's ceiling and no face reaches past
it, and a fixed set of required letters (ASCII, õ ä ö ü š ž, € – — … the
quotes, and the × ° Ø ± ¼ ² ³ the documents print) is drawn by each family
itself.

**To add a weight or a family:** copy the subset files from the `@fontsource` /
`@fontsource-variable` package of the **same font version** (check the md5 of
the latin file you already have against the package's), declare them in
`fonts.css` with the package's `unicode-range`, and run `npm run fonts:check`.
A new token weight also needs every family to draw it, or a `CEILING` entry
saying why not.

## Browser autofill

Browser history remains available for fields, but Chromium paints an autofilled
entry with its own light surface and text. The global `:-webkit-autofill` rule
in `30-data.css` delays that UA surface and sets the themed text and caret.
Do not replace it with a fixed inset fill: some fields, including the Timesheet
grid, choose their own background and must keep it when a history value is
selected.

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

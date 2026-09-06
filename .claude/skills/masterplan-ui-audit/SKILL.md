---
name: masterplan-ui-audit
description: Check MASTERPLAN UI code against its own systems — theme tokens, the control tiers and size scale, dead and undefined CSS classes, and the contrast a browser sees rather than the one a token pair claims. Use this whenever you touch anything under src/styles/, whenever you add or restyle a button, a label, a modal or a printed sheet, and before telling the user a UI change is done. Also use it when asked to review, audit, clean up, or "check" CSS/UI/layout/styling, even if the design system is not mentioned by name.
---

# MASTERPLAN UI audit

MASTERPLAN's UI is a set of token systems, not free-form CSS. Almost every UI
bug in this repo has been the same shape: somebody wrote a value the system was
supposed to derive. Run the checks rather than eyeballing it.

```bash
npm run audit:ui                 # actionable findings; exit 1 on any ERROR
npm run audit:ui -- --unused     # plus the full dead-CSS list
npm run audit:ui -- --undefined  # plus the reviewed styleless names, with reasons
npm run theme:check              # the palette itself, per theme
npm run layout                   # a real browser — see "the blind spots" below
```

## The blind spots, and why there are four checks

This is the thing to understand before trusting a green run. Each gate can see
something the others cannot, and every one of them has shipped a bug the others
called clean.

| Gate | Reads | Cannot see |
|---|---|---|
| `audit:ui` | stylesheets, and markup against them | what a value resolves to, or where a box lands |
| `theme:check` | token pairs in `themes.js` | a colour over a ground that is not a token; what `opacity` did |
| `npm test` | behaviour, in jsdom | any geometry at all — `getBoundingClientRect` returns zeroes and `@media print` never applies |
| `npm run layout` | a real browser | anything not on a page it visits |

Worked example, all three of them real:

- `--text-subtle` passed `audit:ui` (it is a token) and passed `theme:check` (it
  was not in the pair list) and painted the navigation's inactive labels at
  **4.43:1**. `npm run layout` found it by reading the screen.
- `.header-actions` passed every text-based check and rendered **halfway down
  the page**, because `.app-head` had no `position` for it to pin to.
- `.strip-seg-lbl` was `--text` on an `--accent` fill: both are tokens, the pair
  was never listed because nobody would think to list it, and it measured
  **2.20:1**.

**So: after a colour or layout change, `audit:ui` passing is not the answer.**
Run `npm run layout`.

## Reading the output

**ERROR** is deterministic — the system says don't, and this is a case of it.
Fix these.

**WARN** is heuristic and usually real, but read before acting. The one failure
mode here that removes working styling: **a dead class is not the same as a dead
rule.** Before deleting anything on `unused-css` or `stale-guard`, read the whole
selector — the reported class may only be *excluding* something, in which case
the rule is doing real work for everything else. Drop the `:not()`, keep the
rule.

A class assembled at runtime (`gr-control-card-${tone}`) can read as unused. The
script resolves the common `base--modifier` case and scans `src/utils/*.js`, but
a genuinely dynamic name will still surface.

## The exemptions, and their reasons

Read the reason before adding another. An exemption that is wrong just hides the
check.

- **`src/styles/99-print.css` is exempt from `hardcoded-colour`.** There is no
  theme on paper: `--bg` printed is a black rectangle the size of the page, and
  a token would make a document depend on which theme was on when somebody
  pressed print. It is the only file with this exemption.
- **`<meta name="theme-color">` is exempt** in the markup pass. The browser reads
  it before any stylesheet exists, so there is nothing to resolve a token
  against. `tests/manifest.test.js` keeps it in step with `themes.js` instead.
- **`scripts/undefined-class-baseline.json`** is an object of *name → reason*,
  not a bare list — MONEYFLOW keeps a flat array with the reasoning in prose,
  which works while the list is empty and theirs is. Four names are in it today:
  one grid child placed by its parent's tracks, and three `result-card` spans
  styled positionally through a `:not()` chain their names keep them out of. A
  test asserts every entry carries a reason, and `stale-baseline` fires when a
  name in it stops being undefined, so the list cannot outlive what it excused.
- **`audit-ui: decorative` / `audit-ui: contrast-ok`** are written at the site,
  in a comment that has to give a reason — `decorative` means it paints no
  words, `contrast-ok` has to carry the **measured ratio**. The marker must sit
  on the declaration or the two lines above it; the window is deliberately tight
  so a marker cannot reach past its own rule.
- **The nav rail and `.seg-group` are not controls** for the tier checks. The
  rail is deliberately its own system off the data-view scale; a `seg-group` is a
  recessed track whose segments carry no ring because the track supplies the edge.

Controls are found two ways: by name (`btn|button|toggle|chip|pill|tab|ctrl|ctl`)
**and** by collecting every class the JSX puts on a `<button>`. The second exists
because the first misses `.ts-copy` and `.mp-modal-close` entirely — both real
controls whose names match none of those words. If something is neither named
like a control nor rendered as a `<button>`, no check will see it.

## What it checks, and why each exists

Every check corresponds to a class of bug that has actually shipped here.

| Check | The failure it catches |
|---|---|
| `hardcoded-colour` | A hex or tinted `rgba()` in the stylesheets **or** in `.jsx`/`.js`/`.html`. It will look wrong on at least one theme, and Verdant — the light one — is where these break. Neutral values (equal channels) are fine: shadows and edge lights. |
| `text-in-edge-token` | A word painted in `--border`, `--edge`, `--divider` or an **alias** onto one. An edge token is tuned to be *just* visible as a line, so it is correct as a border and far under 4.5:1 as text — a pair test cannot tell the two apart, because what is wrong is which property the token is in. It resolves one level of aliasing, which is what caught `--color-gray-light` (a name that says "grey" and *is* `--border`) drawing the timesheet's placeholder hints at 1.66:1. A token mixed toward `transparent` is reported for the same reason: the thinned value is one the palette never cleared. |
| `text-dimmed-with-opacity` | `opacity` thins text as well as its ground, and the result is a colour no gate measured. No threshold, because there is no useful alpha between "no dim" and "unreadable". Exempt automatically: `:disabled`, `opacity: 0`, and `@keyframes`. Inline `style={{ opacity }}` in JSX is checked too, since nothing else can see it. `.home-brand` shipped at 0.75 carrying a comment saying 0.6 was too dim — still 3.10:1 on Verdant, because the figure was picked against one theme. |
| `control-border` | A control drawing its edge with `border:` instead of an inset ring. A control has to swap its ring for an elevation shadow without shifting layout. |
| `control-size` | A control hand-writing a `height`/`min-height` instead of taking a step off the scale. `44px` appeared bare in five places before it was named `--ctl-h-touch` — a floor written five times without a name is how one of them quietly becomes 40. Height only; width is not on the scale. |
| `control-icon-height` | `.ctl-icon` composed with no height source. It sets width and min-width only, deriving the square from a height the control already has — with neither, you get a 32px-wide box as tall as its glyph. |
| `control-no-height` | The opposite shape, and invisible to every other check: a raised- or solid-tier control that states **no** height at all, so its box is padding plus line-height — near a step without being on one. Judged per `<button>`, not per class, because a class can be sized at one call site and bare at another. |
| `hover-recipe` | WARN. A control's `:hover` building its wash or ring from a `color-mix` of a semantic colour while naming no `--ctl-hover*` token — the shape of a recipe rebuilt rather than referenced. Copies drift silently. A flat surface token is a simpler treatment, not a copy, and is not a finding. |
| `undefined-class` | WARN. Markup naming a class no stylesheet defines, so the element gets none of the styling its name implies. The mirror of `unused-css`, and the half that finds bugs rather than untidiness — nothing else in `verify` reads markup against CSS. A name the **suite** selects on is exempt automatically, and so is a BEM anchor. |
| `unused-css` | WARN. Dead rules, collapsed to a count unless you pass `--unused`. |
| `stale-guard` | WARN. A dead class used only to **exclude**. See the warning above: drop the `:not()`, keep the rule. |
| `stale-baseline` | WARN. A name in the undefined-class baseline that is no longer undefined — it has been styled or deleted. Drop it, so the list cannot hide a real finding behind a stale excuse. |
| `breakpoint-drift` | JS and the stylesheets disagreeing about the mobile breakpoint. It said 1024px while the CSS said 768px, which left every tablet between the two in a state neither side had styling for. |

## After fixing

```bash
npm run build        # nothing takes effect in the browser until src/ is compiled
npm run theme:check  # if you touched a colour
npm run layout       # if you touched a colour, a size, or where anything sits
```

## Where the rules come from

The audit enforces; it does not explain. For the reasoning, read the topic file
under `docs/` (indexed from `MASTERPLAN_DEVELOPER_GUIDE.md`):

- [Controls and buttons](../../../docs/controls.md) — the tiers and the size scale
- [Stylesheets and the theme](../../../docs/theme.md) — tokens, and what each is for
- [Checks](../../../docs/testing.md) — every gate, and what it has caught

If a check fires on something genuinely correct, the fix is to teach
`scripts/audit-ui.js` the exemption — with a comment saying why — rather than
leave a known false positive for the next person to re-investigate.

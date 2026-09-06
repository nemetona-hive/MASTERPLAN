# Checks, and what each one can see

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

# Checks

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
| `npm run layout` | where a box actually landed, what a word was actually painted in, whether a dialog keeps the keyboard — in a real browser |
| `npm run theme:check` | contrast ratios across all three themes |
| `npm run perf:check` | download budgets for the two committed bundles |
| `npm run build` | rebuilds `components.js`, `app.css` and the icon subset |
| `npm run icon` | regenerates `masterplan.ico` and the installable app's PNGs — by hand, not part of the build |
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

Every calculator page now has one. `tests/concrete.test.jsx` drives the two
area modes, the four-corner average, the armed reset and the take-off button;
`tests/golden-ratio.test.jsx` drives the phi series and the per-card save and
reset; `tests/pipe-wrap.test.jsx` drives the wrap length, the adjustments and
the slider lock; `tests/surface-layout.test.jsx` covers the three behaviours
that were named as uncovered — direction switching with its per-direction state
save, panel collapse, and `LayoutPanel`'s controlled / uncontrolled toggle.

They assert what somebody using the page would notice, not how it is built. The
arithmetic each page depends on is tested separately and pure; these check that
the page asks the right question and shows what comes back. Where a figure is
worked by hand in the test — the pipe wrap's circumference, the concrete bag
count — that is deliberate: a change to the formula fails here rather than
shipping a wrong cut.

`verify` going green still does not mean every page looks right. jsdom has no
layout engine, so anything that depends on a real box is asserted structurally
here and checked for real by `npm run layout`.

There is a skill for the UI half of this —
`.claude/skills/masterplan-ui-audit/` — which is the one to read when a check
fires and you are deciding whether it is right. It carries the exemptions and
their reasons, and the one failure mode that removes working styling: a dead
class is not the same as a dead rule.

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

`npm run layout` (`scripts/layout.mjs`) is the browser gate, and it exists
because **jsdom has no layout engine**: `getBoundingClientRect` returns zeroes,
a cascade conflict is invisible because nothing is painted, and `@media print`
never applies. It asserts what only a browser knows — where a box landed, what
colour a word was actually painted, whether a Tab press stayed inside a dialog —
across every page and both themes.

It is in `verify` and deliberately **not** in `pre-commit`: that hook is about a
second, and a browser launch does not belong between finishing a thought and
saving it. Run it directly after any change to layout, positioning, the control
scale, a theme, or the print sheet.

**Playwright is pinned to an exact version** (`1.62.1`), not a range, and that
is load-bearing: it is the version whose browser build is already in
`~/.cache/ms-playwright`, shared with MONEYFLOW. Bump it and the next run fails
with *"Executable doesn't exist at chromium_headless_shell-…"* until
`npx playwright install` downloads a second engine. Keep the two repos on one
build unless there is a reason not to.

**It serves the app itself, statically, on an OS-assigned port** — it does *not*
use `scripts/local-dev-server.js`. That server exposes `/api/save-defaults`,
which writes `DEFAULT_SH` straight into `config.js`; a gate that drove the app
through it would rewrite tracked source on every run. The static server answers
that endpoint with a no-op so the app logs no error, and writes nothing. It also
matches production, since Pages has no API either.

The contrast half is the part `theme:check` structurally cannot do. That one
compares token pairs out of `themes.js` — fast, portable, and blind to a colour
painted over a ground that is not a token, or to what `opacity` did on the way
to the screen. This walks real text nodes, composites the authored colour and
every inherited opacity over the nearest opaque ancestor background, and
measures *that*. On its first run it found `--text-subtle` painting the
navigation's inactive labels at 4.43:1 on graphite and 4.05:1 on verdant, and
`--accent` — gated as a 3:1 mark — drawing unit labels as words.

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

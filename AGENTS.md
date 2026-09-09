# MASTERPLAN

Read [MASTERPLAN_DEVELOPER_GUIDE.md](MASTERPLAN_DEVELOPER_GUIDE.md) before
changing layout, controls, colour, a printed document, or anything about how the
app is deployed. It is the hub: how the app is assembled, how to run it, and the
conventions that apply everywhere, plus a table pointing at one topic file per
system under `docs/`. Read the hub plus the topic file your change touches.

## Build step (easy to forget)

Source lives in `src/**` but the app loads compiled `components.js` and
`app.css` from the repo root. Editing files under `src/` has NO effect until
rebuilt:

```bash
npm run build
```

Run this after any `src/` edit, before considering a change done or looking at
it in a browser. `npm run watch` rebuilds on save during active development.

Unlike MONEYFLOW, **the build output is committed**. GitHub Pages serves this
tree exactly as it is, with no build on the far side, so a push *is* the deploy
and a stale bundle is a thing only visitors would see. `githooks/pre-push`
refuses a push where `components.js`, `app.css`, `version.js` or the font
subsets no longer match `src/`. The one exception is `components.js.map`, which
is gitignored.

## Never let a browser session write to config.js

The dev server's `/api/save-defaults` writes `DEFAULT_SH` **straight into
`config.js`**, which is tracked source, and `canSaveStaticDefaults()` is a
hostname check that any localhost passes. Type a dimension into the app with
`npm run dev` running and the repo's default material size changes.

That is the feature working as intended — it is how the defaults are edited —
but it means:

- **Run `git status` after any browser session.** A test value left in
  `DEFAULT_SH` is a real change to what every visitor sees first.
- `npm run layout` serves the tree with a **static** server for exactly this
  reason, and answers that endpoint with a no-op. Never point a check at
  `npm run dev`.

## These are token systems — don't hand-write what they generate

Three areas where writing a value directly is the mistake, because the system
derives it:

- **Colour** comes from a theme token, never a literal — `--text`,
  `--text-muted`, `--text-subtle`, `--brand`, `--accent`, `--danger`,
  `--success`, `--warning`. A hex or a tinted `rgba()` in `src/` blocks the
  audit. Two subtler rules go with it: an edge token (`--border`, `--edge`, and
  aliases like `--color-gray-light`) is tuned to be *just* visible as a line and
  must not draw a word, and `opacity` is not a dimming budget for text — dim by
  choosing a lighter token. See [the theme](docs/theme.md).
- **Controls** pick a **tier** by what the control does and a **step** off the
  size scale. Never invent a hover or active recipe, and never hand-write a
  height — not stating one is the same mistake, because the box then comes out
  as padding plus line-height. Compose `ctl-ghost` / `ctl-sm` / `ctl-icon` in
  the markup. See [controls](docs/controls.md).
- **Printed documents** are built from a **report model** (`utils/cut-list.js`,
  `utils/take-off.js`), and a renderer derives nothing of its own. A figure
  computed twice is a screen and a printout that disagree — over how many bags
  of concrete somebody buys. See [exports](docs/exports.md).

## The gates, and what each one can see

```bash
npm run verify      # everything below, in order
```

`npm test` is pure and jsdom, so it can check behaviour and **not** where a box
landed: jsdom has no layout engine and `@media print` never applies there.
`npm run audit:ui` reads the stylesheets against the markup. `npm run
theme:check` compares the token pairs somebody thought to list.

`npm run layout` is the one that runs a real browser, and it exists because the
other three each have a blind spot the others cannot cover. It is the slow one —
in `verify`, deliberately not in `pre-commit`. Run it after any change to
layout, positioning, the control scale, a theme, or a printed sheet.

Full detail, including what each check has actually caught:
[Checks](docs/testing.md).

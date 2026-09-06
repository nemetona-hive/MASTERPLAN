# Documents the app produces

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## Export — the printed documents

**There is no PDF library, and there should not be one.** The browser's own
"Save as PDF" *is* the print dialog, so a PDF export is a print stylesheet plus
`window.print()`. A bundled writer would cost more than the whole app — jsPDF
alone is over the 250 KiB budget `components.js` is held to — to reproduce what
every platform already does, with worse font handling. MONEYFLOW ships no PDF
dependency either.

Two documents ship: the **cut list** (`utils/cut-list.js` →
`components/CutListSheet.jsx`, from the pattern-layout page) and the **concrete
take-off** (`utils/take-off.js` → `components/TakeOffSheet.jsx`). A "take-off"
is the trade term — you take quantities off a drawing and turn them into a list
of what to buy.

They share one stylesheet. `.doc-sheet*` is the chrome every document uses; a
prefix of its own (`.cut-*`) is for what only one has, because the cut list's
piece chips mean nothing on a take-off. A second print stylesheet would drift
from the first within a change or two.

**One model, many renderers.** The model builds a neutral description; the sheet
prints it. A second format consumes the same object and adds nothing to the
model. Put a new
derivation **in the model, never in a renderer** — written per format it becomes
two lines that agree today and disagree after the next change, and what you get
is a printout and a spreadsheet of one job with different totals. Everything
numeric in the model is a **number**; the sheet formats on the way to the page.

What the sheet is for is the `panels` table, not the row list. `simulate()` runs
the remainder of a cut panel into the *start of the next row* — the `cut`
segment and the following row's leading `offcut` share a `sourceId` — so one
stock panel yields two placed pieces in two rows. A list that only said "row 3
needs a 340" would have you cut a fresh panel and bin the 910 already in your
hand.

The take-off takes this further than the cut list did, and deliberately: it
takes the **raw fields** and does the arithmetic, and `Concrete.jsx` reads its
own on-screen figures back out of it. The page used to compute for the screen,
which would have left a printed sheet redoing the same maths — two places that
can round, over the one number where that matters most:

> `bagsExact` is 413.33 and `bagsToBuy` is 414.

Both are real answers to different questions, and a screen showing one while a
printout showed the other is how somebody buys the wrong amount of concrete. The
sheet prints both, and prices the one you buy. **A page whose figures a document
also states should read them from the model, not beside it.**

Three things that are easy to get wrong here:

- **`PPi` is the material LENGTH and is what gets cut; `PLa` is the WIDTH and
  sets the row height.** The simulation's own parameter names invite the
  opposite reading — `simulate(W, H, PP, PL, …)` is called as
  `simulate(sW, sH, PLa, PPi, …)`. Swap them and every waste figure is computed
  against the wrong stock, and still looks plausible.
- **Printing happens in an effect, not in the click.** `window.print()` is
  synchronous and blocks on the dialog, so calling it from the handler opens a
  dialog over a sheet React has not committed — a blank page. The effect waits
  a frame after the commit.
- **The sheet portals to `<body>`.** That is what lets print hide the app with
  `body > *:not(.cut-sheet)` — by position rather than by name, so it keeps
  working when the shell gains a wrapper.

`src/styles/99-print.css` is the only stylesheet exempt from the hardcoded-colour
audit, and the reason is that **there is no theme on paper**: `--bg` printed is a
black rectangle the size of the page, and any token would make the document
depend on which theme was active when somebody pressed print. It is registered
last in `build-styles.js` — a new stylesheet must be added to `STYLE_SOURCES` or
it is silently absent, which `npm run analyze:code` reports as an unregistered
style.

## Installable app (the manifest)

`manifest.webmanifest` makes this installable: its own window, its own taskbar
and home-screen icon, its own identity rather than a tab grouped under the
browser. It matters more here than on a desktop-only tool — this is the one that
gets opened on a phone on a job.

**Every path in it is relative, and has to stay that way.** Pages serves this
from `/MASTERPLAN/`, not a domain root, so a leading slash would scope the app
to the whole `github.io` origin — claiming every other project on it — and 404
every icon. The trap is that it reads correctly either way on `npm run dev`,
which serves from the root; `tests/manifest.test.js` is what actually holds the
line.

The icons come from `node scripts/make-icon.js`, alongside the `.ico`, from the
same Font Awesome glyph — so the taskbar icon and the installed app cannot drift
into two different marks. It is **not** part of `npm run build`: icons change
about once a year and are run by hand.

Two purposes, and they want opposite things, which is why there are three files:

| Icon | Purpose | Shape |
|---|---|---|
| `icon-192`, `icon-512` | `any` | drawn unchanged, so it fills its canvas and stays transparent — the platform supplies the ground, light dock or dark |
| `icon-maskable-512` | `maskable` | cropped to whatever shape the platform likes, with only a circle of 80% of the edge guaranteed. The mark sits at 52% of the canvas so its diagonal clears that circle, on an **opaque** ground — a transparent maskable icon crops to a hole |

The manifest and its icons are hashed into the build id like everything else a
visitor loads, so `npm run deploy:check` cannot report a changed manifest as
already live. `background_color`, `theme_color` and the `theme-color` meta tag
are three copies of graphite's `--bg`; a test keeps all three in step with
`themes.js`.

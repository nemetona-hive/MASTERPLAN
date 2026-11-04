# Deploying, and what is kept

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## Build stamp — verifying what is live

A push is the deploy, and nothing on the far side reports back, so the app
carries a build id: `version.js` defines a `BUILD` global, read through
`getBuildId()` in `shared.jsx`.

It is displayed in **two mutually exclusive places, one per breakpoint** —
never both at once:

| | Where | Gated by |
|---|---|---|
| Desktop | bottom of the nav rail | JS — `NavBuildStamp` bails when `mobile`, and when the rail is collapsed (the strip is 60px and this is the one nav item with no icon to shrink to) |
| Mobile | Home page footer, under `NEMETONA HIVE` | CSS — `.home-build` is `display: none` until the mobile media query, so it re-evaluates on resize without the component tracking the viewport |

Mobile does not use the nav for this: the drawer is shut by default, which puts
the stamp two taps behind a hamburger for anyone who does not already know it is
there. A test in `home.test.jsx` reads `70-home.css` to pin the exclusion — if
that default stopped being `none`, desktop would render the stamp twice and
nothing else would catch it.

The rail's copy only reaches the bottom because `.nav` takes `flex: 1`: it is a
column flex item in `.page-side` with no height of its own, so without that it
is content-sized and `.nav-bottom`'s `margin-top: auto` has no free space to
push into. `min-height: 0` alongside it is what lets the nav's `overflow-y`
scroll rather than the item just growing.

```
npm run deploy:check     # fetches <site>/version.js and compares to local
```

`OK live matches local — 788db7e4`, or it names both ids. Override the URL with
`MASTERPLAN_SITE` if the Pages address ever changes.

**The id is a content hash, not a timestamp, and that is load-bearing.**
`scripts/build-version.js` hashes `index.html`, the three classic scripts it
loads by hand — `config.js`, `simulation.js`, `themes.js` — and the generated
`components.js`, `app.css` and two font subsets: everything a visitor loads that
this repo owns, which is wider than what the build generates. The three are the
app as much as the bundle is (defaults and the page registry, the layout maths,
the theme tokens), so hashing only generated files would let a deploy that
changed any of them pass `deploy:check` as already live. `githooks/pre-commit`
therefore triggers on all four as well as `src/` and the tooling, so a commit touching only one
still rebuilds the stamp rather than leaving it for `pre-push` to reject — and
still runs the tests, which read all three as globals. That hook rebuilds and refuses
the push if a generated file moved, so a stamp that read the clock would change
on every build and wedge the gate shut permanently.
`git rev-parse HEAD` fails the same way and is wrong besides: at `pre-commit`
time HEAD is still the *parent* commit, so the stamp would ship one commit
behind. A hash of the output is stable for a given source tree, which is the
property the hooks already assume.

It also answers a better question. A date says when someone ran a build; a
content hash of the served bytes says whether the live site *is* the tree you
have. `tests/version.test.js` pins the determinism and asserts the generator
touches neither `Date` nor git — the failure mode is a push blocked days later,
long after the cause is obvious.

### The two clocks

A push does not become visible all at once, and the stamp reads differently
depending on where you look at it. Measured across three deploys:

| | Delay | What it reflects |
|---|---|---|
| `npm run deploy:check` | **40–50 s** | the Pages *origin* — it fetches with `cache: "no-store"` |
| The nav footer in your browser | **up to 10 min** | whatever your browser has cached |

The gap is `cache-control: max-age=600`, which Pages sets on HTML and gives no
way to override — there is no header configuration on Pages. Within that window
a browser that visited before the push keeps its old `index.html`, which has no
`version.js` tag, so no stamp renders at all. That is the case `NavBuildStamp`'s
`typeof BUILD` guard exists for: the nav renders intact and the stamp is simply
absent, rather than a `ReferenceError` taking the sidebar down.

**So when the two disagree, neither is broken — the gap *is* the propagation
delay.** `deploy:check` is authoritative for what is deployed; a missing or
stale footer on a site it has called current means your own cache. Skip the wait
with a hard reload, or with a query string, which changes the cache key:

```
https://nemetona-hive.github.io/MASTERPLAN/?v=<build id>
```

Diagnosing a deploy that really has not landed: `curl -s <site>/version.js`
shows the id at the origin, and `curl -sI <site>/index.html` reports `age`, how
many seconds the edge has been holding its copy.

Two consequences worth knowing:

- `version.js` must be committed with the rebuild, like `components.js`. A test
  fails at commit time if it is stale, rather than leaving it for `pre-push`.
- Editing `index.html` changes the id even when nothing else moved, because the
  page itself is part of what gets served.

## Local Static Defaults (Dev environment only)

When running the application locally, a specialized persistence mechanism
allows explicitly saving shared preset libraries directly back into the source
code (`config.js`). Job dimensions are not accepted by this endpoint.

- `canSaveStaticDefaults()`: Returns `true` if the app is running on `localhost`
  or `127.0.0.1`. This decides whether the Save Defaults **button renders** —
  it runs in the browser and is not a security control. Do not add a second
  caller that treats it as one.
- `saveStaticDefaults(key, value)`: Asynchronous function that sends a POST request to `/api/save-defaults`. This endpoint is provided by the development server to update the project's static configuration files.
- The endpoint writes to a tracked source file and has no credentials, so the
  server is what keeps it private, in two layers:
  - It binds `127.0.0.1` explicitly. Listening on every interface handed any
    machine on the network an unauthenticated write to `config.js`.
  - `isLocalRequest()` additionally requires a loopback `Host` and, when one is
    sent, an `Origin` whose authority exactly matches `Host` — loopback alone still leaves the endpoint
    reachable from the user's own browser, so any page could post to it, and a
    DNS-rebinding host resolving to `127.0.0.1` would satisfy the bind. A
    *missing* `Origin` is allowed: browsers always send it on a cross-origin
    POST, so its absence means a non-browser client like curl.
- `safeSaveStaticDefaults(key, value)` in `shared.jsx` is what components call: it
  rejects rather than throwing when the hook is absent, which is the case on
  GitHub Pages, where there is no dev server behind the page.
- The server validates a bounded JSON payload and the generated JavaScript, then
  replaces tracked `config.js` with a flushed temporary file through an atomic rename. There is no backup snapshot, unlike MONEYFLOW's
  `_personal/.backups/`. Check `git diff config.js` after a save you did not
  intend.
- Currently utilized by:
  - **Concrete Calculator**: To persist product presets.
  - **Surface Layout**: To persist material presets.
  - **Surface Layout Inputs**: To persist reusable surface-size presets.
  - **Golden Ratio Tool**: To persist saved value series.

## Projects (local mode only)

**MASTERPLAN used to persist nothing but the theme, on purpose.** The argument
was that it is a calculator, not a ledger: its state is a handful of numbers off
a tape measure, and re-entering them costs less than the machinery to keep them.
That held while each job was a few fields. It stopped holding once a page could
carry a whole room — dimensions, a dozen placed openings, a board choice — and
the user asked for projects (2026-11-04). The decision was theirs; this is what
was built.

**What a project is.** One JSON file in `_personal/projects/<id>.json`
holding **one page's** values: `page` (the page id), `drafts` (that page's
`useSessionState` values, by key — the `DraftStore` in
`src/utils/session-state.js`) and `app` (whichever of App's own state the page
owns: `sh` for Pattern Layouts, `sym` for Axial Alignment, `grItems` for Golden
Ratio). `_personal/` is gitignored and is not in the static server's public file
set, so a project is never committed, never pushed, never served.

**Every page has its own projects (2026-11-04).** It began as one control in
the header that saved every page at once, and the user asked for each page to
manage its own: a Gypsum job and a concrete pour are different jobs, with
different names, opened and closed apart. Each page lists only its own
projects, has its own open one (remembered per page in `localStorage`, as
`masterplan.project.<page>`), and opening one replaces only that page's values.
The header no longer has a project control.

**The sidebar is a browser preference, not project data.** It was saved in the
project while a project was the whole app, and per-page projects lost it for a
moment (the user noticed the same day). It belongs to no page, so it now lives
where the theme does: `localStorage` `masterplan.nav`, `open` or `closed`,
kept with or without a project. Only the user's own choice is stored (the
button, or Ctrl+B, on a desktop): a collapse the viewport makes on its own at
≤ 1280px is not a choice, and the phone's drawer is a different control. The
stored choice is applied wherever the screen has room for the full sidebar.
`scripts/journeys.mjs` checks both directions survive a reload.

**Which page owns what** is `src/utils/project-pages.js`. Drafts are told apart
by key prefix, since every key starts with the file that owns it
(`Gypsum.jsx:rooms`, `Guider.ToruPolv70:angle`). `tests/project-pages.test.jsx`
reads every `useSessionState` key in `src/components/` against that table, so a
new page's values cannot go unsaved because nobody added the page there.

**A project from before** has no `page` and holds every page. The first time the
browser lists one, it splits it into one project per page that has something of
its own in it (any draft, or App state that differs from its default), under the
same name, then moves the original to `.trash/`. If the browser had it open,
each part opens on its own page. Splitting is the browser's job, not the
store's: which key belongs to which page is the app's business.

| Piece | File |
|---|---|
| Store: atomic write (temp, fsync, rename, fsync dir), `0600`, symlinks refused, delete → `.trash/`, `page` kept | `scripts/project-store.js` |
| Routes: `GET/POST /api/projects`, `GET/PUT/PATCH/DELETE /api/projects/:id` (PATCH renames), all behind `isLocalRequest()` — reads too, since a project is private | `scripts/local-dev-server.js` |
| Which page owns which draft and App key; splitting an old project | `src/utils/project-pages.js` |
| Client API, `probeProjects()`, the autosaver, last-open per page | `src/utils/projects.js` |
| Per page: open / create / close / delete, one autosaver each, reopen-on-load, the split | `src/useProjects.js` |
| The page's section and its dialog; `ProjectContext` | `src/components/ProjectMenu.jsx` |

**Where the section sits.** App hands the routed page its own controls through
`ProjectContext`, and each page places `<ProjectSection />` where its layout
puts a card: first in the control column on the Pattern Layouts, Axial
Alignment, Gypsum, Golden Ratio and Guider pages, and as the first section
(`variant="section"`) on Concrete, Pipe Wrap and Timesheet. Without a provider,
in the page tests and on GitHub Pages, it renders nothing. Home has none.

**Local mode is asked of the server, not guessed.** The control appears only
when `GET /api/projects` answers. GitHub Pages has no server, and the browser
checks (`npm run layout`, `test:browser`) run on `127.0.0.1` against a static
server with no project routes — a hostname check would have put a dead control
in every screenshot.

**Autosave.** One autosaver per page, and a change saves only the page it
belongs to. 800 ms after the last change, never two writes in flight (a change
during a save is saved after it), and an unchanged body is not resent. It
watches the *state* — a draft written, or `sh`/`sym`/`grItems` changing — not
the actions, so undo, a preset, a reset are all saved without a list of
triggers to keep up to date. Leaving the page sends what the debounce was
holding with `keepalive`. A failed save turns the section's project name to `--danger`
with the reason under it and in the dialog; a successful one shows
nothing (no "Saved" tag, per the quiet-UI preference).

**Opening a project** flushes that page's open one, replaces that page's drafts
(`DraftStore.replaceWhere`, every other page's left alone), applies its share of
`app` (merged over the defaults, so a project from before a field existed opens
with that field at its default), and bumps that page's epoch in the routed
page's key.
The remount is what makes the page read the new drafts, and it also drops undo:
the page's doc history unregisters on unmount and field undo belongs to DOM
nodes that are gone, so Ctrl+Z cannot carry one project's values into another.
With no project open on the page, opening one would replace unsaved work there,
so it asks (two clicks). Each page's last project is reopened on load.

**Renaming** changes the name, never the id: the file keeps the slug it was
created with, so `kitchen.json` can hold "Kitchen floor 2". That keeps an open
project saving to the same file, and it has no rename-on-disk to get wrong. The
open project is renamed *through its own autosave* (the PUT carries the new
name) rather than by PATCH, because a separate request could race a save still
in flight with the old name and lose; any other project is renamed by PATCH,
which rewrites the name and keeps the values. A failed rename of the open
project puts the old name back in the section.

The dialog's two fields sit in `<form>`s so Enter submits them. App's global
"Enter blurs the field" handler skips any input with a `.form`, because its
`preventDefault()` would otherwise cancel the submit.

**Not built:** restore points (MONEYFLOW's `.backups/`), and import /
export. The trash is the only undo for a delete: move a file back out of
`_personal/projects/.trash/` to restore it.

**Still true:** the dev server's `saveStaticDefaults` is the one thing that
writes to a *tracked* file. Projects write only under `_personal/`.


## Draft lifetime and offline behaviour

Calculator drafts stay in App memory during route navigation. Concrete, pipe wrap
and timesheet use `useSessionState`; surface and symmetric dimensions already live
in App. Reloading clears a page's drafts unless that page has a project open
(local mode, above). The home page says so in a note under the page cards: on
GitHub Pages that reloading clears them, in local mode that only a page with a
project open keeps them. The offline banner tells users to keep the
loaded window open: calculations work with loaded assets, but offline reopening
is not supported and no service worker is installed.

Local default saves are queued per resource with a 10-second request timeout.
Errors receive visible feedback on the Save Defaults control. The local server
serves an explicit public file set plus asset and vendor trees, rejects
symlinks, caps JSON at 256 KiB, and validates preset numeric bounds. This does
not change which files GitHub Pages publishes.

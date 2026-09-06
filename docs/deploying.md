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
therefore triggers on all four as well as `src/`, so a commit touching only one
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

When running the application locally, a specialized persistence mechanism allows saving UI state (presets, defaults) directly back into the source code (`config.js`).

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
    sent, a loopback `Origin` — loopback alone still leaves the endpoint
    reachable from the user's own browser, so any page could post to it, and a
    DNS-rebinding host resolving to `127.0.0.1` would satisfy the bind. A
    *missing* `Origin` is allowed: browsers always send it on a cross-origin
    POST, so its absence means a non-browser client like curl.
- `safeSaveStaticDefaults(key, value)` in `shared.jsx` is what components call: it
  rejects rather than throwing when the hook is absent, which is the case on
  GitHub Pages, where there is no dev server behind the page.
- The server **rewrites `config.js` in place** — a tracked source file — after
  validating the payload. There is no backup snapshot, unlike MONEYFLOW's
  `_personal/.backups/`. Check `git diff config.js` after a save you did not
  intend.
- Currently utilized by:
  - **Concrete Calculator**: To persist product presets.
  - **Surface Layout**: To persist material presets.
  - **Golden Ratio Tool**: To persist saved value series.

## What this app deliberately does not keep

**MASTERPLAN persists nothing but the theme, and that is a decision.** It is
worth stating, because MONEYFLOW's whole shape argues the other way and porting
from it makes the absence look like an oversight.

This is a calculator, not a ledger. Its state is a handful of numbers somebody
has in front of them — a tape measure reading, a panel spec off a label — and
re-entering them costs less than the machinery to keep them would: a serialiser
per page, a schema version, a migration path for the day a shape changes, and a
whole class of bug where what is on screen and what was restored disagree. The
two things actually worth keeping already have homes:

| Worth keeping | Where it goes |
|---|---|
| The values you reuse across jobs | `saveStaticDefaults` → `config.js`, dev only |
| The output of a calculation | The printed cut list |

So there is no `useAutoSave`, no `_personal/`, no restore points, and no
`markDirty` in the undo history. MONEYFLOW has all four because it owns files
nobody can re-derive; nothing here is in that category.

**Two consequences worth carrying.** Undo is the only way back from a
destructive action — there is nothing behind it, which is why `doc-undo` covers
every button that can lose work. And the dev server's `saveStaticDefaults` is
the one thing that writes to a tracked file: driving the app in a browser
rewrites `DEFAULT_SH` in `config.js` with whatever you typed. Check
`git status` after any browser session.

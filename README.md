# NEMETONA MASTERPLAN

Layout and estimating calculators for the job site: pattern and symmetric panel
layouts, concrete, pipe wrap, golden ratio, a timesheet, and a wiring guide.
Layouts and the concrete estimate print as a cut list or take-off.

Live site: <https://nemetona-hive.github.io/MASTERPLAN/>

It is a static site. GitHub Pages serves this repository exactly as committed,
so the built `components.js`, `app.css` and `version.js` are checked in. Nothing
is stored on a server; entries live in memory until the window is reloaded.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3005  (or ./run.sh, which also opens a browser)
```

## Build and test

```bash
npm run build      # required after any edit under src/
npm test           # unit tests
npm run verify     # every gate, including the real-browser checks
```

## Working on it

Start with [MASTERPLAN_DEVELOPER_GUIDE.md](MASTERPLAN_DEVELOPER_GUIDE.md). It
explains how the app is assembled, the conventions that apply everywhere, and
links one topic file per system under [docs/](docs/).

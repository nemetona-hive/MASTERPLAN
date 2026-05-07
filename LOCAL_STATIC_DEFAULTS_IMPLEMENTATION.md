# Local Editing With Static GitHub Defaults

## Goal

Allow selected app data to be edited through the app while running locally, then save those edits into repo source files so they become the static defaults after commit/push to GitHub Pages.

This is intended for data such as:

- Concrete product presets
- Golden Ratio default/saved rows
- Future calculator presets that should be editable locally but static on GitHub Pages

## Required Behavior

Local app on `localhost`:

- User can add/edit preset/default data in the UI.
- User can click a local-only `Save Defaults` button.
- The app sends the current data to a local Node server.
- The server rewrites a committed source file.
- After `npm run build`, commit, and push, GitHub Pages shows the saved values as the new defaults.

GitHub Pages/static app:

- Loads the committed defaults.
- Does not attempt to write files.
- Hides or disables `Save Defaults`.
- May still allow temporary in-session editing if useful, but those changes are not saved as repo defaults.

## Architecture

Use a shared defaults file and a local save endpoint.

Recommended files:

```txt
config.js
src/components/Concrete.jsx
src/components/GoldenRatio.jsx
src/App.jsx
scripts/local-dev-server.js
package.json
```

The current project uses globals, not module imports. Keep defaults as globals in `config.js` unless there is a strong reason to split them into a separate loaded script.

## Default Data Shape

Add concrete presets to `config.js`:

```js
const DEFAULT_CONCRETE_PRESETS = [
  { name: "weber S-100", rate: 2, bagKg: 25, bagPrice: 4 },
  { name: "weberfloor 200 RAPID", rate: 1.7, bagKg: 20, bagPrice: 15 },
  { name: "", rate: "", bagKg: "", bagPrice: "" }
];
```

`DEFAULT_GR` already exists in `config.js`. Continue using this shape:

```js
const DEFAULT_GR = [
  { id: "a", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false },
  { id: "b", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false },
  { id: "c", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false }
];
```

## Local Capability Detection

Add a helper in the client code:

```js
const canSaveStaticDefaults = () =>
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";
```

Use this helper to hide or disable save buttons on GitHub Pages.

Do not use this feature for `file://` unless a separate local server is running. A browser opened directly from disk cannot write repo files.

## Client Save API

Use one shared endpoint:

```txt
POST /api/save-defaults
```

Payload:

```js
{
  key: "concretePresets",
  value: [
    { name: "weber S-100", rate: 2, bagKg: 25, bagPrice: 4 }
  ]
}
```

or:

```js
{
  key: "goldenRatioDefaults",
  value: [
    { id: "a", value: "1000", suffix: "mm", saved: { value: "1000", suffix: "mm" }, savedCommitted: true }
  ]
}
```

Client helper:

```js
async function saveStaticDefaults(key, value) {
  const res = await fetch("/api/save-defaults", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value })
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
```

## Concrete Implementation

In `src/components/Concrete.jsx`:

1. Replace hardcoded preset state with the global default.

```js
const [presets, setPresets] = React.useState(() =>
  (typeof DEFAULT_CONCRETE_PRESETS !== "undefined"
    ? DEFAULT_CONCRETE_PRESETS
    : []
  ).map(p => ({ ...p }))
);
```

2. Add a local-only save handler.

```js
const [presetSaveStatus, setPresetSaveStatus] = React.useState("");

const saveConcreteDefaults = async () => {
  setPresetSaveStatus("saving");
  try {
    await saveStaticDefaults("concretePresets", presets);
    setPresetSaveStatus("saved");
  } catch (err) {
    console.error(err);
    setPresetSaveStatus("error");
  }
};
```

3. Render `Save Defaults` only when local saving is available.

```jsx
{canSaveStaticDefaults() && (
  <button className="ctrl-dir on" onClick={saveConcreteDefaults}>
    <Icon name="check" /> Save Defaults
  </button>
)}
```

## Golden Ratio Implementation

`DEFAULT_GR` is already the static source of truth in `config.js`.

In `src/components/GoldenRatio.jsx`, add a local-only button that saves the current `baseItems`.

Before saving, normalize each row so the current value is committed as the default saved value:

```js
const normalizeGoldenRatioDefaults = items => items.map(item => ({
  id: item.id,
  value: item.value,
  suffix: item.suffix,
  saved: {
    value: item.value,
    suffix: item.suffix
  },
  savedCommitted: String(item.value).trim() !== ""
}));
```

Save handler:

```js
const saveGoldenRatioDefaults = async () => {
  const nextDefaults = normalizeGoldenRatioDefaults(baseItems);
  await saveStaticDefaults("goldenRatioDefaults", nextDefaults);
};
```

Render the button only on localhost:

```jsx
{canSaveStaticDefaults() && (
  <button className="ctrl-dir on" onClick={saveGoldenRatioDefaults}>
    <Icon name="check" /> Save Defaults
  </button>
)}
```

## Server Implementation

Create `scripts/local-dev-server.js`.

Responsibilities:

- Serve static files from the repo root.
- Accept `POST /api/save-defaults`.
- Validate `key`.
- Validate payload shape.
- Rewrite only the allowed default constants in `config.js`.
- Return JSON success/error.

Use allow-listed keys only:

```js
const DEFAULT_WRITES = {
  concretePresets: "DEFAULT_CONCRETE_PRESETS",
  goldenRatioDefaults: "DEFAULT_GR"
};
```

Do not accept arbitrary file paths from the client.

Constant replacement strategy:

1. Read `config.js`.
2. Find the exact constant declaration:

```js
const DEFAULT_GR = [...]
```

or:

```js
const DEFAULT_CONCRETE_PRESETS = [...]
```

3. Replace the full array literal with pretty-printed JSON converted to JS.
4. Write `config.js`.

The server should fail if the constant cannot be found.

## Package Scripts

Add scripts:

```json
{
  "scripts": {
    "build": "node scripts/build-components.js",
    "watch": "node scripts/watch-components.js",
    "dev": "node scripts/local-dev-server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

Usage:

```txt
npm run dev
```

Open:

```txt
http://localhost:3000
```

After saving defaults locally:

```txt
npm run build
git diff
git add config.js components.js package.json scripts/local-dev-server.js
git commit -m "Add local static default saving"
git push
```

## Validation Rules

Concrete presets:

- Must be an array.
- Each item must have `name`, `rate`, `bagKg`, `bagPrice`.
- Convert numeric fields to numbers when possible.
- Allow empty string rows so the UI can keep one blank row.

Golden Ratio defaults:

- Must be an array.
- Each item must have `id`, `value`, `suffix`, `saved`, `savedCommitted`.
- `id` must be a short string such as `a`, `b`, `c`, `d`.
- `saved.value` and `saved.suffix` should match the committed `value` and `suffix` when saving static defaults.

## Static GitHub Pages Behavior

GitHub Pages serves the same files but does not run the Node server.

Expected behavior:

- Defaults load from `config.js`.
- Save buttons are hidden because hostname is not `localhost` or `127.0.0.1`.
- No failed network request is made.

## Notes

- This system saves source defaults, not private browser preferences.
- Use `localStorage` only if private per-browser presets are also desired.
- Keep all write operations in the local server. The browser client should never know or choose filesystem paths.
- After any JSX change, run `npm run build` so `components.js` matches `src/`.

/*
 * Which page owns which saved value. A project belongs to one page, so it
 * keeps that page's drafts and the part of App's own state the page owns,
 * and nothing of any other page's.
 *
 * Drafts are told apart by key prefix: every `useSessionState` key starts with
 * the file that owns it (`Gypsum.jsx:rooms`, `Guider.ToruPolv70:angle`). A
 * test reads every key in src/ against this table, so a new page's drafts
 * cannot go unsaved because nobody added it here.
 *
 * `app` names the App.jsx state a page is handed as props rather than holding
 * itself: Pattern Layouts' `sh`, Axial Alignment's `sym`, Golden Ratio's
 * `grItems`. The sidebar is no page's: App keeps it in localStorage, like the theme.
 *
 * `view` names drafts that are how the page is looked at, not what was
 * entered: which room is on screen, folded cards, 2D or 3D. A project still
 * saves them, but changing one is not work that replacing the page would
 * lose, so it does not make Open or Create ask first (`isViewDraft`).
 */
export const PROJECT_PAGES = {
  "pattern-layout": { drafts: ["SurfaceLayout.jsx:"], app: ["sh"] },
  "symmetric-layout": { drafts: ["SymmetricLayout.jsx:"], app: ["sym"] },
  concrete: { drafts: ["Concrete.jsx:"], app: [] },
  gypsum: { drafts: ["Gypsum.jsx:"], app: [], view: ["Gypsum.jsx:room", "Gypsum.jsx:closed", "Gypsum.jsx:view3d"] },
  "pipe-wrap": { drafts: ["PipeWrapCalculator.jsx:"], app: [] },
  "golden-ratio": { drafts: ["GoldenRatio.jsx:"], app: ["grItems"] },
  guider: { drafts: ["Guider."], app: [] },
  timesheet: { drafts: ["Timesheet.jsx:"], app: [] }
};

/** Whether a draft is only a view setting (see `view` above). */
export function isViewDraft(key) {
  const page = pageOfDraft(key);
  return Boolean(page && PROJECT_PAGES[page].view?.includes(key));
}

/** The page a draft key belongs to, or null. */
export function pageOfDraft(key) {
  if (typeof key !== "string") return null;
  for (const [page, { drafts }] of Object.entries(PROJECT_PAGES)) {
    if (drafts.some(prefix => key.startsWith(prefix))) return page;
  }
  return null;
}

/** The page an App state key belongs to, or null. */
export function pageOfApp(key) {
  for (const [page, { app }] of Object.entries(PROJECT_PAGES)) if (app.includes(key)) return page;
  return null;
}

const owns = (page, key) => pageOfDraft(key) === page;

/** One page's drafts, from a DraftStore or a saved `drafts` object. */
export function pageDrafts(source, page) {
  const entries = source instanceof Map ? [...source.entries()] : Object.entries(source || {});
  return Object.fromEntries(entries.filter(([key]) => owns(page, key)));
}

/** One page's share of App's state, from `appState` or a saved `app`. */
export function pageApp(source, page) {
  const keys = PROJECT_PAGES[page]?.app || [];
  return Object.fromEntries(keys.filter(key => source && Object.hasOwn(source, key)).map(key => [key, source[key]]));
}

/**
 * A project saved before projects were per page held every page at once.
 * Split it into one part per page that has something of its own in it: any
 * draft, or App state that differs from its default (`defaults`, by key).
 * A page with nothing is left out rather than given an empty project.
 */
export function splitLegacyProject(doc, defaults = {}) {
  const drafts = doc && typeof doc.drafts === "object" && doc.drafts ? doc.drafts : {};
  const app = doc && typeof doc.app === "object" && doc.app ? doc.app : {};
  const parts = [];
  for (const page of Object.keys(PROJECT_PAGES)) {
    const own = pageDrafts(drafts, page);
    const ownApp = Object.fromEntries(Object.entries(pageApp(app, page))
      .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key])));
    if (Object.keys(own).length || Object.keys(ownApp).length) parts.push({ page, drafts: own, app: ownApp });
  }
  return parts;
}

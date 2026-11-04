import { React } from "../react-globals.js";

/*
 * App-scoped memory: navigating keeps a draft; reloading creates a new store.
 * Isolated component tests have no provider and behave like ordinary useState.
 *
 * A project (src/utils/projects.js) is this store written to a file: every
 * page's values by key. So the store has to say when it changes — that is the
 * only addition over the plain Map it used to be — and has to be replaceable
 * wholesale when a project is opened.
 */
export class DraftStore extends Map {
  constructor(entries) {
    super(entries);
    this.listeners = new Set();
  }

  set(key, value) {
    const changed = !super.has(key) || super.get(key) !== value;
    super.set(key, value);
    // Map's constructor calls set before `listeners` exists.
    if (changed && this.listeners) for (const listener of this.listeners) listener(key);
    return this;
  }

  /** Swap in a project's values. Pages must remount to read them. */
  replaceAll(values) {
    super.clear();
    for (const [key, value] of Object.entries(values || {})) super.set(key, value);
    if (this.listeners) for (const listener of this.listeners) listener(null);
  }

  /** Swap one page's values: drop the keys `owns` claims, then set these.
      Every other page's drafts are left as they are. */
  replaceWhere(owns, values) {
    for (const key of [...this.keys()]) if (owns(key)) super.delete(key);
    for (const [key, value] of Object.entries(values || {})) super.set(key, value);
  }

  toJSON() {
    return Object.fromEntries(this);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const SessionDraftContext = React.createContext(null);
/* A null key is plain state: kept by nobody, for a caller that only sometimes
   has something worth keeping (a preset list with no Manage dialog to change
   it), so the hook can still be called the same way every render. */
export function useSessionState(key, initialValue) {
  const drafts = React.useContext(SessionDraftContext);
  const keep = drafts && key !== null && key !== undefined;
  const [value, setValue] = React.useState(() => keep && drafts.has(key) ? drafts.get(key)
    : typeof initialValue === "function" ? initialValue() : initialValue);
  React.useEffect(() => { if (keep) drafts.set(key, value); }, [drafts, key, value, keep]);
  return [value, setValue];
}

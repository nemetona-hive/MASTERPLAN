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

  toJSON() {
    return Object.fromEntries(this);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const SessionDraftContext = React.createContext(null);
export function useSessionState(key, initialValue) {
  const drafts = React.useContext(SessionDraftContext);
  const [value, setValue] = React.useState(() => drafts?.has(key) ? drafts.get(key)
    : typeof initialValue === "function" ? initialValue() : initialValue);
  React.useEffect(() => { if (drafts) drafts.set(key, value); }, [drafts, key, value]);
  return [value, setValue];
}

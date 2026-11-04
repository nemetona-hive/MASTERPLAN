/*
 * Projects, browser side: the dev server's `/api/projects` routes
 * (scripts/project-store.js) and the autosave that writes to them.
 *
 * LOCAL MODE ONLY. GitHub Pages has no server, so there is nothing to save to
 * and the project control does not render. Whether a server is there is asked
 * of the server (`probeProjects`), not guessed from the hostname: the browser
 * checks under `npm run layout` also run on 127.0.0.1, against a static server
 * that has no project routes.
 *
 * A project is { name, drafts, app }: `drafts` is every page's
 * useSessionState values (the DraftStore), `app` the state App.jsx holds
 * itself. See docs/deploying.md.
 */

const TIMEOUT_MS = 10_000;
export const AUTOSAVE_DELAY_MS = 800;

async function call(method, path = "", body) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(`/api/projects${path ? `/${encodeURIComponent(path)}` : ""}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller?.signal
    });
    let payload = null;
    try { payload = await res.json(); } catch { /* not JSON: a static server's 404 page */ }
    if (!res.ok) {
      const err = new Error(payload?.error || `Project request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return payload;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("The local server did not answer in time");
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const listProjects = () => call("GET");
export const readProject = id => call("GET", id);
export const createProject = project => call("POST", "", project);
export const saveProject = (id, project) => call("PUT", id, project);
export const deleteProject = id => call("DELETE", id);

/** Whether this page has a project server behind it. Never throws. */
export async function probeProjects() {
  if (typeof canSaveStaticDefaults !== "undefined" && !canSaveStaticDefaults()) return null;
  try {
    const list = await listProjects();
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
}

/* The last project open in this browser, reopened on load. A convenience, so
   it lives in localStorage and every read and write is allowed to fail. */
const LAST_KEY = "masterplan.project";
export function rememberProject(id) {
  try { if (id) localStorage.setItem(LAST_KEY, id); else localStorage.removeItem(LAST_KEY); } catch { /* private mode */ }
}
export function lastProject() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

/**
 * Debounced, one-at-a-time saving of whatever `read()` returns.
 *
 * - `schedule()` after every change; the save happens `delay` ms after the
 *   last one, so typing a number is one write, not five.
 * - Never two saves in flight: a change made during a save is saved after it.
 *   Two overlapping PUTs could land out of order and leave the older state on
 *   disk.
 * - A body identical to the last one saved is not sent. Opening a project
 *   remounts every page, and each writes back what it just read.
 * - `flush()` saves now and resolves when done: used before opening another
 *   project or closing this one, so nothing typed in the last 800 ms is lost.
 *
 * `onStatus(error | null)` reports the outcome of each save.
 */
export function createAutosaver({ save, read, onStatus = () => {}, delay = AUTOSAVE_DELAY_MS }) {
  let timer = null;
  let inFlight = null;
  let pending = false;
  let lastSent = null;
  let stopped = false;

  const run = async () => {
    timer = null;
    if (stopped) return;
    if (inFlight) { pending = true; return inFlight; }
    const body = read();
    if (!body) return;
    const text = JSON.stringify(body);
    if (text === lastSent) return;
    inFlight = (async () => {
      try {
        await save(body);
        lastSent = text;
        onStatus(null);
      } catch (err) {
        onStatus(err);
      } finally {
        inFlight = null;
      }
    })();
    await inFlight;
    if (pending && !stopped) { pending = false; await run(); }
  };

  return {
    schedule() {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (inFlight) { pending = true; await inFlight; }
      pending = false;
      await run();
    },
    /** What is on disk now, so the next schedule() only saves a real change. */
    markSaved(body) { lastSent = JSON.stringify(body); },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

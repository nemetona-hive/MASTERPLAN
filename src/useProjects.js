import { React } from "./react-globals.js";
import {
  createAutosaver, createProject, deleteProject, lastProject, listProjects,
  probeProjects, readProject, rememberProject, renameProject, saveProject
} from "./utils/projects.js";

/**
 * Projects for App.jsx: which one is open, the list, and the autosave.
 *
 * `drafts` is the DraftStore every page writes to; `appState` is what App
 * holds itself ({ sh, sym, grItems }) and `applyAppState` puts a project's back.
 * Opening a project bumps `epoch`, which App adds to the routed page's key so
 * the page remounts and reads the new drafts. A remount also clears undo: the
 * page's history unregisters on unmount, and field undo belongs to DOM nodes
 * that are gone — so Ctrl+Z can never put one project's values into another.
 *
 * `available` stays false until the server answers; on GitHub Pages, and
 * under the static server the browser checks use, it never does.
 */
export function useProjects({ drafts, appState, applyAppState }) {
  const [available, setAvailable] = React.useState(false);
  const [projects, setProjects] = React.useState([]);
  const [project, setProject] = React.useState(null);   // { id, name }
  const [saveError, setSaveError] = React.useState("");
  const [epoch, setEpoch] = React.useState(0);

  // Always the current values, for the autosaver to read when it fires.
  const current = React.useRef({});
  current.current = { project, appState };

  const snapshot = () => ({ drafts: drafts.toJSON(), app: current.current.appState });

  const saver = React.useMemo(() => createAutosaver({
    read: () => current.current.project ? { name: current.current.project.name, ...snapshot() } : null,
    save: body => saveProject(current.current.project.id, body),
    onStatus: err => setSaveError(err ? err.message || String(err) : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  React.useEffect(() => () => saver.stop(), [saver]);

  const refresh = React.useCallback(async () => {
    try { setProjects(await listProjects()); } catch { /* the dialog says so on its next action */ }
  }, []);

  const load = async id => {
    const doc = await readProject(id);
    drafts.replaceAll(doc.drafts);
    applyAppState(doc.app || {});
    setProject({ id: doc.id || id, name: doc.name || id });
    saver.markSaved({ name: doc.name, drafts: doc.drafts || {}, app: doc.app || {} });
    setSaveError("");
    setEpoch(e => e + 1);
    rememberProject(doc.id || id);
  };

  // Is there a server? And reopen the project this browser had open.
  React.useEffect(() => {
    let live = true;
    probeProjects().then(async list => {
      if (!live || !list) return;
      setAvailable(true);
      setProjects(list);
      const last = lastProject();
      if (last && list.some(p => p.id === last && !p.unreadable)) {
        try { await load(last); } catch { rememberProject(null); }
      }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave on any change: a page writing a draft, or App's own state.
  React.useEffect(() => drafts.subscribe(() => saver.schedule()), [drafts, saver]);
  React.useEffect(() => { if (project) saver.schedule(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appState.sh, appState.sym, appState.grItems, project]);

  /* Leaving the page: save what the debounce was still holding. `keepalive`
     lets the request outlive the page; it is capped at 64 KiB, which a
     project of typed numbers is far under. */
  React.useEffect(() => {
    const onHide = () => {
      const { project: open } = current.current;
      if (!open) return;
      try {
        fetch(`/api/projects/${encodeURIComponent(open.id)}`, {
          method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: open.name, ...snapshot() })
        }).catch(() => {});
      } catch { /* nothing more can be done on the way out */ }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    available, projects, project, saveError, epoch,
    scratchHasValues: drafts.size > 0,
    refresh,
    async create(name) {
      await saver.flush();
      const doc = await createProject({ name, ...snapshot() });
      setProject({ id: doc.id, name: doc.name });
      saver.markSaved({ name: doc.name, drafts: doc.drafts, app: doc.app });
      setSaveError("");
      rememberProject(doc.id);
      await refresh();
    },
    async open(id) {
      await saver.flush();
      await load(id);
      await refresh();
    },
    async close() {
      await saver.flush();
      setProject(null);
      setSaveError("");
      rememberProject(null);
    },
    /* The open project is renamed through its own autosave: a separate
       request could race a save still carrying the old name and lose. Any
       other project is renamed on the server, which keeps its values. */
    async rename(id, name) {
      const clean = String(name || "").trim().replace(/\s+/g, " ");
      if (!clean) throw new Error("Give the project a name");
      if (current.current.project?.id === id) {
        await saver.flush();
        const before = current.current.project;
        const renamed = { id, name: clean };
        current.current.project = renamed;
        setProject(renamed);
        let failed = null;
        await saver.flush({ onError: err => { failed = err; } });
        if (failed) {
          // Back to the name on disk, so the header does not claim one it lacks.
          current.current.project = before;
          setProject(before);
          throw failed;
        }
      } else {
        await renameProject(id, clean);
      }
      await refresh();
    },
    async remove(id) {
      if (project?.id === id) {
        // Now, not on the next render: a save due in the next 800 ms must not
        // PUT to a file that is about to move to the trash.
        current.current.project = null;
        setProject(null); rememberProject(null); setSaveError("");
      }
      await deleteProject(id);
      await refresh();
    }
  };
}

import { React } from "./react-globals.js";
import {
  createAutosaver, createProject, deleteProject, lastProject, listProjects,
  probeProjects, readProject, rememberProject, renameProject, saveProject, takeLegacyLastProject
} from "./utils/projects.js";
import { PROJECT_PAGES, pageApp, pageDrafts, pageOfApp, pageOfDraft, splitLegacyProject } from "./utils/project-pages.js";

/**
 * Projects for App.jsx, one set per page.
 *
 * Every page has its own projects and its own open one: a Gypsum job and a
 * Concrete pour are opened, saved and closed independently, and opening one
 * never touches another page's values. A page's project holds only what
 * `src/utils/project-pages.js` says that page owns.
 *
 * `drafts` is the DraftStore every page writes to; `appState` is what App
 * holds itself ({ sh, sym, grItems }), and `applyAppState(page, app)` puts one
 * page's share back. Opening a project bumps that page's epoch, which App adds
 * to the routed page's key, so the page remounts and reads the new drafts. A
 * remount also clears undo: the page's history unregisters on unmount, and
 * field undo belongs to DOM nodes that are gone.
 *
 * `available` stays false until the server answers; on GitHub Pages, and
 * under the static server the browser checks use, it never does.
 */
export function useProjects({ drafts, appState, applyAppState, appDefaults = {} }) {
  const [available, setAvailable] = React.useState(false);
  const [projects, setProjects] = React.useState([]);
  const [open, setOpen] = React.useState({});        // page → { id, name }
  const [errors, setErrors] = React.useState({});    // page → message
  const [epochs, setEpochs] = React.useState({});    // page → number

  // Always the current values, for an autosaver to read when it fires.
  const current = React.useRef({});
  current.current = { open, appState };

  const snapshot = page => ({ page, drafts: pageDrafts(drafts, page), app: pageApp(current.current.appState, page) });
  const body = page => {
    const project = current.current.open[page];
    return project ? { name: project.name, ...snapshot(page) } : null;
  };
  const setError = (page, err) => setErrors(all => {
    const message = err ? err.message || String(err) : "";
    if ((all[page] || "") === message) return all;
    const next = { ...all };
    if (message) next[page] = message; else delete next[page];
    return next;
  });
  /* `open` is read by savers between renders, so it is written to the ref
     at once as well as to state. */
  const setOpenProject = (page, project) => {
    const next = { ...current.current.open };
    if (project) next[page] = project; else delete next[page];
    current.current.open = next;
    setOpen(next);
  };

  /* One autosaver per page, made on first use. */
  const savers = React.useRef({});
  const saverFor = page => {
    if (!savers.current[page]) {
      savers.current[page] = createAutosaver({
        read: () => body(page),
        save: next => saveProject(current.current.open[page].id, next),
        onStatus: err => setError(page, err)
      });
    }
    return savers.current[page];
  };
  React.useEffect(() => () => { for (const saver of Object.values(savers.current)) saver.stop(); }, []);

  const refresh = React.useCallback(async () => {
    try { setProjects(await listProjects()); } catch { /* the dialog says so on its next action */ }
  }, []);

  const load = async (page, id) => {
    const doc = await readProject(id);
    const own = pageDrafts(doc.drafts, page);
    const app = pageApp(doc.app, page);
    drafts.replaceWhere(key => pageOfDraft(key) === page, own);
    applyAppState(page, app);
    const project = { id: doc.id || id, name: doc.name || id };
    setOpenProject(page, project);
    saverFor(page).markSaved({ name: project.name, page, drafts: own, app });
    setError(page, null);
    setEpochs(all => ({ ...all, [page]: (all[page] || 0) + 1 }));
    rememberProject(page, project.id);
  };

  /* A project from before projects were per page held every page. Split it
     into one per page with something in it, under the same name, then move
     the original to the trash, where it can still be recovered. If the
     browser had it open, each part opens on its own page. */
  const migrate = async list => {
    const legacy = list.filter(p => !p.page && !p.unreadable);
    if (!legacy.length) return list;
    const wasOpen = takeLegacyLastProject();
    for (const old of legacy) {
      try {
        const doc = await readProject(old.id);
        for (const part of splitLegacyProject(doc, appDefaults)) {
          const made = await createProject({ name: doc.name || old.name, ...part });
          /* A dev server started before projects were per page drops `page`,
             and every part would come back as another old project. Stop,
             and keep the original, until the server is restarted. */
          if (made.page !== part.page) {
            await deleteProject(made.id);
            throw new Error("The local server needs a restart to keep projects per page");
          }
          if (wasOpen === old.id) rememberProject(part.page, made.id);
        }
        await deleteProject(old.id);
      } catch { /* left as it was; it is tried again on the next load */ }
    }
    return listProjects();
  };

  // Is there a server? Then carry old projects over, and reopen each page's last.
  React.useEffect(() => {
    let live = true;
    probeProjects().then(async found => {
      if (!live || !found) return;
      setAvailable(true);
      let list = found;
      try { list = await migrate(found); } catch { /* keep what was listed */ }
      if (!live) return;
      setProjects(list);
      for (const page of Object.keys(PROJECT_PAGES)) {
        const last = lastProject(page);
        if (last && list.some(p => p.id === last && p.page === page && !p.unreadable)) {
          try { await load(page, last); } catch { rememberProject(page, null); }
        }
      }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave the page whose state changed, and only that page.
  React.useEffect(() => drafts.subscribe(key => {
    const page = pageOfDraft(key);
    if (page && current.current.open[page]) saverFor(page).schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [drafts]);
  const scheduleIfOpen = page => { if (current.current.open[page]) saverFor(page).schedule(); };
  const [shPage, symPage, grPage] = ["sh", "sym", "grItems"].map(pageOfApp);
  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(() => scheduleIfOpen(shPage), [appState.sh, open[shPage]]);
  React.useEffect(() => scheduleIfOpen(symPage), [appState.sym, open[symPage]]);
  React.useEffect(() => scheduleIfOpen(grPage), [appState.grItems, open[grPage]]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* Leaving the page: save what each debounce was still holding. `keepalive`
     lets the requests outlive the page; it is capped at 64 KiB in total,
     which a few pages of typed numbers are far under. */
  React.useEffect(() => {
    const onHide = () => {
      for (const [page, project] of Object.entries(current.current.open)) {
        try {
          fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
            method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body(page))
          }).catch(() => {});
        } catch { /* nothing more can be done on the way out */ }
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The project controls for one page. */
  const forPage = page => ({
    page,
    available: available && Boolean(PROJECT_PAGES[page]),
    // This page's projects, plus any file that cannot be read, so it can be deleted.
    projects: projects.filter(p => p.page === page || p.unreadable),
    project: open[page] || null,
    saveError: errors[page] || "",
    scratchHasValues: Object.keys(pageDrafts(drafts, page)).length > 0
      || Object.entries(pageApp(appState, page)).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(appDefaults[key])),
    refresh,
    async create(name) {
      await saverFor(page).flush();
      const doc = await createProject({ name, ...snapshot(page) });
      setOpenProject(page, { id: doc.id, name: doc.name });
      saverFor(page).markSaved({ name: doc.name, page, drafts: doc.drafts, app: doc.app });
      setError(page, null);
      rememberProject(page, doc.id);
      await refresh();
    },
    async open(id) {
      await saverFor(page).flush();
      await load(page, id);
      await refresh();
    },
    async close() {
      await saverFor(page).flush();
      setOpenProject(page, null);
      setError(page, null);
      rememberProject(page, null);
    },
    /* The open project is renamed through its own autosave: a separate
       request could race a save still carrying the old name and lose. Any
       other project is renamed on the server, which keeps its values. */
    async rename(id, name) {
      const clean = String(name || "").trim().replace(/\s+/g, " ");
      if (!clean) throw new Error("Give the project a name");
      if (current.current.open[page]?.id === id) {
        const saver = saverFor(page);
        await saver.flush();
        const before = current.current.open[page];
        setOpenProject(page, { id, name: clean });
        let failed = null;
        await saver.flush({ onError: err => { failed = err; } });
        if (failed) {
          // Back to the name on disk, so the section does not claim one it lacks.
          setOpenProject(page, before);
          throw failed;
        }
      } else {
        await renameProject(id, clean);
      }
      await refresh();
    },
    async remove(id) {
      if (current.current.open[page]?.id === id) {
        // Now, not on the next render: a save due in the next 800 ms must not
        // PUT to a file that is about to move to the trash.
        setOpenProject(page, null);
        rememberProject(page, null);
        setError(page, null);
      }
      await deleteProject(id);
      await refresh();
    }
  });

  return { available, epochs, open, forPage };
}

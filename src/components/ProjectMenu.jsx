import { React, ReactDOM } from "../react-globals.js";
import { ControlPanel, Icon, Modal, Stack, useTimedState } from "../shared.jsx";

/**
 * A page's own project section, local mode only (see src/utils/projects.js).
 *
 * Every page has its own projects (src/useProjects.js), so the control lives
 * on the page, not in the header: App provides this page's controls through
 * `ProjectContext`, and each page places `<ProjectSection />` where its own
 * layout puts a card — the top of the control column, or the first section of
 * a calculator page (`variant="section"`). Rendered without a provider, as in
 * the page tests and on GitHub Pages, it is nothing.
 *
 * The Projects button sits in the head beside the title, so the open
 * project's name, or "No project", has the full width under it. It shows no
 * "Saved" tag: saving is automatic and a status that says so on every
 * keystroke is noise. A failed save is the one state you need to see, so it
 * turns the name to the danger colour and says why under it.
 *
 * The dialog does five things: start a blank project, open
 * one, close the open one (its values stay on screen and stop saving), rename
 * one (in place: Enter saves, Escape cancels), and delete one (two clicks; the
 * file goes to `_personal/projects/.trash/`).
 */

const when = iso => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const ProjectContext = React.createContext(null);

export function ProjectSection({ variant = "card" }) {
  const api = React.useContext(ProjectContext);
  if (!api || !api.available) return null;
  return <ProjectMenu key={api.page} variant={variant} pageTitle={api.title} projects={api.projects} project={api.project} saveError={api.saveError}
    scratchHasValues={api.scratchHasValues} onRefresh={api.refresh} onCreate={api.create} onOpen={api.open}
    onCloseProject={api.close} onDelete={api.remove} onRename={api.rename} />;
}

function ProjectMenu({ variant, pageTitle, projects, project, saveError, onCreate, onOpen, onCloseProject, onDelete, onRename, onRefresh, scratchHasValues }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [renaming, setRenaming] = React.useState(null);   // { id, name }
  // Two-click confirms, each disarming itself, as Global Reset does.
  const [armedDelete, armDelete, disarmDelete] = useTimedState(null, 4000);
  const [armedOpen, armOpen, disarmOpen] = useTimedState(null, 4000);
  const [armedCreate, armCreate, disarmCreate] = useTimedState(false, 4000);

  const run = async action => {
    setBusy(true);
    setError("");
    try { await action(); return true; }
    catch (err) { setError(err.message || String(err)); return false; }
    finally { setBusy(false); }
  };

  const show = () => { setOpen(true); setError(""); setRenaming(null); onRefresh(); };
  /* A new project starts blank, so it clears the page. With a project open
     that is already saved; with none, typed values would be lost, so that
     case asks first, as opening one does. */
  const create = async e => {
    e.preventDefault();
    if (!project && scratchHasValues && !armedCreate) { armCreate(true); return; }
    disarmCreate();
    if (await run(() => onCreate(name))) { setName(""); setOpen(false); }
  };
  /* Opening replaces what is on screen. With a project open that is already
     saved; with none, it would be lost, so that case asks first. */
  const openProject = async id => {
    if (!project && scratchHasValues && armedOpen !== id) { armOpen(id); return; }
    disarmOpen();
    if (await run(() => onOpen(id))) setOpen(false);
  };
  const rename = async e => {
    e.preventDefault();
    const { id, name: next } = renaming;
    if (await run(() => onRename(id, next))) setRenaming(null);
  };
  const remove = async id => {
    if (armedDelete !== id) { armDelete(id); return; }
    disarmDelete();
    await run(() => onDelete(id));
  };

  /* The button sits in the head, beside the title, so the name has the
     card's whole width under it. */
  const button = (
    <button type="button" className="ts-btn ctl-ghost ctl-sm project-head-btn" onClick={show} aria-haspopup="dialog"
      aria-label={project ? `Projects — ${project.name} is open` : "Projects — save or open one"}>
      <Icon name="folder" /> Projects
    </button>
  );
  const bar = (
    <Stack gap={2}>
      <span className={"project-bar-name" + (project ? "" : " is-none") + (saveError ? " is-error" : "")}
        title={project ? project.name : undefined}>
        {project ? project.name : "No project"}
      </span>
      {saveError && <p role="alert" className="input-error">Not saved: {saveError}</p>}
    </Stack>
  );

  return (
    <>
      {variant === "section" ? (
        <div className="section unboxed">
          <div className="section-head"><span>Project</span>{button}</div>
          <div className="section-body"><div className="section-pad">{bar}</div></div>
        </div>
      ) : (
        <ControlPanel id="control-project" title="Project" noToggle className="form-section-card" headerAction={button}>{bar}</ControlPanel>
      )}

      {/* Portalled to <body>, so a page's own stacking and overflow cannot
          clip the overlay or make it the size of the column it sits in. */}
      {open && ReactDOM.createPortal(
        <Modal title={pageTitle ? `${pageTitle} projects` : "Projects"} onClose={() => setOpen(false)} className="project-modal">
          <Stack gap={4}>
            {saveError && <p role="alert" className="input-error">Not saved: {saveError}</p>}

            <form onSubmit={create}>
              <label className="project-lbl" htmlFor="project-new-name">New blank project</label>
              <div className="project-new-row">
                <input id="project-new-name" className="num-input" type="text" autoComplete="off" maxLength={80}
                  value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
                <button type="submit" className="ts-btn" disabled={busy || !name.trim()} onBlur={disarmCreate}
                  aria-label={armedCreate ? "Confirm create — clears the values on screen" : undefined}>
                  {armedCreate ? "Clear screen?" : <><Icon name="plus" /> Create</>}
                </button>
              </div>
            </form>

            {project && (
              <div className="project-current">
                <span>Open: <strong>{project.name}</strong></span>
                <button type="button" className="ts-btn ctl-ghost" disabled={busy}
                  onClick={() => run(async () => { await onCloseProject(); setOpen(false); })}>
                  Close project
                </button>
              </div>
            )}

            {projects.length > 0 && (
              <ul className="project-list" aria-label="Saved projects">
                {projects.map(p => (
                  <li key={p.id} className={"project-row" + (project?.id === p.id ? " is-current" : "")}>
                    {renaming?.id === p.id ? (
                      <form className="project-rename" onSubmit={rename}>
                        <input className="num-input" type="text" autoComplete="off" maxLength={80} autoFocus
                          aria-label={`New name for ${p.name}`} value={renaming.name}
                          onChange={e => setRenaming({ id: p.id, name: e.target.value })}
                          onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); setRenaming(null); } }} />
                        <button type="submit" className="ts-btn ctl-sm" disabled={busy || !renaming.name.trim()}>Save</button>
                        <button type="button" className="ts-btn ctl-ghost ctl-sm" disabled={busy}
                          onClick={() => setRenaming(null)}>Cancel</button>
                      </form>
                    ) : (<>
                    <span className="project-name">{p.name}</span>
                    <span className="project-when">{p.unreadable ? "cannot be read" : when(p.savedAt)}</span>
                    <span className="project-actions">
                      {project?.id !== p.id && !p.unreadable && (
                        <button type="button" className="ts-btn ctl-ghost ctl-sm" disabled={busy}
                          onClick={() => openProject(p.id)} onBlur={disarmOpen}
                          aria-label={armedOpen === p.id ? `Confirm open ${p.name} — replaces the values on screen` : `Open ${p.name}`}>
                          {armedOpen === p.id ? "Replace screen?" : "Open"}
                        </button>
                      )}
                      {!p.unreadable && (
                        <button type="button" className="ts-btn ctl-ghost ctl-sm" disabled={busy}
                          onClick={() => { setError(""); setRenaming({ id: p.id, name: p.name }); }}
                          aria-label={`Rename ${p.name}`}>
                          Rename
                        </button>
                      )}
                      <button type="button" className={"ts-btn ctl-ghost ctl-sm ctl-danger" + (armedDelete === p.id ? " is-armed" : "")}
                        disabled={busy} onClick={() => remove(p.id)} onBlur={disarmDelete}
                        aria-label={armedDelete === p.id ? `Confirm delete ${p.name}` : `Delete ${p.name}`}>
                        {armedDelete === p.id ? "Delete?" : "Delete"}
                      </button>
                    </span>
                    </>)}
                  </li>
                ))}
              </ul>
            )}

            {error && <p role="alert" className="input-error">{error}</p>}
          </Stack>
        </Modal>,
        document.body
      )}
    </>
  );
}

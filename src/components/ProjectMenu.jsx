import { React, ReactDOM } from "../react-globals.js";
import { Icon, Modal, Stack, useTimedState } from "../shared.jsx";

/**
 * The header's project control, local mode only (see src/utils/projects.js).
 *
 * The button names the open project, or says there is none. It shows no
 * "Saved" tag: saving is automatic and a status that says so on every
 * keystroke is noise. It does turn to the danger colour, and say why in its
 * tooltip, when a save has failed — that is the one state you need to see.
 *
 * The dialog does five things: start a project from what is on screen, open
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

export function ProjectMenu({ projects, project, saveError, onCreate, onOpen, onCloseProject, onDelete, onRename, onRefresh, scratchHasValues }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [renaming, setRenaming] = React.useState(null);   // { id, name }
  // Two-click confirms, each disarming itself, as Global Reset does.
  const [armedDelete, armDelete, disarmDelete] = useTimedState(null, 4000);
  const [armedOpen, armOpen, disarmOpen] = useTimedState(null, 4000);

  const run = async action => {
    setBusy(true);
    setError("");
    try { await action(); return true; }
    catch (err) { setError(err.message || String(err)); return false; }
    finally { setBusy(false); }
  };

  const show = () => { setOpen(true); setError(""); setRenaming(null); onRefresh(); };
  const create = async e => {
    e.preventDefault();
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

  const label = project ? project.name : "No project";
  const title = saveError ? `Not saved: ${saveError}` : project ? `Project: ${project.name}` : "Projects";

  return (
    <>
      <button type="button" className={"hdr-btn is-wide ctl-ghost hdr-project" + (saveError ? " is-error" : "")}
        onClick={show} title={title} aria-label={title} aria-haspopup="dialog">
        <Icon name="folder" />
        <span className="hdr-project-label">{label}</span>
      </button>

      {/* Portalled to <body>: the header cluster is centred with `translate`,
          which makes it the containing block for anything position: fixed
          inside it, so an overlay rendered here would be the size of the
          cluster rather than the screen. */}
      {open && ReactDOM.createPortal(
        <Modal title="Projects" onClose={() => setOpen(false)} className="project-modal">
          <Stack gap={4}>
            {saveError && <p role="alert" className="input-error">Not saved: {saveError}</p>}

            <form onSubmit={create}>
              <label className="project-lbl" htmlFor="project-new-name">
                {project ? "New project from what is on screen" : "Save what is on screen as a project"}
              </label>
              <div className="project-new-row">
                <input id="project-new-name" className="num-input" type="text" autoComplete="off" maxLength={80}
                  value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
                <button type="submit" className="ts-btn" disabled={busy || !name.trim()}>
                  <Icon name="plus" /> Create
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

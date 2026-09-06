/*
 * Undo for what a button did.
 *
 * `field-undo.js` covers text you typed and nothing else, which left every
 * structural action on every page with no step back at all. The worst of them
 * are on the timesheet: "Clear all" wipes a filled sheet with no confirm, and
 * the × on a row deletes it the same way. There is no persistence in this app
 * either, so there was no restore point to fall back to — the work was simply
 * gone. Applying a material preset over dimensions you had just typed is the
 * same shape of loss, quieter.
 *
 * SNAPSHOTS, NOT COMMANDS. An inverse per action would be a dozen of them, each
 * a separate chance to forget something the forward action touched — the
 * direction switch on a surface layout writes five keys of `sh` at once and
 * reads four more, and a hand-written inverse that missed one would restore a
 * layout that looked right and was not. A snapshot cannot miss anything: it is
 * the state that WAS there. The pages hold their documents in React state that
 * is replaced wholesale and never mutated, so a snapshot is a few pointers — no
 * serialize, no clone.
 *
 * ONE HISTORY AT A TIME, keyed by the document on screen (`timesheet`,
 * `surface-layout`). A new key drops the old one, which is the lifetime rule
 * field-undo gets for free from its `WeakMap`: change page and there is nothing
 * on screen to undo, so offering a step would be offering to change data you
 * cannot see.
 *
 * The page registers through `useDocHistory` (src/shared.jsx); this module is
 * what the Ctrl+Z handler talks to.
 *
 * ── Ported from MONEYFLOW as a documented subset ───────────────────────────
 *
 * One thing in its copy has no counterpart here and is not going to get one:
 * `markDirty`. There, a history entry carries the page's autosave hook and
 * every step calls it, because an undo has to be written to disk like any other
 * change or the file keeps the action you just took back.
 *
 * MASTERPLAN persists nothing but the theme, and that is a decision rather than
 * a gap. This is a calculator, not a ledger: its state is a handful of numbers
 * somebody has in front of them — a tape measure reading, a panel spec — and
 * re-entering them costs less than the machinery to keep them would. The two
 * things actually worth keeping already have homes: `saveStaticDefaults` for
 * the values you reuse, and the printed cut list for the output.
 *
 * That raises what this module is for rather than lowering it. With no file to
 * restore from, undo is the ONLY way back from a destructive action — there is
 * nothing behind it.
 *
 * The subscribe/announce pair below was absent for a while too, because the
 * header was a logo and there was nowhere to put a control that reads it. There
 * is now — see `src/components/UndoButtons.jsx`.
 */

/*
 * Twenty steps.
 *
 * Deliberately not field-undo's five. Five was chosen for typing, where a step
 * is an edit run and a dimension is four or five keystrokes — five steps is
 * about a cell. A structural step is a whole action, and twenty of them is a
 * session's worth of adding and removing. They cost pointers, not documents.
 */
const LIMIT = 20;

/*
 * The active page's history, or null.
 *
 * `key` is what makes a history mortal. `snapshot` reads the page's data state
 * and `apply` writes it back.
 */
let active = null;

/*
 * Bumped by every applied step, and read by `field-undo.js`.
 *
 * A document step rewrites input values from outside, and the rows keep their
 * DOM nodes across it (React keys a timesheet row by its id), so the per-node
 * typing histories survive describing text that is no longer in the field. They
 * are held in a `WeakMap` that cannot be enumerated to clear, so they are
 * stamped instead: a history from an older generation reads as empty and starts
 * again. The same rule that file already applies to a reformat — a value the
 * page wrote is a new starting point, not a step.
 */
let generation = 0;
export const docUndoGeneration = () => generation;

const listeners = new Set();
let announced = { canUndo: false, canRedo: false, label: null, redoLabel: null };

/* Only on a real change. The page re-registers on every render, so a store that
   woke the header on each one to say the same thing would be a cost with no
   reader. */
function announce() {
  const next = docUndoState();
  if (next.canUndo === announced.canUndo
    && next.canRedo === announced.canRedo
    && next.label === announced.label
    && next.redoLabel === announced.redoLabel) return;
  announced = next;
  for (const listener of listeners) listener(next);
}

export function subscribeDocUndo(listener) {
  listeners.add(listener);
  listener(docUndoState());
  return () => listeners.delete(listener);
}

/**
 * Points the module at a page's history, replacing whatever was there.
 *
 * Called with null on unmount. Registering the same key twice keeps the stacks:
 * the page re-registers on every render (its `snapshot` and `apply` close over
 * this render's state), and dropping the history each time would leave nothing
 * to undo the moment anything else on the page changed.
 */
export function registerDocHistory(entry) {
  if (!entry) {
    active = null;
    announce();
    return;
  }
  if (active && active.key === entry.key) {
    Object.assign(active, entry);
  } else {
    active = { ...entry, past: [], future: [] };
  }
  announce();
}

/**
 * Records the state as it is NOW, before the caller changes it.
 *
 * Call it at the top of a structural handler, before the `setState` that
 * changes anything — the snapshot is read synchronously off the current
 * render's closure, so a call made after the write would record the state the
 * action produced rather than the one it replaced.
 *
 * `label` says what the step was ("Clear all", "Remove row") and is what the
 * header pair puts in its tooltip. The call site is the only place that knows,
 * so every `markStep` should pass one.
 */
export function recordDocStep(label) {
  if (!active) return;
  active.past.push({ snapshot: active.snapshot(), label });
  if (active.past.length > LIMIT) active.past.shift();
  // Acting after an undo abandons what was undone, as everywhere else.
  active.future.length = 0;
  announce();
}

/*
 * Move one step from `from` to `to`, putting the current state on the far
 * stack so the move is reversible.
 *
 * The label travels with the state it describes rather than with the step: the
 * entry going onto the redo stack is labelled by the action being undone, which
 * is what "Redo Clear all" has to say.
 */
function step(from, to) {
  if (!active || !from.length) return false;
  const entry = from.pop();
  to.push({ snapshot: active.snapshot(), label: entry.label });
  if (to.length > LIMIT) to.shift();
  generation += 1;
  active.apply(entry.snapshot);
  announce();
  return true;
}

export function undoDocStep() {
  return active ? step(active.past, active.future) : false;
}

export function redoDocStep() {
  return active ? step(active.future, active.past) : false;
}

/*
 * Whether there is a step either way, and the name of each.
 *
 * Two labels rather than one. A pair of buttons asks different questions —
 * "Undo Clear all" and "Redo Clear all" are the same action named from
 * opposite ends, and after the last undo there is nothing left to undo while
 * there is very much something to redo.
 */
export function docUndoState() {
  const past = active ? active.past : [];
  const future = active ? active.future : [];
  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    label: past.length ? past[past.length - 1].label : null,
    redoLabel: future.length ? future[future.length - 1].label : null
  };
}

// Exported for tests: the constant the behaviour is described in.
export const DOC_UNDO_LIMIT = LIMIT;

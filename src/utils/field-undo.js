/*
 * Undo inside one field.
 *
 * The browser has this already, and that is the problem: it half-works. Typing
 * into a `NumInput` leaves the native undo stack intact, so Ctrl+Z looks fine —
 * right up until something writes `value` programmatically, which truncates
 * that stack. `NumInput` does it three times (shared.jsx): `commitValue` on
 * blur or Enter rewrites `250.004` as the clamped, rounded `250`, the effect on
 * `[value]` rewrites the field whenever the page's own state moves under it,
 * and `onChange` runs `cleanNumericInput` so a rejected character is restored
 * over what you typed. Timesheet does a fourth: `formatTimeInput` turns `9`
 * into `09:00` on the way out of the cell.
 *
 * So undo worked until you blurred, pressed Enter, mistyped, or applied a
 * preset — which is most of the ways a number in this app gets finished. The
 * comment above `NumInput` already names the gap from the other side: the
 * arrow-key spinner was removed because it "rewrites a dimension the whole
 * layout is drawn from, with nothing on screen to say it happened and no undo
 * to reach for". This is that undo.
 *
 * DELEGATED, not a hook. There are 25 `NumInput` call sites and 8 raw text
 * inputs; a hook threaded through all of them is 33 edits and a rule every
 * future input has to remember to follow. One listener set on the document
 * covers every text field in the app, including ones not written yet.
 *
 * The histories hang off the DOM nodes in a WeakMap, which is what makes the
 * lifetime free: a field's history dies exactly when its node does — unmount,
 * page change, a timesheet row removed — with no cleanup to forget, and it
 * survives blur and refocus, so clicking away and back does not wipe what you
 * just typed.
 *
 * The other half of undo — what a BUTTON did — is `doc-undo.js`. The two meet
 * in exactly two places, both below: the generation stamp on a history, and the
 * Ctrl+Z pressed with the focus outside a field.
 *
 * ── Ported from MONEYFLOW as a documented subset ───────────────────────────
 *
 * One thing in its copy is still absent here: the subscribe/announce pair that
 * drives MONEYFLOW's header undo buttons, and the MutationObserver that exists
 * to tell those buttons their field has left the screen. This app's header is a
 * logo and nothing else, so there is nowhere to put a pair without designing a
 * tool row first. `targetField` already checks `isConnected`, so nothing is
 * lost in correctness — only the ability to render a control that greys out.
 * That comes back with the buttons, not before: a document-wide subtree
 * observer is not free in an app that redraws an SVG layout on every keystroke.
 *
 * Ctrl+Z is the whole interface for now, which is what it is in every other
 * text field a person has used.
 */
import { docUndoGeneration, redoDocStep, undoDocStep } from "./doc-undo.js";

// Five steps back. Deep enough to cover a run of real mistakes in one cell;
// anything past that is the document's problem, not the field's.
const LIMIT = 5;

/*
 * How long a typing run stays open.
 *
 * A step is deliberately NOT one character. A dimension field takes four or
 * five keystrokes, so five character-steps would be less than one number and
 * the whole facility would be useless. A step is an edit RUN, the way a real
 * text field does it — a continuous stretch of insertions is one step, and it
 * breaks when the kind of edit changes, the caret jumps, or the field goes
 * quiet.
 *
 * 800ms is the pause a person means as "done typing that". MONEYFLOW picked it
 * to match the quiet its autosave waits for; there is no autosave here, so it
 * is carried over on its own merits rather than derived from anything.
 */
const RUN_IDLE_MS = 800;

const histories = new WeakMap();

/*
 * The field a Ctrl+Z pressed outside a field acts on: the last text field that
 * was focused, for as long as it is still on screen.
 *
 * Not "the focused field", which would leave the shortcut dead the moment you
 * clicked a button, and not "this page", which would be a document-level undo
 * this is not. A field's history already outlives its blur — that is what the
 * WeakMap buys — so the honest target is the cell you were last in, and it
 * stops being a target when it stops existing: change page and there is
 * nothing on screen to undo.
 */
let lastField = null;

/* Set while an undo drives the field, so the `input` event it dispatches is not
   read back as a fresh edit and pushed onto the history it came from. The
   dispatch is synchronous, so a plain flag is enough. */
let applying = false;

/*
 * Text fields only.
 *
 * Every input in this app is `type="text"` — `NumInput` is text plus
 * `inputMode="decimal"` on purpose, and the timesheet and Golden Ratio fields
 * are plain text. The one exception is `RangeSlider`, a `type="range"`, which
 * is not a text field and has nothing to undo a character of.
 */
function isManaged(el) {
  return el instanceof HTMLInputElement && el.type === "text" && !el.disabled && !el.readOnly;
}

function snapshot(el) {
  const end = el.value.length;
  return {
    value: el.value,
    start: el.selectionStart == null ? end : el.selectionStart,
    end: el.selectionEnd == null ? end : el.selectionEnd
  };
}

/*
 * The field's history, started fresh if a document step has happened since it
 * was last touched.
 *
 * A document undo rewrites this field's value from outside, and the node
 * survives it — React keys a timesheet row by its id, so the same input is
 * reused with different text in it. Its steps then describe a value the field
 * never held, which is the one thing this module exists to prevent. The
 * histories live in a `WeakMap` that cannot be walked to clear, so they carry
 * the generation they were written in instead and a stale one starts again from
 * here. Same rule the file already applies to a reformat: a value the page
 * wrote is a new starting point, not a step.
 */
function historyFor(el) {
  let history = histories.get(el);
  if (!history) {
    history = { past: [], future: [], pre: null, runKind: null, runAt: 0, runCaret: null, generation: docUndoGeneration() };
    histories.set(el, history);
  } else if (history.generation !== docUndoGeneration()) {
    history.past.length = 0;
    history.future.length = 0;
    history.pre = null;
    history.runKind = null;
    history.runCaret = null;
    history.generation = docUndoGeneration();
  }
  return history;
}

/*
 * The field's state immediately BEFORE whatever is about to change it.
 *
 * Read live off the node rather than tracked across events, and that is the
 * whole trick. A tracked baseline goes stale the moment React writes `value`
 * itself — the blur commit, a preset applied over the field, a clamp — and a
 * stale baseline is a history that hands back a value the field never held.
 * Reading it at keydown/paste/cut/drop time cannot be stale, because every one
 * of those fires before the edit and after whatever React last did.
 */
function markPre(el) {
  if (isManaged(el)) historyFor(el).pre = snapshot(el);
}

/*
 * Put a value back into a controlled React input.
 *
 * The native setter off the prototype, deliberately: React installs its own
 * `value` property on the node to track what it last saw, and going around it
 * leaves that tracker stale, which is exactly what makes React treat the
 * dispatched event as a real change and run `onChange`. So `NumInput` cleans
 * and holds an undo the same way it holds a keystroke, and the layout redraws
 * from it like any other edit. The same technique
 * `@testing-library/user-event` uses to type into these fields.
 *
 * Selection is restored after the dispatch, because React re-renders during it.
 * An undo that drops the caret at the end of the field is one you have to
 * navigate back from.
 */
function apply(el, entry) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  applying = true;
  try {
    setter.call(el, entry.value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } finally {
    applying = false;
  }
  try {
    el.setSelectionRange(entry.start, entry.end);
  } catch {
    /* A field that will not take a selection range still took the value. */
  }
}

function record(el) {
  const history = historyFor(el);
  // An edit whose "before" we never saw — the value was set from outside, or
  // by something that fires no keydown. There is no honest previous value to
  // offer, so nothing is pushed and the run starts again from here.
  if (!history.pre) {
    history.runKind = null;
    history.runCaret = null;
    return;
  }

  const pre = history.pre;
  history.pre = null;

  /* Nothing actually changed. A keystroke the field refuses lands here: type a
     letter into a dimension cell and `cleanNumericInput` strips it, so there is
     an `input` event and no edit. Spending a step on it would give you an undo
     that appears to do nothing. */
  if (el.value === pre.value) return;

  const kind = el.value.length > pre.value.length
    ? "insert"
    : el.value.length < pre.value.length ? "delete" : "replace";

  const now = Date.now();
  /* A run continues only while every one of these holds: the same kind of edit,
     no selection replaced, the caret exactly where the last edit left it, and
     no pause. Any of them failing is a new thing the person did, and a new
     thing they can undo separately. */
  const continues = kind === history.runKind
    && kind !== "replace"
    && pre.start === pre.end
    && pre.start === history.runCaret
    && now - history.runAt < RUN_IDLE_MS;

  if (!continues) {
    history.past.push(pre);
    if (history.past.length > LIMIT) history.past.shift();
    // Typing after an undo abandons what was undone, as everywhere else.
    history.future.length = 0;
  }

  history.runKind = kind;
  history.runAt = now;
  history.runCaret = el.selectionEnd;
}

function step(el, from, to) {
  const history = histories.get(el);
  if (!history || !from.length) return;
  to.push(snapshot(el));
  if (to.length > LIMIT) to.shift();
  // The run is over either way: the next keystroke is a new step, never a
  // continuation of the one just stepped out of.
  history.runKind = null;
  history.runCaret = null;
  history.pre = null;
  apply(el, from.pop());
}

/* historyFor rather than a plain lookup, so a history left stale by a document
   step is emptied here too. The keystroke then does nothing, which is the point:
   its steps describe text the page has since replaced. */
function undo(el) {
  const history = historyFor(el);
  step(el, history.past, history.future);
}

function redo(el) {
  const history = historyFor(el);
  step(el, history.future, history.past);
}

/*
 * The target, or null. Every reason it can be missing is checked here rather
 * than remembered: the field may never have existed, may have been unmounted by
 * a page change or a removed timesheet row, or may have been disabled since you
 * left it.
 */
function targetField() {
  const el = lastField;
  if (!el || !el.isConnected || el.disabled || el.readOnly) return null;
  return el;
}

/** Whether there is a step either way on the field the shortcut would act on. */
export function fieldUndoState() {
  const el = targetField();
  const history = el && histories.get(el);
  // A history left behind by a document step is spent, whether or not anything
  // has touched the field since — nothing must offer its steps.
  const live = history && history.generation === docUndoGeneration();
  return {
    canUndo: !!(live && history.past.length),
    canRedo: !!(live && history.future.length)
  };
}

/*
 * What a Ctrl+Z pressed outside a field acts on.
 *
 * The focus is put back before the step, so an undo made after clicking away
 * shows you which cell it changed and leaves you in it — the caret restore is
 * pointless in a field nobody is looking at.
 */
function stepLastField(run) {
  const el = targetField();
  if (!el) return false;
  if (el.ownerDocument.activeElement !== el) el.focus();
  run(el);
  return true;
}

/*
 * Ctrl+Z with the focus anywhere but a field.
 *
 * The page's own history first, the last field's typing second. That order is
 * the answer to "undo the last thing I did here": the actions are the coarser
 * record and the only one a person can point at, and a page you have only
 * clicked in has no field to fall back to at all.
 *
 * Ctrl+Z INSIDE a field is untouched by this and stays per-field. Typing is
 * where a person expects character-level undo, and a keystroke that cleared the
 * whole timesheet instead would be the surprise this ordering exists to avoid.
 */
export function stepOutsideAField(isRedo) {
  if (isRedo) return redoDocStep() || stepLastField(redo);
  return undoDocStep() || stepLastField(undo);
}

/**
 * Wires field undo onto a document. Returns the uninstaller.
 *
 * Everything that has to run BEFORE an edit is capture-phase. `input` is the
 * exception and runs on the way back up, deliberately: React restores a
 * controlled input's value at the end of its own handler when the page rejects
 * what was typed, so the bubble phase is where the value the field actually
 * settled on can be read. In capture the history would record the keystroke
 * that got thrown away. Nothing in the app stops an `input` event from
 * propagating, so there is nothing up there to miss.
 *
 * App.jsx already has two capture-phase keydown listeners on `window`, and both
 * run before this one — window is the outer target in the capture phase. That
 * is the right order and nothing has to change for it: neither answers Ctrl+Z,
 * and the Enter-commits-and-blurs handler leaves a `pre` snapshot behind that
 * the next real edit simply overwrites.
 */
export function installFieldUndo(target = document) {
  const onKeyDown = event => {
    const el = event.target;
    const key = String(event.key || "").toLowerCase();

    if (!isManaged(el)) {
      /* Pressed with the focus somewhere else — a preset button, the page
         itself. It means the same thing it would in the field you were last
         in, and answering differently depending on where the focus happened to
         be is the inconsistency this module exists to end. A field we
         deliberately do not manage keeps its own native undo instead. */
      const ownField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (ownField || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (key !== "z" && key !== "y") return;
      if (stepOutsideAField(key === "y" || event.shiftKey)) event.preventDefault();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.altKey && (key === "z" || key === "y")) {
      // Always prevented, even with nothing to undo. Letting the native stack
      // answer when ours is empty is how you get a field that behaves one way
      // most of the time and another way at the edges — the thing this exists
      // to end.
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo(el);
      else undo(el);
      return;
    }

    // Every other key, Ctrl+V included, may be about to change the field.
    markPre(el);
  };

  const onInput = event => {
    if (applying) return;
    if (isManaged(event.target)) record(event.target);
  };

  const onPre = event => markPre(event.target);

  const onFocus = event => {
    const el = event.target;
    if (!isManaged(el)) return;
    lastField = el;
    const history = historyFor(el);
    history.pre = snapshot(el);
    // The value may have been reformatted on the way out and back — a commit
    // clamping 8000.4 to 8000, a timesheet cell settling into 09:00. That is
    // presentation, not an edit, so it is absorbed as the new starting point
    // rather than pushed as a step. What it must not do is let a run started
    // before the blur carry on across it.
    history.runKind = null;
    history.runCaret = null;
  };

  target.addEventListener("keydown", onKeyDown, true);
  target.addEventListener("input", onInput);
  target.addEventListener("focus", onFocus, true);
  // Paste, cut and drop from a mouse or a menu reach the field without a
  // keydown, so they mark their own "before".
  target.addEventListener("paste", onPre, true);
  target.addEventListener("cut", onPre, true);
  target.addEventListener("drop", onPre, true);

  return () => {
    // The last-field pointer is module state and outlives the listeners, so it
    // is dropped with them. Nothing can step a field once the handlers that
    // would do it are gone.
    lastField = null;
    target.removeEventListener("keydown", onKeyDown, true);
    target.removeEventListener("input", onInput);
    target.removeEventListener("focus", onFocus, true);
    target.removeEventListener("paste", onPre, true);
    target.removeEventListener("cut", onPre, true);
    target.removeEventListener("drop", onPre, true);
  };
}

// Exported for tests: the constants the behaviour is described in.
export const FIELD_UNDO_LIMIT = LIMIT;
export const FIELD_UNDO_RUN_IDLE_MS = RUN_IDLE_MS;

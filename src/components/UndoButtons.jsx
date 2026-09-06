import { React, useState } from "../react-globals.js";
import { Icon } from "../shared.jsx";
import { docUndoState, subscribeDocUndo } from "../utils/doc-undo.js";
import { fieldUndoState, stepOutsideAField, subscribeFieldUndo } from "../utils/field-undo.js";

/**
 * The header's undo/redo pair.
 *
 * It means "the last thing I did on this page": the page's own action history
 * first (`doc-undo.js` — a cleared timesheet, an applied preset), the last text
 * field you were in second (`field-undo.js`). Same order as a Ctrl+Z pressed
 * with the focus outside a field, and `stepOutsideAField` performs both, so the
 * button and the shortcut cannot disagree about what "undo" means.
 *
 * It goes dead rather than reaching past what you can see: a page change drops
 * the action history and unmounts the field, so both halves empty at once.
 *
 * `onMouseDown` is prevented on both, which is the whole reason clicking one
 * works at all. A button takes the focus on mousedown, so without it the field
 * being fixed is blurred before the click lands — and a blurred `NumInput` runs
 * `commitValue`, which clamps and reformats. The undo would then arrive at a
 * field that had just been rewritten underneath it.
 *
 * Ported from MONEYFLOW. Its version renders `<i className="fa-solid fa-undo">`
 * directly; here the glyph goes through `Icon` and the `ICONS` map, because
 * `build-icons.js` subsets the font to the glyphs that map names and a literal
 * class would ship a character the font no longer carries.
 */
export function UndoButtons() {
  const [field, setField] = useState(fieldUndoState);
  const [doc, setDoc] = useState(docUndoState);

  React.useEffect(() => subscribeFieldUndo(setField), []);
  React.useEffect(() => subscribeDocUndo(setDoc), []);

  const canUndo = doc.canUndo || field.canUndo;
  const canRedo = doc.canRedo || field.canRedo;
  /* The tooltip names the action when there is one to name. A typing step has
     no name worth showing — "Undo" is already the whole of it. */
  const undoTitle = doc.canUndo && doc.label ? `Undo ${doc.label} (Ctrl+Z)` : "Undo (Ctrl+Z)";
  const redoTitle = doc.canRedo && doc.redoLabel ? `Redo ${doc.redoLabel} (Ctrl+Shift+Z)` : "Redo (Ctrl+Shift+Z)";

  return (
    <>
      <button
        type="button"
        className="hdr-btn ctl-ghost ctl-icon"
        onMouseDown={event => event.preventDefault()}
        onClick={() => stepOutsideAField(false)}
        disabled={!canUndo}
        title={undoTitle}
        aria-label="Undo"
      >
        <Icon name="undo" />
      </button>
      <button
        type="button"
        className="hdr-btn ctl-ghost ctl-icon"
        onMouseDown={event => event.preventDefault()}
        onClick={() => stepOutsideAField(true)}
        disabled={!canRedo}
        title={redoTitle}
        aria-label="Redo"
      >
        <Icon name="redo" />
      </button>
    </>
  );
}

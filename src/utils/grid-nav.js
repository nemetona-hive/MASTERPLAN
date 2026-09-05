// ── Grid arrow-key navigation ─────────────────────────────────────────────────
//
// Arrow-key movement inside a grid of typed cells: Up and Down move a row, Left
// and Right move a column once the caret has run out of field to cross. It is
// what every spreadsheet does, and on the timesheet it is the difference
// between correcting the third row's end time and tabbing past six cells to
// reach it.
//
// PORTED FROM MONEYFLOW's src/utils/grid-nav.js, deliberately as a subset — the
// same relationship audit-ui.js has to its own original. That version also
// roves the tabindex, so a thirteen-column money grid is ONE tab stop and the
// arrows are the only way around inside it. Not ported, because the shape of
// the grid here argues the other way: the timesheet is three columns, and Tab
// already walks start → end → lunch → next row's start, adding a row when it
// runs off the end. Roving would trade a working chain for a walk that was
// never long. Every cell stays a tab stop; the arrows are added alongside.
// Bring the roving half over with the first grid wide enough to need it.

export const GRID_NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/*
 * Does this arrow leave the field, or move the caret inside it?
 *
 * The caret-aware rule, and the whole reason this is usable in a grid of text
 * inputs. Left leaves only when the caret is already at the start; Right only
 * when it is already at the end. Anywhere in between, the arrow does what it
 * has always done and moves the caret — so a mistyped digit in the middle of
 * `08:30` is still fixable, which is the thing a plain "arrows always move
 * cells" rule takes away.
 *
 * A SELECTION never leaves. With text selected, Left collapses it to the start
 * and Right to the end — the native behaviour, and the one people rely on
 * straight after focusing a field, which is exactly when a cell's contents tend
 * to be selected.
 *
 * Up and Down always leave: they mean nothing inside a single-line input.
 *
 * An empty field has start === end === length === 0, so both Left and Right
 * leave it immediately. That is deliberate rather than incidental — flying
 * through the empty cells is the move this exists for.
 */
export function arrowExitsField(key, field) {
  if (!GRID_NAV_KEYS.has(key)) return false;

  /* A CARET IS THE PRECONDITION, for every direction including up and down.
   *
   * Up and Down mean nothing inside a single-line text input, which is what
   * makes them free to move rows. They mean a great deal inside a <select>, and
   * inside a number spinner they step the value — the accident NumInput was
   * made type="text" to stop. Taking those keys there would break the control
   * to move the grid.
   *
   * `selectionStart` is the test because it is exactly the property a text
   * field has and those controls do not. It also covers the input that reports
   * null, where there is no way to tell a boundary from the middle, so the
   * native behaviour stands. */
  const start = field && field.selectionStart;
  const end = field && field.selectionEnd;
  if (typeof start !== "number" || typeof end !== "number") return false;

  if (key === "ArrowUp" || key === "ArrowDown") return true;
  if (start !== end) return false;   // a selection collapses first

  const length = ((field && field.value) || "").length;
  return key === "ArrowLeft" ? start === 0 : start === length;
}

/*
 * The next position, or null at the edge.
 *
 * Deliberately does NOT wrap. A spreadsheet does not put you on the next row
 * when you run off the right, and here it would be worse than useless: running
 * right off Lunch would land on the following row's Start, two unrelated cells
 * a keypress apart.
 */
export function nextGridPosition({ row, col, key, rows, cols }) {
  const moves = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0]
  };
  const move = moves[key];
  if (!move) return null;

  const nextRow = row + move[0];
  const nextCol = col + move[1];
  if (nextRow < 0 || nextRow >= rows) return null;
  if (nextCol < 0 || nextCol >= cols) return null;
  return { row: nextRow, col: nextCol };
}

/*
 * The arrow handling, as props for each cell.
 *
 * `cellId` maps a position to the DOM id the page already gives that input.
 * Reusing the ids rather than keeping a ref map is what keeps this a file you
 * can delete: the page needs no new bookkeeping to support it.
 *
 * A hook by name and by contract — one call per grid, from a component, on
 * every render. It holds no state because the roving tabindex, which is the
 * part that needs state, is the half not ported; keeping the name means the
 * call sites do not move when it is.
 */
export function useGridNav({ rowCount, colCount, cellId }) {
  /* Walks in one direction until it finds a cell that can be focused, or runs
     off the edge — a disabled or missing input is stepped over rather than
     stopped at. The guard is the cell count: every step moves strictly towards
     an edge, so it cannot loop, but a bound costs nothing and a runaway keydown
     handler is not a failure worth risking. */
  const focusFrom = (fromRow, fromCol, key) => {
    let position = { row: fromRow, col: fromCol };
    for (let step = 0; step < rowCount * colCount; step++) {
      const next = nextGridPosition({ ...position, key, rows: rowCount, cols: colCount });
      if (!next) return false;
      const element = typeof document !== "undefined"
        ? document.getElementById(cellId(next.row, next.col))
        : null;
      if (element && !element.disabled) {
        element.focus();
        /* Confirmed rather than assumed. focus() is a request — an element can
           refuse it for reasons this cannot see, and reporting a move that did
           not happen would swallow the keypress and leave the caret sitting
           where it was, which reads as the arrow key being broken. */
        if (document.activeElement === element) return true;
      }
      position = next;
    }
    return false;
  };

  const cellProps = (cellRow, cellCol) => ({
    onKeyDown: event => {
      if (!GRID_NAV_KEYS.has(event.key)) return;
      // A modifier means the browser or the OS is being addressed, not the grid.
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!arrowExitsField(event.key, event.target)) return;
      // Only once a move has actually happened: at the edge of the grid the
      // arrow should still do whatever it would have done.
      if (focusFrom(cellRow, cellCol, event.key)) event.preventDefault();
    }
  });

  return { cellProps };
}

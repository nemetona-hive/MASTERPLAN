/*
 * What a layout contains, described once, for anything that has to render it
 * as a document.
 *
 * ONE MODEL, MANY RENDERERS. This builds a neutral description; `CutListSheet`
 * prints it. A second format — a CSV, a supplier order — consumes the same
 * object and adds nothing here. The rule is MONEYFLOW's, and the reason is the
 * failure it prevents: a scoping decision written per format is two lines that
 * agree today and disagree after the next change, and what you get is a
 * printout and a spreadsheet of the same job with different totals and nothing
 * to say which is right. **Put a new derivation in the model, never in a
 * renderer.**
 *
 * EVERYTHING NUMERIC IS A NUMBER, not a formatted string. The sheet formats on
 * the way to the page. Format here and the next renderer has to parse its own
 * strings back — which is how a millimetre figure reaches a spreadsheet as text
 * that cannot be summed.
 *
 * ── What a cut list is for ────────────────────────────────────────────────
 *
 * Not a picture of the layout: the app already draws one. It is the two
 * questions somebody standing at a saw actually has.
 *
 *   Which pieces go in which row, in order?      -> `rows`
 *   Where does each cut piece come from?         -> `panels`
 *
 * The second is the one worth printing. `simulate()` runs the remainder of a
 * cut panel into the START of the next row — the `cut` segment and the
 * following row's leading `offcut` share a `sourceId` — so one stock panel
 * yields two placed pieces in two different rows. A list that only said "row 3
 * needs a 340" would have you cut a fresh panel for it and throw away the 910
 * you were already holding. `panels` says: this panel, cut once, both halves
 * used, here and here.
 *
 * ── Which dimension is which ──────────────────────────────────────────────
 *
 * Worth stating, because the two are easy to swap and the simulation's own
 * parameter names invite it: `simulate(W, H, PP, PL, …)` is called as
 * `simulate(sW, sH, PLa, PPi, …)`, so inside it **PL is PPi and PP is PLa**.
 *
 * In the UI's terms, and the ones used here:
 *
 *   PPi  material LENGTH  — steps along a row, and so is the piece that gets
 *                           cut. This is the stock a panel entry describes.
 *   PLa  material WIDTH   — the row's height. Never cut by this simulation.
 *
 * Read them the other way round and every panel's waste is computed against
 * the wrong stock, which still produces plausible figures.
 */

/* Rounded to a tenth of a millimetre. The simulation works in floats and a
   width lands on 339.99999999999994 often enough to matter; a saw does not
   care past a tenth, and neither does a printed sheet. Done in the MODEL so
   every renderer gets the same number, rather than each rounding its own way
   and the totals disagreeing between two formats. */
const mm = value => Math.round(Number(value) * 10) / 10;

/*
 * The rows in the order the screen shows them.
 *
 * `rowStart: "bottom"` reverses the drawing, and the printed list has to
 * follow: a sheet that numbers row 1 at the top while the preview numbers it at
 * the bottom is worse than no sheet, because both look right on their own. The
 * ordering rule lives here so the two cannot drift — `LayoutVisualization` does
 * the same thing to draw, and the day it stops, this is where the answer is.
 */
function orderRows(rows, rowStart) {
  const indexed = (rows || []).map((row, idx) => ({ row, idx }));
  return rowStart === "bottom" ? indexed.reverse() : indexed;
}

const KINDS = {
  full: "full",
  cut: "cut",
  offcut: "offcut",
  gap: "gap",
  edge: "edge"
};

/**
 * Builds the cut list for one computed layout, or null if there is nothing to
 * print.
 *
 * Null rather than an empty document, deliberately: a sheet with a header and
 * no pieces is a thing somebody carries to a saw and then discovers is blank.
 * The caller uses the null to keep the button disabled.
 */
export function buildCutList(result, sh, layout) {
  if (!result || !Array.isArray(result.rows) || !result.rows.length) return null;

  const meta = result.meta || {};
  const ordered = orderRows(result.rows, sh && sh.rowStart);

  /* Row numbers are the printed sheet's own, counting from the top of the
     drawing down — never the simulation's array index, which runs bottom-up
     when the pattern starts there. `sourceRow` keeps the original index so a
     reader comparing against the app can find the same row. */
  const rows = ordered.map(({ row, idx }, position) => ({
    number: position + 1,
    sourceRow: idx,
    height: row.h === undefined ? null : mm(row.h),
    pieces: (row.segs || []).map(seg => ({
      kind: KINDS[seg.type] || seg.type,
      width: mm(seg.w),
      // Only a cut and its offcut carry one, which is what makes it the join
      // between the two lists below.
      panel: seg.sourceId || null
    }))
  }));

  /*
   * One entry per stock panel that had to be cut, with both halves and the
   * rows they landed in.
   *
   * Built by walking the ROWS as printed rather than the simulation's own
   * order, so "row 3" in this table is the row 3 on the sheet. A panel whose
   * offcut was never placed — the last cut in a layout, or one whose remainder
   * fell under the minimum joint — keeps a null `offcut` and states the waste,
   * because "this one has no second half" is the answer somebody wants before
   * they cut it, not after.
   */
  const byPanel = new Map();
  for (const row of rows) {
    for (const piece of row.pieces) {
      if (!piece.panel) continue;
      if (!byPanel.has(piece.panel)) {
        byPanel.set(piece.panel, { id: piece.panel, cut: null, offcut: null });
      }
      const entry = byPanel.get(piece.panel);
      const placed = { width: piece.width, row: row.number };
      if (piece.kind === KINDS.cut) entry.cut = placed;
      else if (piece.kind === KINDS.offcut) entry.offcut = placed;
    }
  }

  // The LENGTH, because that is the axis a piece is cut along — see the note
  // at the top of this file.
  const stock = mm(meta.PPi || (sh && sh.PPi) || 0);
  const panels = [...byPanel.values()]
    .filter(entry => entry.cut)
    .map(entry => ({
      ...entry,
      stock,
      /* What is left over once both placed halves are taken out of the stock
         panel. A panel whose offcut was placed wastes only the saw kerf, which
         this does not model and does not pretend to — the figure is the
         material not placed anywhere, and it is 0 for a fully used panel. */
      waste: stock > 0
        ? mm(Math.max(0, stock - entry.cut.width - (entry.offcut ? entry.offcut.width : 0)))
        : 0
    }))
    .sort((a, b) => a.cut.row - b.cut.row || a.id.localeCompare(b.id));

  const count = kind => rows.reduce(
    (total, row) => total + row.pieces.filter(p => p.kind === kind).length, 0);

  const gaps = rows.flatMap(row => row.pieces.filter(p => p.kind === KINDS.gap));

  return {
    system: {
      id: layout && layout.id ? layout.id : null,
      title: layout && layout.title ? layout.title : null
    },
    surface: {
      width: mm(meta.surfaceW || (sh && sh.W) || 0),
      height: mm(meta.surfaceH || (sh && sh.H) || 0),
      direction: meta.direction || (sh && sh.direction) || null
    },
    material: {
      // Named as the fields are labelled on the page, so a reader can check the
      // sheet against the controls without translating.
      width: mm(meta.PLa || (sh && sh.PLa) || 0),
      length: stock
    },
    totals: {
      full: count(KINDS.full),
      cut: count(KINDS.cut),
      offcut: count(KINDS.offcut),
      edge: count(KINDS.edge),
      /* Stock panels to buy: every full panel placed, plus one per panel that
         had to be cut. An offcut is NOT bought — it is the other half of a
         panel already counted, and adding it is the double-count that turns a
         material order into an over-order. */
      panelsToBuy: count(KINDS.full) + panels.length
    },
    /* A gap is a hole the layout could not fill, and it prints. A cut list that
       quietly omitted them is a plan that does not fit the surface, carried to
       a saw by somebody who had no way to know. */
    gaps: {
      count: gaps.length,
      width: mm(gaps.reduce((total, piece) => total + piece.width, 0))
    },
    rows,
    panels
  };
}

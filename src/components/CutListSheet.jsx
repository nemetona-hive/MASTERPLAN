import { React, ReactDOM } from "../react-globals.js";
import { getBuildId } from "../shared.jsx";

/**
 * The cut list as a printed document.
 *
 * There is no PDF library here and there should not be one: the browser's own
 * "Save as PDF" is the print dialog, so a PDF export IS a print stylesheet plus
 * `window.print()`. A bundled writer would cost more than the whole app —
 * jsPDF alone is over the 250 KiB budget `components.js` is held to — to
 * reproduce something every platform already does, with worse font handling.
 * MONEYFLOW reached the same conclusion and ships no PDF dependency either.
 *
 * PORTALLED TO <body>, and that is what makes the print rule simple: the sheet
 * becomes a sibling of the app shell rather than a descendant, so print can
 * hide everything else with `body > *:not(.doc-sheet)` — by position rather
 * than by name, which keeps working when the shell gains another wrapper.
 *
 * Hidden on screen at all times. The page behind the dialog stays exactly as it
 * was; nothing about asking for a document should rearrange what you were
 * looking at.
 *
 * It renders from the model in `utils/cut-list.js` and derives nothing of its
 * own — every figure here was computed once, so a second renderer cannot
 * disagree with this one. Formatting is the exception, and belongs here: the
 * model holds numbers.
 */

const KIND_LABEL = {
  full: "Full",
  cut: "Cut",
  offcut: "Offcut",
  edge: "Edge",
  gap: "Gap"
};

/* The model has already rounded to a tenth, so `String` is the whole of the
   formatting: 800 prints as "800" and 800.5 as "800.5". Written as a named
   helper rather than inlined because it is the seam where a unit or a locale
   would go, and there are a dozen call sites below. */
const mm = value => String(value);

function PieceRun({ pieces }) {
  return (
    <span className="cut-run">
      {pieces.map((piece, i) => (
        <span key={i} className={`cut-piece cut-piece--${piece.kind}`}>
          {mm(piece.width)}
          {piece.panel && <span className="cut-ref">{piece.panel}</span>}
          {piece.kind === "gap" && <span className="cut-ref">gap</span>}
        </span>
      ))}
    </span>
  );
}

export function CutListSheet({ list }) {
  if (!list) return null;

  const { surface, material, system, totals, gaps, panels, rows } = list;
  const printed = new Date().toLocaleDateString("en-GB",
    { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();

  return ReactDOM.createPortal(
    <div className="doc-sheet">
      <header className="doc-sheet-head">
        <div>
          <h1 className="doc-sheet-title">Cut list</h1>
          <p className="doc-sheet-sub">
            {/* SYSTEMS titles already end in "layout" (config.js), so this
                takes them as they are rather than appending the word twice. */}
            {system.title || "Layout"} ·{" "}
            {mm(surface.width)} × {mm(surface.height)} mm ·{" "}
            {surface.direction === "V" ? "vertical" : "horizontal"}
          </p>
        </div>
        <div className="doc-sheet-stamp">
          <div>{printed}</div>
          {build && <div>build {build}</div>}
        </div>
      </header>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Material</h2>
        <dl className="doc-sheet-facts">
          <div><dt>Piece</dt><dd>{mm(material.length)} × {mm(material.width)} mm</dd></div>
          <div><dt>Whole panels</dt><dd>{totals.full}</dd></div>
          <div><dt>Panels to cut</dt><dd>{panels.length}</dd></div>
          {/* The figure somebody orders against. An offcut is deliberately not
              in it: it is the other half of a panel already counted. */}
          <div className="doc-sheet-fact--lead">
            <dt>Panels to buy</dt><dd>{totals.panelsToBuy}</dd>
          </div>
        </dl>
        {gaps.count > 0 && (
          <p className="doc-sheet-warn">
            This layout leaves {gaps.count} {gaps.count === 1 ? "gap" : "gaps"} totalling{" "}
            {mm(gaps.width)} mm. It does not fill the surface — check the minimum joint
            before cutting to it.
          </p>
        )}
      </section>

      {panels.length > 0 && (
        <section className="doc-sheet-block">
          <h2 className="doc-sheet-h2">Cuts</h2>
          <p className="doc-sheet-note">
            One row per panel that has to be cut. Where a panel shows two pieces, both come
            out of the same {mm(material.length)} mm panel — cut it once and keep the
            remainder for the row named beside it.
          </p>
          <table className="doc-sheet-table">
            <thead>
              <tr>
                <th>Panel</th><th>Cut to</th><th>Goes in</th>
                <th>Remainder</th><th>Goes in</th><th>Waste</th>
              </tr>
            </thead>
            <tbody>
              {panels.map(panel => (
                <tr key={panel.id}>
                  <td className="cut-ref-cell">{panel.id}</td>
                  <td>{mm(panel.cut.width)}</td>
                  <td>Row {panel.cut.row}</td>
                  <td>{panel.offcut ? mm(panel.offcut.width) : "—"}</td>
                  <td>{panel.offcut ? `Row ${panel.offcut.row}` : "—"}</td>
                  <td>{panel.waste > 0 ? mm(panel.waste) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Rows</h2>
        <p className="doc-sheet-note">
          Pieces in the order they are laid, left to right. A letter marks a piece that
          comes from a cut panel in the table above.
        </p>
        <table className="doc-sheet-table cut-table--rows">
          <thead>
            <tr><th>Row</th><th>Pieces</th></tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.number}>
                <td className="cut-ref-cell">{row.number}</td>
                <td><PieceRun pieces={row.pieces} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="doc-sheet-legend">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} className={`cut-piece cut-piece--${kind}`}>{label}</span>
          ))}
        </p>
      </section>
    </div>,
    document.body
  );
}

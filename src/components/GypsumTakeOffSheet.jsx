import { ReactDOM } from "../react-globals.js";
import { getBuildId } from "../shared.jsx";

/**
 * The gypsum take-off as a printed document.
 *
 * Renders from `utils/gypsum-take-off.js` and derives nothing of its own, so
 * the sheet count on paper is the one under the diagram on screen. Same chrome
 * as the concrete take-off — `.doc-sheet*` in `99-print.css`, portalled to
 * `<body>` so print can hide the app by position.
 */

const nf = (value, places = 0) =>
  Number(value).toLocaleString("en-GB", { minimumFractionDigits: places, maximumFractionDigits: places });
const mm = value =>
  Number(value).toLocaleString("et-EE", { useGrouping: false, maximumFractionDigits: 1 });
const eur = value =>
  Number(value).toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function GypsumTakeOffSheet({ takeOff }) {
  if (!takeOff || !takeOff.ready) return null;

  const { area, sheet, surfaces, sheets, screws, compound, tape, product, layers, orientation, openings } = takeOff;
  const printed = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();

  return ReactDOM.createPortal(
    <div className="doc-sheet">
      <header className="doc-sheet-head">
        <div>
          <h1 className="doc-sheet-title">Gypsum take-off</h1>
          <p className="doc-sheet-sub">
            {nf(area.net, 2)} m² net · {mm(sheet.width)} × {mm(sheet.length)} mm
            {product ? ` · ${product}` : ""}
          </p>
        </div>
        <div className="doc-sheet-stamp">
          <div>{printed}</div>
          {build && <div>build {build}</div>}
        </div>
      </header>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Surfaces</h2>
        <table className="doc-sheet-table">
          <thead>
            <tr><th>Surface</th><th>Size</th><th>Qty</th><th>Area</th><th>Full</th><th>Cut</th></tr>
          </thead>
          <tbody>
            {surfaces.map(s => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>{mm(s.width)} × {mm(s.height)} mm</td>
                <td>{s.count}</td>
                <td>{nf(s.area, 2)} m²</td>
                <td>{s.layout ? s.layout.full * s.count : "—"}</td>
                <td>{s.layout ? s.layout.cut * s.count : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="doc-sheet-facts">
          <div><dt>Surface area</dt><dd>{nf(area.gross, 2)} m²</dd></div>
          {area.openings > 0 && (
            <div>
              <dt>Openings</dt>
              <dd>
                −{nf(area.openings, 2)} m²
                <span className="doc-sheet-from">
                  {" "}{openings.doors} door{openings.doors === 1 ? "" : "s"}, {openings.windows} window{openings.windows === 1 ? "" : "s"}
                </span>
              </dd>
            </div>
          )}
          <div className="doc-sheet-fact--lead"><dt>Net area</dt><dd>{nf(area.net, 2)} m²</dd></div>
          <div><dt>Fixing</dt><dd>{orientation === "V" ? "Vertical" : "Horizontal"}, {layers} layer{layers === 1 ? "" : "s"}</dd></div>
        </dl>
      </section>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Order</h2>
        <table className="doc-sheet-table doc-sheet-table--order">
          <thead>
            <tr><th>Item</th><th>Needs</th><th>To buy</th>{sheets.price && <><th>Price</th><th>Total</th></>}</tr>
          </thead>
          <tbody>
            <tr>
              <td>Board {mm(sheet.width)} × {mm(sheet.length)}</td>
              <td>{sheets.layout} from layout, +{nf(sheets.waste)}%</td>
              <td className="doc-sheet-strong">{sheets.toBuy} sheets</td>
              {sheets.price && <><td>€{eur(sheets.price)}</td><td className="doc-sheet-strong">€{eur(sheets.total)}</td></>}
            </tr>
            {screws.rate !== null && (
              <tr>
                <td>Screws</td>
                <td>{nf(screws.rate, 1)} /m²</td>
                <td className="doc-sheet-strong">{nf(screws.count)} pcs</td>
                {sheets.price && <><td /><td /></>}
              </tr>
            )}
            {compound.rate !== null && (
              <tr>
                <td>Joint compound</td>
                <td>{nf(compound.kg, 1)} kg</td>
                <td className="doc-sheet-strong">{compound.bagKg ? `${compound.bags} × ${nf(compound.bagKg)} kg` : `${nf(compound.kg, 1)} kg`}</td>
                {sheets.price && <><td /><td /></>}
              </tr>
            )}
            <tr>
              <td>Joint tape</td>
              <td>{nf(tape.joints, 1)} m joints{tape.corners > 0 ? ` + ${nf(tape.corners, 1)} m corners` : ""}</td>
              <td className="doc-sheet-strong">{nf(tape.total, 1)} m</td>
              {sheets.price && <><td /><td /></>}
            </tr>
          </tbody>
        </table>
        <p className="doc-sheet-note">
          Sheets are counted from the layout with offcuts reused, so waste covers breakage rather
          than cutting. Openings reduce screws and compound but not sheets: boards are hung whole
          and cut out. The price covers board only.
        </p>
      </section>
    </div>,
    document.body
  );
}

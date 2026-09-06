import { React, ReactDOM } from "../react-globals.js";
import { getBuildId } from "../shared.jsx";

/**
 * The concrete take-off as a printed document.
 *
 * The second consumer of the one-model-many-renderers rule, and the reason the
 * rule earns its cost: it renders from `utils/take-off.js` and derives nothing
 * of its own, so the sheet and the screen cannot disagree about how many bags
 * somebody buys.
 *
 * Same chrome as the cut list — `.doc-sheet*` in `99-print.css`, portalled to
 * `<body>` so print can hide the app by position. Only one document is ever
 * mounted, because only one page is routed at a time.
 */

const nf = (value, places = 0) =>
  Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: places, maximumFractionDigits: places
  });

/* Euros in the app's own locale, matching the figure the page shows beside the
   button somebody pressed to get here. */
const eur = value =>
  Number(value).toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TakeOffSheet({ takeOff }) {
  if (!takeOff || !takeOff.ready) return null;

  const { area, thickness, volume, mass, bags, product } = takeOff;
  const printed = new Date().toLocaleDateString("en-GB",
    { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();

  return ReactDOM.createPortal(
    <div className="doc-sheet">
      <header className="doc-sheet-head">
        <div>
          <h1 className="doc-sheet-title">Concrete take-off</h1>
          <p className="doc-sheet-sub">
            {nf(area.value, 2)} m² · {nf(thickness.average, 1)} mm
            {thickness.mode === "corners" ? " average" : ""}
            {product.name ? ` · ${product.name}` : ""}
          </p>
        </div>
        <div className="doc-sheet-stamp">
          <div>{printed}</div>
          {build && <div>build {build}</div>}
        </div>
      </header>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">The pour</h2>
        <dl className="doc-sheet-facts">
          <div>
            <dt>Area</dt>
            <dd>
              {nf(area.value, 2)} m²
              {area.mode === "dims" && area.length && area.width && (
                <span className="doc-sheet-from"> from {nf(area.length)} × {nf(area.width)} mm</span>
              )}
            </dd>
          </div>
          <div><dt>Thickness</dt><dd>{nf(thickness.average, 1)} mm</dd></div>
          {/* The figure the corner mode exists for: an average alone cannot say
              a slab falls 40mm across its length. */}
          {thickness.difference !== null && (
            <div><dt>Fall</dt><dd>{nf(thickness.difference, 1)} mm</dd></div>
          )}
          <div className="doc-sheet-fact--lead"><dt>Volume</dt><dd>{nf(volume, 3)} m³</dd></div>
        </dl>

        {thickness.corners && (
          <p className="doc-sheet-note">
            Corners: {thickness.corners.map(c => `${nf(c)} mm`).join(" · ")}. The volume uses
            their average; the fall is what the average cannot tell you.
          </p>
        )}
      </section>

      {product.rate ? (
        <section className="doc-sheet-block">
          <h2 className="doc-sheet-h2">Material</h2>
          <dl className="doc-sheet-facts">
            {product.name && <div><dt>Product</dt><dd>{product.name}</dd></div>}
            <div><dt>Consumption</dt><dd>{nf(product.rate, 2)} kg/m²·mm</dd></div>
            <div><dt>Total mix</dt><dd>{nf(mass, 1)} kg</dd></div>
            {bags.weight && <div><dt>Bag</dt><dd>{nf(bags.weight)} kg</dd></div>}
          </dl>

          {bags.toBuy > 0 && (
            <>
              <table className="doc-sheet-table doc-sheet-table--order">
                <thead>
                  <tr><th>The pour needs</th><th>Bags to buy</th>
                    {bags.price && <><th>Bag price</th><th>Total</th></>}</tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{nf(bags.exact, 2)} bags</td>
                    <td className="doc-sheet-strong">{nf(bags.toBuy)}</td>
                    {bags.price && <>
                      <td>€{eur(bags.price)}</td>
                      <td className="doc-sheet-strong">€{eur(bags.total)}</td>
                    </>}
                  </tr>
                </tbody>
              </table>
              <p className="doc-sheet-note">
                Both figures are here on purpose. The first is what the pour consumes; the
                second is what leaves the merchant, rounded up because a part bag cannot be
                bought{bags.price ? " — and it is the one the total is priced on" : ""}.
              </p>
            </>
          )}
        </section>
      ) : (
        <section className="doc-sheet-block">
          <h2 className="doc-sheet-h2">Material</h2>
          <p className="doc-sheet-note">
            No product chosen, so this sheet states the volume only — which is the figure
            a ready-mix order is placed on.
          </p>
        </section>
      )}
    </div>,
    document.body
  );
}

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

/* One surface as drawn on paper: the model's piece rectangles in surface
   millimetres, scaled by the viewBox. Ink and stroke come from 99-print.css,
   because this is never seen on screen. Labels are the model's cut lengths,
   shown only where they fit inside their piece. */
function SurfaceDrawing({ surface, orientation, widest }) {
  const { width: w, height: h, layout, label, count } = surface;
  /* Text height in surface mm, one size for every drawing so they read alike;
     the widest surface sets it, since every drawing shares its scale. */
  const fs = widest / 32;
  return (
    <figure className="gyp-print-figure">
      <figcaption className="gyp-print-caption">
        <strong>{label}</strong>
        {" "}{mm(w)} × {mm(h)} mm · {layout.full} full, {layout.cut} cut{count > 1 ? " each" : ""}
      </figcaption>
      {/* Every surface on one scale: the widest fills its column and the rest
          are drawn in proportion, so a short wall looks short. */}
      <svg className="gyp-print-svg" style={{ width: `${(w / widest) * 100}%` }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMinYMin meet"
        role="img" aria-label={`${label}: ${layout.full} full and ${layout.cut} cut pieces, ${orientation === "V" ? "vertical" : "horizontal"} fixing`}>
        {layout.pieces.map((p, i) => {
          // Horizontal text: needs about four digits of width, one line of height,
          // and not under an opening, whose own label sits in its middle.
          // The label's box — about four digits wide, one line high — not its
          // centre: a label centred just outside an opening still runs into it.
          const cx = p.x + p.w / 2, cy = p.y + p.h / 2, hw = fs * 1.4, hh = fs * 0.7;
          const underOpening = (surface.openings || []).some(o =>
            cx + hw > o.x && cx - hw < o.x + o.w && cy + hh > o.y && cy - hh < o.y + o.h);
          const fits = p.w > fs * 2.6 && p.h > fs * 1.3 && !underOpening;
          return (
            <g key={i}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} className={`gyp-print-piece gyp-print-piece--${p.type}`} />
              {fits && (
                <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize={fs} textAnchor="middle"
                  dominantBaseline="central" className="gyp-print-label">{p.label ?? mm(p.len)}</text>
              )}
            </g>
          );
        })}
        {(surface.openings || []).map(o => (
          <g key={o.label}>
            <rect x={o.x} y={o.y} width={o.w} height={o.h} className="gyp-print-opening" />
            <text x={o.x + o.w / 2} y={o.y + o.h / 2} fontSize={fs} textAnchor="middle"
              dominantBaseline="central" className="gyp-print-label gyp-print-label--opening">{o.label}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/* One room's document, without the page around it: the room sheet prints it
   alone, the project sheet once per finished room. */
function RoomTakeOff({ takeOff, title, projectName }) {
  const { area, sheet, surfaces, sheets, screws, compound, tape, product, layers, orientation, openings, fixing, adhesive } = takeOff;
  const printed = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();
  const drawn = surfaces.filter(s => s.layout);
  const widest = Math.max(...drawn.map(s => s.width));

  return (
    <>
      <header className="doc-sheet-head">
        <div>
          <h1 className="doc-sheet-title">Gypsum take-off{title ? ` — ${title}` : ""}</h1>
          <p className="doc-sheet-sub">
            {projectName ? `${projectName} · ` : ""}{nf(area.net, 2)} m² net · {mm(sheet.width)} × {mm(sheet.length)} mm
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
          <div><dt>Fixing</dt><dd>{fixing === "glue" ? "Glued walls" : "Screwed"}, {orientation === "V" ? "vertical" : "horizontal"}, {layers} layer{layers === 1 ? "" : "s"}{takeOff.firstOffset ? `, first panel ${mm(takeOff.firstOffset)} mm from the corner` : ""}</dd></div>
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
            {adhesive && adhesive.rate !== null && (
              <tr>
                <td>Adhesive{adhesive.product ? ` — ${adhesive.product}` : ""}</td>
                <td>{nf(adhesive.kg, 1)} kg</td>
                <td className="doc-sheet-strong">{adhesive.bagKg ? `${adhesive.bags} × ${nf(adhesive.bagKg)} kg` : `${nf(adhesive.kg, 1)} kg`}</td>
                {sheets.price && <><td /><td /></>}
              </tr>
            )}
            {screws.rate !== null && screws.area > 0 && (
              <tr>
                <td>{fixing === "glue" ? "Ceiling screws" : "Screws"}</td>
                <td>{nf(screws.rate, 1)} /m²</td>
                <td className="doc-sheet-strong">{nf(screws.count)} pcs</td>
                {sheets.price && <><td /><td /></>}
              </tr>
            )}
            {(compound.rate !== null || compound.skim) && (
              <tr>
                <td>Joint filler{compound.product ? ` — ${compound.product}` : ""}</td>
                <td>
                  {compound.rate !== null && <>{nf(compound.length, 1)} m joint × {nf(compound.rate, 2)} kg/m{compound.rateDerived ? " (from per-mm rate)" : ""}</>}
                  {compound.skim && <>{compound.rate !== null ? " + " : ""}{nf(compound.skim.mm, 1)} mm skim on {nf(compound.skim.area, 2)} m² × {nf(compound.perMm, 2)} kg/m²·mm</>}
                  {" "}= {nf(compound.kg, 1)} kg
                </td>
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
          than cutting. Openings reduce screws. Joint filler is per metre of joint, corners included. A placed opening also removes any
          piece lying wholly inside it; a piece it only crosses is hung whole and cut out. The
          price covers board only.{fixing === "glue" ? " Glued walls are stuck in dabs onto masonry, one layer; an uneven wall takes more adhesive, and a ceiling is screwed." : ""}
        </p>
      </section>
      <section className="doc-sheet-block doc-sheet-block--table">
        <h2 className="doc-sheet-h2">Layout</h2>
        <p className="doc-sheet-legend">
          <span><span className="gyp-print-key gyp-print-key--full" /> full sheet</span>
          <span><span className="gyp-print-key gyp-print-key--cut" /> cut piece — figure is its cut length, mm</span>
        </p>
        <div className="gyp-print-grid">
          {drawn.map(s => <SurfaceDrawing key={s.id} surface={s} orientation={orientation} widest={widest} />)}
        </div>
      </section>
    </>
  );
}

export function GypsumTakeOffSheet({ takeOff, title = "", projectName = "" }) {
  if (!takeOff || !takeOff.ready) return null;
  return ReactDOM.createPortal(
    <div className="doc-sheet">
      <RoomTakeOff takeOff={takeOff} title={title} projectName={projectName} />
    </div>,
    document.body
  );
}

const boardName = b => `${b.product ? `${b.product} ` : "Board "}${mm(b.width)} × ${mm(b.length)}`;
const baggedNeed = g => g.bagKg ? `${g.bags} × ${nf(g.bagKg)} kg` : `${nf(g.kg, 1)} kg`;

/**
 * Every room of the job on paper: the order for all of them first — what a
 * merchant is read — then each finished room's own sheet, one after the
 * other, each starting on a new page. All of it from
 * `buildGypsumProjectTakeOff` and the rooms' own take-offs.
 */
export function GypsumProjectSheet({ project, entries, projectName = "" }) {
  if (!project || !project.ready || !entries) return null;
  const printed = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();
  const priced = project.boards.some(b => b.price);
  const blank = priced ? <><td /><td /></> : null;
  const left = project.rooms.filter(r => !r.ready);

  return ReactDOM.createPortal(
    <div className="doc-sheet">
      <header className="doc-sheet-head">
        <div>
          <h1 className="doc-sheet-title">Gypsum take-off{projectName ? ` — ${projectName}` : ""}</h1>
          <p className="doc-sheet-sub">
            {project.readyCount} {project.readyCount === 1 ? "surface" : "rooms and walls"} · {nf(project.area.net, 2)} m² net
          </p>
        </div>
        <div className="doc-sheet-stamp">
          <div>{printed}</div>
          {build && <div>build {build}</div>}
        </div>
      </header>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Rooms</h2>
        <table className="doc-sheet-table">
          <thead>
            <tr><th>Room</th><th>Board</th><th>Net area</th><th>Sheets</th>{priced && <th>Total</th>}</tr>
          </thead>
          <tbody>
            {project.rooms.filter(r => r.ready).map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.product ? `${r.product}, ` : ""}{mm(r.sheet.width)} × {mm(r.sheet.length)}</td>
                <td>{nf(r.net, 2)} m²</td>
                <td>{r.sheets}</td>
                {priced && <td>{r.total !== null ? `€${eur(r.total)}` : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {left.length > 0 && (
          <p className="doc-sheet-warn">
            Not included, not finished: {left.map(r => r.name).join(", ")}.
          </p>
        )}
      </section>

      <section className="doc-sheet-block">
        <h2 className="doc-sheet-h2">Order</h2>
        <table className="doc-sheet-table doc-sheet-table--order">
          <thead>
            <tr><th>Item</th><th>Needs</th><th>To buy</th>{priced && <><th>Price</th><th>Total</th></>}</tr>
          </thead>
          <tbody>
            {project.boards.map(b => (
              <tr key={`${b.product}|${b.width}|${b.length}|${b.price}`}>
                <td>{boardName(b)}</td>
                <td>{nf(b.exact, 1)} with waste, {b.rooms.join(", ")}</td>
                <td className="doc-sheet-strong">{b.toBuy} sheets</td>
                {priced && <><td>{b.price ? `€${eur(b.price)}` : "—"}</td><td className="doc-sheet-strong">{b.total !== null ? `€${eur(b.total)}` : "—"}</td></>}
              </tr>
            ))}
            {project.adhesive.map(a => (
              <tr key={`a|${a.product}|${a.bagKg}`}>
                <td>Adhesive{a.product ? ` — ${a.product}` : ""}</td>
                <td>{nf(a.kg, 1)} kg</td>
                <td className="doc-sheet-strong">{baggedNeed(a)}</td>
                {blank}
              </tr>
            ))}
            {project.screws.count > 0 && (
              <tr>
                <td>Screws</td>
                <td />
                <td className="doc-sheet-strong">{nf(project.screws.count)} pcs</td>
                {blank}
              </tr>
            )}
            {project.filler.map(f => (
              <tr key={`f|${f.product}|${f.bagKg}`}>
                <td>Joint filler{f.product ? ` — ${f.product}` : ""}</td>
                <td>{nf(f.kg, 1)} kg</td>
                <td className="doc-sheet-strong">{baggedNeed(f)}</td>
                {blank}
              </tr>
            ))}
            <tr>
              <td>Joint tape</td>
              <td />
              <td className="doc-sheet-strong">{nf(project.tape.total, 1)} m</td>
              {blank}
            </tr>
          </tbody>
        </table>
        {project.cost && (
          <dl className="doc-sheet-facts">
            <div className="doc-sheet-fact--lead"><dt>Board cost{project.cost.partial ? " (priced boards only)" : ""}</dt><dd>€{eur(project.cost.total)}</dd></div>
          </dl>
        )}
        <p className="doc-sheet-note">
          Sheets add every room&apos;s count with its waste, then round up once; offcuts are not carried
          between rooms. Bags are rounded up from the total weight. Each room&apos;s own sheet follows.
        </p>
      </section>

      {entries.filter(e => e.takeOff.ready).map(e => (
        <div key={e.id} className="gyp-print-room">
          <RoomTakeOff takeOff={e.takeOff} title={e.name} projectName={projectName} />
        </div>
      ))}
    </div>,
    document.body
  );
}

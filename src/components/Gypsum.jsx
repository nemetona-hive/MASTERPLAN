import { useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { ControlPanel, Icon, NumInput, Row, Stack, useTimedState } from "../shared.jsx";
import { LIBRARIES, ManagePresetsButton, PresetField, PresetManager, libraryFields, presetHeader, usePresetLibrary } from "./GypsumPresets.jsx";
import { LayoutVisualization } from "../Visualization.jsx";
import { GypsumTakeOffSheet } from "./GypsumTakeOffSheet.jsx";
import { GypsumRoom3D } from "./GypsumRoom3D.jsx";
import { buildGypsumTakeOff, WALLS } from "../utils/gypsum-take-off.js";

// ── Gypsum board estimator ────────────────────────────────────────────────────

const KEY = name => `Gypsum.jsx:${name}`;
/* Every product field, across the board, filler and adhesive libraries. */
const PRODUCT_FIELDS = Object.values(LIBRARIES).flatMap(libraryFields);

/* Fields that begin empty, and those that begin at a sensible value. Opening
   sizes are standard enough to prefill; job dimensions never are. */
const EMPTY = ["lenMm", "widMm", "heightMm", "wallW", "wallH", ...PRODUCT_FIELDS];
const PREFILLED = { waste: "5" };
/* A new opening starts at a common size; its position starts empty, and an
   opening with no position still comes off the area — it is just not drawn. */
const NEW_OPENING = {
  door: { kind: "door", wall: "A", x: "", w: "900", h: "2100" },
  window: { kind: "window", wall: "A", x: "", w: "1200", h: "1200", sill: "900" }
};

function Seg({ value, options, onChange, label, inline = false }) {
  return (
    <div className={"seg-group" + (inline ? " seg-group--inline" : "")} role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" className={"ctrl-dir" + (value === id ? " on" : "")}
          aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

export function SheetGypsum() {
  const [mode, setMode] = useSessionState(KEY("mode"), "room");               // "room" | "wall"
  const [ceiling, setCeiling] = useSessionState(KEY("ceiling"), false);
  const [orientation, setOrientation] = useSessionState(KEY("orientation"), "V");
  const [layers, setLayers] = useSessionState(KEY("layers"), "1");
  const [fixing, setFixing] = useSessionState(KEY("fixing"), "screw");      // "screw" | "glue"
  const glued = fixing === "glue";
  const [view3d, setView3d] = useSessionState(KEY("view3d"), false);

  /* Every typed field in one object, so reset and the model call do not repeat
     the list. A setter per field is derived from it. */
  const initialJob = () => ({ ...Object.fromEntries(EMPTY.map(name => [name, ""])), ...PREFILLED, openings: [] });
  const [job, setJob] = useSessionState(KEY("job"), initialJob);
  const val = name => job[name];
  const set = name => value => setJob(current => ({ ...current, [name]: value }));

  /* Three preset libraries, each filling its own fields (GypsumPresets.jsx). */
  const merge = values => setJob(current => ({ ...current, ...values }));
  const board = usePresetLibrary(LIBRARIES.board, merge);
  const filler = usePresetLibrary(LIBRARIES.filler, merge);
  const adhesive = usePresetLibrary(LIBRARIES.adhesive, merge);
  const libraries = [board, filler, adhesive];
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);

  const resetAll = () => {
    setJob(initialJob());
    setMode("room"); setCeiling(false); setView3d(false); setOrientation("V"); setLayers("1"); setFixing("screw");
    libraries.forEach(library => library.setActive(null));
  };
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    resetAll();
  };

  /* A hand edit of a product field means the values are no longer the
     preset's, so its name stops showing. */
  const productChange = (library, name) => v => { if (v !== val(name)) library.edited(); set(name)(v); };

  // ── Derived values: all of it from the model ───────────────────────────────
  const takeOff = buildGypsumTakeOff({
    ...job, mode, ceiling, orientation, layers, fixing,
    product: board.selected?.name || "",
    fillerProduct: filler.selected?.name || "",
    adhesiveProduct: adhesive.selected?.name || ""
  });
  const { area, sheets, screws, compound, tape } = takeOff;

  const [printTakeOff, setPrintTakeOff] = React.useState(null);
  React.useEffect(() => {
    if (!printTakeOff) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printTakeOff]);
  const fieldKey = JSON.stringify([job, mode, ceiling, orientation, layers, fixing, ...libraries.map(l => [l.active, l.presets])]);
  React.useEffect(() => { setPrintTakeOff(null); }, [fieldKey]);

  const dimsKeys = mode === "room" ? ["lenMm", "widMm", "heightMm"] : ["wallW", "wallH"];
  const hasAnyInput = [...dimsKeys, ...PRODUCT_FIELDS].some(name => val(name) !== "");
  const req = name => hasAnyInput && val(name) === "";
  const fmtEur = n => n.toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openingRows = job.openings || [];
  const setOpenings = update => setJob(current => ({ ...current, openings: update(current.openings || []) }));
  const addOpening = kind => setOpenings(list =>
    [...list, { ...NEW_OPENING[kind], id: list.reduce((m, o) => Math.max(m, o.id), 0) + 1 }]);
  const updateOpening = (id, key, value) => setOpenings(list => list.map(o => (o.id === id ? { ...o, [key]: value } : o)));
  const removeOpening = id => setOpenings(list => list.filter(o => o.id !== id));

  const num = (name, label, extra = {}) => (
    <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={0} onChange={set(name)} req={extra.req ?? false} {...extra} />
  );

  /* Pattern Layouts' shape: the inputs in the fixed control column, and the
     results, layout views and reference tables across the rest of the width,
     so the 2D and 3D views get the room. Inside the preview, a layout-split
     with one column keeps the result card's mobile bottom bar (the split's
     second child), which the desktop shows first instead. */
  return (
    <>
      <Stack id="data-control" className="data-control gyp-control" gap={4}>
        <ControlPanel id="control-gyp-surface" title="Surface" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
            <Seg label="What to board" value={mode} onChange={setMode}
              options={[["room", "Room"], ["wall", "Single wall"]]} />
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              {mode === "room" ? <>
                {num("lenMm", "Length (mm)", { min: 1, req: req("lenMm") })}
                {num("widMm", "Width (mm)", { min: 1, req: req("widMm") })}
              </> : <>
                {num("wallW", "Width (mm)", { min: 1, req: req("wallW") })}
                {num("wallH", "Height (mm)", { min: 1, req: req("wallH") })}
              </>}
            </div>
            {mode === "room" && <>
              <Seg label="Ceiling" value={ceiling ? "on" : "off"} onChange={v => setCeiling(v === "on")}
                options={[["off", "Walls only"], ["on", "Walls + ceiling"]]} />
              {num("heightMm", "Wall height (mm)", { min: 1, req: req("heightMm") })}
            </>}
          </Stack>
        </ControlPanel>

        <ControlPanel id="control-gyp-openings" title="Openings (mm)" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
          {openingRows.map((o, i) => {
            const read = takeOff.openings.list[i];
            const field = (key, label) => (
              <div className="gyp-open-field">
                <label className="gyp-open-lbl" htmlFor={`gyp-open-${o.id}-${key}`}>{label}</label>
                <input id={`gyp-open-${o.id}-${key}`} type="text" inputMode="decimal" autoComplete="off"
                  className="num-input" value={o[key] ?? ""}
                  aria-invalid={read?.status === "misfit" || read?.status === "invalid" ? true : undefined}
                  onChange={e => updateOpening(o.id, key, e.target.value)} />
              </div>
            );
            return (
              <div key={o.id} className="gyp-open-row">
                <span className="gyp-open-tag">{read?.label}</span>
                {mode === "room" && (
                  <Seg inline label={`${read?.label} wall`} value={o.wall} onChange={v => updateOpening(o.id, "wall", v)}
                    options={WALLS.map(w => [w, w])} />
                )}
                <button type="button" className="num-btn ctl-ghost ctl-sm ctl-icon ctl-danger gyp-open-del"
                  aria-label={`Remove ${read?.label}`} title={`Remove ${read?.label}`}
                  onClick={() => removeOpening(o.id)}>
                  <Icon name="close" />
                </button>
                <div className="gyp-open-fields">
                  {field("x", "From left")}
                  {field("w", "Width")}
                  {field("h", "Height")}
                  {o.kind === "window" ? field("sill", "Sill") : <div className="gyp-open-field" />}
                </div>
              </div>
            );
          })}
          <Stack direction="row" gap={2}>
            <button type="button" className="ctrl-dir" onClick={() => addOpening("door")}>
              <Icon name="plus" /> Door
            </button>
            <button type="button" className="ctrl-dir" onClick={() => addOpening("window")}>
              <Icon name="plus" /> Window
            </button>
          </Stack>
          </Stack>
        </ControlPanel>

        <ControlPanel id="control-gyp-board" title="Board" noToggle className="form-section-card"
          headerDetail={presetHeader(board)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={board} field="sheetW" id="input-gyp-sheetW" label="Sheet width (mm)" labelIcon="arrow-h"
              value={val("sheetW")} min={100} onChange={productChange(board, "sheetW")} req={req("sheetW")} />
            <PresetField library={board} field="sheetL" id="input-gyp-sheetL" label="Sheet length (mm)" labelIcon="arrow-v"
              value={val("sheetL")} min={100} onChange={productChange(board, "sheetL")} req={req("sheetL")} />
            <Seg label="Fixing direction" value={orientation} onChange={setOrientation}
              options={[["V", "Vertical"], ["H", "Horizontal"]]} />
            {/* Glued is one layer on walls; the model enforces it, so the choice
                is not offered rather than offered and ignored. */}
            <Seg label="Fixing method" value={fixing} onChange={setFixing}
              options={[["screw", "Screwed"], ["glue", "Glued"]]} />
            {!glued && (
              <Seg label="Layers" value={layers} onChange={setLayers}
                options={[["1", "1 layer"], ["2", "2 layers"]]} />
            )}
            {/* Glued walls take no screws; a boarded ceiling still does. */}
            {(!glued || (mode === "room" && ceiling)) && (
              <div className={board.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-screwRate" label={glued ? "Ceiling screws (pcs/m²)" : "Screws (pcs/m²)"}
                  value={val("screwRate")} min={0} onChange={productChange(board, "screwRate")} />
              </div>
            )}
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              <div className={board.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-sheetPrice" label="Sheet price (€)" value={val("sheetPrice")} min={0} onChange={productChange(board, "sheetPrice")} />
              </div>
              {num("waste", "Waste (%)", { max: 100 })}
            </div>
            <ManagePresetsButton library={board} />
          </Stack>
        </ControlPanel>
        {board.error && !board.managing && <p role="alert" className="input-error">{board.error}</p>}

        {glued && (
          <ControlPanel id="control-gyp-adhesive" title="Adhesive" noToggle className="form-section-card"
            headerDetail={presetHeader(adhesive)}>
            <Stack gap={3} className="ctrl-list">
              <PresetField library={adhesive} field="adhesiveRate" id="input-gyp-adhesiveRate" label="Adhesive (kg/m²)"
                value={val("adhesiveRate")} onChange={productChange(adhesive, "adhesiveRate")} />
              <div className={adhesive.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-adhesiveBagKg" label="Adhesive bag (kg)" value={val("adhesiveBagKg")} min={0.1}
                  onChange={productChange(adhesive, "adhesiveBagKg")} />
              </div>
              <ManagePresetsButton library={adhesive} />
            </Stack>
          </ControlPanel>
        )}
        {glued && adhesive.error && !adhesive.managing && <p role="alert" className="input-error">{adhesive.error}</p>}

        <ControlPanel id="control-gyp-filler" title="Joint Filler" noToggle className="form-section-card"
          headerDetail={presetHeader(filler)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={filler} field="compoundRate" id="input-gyp-compoundRate" label="Joint filler (kg/m of joint)"
              value={val("compoundRate")} onChange={productChange(filler, "compoundRate")} />
            <div className={filler.fieldFlash ? "num-input-flash" : ""}>
              <NumInput id="input-gyp-bagKg" label="Filler bag (kg)" value={val("bagKg")} min={0.1} onChange={productChange(filler, "bagKg")} />
            </div>
            <ManagePresetsButton library={filler} />
          </Stack>
        </ControlPanel>
        {filler.error && !filler.managing && <p role="alert" className="input-error">{filler.error}</p>}

        <div className="form-action">
          <button onClick={handleReset} onBlur={disarmReset}
            className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
            aria-label={resetArmed ? "Confirm global reset — clears every field" : "Global reset — clears every field, asks first"}>
            <Icon name="refresh-cw" /> {resetArmed ? "Confirm reset?" : "Global Reset"}
          </button>
        </div>
      </Stack>

      <div id="data-preview" className="data-preview gyp-preview" role="region" aria-label="Gypsum results">
        <div className="layout-split gyp-split">
          <Stack gap={5}>
            {!takeOff.ready && hasAnyInput && <p role="status" className="input-error">{takeOff.issue}</p>}
            {takeOff.warning && <p role="status" className="input-error">{takeOff.warning}</p>}

            {/* ── Layout ── */}
            {takeOff.surfaces.some(s => s.layout) && (
              <div className="section unboxed">
                <div className="section-head">
                  <span>Layout</span>
                  <Seg inline label="Layout view" value={view3d ? "3d" : "2d"} onChange={v => setView3d(v === "3d")}
                    options={[["2d", "2D"], ["3d", "3D"]]} />
                </div>
                <div className="section-body">
                  <Stack className="section-pad" gap={4}>
                    {view3d && <GypsumRoom3D room={takeOff.room} surfaces={takeOff.surfaces} />}
                    {!view3d && takeOff.surfaces.filter(s => s.layout).map(s => (
                      <Stack key={s.id} gap={2} className="gyp-surface">
                        <div className="gyp-surface-head">
                          <span className="gyp-surface-name">{s.label}</span>
                          <span className="gyp-surface-meta">
                            {s.layout.full} full · {s.layout.cut} cut{s.count > 1 ? " each" : ""}
                          </span>
                        </div>
                        <LayoutVisualization result={{ ...s.layout, stats: { full: s.layout.full, cut: s.layout.cut } }} maxHeight={460} />
                      </Stack>
                    ))}
                  </Stack>
                </div>
              </div>
            )}

            {/* ── Calculation details ── */}
            <div className="section unboxed">
              <div className="section-head"><span>Calculation Details</span></div>
              <div className="section-body">
                <Stack className="section-pad" gap={1}>
                  <Row label="Surface area" value={area.gross.toFixed(2)} unit="m²" />
                  {area.openings > 0 && <Row label="Openings" value={`−${area.openings.toFixed(2)}`} unit="m²" />}
                  <Row label="Net area" value={area.net.toFixed(2)} unit="m²" />
                  {takeOff.layers > 1 && <Row label="Boarded area (2 layers)" value={area.boarded.toFixed(2)} unit="m²" />}
                  <Row label="Sheets from layout" value={sheets.layout} unit="pcs" />
                  <Row label={`With ${sheets.waste}% waste`} value={sheets.exact.toFixed(1)} unit="pcs" />
                  {(!glued || screws.area > 0) && <Row label={glued ? "Ceiling screws" : "Screws"} value={screws.count} unit="pcs" />}
                  {takeOff.adhesive && <Row label="Adhesive" value={takeOff.adhesive.kg.toFixed(1)} unit="kg" />}
                  {takeOff.adhesive?.bagKg && <Row label={`Adhesive bags (${takeOff.adhesive.bagKg} kg)`} value={takeOff.adhesive.bags} unit="pcs" />}
                  <Row label="Joints filled" value={compound.length.toFixed(1)} unit="m" />
                  <Row label="Joint filler" value={compound.kg.toFixed(1)} unit="kg" />
                  {compound.bagKg && <Row label={`Filler bags (${compound.bagKg} kg)`} value={compound.bags} unit="pcs" />}
                  <Row label="Joint tape" value={tape.total.toFixed(1)} unit="m" />

                  <div className="pw-formula-wrap" style={{ marginTop: "1rem" }}>
                    <span className="pw-formula-text">
                      Sheets are counted from the layout, offcuts reused, then waste added. Openings reduce screws; a placed one also drops any piece wholly inside it. Joint filler is per metre of joint: every board joint (each layer) plus the corners.
                    </span>
                  </div>
                  <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                    <span className="pw-formula-text">
                      Tape covers board joints on the face layer{mode === "room" ? ", internal corners" : ""}{mode === "room" && ceiling ? " and the ceiling angle" : ""}.
                    </span>
                  </div>
                  {glued && (
                    <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                      <span className="pw-formula-text">
                        Glued: boards stuck in dabs straight onto masonry, one layer. Adhesive covers the walls' net area; a ceiling is still screwed. An uneven wall takes more.
                      </span>
                    </div>
                  )}
                </Stack>
              </div>
            </div>
          </Stack>

          <div className="gyp-result-wrap">
            <div className="result-card result-card--concrete gyp-result">
              <div className="result-card-primary">
                <span className="result-card-title">Sheets Needed</span>
                <span className="result-card-value">
                  {sheets.toBuy}
                  <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-reg)", marginLeft: "4px" }}>pcs</span>
                </span>
                <span className="result-card-note">layout: {sheets.layout} · +{sheets.waste}% waste</span>
              </div>
              <div className="result-card-split">
                <span className="result-card-title">Sheet Cost</span>
                <span className="result-card-value">
                  {sheets.total !== null ? (<><span style={{ fontSize: "var(--fs-lg)" }}>€</span><span>{fmtEur(sheets.total)}</span></>) : "—"}
                </span>
              </div>
              <button type="button" className="ts-btn ctl-ghost result-card-print"
                onClick={() => setPrintTakeOff(takeOff)} disabled={!takeOff.ready}
                title={takeOff.ready ? "Take-off sheet — opens the print dialog, where Save as PDF is" : "Enter the surface and sheet size first"}>
                <Icon name="print" /> Take-off
              </button>
            </div>
          </div>
        </div>
      </div>
      {libraries.map(library => <PresetManager key={library.lib.id} library={library} />)}
      <GypsumTakeOffSheet takeOff={printTakeOff} />
    </>
  );
}

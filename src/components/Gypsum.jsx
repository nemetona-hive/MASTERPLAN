import { useSessionState } from "../utils/session-state.js";
import { parseMeasurement } from "../utils/measurements.cjs";
import { React } from "../react-globals.js";
import { ControlPanel, Icon, MaterialPresetDropdown, Modal, NumInput, Row, SaveDefaultsButton, SelectedPresetDetail, Stack, safeSaveStaticDefaults, useClickOutside, useDropdownKeyboard, useTimedState } from "../shared.jsx";
import { LayoutVisualization } from "../Visualization.jsx";
import { GypsumTakeOffSheet } from "./GypsumTakeOffSheet.jsx";
import { GypsumRoom3D } from "./GypsumRoom3D.jsx";
import { buildGypsumTakeOff, WALLS } from "../utils/gypsum-take-off.js";

// ── Gypsum board estimator ────────────────────────────────────────────────────

const KEY = name => `Gypsum.jsx:${name}`;
const PRODUCT_FIELDS = ["sheetW", "sheetL", "screwRate", "compoundRate", "bagKg", "sheetPrice"];
const PRESET_COLUMNS = [
  ["sheetW", "Width mm", "Sheet width"],
  ["sheetL", "Length mm", "Sheet length"],
  ["screwRate", "Screws/m²", "Screws per m²"],
  ["compoundRate", "Filler kg/m²", "Joint filler per m²"],
  ["bagKg", "Filler bag kg", "Filler bag weight"],
  ["sheetPrice", "€ sheet", "Sheet price"]
];
const BLANK_PRESET = { name: "", sheetW: "", sheetL: "", screwRate: "", compoundRate: "", bagKg: "", sheetPrice: "" };

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
  const [view3d, setView3d] = useSessionState(KEY("view3d"), false);

  /* Every typed field in one object, so reset and the model call do not repeat
     the list. A setter per field is derived from it. */
  const initialJob = () => ({ ...Object.fromEntries(EMPTY.map(name => [name, ""])), ...PREFILLED, openings: [] });
  const [job, setJob] = useSessionState(KEY("job"), initialJob);
  const val = name => job[name];
  const set = name => value => setJob(current => ({ ...current, [name]: value }));

  const [presets, setPresets] = useSessionState(KEY("presets"), () =>
    (typeof DEFAULT_GYPSUM_PRESETS !== "undefined" ? DEFAULT_GYPSUM_PRESETS : [BLANK_PRESET]).map(p => ({ ...p })));
  const [activePreset, setActivePreset] = useSessionState(KEY("activePreset"), null);
  const [presetError, setPresetError] = React.useState("");
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);
  const [saveStatus, setSaveStatus] = useTimedState("");
  const [saveError, setSaveError] = React.useState("");
  const [showModal, setShowModal] = React.useState(false);
  const [dropdown, setDropdown] = React.useState(null);   // "sheetW" | "sheetL" | null
  const widthRef = React.useRef(null);
  const lengthRef = React.useRef(null);

  const saveDefaults = async () => {
    setSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("gypsumPresets", presets);
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || String(err));
      setSaveStatus("error");
    }
  };

  const resetAll = () => {
    setJob(initialJob());
    setMode("room"); setCeiling(false); setView3d(false); setOrientation("V"); setLayers("1");
    setActivePreset(null);
  };
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    resetAll();
  };

  const updatePreset = (idx, field, value) => {
    const next = [...presets];
    next[idx] = { ...next[idx], [field]: value };
    setPresets(next);
  };

  const applyPreset = (p, idx) => {
    const values = PRODUCT_FIELDS.map(name => parseMeasurement(p[name]));
    const required = values.slice(0, 5);
    const priceOk = values[5] === null || (Number.isFinite(values[5]) && values[5] >= 0);
    if (!required.every(v => Number.isFinite(v) && v > 0) || !priceOk) {
      setPresetError("Fill in sheet size, screws, joint filler and bag weight before applying this preset.");
      return;
    }
    setPresetError("");
    setJob(current => ({ ...current, ...Object.fromEntries(PRODUCT_FIELDS.map((name, i) => [name, values[i] ?? ""])) }));
    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
  };

  /* A hand edit of a product field means the values are no longer the
     preset's, so its name stops showing. */
  const productChange = name => v => { if (v !== val(name)) setActivePreset(null); set(name)(v); };

  /* The dropdowns list only named presets, as Pattern Layouts' do, in the
     { name, width, length } shape MaterialPresetDropdown reads. */
  const validPresets = presets.filter(p => p.name);
  const dropdownPresets = validPresets.map(p => ({ name: p.name, width: p.sheetW, length: p.sheetL }));
  const selectedPreset = activePreset !== null && presets[activePreset]?.name ? presets[activePreset] : null;
  const activeValid = selectedPreset ? validPresets.indexOf(selectedPreset) : null;
  const pickPreset = idx => {
    const p = validPresets[idx];
    if (p) applyPreset(p, presets.indexOf(p));
    setDropdown(null);
  };
  useClickOutside([widthRef, lengthRef], () => setDropdown(null), dropdown !== null);
  const keyboard = {
    sheetW: useDropdownKeyboard(dropdown === "sheetW" ? validPresets.length : 0, pickPreset, () => setDropdown(null)),
    sheetL: useDropdownKeyboard(dropdown === "sheetL" ? validPresets.length : 0, pickPreset, () => setDropdown(null))
  };


  // ── Derived values: all of it from the model ───────────────────────────────
  const takeOff = buildGypsumTakeOff({
    ...job, mode, ceiling, orientation, layers,
    product: activePreset !== null && presets[activePreset] ? presets[activePreset].name : ""
  });
  const { area, sheets, screws, compound, tape } = takeOff;

  const [printTakeOff, setPrintTakeOff] = React.useState(null);
  React.useEffect(() => {
    if (!printTakeOff) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printTakeOff]);
  const fieldKey = JSON.stringify([job, mode, ceiling, orientation, layers, activePreset, presets]);
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

        {/* Pattern Layouts' preset system: the chosen preset named in the card's
            header, a preset list on both sheet fields, and the table behind
            Manage Presets — which, as there, only appears where Save Defaults
            can write (the local dev server). */}
        <ControlPanel id="control-gyp-board" title="Board" noToggle className="form-section-card"
          headerDetail={selectedPreset && <SelectedPresetDetail preset={{ name: selectedPreset.name, width: selectedPreset.sheetW, length: selectedPreset.sheetL }} />}>
          <Stack gap={3} className="ctrl-list">
            {[["sheetW", "Sheet width (mm)", "arrow-h", widthRef], ["sheetL", "Sheet length (mm)", "arrow-v", lengthRef]].map(([name, label, icon, ref]) => (
              <div key={name} className={fieldFlash ? "num-input-flash" : ""} ref={ref} style={{ position: "relative" }}>
                <NumInput id={`input-gyp-${name}`} label={label} labelIcon={icon} value={val(name)} min={100}
                  onChange={productChange(name)} req={req(name)} showActionLabels
                  presetsOpen={dropdown === name} presetHoveredIndex={keyboard[name].hoveredIndex}
                  onTogglePresets={() => setDropdown(open => (open === name ? null : name))}
                  onCommit={() => setDropdown(null)} onKeyDown={keyboard[name].onKeyDown} />
                {dropdown === name && dropdownPresets.length > 0 && (
                  <MaterialPresetDropdown anchorRef={ref} presets={dropdownPresets} activePreset={activeValid}
                    onApply={(_, idx) => pickPreset(idx)} field={name === "sheetW" ? "width" : "length"}
                    inputId={`input-gyp-${name}`} hoveredIndex={keyboard[name].hoveredIndex} title="Board Presets" />
                )}
              </div>
            ))}
            <Seg label="Fixing direction" value={orientation} onChange={setOrientation}
              options={[["V", "Vertical"], ["H", "Horizontal"]]} />
            <Seg label="Layers" value={layers} onChange={setLayers}
              options={[["1", "1 layer"], ["2", "2 layers"]]} />
            {typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
              <button className="ctrl-dir form-section-action" onClick={() => setShowModal(true)}>
                <Icon name="plus" /> Manage Presets
              </button>
            )}
          </Stack>
        </ControlPanel>

        <ControlPanel id="control-gyp-fixing" title="Fixing & Price" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
            {[["screwRate", "Screws (pcs/m²)", 0], ["compoundRate", "Joint filler (kg/m²)", 0]].map(([name, label, min]) => (
              <div key={name} className={fieldFlash ? "num-input-flash" : ""}>
                <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={min} onChange={productChange(name)} />
              </div>
            ))}
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              <div className={fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-bagKg" label="Filler bag (kg)" value={val("bagKg")} min={0.1} onChange={productChange("bagKg")} />
              </div>
              <div className={fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-sheetPrice" label="Sheet price (€)" value={val("sheetPrice")} min={0} onChange={productChange("sheetPrice")} />
              </div>
            </div>
            {num("waste", "Waste (%)", { max: 100 })}
          </Stack>
        </ControlPanel>

        {presetError && !showModal && <p role="alert" className="input-error">{presetError}</p>}

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
                  <Row label="Screws" value={screws.count} unit="pcs" />
                  <Row label="Joint filler" value={compound.kg.toFixed(1)} unit="kg" />
                  {compound.bagKg && <Row label={`Filler bags (${compound.bagKg} kg)`} value={compound.bags} unit="pcs" />}
                  <Row label="Joint tape" value={tape.total.toFixed(1)} unit="m" />

                  <div className="pw-formula-wrap" style={{ marginTop: "1rem" }}>
                    <span className="pw-formula-text">
                      Sheets are counted from the layout, offcuts reused, then waste added. Openings reduce screws and joint filler; a placed one also drops any piece wholly inside it.
                    </span>
                  </div>
                  <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                    <span className="pw-formula-text">
                      Tape covers board joints on the face layer{mode === "room" ? ", internal corners" : ""}{mode === "room" && ceiling ? " and the ceiling angle" : ""}.
                    </span>
                  </div>
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
      {showModal && (
        <Modal title="Manage Board Presets" onClose={() => setShowModal(false)} className="gyp-preset-modal">
          <Stack gap={4}>
            <Stack gap={3}>
              <div className="pw-preset-header pw-preset-grid--gypsum">
                <span>Product Name</span>
                {PRESET_COLUMNS.map(([key, head]) => <span key={key}>{head}</span>)}
                <span>&nbsp;</span>
              </div>
              {presets.map((p, idx) => (
                <div key={idx} className={"pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")}>
                  <div className="pw-preset-fields pw-preset-grid--gypsum">
                    <div>
                      <span className="pw-preset-lbl-hide">Product Name</span>
                      <input id={`gyp-preset-name-${idx}`} aria-label={`Product name ${idx}`} type="text"
                        className="num-input" value={p.name} onChange={e => updatePreset(idx, "name", e.target.value)} />
                    </div>
                    {PRESET_COLUMNS.map(([key, head, aria]) => (
                      <div key={key}>
                        <span className="pw-preset-lbl-hide">{head}</span>
                        <input id={`gyp-preset-${key}-${idx}`} aria-label={`${aria} ${idx}`} type="text"
                          inputMode="decimal" autoComplete="off" className="num-input"
                          value={p[key]} onChange={e => updatePreset(idx, key, e.target.value)} />
                      </div>
                    ))}
                    <div className="num-wrap" style={{ justifyContent: "center" }}>
                      <span className="pw-preset-lbl-hide">&nbsp;</span>
                      {activePreset === idx
                        ? <div className="pw-preset-badge">active</div>
                        : <button className={"ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : "")}
                            onClick={() => applyPreset(p, idx)} title="Apply these values to the calculator">
                            <Icon name="check" /> {flashIdx === idx ? "Applied" : "Apply"}
                          </button>}
                    </div>
                  </div>
                </div>
              ))}
            </Stack>
            <Stack direction="row" gap={2}>
              <button className="ctrl-dir" onClick={() => setPresets([...presets, { ...BLANK_PRESET }])}>
                <Icon name="plus" /> Add Row
              </button>
              <SaveDefaultsButton status={saveStatus} errorMessage={saveError} onClick={saveDefaults} />
            </Stack>
            <div className="pw-formula-text">
              Fill preset data above and click "Apply" to update the calculator, or "Save Defaults" to persist.
              Knauf and Gyproc rates are the makers' published single-layer figures. Check them against the system you are building.
            </div>
          </Stack>
          {presetError && <p role="alert" className="input-error">{presetError}</p>}
        </Modal>
      )}
      <GypsumTakeOffSheet takeOff={printTakeOff} />
    </>
  );
}

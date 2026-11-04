import { useSessionState } from "../utils/session-state.js";
import { parseMeasurement } from "../utils/measurements.cjs";
import { React } from "../react-globals.js";
import { DetailSection, Icon, NumInput, Row, SaveDefaultsButton, Stack, safeSaveStaticDefaults, useClickOutside, useDropdownKeyboard, useTimedState } from "../shared.jsx";
import { LayoutVisualization } from "../Visualization.jsx";
import { GypsumTakeOffSheet } from "./GypsumTakeOffSheet.jsx";
import { GypsumRoom3D } from "./GypsumRoom3D.jsx";
import { buildGypsumTakeOff } from "../utils/gypsum-take-off.js";

// ── Gypsum board estimator ────────────────────────────────────────────────────

const KEY = name => `Gypsum.jsx:${name}`;
const PRODUCT_FIELDS = ["sheetW", "sheetL", "screwRate", "compoundRate", "bagKg", "sheetPrice"];
const PRESET_COLUMNS = [
  ["sheetW", "Width mm", "Sheet width"],
  ["sheetL", "Length mm", "Sheet length"],
  ["screwRate", "Screws/m²", "Screws per m²"],
  ["compoundRate", "kg/m²", "Compound per m²"],
  ["bagKg", "Bag kg", "Bag weight"],
  ["sheetPrice", "€ sheet", "Sheet price"]
];
const BLANK_PRESET = { name: "", sheetW: "", sheetL: "", screwRate: "", compoundRate: "", bagKg: "", sheetPrice: "" };

/* Fields that begin empty, and those that begin at a sensible value. Opening
   sizes are standard enough to prefill; job dimensions never are. */
const EMPTY = ["lenMm", "widMm", "heightMm", "wallW", "wallH", "doors", "windows", ...PRODUCT_FIELDS];
const PREFILLED = { doorW: "900", doorH: "2100", winW: "1200", winH: "1200", waste: "5" };

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
  const initialJob = () => ({ ...Object.fromEntries(EMPTY.map(name => [name, ""])), ...PREFILLED });
  const [job, setJob] = useSessionState(KEY("job"), initialJob);
  const val = name => job[name];
  const set = name => value => setJob(current => ({ ...current, [name]: value }));

  const [presets, setPresets] = useSessionState(KEY("presets"), () =>
    (typeof DEFAULT_GYPSUM_PRESETS !== "undefined" ? DEFAULT_GYPSUM_PRESETS : [BLANK_PRESET]).map(p => ({ ...p })));
  const [activePreset, setActivePreset] = useSessionState(KEY("activePreset"), null);
  const [presetError, setPresetError] = React.useState("");
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [showUpdated, setShowUpdated] = useTimedState(false, 2500);
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);
  const [saveStatus, setSaveStatus] = useTimedState("");
  const [saveError, setSaveError] = React.useState("");
  const [showPresets, setShowPresets] = React.useState(false);
  const [showOpenings, setShowOpenings] = React.useState(false);
  const presetAnchorRef = React.useRef(null);

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
      setPresetError("Fill in sheet size, screws, compound and bag weight before applying this preset.");
      return;
    }
    setPresetError("");
    setJob(current => ({ ...current, ...Object.fromEntries(PRODUCT_FIELDS.map((name, i) => [name, values[i] ?? ""])) }));
    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
    setShowUpdated(true);
  };

  /* A hand edit of a product field means the values are no longer the
     preset's, so its name stops showing. */
  const productChange = name => v => { if (v !== val(name)) setActivePreset(null); set(name)(v); };

  useClickOutside([presetAnchorRef], () => setShowPresets(false));
  const validPresets = presets.filter(p => p.name);
  const { hoveredIndex, onKeyDown } = useDropdownKeyboard(
    showPresets ? validPresets.length : 0,
    idx => { applyPreset(validPresets[idx], presets.indexOf(validPresets[idx])); setShowPresets(false); },
    () => setShowPresets(false)
  );

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
  const openingCount = (parseMeasurement(val("doors")) || 0) + (parseMeasurement(val("windows")) || 0);

  const num = (name, label, extra = {}) => (
    <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={0} onChange={set(name)} req={extra.req ?? false} {...extra} />
  );

  return (
    <div className="page-scroll">
      <Stack className="page-inner" gap={5}>
        <div className="layout-split">
          <Stack className="calc-main-stack" gap={4}>

            {/* ── Surface ── */}
            <div className="section unboxed">
              <div className="section-head"><span>Surface</span></div>
              <div className="section-body">
                <div className="concrete-split-wrap section-pad">
                  <Stack gap={3}>
                    <Seg label="What to board" value={mode} onChange={setMode}
                      options={[["room", "Room"], ["wall", "Single wall"]]} />
                    {mode === "room" ? (
                      <Stack gap={3}>
                        <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                          {num("lenMm", "Length (mm)", { min: 1, req: req("lenMm") })}
                          {num("widMm", "Width (mm)", { min: 1, req: req("widMm") })}
                        </div>
                        {num("heightMm", "Wall height (mm)", { min: 1, req: req("heightMm") })}
                        <Seg label="Ceiling" value={ceiling ? "on" : "off"} onChange={v => setCeiling(v === "on")}
                          options={[["off", "Walls only"], ["on", "Walls + ceiling"]]} />
                      </Stack>
                    ) : (
                      <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                        {num("wallW", "Width (mm)", { min: 1, req: req("wallW") })}
                        {num("wallH", "Height (mm)", { min: 1, req: req("wallH") })}
                      </div>
                    )}
                  </Stack>

                  <div className="concrete-split-divider" />

                  <Stack gap={3}>
                    <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                      {num("doors", "Doors (pcs)")}
                      {num("windows", "Windows (pcs)")}
                    </div>
                    <button type="button" className="ts-btn ctl-ghost" style={{ alignSelf: "flex-start" }} aria-expanded={showOpenings}
                      onClick={() => setShowOpenings(o => !o)}>
                      <Icon name={showOpenings ? "chevron-down" : "chevron-right"} /> Opening sizes
                    </button>
                    {showOpenings && (
                      <Stack gap={3}>
                        <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                          {num("doorW", "Door width (mm)")}
                          {num("doorH", "Door height (mm)")}
                        </div>
                        <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                          {num("winW", "Window width (mm)")}
                          {num("winH", "Window height (mm)")}
                        </div>
                      </Stack>
                    )}
                  </Stack>
                </div>
              </div>
            </div>

            {/* ── Sheet & fixing ── */}
            <div className="section unboxed">
              <div className="section-head">
                <div className="u-flex-row" style={{ flex: 1, alignItems: "center" }}>
                  <span>Sheet & Fixing</span>
                  <span className={"pw-updated-note" + (showUpdated ? " pw-updated-note-visible" : "")}>
                    <Icon name="check" /> updated
                  </span>
                </div>
              </div>
              <div className="section-body">
                <div className="concrete-split-wrap section-pad">
                  <Stack gap={3}>
                    <div className={"num-input-wrap-relative" + (fieldFlash ? " num-input-flash" : "")} ref={presetAnchorRef}>
                      <NumInput
                        id="input-gyp-sheetW"
                        label="Sheet width (mm)"
                        note={activePreset !== null ? presets[activePreset]?.name : ""}
                        value={val("sheetW")} min={100}
                        onChange={productChange("sheetW")}
                        req={req("sheetW")}
                        presetsOpen={showPresets}
                        presetHoveredIndex={hoveredIndex}
                        showActionLabels
                        onTogglePresets={() => setShowPresets(open => !open)}
                        onCommit={() => setShowPresets(false)}
                        onKeyDown={onKeyDown}
                      />
                      {showPresets && validPresets.length > 0 && (
                        <div className="rate-presets-dropdown">
                          <div className="rate-presets-header">Board Presets</div>
                          <div id="input-gyp-sheetW-presets" className="rate-presets-list" role="listbox" aria-label="Board presets">
                            {validPresets.map((p, idx) => {
                              const originalIdx = presets.indexOf(p);
                              return (
                                <div key={idx} id={`input-gyp-sheetW-preset-${idx}`} role="option"
                                  aria-selected={activePreset === originalIdx}
                                  className={"rate-preset-item" + (activePreset === originalIdx ? " active" : "") + (hoveredIndex === idx ? " focused" : "")}
                                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); applyPreset(p, originalIdx); setShowPresets(false); }}>
                                  <div className="rate-preset-info">
                                    <span className="rate-preset-name">{p.name}</span>
                                    <span className="rate-preset-meta">{p.screwRate} screws · {p.compoundRate} kg/m²</span>
                                  </div>
                                  <span className="rate-preset-val">{p.sheetW}×{p.sheetL}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-gyp-sheetL" label="Sheet length (mm)" value={val("sheetL")} min={100}
                        onChange={productChange("sheetL")} req={req("sheetL")} />
                    </div>
                    <Seg label="Fixing direction" value={orientation} onChange={setOrientation}
                      options={[["V", "Vertical"], ["H", "Horizontal"]]} />
                    <Seg label="Layers" value={layers} onChange={setLayers}
                      options={[["1", "1 layer"], ["2", "2 layers"]]} />
                  </Stack>

                  <div className="concrete-split-divider" />

                  <Stack gap={3}>
                    <div className={fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-gyp-screwRate" label="Screws (pcs/m²)" value={val("screwRate")} min={0}
                        onChange={productChange("screwRate")} />
                    </div>
                    <div className={fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-gyp-compoundRate" label="Compound (kg/m²)" value={val("compoundRate")} min={0}
                        onChange={productChange("compoundRate")} />
                    </div>
                    <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                      <div className={fieldFlash ? "num-input-flash" : ""}>
                        <NumInput id="input-gyp-bagKg" label="Bag (kg)" value={val("bagKg")} min={0.1} onChange={productChange("bagKg")} />
                      </div>
                      <div className={fieldFlash ? "num-input-flash" : ""}>
                        <NumInput id="input-gyp-sheetPrice" label="Sheet price (€)" value={val("sheetPrice")} min={0} onChange={productChange("sheetPrice")} />
                      </div>
                    </div>
                    {num("waste", "Waste (%)", { max: 100 })}
                  </Stack>
                </div>
              </div>
            </div>

            {presetError && <p role="alert" className="input-error">{presetError}</p>}

            {/* ── Board presets ── */}
            <DetailSection title="Board Presets" open={false}>
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
                  Knauf and Gyproc rates are the makers' published single-layer figures. Check them against the system you are building.
                </div>
              </Stack>
            </DetailSection>

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
                          <span className="gyp-surface-name">{s.label}{s.count > 1 ? ` ×${s.count}` : ""}</span>
                          <span className="gyp-surface-meta">
                            {s.layout.full} full · {s.layout.cut} cut{s.count > 1 ? " each" : ""}
                          </span>
                        </div>
                        <LayoutVisualization result={{ ...s.layout, stats: { full: s.layout.full, cut: s.layout.cut } }} maxHeight={320} />
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
                  {openingCount > 0 && <Row label="Openings" value={`−${area.openings.toFixed(2)}`} unit="m²" />}
                  <Row label="Net area" value={area.net.toFixed(2)} unit="m²" />
                  {takeOff.layers > 1 && <Row label="Boarded area (2 layers)" value={area.boarded.toFixed(2)} unit="m²" />}
                  <Row label="Sheets from layout" value={sheets.layout} unit="pcs" />
                  <Row label={`With ${sheets.waste}% waste`} value={sheets.exact.toFixed(1)} unit="pcs" />
                  <Row label="Screws" value={screws.count} unit="pcs" />
                  <Row label="Joint compound" value={compound.kg.toFixed(1)} unit="kg" />
                  {compound.bagKg && <Row label={`Compound bags (${compound.bagKg} kg)`} value={compound.bags} unit="pcs" />}
                  <Row label="Joint tape" value={tape.total.toFixed(1)} unit="m" />

                  <div className="pw-formula-wrap" style={{ marginTop: "1rem" }}>
                    <span className="pw-formula-text">
                      Sheets are counted from the layout, offcuts reused, then waste added. Openings reduce screws and compound, not sheets.
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

            <div className="form-action">
              <button onClick={handleReset} onBlur={disarmReset}
                className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
                aria-label={resetArmed ? "Confirm global reset — clears every field" : "Global reset — clears every field, asks first"}>
                <Icon name="refresh-cw" /> {resetArmed ? "Confirm reset?" : "Global Reset"}
              </button>
            </div>
          </Stack>

          {/* ── Sticky result column ── */}
          <div className="u-sticky u-sticky-top" style={{ marginTop: "var(--sticky-offset)", top: "20px" }}>
            <div className="result-card result-card--concrete">
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
      </Stack>
      <GypsumTakeOffSheet takeOff={printTakeOff} />
    </div>
  );
}

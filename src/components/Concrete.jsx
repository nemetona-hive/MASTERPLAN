import { useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { Icon, NumInput, Row, Stack, useTimedState } from "../shared.jsx";
import { ManagePresetsButton, PresetField, PresetManager, presetHeader, usePresetLibrary } from "./PresetLibrary.jsx";
import { TakeOffSheet } from "./TakeOffSheet.jsx";
import { buildTakeOff } from "../utils/take-off.js";
import { ProjectSection } from "./ProjectMenu.jsx";

// ── Concrete Calculator ────────────────────────────────────────────────────────

/* The product library, on the shared preset system (PresetLibrary.jsx) that
   Gypsum's three use: a list on the consumption field, the applied product
   named above its section, and the table behind Manage Presets where Save
   Defaults can write. The keys are the ones this page has always used, so
   saved defaults (`concretePresets`) and projects carry over. */
export const CONCRETE_LIBRARY = {
  id: "concrete",
  title: "Product Presets",
  saveKey: "concretePresets",
  draftKey: "Concrete.jsx:presets",
  idBase: "preset",
  defaults: () => (typeof DEFAULT_CONCRETE_PRESETS !== "undefined" ? DEFAULT_CONCRETE_PRESETS : [
    { name: "weber S-100", rate: 2, bagKg: 25, bagPrice: 4 },
    { name: "weberfloor 200 RAPID", rate: 1.7, bagKg: 20, bagPrice: 15 }
  ]),
  columns: [
    ["rate", "kg/m²·mm", "Consumption"],
    ["bagKg", "Bag kg", "Bag weight"],
    ["bagPrice", "Price €", "Bag price"]
  ],
  required: ["rate", "bagKg"],
  requiredText: "a consumption rate and bag weight",
  grid: "pw-preset-grid--product",
  detail: p => [`${p.rate} kg/m²·mm`, p.bagKg && `${p.bagKg} kg bag`].filter(Boolean).join(" · "),
  describe: p => ({
    meta: [p.bagKg && `${p.bagKg} kg`, p.bagPrice !== "" && p.bagPrice != null && `${p.bagPrice} €`].filter(Boolean).join(" · "),
    value: p.rate, unit: "kg"
  }),
  note: "Consumption is the maker's kg per m² per 1 mm of layer."
};

export function SheetConcrete() {
  const [areaMode,  setAreaMode]  = useSessionState("Concrete.jsx:areaMode", "direct"); // "direct" | "dims"
  const [thickMode, setThickMode] = useSessionState("Concrete.jsx:thickMode", "avg");    // "avg" | "corners"

  // Area inputs
  const [areaManual, setAreaManual] = useSessionState("Concrete.jsx:areaManual", "");
  const [lenMm,      setLenMm]      = useSessionState("Concrete.jsx:lenMm", "");
  const [widMm,      setWidMm]      = useSessionState("Concrete.jsx:widMm", "");

  // Thickness inputs
  const [avgH, setAvgH] = useSessionState("Concrete.jsx:avgH", "");
  const [ca,   setCa]   = useSessionState("Concrete.jsx:ca", "");
  const [cb,   setCb]   = useSessionState("Concrete.jsx:cb", "");
  const [cc,   setCc]   = useSessionState("Concrete.jsx:cc", "");
  const [cd,   setCd]   = useSessionState("Concrete.jsx:cd", "");

  // Consumption & packaging
  const [rate,     setRate]     = useSessionState("Concrete.jsx:rate", "");
  const [bagKg,    setBagKg]    = useSessionState("Concrete.jsx:bagKg", "");
  const [bagPrice, setBagPrice] = useSessionState("Concrete.jsx:bagPrice", "");

  /* Reset arms on the first click and fires on the second. useTimedState is
     already how this file holds transient UI state, and it disarms itself, so
     a click made and thought better of expires on its own. */
  const [resetArmed,   armReset, disarmReset] = useTimedState(false, 4000);

  const [activePreset, setActivePreset] = useSessionState("Concrete.jsx:activePreset", null);
  const library = usePresetLibrary(CONCRETE_LIBRARY, {
    active: activePreset, setActive: setActivePreset,
    onApply: values => { setRate(values.rate); setBagKg(values.bagKg); setBagPrice(values.bagPrice); }
  });

  const resetAll = () => {
    setAreaManual("");
    setLenMm("");
    setWidMm("");
    setAvgH("");
    setCa(""); setCb(""); setCc(""); setCd("");
    setRate("");
    setBagKg("");
    setBagPrice("");
    setActivePreset(null);
  };

  const handleReset = () => {
    if (!resetArmed) {
      armReset(true);
      return;
    }
    disarmReset();
    resetAll();
  };

  /* A hand edit means the values are no longer the preset's. */
  const productChange = (current, set) => v => { if (v !== current) library.edited(); set(v); };

  /* ── Derived values ────────────────────────────────────────────────────────
   *
   * All of it from `buildTakeOff`, including the figures this page shows on
   * screen. The page used to do the arithmetic itself and a printed sheet would
   * have had to redo it — which is two places that can round, over the one
   * number where that matters most: `bagsExact` is 12.4 and `bags` is 13, both
   * are real answers to different questions, and a screen showing one while a
   * printout showed the other is how somebody buys the wrong amount of
   * concrete. One model, and the sheet reads the same object. */
  const takeOff = buildTakeOff({
    areaMode, areaManual, lenMm, widMm,
    thickMode, avgH, ca, cb, cc, cd,
    rate, bagKg, bagPrice,
    product: library.selected?.name || ""
  });

  /* Staged for printing, and printed from an EFFECT rather than the click:
     window.print() blocks on the dialog, so calling it in the handler opens a
     dialog over a sheet React has not committed yet. Same reasoning as the cut
     list; see SurfaceLayout.jsx. */
  const [printTakeOff, setPrintTakeOff] = React.useState(null);
  React.useEffect(() => {
    if (!printTakeOff) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printTakeOff]);

  React.useEffect(() => { setPrintTakeOff(null); },
    [areaMode, areaManual, lenMm, widMm, thickMode, avgH, ca, cb, cc, cd, rate, bagKg, bagPrice, activePreset, library.presets]);

  const area = takeOff.area.value;
  const computedDimsArea = takeOff.area.fromDims;
  const computedAvgH = takeOff.thickness.average;
  const diff = takeOff.thickness.difference;
  const volume = takeOff.volume;
  const mass = takeOff.mass;
  const bagsExact = takeOff.bags.exact;
  const bags = takeOff.bags.toBuy;
  const totalPrice = takeOff.bags.total;

  const fmtEur = n => n.toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const hasAnyInput = Boolean(
    areaManual || lenMm || widMm || 
    avgH || ca || cb || cc || cd || 
    rate || bagKg || bagPrice
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="page-scroll">
      <Stack className="page-inner" gap={5}>

        <div className="layout-split">
          <Stack className="calc-main-stack" gap={4}>
            <ProjectSection variant="section" />
            {/* ── Area & Thickness ── */}
            <div className="section unboxed">
              <div className="section-head">
                <span>Area & Thickness</span>
              </div>
              <div className="section-body">
                <div className="concrete-split-wrap section-pad">
                  
                  {/* Left Column: Floor Area */}
                  <Stack gap={3}>
                    <div className="seg-group">
                      <button
                        className={"ctrl-dir" + (areaMode === "direct" ? " on" : "")} aria-pressed={areaMode === "direct"}
                        onClick={() => setAreaMode("direct")}>Enter area</button>
                      <button
                        className={"ctrl-dir" + (areaMode === "dims" ? " on" : "")} aria-pressed={areaMode === "dims"}
                        onClick={() => setAreaMode("dims")}>Dimensions</button>
                    </div>

                    <div className="concrete-split-content">
                      {areaMode === "direct" && (
                        <NumInput
                          id="input-slf-area"
                          label="Area (m²)"
                          value={areaManual}
                          min={0}
                          onChange={v => setAreaManual(String(v))}
                          req={hasAnyInput && !areaManual}
                        />
                      )}

                      {areaMode === "dims" && (
                        <Stack gap={3}>
                          <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                            <NumInput id="input-slf-len" label="Length (mm)" value={lenMm} min={1} onChange={setLenMm} req={hasAnyInput && !lenMm} />
                            <NumInput id="input-slf-wid" label="Width (mm)"  value={widMm} min={1} onChange={setWidMm} req={hasAnyInput && !widMm} />
                          </div>
                          <Row label="Calculated area" value={computedDimsArea.toFixed(2)} unit="m²" />
                        </Stack>
                      )}
                    </div>
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right Column: Layer Thickness */}
                  <Stack gap={3}>
                    <div className="seg-group">
                      <button
                        className={"ctrl-dir" + (thickMode === "avg" ? " on" : "")} aria-pressed={thickMode === "avg"}
                        onClick={() => setThickMode("avg")}>Avg thickness</button>
                      <button
                        className={"ctrl-dir" + (thickMode === "corners" ? " on" : "")} aria-pressed={thickMode === "corners"}
                        onClick={() => setThickMode("corners")}>4 corners</button>
                    </div>

                    <div className="concrete-split-content">
                      {thickMode === "avg" && (
                        <NumInput id="input-slf-havg" label="Average thickness (mm)" value={avgH} min={1} onChange={setAvgH} req={hasAnyInput && !avgH} />
                      )}

                      {thickMode === "corners" && (
                        <Stack gap={3}>
                          <div className="pw-grid-2col" style={{ marginBottom: "var(--sp-3)" }}>
                            <NumInput id="input-slf-ca" label="Corner A (mm)" value={ca} min={0} onChange={setCa} req={hasAnyInput && !ca} />
                            <NumInput id="input-slf-cb" label="Corner B (mm)" value={cb} min={0} onChange={setCb} req={hasAnyInput && !cb} />
                          </div>
                          <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                            <NumInput id="input-slf-cc" label="Corner C (mm)" value={cc} min={0} onChange={setCc} req={hasAnyInput && !cc} />
                            <NumInput id="input-slf-cd" label="Corner D (mm)" value={cd} min={0} onChange={setCd} req={hasAnyInput && !cd} />
                          </div>
                        </Stack>
                      )}
                    </div>
                  </Stack>

                </div>
              </div>
            </div>

            {/* ── Consumption & packaging ── */}
            <div className="section unboxed">
              <div className="section-head">
                <span>Consumption & Packaging</span>
              </div>
              <div className="section-body">
                {presetHeader(library)}
                <div className="concrete-split-wrap section-pad">
                  {/* Left: Consumption. ctrl-list keeps Manage Presets at its
                      height: a .ctrl-dir in a column otherwise collapses. */}
                  <Stack gap={3} className="ctrl-list">
                    <PresetField library={library} field="rate" id="input-slf-rate" label="Consumption (kg/m²·mm)"
                      className="num-input-wrap-relative" value={rate} min={0.1}
                      onChange={productChange(rate, setRate)} req={hasAnyInput && !rate} />
                    <ManagePresetsButton library={library} />
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right: Packaging */}
                  <Stack gap={3}>
                    <div className={library.fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagkg" label="Bag weight (kg)" value={bagKg} min={1} onChange={productChange(bagKg, setBagKg)} req={hasAnyInput && !bagKg} />
                    </div>
                    <div className={library.fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagprice" label="Bag price (€)" value={bagPrice} min={0} onChange={productChange(bagPrice, setBagPrice)} />
                    </div>
                  </Stack>
                </div>
              </div>
            </div>
            {library.error && !library.managing && <p role="alert" className="input-error">{library.error}</p>}

            {!takeOff.ready && hasAnyInput && <p role="status" className="input-error">{takeOff.issue}</p>}
            {/* ── Calculations & Details ── */}
            <div className="section unboxed" style={{ marginTop: 'var(--sp-4)' }}>
              <div className="section-head">
                <span>Calculation Details</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={1}>
                  <Row label="Floor area"       value={area.toFixed(1)}              unit="m²" />
                  <Row label="Avg thickness"    value={Math.round(computedAvgH)}     unit="mm" />
                  {diff !== null && (
                    <Row label="Height difference" value={Math.round(diff)}          unit="mm" />
                  )}
                  <Row label="Volume"           value={volume > 0 ? volume.toFixed(3) : "0.000"} unit="m³" />
                  <Row label="Total mix mass"   value={mass > 0 ? mass.toFixed(1) : "0.0"} unit="kg" />
                  <Row 
                    label="Exact bags calculated" 
                    value={bagsExact > 0 ? bagsExact.toFixed(2) : "0.00"} 
                    unit="pcs" 
                  />

                  <div className="pw-formula-wrap" style={{ marginTop: "1rem" }}>
                    <span className="pw-formula-text">
                      mass = area × avg thickness × consumption rate
                    </span>
                  </div>

                  <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                    <span className="pw-formula-text">
                      Results are approximate — actual consumption may vary due to substrate absorption and mixing residue.
                    </span>
                  </div>
                </Stack>
              </div>
            </div>

            {/* Ends the form rather than riding in the result column. Below
                1024px that column becomes a fixed bottom bar, and a control
                that clears every field does not belong pinned under the thumb
                — nor competing for the bar's width. */}
            <div className="form-action">
              <button
                onClick={handleReset}
                /* Focus leaving is as good a change of mind as the timeout. */
                onBlur={disarmReset}
                className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
                /* The visible label is short enough to sit in the row; the
                   accessible one says what the second click actually does. */
                aria-label={resetArmed
                  ? "Confirm global reset — clears every field"
                  : "Global reset — clears every field, asks first"}
              >
                <Icon name="refresh-cw" /> {resetArmed ? "Confirm reset?" : "Global Reset"}
              </button>
            </div>

          </Stack>

          {/* Sticky Result Column */}
          <div className="u-sticky u-sticky-top" style={{ marginTop: 'var(--sticky-offset)', top: '20px' }}>
            <div className="result-card result-card--concrete">
              <div className="result-card-primary">
              <span className="result-card-title">Bags Needed</span>
              <span className="result-card-value">
                {bags > 0 ? bags : "0"} 
                <span style={{fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-reg)', marginLeft: '4px'}}>pcs</span>
              </span>
              <span className="result-card-note">
                exact: {bagsExact > 0 ? bagsExact.toFixed(2) : "0.00"} pcs
              </span>

              </div>
              {/* Classes, not inline styles: the mobile bar has to override the
                  spacing and a rule cannot outrank a style attribute. */}
              <div className="result-card-split">
                <span className="result-card-title">Total Price</span>
                <span className="result-card-value">
                  {totalPrice !== null ? (
                    <>
                      <span style={{ fontSize: 'var(--fs-lg)' }}>€</span>
                      <span>{fmtEur(totalPrice)}</span>
                    </>
                  ) : "—"}
                </span>
              </div>

              {/* Disabled until there is a pour to describe — a sheet with a
                  header and no figures is something somebody prints, carries to
                  a merchant, and then finds is blank. */}
              <button
                type="button"
                className="ts-btn ctl-ghost result-card-print"
                onClick={() => setPrintTakeOff(takeOff)}
                disabled={!takeOff.ready}
                title={takeOff.ready
                  ? "Take-off sheet — opens the print dialog, where Save as PDF is"
                  : "Enter an area and a thickness first"}>
                <Icon name="print" /> Take-off
              </button>
            </div>

          </div>

        </div>

      </Stack>
      <PresetManager library={library} />
      <TakeOffSheet takeOff={printTakeOff} />
    </div>
  );
}

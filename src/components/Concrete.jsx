import { SessionDraftContext, useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { Icon, NumInput, Row, SegGroup, Stack, useTimedState } from "../shared.jsx";
import { ManagePresetsButton, PresetField, PresetManager, presetHeader, usePresetLibrary } from "./PresetLibrary.jsx";
import { TakeOffSheet } from "./TakeOffSheet.jsx";
import { buildTakeOff } from "../utils/take-off.js";
import { eur } from "../utils/format.js";
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

const KEY = name => `Concrete.jsx:${name}`;
/* The two switches, and every typed field. All of them live in one `job`
   object, so reset, the model call and the "anything typed yet" check read
   one list rather than repeating fourteen names each. */
const MODES = { areaMode: "direct", thickMode: "avg" };   // "direct" | "dims", "avg" | "corners"
const INPUTS = ["areaManual", "lenMm", "widMm", "avgH", "ca", "cb", "cc", "cd", "rate", "bagKg", "bagPrice"];
const blankJob = () => ({ ...MODES, ...Object.fromEntries(INPUTS.map(name => [name, ""])) });
/* A field is empty only when nothing is in it: 0 is a value (a corner of
   0 mm is a real measurement, and the model asks for it). */
const empty = value => value === "" || value === null || value === undefined;

/* Before `job`, each field was its own draft under these keys. A project saved
   then opens with them gathered into one, and the old keys are dropped from
   the drafts so they are not saved again beside it. */
const LEGACY = [...Object.keys(MODES), ...INPUTS];
function legacyJob(drafts) {
  if (!drafts || !LEGACY.some(name => drafts.has(KEY(name)))) return null;
  const job = blankJob();
  for (const name of LEGACY) if (drafts.has(KEY(name))) job[name] = drafts.get(KEY(name));
  return job;
}

export function SheetConcrete() {
  const drafts = React.useContext(SessionDraftContext);
  const [storedJob, setJob] = useSessionState(KEY("job"), () => legacyJob(drafts) || blankJob());
  React.useEffect(() => { if (drafts) for (const name of LEGACY) drafts.delete(KEY(name)); }, [drafts]);
  const job = { ...blankJob(), ...(storedJob && typeof storedJob === "object" ? storedJob : {}) };
  const set = name => value => setJob(current => ({ ...current, [name]: value }));
  const { areaMode, thickMode } = job;

  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);
  const [activePreset, setActivePreset] = useSessionState(KEY("activePreset"), null);
  const library = usePresetLibrary(CONCRETE_LIBRARY, {
    active: activePreset, setActive: setActivePreset,
    onApply: values => setJob(current => ({ ...current, ...values }))
  });

  /* Reset arms on the first click and fires on the second, and disarms itself
     after a while, so a click thought better of expires on its own. It clears
     every typed field and keeps the two switches where they are. */
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    setJob(current => ({ ...blankJob(), areaMode: current.areaMode, thickMode: current.thickMode }));
    setActivePreset(null);
  };

  /* A hand edit means the values are no longer the preset's. */
  const productChange = name => v => { if (v !== job[name]) library.edited(); set(name)(v); };

  const hasAnyInput = INPUTS.some(name => !empty(job[name]));
  const req = name => hasAnyInput && empty(job[name]);
  const num = (name, label, min, id) => (
    <NumInput id={id} label={label} value={job[name]} min={min} onChange={set(name)} req={req(name)} />
  );

  /* ── Derived values ────────────────────────────────────────────────────────
   *
   * All of it from `buildTakeOff`, including the figures this page shows on
   * screen. The page used to do the arithmetic itself and a printed sheet would
   * have had to redo it — which is two places that can round, over the one
   * number where that matters most: `bagsExact` is 12.4 and `bags` is 13, both
   * are real answers to different questions, and a screen showing one while a
   * printout showed the other is how somebody buys the wrong amount of
   * concrete. One model, and the sheet reads the same object. */
  const takeOff = buildTakeOff({ ...job, product: library.selected?.name || "" });

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

  React.useEffect(() => { setPrintTakeOff(null); }, [storedJob, activePreset, library.presets]);

  /* Shown as the model rounded them, the same figures the printed sheet
     states: area to 2 decimals, thickness and fall to 1. */
  const { area, thickness, volume, mass, bags } = takeOff;

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
                    <SegGroup label="Floor area" value={areaMode} onChange={set("areaMode")}
                      options={[["direct", "Enter area"], ["dims", "Dimensions"]]} />

                    <div className="concrete-split-content">
                      {areaMode === "direct" && (
                        num("areaManual", "Area (m²)", 0, "input-slf-area")
                      )}

                      {areaMode === "dims" && (
                        <Stack gap={3}>
                          <div className="pw-grid-2col">
                            {num("lenMm", "Length (mm)", 1, "input-slf-len")}
                            {num("widMm", "Width (mm)", 1, "input-slf-wid")}
                          </div>
                          <Row label="Calculated area" value={area.fromDims.toFixed(2)} unit="m²" />
                        </Stack>
                      )}
                    </div>
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right Column: Layer Thickness */}
                  <Stack gap={3}>
                    <SegGroup label="Layer thickness" value={thickMode} onChange={set("thickMode")}
                      options={[["avg", "Avg thickness"], ["corners", "4 corners"]]} />

                    <div className="concrete-split-content">
                      {thickMode === "avg" && (
                        num("avgH", "Average thickness (mm)", 1, "input-slf-havg")
                      )}

                      {thickMode === "corners" && (
                        <div className="pw-grid-2col">
                          {["a", "b", "c", "d"].map(c => (
                            <React.Fragment key={c}>{num(`c${c}`, `Corner ${c.toUpperCase()} (mm)`, 0, `input-slf-c${c}`)}</React.Fragment>
                          ))}
                        </div>
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
                      className="num-input-wrap-relative" value={job.rate} min={0.1}
                      onChange={productChange("rate")} req={req("rate")} />
                    <ManagePresetsButton library={library} />
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right: Packaging */}
                  <Stack gap={3}>
                    <div className={library.fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagkg" label="Bag weight (kg)" value={job.bagKg} min={1} onChange={productChange("bagKg")} req={req("bagKg")} />
                    </div>
                    <div className={library.fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagprice" label="Bag price (€)" value={job.bagPrice} min={0} onChange={productChange("bagPrice")} />
                    </div>
                  </Stack>
                </div>
              </div>
            </div>
            {library.error && !library.managing && <p role="alert" className="input-error">{library.error}</p>}

            {!takeOff.ready && hasAnyInput && <p role="status" className="input-error">{takeOff.issue}</p>}
            {/* ── Calculations & Details ── */}
            <div className="section unboxed calc-details">
              <div className="section-head">
                <span>Calculation Details</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={1}>
                  <Row label="Floor area" value={area.value.toFixed(2)} unit="m²" />
                  <Row label="Avg thickness" value={String(thickness.average)} unit="mm" />
                  {thickness.difference !== null && (
                    <Row label="Height difference" value={String(thickness.difference)} unit="mm" />
                  )}
                  <Row label="Volume" value={volume.toFixed(3)} unit="m³" />
                  <Row label="Total mix mass" value={mass.toFixed(1)} unit="kg" />
                  <Row label="Exact bags calculated" value={bags.exact.toFixed(2)} unit="pcs" />

                  <div className="pw-formula-wrap pw-formula-wrap--lead">
                    <span className="pw-formula-text">
                      mass = area × avg thickness × consumption rate
                    </span>
                  </div>

                  <div className="pw-formula-wrap">
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
          <div className="result-sticky">
            <div className="result-card result-card--concrete">
              <div className="result-card-primary">
              <span className="result-card-title">Bags Needed</span>
              <span className="result-card-value">
                {bags.toBuy}
                <span className="result-card-unit">pcs</span>
              </span>
              <span className="result-card-note">
                exact: {bags.exact.toFixed(2)} pcs
              </span>

              </div>
              {/* Classes, not inline styles: the mobile bar has to override the
                  spacing and a rule cannot outrank a style attribute. */}
              <div className="result-card-split">
                <span className="result-card-title">Total Price</span>
                <span className="result-card-value">
                  {bags.total !== null ? (
                    <>
                      <span className="result-card-currency">€</span>
                      <span>{eur(bags.total)}</span>
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

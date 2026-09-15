import { React } from "../react-globals.js";
import { LAYOUT_REGISTRY } from "../Controls.jsx";
import { ControlPanel, Icon, MaterialPresetDropdown, NumInput, Row, SaveDefaultsButton, Stack, clampNumber, safeSaveStaticDefaults, useClickOutside, useDocHistory, useDropdownKeyboard, useTimedState, Modal } from "../shared.jsx";
import { LayoutEmptyState, LayoutPanel, LayoutVisualization, PanelSummary, PreviewSection } from "../Visualization.jsx";
import { CutListSheet } from "./CutListSheet.jsx";
import { parseMeasurement } from "../utils/measurements.cjs";
import { buildCutList } from "../utils/cut-list.js";

const hasValue = value => value !== "" && value !== null && value !== undefined;
const validDimension = (value, min, max) => {
  const parsed = parseMeasurement(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};
const clampOptionalDimension = (value, min, max) => value === "" ? "" : clampNumber(value, min, max, min);
const dimensionsMatch = (actual, expected) => parseMeasurement(actual) === parseMeasurement(expected);
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function getSurfaceReadiness(sh) {
  const valid = {
    PLa: validDimension(sh.PLa, 100, 8000),
    PPi: validDimension(sh.PPi, 100, 8000),
    W: validDimension(sh.W, 100, 50000),
    H: validDimension(sh.H, 100, 50000)
  };
  const materialComplete = valid.PLa && valid.PPi;
  const surfaceComplete = valid.W && valid.H;
  return {
    started: [sh.PLa, sh.PPi, sh.W, sh.H].some(hasValue),
    materialComplete,
    surfaceComplete,
    ready: materialComplete && surfaceComplete,
    missing: new Set(Object.keys(valid).filter(key => !valid[key]))
  };
}

export function SheetSurfaceLayout({ sh, setSh, panelOpen, setPanelOpen }) {
  /* Most fields belong to the readiness model or LayoutSettings; only these
     two feed the per-layout control adapters below. */
  const { offset, s4Long } = sh;
  const readiness = getSurfaceReadiness(sh);
  const rowStart = sh.rowStart || "top";
  const [hoveredType, setHoveredType] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(true);

  // ── Material presets ───────────────────────────────────────────────────────
  const [presets, setPresets] = React.useState(() =>
    (typeof DEFAULT_MATERIAL_PRESETS !== "undefined"
      ? DEFAULT_MATERIAL_PRESETS
      : [{ name: "", length: 300, width: 300 }]
    ).map(p => ({ ...p }))
  );
  const [activePreset,    setActivePreset]    = React.useState(null);
  const [flashIdx,        setFlashIdx]        = useTimedState(null, 1200);
  const [showModal,       setShowModal]       = React.useState(false);
  const [largePreview,    setLargePreview]    = React.useState(null);
  const [fieldFlash,      setFieldFlash]      = useTimedState(false, 900);
  const [presetSaveStatus, setPresetSaveStatus] = useTimedState("");
  const [presetError, setPresetError] = React.useState("");
  const [saveError, setSaveError] = React.useState("");
  const [activePresetDropdown, setActivePresetDropdown] = React.useState(null);

  // Surface-size presets are separate from products: both happen to be a
  // width/length pair, but one describes the job and the other the stock.
  const [surfacePresets, setSurfacePresets] = React.useState(() =>
    (typeof DEFAULT_SURFACE_PRESETS !== "undefined"
      ? DEFAULT_SURFACE_PRESETS
      : [{ name: "Viz-card development 1390×2200", width: 1390, length: 2200 }]
    ).map(p => ({ ...p }))
  );
  const [activeSurfacePreset, setActiveSurfacePreset] = React.useState(null);
  const [surfaceFlashIdx, setSurfaceFlashIdx] = useTimedState(null, 1200);
  const [surfaceFieldFlash, setSurfaceFieldFlash] = useTimedState(false, 900);
  const [showSurfaceModal, setShowSurfaceModal] = React.useState(false);
  const [surfacePresetSaveStatus, setSurfacePresetSaveStatus] = useTimedState("");
  const [surfacePresetError, setSurfacePresetError] = React.useState("");
  const [surfaceSaveError, setSurfaceSaveError] = React.useState("");

  // Selection describes the values, not focus timing. A dropdown applies both
  // dimensions while its input still owns focus; that input can later blur and
  // commit the same value from an older render. Derive invalidation from the
  // resulting pair so that no-op commits preserve the title and real edits do not.
  React.useEffect(() => {
    if (activePreset === null) return;
    const preset = presets[activePreset];
    if (!preset || !dimensionsMatch(sh.PLa, preset.width) || !dimensionsMatch(sh.PPi, preset.length)) {
      setActivePreset(null);
    }
  }, [activePreset, presets, sh.PLa, sh.PPi]);

  React.useEffect(() => {
    if (activeSurfacePreset === null) return;
    const preset = surfacePresets[activeSurfacePreset];
    if (!preset || !dimensionsMatch(sh.W, preset.width) || !dimensionsMatch(sh.H, preset.length)) {
      setActiveSurfacePreset(null);
    }
  }, [activeSurfacePreset, surfacePresets, sh.W, sh.H]);

  /*
   * The cut list currently staged for printing.
   *
   * Held in state and printed from an EFFECT rather than from the click, and
   * that ordering is the whole of it: `window.print()` is synchronous and
   * blocks on the dialog, so calling it in the handler opens a dialog over a
   * sheet React has not committed yet — a blank page. The effect runs after the
   * commit, so the document exists before anything is asked to render it.
   *
   * The sheet remains hidden on screen after printing, until the calculation
   * inputs change and invalidate it.
   */
  const [printList, setPrintList] = React.useState(null);

  React.useEffect(() => {
    if (!printList) return;
    // One frame, so the browser has painted the commit and not merely applied
    // it. Printing off the commit alone produced an empty first page.
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printList]);

  React.useEffect(() => { setPrintList(null); }, [sh]);

  const openLargePreview = (layout, result) => setLargePreview({ layout, result });
  const closeLargePreview = () => setLargePreview(null);

  /* `sh` is the document every pattern-layout page edits, so the key is the
     document rather than the route: moving between layout systems keeps the
     history, because the thing you could undo is still on screen. The preset
     highlight, the flash and the open preview are view state and stay out. */
  const markStep = useDocHistory({
    key: "surface-layout",
    snapshot: () => sh,
    apply: setSh
  });

  const applyPreset = (p, idx) => {
    const length = parseMeasurement(p.length), width = parseMeasurement(p.width);
    if (![length, width].every(n => Number.isFinite(n) && n >= 100 && n <= 8000)) {
      setPresetError("Material dimensions must be between 100 and 8000 mm.");
      return;
    }
    setPresetError("");
    // The one that eats work: it overwrites two dimensions you may have typed.
    markStep("Apply preset");
    setSh(s => ({ ...s, PPi: length, PLa: width }));
    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
  };

  const updatePreset = (idx, field, val) => {
    const next = [...presets];
    next[idx] = { ...next[idx], [field]: val };
    setPresets(next);
  };

  const addPreset = () => setPresets([...presets, { name: "", length: "", width: "" }]);

  const saveMaterialDefaults = async () => {
    setPresetSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("materialPresets", presets);
      setPresetSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || String(err));
      setPresetSaveStatus("error");
    }
  };

  const applySurfacePreset = (p, idx) => {
    const width = parseMeasurement(p.width), length = parseMeasurement(p.length);
    if (![width, length].every(n => Number.isFinite(n) && n >= 100 && n <= 50000)) {
      setSurfacePresetError("Surface dimensions must be between 100 and 50000 mm.");
      return;
    }
    setSurfacePresetError("");
    markStep("Apply input preset");
    setSh(s => ({ ...s, W: width, H: length }));
    setActiveSurfacePreset(idx);
    setSurfaceFlashIdx(idx);
    setSurfaceFieldFlash(true);
  };

  const updateSurfacePreset = (idx, field, value) => {
    const next = [...surfacePresets];
    next[idx] = { ...next[idx], [field]: value };
    setSurfacePresets(next);
  };

  const addSurfacePreset = () => setSurfacePresets([...surfacePresets, { name: "", width: "", length: "" }]);

  const saveSurfaceDefaults = async () => {
    setSurfacePresetSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("surfacePresets", surfacePresets);
      setSurfacePresetSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSurfaceSaveError(err.message || String(err));
      setSurfacePresetSaveStatus("error");
    }
  };

  const setShField = (key, normalize = v => v) => value => {
    const normalized = normalize(value);
    setSh(s => ({ ...s, [key]: normalized }));
  };

  const setMat = k => setShField(k, v => clampOptionalDimension(v, 100, 8000));
  const setSurf = k => value => {
    const normalized = clampOptionalDimension(value, 100, 50000);
    setSh(s => ({ ...s, [k]: normalized }));
  };
  const setS2PanelState = patch => setSh(s => ({ ...s, offset: patch.offset !== undefined ? patch.offset : s.offset }));
  const setS4PanelState = patch => setSh(s => ({ ...s,
    s4Long: patch.s4Long !== undefined ? patch.s4Long : s.s4Long
  }));
  // s1 and s3 have no per-panel state; the fallbacks below cover them.
  const stateGetters = { s2: () => ({ offset }), s4: () => ({ s4Long }) };
  const stateSetters = { s2: setS2PanelState, s4: setS4PanelState };
  const layoutRegistry = LAYOUT_REGISTRY.map(sys => ({
    ...sys,
    description: getDescription(sys.id, sh),
    defaultOpen: false,
    getState: stateGetters[sys.id] || (() => ({})),
    setState:  stateSetters[sys.id] || (() => {}),
    compute: () => sys.compute(sh)
  }));
  // Each compute() runs a full simulate() pass, so all four together are by far
  // the most expensive thing on this page. They depend only on `sh`, which is
  // replaced wholesale by setSh — so keying the memo on it skips the work for
  // renders driven by hover, panel collapse, preset flashes and the like.
  const computedResults = React.useMemo(
    () => readiness.ready ? LAYOUT_REGISTRY.map(sys => sys.compute(sh)) : [],
    [sh, readiness.ready]
  );
  const panelResults      = readiness.ready
    ? layoutRegistry.map((layout, i) => ({ layout, result: computedResults[i] }))
    : [];
  const panelResultsById  = panelResults.reduce((acc, p) => { acc[p.layout.id] = p; return acc; }, {});
  const comparableResults = panelResults.filter(p => p.layout.includeInBest && p.result.valid);
  const best = comparableResults.length ? Math.min(...comparableResults.map(p => p.result.stats.stockPanels)) : Infinity;
  const firstBestId = comparableResults.find(p => p.result.stats.stockPanels === best)?.layout.id || null;
  const wasReadyRef = React.useRef(false);

  React.useEffect(() => {
    const becameReady = readiness.ready && !wasReadyRef.current;
    wasReadyRef.current = readiness.ready;
    if (!becameReady || !firstBestId) return;
    setPanelOpen(current => ({ ...current, [firstBestId]: true }));
  }, [firstBestId, readiness.ready, setPanelOpen]);

  return (
    <>
      <Stack id="data-control" className="data-control" gap={4}>
        <MaterialSpecification 
          sh={sh} setSh={setSh} setMat={setMat} 
          presets={presets} activePreset={activePreset} applyPreset={applyPreset} 
          fieldFlash={fieldFlash} setShowModal={setShowModal}
          activePresetDropdown={activePresetDropdown} setActivePresetDropdown={setActivePresetDropdown}
          largePreviewOpen={!!largePreview}
          showRequired={readiness.started} missing={readiness.missing}
        />
        <SurfaceInputs sh={sh} setSh={setSh} setSurf={setSurf}
          presets={surfacePresets} activePreset={activeSurfacePreset} applyPreset={applySurfacePreset}
          fieldFlash={surfaceFieldFlash} setShowModal={setShowSurfaceModal}
          showRequired={readiness.started} missing={readiness.missing}
          largePreviewOpen={!!largePreview} />
        {readiness.ready && (
          <ControlPanel id="control-settings" title="Settings" open={settingsOpen} setOpen={setSettingsOpen}>
            <LayoutSettings sh={sh} setField={setShField} setSh={setSh} markStep={markStep} />
          </ControlPanel>
        )}
      </Stack>
      {presetError && <p role="alert" className="input-error">{presetError}</p>}
      {surfacePresetError && <p role="alert" className="input-error">{surfacePresetError}</p>}
      <CutListSheet list={printList} />
      <div id="data-preview" className="data-preview">
        <PreviewSection 
          id="pattern-layouts" 
          title="Pattern Layouts"
          description="Compare four row-based layouts using the selected surface and material."
        >
          {readiness.ready ? ["s1", "s2", "s3", "s4"].map(id => {
            const panel = panelResultsById[id];
            if (!panel) return null;
            return (
              <LayoutPanel key={id} layout={panel.layout} result={panel.result}
                hoveredType={hoveredType} setHoveredType={setHoveredType}
                rowStart={rowStart}
                open={panelOpen[id]}
                setOpen={v => setPanelOpen(s => ({ ...s, [id]: v }))}
                onLargePreview={openLargePreview}
                onPrint={() => setPrintList(buildCutList(panel.result, sh, panel.layout))}
                isBest={panel.layout.includeInBest && panel.result.valid && panel.result.stats.stockPanels === best} />
            );
          }) : (
            <LayoutEmptyState
              message={!readiness.started
                ? "Choose a material preset or enter material dimensions to begin."
                : !readiness.materialComplete
                  ? "Complete the material width and length."
                  : "Choose an input preset or enter the surface width and length."}
              steps={[
                { label: "Choose or enter the material", complete: readiness.materialComplete },
                { label: "Choose or enter the surface dimensions", complete: readiness.surfaceComplete },
                { label: "Compare the rendered layouts", complete: false }
              ]}
            />
          )}
        </PreviewSection>
      </div>

      {/* ── Material Presets Modal (admin/dev only) ── */}
      {showModal && (
        <Modal title="Manage Material Presets" onClose={() => setShowModal(false)}>
              <Stack gap={4}>
                <Stack gap={3}>
                  <div className="pw-preset-header pw-preset-grid--dimensions">
                    <span>Product Name</span>
                    <span>Width mm</span>
                    <span>Length mm</span>
                    <span>&nbsp;</span>
                  </div>
                  {presets.map((p, idx) => (
                    <div key={idx} className={"pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")}>
                      <div className="pw-preset-fields pw-preset-grid--dimensions">
                        <div>
                          <span className="pw-preset-lbl-hide">Product Name</span>
                          <input
                            id={`mat-preset-name-${idx}`}
                            aria-label={`Product name ${idx}`}
                            name={`mat-preset-name-${idx}`}
                            type="text"
                            className="num-input"
                            value={p.name}
                            onChange={e => updatePreset(idx, "name", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Width mm</span>
                          <input
                            id={`mat-preset-wid-${idx}`}
                            aria-label={`Product width ${idx}`}
                            name={`mat-preset-wid-${idx}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="num-input"
                            value={p.width}
                            onChange={e => updatePreset(idx, "width", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Length mm</span>
                          <input
                            id={`mat-preset-len-${idx}`}
                            aria-label={`Product length ${idx}`}
                            name={`mat-preset-len-${idx}`}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            className="num-input"
                            value={p.length}
                            onChange={e => updatePreset(idx, "length", e.target.value)}
                          />
                        </div>
                        <div className="num-wrap" style={{ justifyContent: "center" }}>
                          <span className="pw-preset-lbl-hide">&nbsp;</span>
                          {activePreset === idx
                            ? <div className="pw-preset-badge">active</div>
                            : <button
                                className={"ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : "")}
                                onClick={() => applyPreset(p, idx)}
                                title="Apply these values to the calculator"
                              >
                                {flashIdx === idx ? <><Icon name="check" /> Applied</> : <><Icon name="check" /> Apply</>}
                              </button>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                </Stack>

                <Stack direction="row" gap={2}>
                  <button className="ctrl-dir" onClick={addPreset}>
                    <Icon name="plus" /> Add Row
                  </button>
                  <SaveDefaultsButton status={presetSaveStatus} errorMessage={saveError} onClick={saveMaterialDefaults} />
                </Stack>

                <div className="pw-formula-text">
                  Fill preset data above and click "Apply" to update the calculator, or "Save Defaults" to persist.
                </div>
              </Stack>
        </Modal>
      )}
      {showSurfaceModal && (
        <DimensionPresetManager
          title="Manage Input Presets"
          nameLabel="Configuration Name"
          idPrefix="surface-preset"
          presets={surfacePresets}
          activePreset={activeSurfacePreset}
          flashIdx={surfaceFlashIdx}
          updatePreset={updateSurfacePreset}
          applyPreset={applySurfacePreset}
          addPreset={addSurfacePreset}
          saveStatus={surfacePresetSaveStatus}
          saveError={surfaceSaveError}
          saveDefaults={saveSurfaceDefaults}
          onClose={() => setShowSurfaceModal(false)}
        />
      )}
      {readiness.ready && largePreview && (() => {
        const currentResult = panelResultsById[largePreview.layout.id]?.result || largePreview.result;
        return (
          <Modal
            title={`Large layout preview — ${largePreview.layout.title}`}
            onClose={closeLargePreview}
            className="mp-modal-large">
                <Stack gap={4}>
                  {/* ── 1. TOP: Summary Bar ── */}
                  {currentResult.summaryRows.length > 0 &&
                    <div className="summary-grid">
                      <PanelSummary rows={currentResult.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} />
                    </div>
                  }
                  
                  {/* ── 2. MIDDLE: Visualization ── */}
                    <div className="large-layout-vis-wrap data-preview">
                      <LayoutVisualization result={currentResult} hoveredType={hoveredType} setHoveredType={setHoveredType} rowStart={rowStart} maxHeight={1000} alwaysShowLabels={true} onLargePreview={closeLargePreview} />
                    </div>

                  {/* ── 3. BOTTOM: 3-Column Dashboard Split ── */}
                  <div className="large-preview-grid">
                    
                    {/* Column 1: Material & Surface (25%) */}
                    <Stack gap={4} className="u-hide-mobile">
                      <LargePreviewMaterialSpec
                        sh={sh} setSh={setSh} setMat={setMat}
                        presets={presets} activePreset={activePreset} applyPreset={applyPreset}
                        fieldFlash={fieldFlash} setShowModal={setShowModal}
                      />
                      <SurfaceInputs sh={sh} setSh={setSh} setSurf={setSurf} idPrefix="large-"
                        presets={surfacePresets} activePreset={activeSurfacePreset} applyPreset={applySurfacePreset}
                        fieldFlash={surfaceFieldFlash} isLargePreview />
                    </Stack>

                    {/* Column 2: Layout Engine (25%) */}
                    <ControlPanel id="control-settings-large" title="Layout Engine" open={true} noToggle className="form-section-card u-hide-mobile">
                      <div className="panel-data">
                        <LayoutSettings sh={sh} setField={setShField} setSh={setSh} markStep={markStep} idPrefix="large-" />
                      </div>
                    </ControlPanel>

                    {/* Column 3: Detailed Statistics (50%) */}
                    <Stack gap={4}>
                      <ControlPanel id="control-stats-large" title="Detailed Statistics" open={true} noToggle className="form-section-card">
                        <div className="panel-data">
                          {(() => {
                            const r = currentResult.rows;
                            const firstRow = rowStart === "bottom" ? r[r.length - 1] : r[0];
                            const lastRow  = rowStart === "bottom" ? r[0] : r[r.length - 1];
                            return (
                              <>
                                <Row 
                                  label={sh.direction === "V" ? "Total columns" : "Total rows"} 
                                  value={r.length} 
                                  unit={sh.direction === "V" ? "cols" : "rows"} 
                                />
                                <Row 
                                  label={sh.direction === "V" ? "Left column width" : "Top row width"} 
                                  value={firstRow?.h ?? "—"}
                                  unit="mm" 
                                />
                                <Row 
                                  label={sh.direction === "V" ? "Right column width" : "Bottom row width"} 
                                  value={lastRow?.h ?? "—"}
                                  unit="mm" 
                                />
                              </>
                            );
                          })()}
                        </div>
                      </ControlPanel>
                      <div className="pw-formula-text">
                        Advanced material analysis and optimized cut-list integration will appear here in the next update.
                      </div>
                    </Stack>

                  </div>
                </Stack>
          </Modal>
        );
      })()}
    </>
  );
}

function LayoutSettings({ sh, setField, setSh, markStep, idPrefix = "" }) {
  const { PPi, direction, minJ, startOff } = sh;
  const rowStart = sh.rowStart || "top";
  const psRaw = sh.patternStart;
  const patternStart = psRaw || (direction === "V" ? "bottom" : "left");
  
  const set = k => setField(k);

  return (
    <Stack gap={3}>
      <div className="layout-setting-card">
        <Stack gap={2}>
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">Direction</span>
            <span className="layout-setting-help">Primary layout axis for the pattern preview.</span>
          </Stack>
          <div id={`${idPrefix}ctrl-direction`} className="seg-group">
          {["V", "H"].map(s => (
            <button key={s} aria-label={s === "V" ? "Vertical" : "Horizontal"} aria-pressed={direction === s} className={"ctrl-dir " + (direction === s ? "on" : "")}
              onClick={() => { markStep("Switch direction"); setSh(st => {
                const curDir = st.direction;
                const rsKey  = curDir === "V" ? "rowStartV"     : "rowStartH";
                const psKey  = curDir === "V" ? "patternStartV" : "patternStartH";
                const trsKey = s === "V"      ? "rowStartV"     : "rowStartH";
                const tpsKey = s === "V"      ? "patternStartV" : "patternStartH";
                return {
                  ...st,
                  [rsKey]: st.rowStart,       // save current rowStart
                  [psKey]: st.patternStart || (curDir === "V" ? "bottom" : "left"), // save current patternStart
                  direction: s,
                  rowStart:     st[trsKey] || (s === "V" ? "top"    : "bottom"),
                  patternStart: st[tpsKey] || (s === "V" ? "bottom" : "left")
                };
              }); }}>{s}</button>
          ))}
          </div>
        </Stack>
      </div>
      <div className="layout-setting-card">
        <Stack gap={3}>
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">{direction === "V" ? "Column order" : "Row order"}</span>
            <div id={`${idPrefix}ctrl-row-order`} className="seg-group">
            <button className={"ctrl-dir " + (rowStart === "top" ? "on" : "")}
              onClick={() => setSh(st => ({ ...st, rowStart: "top" }))}>
              {direction === "V" ? "R1 Left" : "R1 top"}
            </button>
            <button className={"ctrl-dir " + (rowStart === "bottom" ? "on" : "")}
              onClick={() => setSh(st => ({ ...st, rowStart: "bottom" }))}>
              {direction === "V" ? "R1 Right" : "R1 bottom"}
            </button>
            </div>
          </Stack>
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">Layout Start</span>
            <div id={`${idPrefix}ctrl-pattern-start`} className="seg-group">
            {direction === "V" ? (
              <>
                <button className={"ctrl-dir " + (patternStart === "bottom" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, patternStart: "bottom" }))}>bottom</button>
                <button className={"ctrl-dir " + (patternStart === "top" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, patternStart: "top" }))}>top</button>
              </>
            ) : (
              <>
                <button className={"ctrl-dir " + (patternStart === "left" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, patternStart: "left" }))}>left</button>
                <button className={"ctrl-dir " + (patternStart === "right" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, patternStart: "right" }))}>right</button>
              </>
            )}
            </div>
          </Stack>
        </Stack>
      </div>
      <NumInput id={`${idPrefix}input-minJ`}     label="Min remainder (mm)"  value={minJ}     onChange={set("minJ")} />
      <NumInput id={`${idPrefix}input-startOff`} label="R1 start point (mm)" value={startOff}
        onChange={v => setField("startOff", v => Math.min(v, Math.max(1, PPi) - 1))(v)} min={0} />
    </Stack>
  );
}
function LargePreviewMaterialSpec({ sh, setSh, setMat, presets, activePreset, applyPreset, fieldFlash, setShowModal }) {
  const [activePresetDropdown, setActivePresetDropdown] = React.useState(null);
  return (
    <MaterialSpecification
      sh={sh} setSh={setSh} setMat={setMat}
      presets={presets} activePreset={activePreset} applyPreset={applyPreset}
      fieldFlash={fieldFlash} setShowModal={setShowModal}
      activePresetDropdown={activePresetDropdown} setActivePresetDropdown={setActivePresetDropdown}
      isLargePreview={true}
      idPrefix="large-"
    />
  );
}

function SelectedPresetDetail({ preset }) {
  if (!preset) return null;
  const dimensions = `${preset.width} × ${preset.length} mm`;
  const dimensionSuffix = new RegExp(
    `\\s*${escapeRegExp(preset.width)}\\s*[×x]\\s*${escapeRegExp(preset.length)}(?:\\s*mm)?\\s*$`,
    "i"
  );
  const displayName = String(preset.name).replace(dimensionSuffix, "").trim();
  const fullTitle = displayName ? `${displayName} — ${dimensions}` : dimensions;
  return (
    <div className="panel-preset-meta" role="status" aria-live="polite">
      <span className="panel-preset-meta-label">Preset</span>
      <span className="panel-preset-meta-value" title={fullTitle}>
        {displayName && <><span>{displayName}</span><span aria-hidden="true"> · </span></>}
        <span>{dimensions}</span>
      </span>
    </div>
  );
}

function MaterialSpecification({ sh, setMat, presets, activePreset, applyPreset, fieldFlash, setShowModal, activePresetDropdown, setActivePresetDropdown, isLargePreview = false, largePreviewOpen = false, idPrefix = "", showRequired = false, missing = new Set() }) {
  const { PLa, PPi } = sh;
  const validPresets = presets.filter(p => p.name);
  const selectedPreset = Number.isInteger(activePreset) && presets[activePreset]?.name
    ? presets[activePreset]
    : null;
  
  const widWrapRef = React.useRef(null);
  const lenWrapRef = React.useRef(null);

  // If we are in the main page but Large Preview is open, disable our click-outside
  // to prevent us from closing dropdowns that belong to the modal. This reads the
  // caller's state rather than probing the DOM: a render-time querySelector sees
  // the *previous* commit, so it cannot answer this reliably.
  const isBackground = !isLargePreview && largePreviewOpen;
  useClickOutside([widWrapRef, lenWrapRef], () => {
    setActivePresetDropdown(null);
  }, activePresetDropdown !== null && !isBackground);

  const localApply = (p) => {
    applyPreset(p, presets.indexOf(p));
    setActivePresetDropdown(null);
  };

  const { hoveredIndex: widHovered, onKeyDown: onWidKeyDown } = useDropdownKeyboard(
    activePresetDropdown === "wid" ? validPresets.length : 0,
    (idx) => localApply(validPresets[idx]),
    () => setActivePresetDropdown(null)
  );

  const { hoveredIndex: lenHovered, onKeyDown: onLenKeyDown } = useDropdownKeyboard(
    activePresetDropdown === "len" ? validPresets.length : 0,
    (idx) => localApply(validPresets[idx]),
    () => setActivePresetDropdown(null)
  );

  return (
    <ControlPanel id={`${idPrefix}control-material`} title="Material Specification" noToggle className="form-section-card"
      headerDetail={selectedPreset && <SelectedPresetDetail preset={selectedPreset} />}>
      <Stack gap={3} className="ctrl-list">
        <div className={fieldFlash ? "num-input-flash" : ""} ref={widWrapRef} style={{ position: "relative" }}>
          <NumInput
            id={`${idPrefix}input-PLa`}
            label="Width (mm)"
            labelIcon="arrow-h"
            value={PLa}
            onChange={setMat("PLa")}
            min={100}
            presetsOpen={activePresetDropdown === "wid"}
            presetHoveredIndex={widHovered}
            onTogglePresets={() => setActivePresetDropdown(open => (open === "wid" ? null : "wid"))}
            onCommit={() => setActivePresetDropdown(null)}
            onKeyDown={onWidKeyDown}
            req={showRequired && missing.has("PLa")}
          />
          {activePresetDropdown === "wid" && validPresets.length > 0 && <MaterialPresetDropdown anchorRef={widWrapRef} presets={validPresets} activePreset={activePreset} onApply={localApply} field="width" inputId={`${idPrefix}input-PLa`} hoveredIndex={widHovered} />}
        </div>
        <div className={fieldFlash ? "num-input-flash" : ""} ref={lenWrapRef} style={{ position: "relative" }}>
          <NumInput
            id={`${idPrefix}input-PPi`}
            label="Length (mm)"
            labelIcon="arrow-v"
            value={PPi}
            onChange={setMat("PPi")}
            min={100}
            presetsOpen={activePresetDropdown === "len"}
            presetHoveredIndex={lenHovered}
            onTogglePresets={() => setActivePresetDropdown(open => (open === "len" ? null : "len"))}
            onCommit={() => setActivePresetDropdown(null)}
            onKeyDown={onLenKeyDown}
            req={showRequired && missing.has("PPi")}
          />
          {activePresetDropdown === "len" && validPresets.length > 0 && <MaterialPresetDropdown anchorRef={lenWrapRef} presets={validPresets} activePreset={activePreset} onApply={localApply} field="length" inputId={`${idPrefix}input-PPi`} hoveredIndex={lenHovered} />}
        </div>
        {!isLargePreview && typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
          <button className="ctrl-dir form-section-action" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Manage Presets
          </button>
        )}
      </Stack>
    </ControlPanel>
  );
}

function DimensionPresetManager({ title, nameLabel, idPrefix, presets, activePreset, flashIdx, updatePreset, applyPreset, addPreset, saveStatus, saveError, saveDefaults, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <Stack gap={4}>
        <Stack gap={3}>
          <div className="pw-preset-header pw-preset-grid--dimensions">
            <span>{nameLabel}</span>
            <span>Width mm</span>
            <span>Length mm</span>
            <span>&nbsp;</span>
          </div>
          {presets.map((p, idx) => (
            <div key={idx} className={"pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")}>
              <div className="pw-preset-fields pw-preset-grid--dimensions">
                <div>
                  <span className="pw-preset-lbl-hide">{nameLabel}</span>
                  <input id={`${idPrefix}-name-${idx}`} name={`${idPrefix}-name-${idx}`}
                    aria-label={`${nameLabel} ${idx + 1}`} type="text" className="num-input"
                    value={p.name} onChange={e => updatePreset(idx, "name", e.target.value)} />
                </div>
                <div>
                  <span className="pw-preset-lbl-hide">Width mm</span>
                  <input id={`${idPrefix}-width-${idx}`} name={`${idPrefix}-width-${idx}`}
                    aria-label={`Preset width ${idx + 1}`} type="text" inputMode="decimal"
                    autoComplete="off" className="num-input" value={p.width}
                    onChange={e => updatePreset(idx, "width", e.target.value)} />
                </div>
                <div>
                  <span className="pw-preset-lbl-hide">Length mm</span>
                  <input id={`${idPrefix}-length-${idx}`} name={`${idPrefix}-length-${idx}`}
                    aria-label={`Preset length ${idx + 1}`} type="text" inputMode="decimal"
                    autoComplete="off" className="num-input" value={p.length}
                    onChange={e => updatePreset(idx, "length", e.target.value)} />
                </div>
                <div className="num-wrap" style={{ justifyContent: "center" }}>
                  <span className="pw-preset-lbl-hide">&nbsp;</span>
                  {activePreset === idx
                    ? <div className="pw-preset-badge">active</div>
                    : <button className={"ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : "")}
                        onClick={() => applyPreset(p, idx)} title="Apply these values to the inputs">
                        {flashIdx === idx ? <><Icon name="check" /> Applied</> : <><Icon name="check" /> Apply</>}
                      </button>}
                </div>
              </div>
            </div>
          ))}
        </Stack>
        <Stack direction="row" gap={2}>
          <button className="ctrl-dir" onClick={addPreset}><Icon name="plus" /> Add Row</button>
          <SaveDefaultsButton status={saveStatus} errorMessage={saveError} onClick={saveDefaults} />
        </Stack>
        <div className="pw-formula-text">
          Fill preset data above and click "Apply" to update the inputs, or "Save Defaults" to persist.
        </div>
      </Stack>
    </Modal>
  );
}

function SurfaceInputs({ sh, setSurf, presets = [], activePreset, applyPreset, fieldFlash = false, setShowModal, idPrefix = "", showRequired = false, missing = new Set(), isLargePreview = false, largePreviewOpen = false }) {
  const { W, H } = sh;
  const validPresets = presets.filter(p => p.name);
  const selectedPreset = Number.isInteger(activePreset) && presets[activePreset]?.name
    ? presets[activePreset]
    : null;
  const [activeDropdown, setActiveDropdown] = React.useState(null);
  const widthWrapRef = React.useRef(null);
  const lengthWrapRef = React.useRef(null);
  const isBackground = !isLargePreview && largePreviewOpen;

  useClickOutside([widthWrapRef, lengthWrapRef], () => setActiveDropdown(null),
    activeDropdown !== null && !isBackground);

  const localApply = (preset) => {
    applyPreset(preset, presets.indexOf(preset));
    setActiveDropdown(null);
  };
  const { hoveredIndex: widthHovered, onKeyDown: onWidthKeyDown } = useDropdownKeyboard(
    activeDropdown === "width" ? validPresets.length : 0,
    idx => localApply(validPresets[idx]),
    () => setActiveDropdown(null)
  );
  const { hoveredIndex: lengthHovered, onKeyDown: onLengthKeyDown } = useDropdownKeyboard(
    activeDropdown === "length" ? validPresets.length : 0,
    idx => localApply(validPresets[idx]),
    () => setActiveDropdown(null)
  );

  return (
    <ControlPanel id={`${idPrefix}control-surface`} title="Inputs" noToggle className="form-section-card"
      headerDetail={selectedPreset && <SelectedPresetDetail preset={selectedPreset} />}>
      <Stack gap={3} className="ctrl-list">
        <div className={fieldFlash ? "num-input-flash" : ""} ref={widthWrapRef} style={{ position: "relative" }}>
          <NumInput id={`${idPrefix}input-W`} label="Width — horizontal (mm)" labelIcon="arrow-h" value={W}
            onChange={setSurf("W")} req={showRequired && missing.has("W")}
            presetsOpen={activeDropdown === "width"} presetHoveredIndex={widthHovered}
            onTogglePresets={() => setActiveDropdown(open => open === "width" ? null : "width")}
            onCommit={() => setActiveDropdown(null)} onKeyDown={onWidthKeyDown} />
          {activeDropdown === "width" && validPresets.length > 0 && (
            <MaterialPresetDropdown anchorRef={widthWrapRef} presets={validPresets} activePreset={activePreset}
              onApply={localApply} field="width" inputId={`${idPrefix}input-W`} hoveredIndex={widthHovered}
              title="Input Presets" />
          )}
        </div>
        <div className={fieldFlash ? "num-input-flash" : ""} ref={lengthWrapRef} style={{ position: "relative" }}>
          <NumInput id={`${idPrefix}input-H`} label="Length — vertical (mm)" labelIcon="arrow-v" value={H}
            onChange={setSurf("H")} req={showRequired && missing.has("H")}
            presetsOpen={activeDropdown === "length"} presetHoveredIndex={lengthHovered}
            onTogglePresets={() => setActiveDropdown(open => open === "length" ? null : "length")}
            onCommit={() => setActiveDropdown(null)} onKeyDown={onLengthKeyDown} />
          {activeDropdown === "length" && validPresets.length > 0 && (
            <MaterialPresetDropdown anchorRef={lengthWrapRef} presets={validPresets} activePreset={activePreset}
              onApply={localApply} field="length" inputId={`${idPrefix}input-H`} hoveredIndex={lengthHovered}
              title="Input Presets" />
          )}
        </div>
        {!isLargePreview && typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
          <button className="ctrl-dir form-section-action" onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Manage Presets
          </button>
        )}
      </Stack>
    </ControlPanel>
  );
}

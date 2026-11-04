import { React } from "../react-globals.js";
import { LAYOUT_REGISTRY } from "../Controls.jsx";
import { ControlPanel, NumInput, Row, SegGroup, SelectedPresetDetail, Stack, clampNumber, isMobileViewport, useDocHistory, Modal } from "../shared.jsx";
import { ManagePresetsButton, PresetField, PresetManager, usePresetLibrary } from "./PresetLibrary.jsx";
import { useSessionState } from "../utils/session-state.js";
import { LayoutEmptyState, LayoutPanel, LayoutVisualization, PanelSummary, PreviewSection } from "../Visualization.jsx";
import { CutListSheet } from "./CutListSheet.jsx";
import { parseMeasurement } from "../utils/measurements.cjs";
import { buildCutList } from "../utils/cut-list.js";
import { ProjectSection } from "./ProjectMenu.jsx";

const hasValue = value => value !== "" && value !== null && value !== undefined;
const validDimension = (value, min, max) => {
  const parsed = parseMeasurement(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};
// Blank or unparseable is missing, not the minimum: a layout drawn for a value
// nobody entered is worse than none.
const clampOptionalDimension = (value, min, max) => {
  const n = parseMeasurement(value);
  return Number.isFinite(n) ? clampNumber(n, min, max, min) : "";
};
const dimensionsMatch = (actual, expected) => parseMeasurement(actual) === parseMeasurement(expected);

/* The page's two preset libraries, on the shared preset system
   (PresetLibrary.jsx) that Concrete and Gypsum use: materials (the stock) and
   inputs (the surface). Both are a width and a length, so they share a shape;
   they are kept apart because one describes the job and the other the stock.
   The lists and the applied presets are drafts, so they are kept with the
   page's other values and in its projects. The save keys and id prefixes are
   the ones the page always used. */
const sizeLibrary = ({ max, message, ...lib }) => ({
  ...lib,
  columns: [["width", "Width mm", "Width"], ["length", "Length mm", "Length"]],
  required: ["width", "length"],
  requiredText: "a width and a length",
  grid: "pw-preset-grid--dimensions",
  validate: v => ([v.width, v.length].every(n => Number.isFinite(n) && n >= 100 && n <= max) ? null : message)
});
export const MATERIAL_LIBRARY = sizeLibrary({
  id: "material", title: "Material Presets", saveKey: "materialPresets",
  draftKey: "SurfaceLayout.jsx:materialPresets", idBase: "mat-preset", max: 8000,
  message: "Material dimensions must be between 100 and 8000 mm.",
  defaults: () => (typeof DEFAULT_MATERIAL_PRESETS !== "undefined" ? DEFAULT_MATERIAL_PRESETS : [{ name: "", length: 300, width: 300 }])
});
export const SURFACE_LIBRARY = sizeLibrary({
  id: "surface", title: "Input Presets", nameLabel: "Configuration Name", saveKey: "surfacePresets",
  draftKey: "SurfaceLayout.jsx:surfacePresets", idBase: "surface-preset", max: 50000,
  message: "Surface dimensions must be between 100 and 50000 mm.",
  defaults: () => (typeof DEFAULT_SURFACE_PRESETS !== "undefined" ? DEFAULT_SURFACE_PRESETS
    : [{ name: "Viz-card development 1390×2200", width: 1390, length: 2200 }])
});

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
  // A type such as "full" exists in every system. Keep its owner alongside
  // the type so hovering S1 cannot also light matching pieces in S2–S4.
  const [hoveredHighlight, setHoveredHighlight] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(() => !isMobileViewport());

  const [activeMaterial, setActiveMaterial] = useSessionState("SurfaceLayout.jsx:activeMaterial", null);
  const [activeSurface, setActiveSurface] = useSessionState("SurfaceLayout.jsx:activeSurface", null);
  const [largePreview, setLargePreview] = React.useState(null);

  // Selection describes the values, not focus timing. A dropdown applies both
  // dimensions while its input still owns focus; that input can later blur and
  // commit the same value from an older render. Derive invalidation from the
  // resulting pair so that no-op commits preserve the title and real edits do not.
  const keepWhileMatching = (active, setActive, list, width, length) => () => {
    if (active === null) return;
    const preset = list[active];
    if (!preset || !dimensionsMatch(width, preset.width) || !dimensionsMatch(length, preset.length)) setActive(null);
  };

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
  const hoveredTypeFor = layoutId => hoveredHighlight?.layoutId === layoutId ? hoveredHighlight.type : null;
  const setHoveredTypeFor = layoutId => type => setHoveredHighlight(type ? { layoutId, type } : null);

  /* `sh` is the document every pattern-layout page edits, so the key is the
     document rather than the route: moving between layout systems keeps the
     history, because the thing you could undo is still on screen. The preset
     highlight, the flash and the open preview are view state and stay out. */
  const markStep = useDocHistory({
    key: "surface-layout",
    snapshot: () => sh,
    apply: setSh
  });

  /* Applying a preset is an undo step: it overwrites two dimensions you may
     have typed. */
  const material = usePresetLibrary(MATERIAL_LIBRARY, {
    active: activeMaterial, setActive: setActiveMaterial,
    onApply: v => { markStep("Apply preset"); setSh(s => ({ ...s, PLa: v.width, PPi: v.length })); }
  });
  const surface = usePresetLibrary(SURFACE_LIBRARY, {
    active: activeSurface, setActive: setActiveSurface,
    onApply: v => { markStep("Apply input preset"); setSh(s => ({ ...s, W: v.width, H: v.length })); }
  });
  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(keepWhileMatching(activeMaterial, setActiveMaterial, material.presets, sh.PLa, sh.PPi),
    [activeMaterial, material.presets, sh.PLa, sh.PPi]);
  React.useEffect(keepWhileMatching(activeSurface, setActiveSurface, surface.presets, sh.W, sh.H),
    [activeSurface, surface.presets, sh.W, sh.H]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
    getState: stateGetters[sys.id] || (() => ({})),
    setState:  stateSetters[sys.id] || (() => {})
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
        <ProjectSection />
        <MaterialCard sh={sh} library={material} onChange={setMat}
          showRequired={readiness.started} missing={readiness.missing} />
        <SurfaceCard sh={sh} library={surface} onChange={setSurf}
          showRequired={readiness.started} missing={readiness.missing} />
        {readiness.ready && (
          <button type="button" className="num-btn pattern-results-link"
            onClick={() => {
              const preview = document.getElementById("data-preview");
              preview?.scrollIntoView({ block: "start" });
              preview?.focus({ preventScroll: true });
            }}>
            View layouts
          </button>
        )}
        {readiness.ready && (
          <ControlPanel id="control-settings" title="Settings" open={settingsOpen} setOpen={setSettingsOpen}>
            <LayoutSettings sh={sh} setField={setShField} setSh={setSh} markStep={markStep} />
          </ControlPanel>
        )}
      </Stack>
      <CutListSheet list={printList} />
      <div id="data-preview" className="data-preview" role="region" aria-label="Pattern layout results" tabIndex={-1}>
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
                hoveredType={hoveredTypeFor(id)} setHoveredType={setHoveredTypeFor(id)}
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

      <PresetManager library={material} />
      <PresetManager library={surface} />
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
                      <PanelSummary rows={currentResult.summaryRows} hoveredType={hoveredTypeFor(largePreview.layout.id)} setHoveredType={setHoveredTypeFor(largePreview.layout.id)} />
                    </div>
                  }
                  
                  {/* ── 2. MIDDLE: Visualization ── */}
                    <div className="large-layout-vis-wrap data-preview">
                      <LayoutVisualization result={currentResult} hoveredType={hoveredTypeFor(largePreview.layout.id)} setHoveredType={setHoveredTypeFor(largePreview.layout.id)} rowStart={rowStart} maxHeight={1000} alwaysShowLabels={true} onLargePreview={closeLargePreview} />
                    </div>

                  {/* ── 3. BOTTOM: 3-Column Dashboard Split ── */}
                  <div className="large-preview-grid">
                    
                    {/* Column 1: Material & Surface (25%) */}
                    <Stack gap={4} className="u-hide-mobile">
                      <MaterialCard sh={sh} library={material} onChange={setMat} idPrefix="large-" manage={false} />
                      <SurfaceCard sh={sh} library={surface} onChange={setSurf} idPrefix="large-" manage={false} />
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
  const { PPi, direction, minJ, startOff, gap, horizontalGap, verticalGap } = sh;
  // Old saved jobs used directional values without an explicit mode. Preserve
  // those choices rather than making them silently disappear on first open.
  const separateGaps = sh.separateGaps ?? (horizontalGap !== "" || verticalGap !== "");
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
          <SegGroup id={`${idPrefix}ctrl-direction`} label="Direction" value={direction}
            options={[["V", "V", "Vertical"], ["H", "H", "Horizontal"]]}
            onChange={s => { markStep("Switch direction"); setSh(st => {
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
              }); }} />
        </Stack>
      </div>
      <div className="layout-setting-card">
        <Stack gap={3}>
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">{direction === "V" ? "Column order" : "Row order"}</span>
            <SegGroup id={`${idPrefix}ctrl-row-order`} label={direction === "V" ? "Column order" : "Row order"}
              value={rowStart} onChange={v => setSh(st => ({ ...st, rowStart: v }))}
              options={direction === "V"
                ? [["top", "R1 Left"], ["bottom", "R1 Right"]]
                : [["top", "R1 top"], ["bottom", "R1 bottom"]]} />
          </Stack>
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">Layout Start</span>
            <SegGroup id={`${idPrefix}ctrl-pattern-start`} label="Layout start"
              value={patternStart} onChange={v => setSh(st => ({ ...st, patternStart: v }))}
              options={direction === "V"
                ? [["bottom", "bottom"], ["top", "top"]]
                : [["left", "left"], ["right", "right"]]} />
          </Stack>
        </Stack>
      </div>
      <div className="layout-setting-card">
        <Stack gap={3}>
          <NumInput id={`${idPrefix}input-gap`} label="Gap (mm)" value={gap} onChange={set("gap")} min={0} />
          <Stack gap={1} className="ctrl-lbl">
            <span className="ctrl-sublbl">Gap direction</span>
            <SegGroup id={`${idPrefix}ctrl-gap-direction`} label="Gap direction"
              value={separateGaps ? "separate" : "shared"} options={[["shared", "Shared"], ["separate", "Separate"]]}
              onChange={v => {
                markStep(v === "separate" ? "Use separate gaps" : "Use shared gap");
                setSh(st => ({ ...st, separateGaps: v === "separate" }));
              }} />
          </Stack>
          {separateGaps && (
            <Stack gap={2}>
              <NumInput id={`${idPrefix}input-horizontal-gap`} label="Horizontal gap (mm)" value={horizontalGap}
                onChange={set("horizontalGap")} min={0} />
              <NumInput id={`${idPrefix}input-vertical-gap`} label="Vertical gap (mm)" value={verticalGap}
                onChange={set("verticalGap")} min={0} />
            </Stack>
          )}
        </Stack>
      </div>
      <NumInput id={`${idPrefix}input-minJ`}     label="Min remainder (mm)"  value={minJ}     onChange={set("minJ")} />
      <NumInput id={`${idPrefix}input-startOff`} label="R1 start point (mm)" value={startOff}
        onChange={v => setField("startOff", v => Math.min(v, Math.max(1, PPi) - 1))(v)} min={0} />
    </Stack>
  );
}
/* One card of two sizes with their preset list: the material, or the surface.
   Each field opens the library's list (PresetField); the applied preset is
   named above the fields, and a preset that cannot be applied says why under
   the card, where the field you used is, not elsewhere on the page. */
function DimensionCard({ id, title, library, fields, values, onChange, showRequired = false, missing = new Set(), manage = true }) {
  return (
    <>
      <ControlPanel id={id} title={title} noToggle className="form-section-card"
        headerDetail={library.selected && <SelectedPresetDetail preset={library.selected} />}>
        <Stack gap={3} className="ctrl-list">
          {fields.map(f => (
            <PresetField key={f.key} library={library} field={f.field} id={f.id} label={f.label} labelIcon={f.icon}
              value={values[f.key]} min={100} max={f.max} onChange={onChange(f.key)}
              req={showRequired && missing.has(f.key)} />
          ))}
          {manage && <ManagePresetsButton library={library} />}
        </Stack>
      </ControlPanel>
      {library.error && !library.managing && <p role="alert" className="input-error">{library.error}</p>}
    </>
  );
}

function MaterialCard({ sh, library, onChange, idPrefix = "", ...rest }) {
  return (
    <DimensionCard id={`${idPrefix}control-material`} title="Material Specification" library={library}
      values={sh} onChange={onChange} {...rest}
      fields={[
        { key: "PLa", field: "width", id: `${idPrefix}input-PLa`, label: "Width (mm)", icon: "arrow-h", max: 8000 },
        { key: "PPi", field: "length", id: `${idPrefix}input-PPi`, label: "Length (mm)", icon: "arrow-v", max: 8000 }
      ]} />
  );
}

function SurfaceCard({ sh, library, onChange, idPrefix = "", ...rest }) {
  return (
    <DimensionCard id={`${idPrefix}control-surface`} title="Inputs" library={library}
      values={sh} onChange={onChange} {...rest}
      fields={[
        { key: "W", field: "width", id: `${idPrefix}input-W`, label: "Width — horizontal (mm)", icon: "arrow-h", max: 50000 },
        { key: "H", field: "length", id: `${idPrefix}input-H`, label: "Length — vertical (mm)", icon: "arrow-v", max: 50000 }
      ]} />
  );
}

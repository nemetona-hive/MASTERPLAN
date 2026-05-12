function SheetSurfaceLayout({ sh, setSh, panelOpen, setPanelOpen }) {
  const { W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, patternStart: psRaw } = sh;
  const rowStart = sh.rowStart || "top";
  const patternStart = psRaw || (direction === "V" ? "bottom" : "left");
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

  const openLargePreview = (layout, result) => setLargePreview({ layout, result });
  const closeLargePreview = () => setLargePreview(null);

  const applyPreset = (p, idx) => {
    setSh(s => ({ ...s, PPi: p.length, PLa: p.width }));
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
      setPresetSaveStatus("error");
    }
  };

  const setShField = (key, normalize = v => v, resetActive = false) => value => {
    setSh(s => ({ ...s, [key]: normalize(value) }));
    if (resetActive) setActivePreset(null);
  };

  const set = k => setShField(k, v => v, true);
  const setMat = k => setShField(k, v => clampNumber(v, 100, 8000, 100), true);
  const setSurf = k => setShField(k, v => clampNumber(v, 100, 50000, 100));
  const setS2PanelState = patch => setSh(s => ({ ...s, offset: patch.offset !== undefined ? patch.offset : s.offset }));
  const setS4PanelState = patch => setSh(s => ({ ...s,
    s4Long: patch.s4Long !== undefined ? patch.s4Long : s.s4Long
  }));
  const stateGetters = { s1: () => ({}), s2: () => ({ offset }), s3: () => ({}), s4: () => ({ s4Long }) };
  const stateSetters = { s1: () => {}, s2: setS2PanelState, s3: () => {}, s4: setS4PanelState };
  const layoutRegistry = LAYOUT_REGISTRY.map(sys => ({
    ...sys,
    description: getDescription(sys.id, sh),
    defaultOpen: false,
    getState: stateGetters[sys.id] || (() => ({})),
    setState:  stateSetters[sys.id] || (() => {}),
    compute: () => sys.compute(sh)
  }));
  const panelResults      = layoutRegistry.map(layout => ({ layout, result: layout.compute() }));
  const panelResultsById  = panelResults.reduce((acc, p) => { acc[p.layout.id] = p; return acc; }, {});
  const comparableResults = panelResults.filter(p => p.layout.includeInBest && p.result.valid);
  const best = comparableResults.length ? Math.min(...comparableResults.map(p => p.result.stats.total)) : Infinity;

  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) {
    return (
      <>
        <Stack id="data-control" className="data-control" gap={3}>
          <MaterialSpecification 
            sh={sh} setSh={setSh} setMat={setMat} 
            presets={presets} activePreset={activePreset} applyPreset={applyPreset} 
            fieldFlash={fieldFlash} setShowModal={setShowModal}
          />
          <SurfaceInputs sh={sh} setSh={setSh} setSurf={setSurf} />
        </Stack>
        <div id="data-preview" className="data-preview">
          <p className="desc">Select all input values - all must be greater than 0!</p>
        </div>
      </>
    );
  }
  return (
    <>
      <Stack id="data-control" className="data-control" gap={3}>
        <MaterialSpecification 
          sh={sh} setSh={setSh} setMat={setMat} 
          presets={presets} activePreset={activePreset} applyPreset={applyPreset} 
          fieldFlash={fieldFlash} setShowModal={setShowModal}
        />
        <SurfaceInputs sh={sh} setSh={setSh} setSurf={setSurf} />
        <ControlPanel id="control-settings" title="Settings" open={settingsOpen} setOpen={setSettingsOpen}>
          <LayoutSettings sh={sh} setField={setShField} setSh={setSh} />
        </ControlPanel>
      </Stack>
      <div id="data-preview" className="data-preview">
        <PreviewSection 
          id="pattern-layouts" 
          title="Pattern Layouts"
          description="Compare row-based layouts that share the same surface and material settings."
        >
          {["s1", "s2", "s3", "s4"].map(id => {
            const panel = panelResultsById[id];
            if (!panel) return null;
            return (
              <LayoutPanel key={id} layout={panel.layout} result={panel.result}
                hoveredType={hoveredType} setHoveredType={setHoveredType}
                rowStart={rowStart}
                open={panelOpen[id]}
                setOpen={v => setPanelOpen(s => ({ ...s, [id]: v }))}
                onLargePreview={openLargePreview}
                isBest={panel.layout.includeInBest && panel.result.valid && panel.result.stats.total === best} />
            );
          })}
        </PreviewSection>
      </div>

      {/* ── Material Presets Modal (admin/dev only) ── */}
      {showModal && (
        <div className="mp-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="mp-modal">
            <div className="mp-modal-head">
              <span>Manage Material Presets</span>
              <button className="mp-modal-close" onClick={() => setShowModal(false)}>
                <Icon name="minus" />
              </button>
            </div>
            <div className="mp-modal-body">
              <Stack gap={4}>
                <Stack gap={3}>
                  <div className="pw-preset-header" style={{ gridTemplateColumns: "2.2fr 1fr 1fr 84px" }}>
                    <span>Product Name</span>
                    <span>Width mm</span>
                    <span>Length mm</span>
                    <span>&nbsp;</span>
                  </div>
                  {presets.map((p, idx) => (
                    <div key={idx} className={"pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")}>
                      <div className="pw-preset-fields" style={{ gridTemplateColumns: "2.2fr 1fr 1fr 84px" }}>
                        <div>
                          <span className="pw-preset-lbl-hide">Product Name</span>
                          <input
                            id={`mat-preset-name-${idx}`}
                            name={`mat-preset-name-${idx}`}
                            type="text"
                            className="num-input"
                            placeholder="e.g. Standard Tile 300×300"
                            value={p.name}
                            onChange={e => updatePreset(idx, "name", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Width mm</span>
                          <input
                            id={`mat-preset-wid-${idx}`}
                            name={`mat-preset-wid-${idx}`}
                            type="number"
                            className="num-input"
                            value={p.width}
                            onChange={e => updatePreset(idx, "width", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Length mm</span>
                          <input
                            id={`mat-preset-len-${idx}`}
                            name={`mat-preset-len-${idx}`}
                            type="number"
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
                  <SaveDefaultsButton status={presetSaveStatus} onClick={saveMaterialDefaults} />
                </Stack>

                <div className="pw-formula-text" style={{ opacity: 0.7 }}>
                  Fill preset data above and click "Apply" to update the calculator, or "Save Defaults" to persist.
                </div>
              </Stack>
            </div>
          </div>
        </div>
      )}
      {largePreview && (() => {
        const currentResult = panelResultsById[largePreview.layout.id]?.result || largePreview.result;
        return (
          <div className="mp-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeLargePreview(); }}>
            <div className="mp-modal mp-modal-large">
              <div className="mp-modal-head">
                <span>Large layout preview — {largePreview.layout.title}</span>
                <button className="mp-modal-close" onClick={closeLargePreview}>
                  <Icon name="minus" />
                </button>
              </div>
              <div className="mp-modal-body">
                <Stack gap={4}>
                  {currentResult.summaryRows.length > 0 &&
                    <PanelSummary rows={currentResult.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} />}
                  <div className={`large-layout-vis-wrap data-preview`}>
                    <LayoutVisualization result={currentResult} hoveredType={hoveredType} setHoveredType={setHoveredType} rowStart={rowStart} maxHeight={760} alwaysShowLabels={true} onLargePreview={closeLargePreview} />
                  </div>
                  <div className="layout-split" style={{ gridTemplateColumns: "1fr 1fr 2fr", marginTop: "var(--sp-2)", alignItems: "stretch" }}>
                    <Stack gap={4}>
                      <MaterialSpecification 
                        sh={sh} setSh={setSh} setMat={setMat} 
                        presets={presets} activePreset={activePreset} applyPreset={applyPreset} 
                        fieldFlash={fieldFlash} setShowModal={setShowModal}
                      />
                      <SurfaceInputs sh={sh} setSh={setSh} setSurf={setSurf} />
                    </Stack>
                    <div className="control-panel" style={{ margin: 0, height: "100%" }}>
                      <div className="panel-head"><span>Layout Settings</span></div>
                      <div className="panel-data">
                        <LayoutSettings sh={sh} setField={setShField} setSh={setSh} />
                      </div>
                    </div>
                    <div className="control-panel" style={{ margin: 0, height: "100%" }}>
                      <div className="panel-head"><span>Detailed Statistics</span></div>
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
                                value={firstRow.h} 
                                unit="mm" 
                              />
                              <Row 
                                label={sh.direction === "V" ? "Right column width" : "Bottom row width"} 
                                value={lastRow.h} 
                                unit="mm" 
                              />
                            </>
                          );
                        })()}
                        <div className="pw-formula-text" style={{ opacity: 0.6, marginTop: "var(--sp-2)" }}>
                          Advanced material analysis will appear here.
                        </div>
                      </div>
                    </div>
                  </div>
                </Stack>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function LayoutSettings({ sh, setField, setSh }) {
  const { PPi, direction, minJ, startOff } = sh;
  const rowStart = sh.rowStart || "top";
  const psRaw = sh.patternStart;
  const patternStart = psRaw || (direction === "V" ? "bottom" : "left");
  
  const set = k => setField(k);

  return (
    <Stack gap={3}>
      <Stack gap={1} className="ctrl-lbl">
        <span className="ctrl-sublbl">Direction</span>
        <div id="ctrl-direction" className="seg-group">
          {["V", "H"].map(s => (
            <button key={s} className={"ctrl-dir " + (direction === s ? "on" : "")}
              onClick={() => setSh(st => {
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
              })}>{s}</button>
          ))}
        </div>
      </Stack>
      <Stack gap={1} className="ctrl-lbl">
        <span className="ctrl-sublbl">{direction === "V" ? "Column order" : "Row order"}</span>
        <div id="ctrl-row-order" className="seg-group">
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
        <div id="ctrl-pattern-start" className="seg-group">
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
      <NumInput id="input-minJ"     label="Min remainder (mm)"  value={minJ}     onChange={set("minJ")}    step={10} />
      <NumInput id="input-startOff" label="R1 start point (mm)" value={startOff}
        onChange={v => setField("startOff", v => Math.min(v, Math.max(1, PPi) - 1))(v)} step={10} min={0} />
    </Stack>
  );
}
function MaterialSpecification({ sh, setMat, presets, activePreset, applyPreset, fieldFlash, setShowModal }) {
  const [activePresetDropdown, setActivePresetDropdown] = React.useState(null);
  const { PLa, PPi } = sh;
  const validPresets = presets.filter(p => p.name);
  
  const widWrapRef = React.useRef(null);
  const lenWrapRef = React.useRef(null);

  useClickOutside([widWrapRef, lenWrapRef], () => {
    setActivePresetDropdown(null);
  });

  const localApply = (p, idx) => {
    applyPreset(p, idx);
    setActivePresetDropdown(null);
  };

  const { hoveredIndex: widHovered, onKeyDown: onWidKeyDown } = useDropdownKeyboard(
    activePresetDropdown === "wid" ? validPresets.length : 0,
    (idx) => localApply(validPresets[idx], presets.indexOf(validPresets[idx])),
    () => setActivePresetDropdown(null)
  );

  const { hoveredIndex: lenHovered, onKeyDown: onLenKeyDown } = useDropdownKeyboard(
    activePresetDropdown === "len" ? validPresets.length : 0,
    (idx) => localApply(validPresets[idx], presets.indexOf(validPresets[idx])),
    () => setActivePresetDropdown(null)
  );

  return (
    <ControlPanel id="control-material" title="Material Specification" noToggle>
      <Stack gap={3}>
        <div className={fieldFlash ? "num-input-flash" : ""} ref={widWrapRef} style={{ position: "relative" }}>
          <NumInput
            id="input-PLa"
            label="Width (mm)"
            labelIcon="arrow-h"
            value={PLa}
            onChange={setMat("PLa")}
            step={10}
            min={100}
            onFocus={() => setActivePresetDropdown("wid")}
            onCommit={() => setActivePresetDropdown(null)}
            onKeyDown={onWidKeyDown}
          />
          {activePresetDropdown === "wid" && validPresets.length > 0 && <MaterialPresetDropdown anchorRef={widWrapRef} presets={validPresets} activePreset={activePreset} onApply={localApply} field="width" hoveredIndex={widHovered} />}
        </div>
        <div className={fieldFlash ? "num-input-flash" : ""} ref={lenWrapRef} style={{ position: "relative" }}>
          <NumInput
            id="input-PPi"
            label="Length (mm)"
            labelIcon="arrow-v"
            value={PPi}
            onChange={setMat("PPi")}
            step={10}
            min={100}
            onFocus={() => setActivePresetDropdown("len")}
            onCommit={() => setActivePresetDropdown(null)}
            onKeyDown={onLenKeyDown}
          />
          {activePresetDropdown === "len" && validPresets.length > 0 && <MaterialPresetDropdown anchorRef={lenWrapRef} presets={validPresets} activePreset={activePreset} onApply={localApply} field="length" hoveredIndex={lenHovered} />}
        </div>
        {typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
          <button className="ctrl-dir" style={{ marginTop: "var(--sp-1)" }} onClick={() => setShowModal(true)}>
            <Icon name="plus" /> Manage Presets
          </button>
        )}
      </Stack>
    </ControlPanel>
  );
}

function SurfaceInputs({ sh, setSh, setSurf }) {
  const { W, H } = sh;
  return (
    <ControlPanel id="control-surface" title="Inputs" noToggle>
      <Stack gap={3}>
        <NumInput id="input-W" label="Width — horizontal (mm)"  labelIcon="arrow-h" value={W} onChange={setSurf("W")} step={10} />
        <NumInput id="input-H" label="Length — vertical (mm)" labelIcon="arrow-v" value={H} onChange={setSurf("H")} step={10} />
      </Stack>
    </ControlPanel>
  );
}

function SheetSurfaceLayout({ sh, setSh, panelOpen, setPanelOpen }) {
  const { W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long } = sh;
  const rowStart = sh.rowStart || "top";
  const [hoveredType, setHoveredType] = React.useState(null);
  const [materialOpen, setMaterialOpen] = React.useState(true);
  const [surfaceOpen,  setSurfaceOpen]  = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(true);

  // ── Material presets ───────────────────────────────────────────────────────
  const [presets, setPresets] = React.useState(() =>
    (typeof DEFAULT_MATERIAL_PRESETS !== "undefined"
      ? DEFAULT_MATERIAL_PRESETS
      : [{ name: "", length: 300, width: 300 }]
    ).map(p => ({ ...p }))
  );
  const [activePreset,    setActivePreset]    = React.useState(null);
  const [flashIdx,        setFlashIdx]        = React.useState(null);
  const [showLenDropdown, setShowLenDropdown] = React.useState(false);
  const [showWidDropdown, setShowWidDropdown] = React.useState(false);
  const [showModal,       setShowModal]       = React.useState(false);
  const [largePreview,    setLargePreview]    = React.useState(null);
  const [fieldFlash,      setFieldFlash]      = React.useState(false);
  const [presetSaveStatus, setPresetSaveStatus] = React.useState("");

  const openLargePreview = (layout, result) => setLargePreview({ layout, result });
  const closeLargePreview = () => setLargePreview(null);

  const flashTimerRef  = React.useRef(null);
  const fieldTimerRef  = React.useRef(null);
  const lenWrapRef     = React.useRef(null);
  const widWrapRef     = React.useRef(null);

  React.useEffect(() => {
    const onClickOutside = e => {
      if (lenWrapRef.current && !lenWrapRef.current.contains(e.target)) setShowLenDropdown(false);
      if (widWrapRef.current && !widWrapRef.current.contains(e.target)) setShowWidDropdown(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      clearTimeout(flashTimerRef.current);
      clearTimeout(fieldTimerRef.current);
    };
  }, []);

  const applyPreset = (p, idx) => {
    setSh(s => ({ ...s, PPi: p.length, PLa: p.width }));
    setActivePreset(idx);
    setShowLenDropdown(false);
    setShowWidDropdown(false);
    clearTimeout(flashTimerRef.current);
    setFlashIdx(idx);
    flashTimerRef.current = setTimeout(() => setFlashIdx(null), 1200);
    clearTimeout(fieldTimerRef.current);
    setFieldFlash(true);
    fieldTimerRef.current = setTimeout(() => setFieldFlash(false), 900);
  };

  const updatePreset = (idx, field, val) => {
    const next = [...presets];
    next[idx] = { ...next[idx], [field]: val };
    setPresets(next);
  };

  const addPreset = () => setPresets([...presets, { name: "", length: "", width: "" }]);

  const saveMaterialDefaults = async () => {
    setPresetSaveStatus("saving");
    try {
      await saveStaticDefaults("materialPresets", presets);
      setPresetSaveStatus("saved");
      setTimeout(() => setPresetSaveStatus(""), 2500);
    } catch (err) {
      console.error(err);
      setPresetSaveStatus("error");
      setTimeout(() => setPresetSaveStatus(""), 3500);
    }
  };

  const set = k => v => { setSh(s => ({ ...s, [k]: v })); setActivePreset(null); };
  const setMat = k => v => { setSh(s => ({ ...s, [k]: Math.max(100, Math.min(50000, Number(v) || 100)) })); setActivePreset(null); };
  const setSurf = k => v => { setSh(s => ({ ...s, [k]: Math.max(100, Math.min(50000, Number(v) || 100)) })); };
  const setS2PanelState = patch => setSh(s => ({ ...s, offset:  patch.offset  !== undefined ? patch.offset  : s.offset }));
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
          <Stack gap={1}>
            <SLabel>Material Specification</SLabel>
            <div ref={widWrapRef} style={{ position: "relative" }}>
              <NumInput id="input-PLa" label="Width (mm)"  labelIcon="arrow-h" min={100} value={Math.max(100, PLa)} onChange={setMat("PLa")} step={10} />
              {showWidDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={widWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="width" />}
            </div>
            <div ref={lenWrapRef} style={{ position: "relative" }}>
              <NumInput id="input-PPi" label="Length (mm)" labelIcon="arrow-v" min={100} value={Math.max(100, PPi)} onChange={setMat("PPi")} step={10} />
              {showLenDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={lenWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="length" />}
            </div>
          </Stack>
          <Stack gap={1}>
            <SLabel>Surface Area</SLabel>
            <NumInput id="input-W" label="Width — horizontal (mm)"  labelIcon="arrow-h" value={Math.max(100, W)} onChange={setSurf("W")} step={10} />
            <NumInput id="input-H" label="Length — vertical (mm)" labelIcon="arrow-v" value={Math.max(100, H)} onChange={setSurf("H")} step={10} />
          </Stack>
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
        <ControlPanel id="control-material" title="Material Specification" open={materialOpen} setOpen={setMaterialOpen} noToggle>
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
                onFocus={() => { setShowWidDropdown(true); setShowLenDropdown(false); }}
              />
              {showWidDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={widWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="width" />}
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
                onFocus={() => { setShowLenDropdown(true); setShowWidDropdown(false); }}
              />
              {showLenDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={lenWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="length" />}
            </div>
            {typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
              <button className="ctrl-dir" style={{ marginTop: "var(--sp-1)" }} onClick={() => setShowModal(true)}>
                <Icon name="plus" /> Manage Presets
              </button>
            )}
          </Stack>
        </ControlPanel>
        <ControlPanel id="control-surface" title="Inputs" open={surfaceOpen} setOpen={setSurfaceOpen} noToggle>
          <Stack gap={3}>
            <NumInput id="input-W" label="Width — horizontal (mm)"  labelIcon="arrow-h" value={W} onChange={setSurf("W")} step={10} />
            <NumInput id="input-H" label="Length — vertical (mm)" labelIcon="arrow-v" value={H} onChange={setSurf("H")} step={10} />
            <button
              className="ctrl-dir"
              style={{ width: "100%", marginTop: "var(--sp-1)" }}
              onClick={() => setSh(s => ({ ...s, W: DEFAULT_SH.W, H: DEFAULT_SH.H }))}
            >
              <Icon name="refresh-cw" /> Reset
            </button>
          </Stack>
        </ControlPanel>
        <ControlPanel id="control-settings" title="Settings" open={settingsOpen} setOpen={setSettingsOpen}>
          <Stack gap={3}>
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Direction</span>
              <div id="ctrl-direction" className="seg-group">
                {["V", "H"].map(s => (
                  <button key={s} className={"ctrl-dir " + (direction === s ? "on" : "")}
                    onClick={() => setSh(st => ({ ...st, direction: s }))}>{s}</button>
                ))}
              </div>
            </Stack>
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Row order</span>
              <div id="ctrl-row-order" className="seg-group">
                <button className={"ctrl-dir " + (rowStart === "top" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, rowStart: "top" }))}>R1 top</button>
                <button className={"ctrl-dir " + (rowStart === "bottom" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, rowStart: "bottom" }))}>R1 bottom</button>
              </div>
            </Stack>
            <NumInput id="input-minJ"     label="Min remainder (mm)"  value={minJ}     onChange={set("minJ")}    step={10} />
            <NumInput id="input-startOff" label="R1 start point (mm)" value={startOff}
              onChange={v => setSh(s => ({ ...s, startOff: Math.min(v, Math.max(1, PPi) - 1) }))} step={10} min={0} />
          </Stack>
        </ControlPanel>
      </Stack>
      <div id="data-preview" className="data-preview">
        <PreviewSection id="pattern-layouts" title="Pattern Layouts"
          description="Compare row-based layouts that share the same surface and material settings.">
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
                  <button
                    className={"ctrl-dir on" + (presetSaveStatus === "saved" ? " pw-preset-flash" : "")}
                    onClick={saveMaterialDefaults}
                    disabled={presetSaveStatus === "saving"}
                  >
                    {presetSaveStatus === "saving" ? <>Saving...</>
                      : presetSaveStatus === "saved" ? <><Icon name="check" /> Saved Defaults</>
                      : presetSaveStatus === "error" ? <>Error Saving</>
                      : <><Icon name="check" /> Save Defaults</>}
                  </button>
                </Stack>

                <div className="pw-formula-text" style={{ opacity: 0.7 }}>
                  Fill preset data above and click "Apply" to update the calculator, or "Save Defaults" to persist.
                </div>
              </Stack>
            </div>
          </div>
        </div>
      )}
      {largePreview && (
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
                {largePreview.result.summaryRows.length > 0 &&
                  <PanelSummary rows={largePreview.result.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} />}
                <div className={`large-layout-vis-wrap data-preview`}>
                  <LayoutVisualization result={largePreview.result} hoveredType={hoveredType} rowStart={rowStart} maxHeight={760} alwaysShowLabels={true} />
                </div>
              </Stack>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

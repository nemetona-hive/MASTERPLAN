function MaterialPresetDropdown({ anchorRef, presets, activePreset, onApply, field }) {
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });

  React.useLayoutEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <div className="rate-presets-dropdown" style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="rate-presets-header">Material Presets</div>
      <div className="rate-presets-list">
        {presets.map((p, idx) => {
          if (!p.name) return null;
          const displayVal = field === "width" ? p.width : p.length;
          const displayUnit = field === "width" ? "w" : "l";
          return (
            <div
              key={idx}
              className={"rate-preset-item" + (activePreset === idx ? " active" : "")}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onApply(p, idx); }}
            >
              <div className="rate-preset-info">
                <span className="rate-preset-name">{p.name}</span>
                <span className="rate-preset-meta">{p.width} × {p.length} mm</span>
              </div>
              <span className="rate-preset-val">{displayVal}<small>{displayUnit}</small></span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

function SheetSurfaceLayout({ sh, setSh }) {
  const { W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short } = sh;
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
  const [fieldFlash,      setFieldFlash]      = React.useState(false);
  const [presetSaveStatus, setPresetSaveStatus] = React.useState("");

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
  const setS2PanelState = patch => setSh(s => ({ ...s, offset:  patch.offset  !== undefined ? patch.offset  : s.offset }));
  const setS4PanelState = patch => setSh(s => ({ ...s,
    s4Long:  patch.s4Long  !== undefined ? patch.s4Long  : s.s4Long,
    s4Short: patch.s4Short !== undefined ? patch.s4Short : s.s4Short
  }));
  const stateGetters = { s1: () => ({}), s2: () => ({ offset }), s3: () => ({}), s4: () => ({ s4Long, s4Short }) };
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
              <NumInput id="input-PLa" label="Width (mm)"  value={Math.max(1, PLa)} onChange={set("PLa")} step={10} />
              {showWidDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={widWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="width" />}
            </div>
            <div ref={lenWrapRef} style={{ position: "relative" }}>
              <NumInput id="input-PPi" label="Length (mm)" value={Math.max(1, PPi)} onChange={set("PPi")} step={10} />
              {showLenDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={lenWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="length" />}
            </div>
          </Stack>
          <Stack gap={1}>
            <SLabel>Surface Area</SLabel>
            <NumInput id="input-W" label="Width (mm)"  value={Math.max(1, W)} onChange={set("W")} step={10} />
            <NumInput id="input-H" label="Height (mm)" value={Math.max(1, H)} onChange={set("H")} step={10} />
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
        <ControlPanel id="control-material" title="Material Specification" open={materialOpen} setOpen={setMaterialOpen}>
          <Stack gap={3}>
            <div className={fieldFlash ? "num-input-flash" : ""} ref={widWrapRef} style={{ position: "relative" }}>
              <NumInput
                id="input-PLa"
                label="Width (mm)"
                value={PLa}
                onChange={set("PLa")}
                step={10}
                onFocus={() => { setShowWidDropdown(true); setShowLenDropdown(false); }}
              />
              {showWidDropdown && presets.some(p => p.name) && <MaterialPresetDropdown anchorRef={widWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="width" />}
            </div>
            <div className={fieldFlash ? "num-input-flash" : ""} ref={lenWrapRef} style={{ position: "relative" }}>
              <NumInput
                id="input-PPi"
                label="Length (mm)"
                value={PPi}
                onChange={set("PPi")}
                step={10}
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
        <ControlPanel id="control-surface" title="Surface Area" open={surfaceOpen} setOpen={setSurfaceOpen}>
          <Stack gap={3}>
            <NumInput id="input-W" label="Width (mm)"  value={W} onChange={set("W")} step={10} />
            <NumInput id="input-H" label="Height (mm)" value={H} onChange={set("H")} step={10} />
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
    </>
  );
}

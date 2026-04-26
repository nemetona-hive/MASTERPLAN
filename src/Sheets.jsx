// ── Page sheets ───────────────────────────────────────────────────────────────

function SheetHome({ page, setPage }) {
  const cards = PAGES.filter(pg => !pg.noNav && !pg.parentId);
  return (
    <div className="home-scroll">
      <Stack className="home-inner" gap={3}>

        <Stack className="home-brand" gap={1}>
          <div className="home-brand-name">NEMETONA</div>
          <div className="home-brand-sub">MASTERPLAN</div>
        </Stack>

        <div className="home-divider" />

        <div className="home-cards">
          {cards.map(pg => {
            const isActive = page === pg.id ||
              PAGES.some(p => p.parentId === pg.id && p.id === page);
            const firstChild = PAGES.find(p => p.parentId === pg.id);
            const target = firstChild ? firstChild.id : pg.id;
            return (
              <Stack key={pg.id}
                as="button"
                className={"home-card" + (isActive ? " home-card-active" : "")}
                gap={3}
                onClick={() => setPage(target)}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && setPage(target)}>
                <span className="home-card-icon"><Icon name={pg.icon} /></span>
                <span className="home-card-title">{pg.title}</span>
                <span className="home-card-desc">{pg.desc}</span>
                <span className="home-card-arrow"><Icon name="chevron-right" /></span>
              </Stack>
            );
          })}
        </div>

        <div className="home-divider" />

        <div className="home-footer">NEMETONA HIVE</div>

      </Stack>
    </div>
  );
}

function SheetConcrete() {
  return (
    <>
      <div id="data-control" className="data-control" />
      <div id="data-preview" className="data-preview" />
    </>
  );
}

function SheetGoldenRatio({ grItems: baseItems, setGrItems: setBaseItems }) {
  const [baseOpen, setBaseOpen] = React.useState(true);
  const link = useLinkedCardHighlight("golden-ratio");
  const PHI = 1.6180339887499;

  const setItemField = (id, key, value) => {
    setBaseItems(items => items.map(item => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const saveItem = id => {
    setBaseItems(items => items.map(item => (
      item.id === id ? { ...item, saved: { value: item.value, suffix: item.suffix }, savedCommitted: true } : item
    )));
  };

  const resetItem = id => {
    setBaseItems(items => items.map(item => (
      item.id === id
        ? { ...item, value: "", suffix: "", savedCommitted: false }
        : item
    )));
  };

  const commitBaseValue = id => {
    setBaseItems(items => items.map(item => {
      if (item.id !== id) return item;
      const raw = String(item.value ?? "").trim().replace(",", ".");
      if (raw === "") return { ...item, value: "" };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) return { ...item, value: "" };
      const rounded = Math.max(1, Math.round(n * 100) / 100);
      return { ...item, value: String(rounded) };
    }));
  };

  const buildSteps = base => {
    const rows = [];
    let value = base / PHI;
    for (let i = 1; i <= 7; i++) {
      rows.push({ step: i, value });
      value = value / PHI;
    }
    return rows;
  };
  const fmtInt = v => Math.round(v).toString();
  return (
    <>
      <div id="data-control" className="data-control">
        <ControlPanel id="control-base-number" title="Base Number" open={baseOpen} setOpen={setBaseOpen}>
          <Stack gap={2}>
            {baseItems.map(item => {
              const tone = getLinkedCardTone(item.id);
              const trimmedSuffix = item.suffix.trim();
              const isStored = item.savedCommitted && item.value === item.saved.value && item.suffix === item.saved.suffix;
              const valueInputLabel = trimmedSuffix
                ? <>Value (mm) <span className="num-lbl-raw">{trimmedSuffix}</span></>
                : "Value (mm)";

              return (
                <div
                  key={item.id}
                  id={`control-base-number-${item.id}`}
                  className={`control-panel gr-control-card gr-control-card-${tone}${isStored ? " gr-card-saved" : ""}`}
                  {...link.bindControl(item.id)}
                >
                  <Stack className="panel-data" gap={3}>
                    <Stack gap={1} className="num-wrap">
                      <span className="num-lbl">{valueInputLabel}</span>
                      <div className="num-row">
                        <input
                          id={`input-base-number-field-${item.id}`}
                          className="num-input"
                          type="number"
                          value={item.value}
                          min={1}
                          step={10}
                          onChange={e => setItemField(item.id, "value", e.target.value)}
                          onBlur={() => commitBaseValue(item.id)}
                        />
                        <button type="button" className="num-btn" onClick={() => commitBaseValue(item.id)}>
                          <Icon name="corner-down-left" />
                        </button>
                      </div>
                    </Stack>
                    <Stack gap={1} className="ctrl-lbl">
                      <span className="ctrl-sublbl">Custom label</span>
                      <div className="num-row">
                        <input
                          id={`input-base-label-suffix-${item.id}`}
                          className="num-input gr-label-input"
                          type="text"
                          value={item.suffix}
                          onChange={e => setItemField(item.id, "suffix", e.target.value)}
                          placeholder="e.g. A, L, Start"
                        />
                        <button
                          type="button"
                          className="num-btn"
                          onClick={() => {
                            const input = document.getElementById(`input-base-label-suffix-${item.id}`);
                            if (input instanceof HTMLInputElement) input.blur();
                          }}
                        >
                          <Icon name="corner-down-left" />
                        </button>
                      </div>
                    </Stack>
                    <Stack gap={1} className="ctrl-lbl">
                      <span className="ctrl-sublbl">Entry</span>
                      <Stack direction="row" gap={1} className="ctrl-btns">
                        <button
                          type="button"
                          className="ctrl-dir"
                          onClick={() => saveItem(item.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="ctrl-dir"
                          onClick={() => resetItem(item.id)}
                        >
                          Reset
                        </button>
                      </Stack>
                    </Stack>
                  </Stack>
                </div>
              );
            })}
          </Stack>
        </ControlPanel>
      </div>
      <div id="data-preview" className="data-preview">
        <Stack className="gr-preview-list" gap={3}>
          <Stack className="sys-head" gap={1}>
            <h3 className="sys-title"><Icon name="golden-phi" className="sys-title-icon" /> Golden Ratio phi</h3>
            <span className="sys-head-sub">phi = 1.6180339887499</span>
          </Stack>
          {baseItems.map((item, idx) => {
            const tone = getLinkedCardTone(item.id);
            const trimmedSuffix = item.suffix.trim();
            const isStored = item.savedCommitted && item.value === item.saved.value && item.suffix === item.saved.suffix;
            const numericValue = Number(item.value);
            const hasValidValue = String(item.value).trim() !== "" && Number.isFinite(numericValue) && numericValue >= 1;
            const valueRowLabel = trimmedSuffix
              ? <>Value <span className="num-lbl-raw">{trimmedSuffix}</span></>
              : "Value";
            const steps = hasValidValue ? buildSteps(numericValue) : [];

            return (
              <div
                key={item.id}
                id={`panel-golden-ratio-${item.id}`}
                className={`sys-block gr-preview-card gr-preview-card-${tone}${isStored ? " gr-card-saved" : ""}${link.isActive(item.id) ? " linked-preview-active" : ""}`}
              >
                <Stack className="section-pad gr-section-pad" gap={3}>
                  <div className="data-row">
                    <span className="data-row-lbl">{valueRowLabel}</span>
                    <span className="data-row-val hi">{hasValidValue ? fmtInt(numericValue) : "-"}</span>
                    <span className="data-row-unit">mm</span>
                    <span className="gr-row-marker">{getLinkedCardMarker(item.id)}</span>
                  </div>
                  {hasValidValue && (
                    <div className="gr-steps-wrap">
                      {steps.map((stepItem, stepIdx) => (
                        <div key={stepItem.step} className={"gr-step-row" + (stepIdx === 0 ? " gr-step-row-first" : "")}>
                          <div className="data-row gr-step-cell gr-step-cell-index"><span className="data-row-val">{stepItem.step}</span></div>
                          <div className="data-row gr-step-cell"><span className="data-row-val">{fmtInt(stepItem.value)}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </Stack>
              </div>
            );
          })}
        </Stack>
      </div>
    </>
  );
}
function SheetSymmetricLayout({ sym, setSym }) {
  const [hoveredType, setHoveredType] = React.useState(null);
  const [surfaceOpen, setSurfaceOpen] = React.useState(true);
  const layout = {
    id: "s0", title: "Symmetric layout", description: "Equal edge pieces, full pieces in center",
    defaultOpen: true, renderControls: null, icon: "s0",
    getState: () => ({}), setState: () => {},
    compute: () => computeS0(sym),
    includeInBest: false
  };
  const result = layout.compute();
  return (
    <>
      <Stack id="data-control" className="data-control" gap={3}>
        <ControlPanel id="control-sym-surface" title="Surface Area" open={surfaceOpen} setOpen={setSurfaceOpen}>
          <Stack gap={3}>
            <NumInput id="input-sym-room-width"  label="Room width (mm)"  value={sym.roomWidth}  onChange={v => setSym(s => ({ ...s, roomWidth: v }))}  step={10} />
            <NumInput id="input-sym-panel-width" label="Panel width (mm)" value={sym.panelWidth} onChange={v => setSym(s => ({ ...s, panelWidth: v }))} step={10} />
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Layout style</span>
              <Stack direction="row" gap={1} className="ctrl-btns">
                <button className={"ctrl-dir " + (sym.oneFullEdge ? "on" : "")}
                  onClick={() => setSym(s => ({ ...s, oneFullEdge: true }))}>Asymmetric</button>
                <button className={"ctrl-dir " + (!sym.oneFullEdge ? "on" : "")}
                  onClick={() => setSym(s => ({ ...s, oneFullEdge: false }))}>Symmetric</button>
              </Stack>
            </Stack>
          </Stack>
        </ControlPanel>
      </Stack>
      <div id="data-preview" className="data-preview">
        <LayoutPanel layout={layout} result={result} hoveredType={hoveredType} setHoveredType={setHoveredType} isBest={false} />
      </div>
    </>
  );
}

function SheetSurfaceLayout({ sh, setSh }) {
  const { W, H, PPi, PLa, offset, direction, minJ, startOff, s4Long, s4Short } = sh;
  const rowStart = sh.rowStart || "top";
  const [hoveredType, setHoveredType] = React.useState(null);
  const [materialOpen, setMaterialOpen] = React.useState(true);
  const [surfaceOpen,  setSurfaceOpen]  = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(true);
  const set = k => v => setSh(s => ({ ...s, [k]: v }));
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
            <NumInput id="input-PPi" label="Length (mm)" value={Math.max(1, PPi)} onChange={set("PPi")} step={10} />
            <NumInput id="input-PLa" label="Width (mm)"  value={Math.max(1, PLa)} onChange={set("PLa")} step={10} />
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
            <NumInput id="input-PPi" label="Length (mm)" value={PPi} onChange={set("PPi")} step={10} />
            <NumInput id="input-PLa" label="Width (mm)"  value={PLa} onChange={set("PLa")} step={10} />
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
              <Stack id="ctrl-direction" direction="row" gap={1} className="ctrl-btns">
                {["V", "H"].map(s => (
                  <button key={s} className={"ctrl-dir " + (direction === s ? "on" : "")}
                    onClick={() => setSh(st => ({ ...st, direction: s }))}>{s}</button>
                ))}
              </Stack>
            </Stack>
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Row order</span>
              <Stack id="ctrl-row-order" direction="row" gap={1} className="ctrl-btns">
                <button className={"ctrl-dir " + (rowStart === "top" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, rowStart: "top" }))}>R1 top</button>
                <button className={"ctrl-dir " + (rowStart === "bottom" ? "on" : "")}
                  onClick={() => setSh(st => ({ ...st, rowStart: "bottom" }))}>R1 bottom</button>
              </Stack>
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
    </>
  );
}

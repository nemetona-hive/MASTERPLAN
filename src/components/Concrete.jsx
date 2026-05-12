// ── Concrete Calculator ────────────────────────────────────────────────────────

function SheetConcrete() {
  const [areaMode,  setAreaMode]  = React.useState("direct"); // "direct" | "dims"
  const [thickMode, setThickMode] = React.useState("avg");    // "avg" | "corners"

  // Area inputs
  const [areaManual, setAreaManual] = React.useState("");
  const [lenMm,      setLenMm]      = React.useState("");
  const [widMm,      setWidMm]      = React.useState("");

  // Thickness inputs
  const [avgH, setAvgH] = React.useState("");
  const [ca,   setCa]   = React.useState("");
  const [cb,   setCb]   = React.useState("");
  const [cc,   setCc]   = React.useState("");
  const [cd,   setCd]   = React.useState("");

  // Consumption & packaging
  const [rate,     setRate]     = React.useState("");
  const [bagKg,    setBagKg]    = React.useState("");
  const [bagPrice, setBagPrice] = React.useState("");

  const [activePreset, setActivePreset] = React.useState(null);
  const [flashIdx,     setFlashIdx]     = useTimedState(null, 1200);
  const [fieldFlash,   setFieldFlash]   = useTimedState(false, 900);
  const [showUpdated,  setShowUpdated]  = useTimedState(false, 2500);
  const rateInputRef   = React.useRef(null);

  const [showRatePresets, setShowRatePresets] = React.useState(false);

  // Product presets (quick fill)
  const [presets, setPresets] = React.useState(() =>
    (typeof DEFAULT_CONCRETE_PRESETS !== "undefined"
      ? DEFAULT_CONCRETE_PRESETS
      : [
          { name: "weber S-100", rate: 2, bagKg: 25, bagPrice: 4 },
          { name: "weberfloor 200 RAPID", rate: 1.7, bagKg: 20, bagPrice: 15 },
          { name: "", rate: "", bagKg: "", bagPrice: "" }
        ]
    ).map(p => ({ ...p }))
  );

  const [presetSaveStatus, setPresetSaveStatus] = React.useState("");

  const saveConcreteDefaults = async () => {
    setPresetSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("concretePresets", presets);
      setPresetSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setPresetSaveStatus("error");
    }
  };
  
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
    setFlashIdx(null);
    setFieldFlash(false);
    setShowUpdated(false);
  };

  const updatePreset = (idx, field, val) => {
    const next = [...presets];
    next[idx] = { ...next[idx], [field]: val };
    setPresets(next);
  };

  const addPreset = () => {
    setPresets([...presets, { name: "", rate: "", bagKg: "", bagPrice: "" }]);
  };

  const applyPreset = (p, idx) => {
    setRate(p.rate === "" ? "" : (parseFloat(p.rate) || 0));
    setBagKg(p.bagKg === "" ? "" : (parseFloat(p.bagKg) || 0));
    setBagPrice(p.bagPrice);

    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
    setShowUpdated(true);
  };

  const handleRateChange     = v => { setRate(v);     setActivePreset(null); };
  const handleBagKgChange    = v => { setBagKg(v);    setActivePreset(null); };
  const handleBagPriceChange = v => { setBagPrice(v); setActivePreset(null); };

  useClickOutside([rateInputRef], () => setShowRatePresets(false));

  // ── Derived values ─────────────────────────────────────────────────────────
  const parseNum = toNumber;

  const area = areaMode === "dims"
    ? (parseNum(lenMm) * parseNum(widMm)) / 1_000_000
    : parseNum(areaManual);

  const computedDimsArea = (parseNum(lenMm) * parseNum(widMm)) / 1_000_000;

  let computedAvgH, diff;
  if (thickMode === "avg") {
    computedAvgH = parseNum(avgH);
    diff = null;
  } else {
    const va = parseNum(ca);
    const vb = parseNum(cb);
    const vc = parseNum(cc);
    const vd = parseNum(cd);
    computedAvgH = (va + vb + vc + vd) / 4;
    diff = Math.max(va, vb, vc, vd) - Math.min(va, vb, vc, vd);
  }

  const mass = area * computedAvgH * parseNum(rate);
  const bagsExact = parseNum(bagKg) > 0 ? (mass / parseNum(bagKg)) : 0;
  const bags = Math.ceil(bagsExact);
  
  const bPrice = parseNum(bagPrice);
  const totalPrice = (bags > 0 && bPrice > 0) ? (bags * bPrice) : null;

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
                        className={"ctrl-dir" + (areaMode === "direct" ? " on" : "")}
                        onClick={() => setAreaMode("direct")}>Enter area</button>
                      <button
                        className={"ctrl-dir" + (areaMode === "dims" ? " on" : "")}
                        onClick={() => setAreaMode("dims")}>Dimensions</button>
                    </div>

                    <div className="concrete-split-content">
                      {areaMode === "direct" && (
                        <NumInput
                          id="input-slf-area"
                          label="Area (m²)"
                          value={areaManual}
                          min={0}
                          step={0.1}
                          onChange={v => setAreaManual(String(v))}
                          req={hasAnyInput && !areaManual}
                        />
                      )}

                      {areaMode === "dims" && (
                        <Stack gap={3}>
                          <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                            <NumInput id="input-slf-len" label="Length (mm)" value={lenMm} min={1} step={10} onChange={setLenMm} req={hasAnyInput && !lenMm} />
                            <NumInput id="input-slf-wid" label="Width (mm)"  value={widMm} min={1} step={10} onChange={setWidMm} req={hasAnyInput && !widMm} />
                          </div>
                          <Row label="Calculated area" value={computedDimsArea.toFixed(1)} unit="m²" />
                        </Stack>
                      )}
                    </div>
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right Column: Layer Thickness */}
                  <Stack gap={3}>
                    <div className="seg-group">
                      <button
                        className={"ctrl-dir" + (thickMode === "avg" ? " on" : "")}
                        onClick={() => setThickMode("avg")}>Avg thickness</button>
                      <button
                        className={"ctrl-dir" + (thickMode === "corners" ? " on" : "")}
                        onClick={() => setThickMode("corners")}>4 corners</button>
                    </div>

                    <div className="concrete-split-content">
                      {thickMode === "avg" && (
                        <NumInput id="input-slf-havg" label="Average thickness (mm)" value={avgH} min={1} step={1} onChange={setAvgH} req={hasAnyInput && !avgH} />
                      )}

                      {thickMode === "corners" && (
                        <Stack gap={3}>
                          <div className="pw-grid-2col" style={{ marginBottom: "var(--sp-3)" }}>
                            <NumInput id="input-slf-ca" label="Corner A (mm)" value={ca} min={0} step={1} onChange={setCa} req={hasAnyInput && !ca} />
                            <NumInput id="input-slf-cb" label="Corner B (mm)" value={cb} min={0} step={1} onChange={setCb} req={hasAnyInput && !cb} />
                          </div>
                          <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
                            <NumInput id="input-slf-cc" label="Corner C (mm)" value={cc} min={0} step={1} onChange={setCc} req={hasAnyInput && !cc} />
                            <NumInput id="input-slf-cd" label="Corner D (mm)" value={cd} min={0} step={1} onChange={setCd} req={hasAnyInput && !cd} />
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
                <div className="u-flex-row" style={{ flex: 1, alignItems: 'center' }}>
                  <span>Consumption & Packaging</span>
                  <span className={"pw-updated-note" + (showUpdated ? " pw-updated-note-visible" : "")}>
                    <Icon name="check" /> updated
                  </span>
                </div>
              </div>
              <div className="section-body">
                <div className="concrete-split-wrap section-pad">
                  {/* Left: Consumption */}
                  <Stack gap={3}>
                    <div 
                      className={"num-input-wrap-relative" + (fieldFlash ? " num-input-flash" : "")}
                      ref={rateInputRef}
                      onClick={() => setShowRatePresets(true)}
                    >
                      <NumInput 
                        id="input-slf-rate" 
                        label="Consumption (kg/m²·mm)" 
                        value={rate} 
                        min={0.1} 
                        step={0.1} 
                        onChange={handleRateChange} 
                        req={hasAnyInput && !rate}
                        onFocus={() => setShowRatePresets(true)}
                      />
                      
                      {showRatePresets && (
                        <div className="rate-presets-dropdown">
                          <div className="rate-presets-header">Quick Presets</div>
                          <div className="rate-presets-list">
                            {presets.map((p, idx) => {
                              if (!p.name) return null;
                              return (
                                <div 
                                  key={idx} 
                                  className={"rate-preset-item" + (activePreset === idx ? " active" : "")}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    applyPreset(p, idx);
                                    setShowRatePresets(false);
                                  }}
                                >
                                  <div className="rate-preset-info">
                                    <span className="rate-preset-name">{p.name}</span>
                                    <span className="rate-preset-meta">{p.bagKg}kg · {p.bagPrice}€</span>
                                  </div>
                                  <span className="rate-preset-val">{p.rate} <small>kg</small></span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </Stack>

                  <div className="concrete-split-divider" />

                  {/* Right: Packaging */}
                  <Stack gap={3}>
                    <div className={fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagkg" label="Bag weight (kg)" value={bagKg} min={1} step={1} onChange={handleBagKgChange} req={hasAnyInput && !bagKg} />
                    </div>
                    <div className={fieldFlash ? "num-input-flash" : ""}>
                      <NumInput id="input-slf-bagprice" label="Bag price (€)" value={bagPrice} min={0} step={0.01} onChange={handleBagPriceChange} />
                    </div>
                  </Stack>
                </div>
              </div>
            </div>

            {/* ── Product Presets ── */}
            <DetailSection title="Product Presets" open={false}>
              <Stack gap={4}>
                <Stack gap={3}>
                  <div className="pw-preset-header">
                    <span>Product Name</span>
                    <span>kg/m²·mm</span>
                    <span>Bag kg</span>
                    <span>Price €</span>
                    <span>&nbsp;</span>
                  </div>
                  {presets.map((p, idx) => (
                    <div key={idx} className={"pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")}>
                      <div className="pw-preset-fields">
                        <div>
                          <span className="pw-preset-lbl-hide">Product Name</span>
                          <input
                            id={`preset-name-${idx}`}
                            name={`preset-name-${idx}`}
                            type="text"
                            className="num-input"
                            placeholder="Product description..."
                            value={p.name}
                            onChange={e => updatePreset(idx, "name", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">kg/m²·mm</span>
                          <input
                            id={`preset-rate-${idx}`}
                            name={`preset-rate-${idx}`}
                            type="number"
                            className="num-input"
                            value={p.rate}
                            onChange={e => updatePreset(idx, "rate", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Bag kg</span>
                          <input
                            id={`preset-bagkg-${idx}`}
                            name={`preset-bagkg-${idx}`}
                            type="number"
                            className="num-input"
                            value={p.bagKg}
                            onChange={e => updatePreset(idx, "bagKg", e.target.value)}
                          />
                        </div>
                        <div>
                          <span className="pw-preset-lbl-hide">Price €</span>
                          <input
                            id={`preset-price-${idx}`}
                            name={`preset-price-${idx}`}
                            type="number"
                            className="num-input"
                            value={p.bagPrice}
                            onChange={e => updatePreset(idx, "bagPrice", e.target.value)}
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
                  <SaveDefaultsButton status={presetSaveStatus} onClick={saveConcreteDefaults} />
                </Stack>

                <div className="pw-formula-text" style={{ opacity: 0.7 }}>
                  Fill product data above and click "Apply" to update the calculator values.
                </div>
              </Stack>
            </DetailSection>

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

          </Stack>

          {/* Sticky Result Column */}
          <div className="u-sticky u-sticky-top" style={{ marginTop: 'var(--sticky-offset)', top: '20px' }}>
            <div className="result-card">
              <span className="result-card-title">Bags Needed</span>
              <span className="result-card-value">
                {bags > 0 ? bags : "0"} 
                <span style={{fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-reg)', opacity: 0.8, marginLeft: '4px'}}>pcs</span>
              </span>
              <span style={{fontFamily: 'var(--mono)', fontSize: 'var(--fs-md)', color: 'var(--color-gray-opa80)', marginTop: '-2px'}}>
                exact: {bagsExact > 0 ? bagsExact.toFixed(2) : "0.00"} pcs
              </span>
              
              <div style={{marginTop: 'var(--sp-4)', paddingTop: 'var(--sp-4)', borderTop: '1px solid color-mix(in srgb, var(--color-white) 15%, transparent)'}}>
                <span className="result-card-title">Total Price</span>
                <span className="result-card-value" style={{fontSize: 'var(--fs-xl)', display: 'flex', alignItems: 'baseline', gap: '6px'}}>
                  {totalPrice !== null ? (
                    <>
                      <span style={{ fontSize: 'var(--fs-lg)', opacity: 0.8 }}>€</span>
                      <span>{fmtEur(totalPrice)}</span>
                    </>
                  ) : "—"}
                </span>
              </div>
            </div>

            <div style={{marginTop: 'var(--sp-4)'}}>
              <button 
                onClick={resetAll} 
                style={{width: '100%', padding: '12px', fontSize: 'var(--fs-md)', borderRadius: '6px', textAlign: 'center', background: 'transparent', border: '1px solid color-mix(in srgb, var(--color-gray) 40%, transparent)', color: 'var(--color-gray)', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center'}}
              >
                <Icon name="refresh-cw" /> Global Reset
              </button>
            </div>
          </div>

        </div>

      </Stack>
    </div>
  );
}

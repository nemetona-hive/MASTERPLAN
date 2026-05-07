function SheetGoldenRatio({ grItems: baseItems, setGrItems: setBaseItems }) {
  const [baseOpen, setBaseOpen] = React.useState(true);
  const link = useLinkedCardHighlight("golden-ratio");
  const PHI = 1.6180339887499;

  const [committedIds, setCommittedIds] = React.useState(() => new Set());
  const commitTimers = React.useRef({});

  const flashCommit = id => {
    setCommittedIds(prev => new Set([...prev, id]));
    clearTimeout(commitTimers.current[id]);
    commitTimers.current[id] = setTimeout(() => {
      setCommittedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 600);
  };

  React.useEffect(() => () => Object.values(commitTimers.current).forEach(clearTimeout), []);

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

  const commitBaseValue = (id, flash = false) => {
    setBaseItems(items => items.map(item => {
      if (item.id !== id) return item;
      const raw = String(item.value ?? "").trim().replace(",", ".");
      if (raw === "") return { ...item, value: "" };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) return { ...item, value: "" };
      const rounded = Math.max(1, Math.round(n * 100) / 100);
      return { ...item, value: String(rounded) };
    }));
    if (flash) flashCommit(id);
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

  const normalizeGoldenRatioDefaults = items => items.map(item => ({
    id: item.id,
    value: item.value,
    suffix: item.suffix,
    saved: {
      value: item.value,
      suffix: item.suffix
    },
    savedCommitted: String(item.value).trim() !== ""
  }));

  const [saveStatus, setSaveStatus] = React.useState("");
  
  const saveGoldenRatioDefaults = async () => {
    setSaveStatus("saving");
    try {
      if (typeof saveStaticDefaults !== "undefined") {
        const nextDefaults = normalizeGoldenRatioDefaults(baseItems);
        await saveStaticDefaults("goldenRatioDefaults", nextDefaults);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(""), 2500);
      }
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 3500);
    }
  };

  return (
    <>
      <div id="data-control" className="data-control">
        <ControlPanel id="control-base-number" title="Base Number" open={baseOpen} setOpen={setBaseOpen}>
          {typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && (
            <div style={{ padding: "0 var(--sp-4) var(--sp-4) var(--sp-4)", display: "flex", justifyContent: "flex-end" }}>
              <button 
                className={"ctrl-dir on" + (saveStatus === "saved" ? " pw-preset-flash" : "")} 
                onClick={saveGoldenRatioDefaults}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? (
                  <>Saving...</>
                ) : saveStatus === "saved" ? (
                  <><Icon name="check" /> Saved Defaults</>
                ) : saveStatus === "error" ? (
                  <>Error Saving</>
                ) : (
                  <><Icon name="check" /> Save Defaults</>
                )}
              </button>
            </div>
          )}
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
                          name={`input-base-number-field-${item.id}`}
                          className="num-input"
                          type="number"
                          value={item.value}
                          min={1}
                          step={10}
                          onChange={e => setItemField(item.id, "value", e.target.value)}
                          onBlur={() => commitBaseValue(item.id, false)}
                          onKeyDown={e => e.key === "Enter" && commitBaseValue(item.id, true)}
                        />
                        <button
                          type="button"
                          className="num-btn"
                          onClick={() => commitBaseValue(item.id, true)}>
                          <Icon name="corner-down-left" />
                        </button>
                      </div>
                    </Stack>
                    <Stack gap={1} className="ctrl-lbl">
                      <span className="ctrl-sublbl">Custom label</span>
                      <div className="num-row">
                        <input
                          id={`input-base-label-suffix-${item.id}`}
                          name={`input-base-label-suffix-${item.id}`}
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

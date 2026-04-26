// ── Layout controls & registry ────────────────────────────────────────────────

function S4Controls({ state, setState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <NumInput id="input-s4long"  label="Long (mm)"  value={state.s4Long}  onChange={v => setState({ s4Long: v })}  step={10} />
      <NumInput id="input-s4short" label="Short (mm)" value={state.s4Short} onChange={v => setState({ s4Short: v })} step={10} />
    </div>
  );
}

function S2Controls({ state, setState }) {
  return (
    <div className="ctrl-lbl">
      <span className="ctrl-sublbl">Offset (&times;PL)</span>
      <input id="input-offset" type="range" min={0.1} max={0.9} step={0.05} value={state.offset}
        onChange={e => setState({ offset: +e.target.value })} />
      <span className="ctrl-range-val">{fmt.decimals(state.offset, 2)}</span>
    </div>
  );
}

// Derives title and icon from SYSTEMS — edit titles/icons in config.js only
var LAYOUT_REGISTRY = ["s1", "s2", "s3", "s4"].map(id => {
  const sys = SYSTEMS.find(s => `s${s.id}` === id);
  return {
    id,
    icon:           sys.icon,
    title:          sys.title,
    compute:        { s1: computeS1, s2: computeS2, s3: computeS3, s4: computeS4 }[id],
    renderControls: { s2: S2Controls, s4: S4Controls }[id] || null,
    includeInBest:  true
  };
});

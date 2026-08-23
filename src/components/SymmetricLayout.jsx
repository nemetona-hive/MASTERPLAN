import { React } from "../react-globals.js";
import { ControlPanel, MaterialPresetDropdown, NumInput, Stack, clampNumber, useClickOutside, useDropdownKeyboard } from "../shared.jsx";
import { LayoutPanel } from "../Visualization.jsx";

export function SheetSymmetricLayout({ sym, setSym }) {
  const [hoveredType, setHoveredType] = React.useState(null);

  // ── Material presets (shared with pattern layouts) ─────────────────────────
  const presets = React.useMemo(() =>
    (typeof DEFAULT_MATERIAL_PRESETS !== "undefined" ? DEFAULT_MATERIAL_PRESETS : []).filter(p => p.name),
  []);
  const [activePreset,     setActivePreset]     = React.useState(null);
  const [showWidDropdown,  setShowWidDropdown]  = React.useState(false);
  const widWrapRef = React.useRef(null);

  useClickOutside([widWrapRef], () => setShowWidDropdown(false));

  const applyPreset = (p, idx) => {
    setSym(s => ({ ...s, panelWidth: p.width }));
    setActivePreset(idx);
    setShowWidDropdown(false);
  };

  const { hoveredIndex, onKeyDown } = useDropdownKeyboard(
    showWidDropdown ? presets.length : 0,
    (idx) => applyPreset(presets[idx], idx),
    () => setShowWidDropdown(false)
  );

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
        <ControlPanel id="control-sym-surface" title="Inputs" noToggle>
          <Stack gap={3}>
            <NumInput id="input-sym-room-width" label="Area width (mm)" value={sym.roomWidth} onChange={v => setSym(s => ({ ...s, roomWidth: clampNumber(v, 100, 50000, 100) }))} step={10} min={100} />
            <div ref={widWrapRef} style={{ position: "relative" }}>
              <NumInput
                id="input-sym-panel-width"
                label="Product width (mm)"
                value={sym.panelWidth}
                onChange={v => { setSym(s => ({ ...s, panelWidth: clampNumber(v, 100, 8000, 100) })); setActivePreset(null); }}
                step={10}
                min={100}
                onFocus={() => setShowWidDropdown(true)}
                onCommit={() => setShowWidDropdown(false)}
                onKeyDown={onKeyDown}
              />
              {showWidDropdown && presets.length > 0 && (
                <MaterialPresetDropdown anchorRef={widWrapRef} presets={presets} activePreset={activePreset} onApply={applyPreset} field="width" hoveredIndex={hoveredIndex} />
              )}
            </div>
          </Stack>
        </ControlPanel>
        <ControlPanel id="control-sym-settings" title="Settings" noToggle>
          <Stack gap={3}>
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Layout style</span>
              <div className="seg-group">
                <button className={"ctrl-dir " + (sym.oneFullEdge ? "on" : "")}
                  onClick={() => setSym(s => ({ ...s, oneFullEdge: true }))}>Asymmetric</button>
                <button className={"ctrl-dir " + (!sym.oneFullEdge ? "on" : "")}
                  onClick={() => setSym(s => ({ ...s, oneFullEdge: false }))}>Symmetric</button>
              </div>
            </Stack>
            {sym.oneFullEdge && (
              <NumInput id="input-sym-custom-first" label="First piece width (mm)" value={sym.customFirstPieceWidth ?? ""} onChange={v => setSym(s => ({ ...s, customFirstPieceWidth: clampNumber(v, 0, 50000, 0) }))} step={10} min={0} />
            )}
          </Stack>
        </ControlPanel>
      </Stack>
      <div id="data-preview" className="data-preview">
        <LayoutPanel layout={layout} result={result} hoveredType={hoveredType} setHoveredType={setHoveredType} isBest={false} noToggle />
      </div>
    </>
  );
}


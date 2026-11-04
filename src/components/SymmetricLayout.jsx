import { React } from "../react-globals.js";
import { ControlPanel, NumInput, SegGroup, SelectedPresetDetail, Stack, clampNumber, useDocHistory } from "../shared.jsx";
import { PresetField, usePresetLibrary } from "./PresetLibrary.jsx";
import { useSessionState } from "../utils/session-state.js";
import { LayoutEmptyState, LayoutPanel, PreviewSection } from "../Visualization.jsx";
import { parseMeasurement } from "../utils/measurements.cjs";
import { ProjectSection } from "./ProjectMenu.jsx";

const validDimension = (value, min, max) => {
  const parsed = parseMeasurement(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};
// Blank or unparseable is missing, not the minimum.
const clampOptionalDimension = (value, min, max) => {
  const n = parseMeasurement(value);
  return Number.isFinite(n) ? clampNumber(n, min, max, min) : "";
};

/* The page's two preset lists, on the shared preset system (PresetLibrary.jsx):
   products for the panel width, and inputs for the area width. Both are the
   defaults config.js ships, the same ones Pattern Layouts starts from, but
   kept apart from that page's edited lists, by the user's choice: each page
   stands on its own. There is no Manage dialog here, so a list is read from
   its defaults and not kept (`draftKey: null`); which preset is applied is
   kept, with the page's values. Only the width of either is used: this
   calculation has one dimension. */
const widthLibrary = ({ max, message, ...lib }) => ({
  ...lib,
  draftKey: null,
  columns: [["width", "Width mm", "Width"], ["length", "Length mm", "Length"]],
  required: ["width"],
  requiredText: "a width",
  validate: v => (Number.isFinite(v.width) && v.width >= 100 && v.width <= max ? null : message)
});
export const AXIAL_PRODUCT_LIBRARY = widthLibrary({
  id: "axial-product", title: "Material Presets", max: 8000,
  message: "A product preset's width must be between 100 and 8000 mm.",
  defaults: () => (typeof DEFAULT_MATERIAL_PRESETS !== "undefined" ? DEFAULT_MATERIAL_PRESETS : [])
});
export const AXIAL_AREA_LIBRARY = widthLibrary({
  id: "axial-area", title: "Input Presets", max: 50000,
  message: "An input preset's width must be between 100 and 50000 mm.",
  defaults: () => (typeof DEFAULT_SURFACE_PRESETS !== "undefined" ? DEFAULT_SURFACE_PRESETS : [])
});

/* An applied preset stays named while its field still holds its width. A
   blur re-commits the value unchanged, so clearing on every commit lost the
   name the moment the field was left. */
const keepWhileMatching = (active, setActive, list, width) => () => {
  if (active === null) return;
  const preset = list[active];
  if (!preset || parseMeasurement(preset.width) !== parseMeasurement(width)) setActive(null);
};

export function SheetSymmetricLayout({ sym, setSym }) {
  const [hoveredType, setHoveredType] = React.useState(null);
  const roomComplete = validDimension(sym.roomWidth, 100, 50000);
  const materialComplete = validDimension(sym.panelWidth, 100, 8000);
  const started = [sym.roomWidth, sym.panelWidth].some(value => value !== "" && value !== null && value !== undefined);
  const ready = roomComplete && materialComplete;

  const [activeProduct, setActiveProduct] = useSessionState("SymmetricLayout.jsx:activeProduct", null);
  const [activeArea, setActiveArea] = useSessionState("SymmetricLayout.jsx:activeArea", null);

  /* `sym` is this page's whole document and lives in App's state. The applied
     presets and the open lists are not the document and stay out. */
  const markStep = useDocHistory({
    key: "symmetric-layout",
    snapshot: () => sym,
    apply: setSym
  });

  const product = usePresetLibrary(AXIAL_PRODUCT_LIBRARY, {
    active: activeProduct, setActive: setActiveProduct,
    onApply: v => { markStep("Apply preset"); setSym(s => ({ ...s, panelWidth: v.width })); }
  });
  const area = usePresetLibrary(AXIAL_AREA_LIBRARY, {
    active: activeArea, setActive: setActiveArea,
    onApply: v => { markStep("Apply input preset width"); setSym(s => ({ ...s, roomWidth: v.width })); }
  });
  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(keepWhileMatching(activeProduct, setActiveProduct, product.presets, sym.panelWidth),
    [activeProduct, product.presets, sym.panelWidth]);
  React.useEffect(keepWhileMatching(activeArea, setActiveArea, area.presets, sym.roomWidth),
    [activeArea, area.presets, sym.roomWidth]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const presetError = product.error || area.error;

  const layout = {
    id: "s0",
    title: sym.oneFullEdge ? "Asymmetric layout" : "Symmetric layout",
    description: sym.oneFullEdge ? "One full edge piece, then repeated pieces" : "Equal edge pieces, full pieces in center",
    summaryGroupTitles: ["Pieces", "Totals"]
  };
  const result = ready ? computeS0(sym) : null;
  return (
    <>
      <Stack id="data-control" className="data-control" gap={4}>
        <ProjectSection />
        <ControlPanel id="control-sym-surface" title="Inputs" noToggle className="form-section-card"
          headerDetail={(area.selected || product.selected) && <>
            {area.selected && <SelectedPresetDetail preset={area.selected} />}
            {product.selected && <SelectedPresetDetail preset={product.selected} />}
          </>}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={area} field="width" id="input-sym-room-width" label="Area width (mm)"
              value={sym.roomWidth} min={100} max={50000} req={started && !roomComplete}
              onChange={v => setSym(s => ({ ...s, roomWidth: clampOptionalDimension(v, 100, 50000) }))} />
            <PresetField library={product} field="width" id="input-sym-panel-width" label="Product width (mm)"
              value={sym.panelWidth} min={100} max={8000} req={started && !materialComplete}
              onChange={v => setSym(s => ({ ...s, panelWidth: clampOptionalDimension(v, 100, 8000) }))} />
          </Stack>
        </ControlPanel>
        {presetError && <p role="alert" className="input-error">{presetError}</p>}
        <ControlPanel id="control-sym-settings" title="Settings" noToggle className="form-section-card">
          <Stack gap={3}>
            <NumInput id="input-sym-gap" label="Gap (mm)" value={sym.gap ?? 0}
              onChange={v => setSym(s => ({ ...s, gap: clampNumber(v, 0, 50000, 0) }))} min={0} />
            <Stack gap={1} className="ctrl-lbl">
              <span className="ctrl-sublbl">Layout style</span>
              <SegGroup label="Layout" value={sym.oneFullEdge ? "asym" : "sym"}
                options={[["asym", "Asymmetric"], ["sym", "Symmetric"]]}
                onChange={v => {
                  markStep(v === "asym" ? "Asymmetric" : "Symmetric");
                  setSym(s => ({ ...s, oneFullEdge: v === "asym" }));
                }} />
            </Stack>
            {sym.oneFullEdge && (
              <NumInput id="input-sym-custom-first" label="First piece width (mm)" value={sym.customFirstPieceWidth ?? ""} onChange={v => setSym(s => ({ ...s, customFirstPieceWidth: clampNumber(v, 0, 50000, 0) }))} min={0} />
            )}
          </Stack>
        </ControlPanel>
      </Stack>
      <div id="data-preview" className="data-preview">
        <PreviewSection
          id="symmetric-layout-preview"
          title="Axial Alignment"
          description="Align full panels on an axis and resolve the edge pieces."
        >
          {ready ? (
            <LayoutPanel layout={layout} result={result} hoveredType={hoveredType} setHoveredType={setHoveredType} isBest={false} noToggle />
          ) : (
            <LayoutEmptyState
              visual="axial"
              message={!started
                ? "Choose a material preset or enter a product width to begin."
                : !materialComplete
                  ? "Complete the product width."
                  : "Now enter the area width."}
              steps={[
                { label: "Choose or enter the product width", complete: materialComplete },
                { label: "Enter the area width", complete: roomComplete },
                { label: "Review the rendered alignment", complete: false }
              ]}
            />
          )}
        </PreviewSection>
      </div>
    </>
  );
}

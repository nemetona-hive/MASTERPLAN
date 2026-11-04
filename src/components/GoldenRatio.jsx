import { React } from "../react-globals.js";
import { ControlPanel, NumInput, SaveDefaultsButton, Stack, getLinkedCardMarker, getLinkedCardTone, safeSaveStaticDefaults, useDocHistory, useLinkedCardHighlight, useTimedState } from "../shared.jsx";
import { buildSeries, MIN_BASE, PHI } from "../utils/golden-ratio.js";
import { ProjectSection } from "./ProjectMenu.jsx";

/* What Save Defaults writes: each entry's id, value and label, nothing else.
   The server keeps the same three (validateGoldenRatioDefaults). */
const toDefaults = items => items.map(({ id, value, suffix }) => ({ id, value, suffix }));
/* Steps are marked out in whole millimetres; the base is shown as entered. */
const wholeMm = v => Math.round(v).toString();

export function SheetGoldenRatio({ grItems: baseItems, setGrItems: setBaseItems }) {
  const [baseOpen, setBaseOpen] = React.useState(true);
  const link = useLinkedCardHighlight("golden-ratio");

  /* Undo for each card's Reset. The items live in App's state and are handed
     down, so the snapshot reads the prop and `apply` calls the setter that
     came with it. Typing in a card is field-undo's, and takes no step. */
  const markStep = useDocHistory({
    key: "golden-ratio",
    snapshot: () => baseItems,
    apply: setBaseItems
  });

  const setItemField = (id, key, value) =>
    setBaseItems(items => items.map(item => (item.id === id ? { ...item, [key]: value } : item)));

  const resetItem = id => {
    markStep("Reset entry");
    setBaseItems(items => items.map(item => (item.id === id ? { ...item, value: "", suffix: "" } : item)));
  };

  const [saveStatus, setSaveStatus] = useTimedState("");
  const [saveError, setSaveError] = React.useState("");
  const saveGoldenRatioDefaults = async () => {
    setSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("goldenRatioDefaults", toDefaults(baseItems));
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || String(err));
      setSaveStatus("error");
    }
  };

  return (
    <>
      <div id="data-control" className="data-control">
        <ProjectSection />
        <ControlPanel id="control-base-number" title="Base Number" open={baseOpen} setOpen={setBaseOpen}>
          <div className="gr-defaults-row">
            <SaveDefaultsButton status={saveStatus} errorMessage={saveError} onClick={saveGoldenRatioDefaults} />
          </div>
          <Stack gap={2}>
            {baseItems.map(item => {
              const marker = getLinkedCardMarker(item.id);
              const tone = getLinkedCardTone(item.id);
              const series = buildSeries(item.value);
              const labelId = `input-base-label-suffix-${item.id}`;
              return (
                <div key={item.id} id={`control-base-number-${item.id}`}
                  className={`control-panel gr-control-card gr-control-card-${tone}`}
                  {...link.bindControl(item.id)}>
                  <Stack className="panel-data ctrl-list" gap={3}>
                    {/* Below 1 is refused, not clamped up to 1: the field keeps
                        what was typed and says why, rather than drawing a series
                        for a number nobody entered. */}
                    <Stack gap={1}>
                      <NumInput id={`input-base-number-field-${item.id}`} label={`Value ${marker} (mm)`}
                        value={item.value} min={0} onChange={v => setItemField(item.id, "value", v === "" ? "" : String(v))} />
                      {series.refused && <span role="alert" className="input-error">Enter a number of {MIN_BASE} or more.</span>}
                    </Stack>
                    <div className="num-wrap">
                      <label htmlFor={labelId} className="num-lbl">Custom label {marker}</label>
                      <input id={labelId} name={labelId} className="num-input gr-label-input" type="text" autoComplete="off"
                        value={item.suffix} onChange={e => setItemField(item.id, "suffix", e.target.value)}
                        placeholder="e.g. A, L, Start" />
                    </div>
                    <button type="button" className="ctrl-dir" onClick={() => resetItem(item.id)}
                      aria-label={`Reset entry ${marker}`}>
                      Reset
                    </button>
                  </Stack>
                </div>
              );
            })}
          </Stack>
        </ControlPanel>
      </div>
      <div id="data-preview" className="data-preview">
        <Stack className="gr-preview-list" gap={3}>
          <div className="preview-head">
            <div className="preview-head-main">
              <h2 className="preview-title">Golden Ratio phi</h2>
              <p className="preview-desc">Build proportion series from each base value using φ = {PHI.toFixed(13)}.</p>
            </div>
          </div>
          {baseItems.map(item => {
            const suffix = item.suffix.trim();
            const tone = getLinkedCardTone(item.id);
            const series = buildSeries(item.value);
            return (
              <div key={item.id} id={`panel-golden-ratio-${item.id}`}
                className={`sys-block gr-preview-card gr-preview-card-${tone}${link.isActive(item.id) ? " linked-preview-active" : ""}`}>
                <Stack className="section-pad gr-section-pad" gap={3}>
                  <div className="data-row">
                    <span className="data-row-lbl">Value{suffix && <> <span className="num-lbl-raw">{suffix}</span></>}</span>
                    <span className="data-row-val hi">{series.valid ? String(series.base) : "-"}</span>
                    <span className="data-row-unit">mm</span>
                    <span className="gr-row-marker">{getLinkedCardMarker(item.id)}</span>
                  </div>
                  {series.valid && (
                    <div className="gr-steps-wrap">
                      {series.steps.map((s, i) => (
                        <div key={s.step} className={"gr-step-row" + (i === 0 ? " gr-step-row-first" : "")}>
                          <div className="data-row gr-step-cell gr-step-cell-index"><span className="data-row-val">{s.step}</span></div>
                          <div className="data-row gr-step-cell"><span className="data-row-val">{wholeMm(s.value)}</span></div>
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

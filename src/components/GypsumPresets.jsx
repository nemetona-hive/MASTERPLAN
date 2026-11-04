import { React } from "../react-globals.js";
import { parseMeasurement } from "../utils/measurements.cjs";
import { useSessionState } from "../utils/session-state.js";
import { Icon, MaterialPresetDropdown, Modal, NumInput, SaveDefaultsButton, SelectedPresetDetail, Stack, safeSaveStaticDefaults, useClickOutside, useDropdownKeyboard, useTimedState } from "../shared.jsx";

/*
 * The Gypsum page's three preset libraries — boards, joint fillers and
 * adhesives — each managed the way Pattern Layouts manages its own: a preset
 * list on the fields it fills, the chosen preset named in its card's header,
 * and a table behind Manage Presets (local mode only, where Save Defaults can
 * write). Three small libraries rather than one wide one, because a board, a
 * filler and an adhesive are bought separately and mixed freely: a Knauf board
 * with a Gyproc adhesive is an ordinary job.
 *
 * A library is data; the hook and components below are written once for all
 * three. `columns` are [field, table heading, accessible name]; `required` are
 * the fields a preset must fill in to be applied.
 */
export const LIBRARIES = {
  board: {
    id: "board",
    title: "Board Presets",
    saveKey: "gypsumPresets",
    draftKeys: ["presets", "activePreset"],
    defaults: () => (typeof DEFAULT_GYPSUM_PRESETS !== "undefined" ? DEFAULT_GYPSUM_PRESETS : null),
    columns: [
      ["sheetW", "Width mm", "Sheet width"],
      ["sheetL", "Length mm", "Sheet length"],
      ["screwRate", "Screws/m²", "Screws per m²"],
      ["sheetPrice", "€ sheet", "Sheet price"]
    ],
    required: ["sheetW", "sheetL", "screwRate"],
    requiredText: "sheet size and screws",
    grid: "pw-preset-grid--gypsum",
    modalClass: "gyp-preset-modal--board",
    detail: p => `${p.sheetW} × ${p.sheetL} mm`,
    describe: (p, field) => ({ meta: `${p.sheetW} × ${p.sheetL} mm`, value: field === "sheetL" ? p.sheetL : p.sheetW, unit: field === "sheetL" ? "l" : "w" }),
    note: "Knauf and Gyproc screw rates are the makers' single-layer figures on a stud wall."
  },
  filler: {
    id: "filler",
    title: "Joint Filler Presets",
    saveKey: "gypsumFillerPresets",
    draftKeys: ["fillerPresets", "activeFiller"],
    defaults: () => (typeof DEFAULT_GYPSUM_FILLER_PRESETS !== "undefined" ? DEFAULT_GYPSUM_FILLER_PRESETS : null),
    columns: [
      ["compoundRate", "kg/m joint", "Joint filler per metre of joint"],
      ["bagKg", "Bag kg", "Filler bag weight"]
    ],
    required: ["compoundRate"],
    requiredText: "the filler rate",
    grid: "pw-preset-grid--dimensions",
    detail: p => `${p.compoundRate} kg/m${p.bagKg ? ` · ${p.bagKg} kg bag` : ""}`,
    describe: p => ({ meta: p.bagKg ? `${p.bagKg} kg bag` : "", value: p.compoundRate, unit: "kg/m" }),
    note: "Rates are per metre of joint, as the makers give them: Knauf Uniflott 0.25 kg/m."
  },
  adhesive: {
    id: "adhesive",
    title: "Adhesive Presets",
    saveKey: "gypsumAdhesivePresets",
    draftKeys: ["adhesivePresets", "activeAdhesive"],
    defaults: () => (typeof DEFAULT_GYPSUM_ADHESIVE_PRESETS !== "undefined" ? DEFAULT_GYPSUM_ADHESIVE_PRESETS : null),
    columns: [
      ["adhesiveRate", "kg/m²", "Adhesive per m²"],
      ["adhesiveBagKg", "Bag kg", "Adhesive bag weight"]
    ],
    required: ["adhesiveRate"],
    requiredText: "the adhesive rate",
    grid: "pw-preset-grid--dimensions",
    detail: p => `${p.adhesiveRate} kg/m²${p.adhesiveBagKg ? ` · ${p.adhesiveBagKg} kg bag` : ""}`,
    describe: p => ({ meta: p.adhesiveBagKg ? `${p.adhesiveBagKg} kg bag` : "", value: p.adhesiveRate, unit: "kg/m²" }),
    note: "For a flat, plumb masonry wall; an uneven one takes more."
  }
};

export const libraryFields = lib => lib.columns.map(([field]) => field);
const blank = lib => ({ name: "", ...Object.fromEntries(libraryFields(lib).map(field => [field, ""])) });
const canManage = () => typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults();

/**
 * One library's presets and which is applied. `onApply(values)` receives the
 * library's fields, parsed, for the page to merge into its job.
 */
export function usePresetLibrary(lib, onApply) {
  const [presetsKey, activeKey] = lib.draftKeys.map(name => `Gypsum.jsx:${name}`);
  const [presets, setPresets] = useSessionState(presetsKey, () =>
    (lib.defaults() || [blank(lib)]).map(p => ({ ...blank(lib), ...p })));
  const [active, setActive] = useSessionState(activeKey, null);
  const [error, setError] = React.useState("");
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [saveStatus, setSaveStatus] = useTimedState("");
  const [saveError, setSaveError] = React.useState("");
  const [managing, setManaging] = React.useState(false);
  const fields = libraryFields(lib);

  const apply = (preset, idx) => {
    const values = Object.fromEntries(fields.map(field => [field, parseMeasurement(preset[field])]));
    const requiredOk = lib.required.every(field => Number.isFinite(values[field]) && values[field] > 0);
    const restOk = fields.every(field => values[field] === null || (Number.isFinite(values[field]) && values[field] >= 0));
    if (!requiredOk || !restOk) {
      setError(`Fill in ${lib.requiredText} before applying this preset.`);
      return;
    }
    setError("");
    onApply(Object.fromEntries(fields.map(field => [field, values[field] ?? ""])));
    setActive(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
  };

  const save = async () => {
    setSaveStatus("saving", 0);
    try {
      // Only this library's own fields: a preset carried over from before the
      // split may still hold another library's.
      await safeSaveStaticDefaults(lib.saveKey, presets.map(p => ({ name: p.name, ...Object.fromEntries(fields.map(f => [f, p[f] ?? ""])) })));
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || String(err));
      setSaveStatus("error");
    }
  };

  const named = presets.filter(p => p.name);
  const selected = active !== null && presets[active]?.name ? presets[active] : null;
  return {
    lib, fields, presets, active, selected, named, error, flashIdx, fieldFlash,
    saveStatus, saveError, managing, setManaging,
    setActive,
    apply,
    update: (idx, field, value) => setPresets(list => list.map((p, i) => (i === idx ? { ...p, [field]: value } : p))),
    add: () => setPresets(list => [...list, blank(lib)]),
    save,
    /** A hand edit means the values are no longer the preset's. */
    edited: () => setActive(null)
  };
}

/** The chosen preset's line for a card's `headerDetail`, or nothing. */
export function presetHeader({ selected, lib }) {
  return selected ? <SelectedPresetDetail preset={{ name: selected.name, detail: lib.detail(selected) }} /> : null;
}

/** A number field that also opens its library's preset list. */
export function PresetField({ library, field, id, label, labelIcon, value, onChange, min = 0, req = false }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const { named, selected, presets, apply, lib, fieldFlash } = library;
  useClickOutside([ref], () => setOpen(false), open);
  const pick = idx => {
    const preset = named[idx];
    if (preset) apply(preset, presets.indexOf(preset));
    setOpen(false);
  };
  const { hoveredIndex, onKeyDown } = useDropdownKeyboard(open ? named.length : 0, pick, () => setOpen(false));
  return (
    <div className={fieldFlash ? "num-input-flash" : ""} ref={ref} style={{ position: "relative" }}>
      <NumInput id={id} label={label} labelIcon={labelIcon} value={value} min={min} onChange={onChange} req={req}
        showActionLabels presetsOpen={open} presetHoveredIndex={hoveredIndex}
        onTogglePresets={() => setOpen(current => !current)} onCommit={() => setOpen(false)} onKeyDown={onKeyDown} />
      {open && named.length > 0 && (
        <MaterialPresetDropdown anchorRef={ref} presets={named} activePreset={selected ? named.indexOf(selected) : null}
          onApply={(_, idx) => pick(idx)} inputId={id} hoveredIndex={hoveredIndex} title={lib.title}
          describe={p => lib.describe(p, field)} />
      )}
    </div>
  );
}

/** The card's Manage Presets button, where Save Defaults can write. */
export function ManagePresetsButton({ library }) {
  if (!canManage()) return null;
  return (
    <button className="ctrl-dir form-section-action" onClick={() => library.setManaging(true)}
      aria-label={`Manage ${library.lib.title.toLowerCase()}`}>
      <Icon name="plus" /> Manage Presets
    </button>
  );
}

/** The library's table, in a dialog. */
export function PresetManager({ library }) {
  const { lib, presets, active, flashIdx, error, saveStatus, saveError, managing, setManaging, update, apply, add, save } = library;
  if (!managing) return null;
  const base = `gyp-${lib.id}-preset`;
  return (
    <Modal title={`Manage ${lib.title}`} onClose={() => setManaging(false)} className={lib.modalClass || ""}>
      <Stack gap={4}>
        <Stack gap={3}>
          <div className={`pw-preset-header ${lib.grid}`}>
            <span>Product Name</span>
            {lib.columns.map(([field, head]) => <span key={field}>{head}</span>)}
            <span>&nbsp;</span>
          </div>
          {presets.map((p, idx) => (
            <div key={idx} className={"pw-preset-row" + (active === idx ? " pw-preset-active" : "")}>
              <div className={`pw-preset-fields ${lib.grid}`}>
                <div>
                  <span className="pw-preset-lbl-hide">Product Name</span>
                  <input id={`${base}-name-${idx}`} aria-label={`Product name ${idx + 1}`} type="text"
                    className="num-input" value={p.name} onChange={e => update(idx, "name", e.target.value)} />
                </div>
                {lib.columns.map(([field, head, aria]) => (
                  <div key={field}>
                    <span className="pw-preset-lbl-hide">{head}</span>
                    <input id={`${base}-${field}-${idx}`} aria-label={`${aria} ${idx + 1}`} type="text"
                      inputMode="decimal" autoComplete="off" className="num-input"
                      value={p[field] ?? ""} onChange={e => update(idx, field, e.target.value)} />
                  </div>
                ))}
                <div className="num-wrap" style={{ justifyContent: "center" }}>
                  <span className="pw-preset-lbl-hide">&nbsp;</span>
                  {active === idx
                    ? <div className="pw-preset-badge">active</div>
                    : <button className={"ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : "")}
                        onClick={() => apply(p, idx)} title="Apply these values to the calculator">
                        <Icon name="check" /> {flashIdx === idx ? "Applied" : "Apply"}
                      </button>}
                </div>
              </div>
            </div>
          ))}
        </Stack>
        <Stack direction="row" gap={2}>
          <button className="ctrl-dir" onClick={add}><Icon name="plus" /> Add Row</button>
          <SaveDefaultsButton status={saveStatus} errorMessage={saveError} onClick={save} />
        </Stack>
        <div className="pw-formula-text">
          Fill preset data above and click "Apply" to update the calculator, or "Save Defaults" to persist. {lib.note}
        </div>
        {error && <p role="alert" className="input-error">{error}</p>}
      </Stack>
    </Modal>
  );
}

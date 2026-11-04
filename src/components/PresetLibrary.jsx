import { React } from "../react-globals.js";
import { parseMeasurement } from "../utils/measurements.cjs";
import { useSessionState } from "../utils/session-state.js";
import { Icon, MaterialPresetDropdown, Modal, NumInput, SaveDefaultsButton, SelectedPresetDetail, Stack, safeSaveStaticDefaults, useClickOutside, useDropdownKeyboard, useTimedState } from "../shared.jsx";

/*
 * A preset library, written once for every page that has one: a list of
 * products on the fields they fill, the chosen one named above its card, and
 * a table behind Manage Presets (local mode only, where Save Defaults can
 * write). Gypsum has three (GypsumPresets.jsx), Concrete one (Concrete.jsx).
 *
 * A library is data:
 *   id, title          — the dialog's and the dropdown's heading
 *   saveKey            — the config.js constant Save Defaults rewrites
 *   draftKey           — the useSessionState key the list is kept under; null
 *                        for a list the page cannot edit (no Manage dialog),
 *                        which is read from `defaults()` and kept by nobody
 *   defaults()         — the shipped list, from config.js
 *   columns            — [field, table heading, accessible name]
 *   required / requiredAny / requiredText — what a preset must fill in to apply
 *   grid, modalClass   — the table's column template and the dialog's width
 *   idBase             — prefix of the table's input ids (default `<id>-preset`)
 *   nameLabel          — the name column's heading (default "Product Name")
 *   validate(values)   — optional: a message when parsed values cannot be applied,
 *                        in place of the required/positive check
 *   detail(p)          — the line under the card header naming the preset
 *   describe(p, field) — the dropdown row: { meta, value, unit }; left out for a
 *                        library of sizes ({ width, length }), which the dropdown
 *                        draws as they are
 *   note               — a line under the table
 */

export const libraryFields = lib => lib.columns.map(([field]) => field);
const blank = lib => ({ name: "", ...Object.fromEntries(libraryFields(lib).map(field => [field, ""])) });
const canManage = () => typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults();

/**
 * One library's presets and which is applied. `onApply(values)` receives the
 * library's fields, parsed, for the page to merge into its own state.
 *
 * The list is kept as a draft under `lib.draftKey` (so a project carries it).
 * Which preset is applied is the page's to keep, because where it lives
 * differs: Concrete has one, Gypsum one per room (a bathroom on moisture board
 * and a bedroom on standard board share the list and differ in the choice).
 * So the page passes `active` and `setActive`.
 */
export function usePresetLibrary(lib, { onApply, active, setActive }) {
  const presetsKey = lib.draftKey ?? null;
  const [presets, setPresets] = useSessionState(presetsKey, () =>
    (lib.defaults() || [blank(lib)]).map(p => ({ ...blank(lib), ...p })));
  const [error, setError] = React.useState("");
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [saveStatus, setSaveStatus] = useTimedState("");
  const [saveError, setSaveError] = React.useState("");
  const [managing, setManaging] = React.useState(false);
  const fields = libraryFields(lib);

  const apply = (preset, idx) => {
    const values = Object.fromEntries(fields.map(field => [field, parseMeasurement(preset[field])]));
    const positive = field => Number.isFinite(values[field]) && values[field] > 0;
    const requiredOk = lib.required.every(positive) && (!lib.requiredAny || lib.requiredAny.some(positive));
    const restOk = fields.every(field => values[field] === null || (Number.isFinite(values[field]) && values[field] >= 0));
    const refusal = lib.validate ? lib.validate(values)
      : !requiredOk || !restOk ? `Fill in ${lib.requiredText} before applying this preset.` : null;
    if (refusal) {
      setError(refusal);
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
export function PresetField({ library, field, id, label, labelIcon, value, onChange, min = 0, max, req = false, className = "" }) {
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
    <div className={["preset-field", className, fieldFlash ? "num-input-flash" : ""].filter(Boolean).join(" ")} ref={ref}>
      <NumInput id={id} label={label} labelIcon={labelIcon} value={value} min={min} max={max} onChange={onChange} req={req}
        showActionLabels presetsOpen={open} presetHoveredIndex={hoveredIndex}
        onTogglePresets={() => setOpen(current => !current)} onCommit={() => setOpen(false)} onKeyDown={onKeyDown} />
      {open && named.length > 0 && (
        <MaterialPresetDropdown anchorRef={ref} presets={named} activePreset={selected ? named.indexOf(selected) : null}
          onApply={(_, idx) => pick(idx)} inputId={id} hoveredIndex={hoveredIndex} title={lib.title}
          field={field} describe={lib.describe ? p => lib.describe(p, field) : undefined} />
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
  const base = lib.idBase || `${lib.id}-preset`;
  const nameLabel = lib.nameLabel || "Product Name";
  const nameAria = nameLabel.charAt(0) + nameLabel.slice(1).toLowerCase();
  return (
    <Modal title={`Manage ${lib.title}`} onClose={() => setManaging(false)} className={lib.modalClass || ""}>
      <Stack gap={4}>
        <Stack gap={3}>
          <div className={`pw-preset-header ${lib.grid}`}>
            <span>{nameLabel}</span>
            {lib.columns.map(([field, head]) => <span key={field}>{head}</span>)}
            <span>&nbsp;</span>
          </div>
          {presets.map((p, idx) => (
            <div key={idx} className={"pw-preset-row" + (active === idx ? " pw-preset-active" : "")}>
              <div className={`pw-preset-fields ${lib.grid}`}>
                <div>
                  <span className="pw-preset-lbl-hide">{nameLabel}</span>
                  <input id={`${base}-name-${idx}`} aria-label={`${nameAria} ${idx + 1}`} type="text"
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
                <div className="num-wrap pw-preset-apply-cell">
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

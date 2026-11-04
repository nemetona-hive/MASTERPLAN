import { jointFillerRate } from "../utils/gypsum-take-off.js";
export { ManagePresetsButton, PresetField, PresetManager, libraryFields, presetHeader, usePresetLibrary } from "./PresetLibrary.jsx";

/*
 * The Gypsum page's three preset libraries — boards, joint fillers and
 * adhesives — each managed the way Pattern Layouts manages its own: a preset
 * list on the fields it fills, the chosen preset named in its card's header,
 * and a table behind Manage Presets (local mode only, where Save Defaults can
 * write). Three small libraries rather than one wide one, because a board, a
 * filler and an adhesive are bought separately and mixed freely: a Knauf board
 * with a Gyproc adhesive is an ordinary job.
 *
 * A library is data (its fields are listed in PresetLibrary.jsx); the hook and
 * components there are written once for every library in the app.
 */
export const LIBRARIES = {
  board: {
    id: "board",
    title: "Board Presets",
    saveKey: "gypsumPresets",
    draftKey: "Gypsum.jsx:presets",
    idBase: "gyp-board-preset",
    activeKey: "activePreset",   // the room field holding which preset is applied
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
    draftKey: "Gypsum.jsx:fillerPresets",
    idBase: "gyp-filler-preset",
    activeKey: "activeFiller",   // the room field holding which preset is applied
    defaults: () => (typeof DEFAULT_GYPSUM_FILLER_PRESETS !== "undefined" ? DEFAULT_GYPSUM_FILLER_PRESETS : null),
    /* Per metre of joint where the maker says so (Uniflott), per m² per 1 mm
       where it gives a skim rate instead (Fill & Finish, Super Finish); one
       of the two is enough, and the per-metre rate is worked out from the
       per-mm one when it is left blank. */
    columns: [
      ["compoundRate", "kg/m joint", "Joint filler per metre of joint"],
      ["skimRate", "kg/m² 1 mm", "Filler per m² per 1 mm"],
      ["bagKg", "Bag kg", "Filler bag weight"]
    ],
    required: [],
    requiredAny: ["compoundRate", "skimRate"],
    requiredText: "kg per metre of joint or kg/m² per 1 mm",
    grid: "pw-preset-grid--gyp-filler",
    detail: p => {
      const { rate, derived } = jointFillerRate(p.compoundRate, p.skimRate);
      return [rate !== null && `${derived ? "≈ " : ""}${rate} kg/m`, p.skimRate !== "" && p.skimRate != null && `${p.skimRate} kg/m² per mm`, p.bagKg && `${p.bagKg} kg bag`].filter(Boolean).join(" · ");
    },
    describe: p => {
      const { rate, derived } = jointFillerRate(p.compoundRate, p.skimRate);
      return { meta: [p.skimRate !== "" && p.skimRate != null && `${p.skimRate} kg/m² per mm`, p.bagKg && `${p.bagKg} kg bag`].filter(Boolean).join(" · "),
        value: rate === null ? "—" : `${derived ? "≈" : ""}${rate}`, unit: "kg/m" };
    },
    note: "Give kg per metre of joint where the maker does (Knauf Uniflott 0.25 kg/m), or kg/m² per 1 mm (Knauf Fill & Finish Light 1.1): the per-metre rate is then worked out, as 1 mm over a 340 mm strip of joint."
  },
  adhesive: {
    id: "adhesive",
    title: "Adhesive Presets",
    saveKey: "gypsumAdhesivePresets",
    draftKey: "Gypsum.jsx:adhesivePresets",
    idBase: "gyp-adhesive-preset",
    activeKey: "activeAdhesive",   // the room field holding which preset is applied
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

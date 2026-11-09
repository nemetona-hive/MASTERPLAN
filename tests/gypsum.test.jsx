// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetGypsum, newRoom } from "../src/components/Gypsum.jsx";
import { DraftStore, SessionDraftContext } from "../src/utils/session-state.js";

/* The page's wiring: modes, presets, the diagram and the result card. The
   arithmetic is `tests/gypsum-take-off.test.js`. */

/* The page's preset libraries start from config.js, which Save Defaults
   rewrites with whatever the user keeps. These tests use the shipped
   presets, fixed here, so a saved library cannot fail them. */
const FIXTURES = {
  DEFAULT_GYPSUM_PRESETS: [
    { name: "Knauf GKB 12.5", sheetW: 1250, sheetL: 2600, screwRate: 20, sheetPrice: "" },
    { name: "Gyproc GN 13", sheetW: 1200, sheetL: 2600, screwRate: 13, sheetPrice: "" },
    { name: "", sheetW: "", sheetL: "", screwRate: "", sheetPrice: "" }
  ],
  DEFAULT_GYPSUM_FILLER_PRESETS: [
    { name: "Knauf Uniflott", compoundRate: 0.25, skimRate: "", bagKg: 25 },
    { name: "Knauf Fill & Finish Light", compoundRate: "", skimRate: 1.1, bagKg: 20 },
    { name: "", compoundRate: "", skimRate: "", bagKg: "" }
  ],
  DEFAULT_GYPSUM_ADHESIVE_PRESETS: [
    { name: "Knauf Perlfix", adhesiveRate: 5, adhesiveBagKg: 25 },
    { name: "Gyproc DriWall", adhesiveRate: 4.3, adhesiveBagKg: 25 },
    { name: "", adhesiveRate: "", adhesiveBagKg: "" }
  ]
};
const saved = {};
beforeAll(() => { for (const [name, value] of Object.entries(FIXTURES)) { saved[name] = globalThis[name]; globalThis[name] = value; } });
afterAll(() => Object.assign(globalThis, saved));

const type = (id, value) => {
  const el = document.getElementById(id);
  fireEvent.change(el, { target: { value: String(value) } });
  fireEvent.blur(el);
};
const sheetsNeeded = () => document.querySelector(".result-card-value").textContent.replace(/\D+/g, "");

const fillRoom = () => {
  type("input-gyp-lenMm", 4000);
  type("input-gyp-widMm", 3000);
  type("input-gyp-heightMm", 2600);
  type("input-gyp-sheetW", 1200);
  type("input-gyp-sheetL", 2600);
  type("input-gyp-waste", 0);
};

describe("the gypsum page", () => {
  it("counts sheets for a room and draws each surface", () => {
    render(<SheetGypsum />);
    fillRoom();
    expect(sheetsNeeded()).toBe("12");
    expect(screen.getByText("Walls A, C")).toBeTruthy();
    expect(screen.getByText("Walls B, D")).toBeTruthy();
    expect(document.querySelectorAll(".gyp-surface svg[role='img']")).toHaveLength(2);
  });

  it("counts a full board for every piece when asked", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Full board each"));
    expect(sheetsNeeded()).toBe("14");
    fireEvent.click(screen.getByText("Reuse offcuts"));
    expect(sheetsNeeded()).toBe("12");
  });

  it("shows joint filler and tape rows only once a filler is given", () => {
    render(<SheetGypsum />);
    fillRoom();
    expect(screen.queryByText("Joints filled")).toBeNull();
    expect(screen.queryByText(/^Joint filler/, { selector: "#data-preview *" })).toBeNull();
    expect(screen.queryByText("Joint tape")).toBeNull();
    type("input-gyp-compoundRate", 0.25);
    expect(screen.getByText("Joint tape")).toBeTruthy();
    expect(screen.getByText("Joints filled")).toBeTruthy();
    expect(screen.getByText("Joint filler (0.25 kg/m)")).toBeTruthy();
  });

  it("offers row order by fixing direction", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("R1 right"));
    expect(sheetsNeeded()).toBe("12");
    fireEvent.click(screen.getByText("Horizontal"));
    expect(screen.getByText("R1 bottom")).toBeTruthy();
    expect(screen.queryByText("R1 right")).toBeNull();
  });

  it("names a selected board beside its surface's name, the counts kept on the right", () => {
    render(<SheetGypsum />);
    fillRoom();
    const surface = document.querySelector(".gyp-surface");
    const pick = () => surface.querySelector(".gyp-surface-pick").textContent;
    const count = () => surface.querySelector(".gyp-surface-count").textContent;
    expect(pick()).toBe("");
    expect(count()).toBe("3 full · 1 cut · 4 boards each");
    fireEvent.click(surface.querySelectorAll(".layout-svg-seg")[0]);
    expect(pick()).toBe("R1 · full board · 1200 × 2600 mm");
    fireEvent.click(surface.querySelectorAll(".layout-svg-seg")[3]);
    expect(pick()).toBe("R4 · cut · 400 × 2600 mm");
    expect(count()).toBe("3 full · 1 cut · 4 boards each");
    fireEvent.click(surface.querySelectorAll(".layout-svg-seg")[3]);
    expect(pick()).toBe("");
  });

  it("starts each wall on a full panel, and trims the first board when asked", () => {
    render(<SheetGypsum />);
    const trim = () => screen.getByText("Trim first");
    // Nothing laid out yet: nothing for Trim first to decide.
    expect(trim().disabled).toBe(true);
    type("input-gyp-lenMm", 5130);
    type("input-gyp-widMm", 3000);
    type("input-gyp-heightMm", 2500);
    type("input-gyp-sheetW", 1250);
    type("input-gyp-sheetL", 2500);
    fireEvent.click(screen.getByText("Horizontal"));
    const labels = () => [...document.querySelector(".gyp-surface").querySelectorAll(".layout-svg-label")].map(t => t.textContent).slice(0, 3);
    expect(labels()).toEqual(["2500", "2330", "300"]);
    expect(trim().disabled).toBe(false);
    fireEvent.click(trim());
    expect(labels()).toEqual(["2330", "2500", "300"]);
    // A wall that ends on 300 or more leaves nothing to trim: Full panel shows,
    // and the room's choice comes back with a length that needs it again.
    type("input-gyp-lenMm", 5400);
    type("input-gyp-widMm", 2400);
    expect(trim().disabled).toBe(true);
    expect(screen.getByText("Full panel").getAttribute("aria-pressed")).toBe("true");
    type("input-gyp-lenMm", 5130);
    expect(trim().getAttribute("aria-pressed")).toBe("true");
  });

  it("opens a room saved while Trim first was the default on Full panel", () => {
    const drafts = new DraftStore();
    const old = { ...newRoom(1), fullStart: false, orientation: "H",
      job: { ...newRoom(1).job, lenMm: "5130", widMm: "3000", heightMm: "2500", sheetW: "1250", sheetL: "2500" } };
    delete old.trimFirst;
    drafts.set("Gypsum.jsx:rooms", [old]);
    render(<SessionDraftContext.Provider value={drafts}><SheetGypsum /></SessionDraftContext.Provider>);
    expect(screen.getByText("Full panel").getAttribute("aria-pressed")).toBe("true");
    const labels = [...document.querySelector(".gyp-surface").querySelectorAll(".layout-svg-label")].map(t => t.textContent).slice(0, 3);
    expect(labels).toEqual(["2500", "2330", "300"]);
  });

  it("leaves a row out from its label, and puts it back", () => {
    render(<SheetGypsum />);
    fillRoom();
    const surface = document.querySelector(".gyp-surface");
    const r4 = () => [...surface.querySelectorAll(".layout-svg-row-toggle")].find(t => t.textContent.endsWith("R4"));
    expect(sheetsNeeded()).toBe("12");
    expect(r4().getAttribute("aria-checked")).toBe("true");
    expect(r4().querySelector(".layout-svg-check-mark")).toBeTruthy();
    // The box itself is the target as much as the label.
    fireEvent.click(r4().querySelector(".layout-svg-check"));
    expect(sheetsNeeded()).toBe("11");
    expect(r4().getAttribute("aria-checked")).toBe("false");
    expect(r4().querySelector(".layout-svg-check-mark")).toBeNull();
    expect(r4().querySelector(".layout-svg-row-label.is-excluded")).toBeTruthy();
    expect(surface.querySelectorAll(".layout-svg-seg.is-excluded")).toHaveLength(1);
    expect(surface.querySelector(".gyp-surface-count").textContent).toBe("3 full · 0 cut · 3 boards each");
    expect(screen.getByText("Rows left out")).toBeTruthy();
    fireEvent.keyDown(r4(), { key: "Enter" });
    expect(sheetsNeeded()).toBe("12");
    expect(screen.queryByText("Rows left out")).toBeNull();
  });

  it("says what shared offcuts save when the walls alone add up to more", () => {
    render(<SheetGypsum />);
    fillRoom();
    // Walls 4 + 4 + 3 + 3 alone; 12 for the room.
    expect(document.querySelector(".gyp-shared-note").textContent.replace(/\s+/g, " "))
      .toBe("Walls alone: 14 boards · shared offcuts save 2");
    fireEvent.click(screen.getByText("Per wall"));
    expect(sheetsNeeded()).toBe("14");
    expect(document.querySelector(".gyp-shared-note")).toBeNull();
    fireEvent.click(screen.getByText("Shared"));
    expect(sheetsNeeded()).toBe("12");
    fireEvent.click(screen.getByText("Full board each"));
    expect(document.querySelector(".gyp-shared-note")).toBeNull();
    expect(screen.queryByText("Per wall")).toBeNull();
  });

  it("offers a first row height only when fixing horizontally", () => {
    render(<SheetGypsum />);
    fillRoom();
    expect(document.getElementById("input-gyp-firstRow")).toBeNull();
    fireEvent.click(screen.getByText("Horizontal"));
    type("input-gyp-firstRow", 600);
    const rows = document.querySelector(".gyp-surface").querySelectorAll(".layout-svg-row-label");
    expect(rows).toHaveLength(3);
  });

  it("adds a ceiling drawing when the ceiling is boarded", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Walls + ceiling"));
    expect(screen.getByText("Ceiling")).toBeTruthy();
    expect(document.querySelectorAll(".gyp-surface svg[role='img']")).toHaveLength(3);
  });

  it("switches to a single wall", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Single wall"));
    type("input-gyp-wallW", 2400);
    type("input-gyp-wallH", 2600);
    type("input-gyp-sheetW", 1200);
    type("input-gyp-sheetL", 2600);
    type("input-gyp-waste", 0);
    expect(sheetsNeeded()).toBe("2");
  });

  it("fills sheet and consumables from a board preset, and names it in the card", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getAllByTitle("Presets")[1]);   // on sheet length, the second list
    fireEvent.pointerDown(screen.getByText("Gyproc GN 13"));
    expect(document.getElementById("input-gyp-sheetW").value).toBe("1200");
    expect(document.getElementById("input-gyp-screwRate").value).toBe("13");
    expect(document.querySelector("#control-gyp-board .panel-preset-meta").textContent).toContain("Gyproc GN 13");
  });

  it("offers glued walls: adhesive instead of screws, one layer", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getAllByTitle("Presets")[0]);
    fireEvent.pointerDown(screen.getByText("Knauf GKB 12.5"));
    expect(document.getElementById("control-gyp-adhesive")).toBe(null);
    fireEvent.click(screen.getByText("Glued"));
    expect(screen.queryByText("2 layers")).toBe(null);
    expect(document.getElementById("input-gyp-screwRate")).toBe(null);
    expect(document.getElementById("control-gyp-adhesive")).toBeTruthy();
    fireEvent.click(screen.getByText("Walls + ceiling"));
    expect(document.getElementById("input-gyp-screwRate").value).toBe("20");
    expect(screen.getByText("Ceiling screws (pcs/m²)")).toBeTruthy();
  });

  /* Three libraries: a board preset fills only the board's fields, and the
     filler and adhesive each come from their own. */
  it("keeps board, filler and adhesive presets apart", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Glued"));
    const list = id => document.getElementById(id).closest(".preset-field").querySelector("[title='Presets']");
    fireEvent.click(list("input-gyp-sheetW"));
    fireEvent.pointerDown(screen.getByText("Gyproc GN 13"));
    expect(document.getElementById("input-gyp-compoundRate").value).toBe("");
    expect(document.getElementById("input-gyp-adhesiveRate").value).toBe("");

    fireEvent.click(list("input-gyp-compoundRate"));
    fireEvent.pointerDown(screen.getByText("Knauf Uniflott"));
    expect(document.getElementById("input-gyp-compoundRate").value).toBe("0.25");
    expect(document.getElementById("input-gyp-bagKg").value).toBe("25");

    fireEvent.click(list("input-gyp-adhesiveRate"));
    fireEvent.pointerDown(screen.getByText("Gyproc DriWall"));
    expect(document.getElementById("input-gyp-adhesiveRate").value).toBe("4.3");

    // A Gyproc board with Knauf filler and Gyproc adhesive, each named.
    expect(document.querySelector("#control-gyp-board .panel-preset-meta").textContent).toContain("Gyproc GN 13");
    expect(document.querySelector("#control-gyp-filler .panel-preset-meta").textContent).toContain("Knauf Uniflott");
    expect(document.querySelector("#control-gyp-adhesive .panel-preset-meta").textContent).toContain("Gyproc DriWall");
    // The sheet's preset stays chosen when the filler changes.
    expect(document.getElementById("input-gyp-sheetW").value).toBe("1200");
  });

  it("shows the per-metre rate it worked out for a filler given per 1 mm", () => {
    render(<SheetGypsum />);
    const list = document.getElementById("input-gyp-compoundRate").closest(".preset-field").querySelector("[title='Presets']");
    fireEvent.click(list);
    fireEvent.pointerDown(screen.getByText("Knauf Fill & Finish Light"));
    expect(document.getElementById("input-gyp-compoundRate").value).toBe("");
    expect(document.getElementById("input-gyp-skimRate").value).toBe("1.1");
    expect(document.querySelector(".gyp-derived").textContent).toContain("0.374 kg per m of joint");
    // Typed by hand, as for a filler with no preset:
    type("input-gyp-skimRate", 1.3);
    expect(document.querySelector(".gyp-derived").textContent).toContain(`${Math.round(1.3 * 0.34 * 1000) / 1000} kg per m of joint`);
    type("input-gyp-compoundRate", 0.3);
    expect(document.querySelector(".gyp-derived")).toBe(null);
  });

  it("manages each library in its own dialog", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByLabelText("Manage board presets"));
    expect(screen.getByRole("dialog").textContent).toContain("Manage Board Presets");
    fireEvent.click(screen.getAllByTitle("Apply these values to the calculator")[0]);
    expect(document.getElementById("input-gyp-sheetW").value).toBe("1250");
    fireEvent.click(screen.getByLabelText("Close"));

    fireEvent.click(screen.getByLabelText("Manage joint filler presets"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Manage Joint Filler Presets");
    expect(dialog.querySelectorAll(".pw-preset-row")).toHaveLength(3);
  });

  it("keeps printing disabled until there is a job", () => {
    render(<SheetGypsum />);
    expect(screen.getByText("Take-off").closest("button").disabled).toBe(true);
    fillRoom();
    expect(screen.getByText("Take-off").closest("button").disabled).toBe(false);
  });

  it("adds a door, places it, and draws it on its own wall", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Door"));
    expect(screen.getByText("D1")).toBeTruthy();
    // Unplaced: off the area, not drawn, and walls A and C still drawn as one.
    expect(screen.getByText("Walls A, C")).toBeTruthy();
    expect(document.querySelectorAll(".layout-svg-opening")).toHaveLength(0);
    fireEvent.change(document.querySelector("[id$='-x']"), { target: { value: "500" } });
    expect(screen.getByText("Wall A", { selector: ".gyp-surface-name" })).toBeTruthy();
    expect(screen.getByText("Wall C", { selector: ".gyp-surface-name" })).toBeTruthy();
    expect(document.querySelectorAll(".layout-svg-opening")).toHaveLength(1);
  });

  it("leaves a wall out of the room and back in", () => {
    render(<SheetGypsum />);
    fillRoom();
    const before = Number(sheetsNeeded());
    fireEvent.click(screen.getByRole("button", { name: "Wall B" }));
    expect(screen.getByRole("button", { name: "Wall B" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Wall D", { selector: ".gyp-surface-name" })).toBeTruthy();
    expect(Number(sheetsNeeded())).toBeLessThan(before);
    fireEvent.click(screen.getByRole("button", { name: "Wall B" }));
    expect(screen.getByText("Walls B, D")).toBeTruthy();
    expect(Number(sheetsNeeded())).toBe(before);
  });

  it("moves an opening to another wall", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Window"));
    fireEvent.change(document.querySelector("[id$='-x']"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(screen.getByText("Wall B", { selector: ".gyp-surface-name" })).toBeTruthy();
    expect(screen.getByText("Walls A, C")).toBeTruthy();
  });

  it("removes an opening", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Door"));
    fireEvent.click(screen.getByLabelText("Remove D1"));
    expect(screen.queryByText("D1")).toBe(null);
  });
});

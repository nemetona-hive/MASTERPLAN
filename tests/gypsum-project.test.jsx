// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetGypsum, newRoom, roomFrom, roomLabel } from "../src/components/Gypsum.jsx";
import { GypsumProjectSheet } from "../src/components/GypsumTakeOffSheet.jsx";
import { DraftStore, SessionDraftContext } from "../src/utils/session-state.js";
import { buildGypsumProjectTakeOff, buildGypsumTakeOff } from "../src/utils/gypsum-take-off.js";

/* A project's rooms and walls on the Gypsum page: the list, what each room
   keeps of its own, and the totals across them. One room's arithmetic is
   tests/gypsum-take-off.test.js. */

const FIXTURES = {
  DEFAULT_GYPSUM_PRESETS: [
    { name: "Knauf GKB 12.5", sheetW: 1250, sheetL: 2600, screwRate: 20, sheetPrice: "" },
    { name: "Gyproc GN 13", sheetW: 1200, sheetL: 2600, screwRate: 13, sheetPrice: "" }
  ],
  DEFAULT_GYPSUM_FILLER_PRESETS: [{ name: "Knauf Uniflott", compoundRate: 0.25, skimRate: "", bagKg: 25 }],
  DEFAULT_GYPSUM_ADHESIVE_PRESETS: [{ name: "Knauf Perlfix", adhesiveRate: 5, adhesiveBagKg: 25 }]
};
const saved = {};
beforeAll(() => { for (const [name, value] of Object.entries(FIXTURES)) { saved[name] = globalThis[name]; globalThis[name] = value; } });
afterAll(() => Object.assign(globalThis, saved));

const fields = (over = {}) => ({
  mode: "room", lenMm: "4000", widMm: "3000", heightMm: "2600", ceiling: false, openings: [],
  sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "5",
  screwRate: "20", compoundRate: "0.25", bagKg: "25", sheetPrice: "8.50", product: "Knauf", ...over
});
const entry = (id, name, over) => ({ id, name, takeOff: buildGypsumTakeOff(fields(over)) });

describe("the project take-off", () => {
  it("adds sheets with their waste and rounds up once per board", () => {
    const a = entry(1, "Kitchen"), b = entry(2, "Hall", { lenMm: "3000", widMm: "2000" });
    const project = buildGypsumProjectTakeOff([a, b]);
    expect(project.boards).toHaveLength(1);
    const exact = a.takeOff.sheets.exact + b.takeOff.sheets.exact;
    expect(project.boards[0].toBuy).toBe(Math.ceil(exact));
    expect(project.boards[0].toBuy).toBeLessThanOrEqual(a.takeOff.sheets.toBuy + b.takeOff.sheets.toBuy);
    expect(project.boards[0].rooms).toEqual(["Kitchen", "Hall"]);
    expect(project.cost.total).toBeCloseTo(project.boards[0].toBuy * 8.5, 2);
  });

  it("keeps different boards, fillers and adhesives on lines of their own", () => {
    const project = buildGypsumProjectTakeOff([
      entry(1, "Bedroom"),
      entry(2, "Bath", { product: "Moisture", sheetPrice: "", fixing: "glue", adhesiveRate: "5", adhesiveBagKg: "25", fillerProduct: "Other", bagKg: "20" })
    ]);
    expect(project.boards.map(b => b.product)).toEqual(["Knauf", "Moisture"]);
    expect(project.filler).toHaveLength(2);
    expect(project.adhesive).toHaveLength(1);
    expect(project.adhesive[0].bags).toBe(Math.ceil(project.adhesive[0].kg / 25 - 1e-6));
    // Only the Knauf board is priced, so the cost says it is partial.
    expect(project.cost.partial).toBe(true);
  });

  it("tapes only the rooms that have a joint filler, and none when no room does", () => {
    const filled = entry(1, "Kitchen"), bare = entry(2, "Hall", { compoundRate: "" });
    expect(bare.takeOff.tape.needed).toBe(false);
    const project = buildGypsumProjectTakeOff([filled, bare]);
    expect(project.tape).toEqual({ needed: true, total: filled.takeOff.tape.total });
    expect(buildGypsumProjectTakeOff([bare]).tape.needed).toBe(false);
    const none = [{ ...bare, id: 1 }, { ...entry(3, "Loft", { compoundRate: "" }) }];
    render(<GypsumProjectSheet project={buildGypsumProjectTakeOff(none)} entries={none} />);
    expect(document.body.textContent).not.toContain("Joint tape");
  });

  it("leaves an unfinished room out, and says which", () => {
    const project = buildGypsumProjectTakeOff([entry(1, "Kitchen"), entry(2, "Loft", { lenMm: "" })]);
    expect(project.readyCount).toBe(1);
    expect(project.rooms[1]).toMatchObject({ name: "Loft", ready: false, sheets: 0 });
    expect(project.area.net).toBe(buildGypsumTakeOff(fields()).area.net);
  });

  it("prints the order, then every finished room on its own page", () => {
    const entries = [entry(1, "Kitchen"), entry(2, "Hall", { lenMm: "3000" }), entry(3, "Loft", { lenMm: "" })];
    render(<GypsumProjectSheet project={buildGypsumProjectTakeOff(entries)} entries={entries} projectName="Flat 4" />);
    expect(document.querySelector(".doc-sheet-title").textContent).toBe("Gypsum take-off — Flat 4");
    expect(document.querySelectorAll(".gyp-print-room")).toHaveLength(2);
    expect(document.querySelector(".doc-sheet-warn").textContent).toContain("Loft");
    expect(document.querySelectorAll(".doc-sheet")).toHaveLength(1);
    // Boards named as the Board card's header names its preset.
    expect(document.querySelector(".doc-sheet-table--order tbody tr td").textContent).toBe("Board — Knauf · 1200 × 2600 mm");
  });
});

describe("rooms and walls", () => {
  it("names an unnamed entry by its kind and place", () => {
    const rooms = [newRoom(1), newRoom(2, "wall"), newRoom(3)];
    expect(rooms.map((r, i) => roomLabel(r, i, rooms))).toEqual(["Room 1", "Wall 1", "Room 2"]);
    expect(roomLabel({ ...rooms[0], name: " Kitchen " }, 0, rooms)).toBe("Kitchen");
  });

  it("starts an added room with the materials of the one it came from, not its size", () => {
    const source = { ...newRoom(1), fixing: "glue", activePreset: 1,
      job: { ...newRoom(1).job, lenMm: "4000", sheetW: "1200", screwRate: "18", openings: [{ id: 1, kind: "door" }] } };
    const added = roomFrom(source, 2, "wall");
    expect(added).toMatchObject({ id: 2, mode: "wall", fixing: "glue", activePreset: 1, name: "" });
    expect(added.job).toMatchObject({ lenMm: "", sheetW: "1200", screwRate: "18", openings: [] });
  });
});

const type = (id, value) => {
  const el = document.getElementById(id);
  fireEvent.change(el, { target: { value: String(value) } });
  fireEvent.blur(el);
};
const fillRoom = (len = 4000) => {
  type("input-gyp-lenMm", len);
  type("input-gyp-widMm", 3000);
  type("input-gyp-heightMm", 2600);
  type("input-gyp-sheetW", 1200);
  type("input-gyp-sheetL", 2600);
};
const withDrafts = (drafts, ui) => <SessionDraftContext.Provider value={drafts}>{ui}</SessionDraftContext.Provider>;

describe("the gypsum page's rooms", () => {
  it("collapses a control card, keeps it collapsed across rooms, and saves it with the project", () => {
    const drafts = new DraftStore();
    const { unmount } = render(withDrafts(drafts, <SheetGypsum />));
    const head = () => document.querySelector("#control-gyp-board .panel-head");
    expect(head().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(head());
    expect(head().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("input-gyp-sheetW")).toBeNull();
    fireEvent.click(screen.getByText("Room", { selector: "#control-gyp-rooms button" }));
    expect(head().getAttribute("aria-expanded")).toBe("false");
    expect(drafts.get("Gypsum.jsx:closed")).toEqual({ "control-gyp-board": true });
    unmount();
    render(withDrafts(drafts, <SheetGypsum />));
    expect(head().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(head());
    expect(document.getElementById("input-gyp-sheetW")).toBeTruthy();
  });

  it("keeps each room's values and switches between them", () => {
    render(<SheetGypsum />);
    fillRoom(4000);
    expect(screen.queryByRole("group", { name: "Rooms and walls" })).toBe(null);
    fireEvent.click(screen.getByText("Room", { selector: "#control-gyp-rooms button" }));
    // The new room keeps the sheet, not the size.
    expect(document.getElementById("input-gyp-lenMm").value).toBe("");
    expect(document.getElementById("input-gyp-sheetW").value).toBe("1200");
    fillRoom(5000);
    fireEvent.click(screen.getByRole("button", { name: /^Room 1/ }));
    expect(document.getElementById("input-gyp-lenMm").value).toBe("4000");
    fireEvent.click(screen.getByRole("button", { name: /^Room 2/ }));
    expect(document.getElementById("input-gyp-lenMm").value).toBe("5000");
  });

  it("shows the total across rooms once there are two", () => {
    render(<SheetGypsum />);
    fillRoom();
    expect(screen.queryByText("All Rooms")).toBe(null);
    fireEvent.click(screen.getByText("Duplicate"));
    expect(screen.getByText("All Rooms")).toBeTruthy();
    const list = screen.getByRole("group", { name: "Rooms and walls" });
    expect(list.querySelectorAll("button")).toHaveLength(2);
    // The room's result card again, for both rooms: the sheets and the take-off.
    expect(document.querySelectorAll(".gyp-result")).toHaveLength(2);
    const room = document.querySelector(".gyp-result-wrap .gyp-result");
    const all = screen.getByText("All Rooms").closest(".section").querySelector(".gyp-result");
    const figure = card => Number(card.querySelector(".result-card-value").firstChild.textContent);
    expect(figure(all)).toBeGreaterThan(figure(room));
    expect(all.querySelector(".result-card-note").textContent).toBe("2 rooms");
    expect(all.querySelector(".result-card-print").disabled).toBe(false);
  });

  it("renames a room, and deletes one in two clicks", () => {
    render(<SheetGypsum />);
    fireEvent.change(document.getElementById("input-gyp-room-name"), { target: { value: "Kitchen" } });
    fireEvent.click(screen.getByText("Wall", { selector: "#control-gyp-rooms button" }));
    expect(screen.getByRole("button", { name: /^Kitchen/ })).toBeTruthy();
    expect(document.getElementById("input-gyp-wallW")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Wall 1" }));
    expect(screen.getByRole("group", { name: "Rooms and walls" }).querySelectorAll("button")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete Wall 1" }));
    expect(screen.queryByRole("group", { name: "Rooms and walls" })).toBe(null);
    expect(document.getElementById("input-gyp-room-name").value).toBe("Kitchen");
  });

  it("moves the room on screen up and down the list, and keeps it on screen", () => {
    render(<SheetGypsum />);
    fireEvent.change(document.getElementById("input-gyp-room-name"), { target: { value: "Kitchen" } });
    expect(screen.queryByRole("button", { name: "Move Kitchen up" })).toBe(null);
    fireEvent.click(screen.getByText("Room", { selector: "#control-gyp-rooms button" }));
    fireEvent.click(screen.getByText("Wall", { selector: "#control-gyp-rooms button" }));
    const order = () => [...screen.getByRole("group", { name: "Rooms and walls" }).querySelectorAll(".gyp-room-name")]
      .map(el => el.textContent);
    expect(order()).toEqual(["Kitchen", "Room 2", "Wall 1"]);
    // The last entry cannot go further down.
    expect(screen.getByRole("button", { name: "Move Wall 1 down" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move Wall 1 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Wall 1 up" }));
    expect(order()).toEqual(["Wall 1", "Kitchen", "Room 2"]);
    expect(screen.getByRole("button", { name: "Move Wall 1 up" }).disabled).toBe(true);
    expect(document.getElementById("input-gyp-wallW")).toBeTruthy();
    // An unnamed room's number is its place among rooms, so it follows the move.
    fireEvent.click(screen.getByRole("button", { name: /^Room 2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move Room 2 up" }));
    expect(order()).toEqual(["Wall 1", "Room 1", "Kitchen"]);
    expect(screen.getByText("All Rooms").closest(".section").textContent.indexOf("Room 1"))
      .toBeLessThan(screen.getByText("All Rooms").closest(".section").textContent.indexOf("Kitchen"));
  });

  it("adds one waste figure to every room, starting at none", () => {
    render(<SheetGypsum />);
    fillRoom(4000);
    const waste = () => document.getElementById("input-gyp-waste");
    expect(waste().value).toBe("0");
    expect(document.querySelector(".gyp-result-wrap .result-card-note").textContent).toContain("+0% waste");
    fireEvent.click(screen.getByText("Duplicate"));
    expect(screen.getByText("Waste, all rooms (%)")).toBeTruthy();
    type("input-gyp-waste", 10);
    expect(document.querySelector(".gyp-result-wrap .result-card-note").textContent).toContain("+10% waste");
    fireEvent.click(screen.getByRole("button", { name: /^Room 1/ }));
    expect(waste().value).toBe("10");
    expect(document.querySelector(".gyp-result-wrap .result-card-note").textContent).toContain("+10% waste");
    // Resetting one room of several leaves the job's waste alone.
    fireEvent.click(screen.getByText("Reset Room"));
    fireEvent.click(screen.getByText("Confirm reset?"));
    expect(waste().value).toBe("10");
  });

  it("opens a project saved with waste per room at its first room's figure", () => {
    const drafts = new DraftStore();
    drafts.set("Gypsum.jsx:rooms", [
      { ...newRoom(1), job: { ...newRoom(1).job, waste: "" } },
      { ...newRoom(2), job: { ...newRoom(2).job, waste: "7" } }
    ]);
    render(withDrafts(drafts, <SheetGypsum />));
    expect(document.getElementById("input-gyp-waste").value).toBe("7");
  });

  it("keeps the applied preset per room", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getAllByTitle("Presets")[0]);
    fireEvent.pointerDown(screen.getByText("Gyproc GN 13"));
    fireEvent.click(screen.getByText("Room", { selector: "#control-gyp-rooms button" }));
    // Carried over to the added room, then changed there only.
    expect(document.querySelector("#control-gyp-board .panel-preset-meta").textContent).toContain("Gyproc GN 13");
    fireEvent.click(screen.getAllByTitle("Presets")[0]);
    fireEvent.pointerDown(screen.getByText("Knauf GKB 12.5"));
    fireEvent.click(screen.getByRole("button", { name: /^Room 1/ }));
    expect(document.querySelector("#control-gyp-board .panel-preset-meta").textContent).toContain("Gyproc GN 13");
  });

  /* Take-offs are cached per room; a preset list edit must still reach the
     rooms not on screen, since their product names come from it. */
  it("renames a product in every room when its preset is renamed", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getAllByTitle("Presets")[0]);
    fireEvent.pointerDown(screen.getByText("Gyproc GN 13"));
    fireEvent.click(screen.getByText("Duplicate"));
    expect(screen.getAllByText("Board — Gyproc GN 13 · 1200 × 2600 mm")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Manage board presets"));
    fireEvent.change(document.getElementById("gyp-board-preset-name-1"), { target: { value: "Gyproc GN 13 Pro" } });
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.getByText("Board — Gyproc GN 13 Pro · 1200 × 2600 mm")).toBeTruthy();
    expect(screen.queryByText("Board — Gyproc GN 13 · 1200 × 2600 mm")).toBe(null);
  });

  it("resets the room on screen and leaves the others", () => {
    render(<SheetGypsum />);
    fillRoom(4000);
    fireEvent.click(screen.getByText("Duplicate"));
    fireEvent.click(screen.getByText("Reset Room"));
    fireEvent.click(screen.getByText("Confirm reset?"));
    expect(document.getElementById("input-gyp-lenMm").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /^Room 1/ }));
    expect(document.getElementById("input-gyp-lenMm").value).toBe("4000");
  });

  it("opens a project saved before the list as a list of one", () => {
    const drafts = new DraftStore([
      ["Gypsum.jsx:mode", "wall"],
      ["Gypsum.jsx:fixing", "glue"],
      ["Gypsum.jsx:job", { wallW: "3000", wallH: "2500", openings: [] }]
    ]);
    render(withDrafts(drafts, <SheetGypsum />));
    expect(document.getElementById("input-gyp-wallW").value).toBe("3000");
    expect(drafts.has("Gypsum.jsx:job")).toBe(false);
    expect(drafts.get("Gypsum.jsx:rooms")).toHaveLength(1);
    expect(drafts.get("Gypsum.jsx:rooms")[0]).toMatchObject({ mode: "wall", fixing: "glue" });
  });
});

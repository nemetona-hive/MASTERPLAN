// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { GypsumTakeOffSheet } from "../src/components/GypsumTakeOffSheet.jsx";
import { buildGypsumTakeOff } from "../src/utils/gypsum-take-off.js";

const FIELDS = {
  mode: "room", lenMm: "4200", widMm: "3100", heightMm: "2700", ceiling: true,
  openings: [{ kind: "door", wall: "B", x: "1000", w: "900", h: "2100" }],
  sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "5",
  screwRate: "13", compoundRate: "0.34", bagKg: "25", sheetPrice: "7.90", product: ""
};
const takeOff = buildGypsumTakeOff(FIELDS);

/* What @media print shows is `npm run layout`'s to check; this checks the
   sheet draws what the model says, and only that. */
describe("the printed gypsum take-off", () => {
  it("orders adhesive for glued walls and screws only for the ceiling", () => {
    const glued = buildGypsumTakeOff({ mode: "room", lenMm: "4200", widMm: "3100", heightMm: "2700",
      ceiling: true, openings: [], sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "5",
      screwRate: "13", compoundRate: "0.34", bagKg: "25", sheetPrice: "", product: "",
      fixing: "glue", adhesiveRate: "4.3", adhesiveBagKg: "25" });
    render(<GypsumTakeOffSheet takeOff={glued} />);
    const order = document.querySelector(".doc-sheet-table--order").textContent;
    expect(order).toContain("Adhesive");
    expect(order).toContain(`${glued.adhesive.bags} × 25 kg`);
    expect(order).toContain("Ceiling screws");
    expect(document.querySelector(".doc-sheet-facts").textContent).toContain("Glued walls");
  });

  it("leaves joint tape off the order when no joint filler is given", () => {
    const bare = buildGypsumTakeOff({ mode: "room", lenMm: "4200", widMm: "3100", heightMm: "2700",
      ceiling: false, openings: [], sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "5",
      screwRate: "13", compoundRate: "", bagKg: "", sheetPrice: "", product: "" });
    render(<GypsumTakeOffSheet takeOff={bare} />);
    expect(document.querySelector(".doc-sheet-table--order").textContent).not.toContain("Joint tape");
    expect(document.querySelector(".doc-sheet").textContent).not.toContain("Joint filler");
  });

  it("lists each surface's own boards, for all of its walls", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    const rows = [...document.querySelectorAll(".doc-sheet-table")[0].querySelectorAll("tbody tr")];
    const boards = rows.map(r => Number(r.lastElementChild.textContent));
    expect(boards).toEqual(takeOff.surfaces.map(s => s.layout.boards * s.count));
  });

  it("names the board as the Board card's preset header does", () => {
    const named = buildGypsumTakeOff({ ...FIELDS, product: "OSB 12mm 1200 × 2600" });
    render(<GypsumTakeOffSheet takeOff={named} />);
    const row = document.querySelector(".doc-sheet-table--order tbody tr td").textContent;
    // The size the name ends in is said once.
    expect(row).toBe("Board — OSB 12mm · 1200 × 2600 mm");
    expect(document.querySelector(".doc-sheet-sub").textContent).toContain("OSB 12mm · 1200 × 2600 mm");
  });

  it("names the board by its size alone with no preset", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    expect(document.querySelector(".doc-sheet-table--order tbody tr td").textContent).toBe("Board — 1200 × 2600 mm");
  });

  it("orders joint tape with a joint filler", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    expect(document.querySelector(".doc-sheet-table--order").textContent).toContain("Joint tape");
  });

    it("draws one diagram per laid-out surface", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    // Walls A+C together, B (it has the door) apart from D, and the ceiling.
    expect(document.querySelectorAll(".doc-sheet .gyp-print-svg")).toHaveLength(4);
  });

  it("draws every piece the model placed, typed full or cut", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    const pieces = takeOff.surfaces.reduce((n, s) => n + s.layout.pieces.length, 0);
    expect(document.querySelectorAll(".doc-sheet .gyp-print-piece")).toHaveLength(pieces);
    const full = takeOff.surfaces.reduce((n, s) => n + s.layout.full, 0);
    expect(document.querySelectorAll(".gyp-print-piece--full")).toHaveLength(full);
  });

  it("draws every surface on one scale", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    const widths = [...document.querySelectorAll(".gyp-print-svg")].map(svg => svg.style.width);
    // 4200 is widest; the 3100 walls are drawn at 3100/4200 of it.
    expect(widths[0]).toBe("100%");
    expect(parseFloat(widths[1])).toBeCloseTo(3100 / 4200 * 100, 3);
  });

  it("outlines each placed opening with its label", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    expect(document.querySelectorAll(".gyp-print-opening")).toHaveLength(1);
    expect(document.querySelector(".gyp-print-label--opening").textContent).toBe("D1");
  });
});

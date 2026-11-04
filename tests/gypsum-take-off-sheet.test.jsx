// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { GypsumTakeOffSheet } from "../src/components/GypsumTakeOffSheet.jsx";
import { buildGypsumTakeOff } from "../src/utils/gypsum-take-off.js";

const takeOff = buildGypsumTakeOff({
  mode: "room", lenMm: "4200", widMm: "3100", heightMm: "2700", ceiling: true,
  doors: "1", doorW: "900", doorH: "2100", windows: "", winW: "1200", winH: "1200",
  sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "5",
  screwRate: "13", compoundRate: "0.34", bagKg: "25", sheetPrice: "7.90", product: ""
});

/* What @media print shows is `npm run layout`'s to check; this checks the
   sheet draws what the model says, and only that. */
describe("the printed gypsum take-off", () => {
  it("draws one diagram per laid-out surface", () => {
    render(<GypsumTakeOffSheet takeOff={takeOff} />);
    expect(document.querySelectorAll(".doc-sheet .gyp-print-svg")).toHaveLength(3);
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
});

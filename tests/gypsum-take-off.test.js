import { describe, expect, it } from "vitest";
import { buildGypsumTakeOff, lanePieces, layoutSurface, packSheets, MIN_END_PIECE } from "../src/utils/gypsum-take-off.js";

/* A 4 × 3 m room, 2.6 m high, boarded vertically with 1200 × 2600 sheets —
   one sheet spans the height, so every lane is one piece. */
const fields = (over = {}) => ({
  mode: "room", lenMm: "4000", widMm: "3000", heightMm: "2600",
  wallW: "", wallH: "", ceiling: false,
  doors: "", doorW: "900", doorH: "2100", windows: "", winW: "1200", winH: "1200",
  sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "0",
  screwRate: "20", compoundRate: "0.25", bagKg: "25", sheetPrice: "8.50", product: "Knauf", ...over
});

describe("lane pieces", () => {
  it("is one piece when a sheet spans the lane", () => {
    expect(lanePieces(2500, 2600, 0)).toEqual([2500]);
    expect(lanePieces(2500, 2600, 1)).toEqual([2500]);
  });

  it("staggers end joints by half a sheet on alternate lanes", () => {
    expect(lanePieces(5000, 2500, 0)).toEqual([2500, 2500]);
    expect(lanePieces(5000, 2500, 1)).toEqual([1250, 2500, 1250]);
  });

  it("never leaves an end piece shorter than the minimum", () => {
    // 2600 + 100 would leave a 100mm sliver; the joint moves instead.
    const pieces = lanePieces(2700, 2600, 0);
    expect(pieces).toEqual([2700 - MIN_END_PIECE, MIN_END_PIECE]);
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(2700);
  });
});

describe("one surface", () => {
  it("rips the last lane to the remaining width", () => {
    const l = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V" });
    expect(l.rows.map(r => r.h)).toEqual([1200, 1200, 600]);
    expect(l.full).toBe(2);
    expect(l.cut).toBe(1);
    // Two long-edge joints the full height, no end joints.
    expect(l.joints).toBe(2 * 2600);
  });

  it("places every piece on the surface for the printed drawing", () => {
    const v = layoutSurface({ w: 3000, h: 2700, sheetW: 1200, sheetL: 2600, orientation: "V" });
    // Columns from the left, first piece at the top; the 600 rip is last.
    expect(v.pieces[0]).toMatchObject({ x: 0, y: 0, w: 1200, h: 2400 });
    expect(v.pieces.at(-1)).toMatchObject({ x: 2400, w: 600 });
    const h = layoutSurface({ w: 3000, h: 2700, sheetW: 1200, sheetL: 2600, orientation: "H" });
    expect(h.pieces[0]).toMatchObject({ x: 0, y: 0, h: 1200 });
    // The pieces tile the surface exactly.
    for (const l of [v, h]) {
      expect(l.pieces.reduce((a, p) => a + p.w * p.h, 0)).toBeCloseTo(3000 * 2700, 3);
    }
  });

  it("swaps axes for horizontal fixing", () => {
    const l = layoutSurface({ w: 4000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "H" });
    expect(l.lanes).toBe(3);
    expect(l.laneLength).toBe(4000);
    expect(l.meta.direction).toBe("H");
  });
});

describe("packing", () => {
  it("cuts two half-width strips from one sheet", () => {
    const strip = { type: "cut", w: 2600, laneW: 600 };
    expect(packSheets([strip, strip], 1200, 2600).total).toBe(1);
  });

  it("reuses an offcut along the length", () => {
    const piece = { type: "cut", w: 1250, laneW: 1200 };
    expect(packSheets([piece, piece], 1200, 2500).total).toBe(1);
  });

  it("does not put a full-width piece in a ripped sheet", () => {
    expect(packSheets([{ type: "cut", w: 1000, laneW: 600 }, { type: "cut", w: 1000, laneW: 1200 }], 1200, 2600).total).toBe(2);
  });
});

describe("the gypsum take-off", () => {
  it("counts sheets from the layout", () => {
    const t = buildGypsumTakeOff(fields());
    // 4000 wall: 1200, 1200, 1200, 400 → 3 whole + one 400 strip (×2 walls).
    // 3000 wall: 1200, 1200, 600 → 2 whole + 1 ripped (×2; two 600s per sheet).
    // Whole: 3·2 + 2·2 = 10. Strips: 400 ×2 → 1 sheet, 600 ×2 → 1 sheet.
    expect(t.sheets.layout).toBe(12);
    expect(t.ready).toBe(true);
  });

  it("adds waste on top and rounds up", () => {
    const t = buildGypsumTakeOff(fields({ waste: "10" }));
    expect(t.sheets.exact).toBe(13.2);
    expect(t.sheets.toBuy).toBe(14);
  });

  it("deducts openings from area but not from sheets", () => {
    const plain = buildGypsumTakeOff(fields());
    const t = buildGypsumTakeOff(fields({ doors: "1", windows: "2" }));
    expect(t.area.gross).toBe(36.4);
    expect(t.area.openings).toBeCloseTo(0.9 * 2.1 + 2 * 1.44, 2);
    expect(t.area.net).toBeCloseTo(36.4 - 4.77, 2);
    expect(t.sheets.layout).toBe(plain.sheets.layout);
  });

  it("adds the ceiling as a surface and its angle to the tape", () => {
    const t = buildGypsumTakeOff(fields({ ceiling: true }));
    expect(t.surfaces.map(s => s.id)).toEqual(["walls-l", "walls-w", "ceiling"]);
    expect(t.area.gross).toBe(48.4);
    expect(t.tape.corners).toBeCloseTo((4 * 2600 + 2 * 7000) / 1000, 3);
  });

  it("groups four equal walls into one drawing", () => {
    const t = buildGypsumTakeOff(fields({ widMm: "4000" }));
    expect(t.surfaces).toHaveLength(1);
    expect(t.surfaces[0].count).toBe(4);
  });

  it("doubles sheets, screws and compound for two layers, not tape", () => {
    const one = buildGypsumTakeOff(fields());
    const two = buildGypsumTakeOff(fields({ layers: "2" }));
    expect(two.sheets.layout).toBe(one.sheets.layout * 2);
    expect(two.screws.count).toBe(one.screws.count * 2);
    expect(two.compound.kg).toBeCloseTo(one.compound.kg * 2, 1);
    expect(two.tape.total).toBe(one.tape.total);
  });

  it("works out consumables from the boarded area", () => {
    const t = buildGypsumTakeOff(fields());
    expect(t.screws.count).toBe(Math.ceil(36.4 * 20));
    expect(t.compound.kg).toBeCloseTo(9.1, 1);
    expect(t.compound.bags).toBe(1);
  });

  it("prices the sheets bought", () => {
    const t = buildGypsumTakeOff(fields({ waste: "10" }));
    expect(t.sheets.total).toBe(14 * 8.5);
  });

  it("lays out a single wall", () => {
    const t = buildGypsumTakeOff(fields({ mode: "wall", wallW: "2400", wallH: "2600" }));
    expect(t.surfaces).toHaveLength(1);
    expect(t.sheets.layout).toBe(2);
    expect(t.tape.corners).toBe(0);
  });

  it("is not ready without dimensions, and says which", () => {
    const t = buildGypsumTakeOff(fields({ heightMm: "" }));
    expect(t.ready).toBe(false);
    expect(t.issue).toMatch(/height/);
  });

  it("refuses a surface too large to draw", () => {
    const t = buildGypsumTakeOff(fields({ lenMm: "99999999" }));
    expect(t.ready).toBe(false);
    expect(t.issue).toMatch(/too large/);
  });
});

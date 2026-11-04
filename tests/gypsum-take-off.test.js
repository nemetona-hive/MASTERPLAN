import { describe, expect, it } from "vitest";
import { buildGypsumTakeOff, jointFillerRate, JOINT_FILL_MM_M, lanePieces, layoutSurface, packSheets, readOpenings, MIN_END_PIECE } from "../src/utils/gypsum-take-off.js";

/* A 4 × 3 m room, 2.6 m high, boarded vertically with 1200 × 2600 sheets —
   one sheet spans the height, so every lane is one piece. */
const fields = (over = {}) => ({
  mode: "room", lenMm: "4000", widMm: "3000", heightMm: "2600",
  wallW: "", wallH: "", ceiling: false,
  openings: [],
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

  it("deducts unplaced openings from area but not from sheets", () => {
    const plain = buildGypsumTakeOff(fields());
    const t = buildGypsumTakeOff(fields({ openings: [
      { kind: "door", wall: "A", x: "", w: "900", h: "2100" },
      { kind: "window", wall: "B", x: "", w: "1200", h: "1200", sill: "900" },
      { kind: "window", wall: "C", x: "", w: "1200", h: "1200", sill: "900" }
    ] }));
    expect(t.area.gross).toBe(36.4);
    expect(t.area.openings).toBeCloseTo(0.9 * 2.1 + 2 * 1.44, 2);
    expect(t.area.net).toBeCloseTo(36.4 - 4.77, 2);
    expect(t.sheets.layout).toBe(plain.sheets.layout);
  });

  it("adds the ceiling as a surface and its angle to the tape", () => {
    const t = buildGypsumTakeOff(fields({ ceiling: true }));
    expect(t.surfaces.map(s => s.id)).toEqual(["wall-ac", "wall-bd", "ceiling"]);
    expect(t.area.gross).toBe(48.4);
    expect(t.tape.corners).toBeCloseTo((4 * 2600 + 2 * 7000) / 1000, 3);
  });

  it("groups four equal walls into one drawing", () => {
    const t = buildGypsumTakeOff(fields({ widMm: "4000" }));
    expect(t.surfaces).toHaveLength(1);
    expect(t.surfaces[0].count).toBe(4);
  });

  it("doubles sheets, screws and the board joints filled for two layers, not tape or corners", () => {
    const one = buildGypsumTakeOff(fields());
    const two = buildGypsumTakeOff(fields({ layers: "2" }));
    expect(two.sheets.layout).toBe(one.sheets.layout * 2);
    expect(two.screws.count).toBe(one.screws.count * 2);
    expect(two.compound.length).toBeCloseTo(one.tape.joints * 2 + one.tape.corners, 1);
    expect(two.tape.total).toBe(one.tape.total);
  });

  it("works out consumables from the boarded area", () => {
    const t = buildGypsumTakeOff(fields());
    expect(t.screws.count).toBe(Math.ceil(36.4 * 20));
    /* Joint filler per metre of joint (Uniflott 0.25 kg/m): 4000 walls have
       3 edge joints, 3000 walls 2, all 2.6 m — 26 m — plus 4 corners of
       2.6 m: 36.4 m × 0.25 = 9.1 kg. */
    expect(t.tape.joints).toBeCloseTo(26, 1);
    expect(t.compound.length).toBeCloseTo(36.4, 1);
    expect(t.compound.kg).toBeCloseTo(9.1, 1);
    expect(t.compound.bags).toBe(1);
  });

  describe("glued walls", () => {
    const glued = over => buildGypsumTakeOff(fields({ fixing: "glue", adhesiveRate: "5", adhesiveBagKg: "25", ...over }));

    it("take adhesive on the walls' net area instead of screws", () => {
      const t = glued({ openings: [{ id: 1, kind: "door", wall: "A", x: "", w: "900", h: "2100" }] });
      const net = 36.4 - 0.9 * 2.1;
      expect(t.fixing).toBe("glue");
      expect(t.screws.count).toBe(0);
      expect(t.adhesive.area).toBeCloseTo(net, 2);
      expect(t.adhesive.kg).toBeCloseTo(net * 5, 1);
      expect(t.adhesive.bags).toBe(Math.ceil(net * 5 / 25));
      // Joint filler and tape do not depend on how the board is held.
      expect(t.compound.length).toBeCloseTo(t.tape.total, 1);
      expect(t.compound.kg).toBeCloseTo(t.compound.length * 0.25, 1);
    });

    it("still screw a boarded ceiling", () => {
      const t = glued({ ceiling: true });
      expect(t.screws.area).toBeCloseTo(12, 2);
      expect(t.screws.count).toBe(12 * 20);
      expect(t.adhesive.area).toBeCloseTo(36.4, 2);
    });

    it("are one layer, whatever the layer choice says", () => {
      const one = glued();
      const asked = glued({ layers: "2" });
      expect(asked.layers).toBe(1);
      expect(asked.sheets.layout).toBe(one.sheets.layout);
    });

    it("carry no adhesive when screwed", () => {
      expect(buildGypsumTakeOff(fields({ adhesiveRate: "5" })).adhesive).toBe(null);
    });
  });

  it("fills more joint, not more area, when sheets are smaller", () => {
    const big = buildGypsumTakeOff(fields());
    const small = buildGypsumTakeOff(fields({ sheetW: "600" }));
    expect(small.area.net).toBe(big.area.net);
    expect(small.compound.kg).toBeGreaterThan(big.compound.kg);
  });

  describe("a filler given per 1 mm", () => {
    /* Knauf Fill & Finish Light: 0.2 + 0.1 kg/m² on the joints of 1250 mm
       boards (about 0.8 m of joint per m²) is 0.375 kg per m of joint, and
       its skim rate is 1.1 kg/m² per mm. */
    it("works its rate per metre of joint out from the per-mm rate", () => {
      expect(JOINT_FILL_MM_M).toBeCloseTo(0.3 / 0.8 / 1.1, 2);
      expect(jointFillerRate("", "1.1")).toEqual({ rate: 0.374, derived: true });
    });

    it("uses the stated per-metre rate when there is one", () => {
      expect(jointFillerRate("0.25", "1.1")).toEqual({ rate: 0.25, derived: false });
      expect(jointFillerRate("", "")).toEqual({ rate: null, derived: false });
    });

    it("counts the joints at the worked-out rate", () => {
      const t = buildGypsumTakeOff(fields({ compoundRate: "", skimRate: "1.1" }));
      expect(t.compound.rateDerived).toBe(true);
      expect(t.compound.kg).toBeCloseTo(36.4 * 0.374, 1);
    });

    it("adds a full-surface skim over the net area", () => {
      const t = buildGypsumTakeOff(fields({ compoundRate: "", skimRate: "1.1", skimMm: "1" }));
      expect(t.compound.skim).toEqual({ mm: 1, area: 36.4, kg: 40 });
      expect(t.compound.kg).toBeCloseTo(36.4 * 0.374 + 36.4 * 1.1, 1);
      expect(t.compound.bags).toBe(Math.ceil(t.compound.kg / 25));
    });

    it("asks for the per-mm rate before it can count a skim", () => {
      const t = buildGypsumTakeOff(fields({ skimMm: "1" }));
      expect(t.compound.skim.kg).toBe(0);
      expect(t.warning).toMatch(/kg\/m² per 1 mm/);
    });
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

describe("openings", () => {
  const door = (over = {}) => ({ kind: "door", wall: "A", x: "1000", w: "900", h: "2100", ...over });
  const win = (over = {}) => ({ kind: "window", wall: "A", x: "2400", w: "1200", h: "1200", sill: "900", ...over });

  it("numbers doors and windows separately", () => {
    const read = readOpenings([door(), win(), door()], { room: true, wallSize: () => ({ w: 4000, h: 2600 }) });
    expect(read.map(o => o.label)).toEqual(["D1", "W1", "D2"]);
  });

  it("splits a wall with an opening from its twin", () => {
    const t = buildGypsumTakeOff(fields({ openings: [door()] }));
    // In wall order: A first, then B with its twin D, then C on its own.
    expect(t.surfaces.map(s => s.id)).toEqual(["wall-a", "wall-bd", "wall-c"]);
    expect(t.surfaces[0].label).toBe("Wall A");
    expect(t.surfaces[1].label).toBe("Walls B, D");
  });

  it("places an opening in the wall's frame, y down from the top", () => {
    const t = buildGypsumTakeOff(fields({ openings: [win()] }));
    // 2600 wall, 900 sill, 1200 high: top of the window is 500 below the top.
    expect(t.surfaces[0].openings[0]).toMatchObject({ x: 2400, y: 500, w: 1200, h: 1200, label: "W1" });
  });

  it("drops a piece that lies wholly inside an opening, and counts one sheet fewer", () => {
    // Vertical 1200 lanes on a 2600 wall with 2600 sheets: lane 2 is x 1200–2400.
    // A 1200 × 2600 "opening" over exactly that lane removes a whole sheet.
    const big = { kind: "door", wall: "A", x: "1200", w: "1200", h: "2600" };
    const plain = buildGypsumTakeOff(fields());
    const t = buildGypsumTakeOff(fields({ openings: [big] }));
    expect(t.sheets.layout).toBe(plain.sheets.layout - 1);
    expect(t.surfaces[0].layout.pieces.some(p => p.x === 1200)).toBe(false);
  });

  it("keeps a piece the opening only overlaps — it is cut around", () => {
    const plain = buildGypsumTakeOff(fields());
    const t = buildGypsumTakeOff(fields({ openings: [door()] }));
    expect(t.sheets.layout).toBe(plain.sheets.layout);
    expect(t.area.openings).toBeCloseTo(1.89, 2);
  });

  it("leaves out an opening that runs off its wall, and says so", () => {
    const t = buildGypsumTakeOff(fields({ openings: [door({ x: "3500" })] }));
    expect(t.area.openings).toBe(0);
    expect(t.warning).toMatch(/D1 \(wall A\) does not fit/);
  });

  it("checks a window's sill and height against the wall", () => {
    const t = buildGypsumTakeOff(fields({ openings: [win({ sill: "2000" })] }));
    expect(t.warning).toMatch(/W1/);
  });

  it("puts every opening on the one wall in single-wall mode", () => {
    const t = buildGypsumTakeOff(fields({ mode: "wall", wallW: "3000", wallH: "2600", openings: [door({ wall: "C" })] }));
    expect(t.surfaces[0].openings).toHaveLength(1);
  });

  it("ignores a row with nothing typed", () => {
    const t = buildGypsumTakeOff(fields({ openings: [{ kind: "door", wall: "A", x: "", w: "", h: "" }] }));
    expect(t.warning).toBe(null);
    expect(t.openings.doors).toBe(0);
  });
});

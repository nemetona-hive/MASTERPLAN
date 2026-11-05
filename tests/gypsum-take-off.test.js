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

  it("never trims a short offset piece below the minimum, or below nothing", () => {
    // Offset 100 on a 2700 row in 2500s: the 100 end is made up from the
    // whole board, not from the 100 piece (which went to −100).
    const pieces = lanePieces(2700, 2500, 0, 100);
    expect(pieces).toEqual([100, 2300, 300]);
    expect(Math.min(...pieces)).toBeGreaterThan(0);
  });

  it("does not start a staggered row on a sliver when the offset wraps past a board", () => {
    // 1300 + 1250 in 2500s wrapped to 50; the joint moves out to the minimum.
    const pieces = lanePieces(5800, 2500, 1, 1300);
    expect(pieces[0]).toBe(MIN_END_PIECE);
    expect(pieces.reduce((a, b) => a + b, 0)).toBe(5800);
    expect(Math.min(...pieces)).toBeGreaterThanOrEqual(MIN_END_PIECE);
  });

  it("keeps a full panel at the start when asked, trimming the last whole board", () => {
    // The 5130 wall in 2500 boards: a 130 end would be a sliver.
    expect(lanePieces(5130, 2500, 0)).toEqual([2330, 2500, 300]);
    expect(lanePieces(5130, 2500, 0, 0, true)).toEqual([2500, 2330, 300]);
    // A staggered lane still starts half a board in.
    expect(lanePieces(5130, 2500, 1, 0, true)).toEqual([1250, 2500, 1380]);
    // No whole board after the first to trim: the first one gives way.
    expect(lanePieces(2700, 2600, 0, 0, true)).toEqual([2700 - MIN_END_PIECE, MIN_END_PIECE]);
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

  it("starts R1 from the far side when asked, ripped lane on the near side", () => {
    // 3000 wide, 1200 sheets fixed vertically: 1200, 1200, 600.
    const left = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V" });
    const right = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V", rowStart: "bottom" });
    expect(left.pieces.map(p => [p.lane, p.x, p.w])).toEqual([[0, 0, 1200], [1, 1200, 1200], [2, 2400, 600]]);
    expect(right.pieces.map(p => [p.lane, p.x, p.w])).toEqual([[0, 1800, 1200], [1, 600, 1200], [2, 0, 600]]);
    expect(right.meta.rowStart).toBe("bottom");
    // Horizontal: R1 at the bottom of a 2600 wall, the 200 rip at the top.
    const bottom = layoutSurface({ w: 2000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "H", rowStart: "bottom" });
    expect(bottom.pieces.map(p => [p.lane, p.y, p.h])).toEqual([[0, 1400, 1200], [1, 200, 1200], [2, 0, 200]]);
  });

  it("drops whichever piece the opening covers once R1 has moved", () => {
    // A 1200-wide opening over the right-hand 1200 of a 3000 wall, full height.
    const opening = { x: 1800, y: 0, w: 1200, h: 2600 };
    const right = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V", openings: [opening], rowStart: "bottom" });
    expect(right.pieces.map(p => p.lane)).toEqual([1, 2]);
    const left = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V", openings: [opening] });
    // R1 left: the opening covers the 600 rip (2400–3000) instead.
    expect(left.pieces.map(p => p.lane)).toEqual([0, 1]);
  });

  it("rips R1 to the first row height fixed horizontally, the rest full boards", () => {
    // 2600 high in 1250s with a 600 first row: 600, 1250, 750.
    const lay = layoutSurface({ w: 4000, h: 2600, sheetW: 1250, sheetL: 2500, orientation: "H", firstRow: 600 });
    expect(lay.rows.map(r => r.h)).toEqual([600, 1250, 750]);
    // R1 at the bottom: the 600 row sits on the floor.
    const bottom = layoutSurface({ w: 4000, h: 2600, sheetW: 1250, sheetL: 2500, orientation: "H", firstRow: 600, rowStart: "bottom" });
    expect(bottom.pieces.filter(p => p.lane === 0).every(p => p.y === 2000 && p.h === 600)).toBe(true);
    // Fixed vertically it does nothing; the strip there is the offset.
    expect(layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V", firstRow: 600 }).rows.map(r => r.h)).toEqual([1200, 1200, 600]);
  });

  it("takes the first row height for walls only, and warns when it is a whole board", () => {
    const t = buildGypsumTakeOff(fields({ orientation: "H", sheetW: "1250", sheetL: "2500", ceiling: true, firstRow: "600" }));
    expect(t.firstRow).toBe(600);
    expect(t.surfaces[0].layout.rows[0].h).toBe(600);
    expect(t.surfaces.find(s => s.id === "ceiling").layout.rows[0].h).toBe(1250);
    const big = buildGypsumTakeOff(fields({ orientation: "H", sheetW: "1250", sheetL: "2500", firstRow: "1250" }));
    expect(big.firstRow).toBe(null);
    expect(big.warning).toMatch(/First row height/);
    // Fixed vertically it is not asked, so it is not warned about.
    expect(buildGypsumTakeOff(fields({ firstRow: "5000" })).warning).toBe(null);
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

  it("rips strips of different widths from one board when they fit side by side", () => {
    expect(packSheets([{ type: "cut", w: 2600, laneW: 400 }, { type: "cut", w: 2600, laneW: 800 }], 1200, 2600).total).toBe(1);
    expect(packSheets([{ type: "cut", w: 2600, laneW: 300 }, { type: "cut", w: 2600, laneW: 900 }], 1200, 2600).total).toBe(1);
    // 700 + 600 is wider than the board.
    expect(packSheets([{ type: "cut", w: 2600, laneW: 700 }, { type: "cut", w: 2600, laneW: 600 }], 1200, 2600).total).toBe(2);
  });

  it("rips a narrow piece from what a wider one left", () => {
    // 1000 cut across a 1200 × 2600 leaves 1200 × 1600: the 600 comes from it.
    expect(packSheets([{ type: "cut", w: 1000, laneW: 600 }, { type: "cut", w: 1000, laneW: 1200 }], 1200, 2600).total).toBe(1);
    expect(packSheets([{ type: "cut", w: 1300, laneW: 1200 }, { type: "cut", w: 1300, laneW: 600 }], 1200, 2600).total).toBe(1);
    // Too much for one board either way: 1300 × 1200 + 1400 × 600.
    expect(packSheets([{ type: "cut", w: 1300, laneW: 1200 }, { type: "cut", w: 1400, laneW: 600 }], 1200, 2600).total).toBe(2);
  });

  it("never counts fewer boards than the pieces' area takes", () => {
    // Pseudo-random piece sets: a pack that cheats would come in under area.
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const widths = [1200, 1200, 600, 400, 800, 300, 900];
    for (let run = 0; run < 200; run++) {
      const pieces = Array.from({ length: 1 + Math.floor(rand() * 14) }, () =>
        ({ type: "cut", laneW: widths[Math.floor(rand() * widths.length)], w: 300 + Math.round(rand() * 2300) }));
      const area = pieces.reduce((t, p) => t + p.laneW * p.w, 0);
      const { total } = packSheets(pieces, 1200, 2600);
      expect(total).toBeGreaterThanOrEqual(Math.ceil(area / (1200 * 2600) - 1e-9));
    }
  });

  it("buys a whole board for every piece when asked, cut ones too", () => {
    const strip = { type: "cut", w: 2600, laneW: 600 };
    const packed = packSheets([strip, strip, { type: "full", w: 2600, laneW: 1200 }], 1200, 2600, { fullBoards: true });
    expect(packed).toEqual({ whole: 1, cutSheets: 2, total: 3 });
  });
});

describe("the gypsum take-off", () => {
  it("treats a joint filler rate of 0 as no filler", () => {
    const t = buildGypsumTakeOff(fields({ compoundRate: "0" }));
    expect([t.compound.rate, t.tape.needed]).toEqual([null, false]);
    expect(jointFillerRate("0", "1.1")).toEqual({ rate: 0.374, derived: true });
  });

  it("counts sheets from the layout", () => {
    const t = buildGypsumTakeOff(fields());
    // 4000 wall: 1200, 1200, 1200, 400 → 3 whole + one 400 strip (×2 walls).
    // 3000 wall: 1200, 1200, 600 → 2 whole + 1 ripped (×2; two 600s per sheet).
    // Whole: 3·2 + 2·2 = 10. Strips: 400 ×2 → 1 sheet, 600 ×2 → 1 sheet.
    expect(t.sheets.layout).toBe(12);
    expect(t.ready).toBe(true);
  });

  it("counts every cut piece as a full board when asked", () => {
    // Same room: 10 whole + 400 ×2 + 600 ×2 = 14 pieces, a board each.
    const t = buildGypsumTakeOff(fields({ fullBoards: true }));
    expect(t.sheets.layout).toBe(14);
    expect(t.sheets.fullBoards).toBe(true);
    expect(buildGypsumTakeOff(fields({ fullBoards: true, layers: "2" })).sheets.layout).toBe(28);
  });

  it("says what each surface takes on its own, which can be more than its share of the room", () => {
    const t = buildGypsumTakeOff(fields());
    // 4000 wall: 3 whole + a 400 strip = 4; 3000 wall: 2 whole + a 600 strip = 3.
    expect(t.surfaces.map(s => [s.label, s.layout.boards])).toEqual([["Walls A, C", 4], ["Walls B, D", 3]]);
    // Alone the four walls take 14; packed together the strips share boards: 12.
    expect(t.sheets.layout).toBe(12);
    expect(t.sheets.separate).toBe(14);
    // Offcuts kept to their own wall: the order is the walls alone.
    const own = buildGypsumTakeOff(fields({ offcutsPerSurface: true }));
    expect([own.sheets.layout, own.sheets.full, own.sheets.fromCuts, own.sheets.perSurface]).toEqual([14, 10, 4, true]);
    // Two layers: each wall's two strips (one a layer) share a board — 400s
    // on A and C (3 + 3 + 1 = 7 each), 600s on B and D (5 each): 24, not 28.
    expect(buildGypsumTakeOff(fields({ offcutsPerSurface: true, layers: "2" })).sheets.layout).toBe(24);
    expect(buildGypsumTakeOff(fields({ layers: "2" })).surfaces[0].layout.boards).toBe(7);
  });

  it("leaves a row out of the count and the area, but keeps it drawn", () => {
    const all = buildGypsumTakeOff(fields());
    // Walls A, C: lanes 1200, 1200, 1200, 400. Leave out the 400 strip (R4).
    const t = buildGypsumTakeOff(fields({ excluded: { "wall-ac": [3] } }));
    const ac = t.surfaces[0];
    expect(ac.layout.rows[3].excluded).toBe(true);
    expect(ac.layout.pieces.filter(p => p.excluded)).toHaveLength(1);
    expect([ac.layout.full, ac.layout.cut, ac.layout.boards]).toEqual([3, 0, 3]);
    // 10 whole + the two 600 strips on one sheet.
    expect(t.sheets.layout).toBe(11);
    expect(t.area.excluded).toBe(2.08);
    expect(t.area.net).toBeCloseTo(all.area.net - 2.08, 2);
    expect(t.screws.count).toBeLessThan(all.screws.count);
    // R3 still meets the 400 strip, so that joint is kept.
    expect(t.tape.joints).toBe(all.tape.joints);
  });

  it("forgets rows left out on another layout of the surface", () => {
    const h = fields({ orientation: "H", sheetW: "1250", sheetL: "2500" });
    const key = buildGypsumTakeOff(h).surfaces[0].layout.laneKey;
    const picked = { "wall-ac": { key, lanes: [2] } };
    // Fixed horizontally, R3 is the 100 top strip: 0.4 m² a wall, two walls.
    expect(buildGypsumTakeOff({ ...h, excluded: picked }).area.excluded).toBe(0.8);
    // Fixed vertically it would be a whole column; the choice no longer applies.
    const v = buildGypsumTakeOff({ ...h, orientation: "V", excluded: picked });
    expect(v.area.excluded).toBe(0);
    expect(v.surfaces[0].layout.rows.some(r => r.excluded)).toBe(false);
  });

  it("says every row is left out rather than asking for dimensions", () => {
    const t = buildGypsumTakeOff(fields({ mode: "wall", wallW: "2400", wallH: "2600", excluded: { wall: [0, 1] } }));
    expect(t.ready).toBe(false);
    expect(t.issue).toMatch(/Every row is left out/);
  });

  it("does not count an opening's area twice when it sits in a row left out", () => {
    const opening = [{ kind: "door", wall: "A", x: "3600", w: "400", h: "2100" }];
    const t = buildGypsumTakeOff(fields({ openings: opening, excluded: { "wall-a": [3] } }));
    // Wall A splits from C; its 400 strip less the door in it.
    expect(t.area.excluded).toBeCloseTo((400 * 2600 - 400 * 2100) / 1e6, 2);
    expect(t.area.net).toBeCloseTo(t.area.gross - t.area.openings - t.area.excluded, 2);
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

  it("finishes the second layer from the first layer's offcuts", () => {
    // 3900 × 1200 fixed horizontally in 1200 × 2600: a whole board and a 1300
    // half a layer. Two layers take 3 boards, the halves from one, not 4.
    const wall = { mode: "wall", wallW: "3900", wallH: "1200", orientation: "H" };
    expect(buildGypsumTakeOff(fields(wall)).sheets.layout).toBe(2);
    const two = buildGypsumTakeOff(fields({ ...wall, layers: "2" }));
    expect([two.sheets.layout, two.sheets.full, two.sheets.fromCuts]).toEqual([3, 2, 1]);
    expect(two.surfaces[0].layout.boards).toBe(3);
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

  it("labels each piece with its width across the wall", () => {
    const v = layoutSurface({ w: 3000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V" });
    expect(v.pieces.map(p => p.label)).toEqual(["1200", "1200", "600"]);
    expect(v.pieces[2].size).toBe("600 × 2600 mm");
    const h = layoutSurface({ w: 3000, h: 2400, sheetW: 1200, sheetL: 2600, orientation: "H" });
    expect(h.pieces[0].label).toBe(String(h.pieces[0].len));
  });

  describe("first panel offset", () => {
    it("starts each wall with a strip, so the first full board lands on the first stud", () => {
      const lay = layoutSurface({ w: 4000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "V", firstLane: 600 });
      expect(lay.rows.map(r => r.h)).toEqual([600, 1200, 1200, 1000]);
      const firstFull = lay.pieces.find(p => p.type === "full");
      expect(firstFull.x).toBe(600);
    });

    it("applies to walls, not the ceiling", () => {
      const t = buildGypsumTakeOff(fields({ ceiling: true, firstOffset: "600" }));
      const wall = t.surfaces.find(s => s.id === "wall-ac");
      const ceiling = t.surfaces.find(s => s.id === "ceiling");
      expect(wall.layout.rows[0].h).toBe(600);
      expect(ceiling.layout.rows[0].h).toBe(1200);
      expect(t.firstOffset).toBe(600);
    });

    it("fixed horizontally, starts every row's first piece at the offset, still staggered", () => {
      // 5000 wall, 2600 boards: row 1 = 600 + 2600 + 1800; row 2 starts half a
      // board further on, 600 + 1300 = 1900, then 2600 and 500.
      expect(lanePieces(5000, 2600, 0, 600)).toEqual([600, 2600, 1800]);
      expect(lanePieces(5000, 2600, 1, 600)).toEqual([1900, 2600, 500]);
      const lay = layoutSurface({ w: 5000, h: 2600, sheetW: 1200, sheetL: 2600, orientation: "H", firstLane: 600 });
      const firstFull = lay.pieces.find(p => p.type === "full" && p.lane === 0);
      expect(firstFull.x).toBe(600);
      // A wall one board covers needs no joint, so no offset either.
      expect(lanePieces(2400, 2600, 0, 600)).toEqual([2400]);
    });

    it("keeps the sliver rule with an offset, trimming the whole board and not the offset", () => {
      // 600 + 2600 leaves 100 on a 3300 run; the 600 is a stud measurement,
      // so the whole board gives up the 200 — with Wall start Trim first too.
      expect(lanePieces(3300, 2600, 0, 600)).toEqual([600, 2400, 300]);
      expect(lanePieces(3300, 2600, 0, 600, true)).toEqual([600, 2400, 300]);
      // A staggered row's first piece is offset + half a board: kept as well.
      expect(lanePieces(4600, 2600, 1, 600)).toEqual([1900, 2400, 300]);
    });

    it("packs the corner strips two to a board", () => {
      const plain = buildGypsumTakeOff(fields());
      const offset = buildGypsumTakeOff(fields({ firstOffset: "600" }));
      // 4000: 600 + 1200 + 1200 + 1000; 3000: 600 + 1200 + 1200 — two full
      // boards a wall, 8 in all. The four 600 strips make two boards and the
      // two 1000 strips one each: 12, as many as without the offset here.
      expect(offset.sheets.full).toBe(8);
      expect(offset.sheets.fromCuts).toBe(4);
      expect(offset.sheets.layout).toBe(plain.sheets.layout);
    });

    it("leaves out an offset as long as the board side it cuts, and says so", () => {
      const v = buildGypsumTakeOff(fields({ firstOffset: "1200" }));
      expect(v.firstOffset).toBe(null);
      expect(v.warning).toMatch(/less than the sheet width/);
      const h = buildGypsumTakeOff(fields({ orientation: "H", firstOffset: "1200" }));
      expect(h.firstOffset).toBe(1200);
      expect(buildGypsumTakeOff(fields({ orientation: "H", firstOffset: "2600" })).warning).toMatch(/less than the sheet length/);
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

  describe("walls left out", () => {
    it("drops a wall from the layout, area and order, with its openings", () => {
      const all = buildGypsumTakeOff(fields());
      const t = buildGypsumTakeOff(fields({ excludedWalls: ["B"],
        openings: [{ kind: "door", wall: "B", x: "500", w: "900", h: "2100" }] }));
      expect(t.ready).toBe(true);
      expect(t.surfaces.map(s => s.label)).toEqual(["Walls A, C", "Wall D"]);
      expect(t.area.gross).toBeCloseTo((2 * 4000 + 3000) * 2600 / 1e6, 2);
      // The door on B comes off nothing: its wall is not boarded.
      expect(t.area.openings).toBe(0);
      expect(t.openings.list[0].status).toBe("skipped");
      expect(t.sheets.toBuy).toBeLessThan(all.sheets.toBuy);
      expect(t.excludedWalls).toEqual(["B"]);
    });

    it("tapes a corner while either of its walls is boarded", () => {
      // B and C out: A–B and C–D each keep one boarded wall, B–C has none.
      const t = buildGypsumTakeOff(fields({ excludedWalls: ["C", "B"] }));
      expect(t.tape.corners).toBeCloseTo(3 * 2600 / 1000, 3);
      expect(t.excludedWalls).toEqual(["B", "C"]);
    });

    it("says so when every wall is left out and there is no ceiling", () => {
      const t = buildGypsumTakeOff(fields({ excludedWalls: ["A", "B", "C", "D"] }));
      expect(t.ready).toBe(false);
      expect(t.issue).toMatch(/Every wall is left out/);
      const lid = buildGypsumTakeOff(fields({ excludedWalls: ["A", "B", "C", "D"], ceiling: true }));
      expect(lid.ready).toBe(true);
      expect(lid.surfaces.map(s => s.id)).toEqual(["ceiling"]);
      expect(lid.tape.corners).toBeCloseTo(2 * 7000 / 1000, 3);
    });

    it("ignores the list for a single wall", () => {
      const t = buildGypsumTakeOff(fields({ mode: "wall", wallW: "3000", wallH: "2600", excludedWalls: ["A"] }));
      expect(t.ready).toBe(true);
      expect(t.excludedWalls).toEqual([]);
    });
  });
});


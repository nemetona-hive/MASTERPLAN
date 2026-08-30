import { describe, expect, it } from "vitest";

// simulation.js is a classic script, not a module: it exports nothing and is
// loaded by index.html as its own <script>. tests/setup.js evaluates it and
// publishes its top-level names, so they are read off globalThis here rather
// than imported.
const { symEdge, mkRowHeights, getSourceId, simulate, simulateS4,
        countSegs, computeS0, computeS1, computeS2, computeS3, computeS4 } = globalThis;

const widthsOf = row => row.segs.map(s => s.w);
const totalWidth = row => row.segs.reduce((a, s) => a + s.w, 0);

describe("symEdge", () => {
  it("splits the remainder evenly between the two edges", () => {
    // 3200: 6 whole planks and 200 left, so 100 at each edge.
    expect(symEdge(3200, 500)).toEqual({ edgeWidth: 100, finalFullCount: 6 });
  });

  it("gives an exact fit two half-plank edges rather than no edge at all", () => {
    // 3000 over 500 divides exactly, so the remainder is 0 — and 0 is below the
    // 20%-of-a-plank threshold, so the same branch that rescues a thin sliver
    // fires here too: one plank is given up and split, producing 5 full planks
    // between two 250mm edges instead of 6 full planks and no cuts.
    //
    // Documented rather than asserted as desirable. If symmetric mode should
    // leave an exact fit alone, the threshold needs to exclude a zero
    // remainder, and this test is the one to change.
    expect(symEdge(3000, 500)).toEqual({ edgeWidth: 250, finalFullCount: 5 });
  });

  it("gives up a whole plank rather than leave a sliver at the edge", () => {
    // 3100 would leave 50 a side — a tenth of a plank, too thin to lay well.
    // Dropping to 5 full planks makes each edge 300 instead.
    expect(symEdge(3100, 500)).toEqual({ edgeWidth: 300, finalFullCount: 5 });
  });

  it("keeps the simple split exactly at the 20% threshold", () => {
    // Remainder 200 → 100 a side, which is exactly 20% of 500: still simple.
    const { edgeWidth, finalFullCount } = symEdge(3200, 500);
    expect(edgeWidth).toBe(100);
    expect(finalFullCount).toBe(6);
  });

  it("never returns a negative full count on a surface narrower than one plank", () => {
    expect(symEdge(300, 500).finalFullCount).toBe(0);
  });

  it("treats a non-positive step as nothing to lay", () => {
    expect(symEdge(3000, 0)).toEqual({ edgeWidth: 0, finalFullCount: 0 });
    expect(symEdge(3000, -5)).toEqual({ edgeWidth: 0, finalFullCount: 0 });
  });
});

describe("mkRowHeights", () => {
  it("covers the full height exactly, symmetric or not", () => {
    for (const useSym of [false, true]) {
      const heights = mkRowHeights(2500, 300, useSym);
      const sum = heights.reduce((a, h) => a + h, 0);
      expect(sum).toBeCloseTo(2500, 6);
    }
  });

  it("puts the part row last when not symmetric", () => {
    const heights = mkRowHeights(1000, 300, false);
    expect(heights).toEqual([300, 300, 300, 100]);
  });

  it("puts an equal part row at each end when symmetric", () => {
    const heights = mkRowHeights(1000, 300, true);
    expect(heights[0]).toBe(heights[heights.length - 1]);
    expect(heights.slice(1, -1).every(h => h === 300)).toBe(true);
  });

  it("returns one full-height row when the panel pitch is unusable", () => {
    expect(mkRowHeights(2500, 0, false)).toEqual([2500]);
  });
});

describe("getSourceId", () => {
  it("labels offcuts A..Z then AA, the spreadsheet way", () => {
    expect(getSourceId(0)).toBe("A");
    expect(getSourceId(25)).toBe("Z");
    expect(getSourceId(26)).toBe("AA");
    expect(getSourceId(27)).toBe("AB");
    expect(getSourceId(51)).toBe("AZ");
    expect(getSourceId(52)).toBe("BA");
  });
});

describe("simulate", () => {
  it("lays every row across the full width", () => {
    const rows = simulate(3000, 2000, 300, 1200, 0.5, 100, 2);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(totalWidth(row)).toBeCloseTo(3000, 6);
  });

  it("reuses the offcut from one row at the start of the next", () => {
    // Even with no stagger (system 1), rows alternate: a row ending in a 600
    // cut hands that piece to the next row, which opens with it as an offcut.
    // That is the point — it is the same plank, not a second one.
    const rows = simulate(3000, 2000, 300, 1200, 0.5, 100, 1);
    expect(widthsOf(rows[0])).toEqual([1200, 1200, 600]);
    expect(rows[0].segs[2].type).toBe("cut");
    expect(widthsOf(rows[1])).toEqual([600, 1200, 1200]);
    expect(rows[1].segs[0].type).toBe("offcut");
    // And the offcut carries the id of the cut it came from.
    expect(rows[1].segs[0].sourceId).toBe(rows[0].segs[2].sourceId);
  });

  it("staggers alternate rows under systems 2 and 3", () => {
    // System 2 offsets odd rows by `offset * plank`, system 3 by a third.
    const s2 = simulate(3000, 2000, 300, 1200, 0.33, 100, 2);
    expect(widthsOf(s2[1])).not.toEqual(widthsOf(s2[0]));
    const s3 = simulate(3000, 2000, 300, 1200, 0, 100, 3);
    expect(widthsOf(s3[1])).not.toEqual(widthsOf(s3[0]));
  });

  it("repeats system 3's offset every third row", () => {
    // The stagger is (i % 3) * (plank / 3), so rows 0 and 3 sit at the same
    // offset and rows 1 and 2 sit a third and two thirds along. That cycle is
    // the whole difference between system 3 and system 2, and the alternating
    // test above cannot see it — a plain odd/even stagger passes that one too.
    //
    // minJ is set past the surface width so no offcut is ever carried into the
    // next row: with the carry in play each row's start depends on the row
    // before it, which hides the offset being tested. Pieces that would have
    // been cuts read as gaps here for the same reason, which is why this
    // asserts on widths rather than on validity.
    const rows = simulate(3000, 4000, 1000, 1200, 0, 99999, 3);
    expect(rows).toHaveLength(4);
    expect(widthsOf(rows[3])).toEqual(widthsOf(rows[0]));
    expect(widthsOf(rows[1])).not.toEqual(widthsOf(rows[0]));
    expect(widthsOf(rows[2])).not.toEqual(widthsOf(rows[0]));
    expect(widthsOf(rows[2])).not.toEqual(widthsOf(rows[1]));
    // Offset 400 leaves 1200 - 400 of the first plank showing, offset 800
    // leaves 400. Read off the leading piece, this is the cycle itself.
    expect(rows[0].segs[0].w).toBe(1200);
    expect(rows[1].segs[0].w).toBe(800);
    expect(rows[2].segs[0].w).toBe(400);
  });

  it("a half offset that matches the offcut leaves the row widths unchanged", () => {
    // 3000 wide over 1200 planks leaves 600, and a 0.5 offset is also 600, so
    // the stagger lands exactly where the reused offcut already ends: rows 0
    // and 1 come out the same width-for-width. Only the piece types differ.
    // Worth pinning, because it looks like the stagger failing to apply.
    const rows = simulate(3000, 2000, 300, 1200, 0.5, 100, 2);
    expect(widthsOf(rows[1])).toEqual(widthsOf(rows[0]));
    expect(rows[2].segs[0].type).toBe("offcut");
  });

  it("refuses degenerate input rather than returning half a layout", () => {
    expect(simulate(0, 2000, 300, 1200, 0.5, 100, 1)).toEqual([]);
    expect(simulate(3000, 0, 300, 1200, 0.5, 100, 1)).toEqual([]);
    expect(simulate(3000, 2000, 0, 1200, 0.5, 100, 1)).toEqual([]);
    expect(simulate(3000, 2000, 300, 0, 0.5, 100, 1)).toEqual([]);
  });

  it("caps runaway geometry instead of looping", () => {
    // A 1mm plank across a 10m wall is 10,000 pieces — a typo, not a layout.
    expect(simulate(10000, 2000, 300, 1, 0.5, 100, 1)).toEqual([]);
    expect(simulate(3000, 10000, 1, 1200, 0.5, 100, 1)).toEqual([]);
  });

  it("caps runaway geometry in the S4 simulator too", () => {
    // s4Long is unclamped in the UI, so a 1mm long piece is reachable by typo.
    expect(simulateS4(10000, 2000, 300, 1, 100, false)).toEqual([]);
    expect(simulateS4(3000, 10000, 1, 1200, 100, false)).toEqual([]);
  });

  it("mirrors a layout without changing what it is made of", () => {
    const plain = simulate(3000, 2000, 300, 1200, 0.5, 100, 2, false, 0, false);
    const mirrored = simulate(3000, 2000, 300, 1200, 0.5, 100, 2, false, 0, true);
    for (let i = 0; i < plain.length; i++) {
      expect(widthsOf(mirrored[i])).toEqual(widthsOf(plain[i]).reverse());
      expect(totalWidth(mirrored[i])).toBeCloseTo(totalWidth(plain[i]), 6);
    }
  });

  it("calls a piece below the minimum joint a gap, not a cut", () => {
    // minJ is the smallest offcut worth laying; anything shorter is a hole.
    const rows = simulate(2500, 600, 300, 1200, 0, 200, 1);
    const kinds = new Set(rows.flatMap(r => r.segs.map(s => s.type)));
    expect(kinds.has("gap") || kinds.has("cut")).toBe(true);
    for (const row of rows) {
      for (const seg of row.segs) {
        if (seg.type === "gap") expect(seg.w).toBeLessThan(200);
        if (seg.type === "cut") expect(seg.w).toBeGreaterThanOrEqual(200);
      }
    }
  });
});

describe("simulateS4", () => {
  it("covers the full width and alternates which end carries the short piece", () => {
    const rows = simulateS4(2900, 1200, 300, 1200, 100, false);
    for (const row of rows) expect(totalWidth(row)).toBeCloseTo(2900, 6);
    // Odd rows open with the short piece, even rows close with it.
    expect(rows[0].segs[0].w).toBe(1200);
    expect(rows[1].segs[0].w).toBeCloseTo(2900 - 2 * 1200, 6);
  });

  it("produces no short piece when the width divides exactly", () => {
    const rows = simulateS4(3600, 1200, 300, 1200, 100, false);
    for (const row of rows) expect(row.segs.every(s => s.type === "full")).toBe(true);
  });
});

describe("countSegs", () => {
  it("counts one type across every row", () => {
    const rows = [
      { segs: [{ type: "full" }, { type: "cut" }, { type: "full" }] },
      { segs: [{ type: "full" }, { type: "gap" }] }
    ];
    expect(countSegs(rows, "full")).toBe(3);
    expect(countSegs(rows, "cut")).toBe(1);
    expect(countSegs(rows, "gap")).toBe(1);
    expect(countSegs(rows, "offcut")).toBe(0);
  });

  it("survives malformed rows rather than throwing mid-render", () => {
    expect(countSegs(null, "full")).toBe(0);
    expect(countSegs([{}], "full")).toBe(0);
    expect(countSegs([{ segs: null }], "full")).toBe(0);
  });
});

describe("computeS0", () => {
  it("reports an invalid result for unusable dimensions", () => {
    expect(computeS0({ roomWidth: 0, panelWidth: 500 }).valid).toBe(false);
    expect(computeS0({ roomWidth: 3000, panelWidth: 0 }).valid).toBe(false);
  });

  it("lays a symmetric run with an equal edge piece each side", () => {
    const result = computeS0({ roomWidth: 3200, panelWidth: 500, oneFullEdge: false });
    expect(result.valid).toBe(true);
    const segs = result.rows[0].segs;
    expect(segs[0]).toEqual({ w: 100, type: "edge" });
    expect(segs[segs.length - 1]).toEqual({ w: 100, type: "edge" });
    expect(result.stats.cut).toBe(2);
    expect(result.stats.full).toBe(6);
  });

  it("covers the room width to within rounding", () => {
    const result = computeS0({ roomWidth: 3200, panelWidth: 500, oneFullEdge: false });
    const laid = result.rows[0].segs.reduce((a, s) => a + s.w, 0);
    expect(laid).toBeCloseTo(3200, 6);
  });

  it("starts flush with one full edge when asked", () => {
    const result = computeS0({ roomWidth: 3200, panelWidth: 500, oneFullEdge: true });
    expect(result.valid).toBe(true);
    // No custom first piece: the run starts on a full panel and any remainder
    // lands at the far end.
    expect(result.rows[0].segs[0].type).toBe("full");
  });
});

describe("computeS3", () => {
  // computeStandard(sh, 3, 0, "s3"). Only ever reached through the simulate
  // stagger test before this block, which exercised the row maths but nothing
  // of the wrapper: the cap check, the summary shape, the direction swap.
  //
  // Note computeStandard passes the sheet through as simulate(sW, sH, PLa,
  // PPi, ...) — PLa is the row pitch and PPi the piece length along the row,
  // the opposite way round to how the names read. Sizes here are chosen to
  // give four rows, so the three-row offset cycle actually occurs.
  const sheet = { W: 3000, H: 4000, PPi: 1200, PLa: 1000, direction: "H", minJ: 100, offset: 0, startOff: 0 };

  it("covers the surface and reports it valid", () => {
    const result = computeS3(sheet);
    expect(result.valid).toBe(true);
    expect(result.rows).toHaveLength(4);
    for (const row of result.rows) expect(totalWidth(row)).toBeCloseTo(3000, 6);
  });

  it("lays a different layout than the straight system on the same sheet", () => {
    // Both are computeStandard with a different sysNum, so a wiring mistake
    // that dropped the offset would leave S3 silently identical to S1. Four
    // rows are needed to see it: at two rows the two systems can agree by
    // coincidence.
    const s3 = computeS3(sheet);
    const s1 = computeS1(sheet);
    expect(s3.stats.total).not.toBe(s1.stats.total);
  });

  it("carries the surface and simulation dimensions through to meta", () => {
    const result = computeS3(sheet);
    expect(result.meta.visualization).toBe("rows");
    expect(result.meta.surfaceW).toBe(3000);
    expect(result.meta.surfaceH).toBe(4000);
    expect(result.meta.simW).toBe(3000);
    expect(result.meta.simH).toBe(4000);
    // s1, s2 and s3 deliberately share one segment colour — the systems are
    // told apart by their layout, not by tinting the planks differently.
    expect(result.meta.palClasses).toEqual(["color-s1"]);
  });

  it("swaps the simulated axes in the vertical direction", () => {
    const result = computeS3({ ...sheet, direction: "V" });
    expect(result.meta.simW).toBe(4000);
    expect(result.meta.simH).toBe(3000);
    // The surface itself is unchanged — only the axis the rows run along is.
    expect(result.meta.surfaceW).toBe(3000);
    expect(result.meta.surfaceH).toBe(4000);
  });

  it("returns an empty result for a surface with no size", () => {
    expect(computeS3({ ...sheet, W: 0 }).valid).toBe(false);
    expect(computeS3({ ...sheet, PPi: 0 }).rows).toEqual([]);
  });

  it("reports capped geometry as invalid rather than a valid empty layout", () => {
    const capped = computeS3({ ...sheet, PLa: 1 });
    expect(capped.valid).toBe(false);
    expect(capped.capped).toBe(true);
    expect(capped.summaryRows).toHaveLength(1);
    expect(capped.summaryRows[0].danger).toBe(true);
  });

  it("names the invalid status from config rather than inline", () => {
    // minJ above the surface width turns every part piece into a gap, which is
    // what makes a layout invalid. The label has to come from SUMMARY_LABELS so
    // the wording lives with the others.
    const invalid = computeS3({ ...sheet, minJ: 99999 });
    expect(invalid.valid).toBe(false);
    const status = invalid.summaryRows.at(-1);
    expect(status.value).toBe("Invalid");
    expect(status.danger).toBe(true);
    expect(status.label).toBe(SUMMARY_LABELS.s1s2s3.statusInvalid);
  });

  it("counts each offcut once in the placed total", () => {
    const result = computeS3(sheet);
    const placed = result.summaryRows.find(r => r.label === SUMMARY_LABELS.s1s2s3.placed);
    const remainder = result.summaryRows.find(r => r.label === SUMMARY_LABELS.s1s2s3.remainder);
    expect(placed.value).toBe(result.stats.full + result.stats.cut + remainder.value);
    expect(remainder.value).toBe(countSegs(result.rows, "offcut"));
  });
});

describe("computeS1 / computeS2", () => {
  const sheet = { W: 3000, H: 2000, PPi: 300, PLa: 1200, direction: "H", minJ: 100, offset: 0.5, startOff: 0 };

  it("marks a fully covered surface valid", () => {
    const result = computeS1(sheet);
    expect(result.valid).toBe(true);
    expect(result.stats.total).toBeGreaterThan(0);
  });

  it("carries the surface dimensions through to the visualisation meta", () => {
    const result = computeS2(sheet);
    expect(result.meta.surfaceW).toBe(3000);
    expect(result.meta.surfaceH).toBe(2000);
    expect(result.meta.visualization).toBe("rows");
  });

  it("returns an empty result for a surface with no size", () => {
    expect(computeS1({ ...sheet, W: 0 }).valid).toBe(false);
    expect(computeS1({ ...sheet, PLa: 0 }).rows).toEqual([]);
  });

  it("reports capped geometry as invalid rather than a valid empty layout", () => {
    // Without the cap check in computeStandard, simulate() returns [] here,
    // nGap([]) is 0, and the panel renders "Valid" over zero panels.
    const capped = computeS1({ ...sheet, PLa: 1 });
    expect(capped.valid).toBe(false);
    expect(capped.capped).toBe(true);
    expect(capped.summaryRows).toHaveLength(1);
    expect(capped.summaryRows[0].danger).toBe(true);

    const cappedS4 = computeS4({ ...sheet, s4Long: 1 });
    expect(cappedS4.valid).toBe(false);
    expect(cappedS4.capped).toBe(true);
  });
});

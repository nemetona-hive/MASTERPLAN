import { describe, expect, it } from "vitest";
import { buildCutList } from "../src/utils/cut-list.js";

/* Real layouts, computed by the simulation rather than hand-written, so these
   describe what the app actually produces. computeS1/S2 are globals from
   simulation.js, published by tests/setup.js. */
/* PPi is the material LENGTH and steps along a row, so it is the piece that
   gets cut; PLa is the WIDTH and sets the row height. W deliberately is not a
   multiple of PPi, which is what makes each row end in a cut whose remainder
   carries into the next — the relationship the panel table exists to state. */
const sheet = (over = {}) => ({
  W: 3000, H: 2400, PPi: 800, PLa: 600,
  offset: 0.5, direction: "H", minJ: 100, startOff: 0, rowStart: "top", ...over
});

const layout = { id: "s1", title: "Straight" };
const compute = sh => computeS1(sh);

describe("the cut list model", () => {
  it("is null when there is nothing to print", () => {
    // A header with no pieces under it is a sheet somebody carries to a saw
    // and then finds is blank.
    expect(buildCutList(null, sheet(), layout)).toBeNull();
    expect(buildCutList({ rows: [] }, sheet(), layout)).toBeNull();
  });

  it("states the job it belongs to", () => {
    const list = buildCutList(compute(sheet()), sheet(), layout);
    expect(list.system).toEqual({ id: "s1", title: "Straight" });
    expect(list.surface).toEqual({ width: 3000, height: 2400, direction: "H" });
    // Named as the page labels them: PLa is Width, PPi is Length.
    expect(list.material).toEqual({ width: 600, length: 800 });
  });

  it("holds numbers, never formatted strings", () => {
    // The next renderer would have to parse its own strings back, which is how
    // a millimetre figure reaches a spreadsheet as text that cannot be summed.
    const list = buildCutList(compute(sheet()), sheet(), layout);
    for (const row of list.rows) {
      for (const piece of row.pieces) expect(typeof piece.width).toBe("number");
    }
    for (const value of Object.values(list.totals)) expect(typeof value).toBe("number");
  });

  it("rounds to a tenth of a millimetre, in the model", () => {
    // The simulation works in floats and lands on 339.99999999999994 often
    // enough to matter. Rounding here is what keeps two renderers agreeing.
    const odd = sheet({ W: 3333, PPi: 1111 });
    const list = buildCutList(compute(odd), odd, layout);
    for (const row of list.rows) {
      for (const piece of row.pieces) {
        expect(piece.width, String(piece.width)).toBe(Math.round(piece.width * 10) / 10);
      }
    }
  });

  describe("the panel table — the half worth printing", () => {
    it("pairs a cut with the offcut that starts the next row", () => {
      /* simulate() runs the remainder of a cut panel into the START of the
         next row, and the two share a sourceId. A list that only said "row 3
         needs a 340" would have you cut a fresh panel and bin the 910 already
         in your hand. */
      const list = buildCutList(compute(sheet()), sheet(), layout);
      const paired = list.panels.filter(p => p.offcut);
      expect(paired.length).toBeGreaterThan(0);

      for (const panel of paired) {
        expect(panel.offcut.row, `panel ${panel.id}`).toBe(panel.cut.row + 1);
        // Both halves come out of one stock panel.
        expect(panel.cut.width + panel.offcut.width).toBeCloseTo(panel.stock, 1);
        expect(panel.waste).toBe(0);
      }
    });

    it("says so when a panel has no second half", () => {
      // The last cut in a layout has nowhere to carry to. "This one wastes the
      // remainder" is the answer somebody wants before cutting, not after.
      const list = buildCutList(compute(sheet()), sheet(), layout);
      const orphans = list.panels.filter(p => !p.offcut);
      for (const panel of orphans) {
        expect(panel.waste).toBeCloseTo(panel.stock - panel.cut.width, 1);
      }
    });

    it("is ordered by the row the cut lands in", () => {
      const list = buildCutList(compute(sheet()), sheet(), layout);
      const rowsOf = list.panels.map(p => p.cut.row);
      expect(rowsOf).toEqual([...rowsOf].sort((a, b) => a - b));
    });
  });

  describe("counting what to buy", () => {
    it("counts an offcut as already bought", () => {
      /* An offcut is the other half of a panel the cut already paid for.
         Counting it again is the double-count that turns a material order into
         an over-order. */
      const list = buildCutList(compute(sheet()), sheet(), layout);
      expect(list.totals.panelsToBuy).toBe(list.totals.full + list.panels.length);
      expect(list.totals.offcut).toBeGreaterThan(0);
      expect(list.totals.panelsToBuy).toBeLessThan(
        list.totals.full + list.totals.cut + list.totals.offcut);
    });

    it("a surface that divides exactly needs no cuts at all", () => {
      // W an exact multiple of the piece length: every row is whole panels, so
      // there is nothing to cut and nothing to carry.
      const exact = sheet({ W: 3000, PPi: 500 });
      const list = buildCutList(compute(exact), exact, layout);
      expect(list.totals.cut).toBe(0);
      expect(list.panels).toEqual([]);
      expect(list.totals.panelsToBuy).toBe(list.totals.full);
    });
  });

  describe("row order", () => {
    it("numbers rows the way the drawing shows them", () => {
      /* rowStart: "bottom" reverses the preview. A sheet numbering row 1 at the
         top while the preview numbers it at the bottom is worse than no sheet,
         because both look right on their own. */
      const top = buildCutList(compute(sheet()), sheet({ rowStart: "top" }), layout);
      const bottom = buildCutList(compute(sheet()), sheet({ rowStart: "bottom" }), layout);

      expect(top.rows.map(r => r.sourceRow)).toEqual(
        [...bottom.rows.map(r => r.sourceRow)].reverse());
      // Both number from 1 regardless; it is which row that changes.
      expect(top.rows[0].number).toBe(1);
      expect(bottom.rows[0].number).toBe(1);
      expect(bottom.rows[0].sourceRow).toBe(top.rows.length - 1);
    });
  });

  it("prints the gaps rather than hiding them", () => {
    /* A gap is a hole the layout could not fill. Omitting it makes the sheet a
       plan that does not fit the surface, carried to a saw by somebody with no
       way to know. minJ high enough forces one. */
    const gappy = sheet({ minJ: 700 });
    const list = buildCutList(compute(gappy), gappy, layout);
    expect(list.gaps.count).toBeGreaterThan(0);
    expect(list.gaps.width).toBeGreaterThan(0);
  });
});

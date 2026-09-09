import { describe, expect, it } from "vitest";
import { buildCutList } from "../src/utils/cut-list.js";
import { buildTakeOff } from "../src/utils/take-off.js";

const sheet = overrides => ({ W: 2500, H: 200, PPi: 1000, PLa: 200,
  direction: "H", minJ: 0, startOff: 0, offset: 0.5, s4Long: 1000, ...overrides });

describe("geometry and purchasing invariants", () => {
  it("fits symmetric edge pieces inside narrower-than-stock surfaces", () => {
    for (const width of [100, 199.5, 300, 999, 1000, 1100, 3200]) {
      const result = computeS0({ roomWidth: width, panelWidth: 1000, oneFullEdge: false });
      expect(result.valid).toBe(true);
      expect(result.rows[0].segs.reduce((n, s) => n + s.w, 0)).toBeCloseTo(width, 6);
      expect(result.rows[0].segs.every(s => s.w > 0 && s.w <= 1000)).toBe(true);
    }
  });

  it("rejects custom pieces larger than the stock or the surface", () => {
    for (const [roomWidth, panelWidth, customFirstPieceWidth] of [[1000, 200, 1500], [100, 1000, 200]]) {
      const r = computeS0({ roomWidth, panelWidth, customFirstPieceWidth, oneFullEdge: true });
      expect(r.status).toBe("invalid");
      expect(r.reason).toMatch(/fit/);
      expect(r.rows).toEqual([]);
    }
  });

  it("uses the actual simulation axes and caps the total work", () => {
    for (const sh of [sheet({ W: 100, H: 30000, PLa: 10 }),
      sheet({ W: 30000, H: 100, PPi: 10, PLa: 1000 }),
      sheet({ W: 50000, H: 50000, PPi: 100, PLa: 100, s4Long: 100 })]) {
      for (const compute of [computeS1, computeS2, computeS3]) {
        const result = compute(sh);
        expect(result.status).toBe("limited");
        expect(result.valid).toBe(false);
        expect(result.rows).toEqual([]);
      }
    }
  });

  it("rejects non-finite dimensions without producing a valid empty plan", () => {
    for (const compute of [computeS1, computeS2, computeS3, computeS4]) {
      for (const W of [NaN, Infinity, "invalid"]) expect(compute(sheet({ W })).status).toBe("invalid");
    }
  });

  it("cannot cut a long piece larger than its stock", () => {
    expect(computeS4(sheet({ s4Long: 1500 })).status).toBe("invalid");
  });

  it("orders three stock panels for the audited long/short cut list", () => {
    const sh = sheet();
    const result = computeS4(sh);
    const list = buildCutList(result, sh, { id: "s4" });
    expect(result.stats.stockPanels).toBe(3);
    expect(list.totals.panelsToBuy).toBe(3);
    expect(list.panels).toHaveLength(1);
    expect(list.panels[0].pieces[0]).toMatchObject({ width: 500, row: 1 });
  });

  it("reuses short and long pieces from the same stock", () => {
    const sh = sheet({ W: 1000, H: 400, s4Long: 600 });
    const result = computeS4(sh);
    expect(result.stats.stockPanels).toBe(2);
    for (const panel of result.stockPlan.panels) {
      expect(panel.pieces.map(p => p.width).sort()).toEqual([400, 600]);
    }
  });

  it("keeps every cut inside stock and screen/print orders equal in every system and direction", () => {
    for (const direction of ["H", "V"]) for (const W of [1100, 2500, 3333]) {
      for (const compute of [computeS1, computeS2, computeS3, computeS4]) {
        const sh = sheet({ W, H: 1400, direction, s4Long: 600 });
        const result = compute(sh);
        const list = buildCutList(result, sh, { id: "test" });
        expect(list.totals.panelsToBuy).toBe(result.stats.stockPanels);
        for (const panel of result.stockPlan.panels) {
          expect(panel.pieces.reduce((n, p) => n + p.width, 0)).toBeLessThanOrEqual(panel.stock + 1e-6);
        }
      }
    }
  });
});

describe("complete concrete measurements", () => {
  const fields = overrides => ({ areaMode: "direct", areaManual: 20, thickMode: "corners",
    ca: 100, cb: "", cc: "", cd: "", rate: 2, bagKg: 25, ...overrides });
  it("does not make missing corners into a printable measurement", () => {
    expect(buildTakeOff(fields()).ready).toBe(false);
    expect(buildTakeOff(fields({ cb: 0, cc: 0, cd: 0 })).ready).toBe(true);
  });
  it("rejects malformed and non-finite measurements", () => {
    for (const ca of ["12oops", "1.2.3", Infinity, -1]) {
      expect(buildTakeOff(fields({ ca, cb: 100, cc: 100, cd: 100 })).ready).toBe(false);
    }
  });
});

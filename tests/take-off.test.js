import { describe, expect, it } from "vitest";
import { buildTakeOff } from "../src/utils/take-off.js";

/* A 5m × 4m slab, 100mm average, at 20 kg/m²·mm — a pour somebody could
   actually be standing in front of. */
const fields = (over = {}) => ({
  areaMode: "dims", areaManual: "", lenMm: "5000", widMm: "4000",
  thickMode: "avg", avgH: "100", ca: "", cb: "", cc: "", cd: "",
  rate: "20", bagKg: "25", bagPrice: "4.50", product: "Screed M-100", ...over
});

describe("the concrete take-off", () => {
  it("takes area off two dimensions", () => {
    const t = buildTakeOff(fields());
    expect(t.area).toMatchObject({ value: 20, mode: "dims", length: 5000, width: 4000 });
  });

  it("takes area off a figure typed straight in", () => {
    const t = buildTakeOff(fields({ areaMode: "direct", areaManual: "18.5" }));
    expect(t.area.value).toBe(18.5);
    expect(t.area.mode).toBe("direct");
  });

  it("keeps the dimensions total even when the area was typed directly", () => {
    // The page shows it as a running total while somebody types the two
    // dimensions; a number you can watch is what makes the mode worth having.
    const t = buildTakeOff(fields({ areaMode: "direct", areaManual: "18.5" }));
    expect(t.area.fromDims).toBe(20);
  });

  it("derives volume and mass from the area and thickness", () => {
    const t = buildTakeOff(fields());
    expect(t.volume).toBe(2);            // 20 m² × 0.1 m
    expect(t.mass).toBe(40000);          // 20 m² × 100 mm × 20 kg/m²·mm
  });

  describe("thickness from four corners", () => {
    it("averages them", () => {
      const t = buildTakeOff(fields({ thickMode: "corners", ca: "80", cb: "80", cc: "120", cd: "120" }));
      expect(t.thickness.average).toBe(100);
      expect(t.thickness.corners).toEqual([80, 80, 120, 120]);
    });

    it("carries the fall, which the average cannot say", () => {
      /* A slab averaging 100mm across 80/80/120/120 is a very different pour
         from a flat 100mm one. That is the whole reason the mode exists. */
      const sloped = buildTakeOff(fields({ thickMode: "corners", ca: "80", cb: "80", cc: "120", cd: "120" }));
      const flat = buildTakeOff(fields());
      expect(sloped.thickness.difference).toBe(40);
      expect(flat.thickness.difference).toBeNull();
      // Same average, so the same volume — the difference is what distinguishes
      // them, and it has to reach the sheet.
      expect(sloped.volume).toBe(flat.volume);
    });
  });

  describe("bags — the figure two renderers must not disagree about", () => {
    it("states what the pour needs and what leaves the merchant", () => {
      const t = buildTakeOff(fields());
      expect(t.bags.exact).toBe(1600);     // 40000 kg / 25 kg
      expect(t.bags.toBuy).toBe(1600);
    });

    it("rounds up, because you cannot buy part of a bag", () => {
      // 20 m² × 30 mm × 20 = 12000 kg over 25 kg bags = 480 exactly; nudge the
      // thickness so it does not divide.
      const t = buildTakeOff(fields({ avgH: "31" }));
      expect(t.bags.exact).toBeCloseTo(496, 1);
      expect(t.bags.toBuy).toBe(496);

      const odd = buildTakeOff(fields({ avgH: "31", bagKg: "30" }));
      expect(odd.bags.exact).toBeCloseTo(413.33, 1);
      expect(odd.bags.toBuy).toBe(414);
    });

    it("prices what you buy, not what you need", () => {
      // The rounding gap is real money: 414 bags, not 413.33.
      const t = buildTakeOff(fields({ avgH: "31", bagKg: "30" }));
      expect(t.bags.total).toBe(414 * 4.5);
    });

    it("has no total when there is no price", () => {
      expect(buildTakeOff(fields({ bagPrice: "" })).bags.total).toBeNull();
    });
  });

  describe("what counts as ready to print", () => {
    it("needs an area and a thickness", () => {
      expect(buildTakeOff(fields()).ready).toBe(true);
      expect(buildTakeOff(fields({ lenMm: "", widMm: "" })).ready).toBe(false);
      expect(buildTakeOff(fields({ avgH: "" })).ready).toBe(false);
    });

    it("is ready without a product, because a volume is a real answer", () => {
      // Somebody ordering ready-mix wants the m³ and nothing else on this page.
      const t = buildTakeOff(fields({ rate: "", bagKg: "", bagPrice: "", product: "" }));
      expect(t.ready).toBe(true);
      expect(t.volume).toBe(2);
      expect(t.bags.toBuy).toBe(0);
      expect(t.product.name).toBeNull();
    });
  });

  it("treats a blank field as absent, not as zero", () => {
    /* The distinction is what `ready` rests on, and a plain coercion answers 0
       for both. */
    const t = buildTakeOff(fields({ bagPrice: "", bagKg: "" }));
    expect(t.bags.price).toBeNull();
    expect(t.bags.weight).toBeNull();
    expect(buildTakeOff(fields({ bagPrice: "0" })).bags.price).toBeNull();
  });

  it("holds numbers, never formatted strings", () => {
    const t = buildTakeOff(fields());
    for (const v of [t.area.value, t.volume, t.mass, t.bags.exact, t.bags.toBuy, t.bags.total]) {
      expect(typeof v).toBe("number");
    }
  });
});

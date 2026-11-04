import { describe, expect, it } from "vitest";
import { buildSeries, PHI, STEPS } from "../src/utils/golden-ratio.js";

describe("the golden ratio series", () => {
  it("is phi, exactly", () => {
    expect(PHI * PHI).toBeCloseTo(PHI + 1, 12);
    expect(PHI.toFixed(13)).toBe("1.6180339887499");
  });

  it("divides the base by phi, seven times", () => {
    const { steps, base } = buildSeries("1000");
    expect(base).toBe(1000);
    expect(steps).toHaveLength(STEPS);
    expect(steps[0].value).toBeCloseTo(1000 / PHI, 9);
    expect(steps[6].value).toBeCloseTo(1000 / PHI ** 7, 9);
  });

  it("refuses a base under 1, and is silent when nothing is entered", () => {
    expect(buildSeries("0.5")).toMatchObject({ valid: false, refused: true, steps: [] });
    expect(buildSeries("")).toMatchObject({ valid: false, refused: false, steps: [] });
    expect(buildSeries("12,5").base).toBe(12.5);
  });
});

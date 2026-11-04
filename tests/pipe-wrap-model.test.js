import { describe, expect, it } from "vitest";
import { buildPipeWrap } from "../src/utils/pipe-wrap.js";

/* The model behind the pipe wrap page and its diagram. The page's own wiring
   is tests/pipe-wrap.test.jsx. */
describe("the pipe wrap model", () => {
  it("wraps the outer surface, then adds the overlap and takes off the gap", () => {
    const w = buildPipeWrap({ pipeDiam: 100, matThick: 10, overlap: 50, gap: 20 });
    expect(w.outer).toBe(120);
    expect(w.base).toBeCloseTo(Math.PI * 120, 9);
    expect(w.total).toBeCloseTo(Math.PI * 120 + 30, 9);
  });

  it("reads typed text and numbers alike, and nothing else", () => {
    expect(buildPipeWrap({ pipeDiam: "100", matThick: "10" }).outer).toBe(120);
    expect(buildPipeWrap({ pipeDiam: "1.2.3" }).ready).toBe(false);
    expect(buildPipeWrap({ pipeDiam: -5 }).ready).toBe(false);
  });

  it("is nothing without a pipe, whatever the overlap", () => {
    const w = buildPipeWrap({ pipeDiam: "", overlap: 50 });
    expect(w).toMatchObject({ ready: false, total: 0, base: 0, angles: { gap: 0, overlap: 0 } });
  });

  it("never asks for a negative length, and says why", () => {
    const w = buildPipeWrap({ pipeDiam: 10, gap: 200 });
    expect(w.total).toBe(0);
    expect(w.gapTooLong).toBe(true);
  });

  it("draws the gap and overlap as their share of one turn, never more", () => {
    const quarter = buildPipeWrap({ pipeDiam: 100, overlap: Math.PI * 100 / 4 });
    expect(quarter.angles.overlap).toBeCloseTo(Math.PI / 2, 9);
    // 150 mm of overlap on a 62.8 mm wrap is the whole ring, not 2.4 turns.
    const long = buildPipeWrap({ pipeDiam: 20, overlap: 150, gap: 40 });
    expect(long.angles.gap + long.angles.overlap).toBeCloseTo(Math.PI * 2, 9);
  });
});

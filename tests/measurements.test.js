import { expect, it } from "vitest";
import { parseMeasurement } from "../src/utils/measurements.cjs";
it("distinguishes missing, malformed, and zero while accepting decimal commas", () => {
  for (const v of ["", " ", null, undefined]) expect(parseMeasurement(v)).toBeNull();
  for (const v of ["1,2,3", "1kg", "1e3", true, [], Infinity]) expect(parseMeasurement(v)).toBeNaN();
  expect(parseMeasurement("1,7")).toBe(1.7);
  expect(parseMeasurement(".5")).toBe(.5);
  expect(parseMeasurement("0")).toBe(0);
});

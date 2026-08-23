import { describe, expect, it } from "vitest";
import { clampNumber, safeSaveStaticDefaults, toNumber } from "../src/shared.jsx";

// The number coercions guard every dimension field in the app: whatever a user
// types has to become a number the layout maths can divide by, or a fallback —
// never NaN, which propagates silently through a whole layout.
describe("toNumber", () => {
  it("passes real numbers through", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.5")).toBe(3.5);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });

  it("treats an empty field as the fallback, not as zero by accident", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("", 500)).toBe(500);
    expect(toNumber(null, 500)).toBe(500);
  });

  it("never returns NaN or Infinity", () => {
    for (const bad of ["abc", "12abc", {}, [1, 2], NaN, Infinity, -Infinity]) {
      expect(Number.isFinite(toNumber(bad))).toBe(true);
    }
    expect(toNumber("abc", 7)).toBe(7);
    expect(toNumber(Infinity, 7)).toBe(7);
  });
});

describe("clampNumber", () => {
  it("holds a value inside its range", () => {
    expect(clampNumber(50, 0, 100)).toBe(50);
    expect(clampNumber(-10, 0, 100)).toBe(0);
    expect(clampNumber(150, 0, 100)).toBe(100);
    expect(clampNumber(0, 0, 100)).toBe(0);
    expect(clampNumber(100, 0, 100)).toBe(100);
  });

  it("falls back to the minimum when the input is not a number", () => {
    expect(clampNumber("", 10, 100)).toBe(10);
    expect(clampNumber("abc", 10, 100)).toBe(10);
    expect(clampNumber(null, 10, 100)).toBe(10);
  });

  it("honours an explicit fallback, still clamped", () => {
    expect(clampNumber("", 10, 100, 50)).toBe(50);
    expect(clampNumber("abc", 10, 100, 500)).toBe(100);
  });
});

describe("safeSaveStaticDefaults", () => {
  it("rejects rather than throwing when the dev-server hook is absent", async () => {
    // saveStaticDefaults only exists when the local dev server served the page.
    // On GitHub Pages it does not, and a save attempt must not take the app down.
    await expect(safeSaveStaticDefaults("materialPresets", []))
      .rejects.toThrow("saveStaticDefaults is not available");
  });
});

import { describe, expect, it } from "vitest";
import { fmtDecimal, fmtHHMM, parseLunch, parseTime } from "../src/utils/timesheet.js";

// These two parsers exist so a day can be typed the way it is said out loud —
// "half eight", "eight thirty", "0830" — and every one of those shapes has to
// land on the same number of minutes.
describe("parseTime", () => {
  it("reads the separated forms", () => {
    expect(parseTime("8:30")).toBe(510);
    expect(parseTime("8.30")).toBe(510);
    expect(parseTime("8,30")).toBe(510);
    expect(parseTime("08:05")).toBe(485);
  });

  it("reads bare digit runs by length", () => {
    expect(parseTime("830")).toBe(510);   // 3 digits: H MM
    expect(parseTime("0830")).toBe(510);  // 4 digits: HH MM
    expect(parseTime("8")).toBe(480);     // 1-2 digits: whole hours
    expect(parseTime("16")).toBe(960);
  });

  it("rejects a minute field of 60 or more rather than rolling it over", () => {
    // Silently accepting 8:70 as 9:10 would turn a typo into a plausible day.
    expect(parseTime("8:60")).toBeNull();
    expect(parseTime("870")).toBeNull();
    expect(parseTime("0899")).toBeNull();
  });

  it("treats empty and unparseable input as absent, not zero", () => {
    expect(parseTime("")).toBeNull();
    expect(parseTime("   ")).toBeNull();
    expect(parseTime(null)).toBeNull();
    expect(parseTime("lunch")).toBeNull();
    expect(parseTime("8:3")).toBeNull();   // minutes must be two digits
    expect(parseTime("12345")).toBeNull();
  });

  it("surrounding whitespace does not change the reading", () => {
    expect(parseTime("  8:30  ")).toBe(510);
  });
});

describe("parseLunch", () => {
  it("reads a dot prefix as literal minutes", () => {
    // The one rule that differs from parseTime: a lunch break is normally
    // minutes, so ".30" has to mean half an hour, not half past midnight.
    expect(parseLunch(".30")).toBe(30);
    expect(parseLunch(".5")).toBe(5);
    expect(parseLunch(".45")).toBe(45);
  });

  it("otherwise agrees with parseTime", () => {
    for (const raw of ["8:30", "830", "0830", "8", "8,30"]) {
      expect(parseLunch(raw)).toBe(parseTime(raw));
    }
  });

  it("treats blank as no break rather than as absent", () => {
    // Unlike parseTime's null: an empty lunch field means a day without one.
    expect(parseLunch("")).toBe(0);
    expect(parseLunch("   ")).toBe(0);
    expect(parseLunch(null)).toBe(0);
  });

  it("still rejects an out-of-range minute field", () => {
    expect(parseLunch("1:60")).toBeNull();
  });
});

describe("fmtHHMM", () => {
  it("pads minutes to two digits", () => {
    // 8:5 would read as five past eight or eight fifty depending on the reader.
    expect(fmtHHMM(485)).toBe("8:05");
    expect(fmtHHMM(510)).toBe("8:30");
    expect(fmtHHMM(0)).toBe("0:00");
    expect(fmtHHMM(60)).toBe("1:00");
  });

  it("does not wrap past 24 hours", () => {
    expect(fmtHHMM(1500)).toBe("25:00");
  });
});

describe("fmtDecimal", () => {
  it("rounds to the nearest quarter hour", () => {
    expect(fmtDecimal(480)).toBe("8.00");
    expect(fmtDecimal(510)).toBe("8.50");
    expect(fmtDecimal(495)).toBe("8.25");
    expect(fmtDecimal(525)).toBe("8.75");
  });

  it("snaps a stray minute to the nearest quarter", () => {
    expect(fmtDecimal(487)).toBe("8.00");   // 8h07 → 8.00
    expect(fmtDecimal(488)).toBe("8.25");   // 8h08 → 8.25
    expect(fmtDecimal(0)).toBe("0.00");
  });

  it("always carries two decimals so a column stays aligned", () => {
    for (const mins of [0, 15, 60, 480, 1000]) {
      expect(fmtDecimal(mins)).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

import { describe, expect, it } from "vitest";
import { GRID_NAV_KEYS, arrowExitsField, nextGridPosition } from "../src/utils/grid-nav.js";

/*
 * The two decisions arrow-nav makes, tested without a grid around them.
 *
 * useGridNav itself needs a DOM and real focus, so it is covered where it is
 * used — tests/timesheet-grid.test.jsx. These are the rules it applies.
 */

// A stand-in for an <input>: only the three properties the rule reads.
const field = (value, start, end = start) => ({
  value,
  selectionStart: start,
  selectionEnd: end
});

describe("arrowExitsField", () => {
  it("always leaves on up and down", () => {
    // They mean nothing inside a single-line input.
    expect(arrowExitsField("ArrowUp", field("08:30", 2))).toBe(true);
    expect(arrowExitsField("ArrowDown", field("08:30", 2))).toBe(true);
  });

  it("keeps the caret inside a part-typed time", () => {
    // The whole point of caret-aware: fixing a digit in the middle of 08:30
    // must still work, which "arrows always move cells" would take away.
    expect(arrowExitsField("ArrowLeft", field("08:30", 2))).toBe(false);
    expect(arrowExitsField("ArrowRight", field("08:30", 2))).toBe(false);
  });

  it("leaves left from the start and right from the end", () => {
    expect(arrowExitsField("ArrowLeft", field("08:30", 0))).toBe(true);
    expect(arrowExitsField("ArrowRight", field("08:30", 5))).toBe(true);
  });

  it("does not leave the wrong way off either end", () => {
    expect(arrowExitsField("ArrowRight", field("08:30", 0))).toBe(false);
    expect(arrowExitsField("ArrowLeft", field("08:30", 5))).toBe(false);
  });

  it("flies straight through an empty cell", () => {
    // start === end === length === 0. This is the move the feature exists for:
    // three empty rows crossed without a keystroke landing anywhere.
    expect(arrowExitsField("ArrowLeft", field("", 0))).toBe(true);
    expect(arrowExitsField("ArrowRight", field("", 0))).toBe(true);
  });

  it("collapses a selection before it leaves", () => {
    // Native behaviour, and what people rely on straight after focusing a
    // field — which is exactly when a cell's contents tend to be selected.
    expect(arrowExitsField("ArrowLeft", field("08:30", 0, 5))).toBe(false);
    expect(arrowExitsField("ArrowRight", field("08:30", 0, 5))).toBe(false);
  });

  it("stands aside when there is no caret to read", () => {
    expect(arrowExitsField("ArrowLeft", { value: "08:30", selectionStart: null, selectionEnd: null })).toBe(false);
    expect(arrowExitsField("ArrowRight", {})).toBe(false);
    expect(arrowExitsField("ArrowLeft", null)).toBe(false);
  });

  it("leaves a control that uses the arrows itself alone", () => {
    /* Up and Down are free to move rows only because they mean nothing inside a
       single-line text input. Inside a <select> they change the chosen option,
       and inside a number spinner they step the value. A caret is the
       precondition for all four directions. */
    const select = { value: "graphite" };                      // no selectionStart
    expect(arrowExitsField("ArrowDown", select)).toBe(false);
    expect(arrowExitsField("ArrowUp", select)).toBe(false);
    expect(arrowExitsField("ArrowLeft", select)).toBe(false);
    expect(arrowExitsField("ArrowRight", select)).toBe(false);
  });

  it("has nothing to say about other keys", () => {
    expect(arrowExitsField("Enter", field("", 0))).toBe(false);
    expect(arrowExitsField("Tab", field("", 0))).toBe(false);
    expect(arrowExitsField("a", field("", 0))).toBe(false);
  });
});

describe("nextGridPosition", () => {
  const grid = { rows: 3, cols: 3 };

  it("moves one cell each way", () => {
    expect(nextGridPosition({ row: 1, col: 1, key: "ArrowRight", ...grid })).toEqual({ row: 1, col: 2 });
    expect(nextGridPosition({ row: 1, col: 1, key: "ArrowLeft", ...grid })).toEqual({ row: 1, col: 0 });
    expect(nextGridPosition({ row: 1, col: 1, key: "ArrowDown", ...grid })).toEqual({ row: 2, col: 1 });
    expect(nextGridPosition({ row: 1, col: 1, key: "ArrowUp", ...grid })).toEqual({ row: 0, col: 1 });
  });

  it("stops at every edge rather than wrapping", () => {
    // Running right off Lunch would land on the next row's Start, two unrelated
    // cells a keypress apart.
    expect(nextGridPosition({ row: 0, col: 2, key: "ArrowRight", ...grid })).toBe(null);
    expect(nextGridPosition({ row: 0, col: 0, key: "ArrowLeft", ...grid })).toBe(null);
    expect(nextGridPosition({ row: 0, col: 1, key: "ArrowUp", ...grid })).toBe(null);
    expect(nextGridPosition({ row: 2, col: 1, key: "ArrowDown", ...grid })).toBe(null);
  });

  it("answers nothing for a key that is not a move", () => {
    expect(nextGridPosition({ row: 0, col: 0, key: "Enter", ...grid })).toBe(null);
  });

  it("copes with an empty grid", () => {
    expect(nextGridPosition({ row: 0, col: 0, key: "ArrowDown", rows: 0, cols: 0 })).toBe(null);
  });
});

describe("GRID_NAV_KEYS", () => {
  it("is the four arrows and nothing else", () => {
    expect([...GRID_NAV_KEYS].sort()).toEqual(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"]);
  });
});

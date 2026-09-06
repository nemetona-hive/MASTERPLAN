// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetConcrete } from "../src/components/Concrete.jsx";

/* The page's own wiring: the two mode switches, the armed reset, and the
   result card. The arithmetic is `tests/take-off.test.js` — this asserts that
   the page asks the model the right question and shows what comes back. */

const field = id => document.getElementById(id);
const type = (id, value) => {
  const el = field(id);
  fireEvent.change(el, { target: { value: String(value) } });
  fireEvent.blur(el);
};
const card = () => document.querySelector(".result-card");
const bags = () => card().querySelector(".result-card-value").textContent.trim();
const note = () => card().querySelector(".result-card-note").textContent.trim();
const click = name => fireEvent.click(screen.getByText(name));

/* A 5 × 4 m slab at 31 mm with 30 kg bags: chosen so the bag count does not
   divide, which is the case where "needs" and "buys" differ. */
const fillPour = () => {
  click("Dimensions");
  type("input-slf-len", 5000);
  type("input-slf-wid", 4000);
  type("input-slf-havg", 31);
  type("input-slf-rate", 20);
  type("input-slf-bagkg", 30);
  type("input-slf-bagprice", "4.50");
};

beforeEach(() => { vi.restoreAllMocks(); });

describe("the concrete page", () => {
  it("takes area from two dimensions once the mode is switched", () => {
    render(<SheetConcrete />);
    click("Dimensions");
    type("input-slf-len", 5000);
    type("input-slf-wid", 4000);
    expect(document.body.textContent).toContain("20.0");
  });

  it("keeps the two area modes apart", () => {
    // Typing a figure directly must not be overwritten by whatever is left in
    // the dimension fields, and the other way round.
    render(<SheetConcrete />);
    click("Dimensions");
    type("input-slf-len", 5000);
    type("input-slf-wid", 4000);
    click("Enter area");
    type("input-slf-area", 8);
    type("input-slf-havg", 100);
    type("input-slf-rate", 20);
    type("input-slf-bagkg", 25);
    // 8 m² × 100 mm × 20 = 16000 kg over 25 kg = 640 bags, not the 20 m² one.
    expect(bags()).toContain("640");
  });

  it("averages four corners, and the volume follows the average", () => {
    render(<SheetConcrete />);
    click("Dimensions");
    type("input-slf-len", 5000);
    type("input-slf-wid", 4000);
    click("4 corners");
    for (const [id, v] of [["ca", 80], ["cb", 80], ["cc", 120], ["cd", 120]]) {
      type(`input-slf-${id}`, v);
    }
    type("input-slf-rate", 20);
    type("input-slf-bagkg", 25);
    // Averages to 100 mm, so 20 × 100 × 20 = 40000 kg over 25 = 1600.
    expect(bags()).toContain("1600");
  });

  it("shows what the pour needs beside what you have to buy", () => {
    /* The gap between them is real money, and it is the figure the printed
       take-off had to agree with. */
    render(<SheetConcrete />);
    fillPour();
    expect(note()).toContain("413.33");
    expect(bags()).toContain("414");
  });

  describe("the global reset", () => {
    it("asks before clearing", () => {
      render(<SheetConcrete />);
      fillPour();
      expect(bags()).toContain("414");

      click("Global Reset");
      // Armed, not fired: the fields still hold the pour.
      expect(bags()).toContain("414");
      expect(screen.getByText("Confirm reset?")).toBeInTheDocument();
    });

    it("clears every field on the second press", () => {
      render(<SheetConcrete />);
      fillPour();
      click("Global Reset");
      click("Confirm reset?");

      for (const id of ["input-slf-len", "input-slf-wid", "input-slf-havg",
        "input-slf-rate", "input-slf-bagkg", "input-slf-bagprice"]) {
        expect(field(id).value, id).toBe("");
      }
      expect(bags()).toContain("0");
    });
  });

  describe("the take-off button", () => {
    it("is dead until there is a pour to describe", () => {
      // A sheet with a header and no figures is something somebody prints,
      // carries to a merchant, and finds is blank.
      render(<SheetConcrete />);
      expect(screen.getByText("Take-off").closest("button")).toBeDisabled();
    });

    it("wakes once an area and a thickness are in", () => {
      render(<SheetConcrete />);
      click("Dimensions");
      type("input-slf-len", 5000);
      type("input-slf-wid", 4000);
      type("input-slf-havg", 100);
      expect(screen.getByText("Take-off").closest("button")).not.toBeDisabled();
    });

    it("prints a sheet stating the same figures as the card", () => {
      /* The whole point of the shared model: the screen and the document
         cannot disagree about how many bags somebody buys. */
      const print = vi.fn();
      vi.stubGlobal("print", print);
      vi.stubGlobal("requestAnimationFrame", cb => { cb(); return 1; });

      render(<SheetConcrete />);
      fillPour();
      fireEvent.click(screen.getByText("Take-off"));

      const sheet = document.querySelector(".doc-sheet");
      expect(sheet).toBeTruthy();
      expect(sheet.textContent).toContain("413.33");
      expect(sheet.textContent).toContain("414");
      expect(print).toHaveBeenCalled();
    });
  });
});

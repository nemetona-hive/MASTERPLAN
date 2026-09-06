// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { TakeOffSheet } from "../src/components/TakeOffSheet.jsx";
import { buildTakeOff } from "../src/utils/take-off.js";

/* 5 × 4 m at 31 mm, 30 kg bags: chosen because the bag count does NOT divide.
   413.33 needed, 414 bought — the one figure a screen and a sheet could
   plausibly disagree about, which is why the model owns it. */
const fields = (over = {}) => ({
  areaMode: "dims", areaManual: "", lenMm: "5000", widMm: "4000",
  thickMode: "avg", avgH: "31", ca: "", cb: "", cc: "", cd: "",
  rate: "20", bagKg: "30", bagPrice: "4.50", product: "Screed M-100", ...over
});
const sheet = (over = {}) => buildTakeOff(fields(over));
const doc = () => document.querySelector(".doc-sheet");

describe("the printed take-off", () => {
  it("renders nothing until there is a pour to describe", () => {
    render(<TakeOffSheet takeOff={null} />);
    expect(doc()).toBeNull();
    render(<TakeOffSheet takeOff={sheet({ avgH: "" })} />);
    expect(doc()).toBeNull();
  });

  it("portals to body, so print can hide the app by position", () => {
    render(<TakeOffSheet takeOff={sheet()} />);
    expect(doc().parentElement).toBe(document.body);
  });

  it("shares the cut list's chrome rather than a second stylesheet", () => {
    render(<TakeOffSheet takeOff={sheet()} />);
    for (const cls of ["doc-sheet-head", "doc-sheet-block", "doc-sheet-facts", "doc-sheet-table"]) {
      expect(doc().querySelector(`.${cls}`), cls).toBeTruthy();
    }
    // And none of the cut list's own vocabulary, which means nothing here.
    expect(doc().querySelector(".cut-piece")).toBeNull();
  });

  it("prints both bag figures, and prices the one you buy", () => {
    render(<TakeOffSheet takeOff={sheet()} />);
    const text = doc().textContent;
    expect(text).toContain("413.33");   // what the pour consumes
    expect(text).toContain("414");      // what leaves the merchant
    expect(text).toContain("1863,00");  // 414 × 4.50, not 413.33 × 4.50
    expect(text).not.toContain("1859");
  });

  it("carries the fall when the thickness came from four corners", () => {
    /* The average alone cannot say a slab falls 40mm across its length, and
       that is the whole reason the corner mode exists. */
    render(<TakeOffSheet takeOff={sheet({
      thickMode: "corners", avgH: "", ca: "80", cb: "80", cc: "120", cd: "120" })} />);
    const text = doc().textContent;
    expect(text).toContain("Fall");
    expect(text).toContain("40");
    expect(text).toMatch(/Corners:/);
  });

  it("says nothing about a fall when the thickness was averaged", () => {
    render(<TakeOffSheet takeOff={sheet()} />);
    expect(doc().textContent).not.toContain("Fall");
  });

  it("shows the working behind an area taken off dimensions", () => {
    render(<TakeOffSheet takeOff={sheet()} />);
    expect(doc().querySelector(".doc-sheet-from").textContent).toMatch(/5,000 × 4,000 mm/);
  });

  it("omits the working when the area was typed straight in", () => {
    render(<TakeOffSheet takeOff={sheet({ areaMode: "direct", areaManual: "18.5" })} />);
    expect(doc().querySelector(".doc-sheet-from")).toBeNull();
  });

  it("still prints a volume with no product chosen", () => {
    // Somebody ordering ready-mix wants the m³ and nothing else on this page.
    render(<TakeOffSheet takeOff={sheet({ rate: "", bagKg: "", bagPrice: "", product: "" })} />);
    const text = doc().textContent;
    expect(text).toContain("0.620");
    expect(text).toMatch(/No product chosen/);
    expect(text).not.toContain("Bags to buy");
  });

  it("derives nothing the model did not already state", () => {
    const model = sheet();
    render(<TakeOffSheet takeOff={model} />);
    const text = doc().textContent;
    expect(text).toContain(String(model.bags.toBuy));
    expect(text).toContain(String(model.volume));
  });
});

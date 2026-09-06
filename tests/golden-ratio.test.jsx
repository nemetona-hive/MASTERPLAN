// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetGoldenRatio } from "../src/components/GoldenRatio.jsx";

const PHI = 1.6180339887499;

/* The page is controlled from App, so the test owns the items the way App
   does — which is also what makes "does a reset actually clear the store"
   answerable rather than a claim about local state. */
function Page({ initial }) {
  const [items, setItems] = React.useState(initial ?? [
    { id: "a", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false },
    { id: "b", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false }
  ]);
  return <SheetGoldenRatio grItems={items} setGrItems={setItems} />;
}

const valueField = id => document.getElementById(`input-base-number-field-${id}`);
const suffixField = id => document.getElementById(`input-base-label-suffix-${id}`);
const cardFor = id => document.getElementById(`panel-golden-ratio-${id}`);
const stepsIn = id => [...cardFor(id).querySelectorAll(".gr-step-row")]
  .map(r => r.querySelectorAll(".data-row-val")[1].textContent.trim());

const setValue = (id, v) => {
  fireEvent.change(valueField(id), { target: { value: String(v) } });
  fireEvent.blur(valueField(id));
};

describe("the golden ratio page", () => {
  it("shows nothing until a base value is worth dividing", () => {
    render(<Page />);
    expect(stepsIn("a")).toEqual([]);
    // Below 1 there is no series to build — commitBaseValue rejects it.
    setValue("a", "0.5");
    expect(stepsIn("a")).toEqual([]);
  });

  it("divides the base by phi, seven times", () => {
    render(<Page />);
    setValue("a", 1000);

    const steps = stepsIn("a");
    expect(steps).toHaveLength(7);
    // Each step is the one before it over phi; the first is the base over phi.
    let expected = 1000 / PHI;
    for (const shown of steps) {
      expect(Number(shown.replace(/\s/g, ""))).toBe(Math.round(expected));
      expected /= PHI;
    }
  });

  it("keeps each card's series to its own base", () => {
    render(<Page />);
    setValue("a", 1000);
    setValue("b", 500);
    expect(Number(stepsIn("a")[0])).toBe(Math.round(1000 / PHI));
    expect(Number(stepsIn("b")[0])).toBe(Math.round(500 / PHI));
  });

  it("rounds a typed base to the value it will actually use", () => {
    // commitBaseValue rounds on blur, so the series and the field agree.
    render(<Page />);
    setValue("a", "1000.456");
    expect(valueField("a").value).toBe("1000.46");
  });

  it("carries a custom label into the value row", () => {
    render(<Page />);
    setValue("a", 1000);
    fireEvent.change(suffixField("a"), { target: { value: "Start" } });
    expect(cardFor("a").textContent).toContain("Start");
  });

  describe("saving an entry", () => {
    it("marks the card as stored only while it still matches", () => {
      render(<Page />);
      setValue("a", 1000);
      expect(cardFor("a").className).not.toContain("gr-card-saved");

      fireEvent.click(screen.getAllByText("Save")[0]);
      expect(cardFor("a").className).toContain("gr-card-saved");

      // Editing it again makes it no longer what was stored.
      setValue("a", 1200);
      expect(cardFor("a").className).not.toContain("gr-card-saved");
    });

    it("reset clears the entry and its stored copy", () => {
      render(<Page />);
      setValue("a", 1000);
      fireEvent.click(screen.getAllByText("Save")[0]);
      fireEvent.click(screen.getAllByText("Reset")[0]);

      expect(valueField("a").value).toBe("");
      expect(stepsIn("a")).toEqual([]);
      expect(cardFor("a").className).not.toContain("gr-card-saved");
    });

    it("resets one card without touching the other", () => {
      render(<Page />);
      setValue("a", 1000);
      setValue("b", 500);
      fireEvent.click(screen.getAllByText("Reset")[0]);

      expect(valueField("a").value).toBe("");
      expect(valueField("b").value).toBe("500");
      expect(stepsIn("b")).toHaveLength(7);
    });
  });
});

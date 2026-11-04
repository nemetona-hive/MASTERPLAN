// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { PipeWrapCalculator } from "../src/components/PipeWrapCalculator.jsx";

/* The wrap length is the circumference of the OUTER surface — the pipe plus
   the material's own thickness on both sides — plus the overlap, less the gap.
   Every figure below is that formula worked by hand, so a change to it fails
   here rather than silently shipping a wrong cut. */
const circumference = (diameter, thickness) => Math.PI * (diameter + 2 * thickness);

const set = (id, value) => {
  const el = document.getElementById(id);
  fireEvent.change(el, { target: { value: String(value) } });
  fireEvent.blur(el);
};
const card = () => document.querySelector(".result-card");
const totalMm = () => {
  const text = card().textContent.match(/([\d.]+)\s*mm/);
  return Number(text[1]);
};

describe("the pipe wrap calculator", () => {
  it("says nothing until there is a pipe", () => {
    render(<PipeWrapCalculator />);
    expect(card().textContent).toContain("Enter the pipe outer diameter.");
    expect(card().textContent).not.toMatch(/\d\s*cm/);
  });

  it("does not turn an overlap alone into a length to cut", () => {
    render(<PipeWrapCalculator />);
    fireEvent.click(screen.getByText("Adjustments"));
    set("input-overlap-val", 50);
    expect(card().textContent).toContain("Enter the pipe outer diameter.");
    expect(card().textContent).not.toMatch(/\d\s*mm/);
  });

  it("explains a zero result when the gap is longer than the wrap", () => {
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", 10);
    fireEvent.click(screen.getByText("Adjustments"));
    set("input-gap-val", 200);
    expect(totalMm()).toBe(0);
    expect(screen.getByRole("status")).toHaveTextContent(/gap is longer/i);
  });

  it("does not half-parse a malformed diameter", () => {
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", "1.2.3");
    expect(card().textContent).toContain("Enter the pipe outer diameter.");
  });

  it("wraps the outer surface, not the pipe", () => {
    /* The material's own thickness is on both sides, so a 100mm pipe in 10mm
       material wraps 120mm of diameter. Missing that is a wrap that comes up
       short by 2·π·t — 63mm here — which is the mistake this page exists to
       stop somebody making in their head. */
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", 100);
    set("input-matThick", 10);
    expect(totalMm()).toBeCloseTo(circumference(100, 10), 1);
    expect(totalMm()).not.toBeCloseTo(circumference(100, 0), 1);
  });

  it("is just the circumference with no material thickness", () => {
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", 100);
    expect(totalMm()).toBeCloseTo(Math.PI * 100, 1);
  });

  it("sets material thickness from its quick presets", () => {
    render(<PipeWrapCalculator />);

    fireEvent.click(screen.getByRole("button", { name: "50 mm" }));
    expect(document.getElementById("input-matThick")).toHaveValue("50");
    expect(screen.getByRole("button", { name: "50 mm" })).toHaveClass("on");
  });

  it("clears an active quick preset on its second click", () => {
    render(<PipeWrapCalculator />);

    const diameter = screen.getByRole("button", { name: "Ø 100" });
    fireEvent.click(diameter);
    expect(document.getElementById("input-pipeDiam")).toHaveValue("100");
    fireEvent.click(diameter);
    expect(document.getElementById("input-pipeDiam")).toHaveValue("");
    expect(diameter).not.toHaveClass("on");

    const thickness = screen.getByRole("button", { name: "20 mm" });
    fireEvent.click(thickness);
    expect(document.getElementById("input-matThick")).toHaveValue("20");
    fireEvent.click(thickness);
    expect(document.getElementById("input-matThick")).toHaveValue("");
    expect(thickness).not.toHaveClass("on");
  });

  describe("the adjustments", () => {
    const open = () => fireEvent.click(screen.getByText("Adjustments"));

    it("adds the overlap and takes off the gap", () => {
      render(<PipeWrapCalculator />);
      set("input-pipeDiam", 100);
      set("input-matThick", 10);
      open();
      set("input-overlap-val", 50);
      set("input-gap-val", 20);
      expect(totalMm()).toBeCloseTo(circumference(100, 10) + 50 - 20, 1);
    });

    it("never asks for a negative length", () => {
      // A gap wider than the pipe is nonsense, and a negative cut is worse
      // than a zero one.
      render(<PipeWrapCalculator />);
      set("input-pipeDiam", 10);
      open();
      set("input-gap-val", 200);
      expect(totalMm()).toBe(0);
    });

    it("starts closed, because most wraps need neither", () => {
      render(<PipeWrapCalculator />);
      expect(document.getElementById("input-overlap-val")).toBeNull();
      open();
      expect(document.getElementById("input-overlap-val")).toBeTruthy();
    });
  });

  describe("the range sliders", () => {
    it("start locked, so a stray drag cannot change a cut", () => {
      /* The slider sits next to a number somebody is reading off a tape. An
         accidental swipe on a phone silently changing it is the reason the
         lock exists. */
      render(<PipeWrapCalculator />);
      fireEvent.click(screen.getByText("Adjustments"));
      const wrap = document.querySelector(".range-slider-wrap");
      expect(wrap.className).toContain("is-locked");
      expect(document.querySelector(".range-lock-btn")).toBeTruthy();
    });

    it("unlocks on the lock button", () => {
      render(<PipeWrapCalculator />);
      fireEvent.click(screen.getByText("Adjustments"));
      fireEvent.click(document.querySelector(".range-lock-btn"));
      expect(document.querySelector(".range-slider-wrap").className).toContain("is-unlocked");
    });
  });

  it("names the overlap and gap number fields by their labels", () => {
    render(<PipeWrapCalculator />);
    fireEvent.click(screen.getByText("Adjustments"));
    expect(screen.getByLabelText("Overlap / extra (mm)").id).toBe("input-overlap-val");
    expect(screen.getByLabelText("Gap / cutout (mm)").id).toBe("input-gap-val");
  });

  it("stores the slider's value as a number, as the field does", () => {
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", 100);
    fireEvent.click(screen.getByText("Adjustments"));
    fireEvent.click(document.querySelector(".range-lock-btn"));
    fireEvent.change(document.getElementById("input-overlap"), { target: { value: "50" } });
    expect(document.getElementById("input-overlap-val").value).toBe("50");
    expect(totalMm()).toBeCloseTo(circumference(100, 0) + 50, 1);
  });

  describe("the diagram", () => {
    const texts = () => [...document.querySelectorAll(".pw-diag-svg text")];

    it("is not drawn until there is a pipe, rather than drawing zeros", () => {
      render(<PipeWrapCalculator />);
      expect(document.querySelector(".pw-diag-svg")).toBeNull();
      set("input-pipeDiam", 100);
      expect(document.querySelector(".pw-diag-svg")).toBeTruthy();
    });

    it("condenses a sum too long for the frame instead of cutting it off", () => {
      render(<PipeWrapCalculator />);
      set("input-pipeDiam", "1125.5");
      set("input-matThick", "112.5");
      const sum = texts().find(t => t.textContent.startsWith("π"));
      expect(sum.getAttribute("lengthAdjust")).toBe("spacingAndGlyphs");
      set("input-pipeDiam", 100);
      set("input-matThick", 10);
      expect(texts().find(t => t.textContent.startsWith("π")).getAttribute("textLength")).toBeNull();
    });

    it("fills the frame with a thin pipe, and labels it under the ring when it is small inside", () => {
      render(<PipeWrapCalculator />);
      set("input-pipeDiam", 20);
      expect(texts().some(t => t.textContent === "pipe")).toBe(true);
      set("input-matThick", 50);
      expect(texts().some(t => t.textContent === "pipe Ø20mm")).toBe(true);
    });
  });

  describe("the reset", () => {
    it("asks first, then clears every field", () => {
      render(<PipeWrapCalculator />);
      set("input-pipeDiam", 100);
      set("input-matThick", 10);
      fireEvent.click(screen.getByText("Global Reset"));
      expect(document.getElementById("input-pipeDiam").value).toBe("100");
      fireEvent.click(screen.getByText("Confirm reset?"));
      expect(document.getElementById("input-pipeDiam").value).toBe("");
      expect(document.getElementById("input-matThick").value).toBe("");
      expect(card().textContent).toContain("Enter the pipe outer diameter.");
    });
  });

  it("says on the closed Adjustments section what it is still adding", () => {
    render(<PipeWrapCalculator />);
    fireEvent.click(screen.getByText("Adjustments"));
    set("input-overlap-val", 50);
    set("input-gap-val", 20);
    fireEvent.click(screen.getByText("Adjustments"));
    expect(document.querySelector(".pw-adj-summary").textContent).toBe(" +50 mm overlap · −20 mm gap");
  });

  it("shows centimetres beside the millimetres", () => {
    // The tape is in cm and the cut list is in mm; the page states both so
    // nobody divides by ten in their head at the wrong moment.
    render(<PipeWrapCalculator />);
    set("input-pipeDiam", 100);
    const expected = Math.PI * 100;
    expect(card().textContent).toContain(`${(expected / 10).toFixed(1)} cm`);
    expect(card().textContent).toContain(`${expected.toFixed(1)} mm`);
  });
});

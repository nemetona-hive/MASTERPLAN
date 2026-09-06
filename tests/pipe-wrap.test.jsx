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
    expect(totalMm()).toBe(0);
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

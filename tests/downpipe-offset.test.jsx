// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { GuiderToruPolv70 } from "../src/components/guider/ToruPolv70.jsx";
import {
  MESSAGES, chartRows, lengthFromOffset, offsetFromLength, solveOffset
} from "../src/utils/downpipe-offset.js";

/* The manufacturer chart's check values at α 70°, C 152. The source prompt
   listed 1232.7 for L 1150; the formula gives 1232.646…, so 1232.6 is right
   and the prompt's figure was a rounding slip. */
const REFERENCE = [[100, 246.0], [300, 433.9], [500, 621.8], [800, 903.8], [1000, 1091.7], [1150, 1232.6]];

describe("the downpipe offset formula", () => {
  it.each(REFERENCE)("L %d mm gives B %d mm and back", (L, B) => {
    expect(offsetFromLength(L)).toBeCloseTo(B, 1);
    expect(lengthFromOffset(offsetFromLength(L))).toBeCloseTo(L, 9);
  });

  it("refuses an offset shorter than the two elbows alone", () => {
    expect(solveOffset({ source: "B", value: 100, angle: 70, C: 152 }))
      .toMatchObject({ L: null, B: null, error: MESSAGES.tooShort });
  });

  it("answers outside the chart but says it is extrapolated", () => {
    const r = solveOffset({ source: "L", value: 1200, angle: 70, C: 152 });
    expect(r.B).toBeCloseTo(1279.6, 1);
    expect(r.warning).toBe(MESSAGES.extrapolated);
    expect(solveOffset({ source: "L", value: 500, angle: 70, C: 152 }).warning).toBeNull();
  });

  it("asks for a value rather than calculating from nothing", () => {
    expect(solveOffset({ source: "L", value: null, angle: 70, C: 152 }).error).toBe(MESSAGES.empty);
  });

  it("will not divide by sin 0", () => {
    expect(solveOffset({ source: "B", value: 500, angle: 0, C: 152 }).error).toBe(MESSAGES.params);
    expect(solveOffset({ source: "B", value: 500, angle: null, C: 152 }).error).toBe(MESSAGES.params);
  });

  it("tabulates L 100–1150 in 50 mm steps", () => {
    const rows = chartRows();
    expect(rows).toHaveLength(22);
    expect(rows[0].L).toBe(100);
    expect(rows.at(-1).L).toBe(1150);
  });
});

const field = id => document.getElementById(id);
const type = (id, value) => fireEvent.change(field(id), { target: { value: String(value) } });

describe("the Toru põlv 70° calculator", () => {
  it("fills B while L is being typed, without waiting for a commit", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-L", 500);
    expect(field("input-toru-B").value).toBe("621.8");
  });

  it("fills L from B the other way round", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-B", 621.8);
    expect(Number(field("input-toru-L").value)).toBeCloseTo(500, 0);
  });

  it("keeps a trailing decimal point the user is still typing", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-L", "500.");
    expect(field("input-toru-L").value).toBe("500.");
    expect(field("input-toru-B").value).toBe("621.8");
  });

  it("keeps the entered field fixed when α changes", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-L", 500);
    fireEvent.click(screen.getByText("Täpsemalt"));
    type("input-toru-angle", 60);
    expect(field("input-toru-L").value).toBe("500");
    expect(field("input-toru-B").value).toBe(String(Math.round((500 * Math.sin(Math.PI / 3) + 152) * 10) / 10));
    fireEvent.click(screen.getByText("Taasta tabeli väärtused"));
    expect(field("input-toru-B").value).toBe("621.8");
  });

  it("does not swap the fixed field when focus only passes through the other", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-L", 500);
    fireEvent.blur(field("input-toru-L"));
    fireEvent.blur(field("input-toru-B"));
    expect(screen.getByText("L sisestatud · B arvutatud")).toBeTruthy();
  });

  it("explains an impossible offset instead of showing a negative length", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-B", 100);
    expect(field("input-toru-L").value).toBe("");
    expect(screen.getByText(MESSAGES.tooShort)).toBeTruthy();
  });

  it("warns outside the manufacturer chart", () => {
    render(<GuiderToruPolv70 />);
    type("input-toru-L", 50);
    expect(screen.getByText(MESSAGES.extrapolated)).toBeTruthy();
  });

  it("prompts for a value before anything is entered", () => {
    render(<GuiderToruPolv70 />);
    expect(screen.getByText(MESSAGES.empty)).toBeTruthy();
  });
});

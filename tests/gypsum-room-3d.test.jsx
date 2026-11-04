// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { GypsumRoom3D, roomFaces } from "../src/components/GypsumRoom3D.jsx";
import { buildGypsumTakeOff } from "../src/utils/gypsum-take-off.js";

/* jsdom has no 3D: whether a panel is culled is `npm run layout`'s question.
   This checks which panels exist, where they are folded to, and the view's
   controls. */

const job = (over = {}) => buildGypsumTakeOff({
  mode: "room", lenMm: "4000", widMm: "3000", heightMm: "2600", wallW: "", wallH: "", ceiling: false,
  openings: [],
  sheetW: "1200", sheetL: "2600", orientation: "V", layers: "1", waste: "0",
  screwRate: "", compoundRate: "", bagKg: "", sheetPrice: "", product: "", ...over
});

describe("room faces", () => {
  it("folds four walls and a floor outline around the centre", () => {
    const t = job();
    const { faces, scale } = roomFaces(t.room, t.surfaces);
    // A back, then clockwise seen from above: B right, C front, D left.
    expect(faces.map(f => f.id)).toEqual(["back", "right", "front", "left", "floor"]);
    expect(faces.map(f => f.tag)).toEqual(["A", "B", "C", "D", null]);
    const back = faces.find(f => f.id === "back");
    expect(back.w).toBeCloseTo(4000 * scale, 6);
    expect(back.transform).toBe(`translateZ(${-1500 * scale}px)`);
    // Width walls are drawn from the width-wall layout.
    expect(faces.find(f => f.id === "left").surface.id).toBe("wall-bd");
  });

  it("adds the ceiling only when it is boarded, lifted clear of the walls", () => {
    expect(roomFaces(job().room, job().surfaces).faces.map(f => f.id)).not.toContain("ceiling");
    const t = job({ ceiling: true });
    const { faces, scale } = roomFaces(t.room, t.surfaces);
    const ceiling = faces.find(f => f.id === "ceiling");
    // Wall tops are at 1300 mm above centre; the lid floats 0.55 × 2600 above that.
    // Read the numbers back out: 2600 × 0.55 is not exactly 1430 in binary.
    const [shift, depth] = ceiling.transform.match(/-?[\d.e-]+(?=px)/g).map(Number);
    expect(ceiling.transform).toMatch(/^translateY\(.*\) rotateX\(-90deg\) translateZ\(/);
    expect(depth).toBeCloseTo(-(1300 + 1430) * scale, 6);
    // …and the drawing is re-centred on room plus lid.
    expect(shift).toBeCloseTo(715 * scale, 6);
  });

  it("gives a wall with a door its own drawing", () => {
    const t = job({ openings: [{ kind: "door", wall: "C", x: "500", w: "900", h: "2100" }] });
    const { faces } = roomFaces(t.room, t.surfaces);
    expect(faces.find(f => f.tag === "C").surface.openings).toHaveLength(1);
    expect(faces.find(f => f.tag === "A").surface.openings).toHaveLength(0);
  });

  it("is a single panel for one wall", () => {
    const t = job({ mode: "wall", wallW: "2400", wallH: "2600" });
    expect(roomFaces(t.room, t.surfaces).faces.map(f => f.id)).toEqual(["wall"]);
  });

  it("fits any room to the same stage", () => {
    const small = job(), big = job({ lenMm: "12000", widMm: "9000", heightMm: "7800" });
    const a = roomFaces(small.room, small.surfaces), b = roomFaces(big.room, big.surfaces);
    expect(a.faces[0].w).toBeCloseTo(b.faces[0].w, 6);
  });

  it("draws nothing without a room", () => {
    expect(roomFaces(null, []).faces).toEqual([]);
  });
});

describe("the 3D view", () => {
  it("draws every piece of every panel", () => {
    const t = job();
    render(<GypsumRoom3D room={t.room} surfaces={t.surfaces} />);
    const expected = roomFaces(t.room, t.surfaces).faces
      .reduce((n, f) => n + (f.surface ? f.surface.layout.pieces.length : 0), 0);
    expect(document.querySelectorAll(".gyp3d-face rect")).toHaveLength(expected);
  });

  it("turns with the arrow keys and resets", () => {
    const t = job();
    render(<GypsumRoom3D room={t.room} surfaces={t.surfaces} />);
    const scene = document.querySelector(".gyp3d-scene");
    const start = scene.style.transform;
    fireEvent.keyDown(document.querySelector(".gyp3d-stage"), { key: "ArrowRight" });
    expect(scene.style.transform).not.toBe(start);
    fireEvent.click(screen.getByText("Reset"));
    expect(scene.style.transform).toBe(start);
  });

  it("marks the view chosen", () => {
    const t = job();
    render(<GypsumRoom3D room={t.room} surfaces={t.surfaces} />);
    fireEvent.click(screen.getByText("Level"));
    expect(screen.getByText("Level").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Above").getAttribute("aria-pressed")).toBe("false");
  });
});

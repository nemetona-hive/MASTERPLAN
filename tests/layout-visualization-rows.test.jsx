// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { LayoutVisualization } from "../src/Visualization.jsx";
import { layoutSurface } from "../src/utils/gypsum-take-off.js";

/* The row checkboxes `onRowToggle` puts along a drawing's edge. jsdom has no
   layout, but the positions are SVG attributes worked out from the drawing's
   own units, so whether two pairs overlap can be read straight off them. */
const drawn = layout => ({ ...layout, stats: { full: layout.full, cut: layout.cut } });
const spans = (axis, size) => [...document.querySelectorAll(".layout-svg-row-hit")]
  .map(r => [Number(r.getAttribute(axis)), Number(r.getAttribute(axis)) + Number(r.getAttribute(size))])
  .sort((a, b) => a[0] - b[0]);

describe("row checkboxes", () => {
  it("keeps a narrow last column's pair clear of the one before it", () => {
    // 250 columns with a 30 last one, far narrower than its label: kept inside
    // the drawing, the last pair used to sit against the one before it. (jsdom
    // cannot measure screen pixels, so labels take their drawing-unit size;
    // narrow columns make that crowd the way 15 px does on a 5130 wall.)
    const layout = layoutSurface({ w: 1030, h: 2600, sheetW: 250, sheetL: 2600, orientation: "V" });
    render(<LayoutVisualization result={drawn(layout)} rowStart={layout.meta.rowStart} onRowToggle={() => {}} />);
    const pairs = spans("x", "width");
    expect(pairs).toHaveLength(5);
    // At least a label's height between pairs, not merely no overlap.
    const fs = Number(document.querySelector(".layout-svg-row-toggle text").getAttribute("font-size"));
    for (let i = 1; i < pairs.length; i++) expect(pairs[i][0] - pairs[i - 1][1]).toBeGreaterThanOrEqual(fs * 0.6);
    const width = Number(document.querySelector(".viz-svg").getAttribute("viewBox").split(" ")[2]);
    expect(pairs[pairs.length - 1][1]).toBeLessThanOrEqual(width);
    expect(pairs[0][0]).toBeGreaterThanOrEqual(0);
  });

  it("keeps a thin edge row's pair inside the drawing and clear of the next", () => {
    // 2600 high in 1250 rows: a 100 strip on top.
    const layout = layoutSurface({ w: 5800, h: 2600, sheetW: 1250, sheetL: 2500, orientation: "H" });
    render(<LayoutVisualization result={drawn(layout)} rowStart={layout.meta.rowStart} onRowToggle={() => {}} />);
    const pairs = spans("y", "height");
    for (let i = 1; i < pairs.length; i++) expect(pairs[i][0]).toBeGreaterThan(pairs[i - 1][1]);
    expect(pairs[0][0]).toBeGreaterThanOrEqual(0);
  });
});

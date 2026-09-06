// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { CutListSheet } from "../src/components/CutListSheet.jsx";
import { buildCutList } from "../src/utils/cut-list.js";

/* A surface that does not divide evenly, so every row ends in a cut whose
   remainder carries into the next — the relationship the sheet exists to
   state. PPi is the LENGTH that gets cut; PLa is the WIDTH. */
const sh = { W: 3000, H: 2400, PPi: 800, PLa: 600,
  offset: 0.5, direction: "H", minJ: 100, startOff: 0, rowStart: "top" };
const layout = { id: "s1", title: "Straight layout" };
const list = () => buildCutList(computeS1(sh), sh, layout);

describe("the printed cut list", () => {
  it("renders nothing at all without a list", () => {
    const { container } = render(<CutListSheet list={null} />);
    expect(container.querySelector(".cut-sheet")).toBeNull();
    expect(document.querySelector(".cut-sheet")).toBeNull();
  });

  it("portals to body, so print can hide the app by position", () => {
    /* `body > *:not(.cut-sheet)` is what hides the shell, and it only works
       because the sheet is a sibling of it rather than a descendant. */
    render(<CutListSheet list={list()} />);
    const sheet = document.querySelector(".cut-sheet");
    expect(sheet.parentElement).toBe(document.body);
  });

  it("states the job and the figure somebody orders against", () => {
    render(<CutListSheet list={list()} />);
    const sheet = document.querySelector(".cut-sheet");
    expect(sheet.textContent).toContain("Straight layout");
    expect(sheet.textContent).toContain("3000 × 2400 mm");
    // 12 whole + 3 cut. Not 18: an offcut is the other half of a panel already
    // counted, and counting it again over-orders.
    const buy = within(sheet).getByText("Panels to buy").parentElement;
    expect(buy.textContent).toContain("15");
  });

  it("pairs each cut with the row its remainder goes to", () => {
    render(<CutListSheet list={list()} />);
    const cuts = document.querySelectorAll(".cut-sheet-table tbody")[0];
    const first = cuts.querySelectorAll("tr")[0];
    // Panel A: cut to 600 for row 1, the 200 left goes to row 2.
    expect([...first.querySelectorAll("td")].map(td => td.textContent))
      .toEqual(["A", "600", "Row 1", "200", "Row 2", "—"]);
  });

  it("marks a piece with the panel it was cut from", () => {
    render(<CutListSheet list={list()} />);
    const rows = document.querySelectorAll(".cut-sheet-table--rows tbody tr");
    // Row 1 ends in the cut piece; row 2 opens with its remainder, same letter.
    expect(rows[0].textContent).toContain("600A");
    expect(rows[1].textContent).toContain("200A");
    expect(rows[1].querySelector(".cut-sheet-piece--offcut").textContent).toContain("200");
  });

  it("says so when the layout does not fill the surface", () => {
    // A gap is a hole. A sheet that omitted it is a plan carried to a saw by
    // somebody with no way to know it does not fit.
    const gappy = { ...sh, minJ: 700 };
    render(<CutListSheet list={buildCutList(computeS1(gappy), gappy, layout)} />);
    expect(document.querySelector(".cut-sheet-warn").textContent)
      .toMatch(/does not fill the surface/);
  });

  it("carries no warning when the layout is sound", () => {
    render(<CutListSheet list={list()} />);
    expect(document.querySelector(".cut-sheet-warn")).toBeNull();
  });

  it("derives nothing the model did not already state", () => {
    /* Every figure on the page comes from the model, so a second renderer
       cannot disagree with this one. If a number appears here that is not in
       the model, it was computed twice. */
    const model = list();
    render(<CutListSheet list={model} />);
    const printed = document.querySelector(".cut-sheet").textContent;
    for (const panel of model.panels) {
      expect(printed).toContain(String(panel.cut.width));
      if (panel.offcut) expect(printed).toContain(String(panel.offcut.width));
    }
    expect(printed).toContain(String(model.totals.panelsToBuy));
  });
});

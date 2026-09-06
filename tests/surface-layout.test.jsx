// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetSurfaceLayout } from "../src/components/SurfaceLayout.jsx";
import { LayoutPanel } from "../src/Visualization.jsx";

/* The page's state lives in App, so the harness owns it the way App does —
   which is what makes the per-direction save answerable at all. DEFAULT_SH
   arrives as a global from config.js, published by tests/setup.js. */
function Page({ over = {} }) {
  const [sh, setSh] = React.useState({ ...DEFAULT_SH, ...over });
  const [panelOpen, setPanelOpen] = React.useState({ s1: false, s2: false, s3: false, s4: false });
  return <SheetSurfaceLayout sh={sh} setSh={setSh} panelOpen={panelOpen} setPanelOpen={setPanelOpen} />;
}

const dirButton = which => within(document.getElementById("ctrl-direction")).getByText(which);
const openSettings = () => {
  // The Settings panel starts open; this is here so a change to that default
  // does not silently turn every assertion below into a no-op.
  if (!document.getElementById("ctrl-direction")) {
    fireEvent.click(screen.getByText("Settings"));
  }
  expect(document.getElementById("ctrl-direction")).toBeTruthy();
};
const orderButtons = () => [...document.querySelectorAll(".ctrl-dir")]
  .filter(b => /^R1 /.test(b.textContent));
const activeOrder = () => orderButtons().find(b => b.className.includes("on"))?.textContent.trim();

describe("the surface layout page", () => {
  describe("switching direction", () => {
    it("changes which axis the pattern runs along", () => {
      render(<Page over={{ direction: "H" }} />);
      openSettings();
      expect(dirButton("H").className).toContain("on");

      fireEvent.click(dirButton("V"));
      expect(dirButton("V").className).toContain("on");
      expect(dirButton("H").className).not.toContain("on");
    });

    it("keeps each direction's row order, and hands it back on return", () => {
      /* The switch saves the order you were using under the direction you are
         leaving, and restores the one belonging to the direction you arrive
         at. Without that, setting H to bottom and flipping to V and back gives
         you V's default — silently re-laying a pattern somebody had set. */
      render(<Page over={{ direction: "H", rowStart: "top" }} />);
      openSettings();

      // Give H an order that is not its default.
      fireEvent.click(orderButtons().find(b => /bottom/.test(b.textContent)));
      const inH = activeOrder();
      expect(inH).toMatch(/bottom/);

      fireEvent.click(dirButton("V"));
      // V has its own, and it is not the one just set on H.
      const inV = activeOrder();
      expect(inV).not.toBe(inH);

      fireEvent.click(dirButton("H"));
      expect(activeOrder()).toBe(inH);
    });

    it("labels the order by what it means in that direction", () => {
      // "R1 top" and "R1 Left" are the same control saying the right thing:
      // rows run down in H and columns run across in V.
      render(<Page over={{ direction: "H" }} />);
      openSettings();
      expect(orderButtons().map(b => b.textContent).join(" ")).toMatch(/top/);

      fireEvent.click(dirButton("V"));
      expect(orderButtons().map(b => b.textContent).join(" ")).toMatch(/Left/);
    });
  });

  describe("collapsing the settings panel", () => {
    it("hides its controls and brings them back", () => {
      render(<Page />);
      openSettings();
      fireEvent.click(screen.getByText("Settings"));
      expect(document.getElementById("ctrl-direction")).toBeNull();

      fireEvent.click(screen.getByText("Settings"));
      expect(document.getElementById("ctrl-direction")).toBeTruthy();
    });

    it("does not lose what was set while it was shut", () => {
      render(<Page over={{ direction: "H" }} />);
      openSettings();
      fireEvent.click(dirButton("V"));
      fireEvent.click(screen.getByText("Settings"));
      fireEvent.click(screen.getByText("Settings"));
      expect(dirButton("V").className).toContain("on");
    });
  });
});

describe("a layout panel's open state", () => {
  const layout = { id: "s1", title: "Straight layout", icon: null, description: "" };
  const result = () => computeS1({ ...DEFAULT_SH, direction: "H" });

  it("keeps its own when nothing is passed", () => {
    // Uncontrolled: `open` seeds the first render and nothing more.
    render(<LayoutPanel layout={{ ...layout, defaultOpen: false }} result={result()}
      hoveredType={null} setHoveredType={() => {}} />);
    expect(document.querySelector(".panel-body")).toBeNull();

    fireEvent.click(document.querySelector(".sys-head"));
    expect(document.querySelector(".panel-body")).toBeTruthy();
  });

  it("obeys the caller when both open and setOpen are passed", () => {
    const seen = [];
    const { rerender } = render(
      <LayoutPanel layout={layout} result={result()} hoveredType={null} setHoveredType={() => {}}
        open={false} setOpen={v => seen.push(v)} />);
    expect(document.querySelector(".panel-body")).toBeNull();

    fireEvent.click(document.querySelector(".sys-head"));
    // It asks rather than deciding: still shut until the caller says otherwise.
    expect(seen).toEqual([true]);
    expect(document.querySelector(".panel-body")).toBeNull();

    rerender(<LayoutPanel layout={layout} result={result()} hoveredType={null} setHoveredType={() => {}}
      open={true} setOpen={v => seen.push(v)} />);
    expect(document.querySelector(".panel-body")).toBeTruthy();
  });

  it("stays open and unclickable when it cannot be toggled", () => {
    render(<LayoutPanel layout={layout} result={result()} hoveredType={null}
      setHoveredType={() => {}} noToggle />);
    expect(document.querySelector(".panel-body")).toBeTruthy();
    expect(document.querySelector(".sys-head-toggle")).toBeNull();

    fireEvent.click(document.querySelector(".sys-head"));
    expect(document.querySelector(".panel-body")).toBeTruthy();
  });
});

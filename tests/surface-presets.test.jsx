// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, fireEvent, screen, within, cleanup } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetSurfaceLayout } from "../src/components/SurfaceLayout.jsx";
import { DraftStore, SessionDraftContext } from "../src/utils/session-state.js";
import { pageOfDraft } from "../src/utils/project-pages.js";

/* Pattern Layouts' two preset libraries, on the shared preset system. config.js
   is rewritten by Save Defaults, so these tests pin their own lists. */
const MATERIALS = [
  { name: "OSB 1250×2500", width: 1250, length: 2500 },
  { name: "", width: 600, length: 300 },
  { name: "Plaat 600×300", width: 600, length: 300 }
];
const saved = {};
beforeAll(() => { saved.m = globalThis.DEFAULT_MATERIAL_PRESETS; globalThis.DEFAULT_MATERIAL_PRESETS = MATERIALS; });
afterAll(() => { globalThis.DEFAULT_MATERIAL_PRESETS = saved.m; });

function Page() {
  const [sh, setSh] = React.useState({ ...DEFAULT_SH });
  const [panelOpen, setPanelOpen] = React.useState({ s1: false, s2: false, s3: false, s4: false });
  return <SheetSurfaceLayout sh={sh} setSh={setSh} panelOpen={panelOpen} setPanelOpen={setPanelOpen} />;
}
const material = () => document.getElementById("control-material");
const openList = () => fireEvent.click(within(material()).getAllByTitle("Presets")[0]);

describe("pattern layout presets", () => {
  it("says why a preset was refused under its own card, and in the dialog it came from", () => {
    render(<Page />);
    fireEvent.click(screen.getByLabelText("Manage material presets"));
    fireEvent.change(document.getElementById("mat-preset-width-0"), { target: { value: "50" } });
    fireEvent.click(screen.getAllByTitle("Apply these values to the calculator")[0]);
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain("between 100 and 8000 mm");
    fireEvent.click(screen.getByLabelText("Close"));
    const alert = screen.getByRole("alert");
    expect(alert.previousElementSibling).toBe(material());
    expect(alert.closest("#data-control")).toBeTruthy();
  });

  it("keeps an edited preset list with the page's values", () => {
    const drafts = new DraftStore();
    const ui = () => <SessionDraftContext.Provider value={drafts}><Page /></SessionDraftContext.Provider>;
    render(ui());
    fireEvent.click(screen.getByLabelText("Manage material presets"));
    fireEvent.change(document.getElementById("mat-preset-name-0"), { target: { value: "Renamed OSB" } });
    expect(pageOfDraft("SurfaceLayout.jsx:materialPresets")).toBe("pattern-layout");
    cleanup();
    render(ui());
    fireEvent.click(screen.getByLabelText("Manage material presets"));
    expect(document.getElementById("mat-preset-name-0").value).toBe("Renamed OSB");
  });

  it("marks the applied preset in the list even after an unnamed one", () => {
    render(<Page />);
    openList();
    fireEvent.pointerDown(screen.getByText("Plaat 600×300"));
    openList();
    const active = document.querySelector(".rate-preset-item.active");
    expect(active.textContent).toContain("Plaat 600×300");
  });
});

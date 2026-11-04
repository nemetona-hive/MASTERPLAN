// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetSymmetricLayout } from "../src/components/SymmetricLayout.jsx";
import { DraftStore, SessionDraftContext } from "../src/utils/session-state.js";

/* Axial Alignment's two preset lists, on the shared preset system. config.js
   is rewritten by Save Defaults, so these tests pin their own lists. */
const MATERIALS = [
  { name: "OSB 1250×2500", width: 1250, length: 2500 },
  { name: "No width yet", width: "", length: 300 }
];
const SURFACES = [{ name: "Hall", width: 5000, length: 3000 }];
const saved = {};
beforeAll(() => {
  saved.m = globalThis.DEFAULT_MATERIAL_PRESETS; saved.s = globalThis.DEFAULT_SURFACE_PRESETS;
  globalThis.DEFAULT_MATERIAL_PRESETS = MATERIALS; globalThis.DEFAULT_SURFACE_PRESETS = SURFACES;
});
afterAll(() => { globalThis.DEFAULT_MATERIAL_PRESETS = saved.m; globalThis.DEFAULT_SURFACE_PRESETS = saved.s; });

function Page() { const [sym, setSym] = React.useState({ ...DEFAULT_SYM }); return <SheetSymmetricLayout sym={sym} setSym={setSym} />; }
const field = id => document.getElementById(id);
const openList = id => fireEvent.click(field(id).closest(".preset-field").querySelector("[title='Presets']"));
const marked = id => { openList(id); const t = document.querySelector(".rate-preset-item.active")?.textContent || null; openList(id); return t; };
const named = () => [...document.querySelectorAll("#control-sym-surface .panel-preset-meta")].map(e => e.textContent);

describe("axial alignment presets", () => {
  it("keeps a product preset named after its field is left", () => {
    render(<Page />);
    field("input-sym-panel-width").focus();
    openList("input-sym-panel-width");
    fireEvent.pointerDown(screen.getByText("OSB 1250×2500"));
    fireEvent.blur(field("input-sym-panel-width"));
    expect(marked("input-sym-panel-width")).toContain("OSB 1250×2500");
    expect(named().join(" ")).toContain("OSB");
  });

  it("stops naming an input preset once its width is typed over", () => {
    render(<Page />);
    openList("input-sym-room-width");
    fireEvent.pointerDown(screen.getByText("Hall"));
    expect(named().join(" ")).toContain("Hall");
    fireEvent.change(field("input-sym-room-width"), { target: { value: "3333" } });
    fireEvent.blur(field("input-sym-room-width"));
    expect(marked("input-sym-room-width")).toBe(null);
    expect(named()).toEqual([]);
  });

  it("refuses a preset with no width rather than emptying the field", () => {
    render(<Page />);
    fireEvent.change(field("input-sym-panel-width"), { target: { value: "600" } });
    fireEvent.blur(field("input-sym-panel-width"));
    openList("input-sym-panel-width");
    fireEvent.pointerDown(screen.getByText("No width yet"));
    expect(screen.getByRole("alert").textContent).toContain("between 100 and 8000 mm");
    expect(field("input-sym-panel-width").value).toBe("600");
  });

  it("keeps the applied preset with the page's values, but not the list", () => {
    const drafts = new DraftStore();
    const ui = () => <SessionDraftContext.Provider value={drafts}><Page /></SessionDraftContext.Provider>;
    render(ui());
    openList("input-sym-room-width");
    fireEvent.pointerDown(screen.getByText("Hall"));
    expect(drafts.get("SymmetricLayout.jsx:activeArea")).toBe(0);
    expect([...drafts.keys()].filter(k => /presets/i.test(String(k)))).toEqual([]);
    cleanup();
  });
});

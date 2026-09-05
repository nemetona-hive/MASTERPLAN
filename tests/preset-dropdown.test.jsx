// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { SheetSymmetricLayout } from "../src/components/SymmetricLayout.jsx";
import { SheetSurfaceLayout } from "../src/components/SurfaceLayout.jsx";

/*
 * The presets list, opened from a page rather than from the primitive.
 *
 * NumInput's own toggle is covered in primitives.test.jsx. What can only be
 * checked here is the wiring: the page owns whether the list is open, and it
 * used to set that from the field's focus — which is the behaviour this test
 * exists to keep gone. SymmetricLayout is the smallest of the three pages that
 * carry a list; the other two are wired the same way.
 *
 * DEFAULT_MATERIAL_PRESETS and computeS0 arrive as globals from config.js and
 * simulation.js, published by tests/setup.js.
 */

function SurfaceHarness() {
  const [sh, setSh] = React.useState({ ...DEFAULT_SH });
  const [panelOpen, setPanelOpen] = React.useState(true);
  return <SheetSurfaceLayout
    sh={sh}
    setSh={update => setSh(current => (typeof update === "function" ? update(current) : update))}
    panelOpen={panelOpen}
    setPanelOpen={setPanelOpen} />;
}

function Harness() {
  const [sym, setSym] = React.useState({ ...DEFAULT_SYM });
  return <SheetSymmetricLayout sym={sym} setSym={update => setSym(current => (
    typeof update === "function" ? update(current) : update
  ))} />;
}

const firstPreset = DEFAULT_MATERIAL_PRESETS.filter(p => p.name)[0];

describe("material presets on the symmetric layout page", () => {
  it("stays shut when the field is clicked and typed into", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Show presets"));
    await user.click(screen.getByTitle("Presets"));   // shut again
    expect(screen.queryByText("Material Presets")).toBeNull();

    const field = document.getElementById("input-sym-panel-width");
    await user.click(field);
    await user.type(field, "450");
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("opens on the toggle and closes on it again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTitle("Presets"));
    expect(screen.getByText("Material Presets")).toBeInTheDocument();
    expect(screen.getByText(firstPreset.name)).toBeInTheDocument();

    await user.click(screen.getByTitle("Presets"));
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("applies the preset that is chosen, and shuts", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTitle("Presets"));
    await user.click(screen.getByText(firstPreset.name));

    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(firstPreset.width));
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("can be walked with the keyboard, because the field keeps focus", async () => {
    // The toggle hands focus back to the input, where the arrow/Enter handling
    // for the open list lives.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTitle("Presets"));
    expect(document.activeElement).toBe(document.getElementById("input-sym-panel-width"));

    await user.keyboard("{ArrowDown}{Enter}");
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(firstPreset.width));
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("shuts on Escape without changing the value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTitle("Presets"));
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Material Presets")).toBeNull();
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(DEFAULT_SYM.panelWidth));
  });
});

/*
 * Surface Layout carries two of these fields — width and length — over one
 * piece of "which list is open" state, and that is the page where the order of
 * focus and toggle inside the button shows.
 */
describe("material presets on the surface layout page", () => {
  it("opens another field's list from one click while a field is active", async () => {
    /* The bug: the toggle set the state and then moved focus, so the field
       being left committed on blur, its page closed the list from there, and
       the close landed on the list that had just been opened. It took two
       clicks to open a list that had looked one click away. */
    const user = userEvent.setup();
    render(<SurfaceHarness />);
    const [widthToggle, lengthToggle] = screen.getAllByTitle("Presets");

    await user.click(document.getElementById("input-PLa"));   // the width cell is active
    await user.click(lengthToggle);
    expect(screen.getByText("Material Presets")).toBeInTheDocument();
    expect(lengthToggle).toHaveAttribute("aria-expanded", "true");
    expect(widthToggle).toHaveAttribute("aria-expanded", "false");
  });

  it("moves an open list to the other field in one click", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);
    const [widthToggle, lengthToggle] = screen.getAllByTitle("Presets");

    await user.click(widthToggle);
    expect(widthToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(lengthToggle);
    expect(lengthToggle).toHaveAttribute("aria-expanded", "true");
    expect(widthToggle).toHaveAttribute("aria-expanded", "false");
    // One list, not two — the state they share says which.
    expect(screen.getAllByText("Material Presets")).toHaveLength(1);
  });

  it("still shuts from its own toggle", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);
    const [widthToggle] = screen.getAllByTitle("Presets");

    await user.click(widthToggle);
    await user.click(widthToggle);
    expect(screen.queryByText("Material Presets")).toBeNull();
  });
});

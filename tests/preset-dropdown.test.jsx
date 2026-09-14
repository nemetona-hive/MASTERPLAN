// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
const firstSurfacePreset = DEFAULT_SURFACE_PRESETS.filter(p => p.name)[0];

describe("material presets on the symmetric layout page", () => {
  it("starts with empty measurements and a guided preview", () => {
    render(<Harness />);
    expect(document.getElementById("input-sym-room-width")).toHaveDisplayValue("");
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue("");
    expect(screen.getByText("Build your layout preview")).toBeInTheDocument();
    expect(document.querySelector(".sys-block")).toBeNull();
    expect(document.querySelectorAll(".layout-empty-axial .layout-empty-tile")).toHaveLength(14);
  });

  it("stays shut when the field is clicked and typed into", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const productToggle = screen.getAllByTitle("Presets")[1];
    await user.click(productToggle);
    await user.click(productToggle);   // shut again
    expect(screen.queryByText("Material Presets")).toBeNull();

    const field = document.getElementById("input-sym-panel-width");
    await user.click(field);
    await user.type(field, "450");
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("opens on the toggle and closes on it again", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByTitle("Presets")[1]);
    expect(screen.getByText("Material Presets")).toBeInTheDocument();
    expect(screen.getByText(firstPreset.name)).toBeInTheDocument();

    await user.click(screen.getAllByTitle("Presets")[1]);
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("applies the preset that is chosen, and shuts", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByTitle("Presets")[1]);
    await user.click(screen.getByText(firstPreset.name));

    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(firstPreset.width));
    expect(screen.queryByText("Material Presets")).toBeNull();
    expect(screen.getByText("Now enter the area width.")).toBeInTheDocument();
  });

  it("can be walked with the keyboard, because the field keeps focus", async () => {
    // The toggle hands focus back to the input, where the arrow/Enter handling
    // for the open list lives.
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByTitle("Presets")[1]);
    const field = document.getElementById("input-sym-panel-width");
    expect(document.activeElement).toBe(field);
    expect(field).toHaveAttribute("role", "combobox");
    expect(field).toHaveAttribute("aria-controls", "input-sym-panel-width-presets");

    await user.keyboard("{ArrowDown}");
    expect(field).toHaveAttribute("aria-activedescendant", "input-sym-panel-width-preset-0");
    expect(document.getElementById("input-sym-panel-width-preset-0")).toHaveAttribute("role", "option");
    await user.keyboard("{Enter}");
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(firstPreset.width));
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("shuts on Escape without changing the value", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByTitle("Presets")[1]);
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Material Presets")).toBeNull();
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue(String(DEFAULT_SYM.panelWidth));
  });

  it("applies only the width from an input preset to area width", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByTitle("Presets")[0]);
    expect(screen.getByText("Input Presets")).toBeInTheDocument();
    await user.click(screen.getByText(firstSurfacePreset.name));

    expect(document.getElementById("input-sym-room-width"))
      .toHaveDisplayValue(String(firstSurfacePreset.width));
    expect(document.getElementById("input-sym-panel-width")).toHaveDisplayValue("");
    expect(screen.queryByText("Input Presets")).toBeNull();
  });
});

/*
 * Surface Layout carries two of these fields — width and length — over one
 * piece of "which list is open" state, and that is the page where the order of
 * focus and toggle inside the button shows.
 */
describe("material presets on the surface layout page", () => {
  it("applies a preset from a touch pointer", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);

    await user.click(screen.getAllByTitle("Presets")[0]);
    fireEvent.pointerDown(screen.getByText(firstPreset.name), { pointerType: "touch" });

    expect(document.getElementById("input-PLa")).toHaveDisplayValue(String(firstPreset.width));
    expect(document.getElementById("input-PPi")).toHaveDisplayValue(String(firstPreset.length));
    expect(screen.queryByText("Material Presets")).toBeNull();
  });

  it("fills the material cells but waits for the surface before rendering", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);

    await user.click(screen.getAllByTitle("Presets")[0]);
    await user.click(screen.getByText(firstPreset.name));

    expect(document.getElementById("input-PLa")).toHaveDisplayValue(String(firstPreset.width));
    expect(document.getElementById("input-PPi")).toHaveDisplayValue(String(firstPreset.length));
    const materialPanel = document.getElementById("control-material");
    expect(within(materialPanel).getByText("Preset")).toBeInTheDocument();
    expect(materialPanel.querySelector(".panel-preset-meta-value"))
      .toHaveTextContent(`${firstPreset.width} × ${firstPreset.length} mm`);

    await user.click(screen.getByText("Pattern Layouts"));
    expect(materialPanel.querySelector(".panel-preset-meta-value"))
      .toHaveTextContent(`${firstPreset.width} × ${firstPreset.length} mm`);
    expect(screen.getByText("Choose an input preset or enter the surface width and length.")).toBeInTheDocument();
    expect(document.querySelector(".sys-block")).toBeNull();
  });

  it("loads a saved configuration from the Inputs panel", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);
    const surfacePreset = DEFAULT_SURFACE_PRESETS[0];

    await user.click(screen.getAllByTitle("Presets")[0]);
    await user.click(screen.getByText(firstPreset.name));
    await user.click(screen.getAllByTitle("Presets")[2]);
    expect(screen.getByText("Input Presets")).toBeInTheDocument();
    await user.click(screen.getByText(surfacePreset.name));

    expect(document.getElementById("input-W")).toHaveDisplayValue(String(surfacePreset.width));
    expect(document.getElementById("input-H")).toHaveDisplayValue(String(surfacePreset.length));
    const inputsPanel = document.getElementById("control-surface");
    expect(within(inputsPanel).getByText("Preset")).toBeInTheDocument();
    expect(inputsPanel.querySelector(".panel-preset-meta-value"))
      .toHaveTextContent(`${surfacePreset.name} · ${surfacePreset.width} × ${surfacePreset.length} mm`);

    await user.click(screen.getByText("Pattern Layouts"));
    expect(inputsPanel.querySelector(".panel-preset-meta-value"))
      .toHaveTextContent(`${surfacePreset.name} · ${surfacePreset.width} × ${surfacePreset.length} mm`);
    expect(document.querySelectorAll(".sys-block")).toHaveLength(4);
  });

  it("clears the selected preset title when an input is edited", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);
    const surfacePreset = DEFAULT_SURFACE_PRESETS[0];
    const inputsPanel = document.getElementById("control-surface");

    await user.click(within(inputsPanel).getAllByTitle("Presets")[0]);
    await user.click(screen.getByText(surfacePreset.name));
    expect(within(inputsPanel).getByText(surfacePreset.name)).toBeInTheDocument();

    const width = document.getElementById("input-W");
    await user.click(width);
    await user.clear(width);
    await user.type(width, "5100{Enter}");
    expect(within(inputsPanel).queryByText("Preset")).toBeNull();
    expect(within(inputsPanel).queryByText(surfacePreset.name)).toBeNull();
  });

  it("opens a separate manager for Inputs presets", async () => {
    const user = userEvent.setup();
    render(<SurfaceHarness />);

    await user.click(within(document.getElementById("control-surface")).getByRole("button", { name: "Manage Presets" }));
    expect(screen.getByRole("dialog", { name: "Manage Input Presets" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(DEFAULT_SURFACE_PRESETS[0].name)).toBeInTheDocument();
  });

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

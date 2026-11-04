// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetConcrete } from "../src/components/Concrete.jsx";

/* Concrete's product presets, on the shared preset system (PresetLibrary.jsx).
   config.js is rewritten by Save Defaults with whatever the user keeps, so
   these tests pin their own list. */
const FIXTURE = [
  { name: "weber S-100", rate: 2, bagKg: 25, bagPrice: 4 },
  { name: "weberfloor 200 RAPID", rate: 1.7, bagKg: 20, bagPrice: 15 },
  { name: "Half filled", rate: "", bagKg: 25, bagPrice: "" }
];
let saved;
beforeAll(() => { saved = globalThis.DEFAULT_CONCRETE_PRESETS; globalThis.DEFAULT_CONCRETE_PRESETS = FIXTURE; });
afterAll(() => { globalThis.DEFAULT_CONCRETE_PRESETS = saved; });

const value = id => document.getElementById(id).value;
const named = () => document.querySelector(".panel-preset-meta")?.textContent || "";
const pick = name => {
  fireEvent.click(screen.getByTitle("Presets"));
  fireEvent.pointerDown(screen.getByText(name));
};

describe("concrete presets", () => {
  it("fills consumption, bag and price from the list, and names the product above the section", () => {
    render(<SheetConcrete />);
    pick("weberfloor 200 RAPID");
    expect(value("input-slf-rate")).toBe("1.7");
    expect(value("input-slf-bagkg")).toBe("20");
    expect(value("input-slf-bagprice")).toBe("15");
    expect(named()).toContain("weberfloor 200 RAPID");
    expect(named()).toContain("1.7 kg/m²·mm · 20 kg bag");
  });

  it("stops naming the product once a value is edited by hand", () => {
    render(<SheetConcrete />);
    pick("weber S-100");
    fireEvent.change(document.getElementById("input-slf-bagkg"), { target: { value: "30" } });
    fireEvent.blur(document.getElementById("input-slf-bagkg"));
    expect(named()).toBe("");
  });

  it("says what is missing rather than applying half a preset", () => {
    render(<SheetConcrete />);
    pick("Half filled");
    expect(screen.getByRole("alert").textContent).toContain("consumption rate and bag weight");
    expect(value("input-slf-rate")).toBe("");
  });

  it("manages the list in a dialog, where Save Defaults can write", () => {
    render(<SheetConcrete />);
    fireEvent.click(screen.getByLabelText("Manage product presets"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Manage Product Presets");
    expect(dialog.querySelectorAll(".pw-preset-row")).toHaveLength(3);
    fireEvent.change(document.getElementById("preset-rate-1"), { target: { value: "1,8" } });
    fireEvent.click(screen.getAllByTitle("Apply these values to the calculator")[1]);
    expect(value("input-slf-rate")).toBe("1.8");
  });

  it("puts the applied product on the printed take-off", () => {
    render(<SheetConcrete />);
    fireEvent.change(document.getElementById("input-slf-area"), { target: { value: "20" } });
    fireEvent.blur(document.getElementById("input-slf-area"));
    fireEvent.change(document.getElementById("input-slf-havg"), { target: { value: "10" } });
    fireEvent.blur(document.getElementById("input-slf-havg"));
    pick("weber S-100");
    fireEvent.click(screen.getByText("Take-off"));
    expect(document.querySelector(".doc-sheet").textContent).toContain("weber S-100");
  });
});

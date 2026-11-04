// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetGypsum } from "../src/components/Gypsum.jsx";

/* The page's wiring: modes, presets, the diagram and the result card. The
   arithmetic is `tests/gypsum-take-off.test.js`. */

const type = (id, value) => {
  const el = document.getElementById(id);
  fireEvent.change(el, { target: { value: String(value) } });
  fireEvent.blur(el);
};
const sheetsNeeded = () => document.querySelector(".result-card-value").textContent.replace(/\D+/g, "");

const fillRoom = () => {
  type("input-gyp-lenMm", 4000);
  type("input-gyp-widMm", 3000);
  type("input-gyp-heightMm", 2600);
  type("input-gyp-sheetW", 1200);
  type("input-gyp-sheetL", 2600);
  type("input-gyp-waste", 0);
};

describe("the gypsum page", () => {
  it("counts sheets for a room and draws each surface", () => {
    render(<SheetGypsum />);
    fillRoom();
    expect(sheetsNeeded()).toBe("12");
    expect(screen.getByText("Walls A, C")).toBeTruthy();
    expect(screen.getByText("Walls B, D")).toBeTruthy();
    expect(document.querySelectorAll(".gyp-surface svg[role='img']")).toHaveLength(2);
  });

  it("adds a ceiling drawing when the ceiling is boarded", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Walls + ceiling"));
    expect(screen.getByText("Ceiling")).toBeTruthy();
    expect(document.querySelectorAll(".gyp-surface svg[role='img']")).toHaveLength(3);
  });

  it("switches to a single wall", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Single wall"));
    type("input-gyp-wallW", 2400);
    type("input-gyp-wallH", 2600);
    type("input-gyp-sheetW", 1200);
    type("input-gyp-sheetL", 2600);
    type("input-gyp-waste", 0);
    expect(sheetsNeeded()).toBe("2");
  });

  it("fills sheet and consumables from a board preset", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Board Presets"));
    fireEvent.click(screen.getAllByTitle("Apply these values to the calculator")[1]);
    expect(document.getElementById("input-gyp-sheetW").value).toBe("1200");
    expect(document.getElementById("input-gyp-screwRate").value).toBe("13");
  });

  it("keeps printing disabled until there is a job", () => {
    render(<SheetGypsum />);
    expect(screen.getByText("Take-off").closest("button").disabled).toBe(true);
    fillRoom();
    expect(screen.getByText("Take-off").closest("button").disabled).toBe(false);
  });

  it("adds a door, places it, and draws it on its own wall", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Door"));
    expect(screen.getByText("D1")).toBeTruthy();
    // Unplaced: off the area, not drawn, and walls A and C still drawn as one.
    expect(screen.getByText("Walls A, C")).toBeTruthy();
    expect(document.querySelectorAll(".layout-svg-opening")).toHaveLength(0);
    fireEvent.change(document.querySelector("[id$='-x']"), { target: { value: "500" } });
    expect(screen.getByText("Wall A")).toBeTruthy();
    expect(screen.getByText("Wall C")).toBeTruthy();
    expect(document.querySelectorAll(".layout-svg-opening")).toHaveLength(1);
  });

  it("moves an opening to another wall", () => {
    render(<SheetGypsum />);
    fillRoom();
    fireEvent.click(screen.getByText("Window"));
    fireEvent.change(document.querySelector("[id$='-x']"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(screen.getByText("Wall B")).toBeTruthy();
    expect(screen.getByText("Walls A, C")).toBeTruthy();
  });

  it("removes an opening", () => {
    render(<SheetGypsum />);
    fireEvent.click(screen.getByText("Door"));
    fireEvent.click(screen.getByLabelText("Remove D1"));
    expect(screen.queryByText("D1")).toBe(null);
  });
});

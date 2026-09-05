// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { SheetTimesheet } from "../src/components/Timesheet.jsx";

/*
 * useGridNav where it is actually used: real inputs, real focus.
 *
 * The rules it applies are unit-tested in grid-nav.test.js. What can only be
 * checked here is that the ids line up with the grid's coordinates — the whole
 * mechanism is `document.getElementById(cellId(row, col))`, so a renamed input
 * breaks the arrows silently and nothing else notices.
 *
 * The page starts with three rows and three typed columns: Start, End, Lunch.
 */

const cell = (column, rowId) => document.getElementById(`ts-${column}-${rowId}`);

describe("timesheet arrow-key navigation", () => {
  it("moves down a column and back up, staying in the same column", async () => {
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    await user.click(cell("end", 1));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("end", 2));

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("end", 3));

    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(cell("end", 1));
  });

  it("crosses columns once the caret runs out of field", async () => {
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    // An empty cell has nowhere for the caret to go, so Right leaves at once.
    await user.click(cell("start", 2));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(cell("end", 2));

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(cell("start", 2));
  });

  it("keeps the caret inside a part-typed time", async () => {
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    const start = cell("start", 1);
    await user.click(start);
    await user.type(start, "08:30");

    // Caret at the end: Left has field to cross, so it moves the caret.
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(start);
    expect(start.selectionStart).toBe(4);

    // Right from the end of the value does leave.
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(document.activeElement).toBe(cell("end", 1));
  });

  it("stops at the edges instead of wrapping to another row", async () => {
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    await user.click(cell("lunch", 1));
    await user.keyboard("{ArrowRight}");   // past the last column
    expect(document.activeElement).toBe(cell("lunch", 1));

    await user.keyboard("{ArrowUp}");      // above the first row
    expect(document.activeElement).toBe(cell("lunch", 1));

    await user.click(cell("start", 3));
    await user.keyboard("{ArrowDown}");    // below the last row
    expect(document.activeElement).toBe(cell("start", 3));
  });

  it("leaves the Tab chain alone", async () => {
    /* The reason the roving tabindex was not ported. Tab still walks the three
       columns and rolls into the next row, and off the last row it adds one —
       which a grid that is one tab stop could not do. */
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    await user.click(cell("start", 1));
    await user.tab();
    expect(document.activeElement).toBe(cell("end", 1));
    await user.tab();
    expect(document.activeElement).toBe(cell("lunch", 1));
    await user.tab();
    expect(document.activeElement).toBe(cell("start", 2));

    await user.click(cell("lunch", 3));
    await user.tab();
    // The new row's field is focused from a timeout, once React has rendered it.
    await waitFor(() => expect(cell("start", 4)).not.toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(cell("start", 4)));
  });

  it("still moves after a row is added or removed", async () => {
    // rowCount is read on every render, so the grid grows and shrinks with the
    // page rather than holding the shape it had when the hook first ran.
    const user = userEvent.setup();
    render(<SheetTimesheet />);

    await user.click(screen.getByText("+ Add row"));
    await user.click(cell("start", 3));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("start", 4));

    await user.click(screen.getAllByLabelText("Remove row")[3]);
    await user.click(cell("start", 3));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cell("start", 3));
  });
});

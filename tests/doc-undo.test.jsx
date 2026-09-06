// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, render, fireEvent, screen, within } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetTimesheet } from "../src/components/Timesheet.jsx";
import { installFieldUndo } from "../src/utils/field-undo.js";
import {
  DOC_UNDO_LIMIT,
  docUndoState,
  redoDocStep,
  registerDocHistory,
  undoDocStep
} from "../src/utils/doc-undo.js";

/* The store is called straight rather than through a control, so the React
   update it drives has to be flushed by hand — `fireEvent` does that for the
   key presses further down, and nothing does it for a bare call. */
const undoStep = () => { let stepped; act(() => { stepped = undoDocStep(); }); return stepped; };
const redoStep = () => { let stepped; act(() => { stepped = redoDocStep(); }); return stepped; };

const undoOutsideAField = () => fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
const redoOutsideAField = () => fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });

const rows = () => document.querySelectorAll(".ts-grid-row");
const startCell = i => rows()[i].querySelector('input[id^="ts-start-"]');

/* The module is a singleton keyed by whatever registered last, so each test
   starts from nothing rather than inheriting the previous page's stacks. */
let uninstall;
beforeEach(() => { registerDocHistory(null); uninstall = installFieldUndo(); });
afterEach(() => { uninstall(); registerDocHistory(null); });

describe("doc undo, through the timesheet", () => {
  it("takes back Clear all", () => {
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(rows().length).toBe(4);

    fireEvent.click(screen.getByText("Clear all"));
    expect(rows().length).toBe(3);

    expect(undoStep()).toBe(true);
    expect(rows().length).toBe(4);
  });

  it("takes back a removed row", () => {
    render(<SheetTimesheet />);
    const removeFirst = () => within(rows()[0]).getAllByRole("button").at(-1);
    fireEvent.click(removeFirst());
    expect(rows().length).toBe(2);

    undoStep();
    expect(rows().length).toBe(3);
  });

  it("restores what a row held, not just the row", () => {
    render(<SheetTimesheet />);
    fireEvent.change(startCell(0), { target: { value: "9:00" } });
    fireEvent.click(screen.getByText("Clear all"));
    expect(startCell(0).value).toBe("");

    undoStep();
    expect(startCell(0).value).toBe("9:00");
  });

  it("hands the next added row an id nothing else answers to", () => {
    /* The reason nextCalcId is in the snapshot. Clear all resets it to 4; an
       undo that restored the rows without it would hand the next Add row an id
       one of them already has, and React would key two rows the same. */
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));  // id 4
    fireEvent.click(screen.getByText("+ Add row"));  // id 5
    fireEvent.click(screen.getByText("Clear all"));
    undoStep();
    expect(rows().length).toBe(5);

    fireEvent.click(screen.getByText("+ Add row"));
    const ids = [...rows()].map(row => row.querySelector('input[id^="ts-start-"]').id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("redoes what it undid", () => {
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    fireEvent.click(screen.getByText("Clear all"));
    undoStep();
    expect(rows().length).toBe(4);

    expect(redoStep()).toBe(true);
    expect(rows().length).toBe(3);
  });

  it("abandons the redo stack once another action lands", () => {
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    undoStep();
    expect(docUndoState().canRedo).toBe(true);

    fireEvent.click(screen.getByText("+ Add row"));
    expect(docUndoState().canRedo).toBe(false);
  });

  it("names the step it would take back", () => {
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(docUndoState().label).toBe("Add row");

    fireEvent.click(screen.getByText("Clear all"));
    expect(docUndoState().label).toBe("Clear all");

    // The label travels with the state it describes: what is being redone is
    // the clear, not the add behind it.
    undoStep();
    expect(docUndoState().redoLabel).toBe("Clear all");
    expect(docUndoState().label).toBe("Add row");
  });

  it("records a lunch preset, which no keystroke ever produced", () => {
    render(<SheetTimesheet />);
    fireEvent.focus(startCell(0));
    fireEvent.click(screen.getByText("30 min"));
    const lunch = rows()[0].querySelector('input[id^="ts-lunch-"]');
    expect(lunch.value).toBe(".30");

    undoStep();
    expect(lunch.value).toBe("");
  });

  it("keeps at most the documented number of steps", () => {
    render(<SheetTimesheet />);
    for (let i = 0; i < DOC_UNDO_LIMIT + 4; i++) fireEvent.click(screen.getByText("+ Add row"));
    const grown = rows().length;

    for (let i = 0; i < DOC_UNDO_LIMIT + 4; i++) undoStep();
    expect(docUndoState().canUndo).toBe(false);
    // The oldest steps were dropped, so it cannot get all the way back to 3.
    expect(rows().length).toBe(grown - DOC_UNDO_LIMIT);
  });

  it("drops the history when the page leaves the screen", () => {
    const { unmount } = render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(docUndoState().canUndo).toBe(true);

    unmount();
    expect(docUndoState().canUndo).toBe(false);
    expect(undoStep()).toBe(false);
  });

  it("does not record what typing did", () => {
    render(<SheetTimesheet />);
    fireEvent.change(startCell(0), { target: { value: "9:00" } });
    // Text has its own undo; a page-level step here would be two systems
    // answering for one edit.
    expect(docUndoState().canUndo).toBe(false);
  });
});

describe("Ctrl+Z outside a field", () => {
  it("takes the page's action before the last field's typing", () => {
    render(<SheetTimesheet />);
    const cell = startCell(0);
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "9" });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(cell, "9");
    cell.setSelectionRange(1, 1);
    fireEvent.input(cell);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(rows().length).toBe(4);

    undoOutsideAField();
    // The action, not the keystroke: the row count moves and the cell does not.
    expect(rows().length).toBe(3);
    expect(startCell(0).value).toBe("9");
  });

  it("falls through to the last field once the actions run out", () => {
    render(<SheetTimesheet />);
    const cell = startCell(0);
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "9" });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(cell, "9");
    cell.setSelectionRange(1, 1);
    fireEvent.input(cell);

    // No action has been taken, so there is nothing coarser to step first.
    undoOutsideAField();
    expect(startCell(0).value).toBe("");
  });

  it("redoes in the same order", () => {
    render(<SheetTimesheet />);
    fireEvent.click(screen.getByText("+ Add row"));
    undoOutsideAField();
    expect(rows().length).toBe(3);

    redoOutsideAField();
    expect(rows().length).toBe(4);
  });

  it("spends a field history a document step wrote over", () => {
    /* The generation seam. A document undo rewrites the cell's value while
       React keeps the same node, so the typing history now describes text the
       field never held — it has to read as empty rather than hand it back. */
    render(<SheetTimesheet />);
    const cell = startCell(0);
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "9" });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(cell, "9");
    cell.setSelectionRange(1, 1);
    fireEvent.input(cell);
    fireEvent.click(screen.getByText("+ Add row"));

    undoStep();

    // The field's own Ctrl+Z is now spent, so the value it typed stands.
    fireEvent.keyDown(startCell(0), { key: "z", ctrlKey: true });
    expect(startCell(0).value).toBe("9");
  });
});

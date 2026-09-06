// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetTimesheet } from "../src/components/Timesheet.jsx";
import { UndoButtons } from "../src/components/UndoButtons.jsx";
import { installFieldUndo } from "../src/utils/field-undo.js";
import { registerDocHistory } from "../src/utils/doc-undo.js";

const undoBtn = () => screen.getByLabelText("Undo");
const redoBtn = () => screen.getByLabelText("Redo");
const rows = () => document.querySelectorAll(".ts-grid-row");
const startCell = i => rows()[i].querySelector('input[id^="ts-start-"]');

/* The pair and a page that registers a history, which is how it appears in the
   app — the buttons read two module singletons and render nothing of their own
   until something registers with them. */
function Shell() {
  return (
    <>
      <div className="header-actions"><div className="hdr-group"><UndoButtons /></div></div>
      <SheetTimesheet />
    </>
  );
}

let uninstall;
beforeEach(() => { registerDocHistory(null); uninstall = installFieldUndo(); });
afterEach(() => { uninstall(); registerDocHistory(null); });

describe("the header undo pair", () => {
  it("starts dead on a page nothing has happened on", () => {
    render(<Shell />);
    expect(undoBtn()).toBeDisabled();
    expect(redoBtn()).toBeDisabled();
  });

  it("wakes when an action is taken and takes it back on click", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(rows().length).toBe(4);
    expect(undoBtn()).not.toBeDisabled();

    fireEvent.click(undoBtn());
    expect(rows().length).toBe(3);
  });

  it("offers redo only once something has been undone", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(redoBtn()).toBeDisabled();

    fireEvent.click(undoBtn());
    expect(redoBtn()).not.toBeDisabled();
    fireEvent.click(redoBtn());
    expect(rows().length).toBe(4);
  });

  it("names the action in the tooltip", () => {
    render(<Shell />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(undoBtn()).toHaveAttribute("title", "Undo Clear all (Ctrl+Z)");

    fireEvent.click(undoBtn());
    expect(redoBtn()).toHaveAttribute("title", "Redo Clear all (Ctrl+Shift+Z)");
  });

  it("falls back to a plain label for a typing step, which has no name", () => {
    render(<Shell />);
    const cell = startCell(0);
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "9" });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(cell, "9");
    cell.setSelectionRange(1, 1);
    fireEvent.input(cell);

    expect(undoBtn()).not.toBeDisabled();
    expect(undoBtn()).toHaveAttribute("title", "Undo (Ctrl+Z)");
  });

  it("wakes on typing alone, with no action on the page", () => {
    render(<Shell />);
    const cell = startCell(0);
    fireEvent.focus(cell);
    fireEvent.keyDown(cell, { key: "9" });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(cell, "9");
    cell.setSelectionRange(1, 1);
    fireEvent.input(cell);

    fireEvent.click(undoBtn());
    expect(startCell(0).value).toBe("");
  });

  it("does not blur the field it is about to fix", () => {
    /* The whole reason mousedown is prevented. A blurred NumInput commits, and
       a commit rewrites the value the undo was aimed at. */
    render(<Shell />);
    // The pair has to be live first: a disabled button runs no handler at all,
    // so a prevented mousedown cannot be observed on one.
    fireEvent.click(screen.getByText("+ Add row"));
    fireEvent.focus(startCell(0));
    expect(undoBtn()).not.toBeDisabled();

    const event = fireEvent.mouseDown(undoBtn());
    expect(event).toBe(false);
  });

  it("goes dead again when the page leaves the screen", () => {
    const { unmount } = render(<Shell />);
    fireEvent.click(screen.getByText("+ Add row"));
    expect(undoBtn()).not.toBeDisabled();
    unmount();

    render(<div className="hdr-group"><UndoButtons /></div>);
    expect(undoBtn()).toBeDisabled();
    expect(redoBtn()).toBeDisabled();
  });

  it("composes the control system rather than owning a recipe", () => {
    // The tier, the hover and the press come from 65-controls.css; the header
    // base contributes only the step. A bespoke recipe here is the drift the
    // control system exists to prevent.
    render(<Shell />);
    for (const button of [undoBtn(), redoBtn()]) {
      expect(button.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["hdr-btn", "ctl-ghost", "ctl-icon"])
      );
    }
  });
});

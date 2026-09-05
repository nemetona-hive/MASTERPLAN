// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { NumInput } from "../src/shared.jsx";
import { fieldUndoState, installFieldUndo, FIELD_UNDO_LIMIT, FIELD_UNDO_RUN_IDLE_MS } from "../src/utils/field-undo.js";

/*
 * These drive the DOM the way a browser does rather than through
 * fireEvent.change, because the whole module hangs on the order a real edit
 * arrives in: keydown carries the value BEFORE the edit, and the caret has
 * already moved by the time `input` fires. fireEvent.change does neither, so a
 * test written with it would pass against a module that could not work.
 */
const setNativeValue = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
};

function pressChar(input, ch) {
  fireEvent.keyDown(input, { key: ch });
  const start = input.selectionStart;
  const end = input.selectionEnd;
  setNativeValue(input, input.value.slice(0, start) + ch + input.value.slice(end));
  input.setSelectionRange(start + 1, start + 1);
  fireEvent.input(input);
}

const typeText = (input, text) => { for (const ch of text) pressChar(input, ch); };

function pressBackspace(input) {
  fireEvent.keyDown(input, { key: "Backspace" });
  const start = input.selectionStart;
  if (start === 0) return;
  setNativeValue(input, input.value.slice(0, start - 1) + input.value.slice(input.selectionEnd));
  input.setSelectionRange(start - 1, start - 1);
  fireEvent.input(input);
}

const undoKey = el => fireEvent.keyDown(el, { key: "z", ctrlKey: true });
const redoKey = el => fireEvent.keyDown(el, { key: "z", ctrlKey: true, shiftKey: true });

/* A dimension field with a parent that actually holds the value, like every
   real call site: the undo has to survive the round trip through the page's
   state and back out through NumInput's own effect on `value`. */
function Dimension({ initial = 0, onValue, ...props }) {
  const [value, setValue] = React.useState(initial);
  return (
    <NumInput
      id="w"
      label="Width"
      value={value}
      onChange={next => { setValue(next); onValue?.(next); }}
      {...props}
    />
  );
}

const renderField = (props = {}) => {
  const { container } = render(<Dimension {...props} />);
  const input = container.querySelector("input");
  fireEvent.focus(input);
  return input;
};

let uninstall;
beforeEach(() => { uninstall = installFieldUndo(); });
afterEach(() => uninstall());

describe("field undo", () => {
  it("steps back a typing run as one step", () => {
    const input = renderField();
    typeText(input, "2400");
    expect(input.value).toBe("02400");

    undoKey(input);
    // The whole run is one step, so it goes back to the seeded value rather
    // than to "0240".
    expect(input.value).toBe("0");
  });

  it("redoes what it undid", () => {
    const input = renderField();
    typeText(input, "2400");
    undoKey(input);
    expect(input.value).toBe("0");

    redoKey(input);
    expect(input.value).toBe("02400");
  });

  it("treats Ctrl+Y as redo", () => {
    const input = renderField();
    typeText(input, "18");
    undoKey(input);
    fireEvent.keyDown(input, { key: "y", ctrlKey: true });
    expect(input.value).toBe("018");
  });

  it("breaks the run when the kind of edit changes", () => {
    const input = renderField();
    typeText(input, "250");
    pressBackspace(input);
    expect(input.value).toBe("025");

    // The delete is its own step: back to the end of the insert run.
    undoKey(input);
    expect(input.value).toBe("0250");
    // And the insert run is the step behind it.
    undoKey(input);
    expect(input.value).toBe("0");
  });

  it("breaks the run when the caret jumps", () => {
    const input = renderField();
    typeText(input, "12");
    // Same kind of edit, but somewhere else in the field.
    input.setSelectionRange(0, 0);
    pressChar(input, "9");
    expect(input.value).toBe("9012");

    undoKey(input);
    expect(input.value).toBe("012");
  });

  it("breaks the run after a pause", () => {
    const input = renderField();
    typeText(input, "12");
    const realNow = Date.now;
    Date.now = () => realNow() + FIELD_UNDO_RUN_IDLE_MS + 1;
    try {
      pressChar(input, "3");
    } finally {
      Date.now = realNow;
    }
    expect(input.value).toBe("0123");

    undoKey(input);
    expect(input.value).toBe("012");
  });

  it("keeps at most the documented number of steps", () => {
    const input = renderField();
    // One step per run, each broken from the last by a pause.
    const realNow = Date.now;
    let drift = 0;
    Date.now = () => realNow() + drift;
    try {
      for (let i = 1; i <= FIELD_UNDO_LIMIT + 3; i++) {
        drift += FIELD_UNDO_RUN_IDLE_MS + 1;
        pressChar(input, String(i % 10));
      }
    } finally {
      Date.now = realNow;
    }

    for (let i = 0; i < FIELD_UNDO_LIMIT + 3; i++) undoKey(input);
    // The oldest steps were dropped, so it cannot get back to the seed.
    expect(input.value).not.toBe("0");
    expect(fieldUndoState().canUndo).toBe(false);
  });

  it("spends no step on a character the field rejects", () => {
    const input = renderField();
    typeText(input, "24");

    // cleanNumericInput strips a letter, so React restores the value and the
    // input event carries no edit.
    fireEvent.keyDown(input, { key: "x" });
    setNativeValue(input, "024x");
    fireEvent.input(input);
    expect(input.value).toBe("024");

    undoKey(input);
    expect(input.value).toBe("0");
  });

  it("survives the commit that truncates the native stack", () => {
    // The whole reason the module exists: blur clamps and reformats the value
    // through React, which is exactly what the browser's own undo cannot see
    // past.
    const input = renderField({ initial: 100, max: 8000 });
    input.setSelectionRange(0, input.value.length);
    fireEvent.keyDown(input, { key: "9" });
    setNativeValue(input, "9999");
    input.setSelectionRange(4, 4);
    fireEvent.input(input);

    fireEvent.blur(input);
    expect(input.value).toBe("8000");

    fireEvent.focus(input);
    undoKey(input);
    expect(input.value).toBe("100");
  });

  it("does not record the reformat itself as a step", () => {
    const input = renderField({ initial: 100, max: 8000 });
    input.setSelectionRange(0, input.value.length);
    fireEvent.keyDown(input, { key: "9" });
    setNativeValue(input, "9999");
    input.setSelectionRange(4, 4);
    fireEvent.input(input);
    fireEvent.blur(input);
    fireEvent.focus(input);

    undoKey(input);
    expect(input.value).toBe("100");
    // 9999 → 8000 was presentation, not an edit, so there is nothing behind it.
    expect(fieldUndoState().canUndo).toBe(false);
  });

  it("abandons the redo stack once typing resumes", () => {
    const input = renderField();
    typeText(input, "24");
    undoKey(input);
    expect(fieldUndoState().canRedo).toBe(true);

    pressChar(input, "7");
    expect(fieldUndoState().canRedo).toBe(false);
    redoKey(input);
    expect(input.value).toBe("07");
  });

  it("keeps the caret where the undone text was", () => {
    const input = renderField();
    typeText(input, "24");
    input.setSelectionRange(0, 0);
    pressChar(input, "9");
    expect(input.selectionStart).toBe(1);

    undoKey(input);
    expect(input.value).toBe("024");
    expect(input.selectionStart).toBe(0);
  });

  it("keeps a history per field", () => {
    const { container } = render(
      <>
        <Dimension initial={1} />
        <Dimension initial={2} />
      </>
    );
    const [a, b] = container.querySelectorAll("input");

    fireEvent.focus(a);
    typeText(a, "5");
    fireEvent.focus(b);
    typeText(b, "6");

    undoKey(b);
    expect(b.value).toBe("2");
    // a's own run is untouched by b's undo.
    expect(a.value).toBe("15");
    fireEvent.focus(a);
    undoKey(a);
    expect(a.value).toBe("1");
  });

  it("survives blur and refocus", () => {
    const input = renderField();
    typeText(input, "24");
    fireEvent.blur(input);
    fireEvent.focus(input);

    undoKey(input);
    expect(input.value).toBe("0");
  });

  describe("Ctrl+Z outside a field", () => {
    it("steps the field you were last in", () => {
      const input = renderField();
      typeText(input, "24");
      fireEvent.blur(input);

      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
      expect(input.value).toBe("0");
      expect(document.activeElement).toBe(input);
    });

    it("does nothing once that field has left the screen", () => {
      const { container, unmount } = render(<Dimension />);
      const input = container.querySelector("input");
      fireEvent.focus(input);
      typeText(input, "24");
      unmount();

      // No target, so nothing is claimed and the key falls through to the
      // browser.
      const event = fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
      expect(event).toBe(true);
      expect(fieldUndoState().canUndo).toBe(false);
    });

    it("leaves an unmanaged field its own native undo", () => {
      const { container } = render(<input type="range" min="0" max="10" readOnly />);
      const range = container.querySelector("input");
      // Not claimed: a range has no text to step through.
      const event = fireEvent.keyDown(range, { key: "z", ctrlKey: true });
      expect(event).toBe(true);
    });
  });

  it("claims Ctrl+Z in a managed field even with nothing to undo", () => {
    const input = renderField();
    // Always prevented, so the field never falls back to a native stack that
    // has been truncated behind its back.
    const event = fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(event).toBe(false);
  });

  it("stops listening once uninstalled", () => {
    const input = renderField();
    typeText(input, "24");
    uninstall();
    uninstall = () => {};

    undoKey(input);
    expect(input.value).toBe("024");
  });
});

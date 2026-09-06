// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { Modal } from "../src/shared.jsx";

/* A modal over a page that is still there and still focusable — which is the
   whole situation the trap exists for. The background input stands in for the
   material fields the large preview renders a second copy of. */
function Page({ open, onClose = () => {} }) {
  return (
    <>
      <input id="behind" aria-label="behind" />
      <button id="opener">Open</button>
      {open && (
        <Modal title="Manage presets" onClose={onClose}>
          <input aria-label="first" />
          <button>Middle</button>
          <input aria-label="last" />
        </Modal>
      )}
    </>
  );
}

const panel = () => document.querySelector(".mp-modal");

describe("the modal's focus behaviour", () => {
  it("announces itself as a dialog, and names itself", () => {
    render(<Page open />);
    expect(panel()).toHaveAttribute("role", "dialog");
    expect(panel()).toHaveAttribute("aria-modal", "true");
    // aria-modal is a promise about behaviour; the label is what a screen
    // reader says on arrival.
    const labelledBy = panel().getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy).textContent).toBe("Manage presets");
  });

  it("takes focus on open", () => {
    render(<Page open />);
    expect(document.activeElement).toBe(panel());
  });

  it("keeps Tab inside, wrapping at the end", async () => {
    render(<Page open />);
    screen.getByLabelText("last").focus();

    await userEvent.tab();
    /* Wraps to the Close button, not to the body's first input: the head comes
       before the body in the DOM, so Close is the panel's first tab stop. What
       matters is that it is not #behind, which is the failure this exists to
       prevent. */
    expect(document.activeElement).toBe(screen.getByLabelText("Close"));
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it("wraps backwards from the panel itself", () => {
    /* The first Shift+Tab of a freshly opened dialog starts from the panel,
       which is not in the tab stops — without this it leaves immediately. */
    render(<Page open />);
    expect(document.activeElement).toBe(panel());

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText("last"));
  });

  it("never lands on the page behind the scrim", async () => {
    render(<Page open />);
    const behind = document.getElementById("behind");
    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      expect(document.activeElement, `tab ${i + 1}`).not.toBe(behind);
      expect(panel().contains(document.activeElement)).toBe(true);
    }
  });

  it("gives focus back to whatever opened it", () => {
    const { rerender } = render(<Page open={false} />);
    const opener = document.getElementById("opener");
    opener.focus();

    rerender(<Page open />);
    expect(document.activeElement).toBe(panel());

    rerender(<Page open={false} />);
    // Not <body>, which would restart the next Tab from the top of the app.
    expect(document.activeElement).toBe(opener);
  });

  it("survives an opener that did not outlive the dialog", () => {
    /* Focusing a detached node silently moves focus to <body> — the state this
       exists to avoid, reached by a different road. */
    function Vanishing({ open }) {
      return (
        <>
          {!open && <button id="gone">Open</button>}
          {open && <Modal title="t" onClose={() => {}}><button>Inside</button></Modal>}
        </>
      );
    }
    const { rerender } = render(<Vanishing open={false} />);
    document.getElementById("gone").focus();
    rerender(<Vanishing open />);
    expect(() => rerender(<Vanishing open={false} />)).not.toThrow();
  });

  describe("dismissing", () => {
    it("closes on Escape", () => {
      const onClose = vi.fn();
      render(<Page open onClose={onClose} />);
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });

    it("closes on a press outside the panel", () => {
      const onClose = vi.fn();
      render(<Page open onClose={onClose} />);
      fireEvent.mouseDown(document.querySelector(".mp-modal-overlay"));
      expect(onClose).toHaveBeenCalled();
    });

    it("does not close on a press inside it", () => {
      // Both routes come from one hook, so they cannot disagree about what
      // counts as outside.
      const onClose = vi.fn();
      render(<Page open onClose={onClose} />);
      fireEvent.mouseDown(screen.getByLabelText("first"));
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes from its own close button", () => {
      const onClose = vi.fn();
      render(<Page open onClose={onClose} />);
      fireEvent.click(screen.getByLabelText("Close"));
      expect(onClose).toHaveBeenCalled();
    });
  });
});

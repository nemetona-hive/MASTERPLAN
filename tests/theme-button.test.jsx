// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { ThemeButton } from "../src/components/ThemeButton.jsx";

const button = () => screen.getByRole("button");

describe("the header theme toggle", () => {
  it("says which theme is on, in words", () => {
    // The reason it is the wide variant: an icon alone says what the control
    // does and never what it is currently set to.
    render(<ThemeButton theme="graphite" setTheme={vi.fn()} />);
    expect(button().textContent).toContain(THEMES.graphite.label);
    expect(button()).toHaveAttribute("title", `Theme: ${THEMES.graphite.label}`);
  });

  it("advances to the next theme", async () => {
    const setTheme = vi.fn();
    render(<ThemeButton theme="graphite" setTheme={setTheme} />);

    await userEvent.click(button());
    expect(setTheme).toHaveBeenCalledWith(getNextTheme("graphite"));
  });

  it("cycles rather than flipping, so a third theme needs no new control", async () => {
    const setTheme = vi.fn();
    const keys = getThemeOrder();
    const last = keys[keys.length - 1];
    render(<ThemeButton theme={last} setTheme={setTheme} />);

    await userEvent.click(button());
    expect(setTheme).toHaveBeenCalledWith(keys[0]);
  });

  it("gives a screen reader the name once, not twice", () => {
    /* The icon is an emoji and decorative — announced, it reads as a bare
       "black circle" next to the label that already says Graphite. */
    const { container } = render(<ThemeButton theme="graphite" setTheme={vi.fn()} />);
    expect(container.querySelector(".header-theme-icon")).toHaveAttribute("aria-hidden", "true");
    expect(button()).toHaveAttribute("aria-label", `Theme: ${THEMES.graphite.label}`);
  });

  it("composes the control system rather than owning a recipe", () => {
    render(<ThemeButton theme="graphite" setTheme={vi.fn()} />);
    const classes = button().className.split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(["hdr-btn", "is-wide", "ctl-ghost"]));
    // Not squared: this one carries a word, and .ctl-icon would clip it to a
    // 32px box.
    expect(classes).not.toContain("ctl-icon");
  });

  it("survives a theme key the palette no longer has", () => {
    // applyTheme falls back, and a header that threw would take the whole app
    // down over a stale localStorage value.
    render(<ThemeButton theme="gone" setTheme={vi.fn()} />);
    expect(button()).toBeInTheDocument();
    expect(button().textContent).toContain("◇");
  });
});

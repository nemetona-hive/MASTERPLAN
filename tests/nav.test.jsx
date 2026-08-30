// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { AppNav } from "../src/Nav.jsx";

// Nav.jsx reads PAGES, THEMES and getNextTheme as free variables — they are
// globals from config.js/themes.js, published by tests/setup.js. That is also
// what makes the group tests below possible: swapping globalThis.PAGES for a
// fixture changes what the component sees on its next render.

const props = (over = {}) => ({
  page: "home",
  setPage: vi.fn(),
  navOpen: true,
  setNavOpen: vi.fn(),
  mobileMenuOpen: false,
  setMobileMenuOpen: vi.fn(),
  isMobile: false,
  theme: "graphite",
  setTheme: vi.fn(),
  ...over
});

const navButtons = () =>
  Array.from(document.querySelectorAll("#side-navi .nav-items .nav-btn"));

describe("AppNav", () => {
  it("renders one button per page, Home included despite noNav", () => {
    // home carries noNav so it never shows as an ordinary item elsewhere, but
    // the nav special-cases it: collapsed, the HIVE label is disabled, and this
    // is the only way back to the home page.
    render(<AppNav {...props()} />);
    const labels = navButtons().map(b => b.textContent);
    for (const pg of PAGES) expect(labels.join("|")).toContain(pg.label);
    expect(navButtons()).toHaveLength(PAGES.length);
  });

  it("navigates on click", async () => {
    const p = props();
    render(<AppNav {...p} />);
    await userEvent.click(screen.getByRole("button", { name: /Concrete/ }));
    expect(p.setPage).toHaveBeenCalledWith("concrete");
  });

  it("marks only the current page with aria-current", () => {
    render(<AppNav {...props({ page: "timesheet" })} />);
    const current = navButtons().filter(b => b.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Timesheet");
  });

  describe("keyboard roving", () => {
    it("moves focus down and up the list", () => {
      render(<AppNav {...props()} />);
      const btns = navButtons();
      btns[0].focus();

      fireEvent.keyDown(btns[0], { key: "ArrowDown" });
      expect(document.activeElement).toBe(btns[1]);

      fireEvent.keyDown(btns[1], { key: "ArrowDown" });
      expect(document.activeElement).toBe(btns[2]);

      fireEvent.keyDown(btns[2], { key: "ArrowUp" });
      expect(document.activeElement).toBe(btns[1]);
    });

    it("stops at both ends rather than wrapping", () => {
      // Wrapping would take a Tab-and-arrow user from the last page back to the
      // first with no signal that the list ended.
      render(<AppNav {...props()} />);
      const btns = navButtons();

      btns[0].focus();
      fireEvent.keyDown(btns[0], { key: "ArrowUp" });
      expect(document.activeElement).toBe(btns[0]);

      // handleKeyNav walks every .nav-btn under the nav, which includes the
      // pinned theme button below the list — so the last item to hold focus is
      // that one, not the last page.
      const all = Array.from(document.querySelectorAll("#side-navi .nav-btn"));
      const last = all[all.length - 1];
      last.focus();
      fireEvent.keyDown(last, { key: "ArrowDown" });
      expect(document.activeElement).toBe(last);
    });

    it("activates on Enter and Space", () => {
      const p = props();
      render(<AppNav {...p} />);
      const concrete = screen.getByRole("button", { name: /Concrete/ });

      fireEvent.keyDown(concrete, { key: "Enter" });
      fireEvent.keyDown(concrete, { key: " " });
      expect(p.setPage).toHaveBeenCalledTimes(2);
      expect(p.setPage).toHaveBeenCalledWith("concrete");
    });
  });

  describe("collapsing", () => {
    it("marks the nav collapsed and disables the HIVE label", () => {
      // Collapsed, the label shrinks to zero width and sits under the toggle
      // icon; leaving it enabled makes a click near the icon navigate home as a
      // side effect of trying to expand.
      const { container } = render(<AppNav {...props({ navOpen: false })} />);
      expect(container.querySelector("#side-navi").className).toContain("nav-collapsed");
      expect(container.querySelector(".nav-toggle-label")).toBeDisabled();
    });

    it("leaves the label live when expanded", async () => {
      const p = props();
      const { container } = render(<AppNav {...p} />);
      expect(container.querySelector("#side-navi").className).not.toContain("nav-collapsed");
      await userEvent.click(container.querySelector(".nav-toggle-label"));
      expect(p.setPage).toHaveBeenCalledWith("home");
    });

    it("toggles the sidebar on desktop and the menu on mobile", async () => {
      const desktop = props();
      const { container, unmount } = render(<AppNav {...desktop} />);
      await userEvent.click(container.querySelector(".nav-menu-icon"));
      expect(desktop.setNavOpen).toHaveBeenCalled();
      expect(desktop.setMobileMenuOpen).not.toHaveBeenCalled();
      unmount();

      const mobile = props({ isMobile: true });
      const { container: mc } = render(<AppNav {...mobile} />);
      await userEvent.click(mc.querySelector(".nav-menu-icon"));
      expect(mobile.setMobileMenuOpen).toHaveBeenCalled();
      expect(mobile.setNavOpen).not.toHaveBeenCalled();
    });

    it("names the toggle for its next action, per platform", () => {
      const { container, unmount } = render(<AppNav {...props({ navOpen: true })} />);
      expect(container.querySelector(".nav-menu-icon")).toHaveAttribute("aria-label", "Collapse sidebar (Ctrl+B)");
      unmount();

      const { container: c2 } = render(<AppNav {...props({ isMobile: true, mobileMenuOpen: true })} />);
      expect(c2.querySelector(".nav-menu-icon")).toHaveAttribute("aria-label", "Close menu");
    });
  });

  describe("mobile", () => {
    it("closes the menu after navigating", async () => {
      const p = props({ isMobile: true, mobileMenuOpen: true });
      render(<AppNav {...p} />);
      await userEvent.click(screen.getByRole("button", { name: /Concrete/ }));
      expect(p.setPage).toHaveBeenCalledWith("concrete");
      expect(p.setMobileMenuOpen).toHaveBeenCalledWith(false);
    });

    it("closes the menu after going home from the header", async () => {
      const p = props({ isMobile: true, mobileMenuOpen: true });
      const { container } = render(<AppNav {...p} />);
      await userEvent.click(container.querySelector(".nav-toggle-label"));
      expect(p.setMobileMenuOpen).toHaveBeenCalledWith(false);
    });
  });

  describe("tooltips", () => {
    // Mounted on hover and portalled to <body> rather than parked in the strip
    // at opacity 0: .nav is overflow-y:auto, so a box to the right of a 60px
    // strip gives it horizontal scroll room and arrow-key focus slides every
    // label out of view.
    it("shows a portalled tooltip on hover only while collapsed", async () => {
      const { container, unmount } = render(<AppNav {...props({ navOpen: false })} />);
      expect(document.querySelector("body > .nav-tooltip")).toBeNull();

      fireEvent.mouseEnter(container.querySelector(".nav-btn-wrap"));
      const tip = document.querySelector("body > .nav-tooltip");
      expect(tip).not.toBeNull();
      // The button's own label is still in the accessibility tree, clipped to
      // zero width — announcing the tooltip too would say it twice.
      expect(tip).toHaveAttribute("aria-hidden", "true");

      fireEvent.mouseLeave(container.querySelector(".nav-btn-wrap"));
      expect(document.querySelector("body > .nav-tooltip")).toBeNull();
      unmount();

      const { container: open } = render(<AppNav {...props({ navOpen: true })} />);
      fireEvent.mouseEnter(open.querySelector(".nav-btn-wrap"));
      expect(document.querySelector("body > .nav-tooltip")).toBeNull();
    });

    it("closes an open tooltip when the sidebar expands", () => {
      const { container, rerender } = render(<AppNav {...props({ navOpen: false })} />);
      fireEvent.mouseEnter(container.querySelector(".nav-btn-wrap"));
      expect(document.querySelector("body > .nav-tooltip")).not.toBeNull();

      // Expanding would otherwise leave it pointing at a button that has moved,
      // labelling something whose label is now visible anyway.
      rerender(<AppNav {...props({ navOpen: true })} />);
      expect(document.querySelector("body > .nav-tooltip")).toBeNull();
    });

    it("closes an open tooltip on scroll", () => {
      // The anchor rect goes stale the moment anything moves under it.
      const { container } = render(<AppNav {...props({ navOpen: false })} />);
      fireEvent.mouseEnter(container.querySelector(".nav-btn-wrap"));
      expect(document.querySelector("body > .nav-tooltip")).not.toBeNull();

      fireEvent.scroll(window);
      expect(document.querySelector("body > .nav-tooltip")).toBeNull();
    });
  });

  describe("theme button", () => {
    it("shows the current theme and advances to the next one", async () => {
      const p = props({ theme: "graphite" });
      const { container } = render(<AppNav {...p} />);
      const btn = container.querySelector(".nav-bottom .nav-btn");
      expect(btn.textContent).toContain(THEMES.graphite.label);

      await userEvent.click(btn);
      expect(p.setTheme).toHaveBeenCalledWith(getNextTheme("graphite"));
    });
  });
});

// PAGES ships flat today — nothing sets isParent or parentId — so every group
// branch in Nav.jsx is unreachable against the real config. These run against a
// fixture so the behaviour is pinned before a grouped page is ever added.
describe("AppNav groups", () => {
  const FIXTURE = [
    { id: "home", label: "Home", icon: "home", noNav: true },
    { id: "layouts", label: "Layouts", icon: "s1", isParent: true },
    { id: "straight", label: "Straight", icon: "s1", parentId: "layouts" },
    { id: "shifted", label: "Shifted", icon: "s2", parentId: "layouts" },
    { id: "timesheet", label: "Timesheet", icon: "timesheet" }
  ];
  let originalPages;

  beforeEach(() => { originalPages = globalThis.PAGES; globalThis.PAGES = FIXTURE; });
  afterEach(() => { globalThis.PAGES = originalPages; });

  const group = () => screen.getByRole("button", { name: /Layouts/ });

  it("starts open on desktop and shut on mobile", () => {
    // A phone has no room to show every child of every group at once.
    const { unmount } = render(<AppNav {...props()} />);
    expect(group()).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: /Straight/ })).not.toBeNull();
    unmount();

    render(<AppNav {...props({ isMobile: true, mobileMenuOpen: true })} />);
    expect(group()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Straight/ })).toBeNull();
  });

  it("toggles the group on click instead of navigating to it", async () => {
    const p = props();
    render(<AppNav {...p} />);
    await userEvent.click(group());
    expect(p.setPage).not.toHaveBeenCalled();
    expect(group()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Straight/ })).toBeNull();
  });

  it("opens with ArrowRight and closes with ArrowLeft and Escape", async () => {
    render(<AppNav {...props()} />);
    await userEvent.click(group());              // shut it first
    expect(group()).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(group()).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(group(), { key: "ArrowLeft" });
    expect(group()).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(group(), { key: "ArrowRight" });
    fireEvent.keyDown(group(), { key: "Escape" });
    expect(group()).toHaveAttribute("aria-expanded", "false");
  });

  it("ArrowRight on an already-open group moves on rather than re-opening", () => {
    render(<AppNav {...props()} />);
    expect(group()).toHaveAttribute("aria-expanded", "true");
    group().focus();
    fireEvent.keyDown(group(), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Straight/ }));
  });

  it("ArrowLeft on a child jumps back to its group header", () => {
    render(<AppNav {...props()} />);
    const child = screen.getByRole("button", { name: /Shifted/ });
    child.focus();
    fireEvent.keyDown(child, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(group());
  });

  it("opens the group that owns the current page", () => {
    // Landing on a child by any route other than the nav — a deep link, a
    // button on another page — must not leave it hidden inside a shut group.
    render(<AppNav {...props({ isMobile: true, mobileMenuOpen: true, page: "shifted" })} />);
    expect(group()).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: /Shifted/ })).not.toBeNull();
  });

  it("marks the group as holding the active child, not as the page itself", () => {
    render(<AppNav {...props({ page: "shifted" })} />);
    expect(group().className).toContain("child-active");
    expect(group()).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: /Shifted/ })).toHaveAttribute("aria-current", "page");
  });
});

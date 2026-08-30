// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { AppNav } from "../src/Nav.jsx";

// Nav.jsx reads PAGES, THEMES and getNextTheme as free variables — they are
// globals from config.js/themes.js, published by tests/setup.js.

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

  it("never marks a nav button expandable", () => {
    // The nav is a flat list of links to pages. aria-expanded here would
    // promise a disclosure that does not exist.
    render(<AppNav {...props()} />);
    for (const btn of navButtons()) expect(btn).not.toHaveAttribute("aria-expanded");
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

    it("roves on the horizontal axis too", () => {
      // The list is flat, so Left and Right have nothing to expand or collapse
      // and step the list instead. Right already moved to the next item before
      // groups were removed; Left used to hunt for a parent header and, with no
      // groups in the config, did nothing at all.
      render(<AppNav {...props()} />);
      const btns = navButtons();
      btns[0].focus();

      fireEvent.keyDown(btns[0], { key: "ArrowRight" });
      expect(document.activeElement).toBe(btns[1]);

      fireEvent.keyDown(btns[1], { key: "ArrowLeft" });
      expect(document.activeElement).toBe(btns[0]);
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

  describe("build stamp", () => {
    // The whole point is being able to read the deployed id off the page and
    // compare it with `npm run deploy:check`, so it has to actually render.
    it("shows the build id from version.js when expanded", () => {
      const { container } = render(<AppNav {...props({ navOpen: true })} />);
      const stamp = container.querySelector(".nav-build");
      expect(stamp).not.toBeNull();
      expect(stamp.textContent).toContain(BUILD.id);
    });

    it("shows in the mobile drawer, and only while it is open", () => {
      // The flag has to come from mobileMenuOpen on mobile. navOpen is the
      // desktop rail's state and initialises to false below 1280px, so reading
      // it here hid the stamp on every phone.
      const { container, unmount } = render(
        <AppNav {...props({ isMobile: true, mobileMenuOpen: true, navOpen: false })} />);
      expect(container.querySelector(".nav-build")).not.toBeNull();
      unmount();

      const { container: shut } = render(
        <AppNav {...props({ isMobile: true, mobileMenuOpen: false, navOpen: true })} />);
      expect(shut.querySelector(".nav-build")).toBeNull();
    });

    it("sits last in the nav's bottom section", () => {
      // .nav-bottom carries margin-top:auto and .nav fills the rail, so last
      // child of that section is the floor of the sidebar.
      const { container } = render(<AppNav {...props({ navOpen: true })} />);
      const bottom = container.querySelector(".nav-bottom");
      expect(bottom.lastElementChild.className).toContain("nav-build");
    });

    it("disappears when the nav collapses", () => {
      // 60px of strip, and this is the one nav item with no icon to shrink to.
      const { container } = render(<AppNav {...props({ navOpen: false })} />);
      expect(container.querySelector(".nav-build")).toBeNull();
    });

    it("renders the rest of the nav when version.js never loaded", () => {
      // A browser holding a cached index.html from before versioning has no
      // BUILD global at all; a bare reference would throw and take the whole
      // sidebar down with it.
      const original = globalThis.BUILD;
      // eslint-disable-next-line no-undef
      delete globalThis.BUILD;
      try {
        const { container } = render(<AppNav {...props()} />);
        expect(container.querySelector(".nav-build")).toBeNull();
        expect(navButtons().length).toBeGreaterThan(0);
      } finally {
        globalThis.BUILD = original;
      }
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

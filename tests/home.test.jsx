// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { SheetHome } from "../src/components/Home.jsx";

describe("SheetHome", () => {
  it("renders a card per navigable page, and not the home page itself", () => {
    const { container } = render(<SheetHome page="home" setPage={vi.fn()} />);
    const cards = container.querySelectorAll(".home-card");
    expect(cards).toHaveLength(PAGES.filter(pg => !pg.noNav).length);
    expect(container.textContent).not.toMatch(/^Home$/m);
  });

  it("navigates on click", async () => {
    const setPage = vi.fn();
    render(<SheetHome page="home" setPage={setPage} />);
    await userEvent.click(screen.getByText("Concrete").closest(".home-card"));
    expect(setPage).toHaveBeenCalledWith("concrete");
  });

  describe("build stamp", () => {
    // This is mobile's only copy — the nav rail's is hidden below the
    // breakpoint, and the drawer it would live in is shut by default. A media
    // query in 70-home.css does the showing, so it is in the DOM either way.
    it("renders the build id from version.js", () => {
      const { container } = render(<SheetHome page="home" setPage={vi.fn()} />);
      const stamp = container.querySelector(".home-build");
      expect(stamp).not.toBeNull();
      expect(stamp.textContent).toContain(BUILD.id);
    });

    it("is displayed only below the mobile breakpoint", () => {
      // The invariant the two copies rest on: exactly one is ever on screen.
      // The rail's copy is gated in JS (NavBuildStamp bails when mobile), this
      // one in CSS — so if the default here stopped being `none`, desktop would
      // show the stamp twice and nothing else would catch it.
      const css = fs.readFileSync(
        path.resolve(import.meta.dirname, "..", "src", "styles", "70-home.css"), "utf8");
      const mobileAt = css.indexOf("@media (max-width: 768px)");
      expect(mobileAt).toBeGreaterThan(-1);

      const base = css.slice(0, mobileAt);
      const mobile = css.slice(mobileAt);
      expect(base).toMatch(/\.home-build\s*\{[^}]*display:\s*none/);
      expect(mobile).toMatch(/\.home-build\s*\{[^}]*display:\s*block/);
    });

    it("renders the page when version.js never loaded", () => {
      // A browser on a cached pre-versioning index.html has no BUILD global.
      const original = globalThis.BUILD;
      delete globalThis.BUILD;
      try {
        const { container } = render(<SheetHome page="home" setPage={vi.fn()} />);
        expect(container.querySelector(".home-build")).toBeNull();
        expect(container.querySelectorAll(".home-card").length).toBeGreaterThan(0);
      } finally {
        globalThis.BUILD = original;
      }
    });
  });
});

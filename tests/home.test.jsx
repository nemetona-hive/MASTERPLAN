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
    const { container } = render(<SheetHome setPage={vi.fn()} />);
    const cards = container.querySelectorAll(".home-card");
    expect(cards).toHaveLength(PAGES.filter(pg => !pg.noNav).length);
    expect(container.textContent).not.toMatch(/^Home$/m);
  });

  it("says that entries do not survive a reload", () => {
    const { container } = render(<SheetHome setPage={vi.fn()} />);
    expect(container.querySelector(".home-note").textContent).toMatch(/reloading/i);
  });

  it("shows no note when projects are available", () => {
    const { container } = render(<SheetHome setPage={vi.fn()} projectsAvailable />);
    expect(container.querySelector(".home-note")).toBeNull();
  });

  it("navigates on click", async () => {
    const setPage = vi.fn();
    render(<SheetHome setPage={setPage} />);
    await userEvent.click(screen.getByText("Concrete").closest(".home-card"));
    expect(setPage).toHaveBeenCalledWith("concrete");
  });

  describe("build stamp", () => {
    // Shown at every width. On mobile it is the only copy (the drawer is shut
    // by default); on desktop the rail leaves its copy out on Home.
    it("renders the build id from version.js", () => {
      const { container } = render(<SheetHome setPage={vi.fn()} />);
      const stamp = container.querySelector(".home-build");
      expect(stamp).not.toBeNull();
      expect(stamp.textContent).toContain(BUILD.id);
    });

    it("is displayed at every width", () => {
      // Desktop reads it here too: the rail drops its copy when collapsed, and
      // leaves it out on Home (nav.test.jsx), so this is the only one shown.
      const css = fs.readFileSync(
        path.resolve(import.meta.dirname, "..", "src", "styles", "70-home.css"), "utf8");
      expect(css).not.toMatch(/\.home-build\s*\{[^}]*display:\s*none/);
    });

    it("renders the page when version.js never loaded", () => {
      // A browser on a cached pre-versioning index.html has no BUILD global.
      const original = globalThis.BUILD;
      delete globalThis.BUILD;
      try {
        const { container } = render(<SheetHome setPage={vi.fn()} />);
        expect(container.querySelector(".home-build")).toBeNull();
        expect(container.querySelectorAll(".home-card").length).toBeGreaterThan(0);
      } finally {
        globalThis.BUILD = original;
      }
    });
  });
});

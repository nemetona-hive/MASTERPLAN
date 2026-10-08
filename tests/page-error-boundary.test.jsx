// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { PageErrorBoundary } from "../src/components/PageErrorBoundary.jsx";

function Boom({ fail }) {
  if (fail.current) throw new Error("render failed");
  return <p>page content</p>;
}

describe("PageErrorBoundary", () => {
  it("replaces a page that throws with a message, and Try again re-renders it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fail = { current: true };
    render(<PageErrorBoundary><Boom fail={fail} /></PageErrorBoundary>);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    fail.current = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("clears when keyed to another page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = { current: true }, good = { current: false };
    const { rerender } = render(<PageErrorBoundary key="a"><Boom fail={bad} /></PageErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<PageErrorBoundary key="b"><Boom fail={good} /></PageErrorBoundary>);
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

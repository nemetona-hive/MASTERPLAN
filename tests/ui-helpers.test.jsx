// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { downloadFile, Text, useModeExit } from "../src/shared.jsx";

describe("Text", () => {
  it("maps its props onto the u-* utility classes", () => {
    const { container } = render(<Text size="lg" weight="bold">hello</Text>);
    const el = container.firstChild;
    expect(el.className).toContain("u-fs-lg");
    expect(el.className).toContain("u-fw-bold");
    expect(el.textContent).toBe("hello");
  });

  it("renders a span by default and whatever `as` asks for otherwise", () => {
    const { container: span } = render(<Text>x</Text>);
    expect(span.firstChild.tagName).toBe("SPAN");
    const { container: h2 } = render(<Text as="h2">x</Text>);
    expect(h2.firstChild.tagName).toBe("H2");
  });

  it("emits no stray classes when given no modifiers", () => {
    const { container } = render(<Text>x</Text>);
    expect(container.firstChild.className).toBe("");
  });

  it("passes an explicit colour through as an inline style", () => {
    const { container } = render(<Text color="red">x</Text>);
    expect(container.firstChild.style.color).toBe("red");
  });
});

describe("downloadFile", () => {
  it("names the file, revokes the URL late, and cleans up the link", () => {
    // Revoking in the same turn as click() cancels the save in Firefox and
    // Safari before it starts, so the deferral is the behaviour under test.
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const clicked = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { clicked.push(this.download); };

    try {
      downloadFile("layout.csv", "a,b\n1,2", "text/csv");
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(clicked).toEqual(["layout.csv"]);
      // Still alive immediately after the click…
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.runAllTimers();
      // …and released on the next tick.
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
      // The temporary anchor does not linger in the document.
      expect(document.querySelector("a[download]")).toBeNull();
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
      vi.useRealTimers();
    }
  });
});

describe("useModeExit", () => {
  function Armed({ onExit, active = true }) {
    const ref = React.useRef(null);
    useModeExit([ref], onExit, active);
    return (
      <div>
        <div ref={ref} data-testid="panel">inside</div>
        <button type="button">outside</button>
      </div>
    );
  }

  it("exits on Escape", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Armed onExit={onExit} />);
    await user.keyboard("{Escape}");
    expect(onExit).toHaveBeenCalled();
  });

  it("exits on a click outside but not on one inside", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Armed onExit={onExit} />);

    await user.click(screen.getByTestId("panel"));
    expect(onExit).not.toHaveBeenCalled();

    await user.click(screen.getByText("outside"));
    expect(onExit).toHaveBeenCalled();
  });

  it("does nothing at all while inactive", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<Armed onExit={onExit} active={false} />);
    await user.keyboard("{Escape}");
    await user.click(screen.getByText("outside"));
    expect(onExit).not.toHaveBeenCalled();
  });

  it("accepts a selector for a subtree that cannot forward a ref", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    function SelectorArmed() {
      useModeExit(".armed-subtree", onExit, true);
      return (
        <div>
          <div className="armed-subtree"><span>inside</span></div>
          <button type="button">outside</button>
        </div>
      );
    }
    render(<SelectorArmed />);

    await user.click(screen.getByText("inside"));
    expect(onExit).not.toHaveBeenCalled();

    await user.click(screen.getByText("outside"));
    expect(onExit).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { React } from "../src/react-globals.js";
import { ControlPanel, DetailSection, Icon, NumInput, Row, Section, Stack } from "../src/shared.jsx";

describe("Icon", () => {
  it("resolves a name through the ICONS map from config.js", () => {
    const { container } = render(<Icon name="home" />);
    const i = container.querySelector("i");
    expect(i).toBeInTheDocument();
    expect(i.className).toContain(ICONS.home);
  });

  it("falls back to a question mark rather than rendering a blank box", () => {
    const { container } = render(<Icon name="definitely-not-an-icon" />);
    expect(container.querySelector("i").className).toContain("fa-circle-question");
  });

  it("keeps a caller's className alongside the icon class", () => {
    const { container } = render(<Icon name="home" className="nav-icon" />);
    expect(container.querySelector("i").className).toContain("nav-icon");
  });
});

describe("Stack and Row", () => {
  it("render their children", () => {
    render(<Stack><span>inside a stack</span></Stack>);
    expect(screen.getByText("inside a stack")).toBeInTheDocument();
  });

  // Row takes no children and no className — it is a fixed label/value/unit
  // triple, so these assertions cover its whole surface.
  it("renders a Row's label, value and unit", () => {
    const { container } = render(<Row label="Full panels" value={12} unit="pcs" />);
    expect(container.firstChild.className).toContain("data-row");
    expect(screen.getByText("Full panels")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("pcs")).toBeInTheDocument();
  });

  it("omits the unit span when no unit is given", () => {
    const { container } = render(<Row label="Status" value="Valid" />);
    expect(container.querySelector(".data-row-unit")).toBeNull();
  });

  it("marks a highlighted row and a danger row on the value span", () => {
    const { container: hi } = render(<Row label="Total" value={3} hi />);
    expect(hi.querySelector(".data-row-val").className).toContain("hi");

    const { container: bad } = render(<Row label="Gaps" value={1} danger />);
    expect(bad.querySelector(".data-row-lbl").className).toContain("data-row-danger");
    expect(bad.querySelector(".data-row-val").className).toContain("data-row-danger");
  });
});

// Section, ControlPanel and DetailSection are one Collapsible wearing three
// variants. Collapsible itself is not exported, so these are the real surface.
describe("Section / ControlPanel / DetailSection", () => {
  it("open by default, except the detail variant", () => {
    // A detail section is the progressive-disclosure one — it has to start shut
    // or the "primary result first" layout shows everything at once.
    render(<Section title="Surface"><p>section body</p></Section>);
    expect(screen.getByText("section body")).toBeInTheDocument();

    render(<ControlPanel title="Controls"><p>panel body</p></ControlPanel>);
    expect(screen.getByText("panel body")).toBeInTheDocument();

    render(<DetailSection title="Detail"><p>detail body</p></DetailSection>);
    expect(screen.queryByText("detail body")).not.toBeInTheDocument();
  });

  it("toggles on a click of the head", async () => {
    const user = userEvent.setup();
    render(<Section title="Surface"><p>section body</p></Section>);

    await user.click(screen.getByText("Surface"));
    expect(screen.queryByText("section body")).not.toBeInTheDocument();
    await user.click(screen.getByText("Surface"));
    expect(screen.getByText("section body")).toBeInTheDocument();
  });

  it("stays open and offers no toggle when noToggle is set", async () => {
    const user = userEvent.setup();
    render(<Section title="Surface" noToggle><p>section body</p></Section>);
    await user.click(screen.getByText("Surface"));
    expect(screen.getByText("section body")).toBeInTheDocument();
  });

  it("lets a parent drive it when given open and setOpen", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [open, setOpen] = React.useState(false);
      return <Section title="Surface" open={open} setOpen={setOpen}><p>section body</p></Section>;
    }
    render(<Controlled />);
    expect(screen.queryByText("section body")).not.toBeInTheDocument();
    await user.click(screen.getByText("Surface"));
    expect(screen.getByText("section body")).toBeInTheDocument();
  });

  it("marks the panel variant with its own class, since the stylesheet keys off it", () => {
    const { container } = render(<ControlPanel title="Controls"><i /></ControlPanel>);
    expect(container.querySelector(".control-panel")).toBeTruthy();
  });
});

describe("NumInput", () => {
  it("shows the value it is given", () => {
    render(<NumInput value={1200} onChange={() => {}} />);
    expect(screen.getByDisplayValue("1200")).toBeInTheDocument();
  });

  it("does not commit while typing — only on blur", async () => {
    // Committing per keystroke would recompute the whole layout on every digit,
    // and "3" on the way to "300" is a valid number that clamps to the minimum.
    const user = userEvent.setup();
    const seen = [];
    render(<NumInput value={1200} onChange={v => seen.push(v)} min={0} max={5000} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "300");
    expect(seen).toEqual([]);

    await user.tab();
    expect(seen).toEqual([300]);
  });

  it("clamps a committed value into range", async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<NumInput value={1200} onChange={v => seen.push(v)} min={100} max={2000} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "9999");
    await user.tab();
    expect(seen).toEqual([2000]);
  });

  it("keeps an emptied field empty rather than snapping it to the minimum", async () => {
    const user = userEvent.setup();
    const seen = [];
    render(<NumInput value={1200} onChange={v => seen.push(v)} min={100} max={2000} />);

    await user.clear(screen.getByRole("textbox"));
    await user.tab();
    expect(seen).toEqual([""]);
  });

  it("leaves the value alone when the arrow keys are pressed", async () => {
    // The reason the field is text rather than number: a number input steps its
    // value on every ArrowUp and ArrowDown, so reaching for the caret rewrote a
    // dimension the whole layout is drawn from, with nothing on screen saying so.
    const user = userEvent.setup();
    const seen = [];
    render(<NumInput value={1200} onChange={v => seen.push(v)} min={0} max={5000} />);

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(input).toHaveDisplayValue("1200");

    await user.tab();
    expect(seen).toEqual([1200]);
  });

  it("ignores characters a number cannot contain", async () => {
    // A text field takes letters, and Number("12a") is NaN — which the commit
    // reads as "restore the old value", losing everything typed with it.
    const user = userEvent.setup();
    const seen = [];
    render(<NumInput value={1200} onChange={v => seen.push(v)} min={0} max={5000} />);

    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "3e0a0");
    expect(input).toHaveDisplayValue("300");

    await user.tab();
    expect(seen).toEqual([300]);
  });
});

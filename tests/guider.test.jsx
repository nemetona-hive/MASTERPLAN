// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { SheetGuider } from "../src/components/Guider.jsx";
import { DraftStore, SessionDraftContext } from "../src/utils/session-state.js";
import { pageOfDraft } from "../src/utils/project-pages.js";

/* The Guider page's shell: the entry list and the two switch guides. The pipe
   offset calculator behind Vihmaveesüsteemid is tests/downpipe-offset.test.jsx. */
const withDrafts = drafts => <SessionDraftContext.Provider value={drafts}><SheetGuider /></SessionDraftContext.Provider>;
const entry = name => screen.getByRole("button", { name });

describe("the guider page", () => {
  it("says which entry is open, to a screen reader as well as on screen", () => {
    render(<SheetGuider />);
    expect(entry("Lihtlüliti").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(entry("Lihtlüliti"));
    expect(entry("Lihtlüliti").getAttribute("aria-pressed")).toBe("true");
    expect(entry("Veksellüliti").getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the open entry with the page's values, so a project reopens on it", () => {
    const drafts = new DraftStore();
    render(withDrafts(drafts));
    fireEvent.click(entry("Vihmaveesüsteemid"));
    const key = [...drafts.keys()].find(k => drafts.get(k) === "vihmaveesusteemid");
    expect(pageOfDraft(key)).toBe("guider");
    cleanup();
    render(withDrafts(drafts));
    expect(screen.getByText("Toru põlv 70°")).toBeTruthy();
  });

  it("names each wiring diagram as an image", () => {
    render(<SheetGuider />);
    fireEvent.click(entry("Lihtlüliti"));
    expect(screen.getByRole("img", { name: "Valgusti ja lüliti skeem" })).toBeTruthy();
    fireEvent.click(entry("Veksellüliti"));
    expect(screen.getByRole("img", { name: "Veksellüliti skeem" })).toBeTruthy();
  });

  it("lists the connections in order, each dot in its wire's colour", () => {
    render(<SheetGuider />);
    fireEvent.click(entry("Veksellüliti"));
    const rows = [...document.querySelectorAll(".guider-conn-row")];
    expect(rows.map(r => r.querySelector(".guider-conn-num").textContent)).toEqual(["1", "2", "3", "4", "5"]);
    expect(rows[2].querySelector(".guider-conn-dot--traveller")).toBeTruthy();
    expect(rows[4].querySelector(".guider-conn-dot--neutral")).toBeTruthy();
  });

  it("closes an entry on a second click", () => {
    render(<SheetGuider />);
    fireEvent.click(entry("Lihtlüliti"));
    fireEvent.click(entry("Lihtlüliti"));
    expect(screen.getByText("No entry selected. Pick one from the panel on the left.")).toBeTruthy();
  });
});

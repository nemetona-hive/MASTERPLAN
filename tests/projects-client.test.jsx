// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { DraftStore } from "../src/utils/session-state.js";
import { createAutosaver, probeProjects } from "../src/utils/projects.js";
import { ProjectContext, ProjectSection } from "../src/components/ProjectMenu.jsx";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("the draft store", () => {
  it("tells listeners about a real change only", () => {
    const store = new DraftStore();
    const seen = [];
    store.subscribe(key => seen.push(key));
    store.set("a", 1);
    store.set("a", 1);
    store.set("a", 2);
    expect(seen).toEqual(["a", "a"]);
  });

  it("counts a key as edited only when a later write changes it", () => {
    const store = new DraftStore([["Gypsum.jsx:rooms", ["mounted"]]]);
    const gypsum = key => key.startsWith("Gypsum.jsx:");
    // A page putting down its starting values is not an edit.
    store.set("Gypsum.jsx:closed", {});
    store.set("Gypsum.jsx:rooms", store.get("Gypsum.jsx:rooms"));
    expect(store.hasEdits(gypsum)).toBe(false);
    store.set("Concrete.jsx:lenMm", "1");
    store.set("Concrete.jsx:lenMm", "2");
    expect(store.hasEdits(gypsum)).toBe(false);
    store.set("Gypsum.jsx:rooms", ["typed"]);
    expect(store.hasEdits(gypsum)).toBe(true);
    // Saved or replaced: clean again, and only for that page.
    store.markClean(gypsum);
    expect(store.hasEdits(gypsum)).toBe(false);
    expect(store.hasEdits(key => key.startsWith("Concrete.jsx:"))).toBe(true);
    store.set("Gypsum.jsx:rooms", ["again"]);
    store.replaceWhere(gypsum, {});
    expect(store.hasEdits(gypsum)).toBe(false);
  });

  it("is replaced wholesale when a project opens", () => {
    const store = new DraftStore([["old", 1]]);
    store.replaceAll({ fresh: 2 });
    expect(store.toJSON()).toEqual({ fresh: 2 });
  });
});

describe("the autosaver", () => {
  const setup = () => {
    let state = { v: 0 };
    const saves = [];
    let release;
    const save = vi.fn(body => { saves.push(body); return new Promise(r => { release = r; }); });
    const saver = createAutosaver({ save, read: () => state, delay: 100 });
    return { saver, saves, save, set: v => { state = { v }; }, finish: () => release() };
  };

  it("saves once after typing stops", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.set(1); t.saver.schedule();
    t.set(2); t.saver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(t.saves).toEqual([{ v: 2 }]);
  });

  it("never runs two saves at once, and saves a change made during one", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.set(1); t.saver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    t.set(2); t.saver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(t.save).toHaveBeenCalledTimes(1);
    t.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saves.map(s => s.v)).toEqual([1, 2]);
  });

  it("does not resend what is already on disk", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.saver.markSaved({ v: 0 });
    t.saver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    expect(t.save).not.toHaveBeenCalled();
  });

  it("has nothing unsaved until something changes, for the save on leaving", async () => {
    vi.useFakeTimers();
    const t = setup();
    t.saver.markSaved({ v: 0 });
    expect(t.saver.unsaved()).toBeNull();
    t.set(1);
    expect(t.saver.unsaved()).toEqual({ v: 1 });
    t.saver.schedule();
    await vi.advanceTimersByTimeAsync(100);
    t.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.saver.unsaved()).toBeNull();
  });

  it("reports a failed save and recovers on the next", async () => {
    const statuses = [];
    let fail = true;
    let state = { v: 1 };
    const saver = createAutosaver({
      save: async () => { if (fail) throw new Error("disk full"); },
      read: () => state, onStatus: err => statuses.push(err ? err.message : null), delay: 1
    });
    await saver.flush();
    fail = false; state = { v: 2 };
    await saver.flush();
    expect(statuses).toEqual(["disk full", null]);
  });
});

describe("local mode", () => {
  it("is off when the server has no project routes", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 404, json: async () => { throw new Error("html"); } }));
    expect(await probeProjects()).toBe(null);
  });

  it("is off under the browser checks' static server, which answers 204", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 204, json: async () => { throw new Error("no body"); } }));
    expect(await probeProjects()).toBe(null);
  });

  it("is on when the server lists projects", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => [] }));
    expect(await probeProjects()).toEqual([]);
  });
});

/* A page's section, as App provides it: this page's controls through the context. */
const ProjectMenu = ({ variant, ...p }) => (
  <ProjectContext.Provider value={{ available: true, page: "gypsum", title: "Gypsum", projects: p.projects, project: p.project,
    saveError: p.saveError, scratchHasValues: p.scratchHasValues, create: p.onCreate, open: p.onOpen,
    close: p.onCloseProject, remove: p.onDelete, rename: p.onRename, refresh: p.onRefresh }}>
    <ProjectSection variant={variant} />
  </ProjectContext.Provider>
);

describe("a page's project section", () => {
  const props = over => ({
    projects: [{ id: "kitchen", name: "Kitchen", savedAt: "2026-11-04T10:00:00Z" }],
    project: null, saveError: "", scratchHasValues: false,
    onCreate: vi.fn(async () => {}), onOpen: vi.fn(async () => {}), onCloseProject: vi.fn(async () => {}),
    onDelete: vi.fn(async () => {}), onRename: vi.fn(async () => {}), onRefresh: vi.fn(), ...over
  });

  it("says when no project is open", () => {
    render(<ProjectMenu {...props()} />);
    expect(screen.getByText("No project")).toBeTruthy();
    // On a card the button is in the head, beside the title.
    expect(document.querySelector("#control-project .panel-head button").textContent.trim()).toBe("Projects");
  });

  it("creates a blank project", async () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    expect(screen.getByText("New blank project")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Bathroom" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith("Bathroom"));
  });

  it("asks before a blank project clears unsaved values", async () => {
    const p = props({ scratchHasValues: true });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Bathroom" } });
    fireEvent.click(screen.getByText("Create"));
    expect(p.onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Clear screen?"));
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith("Bathroom"));
  });

  it("does not ask over a page nobody has edited", async () => {
    const unsaved = vi.fn(() => false);
    const p = props({ scratchHasValues: unsaved });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.click(screen.getByLabelText("Open Kitchen"));
    await waitFor(() => expect(p.onOpen).toHaveBeenCalledWith("kitchen"));
    // Asked at the click, not when the section rendered.
    expect(unsaved).toHaveBeenCalled();
  });

  it("does not ask with a project open: its values are saved", async () => {
    const p = props({ scratchHasValues: true, project: { id: "kitchen", name: "Kitchen" } });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Bathroom" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith("Bathroom"));
  });

  it("asks before opening over unsaved values", async () => {
    const p = props({ scratchHasValues: true });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.click(screen.getByLabelText("Open Kitchen"));
    expect(p.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Replace screen?"));
    await waitFor(() => expect(p.onOpen).toHaveBeenCalledWith("kitchen"));
  });

  it("deletes on the second click only", async () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.click(screen.getByLabelText("Delete Kitchen"));
    expect(p.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Confirm delete Kitchen"));
    await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith("kitchen"));
  });

  it("renames in place: Enter saves, Escape cancels", async () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.click(screen.getByLabelText("Rename Kitchen"));
    const field = screen.getByLabelText("New name for Kitchen");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByLabelText("New name for Kitchen")).toBe(null);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Rename Kitchen"));
    fireEvent.change(screen.getByLabelText("New name for Kitchen"), { target: { value: "Kitchen 2" } });
    fireEvent.submit(screen.getByLabelText("New name for Kitchen").closest("form"));
    await waitFor(() => expect(p.onRename).toHaveBeenCalledWith("kitchen", "Kitchen 2"));
    await waitFor(() => expect(screen.queryByLabelText("New name for Kitchen")).toBe(null));
  });

  it("keeps the field open and says why when a rename fails", async () => {
    const p = props({ onRename: vi.fn(async () => { throw new Error("disk full"); }) });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("Projects"));
    fireEvent.click(screen.getByLabelText("Rename Kitchen"));
    fireEvent.submit(screen.getByLabelText("New name for Kitchen").closest("form"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("disk full"));
    expect(screen.getByLabelText("New name for Kitchen")).toBeTruthy();
  });

  it("names the open project and turns to an error when a save fails", () => {
    render(<ProjectMenu {...props({ project: { id: "kitchen", name: "Kitchen" }, saveError: "disk full" })} />);
    expect(screen.getByText("Kitchen").className).toContain("is-error");
    expect(screen.getByRole("alert").textContent).toBe("Not saved: disk full");
  });

  it("titles the dialog with its page, and is a section on a calculator page", () => {
    render(<ProjectMenu variant="section" {...props()} />);
    const head = document.querySelector(".section .section-head");
    expect(head.firstChild.textContent).toBe("Project");
    // The button sits in the head, so the name below has the whole width.
    expect(head.querySelector("button").textContent.trim()).toBe("Projects");
    expect(head.contains(screen.getByText("No project"))).toBe(false);
    fireEvent.click(screen.getByText("Projects"));
    expect(screen.getByRole("dialog").textContent).toContain("Gypsum projects");
  });

  it("is nothing without a project server", () => {
    const { container } = render(<ProjectSection />);
    expect(container.innerHTML).toBe("");
  });
});

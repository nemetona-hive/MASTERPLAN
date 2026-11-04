// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { DraftStore } from "../src/utils/session-state.js";
import { createAutosaver, probeProjects } from "../src/utils/projects.js";
import { ProjectMenu } from "../src/components/ProjectMenu.jsx";

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

describe("the project control", () => {
  const props = over => ({
    projects: [{ id: "kitchen", name: "Kitchen", savedAt: "2026-11-04T10:00:00Z" }],
    project: null, saveError: "", scratchHasValues: false,
    onCreate: vi.fn(async () => {}), onOpen: vi.fn(async () => {}), onCloseProject: vi.fn(async () => {}),
    onDelete: vi.fn(async () => {}), onRefresh: vi.fn(), ...over
  });

  it("says when no project is open", () => {
    render(<ProjectMenu {...props()} />);
    expect(screen.getByText("No project")).toBeTruthy();
  });

  it("creates a project from what is on screen", async () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("No project"));
    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Bathroom" } });
    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => expect(p.onCreate).toHaveBeenCalledWith("Bathroom"));
  });

  it("asks before opening over unsaved values", async () => {
    const p = props({ scratchHasValues: true });
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("No project"));
    fireEvent.click(screen.getByLabelText("Open Kitchen"));
    expect(p.onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Replace screen?"));
    await waitFor(() => expect(p.onOpen).toHaveBeenCalledWith("kitchen"));
  });

  it("deletes on the second click only", async () => {
    const p = props();
    render(<ProjectMenu {...p} />);
    fireEvent.click(screen.getByText("No project"));
    fireEvent.click(screen.getByLabelText("Delete Kitchen"));
    expect(p.onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Confirm delete Kitchen"));
    await waitFor(() => expect(p.onDelete).toHaveBeenCalledWith("kitchen"));
  });

  it("names the open project and turns to an error when a save fails", () => {
    render(<ProjectMenu {...props({ project: { id: "kitchen", name: "Kitchen" }, saveError: "disk full" })} />);
    const button = screen.getByText("Kitchen").closest("button");
    expect(button.className).toContain("is-error");
    expect(button.getAttribute("title")).toBe("Not saved: disk full");
  });
});

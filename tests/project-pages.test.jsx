// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { render, act, waitFor } from "@testing-library/react";
import { React } from "../src/react-globals.js";
import { DraftStore } from "../src/utils/session-state.js";
import { PROJECT_PAGES, pageDrafts, pageOfDraft, splitLegacyProject } from "../src/utils/project-pages.js";
import { useProjects } from "../src/useProjects.js";

/* Projects are per page: which values each page owns, and that a page's
   project saves and opens only those. */

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

/* Every draft key the source writes, so a new page cannot go unsaved. */
function draftKeysInSource() {
  const keys = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!/\.jsx?$/.test(entry.name)) continue;
      const text = fs.readFileSync(file, "utf8");
      const prefix = (text.match(/const KEY = (?:name => )?[`"]([^`"$]+)/) || [])[1];
      for (const m of text.matchAll(/useSessionState\(\s*(?:"([^"]+)"|KEY)/g)) keys.push(m[1] || prefix);
    }
  };
  walk(path.resolve(__dirname, "../src/components"));
  return keys;
}

describe("which page owns what", () => {
  it("gives every draft key in the source a page", () => {
    const keys = draftKeysInSource();
    // A floor, so a scanner that stopped finding keys cannot pass by finding none.
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter(key => !pageOfDraft(key))).toEqual([]);
  });

  it("names only real pages", () => {
    const ids = PAGES.map(p => p.id);
    expect(Object.keys(PROJECT_PAGES).filter(id => !ids.includes(id))).toEqual([]);
  });

  it("splits a project that held every page into one per page with something in it", () => {
    const parts = splitLegacyProject({
      drafts: { "Gypsum.jsx:rooms": [1], "Concrete.jsx:lenMm": "4000", "Stray:key": 1 },
      app: { sh: { W: 1 }, sym: { a: 1 }, nav: true }
    }, { sh: { W: 1 }, sym: { a: 2 } });
    expect(parts).toEqual([
      { page: "symmetric-layout", drafts: {}, app: { sym: { a: 1 } } },
      { page: "concrete", drafts: { "Concrete.jsx:lenMm": "4000" }, app: {} },
      { page: "gypsum", drafts: { "Gypsum.jsx:rooms": [1] }, app: {} }
    ]);
  });
});

/* An in-memory /api/projects, enough for the hook. */
function fakeServer(files = {}, { stale = false } = {}) {
  const store = { ...files };
  const calls = [];
  let n = 0;
  const reply = data => ({ ok: true, status: 200, json: async () => data });
  vi.stubGlobal("fetch", async (url, { method = "GET", body } = {}) => {
    const id = decodeURIComponent(url.split("/api/projects")[1].replace(/^\//, ""));
    const data = body ? JSON.parse(body) : null;
    calls.push({ method, id, data });
    if (method === "GET" && !id) return reply(Object.values(store).map(d => ({ id: d.id, name: d.name, page: d.page ?? null })));
    if (method === "GET") return reply(store[id]);
    if (method === "POST") {
      const doc = { id: `p${++n}`, ...data };
      if (stale) delete doc.page;   // a server from before projects were per page
      store[doc.id] = doc; return reply(doc);
    }
    if (method === "PUT") { store[id] = { id, ...data }; return reply(store[id]); }
    if (method === "DELETE") { delete store[id]; return reply({ id }); }
    return reply(null);
  });
  return { store, calls };
}

function Harness({ drafts, onApi }) {
  const api = useProjects({ drafts, appState: {}, applyAppState: () => {} });
  onApi(api);
  return null;
}
const mount = drafts => {
  const ref = { current: null };
  render(<Harness drafts={drafts} onApi={api => { ref.current = api; }} />);
  return ref;
};

describe("a page's projects", () => {
  it("opens one page's project without touching another page's values", async () => {
    const server = fakeServer({
      kitchen: { id: "kitchen", name: "Kitchen", page: "gypsum", drafts: { "Gypsum.jsx:rooms": ["saved"] }, app: {} }
    });
    const drafts = new DraftStore([["Gypsum.jsx:rooms", ["typed"]], ["Concrete.jsx:lenMm", "4000"]]);
    const api = mount(drafts);
    await waitFor(() => expect(api.current.available).toBe(true));
    expect(api.current.forPage("gypsum").projects.map(p => p.id)).toEqual(["kitchen"]);
    expect(api.current.forPage("concrete").projects).toEqual([]);
    await act(() => api.current.forPage("gypsum").open("kitchen"));
    expect(drafts.get("Gypsum.jsx:rooms")).toEqual(["saved"]);
    expect(drafts.get("Concrete.jsx:lenMm")).toBe("4000");
    expect(api.current.forPage("gypsum").project.name).toBe("Kitchen");
    expect(api.current.forPage("concrete").project).toBe(null);
    expect(server.calls.filter(c => c.method === "PUT")).toEqual([]);
  });

  it("saves a change to the page it belongs to, holding only that page's values", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server = fakeServer();
    const drafts = new DraftStore([["Concrete.jsx:lenMm", "4000"]]);
    const api = mount(drafts);
    await waitFor(() => expect(api.current.available).toBe(true));
    await act(() => api.current.forPage("gypsum").create("Kitchen"));
    const made = server.calls.find(c => c.method === "POST").data;
    expect(made).toMatchObject({ name: "Kitchen", page: "gypsum", drafts: {} });
    act(() => { drafts.set("Concrete.jsx:lenMm", "5000"); });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(server.calls.filter(c => c.method === "PUT")).toEqual([]);
    act(() => { drafts.set("Gypsum.jsx:rooms", ["new"]); });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    const puts = server.calls.filter(c => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].data.drafts).toEqual(pageDrafts(drafts, "gypsum"));
  });

  it("says a page has unsaved work only once a value on it was edited", async () => {
    fakeServer({ kitchen: { id: "kitchen", name: "Kitchen", page: "gypsum", drafts: {}, app: {} } });
    const drafts = new DraftStore();
    const api = mount(drafts);
    await waitFor(() => expect(api.current.available).toBe(true));
    const unsaved = () => api.current.forPage("gypsum").scratchHasValues();
    act(() => { drafts.set("Gypsum.jsx:rooms", ["start"]); drafts.set("Gypsum.jsx:closed", {}); });
    expect(unsaved()).toBe(false);
    // Folding a card is how the page is looked at, not work.
    act(() => { drafts.set("Gypsum.jsx:closed", { "control-gyp-board": true }); });
    expect(unsaved()).toBe(false);
    act(() => { drafts.set("Gypsum.jsx:rooms", ["typed"]); });
    expect(unsaved()).toBe(true);
    expect(api.current.forPage("concrete").scratchHasValues()).toBe(false);
    // Open, edit, close: what stays on screen is saved in the project.
    await act(() => api.current.forPage("gypsum").open("kitchen"));
    act(() => { drafts.set("Gypsum.jsx:rooms", ["start"]); drafts.set("Gypsum.jsx:rooms", ["more"]); });
    await act(() => api.current.forPage("gypsum").close());
    expect(unsaved()).toBe(false);
  });

  it("starts a new project blank, clearing only its own page", async () => {
    const server = fakeServer({
      kitchen: { id: "kitchen", name: "Kitchen", page: "gypsum", drafts: { "Gypsum.jsx:rooms": ["saved"] }, app: {} }
    });
    const drafts = new DraftStore([["Concrete.jsx:lenMm", "4000"]]);
    const api = mount(drafts);
    await waitFor(() => expect(api.current.available).toBe(true));
    await act(() => api.current.forPage("gypsum").open("kitchen"));
    const epoch = api.current.epochs.gypsum;
    await act(() => api.current.forPage("gypsum").create("Hall"));
    const made = server.calls.filter(c => c.method === "POST").at(-1).data;
    expect(made).toMatchObject({ name: "Hall", page: "gypsum", drafts: {} });
    expect(drafts.get("Gypsum.jsx:rooms")).toBe(undefined);
    expect(drafts.get("Concrete.jsx:lenMm")).toBe("4000");
    expect(api.current.forPage("gypsum").project.name).toBe("Hall");
    expect(api.current.epochs.gypsum).toBe(epoch + 1);
    // The project it left keeps what it had.
    expect(server.store.kitchen.drafts).toEqual({ "Gypsum.jsx:rooms": ["saved"] });
  });

  it("splits a project from before, and reopens each part where it was open", async () => {
    localStorage.setItem("masterplan.project", "old");
    const server = fakeServer({
      old: { id: "old", name: "Jõe tn 10", drafts: { "Gypsum.jsx:rooms": ["g"], "Concrete.jsx:lenMm": "4000" }, app: {} }
    });
    const drafts = new DraftStore();
    const api = mount(drafts);
    await waitFor(() => expect(api.current.forPage("concrete").project?.name).toBe("Jõe tn 10"));
    expect(api.current.forPage("gypsum").project?.name).toBe("Jõe tn 10");
    expect(server.store.old).toBe(undefined);
    expect(Object.values(server.store).map(d => d.page).sort()).toEqual(["concrete", "gypsum"]);
    expect(drafts.get("Gypsum.jsx:rooms")).toEqual(["g"]);
    expect(localStorage.getItem("masterplan.project")).toBe(null);
  });

  it("keeps an old project whole when the server drops the page", async () => {
    const server = fakeServer({
      old: { id: "old", name: "Jõe tn 10", drafts: { "Concrete.jsx:lenMm": "4000" }, app: {} }
    }, { stale: true });
    const api = mount(new DraftStore());
    await waitFor(() => expect(api.current.available).toBe(true));
    await waitFor(() => expect(server.calls.some(c => c.method === "DELETE")).toBe(true));
    expect(Object.keys(server.store)).toEqual(["old"]);
  });
});

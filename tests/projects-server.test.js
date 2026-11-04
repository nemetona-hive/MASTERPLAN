import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { createRequestHandler } from "../scripts/local-dev-server.js";
import { slug } from "../scripts/project-store.js";

/* The project routes on the dev server, against a throwaway root. Same
   request double as local-server.test.js. */

let root, handler, clock;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "masterplan-projects-"));
  fs.writeFileSync(path.join(root, "index.html"), "fixture");
  clock = Date.parse("2026-11-04T10:00:00Z");
  handler = createRequestHandler({ rootDir: root, now: () => new Date((clock += 1000)) });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

function request({ method = "GET", url = "/api/projects", body, headers = {} } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { method, url, headers: { host: "localhost:3005", "content-type": "application/json", ...headers } });
  const response = { code: null, body: "", json: null };
  handler(req, {
    writeHead(code) { response.code = code; },
    end(text) { response.body = text?.toString() || ""; try { response.json = JSON.parse(response.body); } catch { /* not JSON */ } }
  });
  if (body !== undefined) req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
  req.emit("end");
  return response;
}
const project = (over = {}) => ({ name: "Kitchen", drafts: { "Gypsum.jsx:mode": "room" }, app: { sh: { W: 1 } }, ...over });
const dir = () => path.join(root, "_personal", "projects");

describe("projects on the local server", () => {
  it("starts with none", () => {
    expect(request().json).toEqual([]);
  });

  it("creates a project as a private file named after it", () => {
    const res = request({ method: "POST", body: project() });
    expect(res.code).toBe(200);
    expect(res.json).toMatchObject({ id: "kitchen", name: "Kitchen", version: 1 });
    const file = path.join(dir(), "kitchen.json");
    expect(JSON.parse(fs.readFileSync(file, "utf8")).drafts).toEqual({ "Gypsum.jsx:mode": "room" });
    if (process.platform !== "win32") expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });

  it("gives a second project of the same name its own file", () => {
    request({ method: "POST", body: project() });
    expect(request({ method: "POST", body: project() }).json.id).toBe("kitchen-2");
  });

  it("saves over an existing project and lists newest first", () => {
    request({ method: "POST", body: project() });
    request({ method: "POST", body: project({ name: "Bathroom" }) });
    const saved = request({ method: "PUT", url: "/api/projects/kitchen", body: project({ drafts: { k: 2 } }) });
    expect(saved.code).toBe(200);
    expect(request({ url: "/api/projects/kitchen" }).json.drafts).toEqual({ k: 2 });
    expect(request().json.map(p => p.id)).toEqual(["kitchen", "bathroom"]);
  });

  it("never creates a project by saving to one that does not exist", () => {
    expect(request({ method: "PUT", url: "/api/projects/ghost", body: project() }).code).toBe(404);
    expect(fs.existsSync(path.join(dir(), "ghost.json"))).toBe(false);
  });

  it("renames a project in place, keeping its file and values", () => {
    request({ method: "POST", body: project() });
    const res = request({ method: "PATCH", url: "/api/projects/kitchen", body: { name: "  Kitchen   floor 2 " } });
    expect(res.code).toBe(200);
    expect(res.json).toMatchObject({ id: "kitchen", name: "Kitchen floor 2" });
    expect(request({ url: "/api/projects/kitchen" }).json.drafts).toEqual({ "Gypsum.jsx:mode": "room" });
    expect(fs.readdirSync(dir())).toEqual(["kitchen.json"]);
  });

  it("refuses an empty new name, and a rename of nothing", () => {
    request({ method: "POST", body: project() });
    expect(request({ method: "PATCH", url: "/api/projects/kitchen", body: { name: " " } }).code).toBe(400);
    expect(request({ method: "PATCH", url: "/api/projects/ghost", body: { name: "x" } }).code).toBe(404);
  });

  it("moves a deleted project to the trash rather than erasing it", () => {
    request({ method: "POST", body: project() });
    expect(request({ method: "DELETE", url: "/api/projects/kitchen" }).code).toBe(200);
    expect(request().json).toEqual([]);
    expect(fs.readdirSync(path.join(dir(), ".trash"))).toHaveLength(1);
  });

  it("keeps the sidebar choice with the App state", () => {
    request({ method: "POST", body: project({ app: { sh: {}, nav: false } }) });
    expect(request({ url: "/api/projects/kitchen" }).json.app).toEqual({ sh: {}, nav: false });
  });

  it("keeps only the App state it restores", () => {
    request({ method: "POST", body: project({ app: { sh: {}, theme: "x", evil: 1 } }) });
    expect(Object.keys(request({ url: "/api/projects/kitchen" }).json.app)).toEqual(["sh"]);
  });

  it("refuses bad ids, names and bodies", () => {
    expect(request({ url: "/api/projects/..%2Fconfig" }).code).toBe(400);
    expect(request({ url: "/api/projects/a/b" }).code).toBe(400);
    expect(request({ method: "POST", body: project({ name: "  " }) }).code).toBe(400);
    expect(request({ method: "POST", body: project({ name: "x".repeat(81) }) }).code).toBe(400);
    expect(request({ method: "POST", body: project({ drafts: [] }) }).code).toBe(400);
    expect(request({ method: "POST", body: "{" }).code).toBe(400);
    expect(request({ method: "POST", body: project(), headers: { "content-type": "text/plain" } }).code).toBe(415);
    expect(request({ method: "PATCH" }).code).toBe(405);
  });

  it("guards reads as well as writes against other origins", () => {
    request({ method: "POST", body: project() });
    expect(request({ headers: { origin: "http://example.com" } }).code).toBe(403);
    expect(request({ url: "/api/projects/kitchen", headers: { host: "evil.test" } }).code).toBe(403);
  });

  it("keeps the page a project belongs to, through a save and a rename", () => {
    request({ method: "POST", body: project({ page: "gypsum" }) });
    request({ method: "PUT", url: "/api/projects/kitchen", body: project({ page: "gypsum" }) });
    request({ method: "PATCH", url: "/api/projects/kitchen", body: { name: "Kitchen 2" } });
    expect(request().json[0]).toMatchObject({ id: "kitchen", name: "Kitchen 2", page: "gypsum" });
    expect(request({ url: "/api/projects/kitchen" }).json.page).toBe("gypsum");
  });

  it("refuses a page that is not a page id", () => {
    expect(request({ method: "POST", body: project({ page: "../x" }) }).code).toBe(400);
    expect(request({ method: "POST", body: project({ page: 3 }) }).code).toBe(400);
  });

  it("lists a damaged file instead of hiding it", () => {
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(path.join(dir(), "broken.json"), "{ not json");
    expect(request().json).toEqual([{ id: "broken", name: "broken", page: null, savedAt: null, unreadable: true }]);
    expect(request({ url: "/api/projects/broken" }).code).toBe(422);
  });

  it("refuses a project file that is a symlink", () => {
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(path.join(root, "outside.json"), JSON.stringify(project()));
    fs.symlinkSync(path.join(root, "outside.json"), path.join(dir(), "link.json"));
    expect(request({ url: "/api/projects/link" }).code).toBe(403);
    expect(request({ method: "PUT", url: "/api/projects/link", body: project() }).code).toBe(403);
  });

  it("never serves project files as static files", () => {
    request({ method: "POST", body: project() });
    expect(request({ url: "/_personal/projects/kitchen.json" }).code).toBe(403);
  });

  it("makes a filename from any name", () => {
    expect(slug("Köök — 2. korrus")).toBe("kook-2-korrus");
    expect(slug("!!!")).toBe("project");
  });
});

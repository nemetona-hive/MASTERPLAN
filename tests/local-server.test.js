import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import vm from "node:vm";
import { createRequestHandler, MAX_BODY_BYTES } from "../scripts/local-dev-server.js";

let root, handler;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "masterplan-server-"));
  fs.writeFileSync(path.join(root, "config.js"), 'const DEFAULT_CONCRETE_PRESETS = [];\nconst DEFAULT_SURFACE_PRESETS = [];\nconst DEFAULT_SH = {};');
  fs.writeFileSync(path.join(root, "index.html"), "fixture");
  fs.mkdirSync(path.join(root, "assets"));
  fs.mkdirSync(path.join(root, ".git"));
  fs.writeFileSync(path.join(root, ".git", "config"), "private fixture");
  handler = createRequestHandler({ rootDir: root });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function request({ method = "GET", url = "/", body, headers = {}, aborted = false } = {}) {
  const req = new EventEmitter();
  Object.assign(req, { method, url, headers: { host: "localhost:3005", "content-type": "application/json", ...headers } });
  const response = { code: null, body: "", headers: null };
  handler(req, {
    writeHead(code, headers) { response.code = code; response.headers = headers; },
    end(body) { response.body = body?.toString() || ""; }
  });
  if (body !== undefined) req.emit("data", Buffer.from(typeof body === "string" ? body : JSON.stringify(body)));
  if (aborted) req.emit("aborted");
  req.emit("end");
  return response;
}
const save = overrides => request({ method: "POST", url: "/api/save-defaults",
  body: { key: "concretePresets", value: [{ name: "Example", rate: "1,7", bagKg: 25, bagPrice: 4 }] }, ...overrides });

describe("isolated local server", () => {
  it("serves public assets and handles unsupported methods", () => {
    expect(request().body).toBe("fixture");
    expect(request({ method: "HEAD" }).body).toBe("");
    expect(request({ method: "PUT" }).code).toBe(405);
  });
  it("rejects foreign hosts and cross-origin writes, including other local ports", () => {
    expect(request({ headers: { host: "example.com" } }).code).toBe(403);
    expect(save({ headers: { origin: "http://example.com" } }).code).toBe(403);
    expect(save({ headers: { origin: "http://localhost:9999" } }).code).toBe(403);
    expect(save({ headers: { origin: "http://localhost:3005" } }).code).toBe(200);
  });
  it("rejects traversal, private files and symlink targets", () => {
    for (const url of ["/.git/config", "/../MASTERPLAN-sibling/file", "/%2e%2e/private", "/package.json", "/src/App.jsx"]) {
      expect(request({ url }).code, url).toBe(403);
    }
    fs.symlinkSync(path.join(root, ".git", "config"), path.join(root, "assets", "escape"));
    expect(request({ url: "/assets/escape" }).code).toBe(403);
    expect(request({ url: "/%ZZ" }).code).toBe(400);
  });
  it("validates JSON, shape, keys, decimals and content type", () => {
    expect(save({ body: "{" }).code).toBe(400);
    expect(save({ body: "null" }).code).toBe(400);
    expect(save({ body: { key: "constructor", value: [] } }).code).toBe(400);
    expect(save({ body: { key: "shDefaults", value: { W: 100 } } }).code).toBe(400);
    expect(save({ body: { key: "symDefaults", value: { roomWidth: 100 } } }).code).toBe(400);
    expect(save({ body: { key: "surfacePresets", value: [{ name: "Room A", width: 1390, length: 2200 }] } }).code).toBe(200);
    expect(save({ headers: { "content-type": "text/plain" } }).code).toBe(415);
    expect(save({ body: { key: "concretePresets", value: [{ rate: "1kg", bagKg: 25 }] } }).code).toBe(400);
    expect(save().code).toBe(200);
    const source = fs.readFileSync(path.join(root, "config.js"), "utf8");
    expect(vm.runInNewContext(source + ';DEFAULT_CONCRETE_PRESETS[0].rate')).toBe(1.7);
  });
  it("does not write oversized or aborted requests", () => {
    const previous = fs.readFileSync(path.join(root, "config.js"), "utf8");
    expect(save({ body: "x".repeat(MAX_BODY_BYTES + 1) }).code).toBe(413);
    save({ aborted: true });
    expect(fs.readFileSync(path.join(root, "config.js"), "utf8")).toBe(previous);
  });
  it("retains the previous source and removes temporary files when replacement fails", () => {
    const previous = fs.readFileSync(path.join(root, "config.js"), "utf8");
    handler = createRequestHandler({ rootDir: root, io: { ...fs, renameSync() { throw new Error("disk failure"); } } });
    expect(save().code).toBe(500);
    expect(fs.readFileSync(path.join(root, "config.js"), "utf8")).toBe(previous);
    expect(fs.readdirSync(root).filter(f => f.endsWith(".tmp"))).toEqual([]);
  });
});

"use strict";

/*
 * Projects: the app's working values, kept as files on this machine.
 *
 * One JSON file per project in `_personal/projects/`, which is gitignored and
 * never served as a static file, so a project is never committed and never
 * reaches GitHub Pages. Only the local dev server writes here; on Pages there
 * is no server and the project control does not appear.
 *
 * Ported from MONEYFLOW's personal store as a documented subset: the same
 * `_personal/` home and the same write discipline (temporary file, fsync,
 * rename, fsync the directory), so a crash mid-save leaves the previous file
 * whole. Not ported: its restore points. A delete moves the file into
 * `.trash/` instead, which is the one loss autosave cannot cause on its own.
 *
 * THE SHAPE IS THE APP'S, NOT THIS FILE'S. A project belongs to one page
 * (`page`, a page id) and carries that page's `drafts` (its useSessionState
 * values, by key) and `app` (the part of App's own state that page owns). A
 * file from before projects were per page has no `page`; the browser splits
 * it into one project per page the first time it sees it. The store checks it is the right kind of thing and the right size;
 * what the keys mean is the pages' business, and a page reading a key it does
 * not recognise falls back to its default.
 */

const fs = require("fs");
const path = require("path");
const { writeFileAtomic } = require("./write-atomic.js");

const VERSION = 1;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_NAME = 80;
const MAX_DRAFT_KEYS = 500;
const APP_KEYS = ["sh", "sym", "grItems", "nav"];

class ProjectError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);

/** A name as typed: trimmed, required, bounded. */
function cleanName(name) {
  const text = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!text) throw new ProjectError(400, "Give the project a name");
  if (text.length > MAX_NAME) throw new ProjectError(400, `Keep the name to ${MAX_NAME} characters`);
  return text;
}

/* A page id, as config.js's PAGES spells them. Which pages exist is the app's
   business; the store only keeps it the shape of one. */
function cleanPage(page) {
  if (page === undefined || page === null) return null;
  if (typeof page !== "string" || !ID_RE.test(page)) throw new ProjectError(400, "Invalid page");
  return page;
}

/** The body of a save: the name, its page and the two state maps. */
function validateProject(body) {
  if (!isRecord(body)) throw new ProjectError(400, "Expected a project object");
  const name = cleanName(body.name);
  const page = cleanPage(body.page);
  const drafts = body.drafts ?? {};
  if (!isRecord(drafts)) throw new ProjectError(400, "drafts must be an object");
  const keys = Object.keys(drafts);
  if (keys.length > MAX_DRAFT_KEYS) throw new ProjectError(400, "Too many saved values");
  if (keys.some(key => key.length > 200)) throw new ProjectError(400, "Saved value key too long");
  const app = body.app ?? {};
  if (!isRecord(app)) throw new ProjectError(400, "app must be an object");
  // Only the keys App restores. Anything else would be kept and never read.
  const keptApp = Object.fromEntries(APP_KEYS.filter(key => Object.hasOwn(app, key)).map(key => [key, app[key]]));
  return { name, page, drafts, app: keptApp };
}

/* A filename from a name: lower-case letters, digits and dashes. Uniqueness
   is the caller's, by suffix. */
function slug(name) {
  const base = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return base || "project";
}

function createProjectStore({ rootDir, io = fs, now = () => new Date() }) {
  const dir = path.join(rootDir, "_personal", "projects");
  const trash = path.join(dir, ".trash");
  const fileOf = id => {
    if (typeof id !== "string" || !ID_RE.test(id)) throw new ProjectError(400, "Invalid project id");
    return path.join(dir, `${id}.json`);
  };

  /* New or existing file alike, so its folder is made on demand. Project
     files are private, so 0600. */
  const writeAtomic = (file, contents) => writeFileAtomic(file, contents, { io, mode: 0o600, makeDir: true });

  /* Refuse a symlink anywhere a project is read or written: the folder is
     private data, and a link would let a save land outside it. */
  function assertRegular(file) {
    const stat = io.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new ProjectError(403, "Not a project file");
  }

  function readFile(id) {
    const file = fileOf(id);
    try { assertRegular(file); }
    catch (err) { if (err.code === "ENOENT") throw new ProjectError(404, "No such project"); throw err; }
    let doc;
    try { doc = JSON.parse(io.readFileSync(file, "utf8")); }
    catch { throw new ProjectError(422, "This project file cannot be read"); }
    if (!isRecord(doc)) throw new ProjectError(422, "This project file cannot be read");
    return doc;
  }

  function write(id, project) {
    const doc = { version: VERSION, id, name: project.name, page: project.page ?? null,
      savedAt: now().toISOString(), drafts: project.drafts, app: project.app };
    writeAtomic(fileOf(id), JSON.stringify(doc, null, 2) + "\n");
    return doc;
  }

  return {
    dir,

    /** Every project, most recently saved first. A damaged file is listed, not hidden. */
    list() {
      let names;
      try { names = io.readdirSync(dir); } catch (err) { if (err.code === "ENOENT") return []; throw err; }
      return names
        .filter(f => f.endsWith(".json") && ID_RE.test(f.slice(0, -5)))
        .map(f => {
          const id = f.slice(0, -5);
          try {
            const doc = readFile(id);
            return { id, name: typeof doc.name === "string" ? doc.name : id,
              page: typeof doc.page === "string" ? doc.page : null, savedAt: doc.savedAt || null };
          } catch {
            return { id, name: id, page: null, savedAt: null, unreadable: true };
          }
        })
        .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
    },

    read: readFile,

    create(body) {
      const project = validateProject(body);
      const base = slug(project.name);
      let id = base;
      for (let n = 2; io.existsSync(fileOf(id)); n++) id = `${base}-${n}`;
      return write(id, project);
    },

    /** Overwrites an existing project; a save never creates one by accident. */
    save(id, body) {
      const project = validateProject(body);
      const file = fileOf(id);
      try { assertRegular(file); }
      catch (err) { if (err.code === "ENOENT") throw new ProjectError(404, "No such project"); throw err; }
      return write(id, project);
    },

    /* Renames in place: the name changes, the filename (the id) does not, so
       an open project keeps saving to the same file. Values are untouched. */
    rename(id, body) {
      const name = cleanName(isRecord(body) ? body.name : undefined);
      const doc = readFile(id);
      return write(id, { name, page: typeof doc.page === "string" ? doc.page : null,
        drafts: isRecord(doc.drafts) ? doc.drafts : {}, app: isRecord(doc.app) ? doc.app : {} });
    },

    /** Moves the file to `.trash/`, stamped, rather than deleting it. */
    remove(id) {
      const file = fileOf(id);
      try { assertRegular(file); }
      catch (err) { if (err.code === "ENOENT") throw new ProjectError(404, "No such project"); throw err; }
      io.mkdirSync(trash, { recursive: true });
      const stamp = now().toISOString().replace(/[:.]/g, "-");
      io.renameSync(file, path.join(trash, `${id}-${stamp}.json`));
      return { id };
    }
  };
}

module.exports = { createProjectStore, validateProject, ProjectError, slug, ID_RE, VERSION };

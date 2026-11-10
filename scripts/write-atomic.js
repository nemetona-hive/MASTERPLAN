"use strict";

/*
 * Replace a file so that a crash mid-write leaves the previous one whole:
 * write a temporary file beside it, fsync it, rename it over the target, then
 * fsync the directory so the rename itself is durable.
 *
 * Shared by the two things the dev server writes: config.js on Save Defaults
 * (scripts/local-dev-server.js), which keeps that tracked file's own mode, and
 * a project file (scripts/project-store.js), which is private and may not
 * exist yet, so it is 0600 and its folder is made on demand.
 *
 * `io` is the fs to use, so tests can hand in a failing one.
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("node:crypto");

function writeFileAtomic(file, contents, { io = fs, mode = 0o600, makeDir = false } = {}) {
  if (makeDir) io.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  let descriptor, failure;
  try {
    descriptor = io.openSync(temp, "wx", mode);
    io.writeFileSync(descriptor, contents, "utf8");
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    io.renameSync(temp, file);
    // Windows cannot open directories for fsync; rename still prevents a
    // partially written file being observed there.
    if (process.platform !== "win32") {
      const dir = io.openSync(path.dirname(file), "r");
      try { io.fsyncSync(dir); } finally { io.closeSync(dir); }
    }
  } catch (err) { failure = err; }
  finally {
    try { if (descriptor !== undefined) io.closeSync(descriptor); } catch (err) { failure ||= err; }
    try { io.unlinkSync(temp); } catch (err) { if (err.code !== "ENOENT") failure ||= err; }
  }
  if (failure) throw failure;
}

module.exports = { writeFileAtomic };

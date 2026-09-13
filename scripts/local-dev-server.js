const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { parseMeasurement } = require('../src/utils/measurements.cjs');

const PORT = 3005;
// Bind loopback only. /api/save-defaults writes straight to config.js and has
// no credentials on it — the app-side canSaveStaticDefaults() hostname check is
// client-side and so protects nobody. Binding 0.0.0.0 handed every machine on
// the network an unauthenticated write to a source file in this repo.
const HOST = '127.0.0.1';
const ROOT_DIR = path.join(__dirname, '..');

// Loopback still leaves the endpoint reachable from the user's own browser, so
// a page on any origin could post to it (and a DNS-rebinding host resolving to
// 127.0.0.1 would pass the bind). Browsers always send Origin on a cross-origin
// POST; a missing one means a non-browser client such as curl, which is fine.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

const hostnameOf = value => {
  if (!value) return null;
  const trimmed = String(value).trim();
  // Strip the port without tripping over an IPv6 literal's own colons.
  const withoutPort = trimmed.startsWith('[')
    ? trimmed.slice(0, trimmed.indexOf(']') + 1)
    : trimmed.split(':')[0];
  return withoutPort.toLowerCase();
};

function isLocalRequest(req) {
  if (!LOCAL_HOSTS.has(hostnameOf(req.headers.host))) return false;

  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host.toLowerCase() === String(req.headers.host).toLowerCase();
  } catch {
    return false;
  }
}

// ==========================================
// STATIC DEFAULTS ALLOWLIST
// Add to this object to enable local saving
// for new features. Maps client API key to
// the constant name in config.js.
// ==========================================
const DEFAULT_WRITES = {
  concretePresets: "DEFAULT_CONCRETE_PRESETS",
  goldenRatioDefaults: "DEFAULT_GR",
  materialPresets: "DEFAULT_MATERIAL_PRESETS",
  surfacePresets: "DEFAULT_SURFACE_PRESETS"
};

const toStringField = value => value == null ? "" : String(value);

const toNumberOrBlank = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = parseMeasurement(value);
  if (n === null) return "";
  if (!Number.isFinite(n) || n < min || n > max) {
    throwValidationError(`Expected a decimal between ${min} and ${max}, or an empty field`);
  }
  return n;
};
function throwValidationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  throw err;
}

function validateConcretePresets(value) {
  if (!Array.isArray(value) || value.length > 128) {
    throwValidationError("concretePresets must be an array");
  }

  return value.map((preset, idx) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throwValidationError(`concretePresets[${idx}] must be an object`);
    }

    return {
      name: toStringField(preset.name),
      rate: toNumberOrBlank(preset.rate, 0.01),
      bagKg: toNumberOrBlank(preset.bagKg, 0.01),
      bagPrice: toNumberOrBlank(preset.bagPrice)
    };
  });
}

function validateGoldenRatioDefaults(value) {
  if (!Array.isArray(value) || value.length > 128) {
    throwValidationError("goldenRatioDefaults must be an array");
  }

  return value.map((item, idx) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throwValidationError(`goldenRatioDefaults[${idx}] must be an object`);
    }

    const id = toStringField(item.id);
    if (!/^[a-z][a-z0-9_-]{0,15}$/i.test(id)) {
      throwValidationError(`goldenRatioDefaults[${idx}].id must be a short id string`);
    }

    const valueText = toStringField(item.value);
    const suffixText = toStringField(item.suffix);

    return {
      id,
      value: valueText,
      suffix: suffixText,
      saved: {
        value: valueText,
        suffix: suffixText
      },
      savedCommitted: valueText.trim() !== ""
    };
  });
}

function validateMaterialPresets(value) {
  if (!Array.isArray(value) || value.length > 128) {
    throwValidationError("materialPresets must be an array");
  }

  return value.map((preset, idx) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throwValidationError(`materialPresets[${idx}] must be an object`);
    }

    return {
      name: toStringField(preset.name),
      length: toNumberOrBlank(preset.length, 100, 8000),
      width: toNumberOrBlank(preset.width, 100, 8000)
    };
  });
}

function validateSurfacePresets(value) {
  if (!Array.isArray(value) || value.length > 128) {
    throwValidationError("surfacePresets must be an array");
  }

  return value.map((preset, idx) => {
    if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
      throwValidationError(`surfacePresets[${idx}] must be an object`);
    }

    return {
      name: toStringField(preset.name),
      length: toNumberOrBlank(preset.length, 100, 50000),
      width: toNumberOrBlank(preset.width, 100, 50000)
    };
  });
}

const DEFAULT_VALIDATORS = {
  concretePresets: validateConcretePresets,
  goldenRatioDefaults: validateGoldenRatioDefaults,
  materialPresets: validateMaterialPresets,
  surfacePresets: validateSurfacePresets
};

// Robust bracket matcher to safely replace constant values
function replaceConstant(source, constName, newValue) {
  const decl = `const ${constName} = `;
  const startIdx = source.indexOf(decl);
  if (startIdx === -1) return null;

  const afterDecl = startIdx + decl.length;
  let braceIdx = -1;
  let isArray = false;
  
  for (let i = afterDecl; i < source.length; i++) {
    if (source[i] === '[') { braceIdx = i; isArray = true; break; }
    if (source[i] === '{') { braceIdx = i; isArray = false; break; }
    if (source[i] !== ' ' && source[i] !== '\n' && source[i] !== '\r') break;
  }
  
  if (braceIdx === -1) {
    const semiIdx = source.indexOf(';', afterDecl);
    if (semiIdx === -1) return null;
    return source.slice(0, afterDecl) + JSON.stringify(newValue, null, 2) + source.slice(semiIdx);
  }

  const open = isArray ? '[' : '{';
  const close = isArray ? ']' : '}';
  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escape = false;
  let endIdx = -1;

  for (let i = braceIdx; i < source.length; i++) {
    const char = source[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    
    if (inString) {
      if (char === stringChar) inString = false;
    } else {
      if (char === '"' || char === "'" || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === open) {
        depth++;
      } else if (char === close) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx === -1) return null;

  let formattedValue = JSON.stringify(newValue, null, 2);


  return source.slice(0, braceIdx) + formattedValue + source.slice(endIdx + 1);
}


const MAX_BODY_BYTES = 256 * 1024;
const PUBLIC_FILES = new Set(["index.html", "components.js", "components.js.map", "app.css",
  "config.js", "simulation.js", "themes.js", "version.js", "manifest.webmanifest", "masterplan.ico"]);
const MIME_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".map": "application/json", ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function writeFileAtomic(file, contents, io = fs) {
  const temp = `${file}.${randomUUID()}.tmp`;
  let descriptor, failure;
  try {
    descriptor = io.openSync(temp, "wx", io.statSync(file).mode & 0o777);
    io.writeFileSync(descriptor, contents, "utf8");
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    io.renameSync(temp, file);
    // Windows cannot open directories for fsync; rename still prevents a
    // partially written source file being observed there.
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

function createRequestHandler({ rootDir = ROOT_DIR, io = fs } = {}) {
  const root = io.realpathSync(rootDir);
  const reply = (res, code, payload) => {
    res.writeHead(code, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(payload));
  };
  return (req, res) => {
    if (!isLocalRequest(req)) { reply(res, 403, { error: "Local requests only" }); return; }
    if (req.method === "POST" && req.url === "/api/save-defaults") {
      if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
        reply(res, 415, { error: "Send application/json" }); return;
      }
      let size = 0, ended = false;
      const chunks = [];
      req.on("aborted", () => { ended = true; });
      req.on("error", () => { if (!ended) { ended = true; reply(res, 400, { error: "Incomplete request" }); } });
      req.on("data", chunk => {
        if (ended) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          ended = true;
          reply(res, 413, { error: "Defaults exceed the 256 KiB request limit" });
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      req.on("end", () => {
        if (ended) return;
        ended = true;
        try {
          let payload;
          try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
          catch { throwValidationError("Invalid JSON"); }
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) throwValidationError("Expected an object");
          const { key, value } = payload;
          if (!Object.hasOwn(DEFAULT_WRITES, key)) throwValidationError("Unknown save key");
          const validated = DEFAULT_VALIDATORS[key](value);
          const file = path.join(root, "config.js");
          if (io.realpathSync(file) !== file) throwValidationError("Configuration must not be a symlink");
          const next = replaceConstant(io.readFileSync(file, "utf8"), DEFAULT_WRITES[key], validated);
          if (!next) throw new Error("Could not locate the defaults in config.js");
          new vm.Script(next); // Never replace the previous valid source with invalid JavaScript.
          writeFileAtomic(file, next, io);
          reply(res, 200, { success: true, key });
        } catch (err) {
          reply(res, err.statusCode || 500, { error: err.statusCode ? err.message : "Could not save defaults. The previous file is retained if replacement did not complete." });
        }
      });
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) { reply(res, 405, { error: "Method not allowed" }); return; }
    try {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (!url.startsWith("/") || url.includes("\\") || url.includes("\0")) throwValidationError("Invalid path");
      const file = path.resolve(root, "." + (url === "/" ? "/index.html" : url));
      const relative = path.relative(root, file);
      const parts = relative.split(path.sep);
      if (!relative || path.isAbsolute(relative) || parts.some(part => part.startsWith(".")) ||
          !(PUBLIC_FILES.has(relative) || ["assets", "vendor"].includes(parts[0]))) {
        reply(res, 403, { error: "File is not public" }); return;
      }
      const real = io.realpathSync(file);
      const realRelative = path.relative(root, real);
      if (real !== file || realRelative.startsWith("..") || path.isAbsolute(realRelative) || !io.statSync(real).isFile()) {
        reply(res, 403, { error: "File is not public" }); return;
      }
      const contents = io.readFileSync(real);
      res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(real)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff", "Cache-Control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : contents);
    } catch (err) {
      reply(res, err.code === "ENOENT" ? 404 : err instanceof URIError || err.statusCode ? 400 : 500,
        { error: "File unavailable" });
    }
  };
}

function startServer({ port = PORT, rootDir = ROOT_DIR } = {}) {
  const server = http.createServer(createRequestHandler({ rootDir }));
  server.listen(port, HOST, () => console.log(`Local dev server running at http://${HOST}:${server.address().port}/`));
  return server;
}
if (require.main === module) startServer();
module.exports = { createRequestHandler, startServer, writeFileAtomic, replaceConstant, DEFAULT_VALIDATORS, MAX_BODY_BYTES };

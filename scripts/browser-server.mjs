import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".map": "application/json" };

// Browser fixtures never invoke the development server's source-writing route.
export function startBrowserServer() {
  const server = http.createServer((req, res) => {
    try {
      const url = decodeURIComponent(req.url.split("?")[0]);
      if (url === "/api/save-defaults") {
        req.resume();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"success":true}'); return;
      }
      const file = path.resolve(root, "." + (url === "/" ? "/index.html" : url));
      const rel = path.relative(root, file);
      if (rel.startsWith("..") || path.isAbsolute(rel) || !fs.statSync(file).isFile() || fs.realpathSync(file) !== file) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

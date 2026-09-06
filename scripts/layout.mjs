/**
 * Browser checks — the assertions the Vitest suite cannot make.
 *
 * Everything in tests/ is pure or jsdom. jsdom has no layout engine:
 * `getBoundingClientRect` returns zeroes, a cascade conflict is invisible
 * because nothing is ever painted, and `@media print` never applies. It can
 * tell you the header cluster rendered; it cannot tell you the cluster landed
 * halfway down the page.
 *
 * That is not a hypothetical. `.header-actions` is absolutely positioned and
 * `.app-head` carried no `position`, so the cluster resolved against the
 * viewport and `top: 50%` dropped it over the Home cards. Every unit test
 * passed. It reached a user, and the fix — one line — was guarded afterwards by
 * a stylesheet assertion, which is the best a text-only check can do. This file
 * is the check that would have caught it directly.
 *
 * The same gap swallows contrast. `npm run theme:check` compares token pairs out
 * of themes.js, which is fast and portable and can only check the pairs somebody
 * thought to list. It cannot see a colour painted over a ground that is not a
 * token, and it cannot see what `opacity` did on the way to the screen. Only a
 * browser knows what a word was actually painted in.
 *
 *   npm run layout
 *
 * ## Its own server, deliberately static
 *
 * This starts a plain file server on an OS-assigned port. It does NOT use
 * `scripts/local-dev-server.js`, and that is the point: that server exposes
 * `/api/save-defaults`, which writes `DEFAULT_SH` straight into `config.js`.
 * A gate that drove the app through it would rewrite tracked source every run —
 * a check that dirties the tree it is checking. Serving statically also matches
 * production, since GitHub Pages has no API either.
 *
 * ## When to run it
 *
 * Part of `npm run verify`, and deliberately NOT of `pre-commit` — that hook is
 * a build, audit:ui and the suite, about a second, and a browser launch does not
 * belong between finishing a thought and saving it. Run it directly after any
 * change to layout, positioning, the control scale, a theme, or the print sheet.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".map": "application/json",
  ".svg": "image/svg+xml"
};

const failures = [];
/* `key` is what the finding is ABOUT — a class, a page — and `detail` is one
   example of it. A contrast miss on a shared class fires once per word on
   screen, so reporting every line buries the fact that it is one rule; the
   report groups on the key and counts the rest. */
const fail = (check, key, detail) => failures.push({ check, key, detail });
let checked = 0;
const pass = () => { checked += 1; };

/* ── contrast ──────────────────────────────────────────────────────────────
 * The same maths as check-theme-contrast.js, applied to colours read off the
 * screen rather than out of themes.js. Composited by hand because
 * getComputedStyle reports the AUTHORED colour: a rule that paints text at
 * opacity 0.6 still reports the full-strength value, so the ratio the palette
 * was gated on is not the ratio anybody sees.
 */
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(a) + 0.05, lum(b) + 0.05];
  return Math.max(x, y) / Math.min(x, y);
};
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

function startServer() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);

    /* Answered, and deliberately a no-op.
     *
     * `canSaveStaticDefaults()` is a hostname check, and this server is on
     * 127.0.0.1, so the app believes defaults are savable and posts them. A 404
     * would make every run report a console error that says nothing about the
     * page. Writing them would be far worse: that is the path that rewrites
     * DEFAULT_SH in config.js, and a gate must never dirty the tree it checks.
     * So it says yes and does nothing. */
    if (url === "/api/save-defaults") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end('{"ok":true}');
    }
    let rel = url === "/" ? "index.html" : url.replace(/^\//, "");
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end("not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const PAGES = ["home", "pattern-layout", "symmetric-layout", "concrete",
  "pipe-wrap", "golden-ratio", "guider", "timesheet"];

const THEMES = ["graphite", "verdant"];

async function run() {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(`${e.message}`));
    page.on("console", m => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

    for (const id of PAGES) {
      await page.goto(`${base}/#${id}`, { waitUntil: "load" });
      await page.waitForSelector(".app-head");
      await page.waitForTimeout(120);

      /* ── 1. the header cluster is inside the header ──────────────────────
       * The bug that reached a user. It is absolutely positioned, so it is
       * only inside its bar while something above it is a containing block. */
      const cluster = await page.evaluate(() => {
        const head = document.querySelector(".app-head").getBoundingClientRect();
        const box = document.querySelector(".header-actions").getBoundingClientRect();
        return {
          inside: box.top >= head.top - 1 && box.bottom <= head.bottom + 1,
          head: [Math.round(head.top), Math.round(head.bottom)],
          box: [Math.round(box.top), Math.round(box.bottom)]
        };
      });
      if (cluster.inside) pass();
      else fail("header-cluster-escaped", `#${id}`,
        `#${id}: .header-actions is ${cluster.box.join("–")} against a header at ${cluster.head.join("–")}`);

      /* ── 2. nothing scrolls sideways ──────────────────────────────────────
       * A page wider than its viewport is always a bug here: every layout in
       * this app is meant to fit or to scroll inside its own container. */
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow <= 1) pass();
      else fail("horizontal-overflow", `#${id}`,
        `#${id}: document is ${overflow}px wider than the viewport`);

      /* ── 3. every control lands on the size scale ─────────────────────────
       * audit:ui reads the stylesheets and can check that a token is spelled
       * right; only a browser can check that the tokens added up. A control
       * that states no height at all comes out as padding plus line-height,
       * which lands near a step without being on it.
       *
       * The nav rail and the Home cards are excluded; see the note below. */
      const offScale = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const steps = ["--ctl-h-xs", "--ctl-h-sm", "--ctl-h-md", "--ctl-h-lg", "--ctl-h-touch"]
          .map(t => parseFloat(root.getPropertyValue(t))).filter(Number.isFinite);
        const out = [];
        /* A Home card is a <button> because it navigates, but it is a tile:
           its height is its content, and putting it on the control scale would
           mean a card that grew a third line changed size in 32px steps. Same
           reason the nav rail is excluded — being clickable does not make
           something a control the scale governs. */
        const NOT_ON_THE_SCALE = ".home-card, #side-navi";
        for (const el of document.querySelectorAll("button")) {
          if (el.closest(NOT_ON_THE_SCALE)) continue;
          const h = el.getBoundingClientRect().height;
          if (!h) continue;
          if (!steps.some(v => Math.abs(v - h) < 1.5)) {
            out.push(`${el.className || el.tagName} at ${Math.round(h)}px`);
          }
        }
        return out;
      });
      if (!offScale.length) pass();
      else for (const one of new Set(offScale)) fail("control-off-scale", one, `#${id}: ${one}`);

      /* ── 4. what a word was actually painted in ───────────────────────────
       * Walks real text nodes, composites the authored colour and every
       * inherited opacity over the nearest painted ancestor background, and
       * measures that. theme:check cannot reach this: the ground is often not
       * a token, and opacity is not written as a colour at all. */
      for (const theme of THEMES) {
        await page.evaluate(t => applyTheme(t), theme);
        await page.waitForTimeout(150);

        const samples = await page.evaluate(() => {
          const parse = c => {
            const m = /rgba?\(([^)]+)\)/.exec(c);
            if (!m) return null;
            const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
            return { rgb: parts.slice(0, 3), a: parts.length > 3 ? parts[3] : 1 };
          };
          const groundOf = el => {
            for (let n = el; n; n = n.parentElement) {
              const bg = parse(getComputedStyle(n).backgroundColor);
              if (bg && bg.a === 1) return bg.rgb;
            }
            return [255, 255, 255];
          };
          const out = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const text = n.textContent.trim();
            if (text.length < 2) continue;
            const el = n.parentElement;
            if (!el || el.closest(".doc-sheet")) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none") continue;
            const box = el.getBoundingClientRect();
            if (!box.width || !box.height) continue;
            const fg = parse(cs.color);
            if (!fg) continue;
            // Every opacity between here and the root multiplies.
            let alpha = fg.a;
            for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
              alpha *= parseFloat(getComputedStyle(p).opacity);
            }
            if (alpha < 0.06) continue;   // effectively hidden, not dim text
            out.push({
              text: text.slice(0, 30),
              cls: String(el.getAttribute("class") || el.tagName),
              fg: fg.rgb, ground: groundOf(el), alpha,
              size: parseFloat(cs.fontSize), weight: cs.fontWeight
            });
          }
          return out;
        });

        for (const s of samples) {
          /* 3:1 for large text, 4.5:1 otherwise — WCAG's own split. Bold at
             14px is NOT large text, which is why the weight arm needs 18.66px
             behind it. */
          const large = s.size >= 24 || (s.size >= 18.66 && Number(s.weight) >= 700);
          const target = large ? 3 : 4.5;
          const r = ratio(over(s.fg, s.ground, s.alpha), s.ground);
          if (r + 0.005 >= target) pass();
          else fail("painted-contrast", `${theme} .${s.cls}`,
            `[${theme}] .${s.cls} — ${r.toFixed(2)}:1, needs ${target}` +
            (s.alpha < 1 ? ` (at opacity ${s.alpha.toFixed(2)})` : "") +
            ` · e.g. "${s.text}" on #${id}`);
        }
      }
      await page.evaluate(() => applyTheme("graphite"));
    }

    /* ── 5. a dialog keeps the keyboard ──────────────────────────────────────
     * The trap is a keydown handler, so only a real browser dispatching real
     * Tab presses can say whether focus stayed in. */
    await page.goto(`${base}/#pattern-layout`, { waitUntil: "load" });
    await page.locator(".sys-head").first().click();
    await page.waitForTimeout(300);
    const expand = page.locator(".viz-expand-btn").first();
    if (await expand.count()) {
      await expand.scrollIntoViewIfNeeded();
      await expand.click();
      await page.waitForTimeout(300);
      let escaped = null;
      for (let i = 0; i < 30 && !escaped; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => {
          const p = document.querySelector(".mp-modal");
          return p ? p.contains(document.activeElement) : "panel gone";
        });
        if (inside !== true) escaped = `tab ${i + 1} (${inside})`;
      }
      if (escaped) fail("dialog-focus-escaped", "large preview",
        `large preview: focus left the panel at ${escaped}`);
      else pass();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    } else {
      fail("dialog-missing", "large preview",
        "no .viz-expand-btn to open the large preview from");
    }

    /* ── 6. the print sheet is a document and nothing else ───────────────────
     * @media never applies in jsdom, so the whole print stylesheet is
     * unreachable from the suite. */
    await page.locator('[aria-label^="Print the cut list"]').first().click();
    await page.waitForTimeout(300);
    const screen = await page.evaluate(() => ({
      sheet: getComputedStyle(document.querySelector(".doc-sheet")).display,
      root: getComputedStyle(document.getElementById("root")).display
    }));
    if (screen.sheet === "none" && screen.root !== "none") pass();
    else fail("print-sheet-on-screen", "doc-sheet",
      `on screen: sheet ${screen.sheet}, #root ${screen.root}`);

    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(120);
    const printed = await page.evaluate(() => ({
      sheet: getComputedStyle(document.querySelector(".doc-sheet")).display,
      root: getComputedStyle(document.getElementById("root")).display,
      ink: getComputedStyle(document.querySelector(".doc-sheet")).color,
      paper: getComputedStyle(document.querySelector(".doc-sheet")).backgroundColor
    }));
    if (printed.sheet === "block" && printed.root === "none") pass();
    else fail("print-sheet-not-printing", "doc-sheet",
      `in print: sheet ${printed.sheet}, #root ${printed.root}`);

    // Ink on paper, whatever the screen theme was — a document must not depend
    // on which theme happened to be on when somebody pressed print.
    if (/rgb\(17, 17, 17\)/.test(printed.ink) && /rgb\(255, 255, 255\)/.test(printed.paper)) pass();
    else fail("print-not-ink-on-paper", "doc-sheet",
      `ink ${printed.ink} on ${printed.paper}`);
    await page.emulateMedia({ media: "screen" });

    if (errors.length) {
      for (const e of [...new Set(errors)]) fail("page-error", e, e);
    } else pass();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

await run();

const grouped = new Map();
for (const f of failures) {
  if (!grouped.has(f.check)) grouped.set(f.check, new Map());
  const byKey = grouped.get(f.check);
  if (!byKey.has(f.key)) byKey.set(f.key, { detail: f.detail, count: 0 });
  byKey.get(f.key).count += 1;
}

if (!failures.length) {
  console.log(`✅ Layout checks clean — ${checked} assertions in a real browser.`);
  process.exit(0);
}

for (const [check, byKey] of grouped) {
  console.log(`\n── ${check} ─────────────────────────────`);
  for (const [, { detail, count }] of byKey) {
    console.log(`❌ ${detail}${count > 1 ? `   (${count} occurrences)` : ""}`);
  }
}
const distinct = [...grouped.values()].reduce((n, m) => n + m.size, 0);
console.log(`\n${distinct} distinct failure(s) over ${failures.length} occurrence(s), ` +
  `${checked} passing assertion(s).`);
process.exit(1);

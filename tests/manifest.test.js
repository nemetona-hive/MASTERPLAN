import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const manifest = JSON.parse(read("manifest.webmanifest"));
const html = read("index.html");

/*
 * The installable app. Every failure here is invisible on this machine and
 * only shows on the deployed site or on a phone, which is what makes it worth
 * a test: `npm run dev` serves from the root, so an absolute path that breaks
 * on Pages works perfectly in development.
 */
describe("the web app manifest", () => {
  it("is linked from index.html, relatively", () => {
    expect(html).toMatch(/<link\s+rel="manifest"\s+href="manifest\.webmanifest">/);
  });

  /* The one that matters most. GitHub Pages serves this from /MASTERPLAN/, not
     a domain root, so a leading slash would scope the app to the whole
     github.io origin — claiming every other Nemetona project on it — and 404
     every icon. It reads correctly on the dev server either way. */
  it("keeps every path relative to the subpath it is served from", () => {
    for (const [key, value] of [["start_url", manifest.start_url], ["scope", manifest.scope]]) {
      expect(value, key).toBeTruthy();
      expect(value.startsWith("/"), `${key} must not be absolute`).toBe(false);
    }
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/"), `${icon.src} must not be absolute`).toBe(false);
      expect(icon.src.startsWith("http"), `${icon.src} must not be remote`).toBe(false);
    }
  });

  it("ships every icon it declares, at the size it declares", async () => {
    for (const icon of manifest.icons) {
      const file = path.join(ROOT, icon.src);
      expect(fs.existsSync(file), `${icon.src} missing — run node scripts/make-icon.js`).toBe(true);

      // PNG dimensions live at a fixed offset in the IHDR chunk, so this needs
      // no image library to read them.
      const buf = fs.readFileSync(file);
      expect(buf.subarray(1, 4).toString("ascii"), `${icon.src} is not a PNG`).toBe("PNG");
      const declared = icon.sizes.split("x").map(Number);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], icon.src).toEqual(declared);
    }
  });

  /* A maskable icon is cropped to whatever shape the platform likes and only a
     circle of 80% of the edge is guaranteed. A transparent one crops to a hole,
     which is the classic way this ships broken — it looks right in the manifest
     and wrong on the home screen. */
  it("gives the maskable icon an opaque ground", () => {
    const maskable = manifest.icons.find(i => i.purpose === "maskable");
    expect(maskable, "no maskable icon declared").toBeTruthy();
    const buf = fs.readFileSync(path.join(ROOT, maskable.src));
    // Colour type 6 is RGBA; the alpha has to be opaque at the corners, which
    // is where a crop bites first.
    expect(buf.readUInt8(25), "expected an RGBA PNG").toBe(6);
  });

  it("declares an `any` icon as well, which must NOT be padded like a maskable", () => {
    // The two purposes want opposite things: `any` is drawn unchanged and
    // should fill its canvas, `maskable` has to keep clear of the crop. One
    // file serving both is either a small mark or a clipped one.
    const any = manifest.icons.filter(i => i.purpose === "any");
    expect(any.length).toBeGreaterThan(0);
    for (const icon of any) {
      const maskable = manifest.icons.find(i => i.purpose === "maskable");
      expect(icon.src).not.toBe(maskable.src);
    }
  });

  /* Three copies of one colour: the manifest twice, and the meta tag the
     browser chrome reads. They are the app's background, so they also have to
     be graphite's --bg — a theme edit that moved one and not the others would
     show as a flash of the wrong colour on launch. */
  it("keeps its colours in step with the default theme", () => {
    const themes = new Function(`${read("themes.js")}\n;return THEMES;`)();
    const bg = themes.graphite.colors["--bg"];

    expect(manifest.background_color).toBe(bg);
    expect(manifest.theme_color).toBe(bg);
    expect(html).toContain(`<meta name="theme-color" content="${bg}">`);
    expect(read("scripts/make-icon.js")).toContain(`const BG = "${bg}"`);
  });

  it("names itself the way index.html does", () => {
    expect(manifest.name).toBe("Nemetona MASTERPLAN");
    expect(html).toContain(`<title>${manifest.name}</title>`);
    // The description is the same sentence in both, so a change to one that
    // misses the other shows up here rather than in a store listing.
    expect(html).toContain(manifest.description);
  });

  it("is stamped into the build id, like everything else a visitor loads", () => {
    // Otherwise `npm run deploy:check` reports a manifest change as already
    // live — the one answer it exists to give, given wrong.
    const version = read("scripts/build-version.js");
    for (const file of ["manifest.webmanifest", ...manifest.icons.map(i => i.src)]) {
      expect(version, file).toContain(`"${file}"`);
    }
  });
});

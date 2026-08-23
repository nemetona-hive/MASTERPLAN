"use strict";

/*
 * Regenerates masterplan.ico from the Font Awesome glyph the app itself uses.
 *
 * Not a build step — icons change about once a year, and the desktop shortcut
 * reads the copy under %LOCALAPPDATA% rather than this one. It exists so the
 * icon is reproducible instead of being a binary nobody can regenerate.
 *
 *   node scripts/make-icon.js            rebuild masterplan.ico
 *   node scripts/make-icon.js --deploy   also copy it to %LOCALAPPDATA%
 *
 * Requires python3 with Pillow, which is what has FreeType bound to it here.
 * FreeType reads the vendored .woff2 directly, so the icon is the same face the
 * app renders with rather than a lookalike.
 */

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const GLYPH = 0xf568;          // fa-compass-drafting, per vendor/fontawesome.min.css
const COLOUR = "#c4b48a";      // the mark colour in index.html's favicon

const py = `
import sys
from PIL import Image, ImageDraw, ImageFont

# The codepoint is written as a number, never pasted: it is in the Private Use
# Area and does not survive being moved between editors and shells. A pasted one
# silently became an empty string once, and produced a fully transparent icon
# that still passed for a valid 7-frame .ico.
GLYPH = chr(${GLYPH})
GOLD = tuple(int("${COLOUR}"[i:i+2], 16) for i in (1, 3, 5)) + (255,)
FONT = "${path.join(ROOT, "vendor/fa-solid-900.woff2")}"

EM = 1024
f = ImageFont.truetype(FONT, EM)
probe = Image.new("RGBA", (EM * 2, EM * 2), (0, 0, 0, 0))
ImageDraw.Draw(probe).text((EM // 2, EM // 2), GLYPH, font=f, fill=GOLD)
box = probe.getbbox()
if not box:
    sys.exit("glyph rendered nothing - wrong codepoint or font")
glyph = probe.crop(box)

SIZES = [16, 24, 32, 48, 64, 128, 256]

def tile(px):
    # A detailed glyph loses its shape below ~32px, so the small tiles give up
    # their margin to keep the strokes readable.
    margin = 0.0 if px <= 24 else (0.03 if px <= 32 else 0.06)
    inner = max(1, int(round(px * (1 - 2 * margin))))
    w, h = glyph.size
    s = min(inner / w, inner / h)
    g = glyph.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    img.alpha_composite(g, ((px - g.width) // 2, (px - g.height) // 2))
    if not img.getbbox():
        sys.exit(f"{px}px tile came out empty")
    return img

frames = [tile(s) for s in SIZES]
frames[-1].save("${path.join(ROOT, "masterplan.ico")}", format="ICO",
                sizes=[(s, s) for s in SIZES], append_images=frames[:-1])
print("Built masterplan.ico (" + ", ".join(str(s) for s in SIZES) + ")")
`;

execFileSync("python3", ["-c", py], { stdio: "inherit" });

if (process.argv.includes("--deploy")) {
  const dest = execFileSync("bash", ["-lc",
    'wslpath -u "$(cmd.exe /c \'echo %LOCALAPPDATA%\' 2>/dev/null | tr -d "\\r")"'],
    { encoding: "utf8" }).trim();
  const target = path.join(dest, "MASTERPLAN", "masterplan.ico");
  execFileSync("cp", [path.join(ROOT, "masterplan.ico"), target]);
  process.stdout.write(`Deployed to ${target}\n`);
  process.stdout.write("Windows caches shortcut icons; log out or clear the icon cache if the desktop still shows the old one.\n");
}

"use strict";

/*
 * Regenerates masterplan.ico and the installable app's PNGs from the Font
 * Awesome glyph the app itself uses.
 *
 * Not a build step — icons change about once a year, and the desktop shortcut
 * reads the copy under %LOCALAPPDATA% rather than this one. It exists so the
 * icons are reproducible instead of being binaries nobody can regenerate.
 *
 * One glyph, three outputs, so the taskbar icon and the installed app cannot
 * drift into two different marks:
 *
 *   masterplan.ico              the desktop shortcut, 7 frames
 *   assets/icon-192.png         `any` — drawn as-is on whatever the OS gives it
 *   assets/icon-512.png         `any`, larger
 *   assets/icon-maskable-512.png  `maskable` — see the safe zone below
 *
 *   node scripts/make-icon.js            rebuild all four
 *   node scripts/make-icon.js --deploy   also copy the .ico to %LOCALAPPDATA%
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
// The maskable icon's ground. Graphite's --bg, and the same value the manifest
// declares as theme_color and background_color — a test keeps the three in step.
const BG = "#161718";

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

import os
ASSETS = "${path.join(ROOT, "assets")}"
os.makedirs(ASSETS, exist_ok=True)
BG = tuple(int("${BG}"[i:i+2], 16) for i in (1, 3, 5)) + (255,)

def png(px, frac, background):
    # frac is the glyph's share of the canvas edge. background is None for an
    # 'any' icon, which the OS draws unchanged and which therefore has to work
    # on a light dock as well as a dark one - so it stays transparent and lets
    # the platform supply the ground.
    # (No backticks anywhere in this Python: it is embedded in a JS template
    # literal, and one would end the string mid-script.)
    img = Image.new("RGBA", (px, px), background or (0, 0, 0, 0))
    inner = int(round(px * frac))
    w, h = glyph.size
    s = min(inner / w, inner / h)
    g = glyph.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    img.alpha_composite(g, ((px - g.width) // 2, (px - g.height) // 2))
    if not img.getbbox():
        sys.exit(f"{px}px png came out empty")
    return img

png(192, 0.88, None).save(os.path.join(ASSETS, "icon-192.png"))
png(512, 0.88, None).save(os.path.join(ASSETS, "icon-512.png"))

# MASKABLE. The platform crops this to whatever shape it likes - circle,
# squircle, rounded square - and only guarantees a circle of 80% of the edge.
# A square mark has to fit INSIDE that circle, so its edge can be at most
# 0.8/sqrt(2) = 0.566 of the canvas; 0.52 leaves a little air. It also needs an
# opaque ground, because a transparent maskable icon crops to a hole.
png(512, 0.52, BG).save(os.path.join(ASSETS, "icon-maskable-512.png"))
print("Built assets/icon-192.png, icon-512.png, icon-maskable-512.png")
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

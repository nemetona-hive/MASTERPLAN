"use strict";

/*
 * A WOFF2 reader — just enough of one for the checks that need to ask a font
 * file what it actually contains, rather than what a stylesheet says it does.
 *
 * Used by check-fonts.js (is this file the weight its @font-face claims? does
 * it draw š?). The question is invisible in the browser — a wrong answer
 * paints a fallback face, or clamps a weight, and the page carries on.
 *
 * Ported unchanged from MONEYFLOW's scripts/woff2.js; keep the two in step.
 * build-icons.js does not need it: harfbuzz (subset-font) writes the icon
 * subset, and nothing there reads a table back.
 *
 * WOFF2 is a table directory followed by one Brotli stream holding every
 * table back to back, and node ships Brotli. Only glyf/loca/hmtx are ever
 * transformed, and nothing here reads those, so the untransformed tables we
 * need (cmap, OS/2, fvar, name) come straight out of the stream.
 */

const fs = require("fs");
const zlib = require("zlib");

/* Table tags are stored as a 6-bit index into this list, with 0x3f meaning
   "an explicit 4-byte tag follows". Order is normative — it is the table in
   the woff2 spec, not an arbitrary list. */
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm",
  "glyf", "loca", "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern",
  "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
  "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty",
  "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill"
];

/** Every table in the file, as Buffers keyed by tag. */
function readTables(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("latin1", 0, 4) !== "wOF2") throw new Error(`not a woff2 file: ${file}`);

  const numTables = buf.readUInt16BE(12);
  let p = 48; // fixed-size woff2 header
  const uintBase128 = () => {
    let value = 0;
    for (;;) {
      const byte = buf[p++];
      value = (value << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) return value >>> 0;
    }
  };

  const directory = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++];
    const index = flags & 0x3f;
    let tag;
    if (index === 0x3f) { tag = buf.toString("latin1", p, p + 4); p += 4; }
    else tag = KNOWN_TAGS[index];
    const origLength = uintBase128();
    /* Only glyf and loca carry a transform by default, and for those the
       null transform is version 3 rather than 0. Anything transformed stores
       its compressed length separately, and that is the length that counts
       when walking the decompressed stream. */
    const version = (flags >> 6) & 0x03;
    const transformed = (tag === "glyf" || tag === "loca") ? version !== 3 : version !== 0;
    directory.push({ tag, length: transformed ? uintBase128() : origLength });
  }

  // Tables are concatenated in directory order, no padding between them.
  const stream = zlib.brotliDecompressSync(buf.subarray(p));
  const tables = {};
  let offset = 0;
  for (const table of directory) {
    tables[table.tag] = stream.subarray(offset, offset + table.length);
    offset += table.length;
  }
  return tables;
}

/** The set of codepoints the font maps to a real glyph (not .notdef). */
function cmapCodepoints(file, tables = readTables(file)) {
  const cmap = tables.cmap;
  if (!cmap) throw new Error(`no cmap table in ${file}`);

  const codepoints = new Set();
  const numSubtables = cmap.readUInt16BE(2);
  for (let i = 0; i < numSubtables; i++) {
    const start = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(start);

    if (format === 4) {
      const segCountX2 = cmap.readUInt16BE(start + 6);
      const segCount = segCountX2 / 2;
      const endO = start + 14;
      const startO = endO + segCountX2 + 2; // +2 for reservedPad
      const deltaO = startO + segCountX2;
      const rangeO = deltaO + segCountX2;
      for (let s = 0; s < segCount; s++) {
        const end = cmap.readUInt16BE(endO + s * 2);
        const begin = cmap.readUInt16BE(startO + s * 2);
        const delta = cmap.readInt16BE(deltaO + s * 2);
        const rangeOffset = cmap.readUInt16BE(rangeO + s * 2);
        if (begin === 0xffff) continue; // the required terminating segment
        for (let c = begin; c <= end && c !== 0x10000; c++) {
          let glyph;
          if (rangeOffset === 0) glyph = (c + delta) & 0xffff;
          else {
            const gi = rangeO + s * 2 + rangeOffset + (c - begin) * 2;
            if (gi + 1 >= cmap.length) continue;
            glyph = cmap.readUInt16BE(gi);
            if (glyph) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph) codepoints.add(c); // glyph 0 is .notdef — that is the blank box
        }
      }
    } else if (format === 12) {
      const numGroups = cmap.readUInt32BE(start + 12);
      for (let g = 0; g < numGroups; g++) {
        const go = start + 16 + g * 12;
        const begin = cmap.readUInt32BE(go);
        const end = cmap.readUInt32BE(go + 4);
        for (let c = begin; c <= end; c++) codepoints.add(c);
      }
    }
  }
  return codepoints;
}

/** Windows-platform name records, by name id. 1 is family, 16 the
    typographic family ("Inter" where 1 says "Inter Medium"). */
function nameRecords(tables) {
  const name = tables.name;
  const out = {};
  if (!name) return out;
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (name.readUInt16BE(r) !== 3) continue; // Windows platform, UTF-16BE
    const id = name.readUInt16BE(r + 6);
    if (out[id] !== undefined) continue;
    const len = name.readUInt16BE(r + 8);
    const off = strings + name.readUInt16BE(r + 10);
    let text = "";
    for (let k = 0; k < len; k += 2) text += String.fromCharCode(name.readUInt16BE(off + k));
    out[id] = text;
  }
  return out;
}

/**
 * What a font file is, in the terms an @font-face rule talks in:
 *   family     typographic family name
 *   weight     { min, max } the file can draw — equal for a static font,
 *              the wght axis for a variable one
 *   variable   whether a wght axis exists
 *   codepoints the cmap
 */
function describeFont(file) {
  const tables = readTables(file);
  const names = nameRecords(tables);
  const os2Weight = tables["OS/2"] ? tables["OS/2"].readUInt16BE(4) : 400;

  let weight = { min: os2Weight, max: os2Weight };
  let variable = false;
  const fvar = tables.fvar;
  if (fvar) {
    const axesOffset = fvar.readUInt16BE(4);
    const axisCount = fvar.readUInt16BE(8);
    const axisSize = fvar.readUInt16BE(10);
    for (let i = 0; i < axisCount; i++) {
      const a = axesOffset + i * axisSize;
      if (fvar.toString("latin1", a, a + 4) !== "wght") continue;
      weight = { min: fvar.readInt32BE(a + 4) / 65536, max: fvar.readInt32BE(a + 12) / 65536 };
      variable = true;
    }
  }

  return {
    family: names[16] || names[1] || "",
    weight,
    variable,
    codepoints: cmapCodepoints(file, tables)
  };
}

module.exports = { readTables, cmapCodepoints, describeFont };

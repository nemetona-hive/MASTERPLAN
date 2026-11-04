import { parseMeasurement } from "./measurements.cjs";

/*
 * What a gypsum board job needs, described once.
 *
 * Same rule as `take-off.js` and `cut-list.js`: one model, many renderers. The
 * page reads its on-screen figures AND its diagrams out of this object, and the
 * printed take-off reads the same object, so the sheet count under the drawing
 * is the count on the paper.
 *
 * THE LAYOUT IS THE COUNT. Sheets are not "area ÷ sheet area + waste": every
 * surface is laid out in lanes of full-width board, every lane is cut into
 * pieces, and the pieces are packed back into stock sheets. A cut piece's
 * offcut is reused when a later piece fits in it. Waste % is then added on top
 * for breakage and mistakes, not for cutting — the cutting is already counted.
 *
 * Openings are deducted from AREA (screws, compound) but not from sheets: a
 * door is cut out of boards that are hung whole, and the piece above it comes
 * from the same board. Counting sheets with openings removed undercounts.
 *
 * EVERYTHING NUMERIC IS A NUMBER. Renderers format on the way to the page.
 */

/* Shortest piece the layout will leave at a lane end. A shorter remainder is
   avoided by moving that lane's joints, so nobody fixes a 40mm sliver. */
export const MIN_END_PIECE = 300;
/* A lane longer than a sheet needs end joints. Neighbouring lanes start half
   a sheet apart, which keeps end joints staggered well past the 400mm board
   makers ask for (worst case after the sliver shift: SL/2 − 300). */
const STAGGER = 0.5;
/* Guard against a typo of 9 999 999 drawing a million rectangles. */
const MAX_LANES = 400;
const MAX_PIECES = 4000;
const EPS = 1e-6;

const num = value => {
  const n = parseMeasurement(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const supplied = value => {
  const n = parseMeasurement(value);
  return Number.isFinite(n) && n > 0;
};
const given = value => parseMeasurement(value) !== null;
const round = (value, places) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

/**
 * Cuts one lane of length `span` into pieces from sheets of length `sheetL`.
 * Returns piece lengths, in order from the lane's start.
 */
export function lanePieces(span, sheetL, laneIndex) {
  if (span <= sheetL + EPS) return [span];
  let first = laneIndex % 2 === 1 ? sheetL * STAGGER : sheetL;
  const rest = span - first;
  const full = Math.floor((rest + EPS) / sheetL);
  let last = rest - full * sheetL;
  if (last > EPS && last < MIN_END_PIECE) {
    first -= MIN_END_PIECE - last;
    last = MIN_END_PIECE;
  }
  const pieces = [first, ...Array(full).fill(sheetL)];
  if (last > EPS) pieces.push(last);
  return pieces;
}

/**
 * One surface laid out. `w` is the horizontal span, `h` the vertical one (for
 * a ceiling: length and width). Horizontal fixing runs lanes along `w` stacked
 * up `h`; vertical runs them up `h` side by side along `w`.
 *
 * Rows come out in the shape `simulation.js` produces, because the diagram is
 * the existing LayoutVisualization: in "V" its rows are columns and a
 * segment's `x` runs along the lane.
 */
export function layoutSurface({ w, h, sheetW, sheetL, orientation }) {
  const vertical = orientation === "V";
  const laneLength = vertical ? h : w;
  const across = vertical ? w : h;
  const lanes = [];
  let pos = 0;
  while (across - pos > EPS) {
    lanes.push(Math.min(sheetW, across - pos));
    pos += sheetW;
  }
  const rows = lanes.map((laneW, laneIndex) => {
    let x = 0;
    const segs = lanePieces(laneLength, sheetL, laneIndex).map(len => {
      const whole = Math.abs(len - sheetL) < EPS && Math.abs(laneW - sheetW) < EPS;
      // `pid` picks the palette swatch for a full sheet in the diagram.
      const seg = { x, w: len, type: whole ? "full" : "cut", laneW, ...(whole ? { pid: 0 } : {}) };
      x += len;
      return seg;
    });
    return { segs, h: laneW };
  });

  /* Joint length on this face: the long edges between lanes, plus every end
     joint across its lane's width. This is what the tape covers. */
  const edgeJoints = Math.max(0, lanes.length - 1) * laneLength;
  const endJoints = rows.reduce((total, row) => total + (row.segs.length - 1) * row.h, 0);

  return {
    rows,
    laneLength,
    lanes: lanes.length,
    joints: edgeJoints + endJoints,
    full: rows.reduce((n, row) => n + row.segs.filter(s => s.type === "full").length, 0),
    cut: rows.reduce((n, row) => n + row.segs.filter(s => s.type === "cut").length, 0),
    meta: {
      /* The keys LayoutVisualization reads. `exactRows` makes it draw each
         lane at its real width, so a ripped last lane is drawn narrow. */
      visualization: "rows",
      surfaceW: w, surfaceH: h,
      simW: laneLength, simH: across,
      PPi: sheetL, PLa: sheetW,
      direction: vertical ? "V" : "H",
      exactRows: true,
      palClasses: ["color-s1"]
    }
  };
}

/**
 * Packs every piece into stock sheets: whole pieces are a sheet each; cut
 * pieces go first-fit-decreasing into sheet lengths, grouped by lane width,
 * because the strip left after ripping a narrow lane is no use for a full one.
 * A narrow lane can come several to a sheet (two 600 strips from one 1200).
 */
export function packSheets(pieces, sheetW, sheetL) {
  let whole = 0;
  const byWidth = new Map();
  for (const piece of pieces) {
    if (piece.type === "full") { whole++; continue; }
    const key = Math.round(piece.laneW * 1000) / 1000;
    if (!byWidth.has(key)) byWidth.set(key, []);
    byWidth.get(key).push(piece.w);
  }
  let cutSheets = 0;
  for (const [laneW, lengths] of byWidth) {
    const bins = [];
    for (const len of lengths.sort((a, b) => b - a)) {
      const bin = bins.find(remaining => remaining.left + EPS >= len);
      if (bin) bin.left -= len;
      else bins.push({ left: sheetL - len });
    }
    const stripsPerSheet = Math.max(1, Math.floor((sheetW + EPS) / laneW));
    cutSheets += Math.ceil(bins.length / stripsPerSheet);
  }
  return { whole, cutSheets, total: whole + cutSheets };
}

/**
 * Builds the gypsum take-off from the page's raw fields. Returns a model even
 * when half-filled; `ready` says whether there is enough to print.
 */
export function buildGypsumTakeOff(fields) {
  const {
    mode, lenMm, widMm, heightMm, wallW, wallH, ceiling,
    doors, doorW, doorH, windows, winW, winH,
    sheetW, sheetL, orientation, layers, waste,
    screwRate, compoundRate, bagKg, sheetPrice, product
  } = fields;

  const room = mode !== "wall";
  const SW = num(sheetW), SL = num(sheetL);
  const layerCount = String(layers) === "2" ? 2 : 1;
  const fix = orientation === "H" ? "H" : "V";

  const dimsReady = room
    ? [lenMm, widMm, heightMm].every(supplied)
    : [wallW, wallH].every(supplied);
  const sheetReady = supplied(sheetW) && supplied(sheetL);

  /* The surfaces, grouped by identical size so each is laid out (and drawn)
     once and counted `count` times. */
  const L = num(lenMm), W = num(widMm), H = num(heightMm);
  let surfaces = [];
  if (dimsReady) {
    if (room) {
      if (Math.abs(L - W) < EPS) surfaces.push({ id: "walls", label: "Walls", w: L, h: H, count: 4, wall: true });
      else {
        surfaces.push({ id: "walls-l", label: "Length walls", w: L, h: H, count: 2, wall: true });
        surfaces.push({ id: "walls-w", label: "Width walls", w: W, h: H, count: 2, wall: true });
      }
      if (ceiling) surfaces.push({ id: "ceiling", label: "Ceiling", w: L, h: W, count: 1, wall: false });
    } else {
      surfaces.push({ id: "wall", label: "Wall", w: num(wallW), h: num(wallH), count: 1, wall: true });
    }
  }

  const tooLarge = sheetReady && surfaces.some(s => {
    const vertical = fix === "V";
    const lanes = Math.ceil((vertical ? s.w : s.h) / SW);
    const perLane = Math.ceil((vertical ? s.h : s.w) / SL) + 1;
    return lanes > MAX_LANES || lanes * perLane > MAX_PIECES;
  });

  const laidOut = sheetReady && !tooLarge
    ? surfaces.map(s => ({ ...s, layout: layoutSurface({ w: s.w, h: s.h, sheetW: SW, sheetL: SL, orientation: fix }) }))
    : surfaces.map(s => ({ ...s, layout: null }));

  /* Pack one face layer; a second layer is the same count again (its joints
     are offset from the first, which moves pieces but not how many). */
  const pieces = laidOut.flatMap(s => s.layout
    ? Array.from({ length: s.count }, () => s.layout.rows.flatMap(row => row.segs)).flat()
    : []);
  const packed = packSheets(pieces, SW || 1, SL || 1);
  const layoutSheets = packed.total * layerCount;

  const wastePct = given(waste) ? num(waste) : 0;
  const sheetsExact = layoutSheets * (1 + wastePct / 100);
  const toBuy = layoutSheets > 0 ? Math.ceil(sheetsExact - EPS) : 0;

  // Area, in m². Openings come off walls only.
  const gross = surfaces.reduce((total, s) => total + s.w * s.h * s.count, 0) / 1e6;
  const doorArea = num(doors) * num(doorW) * num(doorH) / 1e6;
  const windowArea = num(windows) * num(winW) * num(winH) / 1e6;
  const wallArea = surfaces.filter(s => s.wall).reduce((t, s) => t + s.w * s.h * s.count, 0) / 1e6;
  const openings = Math.min(wallArea, doorArea + windowArea);
  const net = Math.max(0, gross - openings);
  const boarded = net * layerCount;

  const screws = Math.ceil(boarded * num(screwRate) - EPS);
  const compoundKg = boarded * num(compoundRate);
  const bag = num(bagKg);
  const bagsExact = bag > 0 ? compoundKg / bag : 0;
  const bags = Math.ceil(bagsExact - EPS);

  /* Tape goes on the face layer only — the layer underneath is filled, not
     taped. Board joints come from the layout; a room adds its four internal
     corners and, with a ceiling, the ceiling-to-wall angle. */
  const boardJoints = laidOut.reduce((t, s) => t + (s.layout ? s.layout.joints * s.count : 0), 0) / 1000;
  const corners = room && dimsReady ? (4 * H + (ceiling ? 2 * (L + W) : 0)) / 1000 : 0;

  const price = num(sheetPrice);
  const total = toBuy > 0 && price > 0 ? toBuy * price : null;

  const openingsTooBig = doorArea + windowArea > wallArea + EPS && wallArea > 0;
  const sheetValid = sheetReady && SW <= SL;
  const ready = dimsReady && sheetValid && !tooLarge && gross > 0 && toBuy > 0;

  return {
    ready,
    issue: ready ? null
      : !dimsReady ? (room ? "Enter the room length, width and height." : "Enter the wall width and height.")
      : !sheetReady ? "Enter the sheet width and length."
      : !sheetValid ? "Sheet width cannot be more than its length."
      : tooLarge ? "That surface is too large to lay out — check the dimensions."
      : "Enter valid dimensions to finish the estimate.",
    warning: openingsTooBig ? "Openings are larger than the wall area; they are capped at it." : null,

    mode: room ? "room" : "wall",
    orientation: fix,
    layers: layerCount,
    sheet: { width: SW || null, length: SL || null, area: round(SW * SL / 1e6, 2) },
    surfaces: laidOut.map(s => ({
      id: s.id, label: s.label, width: s.w, height: s.h, count: s.count,
      area: round(s.w * s.h * s.count / 1e6, 2),
      layout: s.layout
    })),
    area: {
      gross: round(gross, 2),
      openings: round(openings, 2),
      net: round(net, 2),
      boarded: round(boarded, 2)
    },
    openings: {
      doors: num(doors), doorW: num(doorW), doorH: num(doorH),
      windows: num(windows), winW: num(winW), winH: num(winH)
    },
    sheets: {
      full: packed.whole * layerCount,
      fromCuts: packed.cutSheets * layerCount,
      layout: layoutSheets,
      waste: wastePct,
      exact: round(sheetsExact, 2),
      toBuy,
      price: price || null,
      total: total === null ? null : round(total, 2)
    },
    screws: { rate: given(screwRate) ? num(screwRate) : null, count: screws },
    compound: {
      rate: given(compoundRate) ? num(compoundRate) : null,
      kg: round(compoundKg, 1),
      bagKg: bag || null,
      bagsExact: round(bagsExact, 2),
      bags
    },
    tape: {
      joints: round(boardJoints, 1),
      corners: round(corners, 1),
      total: round(boardJoints + corners, 1)
    },
    product: given(product) ? product : null
  };
}

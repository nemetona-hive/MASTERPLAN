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
 * Openings are deducted from AREA (screws). From SHEETS only when
 * placed, and then only the pieces lying wholly inside one: a piece the
 * opening merely crosses is hung whole and cut out, and the piece above a door
 * comes from the same board. Removing an opening's area from the sheet count
 * would undercount.
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
 *
 * `start` (mm) makes the lane's first piece that long, so the first full board
 * begins on a stud rather than at the corner; alternate lanes still begin half
 * a sheet further on, counted from there, which keeps the end joints apart.
 *
 * A remainder under MIN_END_PIECE is made up from the piece before it. By
 * default that is the lane's first piece (one cut at the corner, every board
 * after it whole). `fullStart` keeps the first piece as it is and trims the
 * last whole board instead, so a lane that starts on a full board still does:
 * 5130 in 2500s is 2330 · 2500 · 300 by default, 2500 · 2330 · 300 with it.
 * With no whole board to trim it falls back to the first piece.
 */
export function lanePieces(span, sheetL, laneIndex, start = 0, fullStart = false) {
  if (span <= sheetL + EPS) return [span];
  const stagger = laneIndex % 2 === 1 ? sheetL * STAGGER : 0;
  let first = start > EPS ? start + stagger : (stagger || sheetL);
  if (first > sheetL + EPS) first -= sheetL;
  if (first >= span - EPS) return [span];
  const rest = span - first;
  const full = Math.floor((rest + EPS) / sheetL);
  let last = rest - full * sheetL;
  const short = last > EPS && last < MIN_END_PIECE ? MIN_END_PIECE - last : 0;
  if (short && fullStart && full > 0) {
    const pieces = [first, ...Array(full - 1).fill(sheetL), sheetL - short, MIN_END_PIECE];
    return pieces;
  }
  if (short) {
    first -= short;
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
 *
 * `openings` are rectangles on the surface (same frame as `pieces`). A piece
 * lying wholly inside one is never hung, so it is dropped — from the drawing
 * and from the sheet count. A piece the opening only overlaps stays: it is
 * hung and cut around.
 *
 * `rowStart` is which side lane 1 (R1) starts from, as on Pattern Layouts:
 * "top" puts it at the top fixed horizontally and at the left fixed
 * vertically; "bottom" at the bottom or the right. The ripped last lane ends
 * up on the other side, and the first-lane strip below starts from R1's side.
 *
 * `firstLane` (mm) keeps the first full board off the corner so its edge lands
 * on a stud: with studs at 600 centres, 600 puts it on the first stud after
 * the corner stud. Fixed vertically, the surface starts with a strip that
 * wide; fixed horizontally, every lane's first piece is that long (see
 * `lanePieces`). Ignored unless it is shorter than the board's side it cuts.
 */
export function layoutSurface({ w, h, sheetW, sheetL, orientation, openings = [], firstLane = 0, rowStart = "top", fullStart = false }) {
  const vertical = orientation === "V";
  const laneLength = vertical ? h : w;
  const across = vertical ? w : h;
  const lanes = [];
  let pos = 0;
  if (vertical && firstLane > EPS && firstLane < sheetW - EPS) {
    lanes.push(Math.min(firstLane, across));
    pos = firstLane;
  }
  while (across - pos > EPS) {
    lanes.push(Math.min(sheetW, across - pos));
    pos += sheetW;
  }
  const fullRows = lanes.map((laneW, laneIndex) => {
    let x = 0;
    const start = !vertical && firstLane > EPS && firstLane < sheetL - EPS ? firstLane : 0;
    const segs = lanePieces(laneLength, sheetL, laneIndex, start, fullStart).map(len => {
      const whole = Math.abs(len - sheetL) < EPS && Math.abs(laneW - sheetW) < EPS;
      /* `label` is what the diagrams print on the piece: its width across the
         wall — the lane's width fixed vertically, its own length fixed
         horizontally. `size` is both sides, for a tooltip. `pid` picks the
         palette swatch for a full sheet in the diagram. */
      const label = String(Math.round(vertical ? laneW : len));
      const size = `${Math.round(laneW)} × ${Math.round(len)} mm`;
      const seg = { x, w: len, type: whole ? "full" : "cut", laneW, label, size, ...(whole ? { pid: 0 } : {}) };
      x += len;
      return seg;
    });
    return { segs, h: laneW };
  });

  /* Joint length on this face: the long edges between lanes, plus every end
     joint across its lane's width. This is what the tape covers. Taken
     before openings drop pieces — an opening's own edges need taping too, and
     this is the closer of the two figures to that. */
  const edgeJoints = Math.max(0, lanes.length - 1) * laneLength;
  const endJoints = fullRows.reduce((total, row) => total + (row.segs.length - 1) * row.h, 0);

  /* Every piece as a rectangle on the surface, x right and y down from the
     top-left corner, in mm. The printed sheet draws these as they are — the
     geometry is worked out here so no renderer re-derives where a lane sits.
     Lanes are placed the way the screen draws them: vertical columns from the
     left with the first piece at the top, horizontal rows from the top. */
  const pieces = [];
  const reversed = rowStart === "bottom";
  const inside = rect => openings.some(o =>
    rect.x >= o.x - EPS && rect.y >= o.y - EPS &&
    rect.x + rect.w <= o.x + o.w + EPS && rect.y + rect.h <= o.y + o.h + EPS);
  let laneStart = reversed ? across : 0;
  const rows = fullRows.map((row, lane) => {
    if (reversed) laneStart -= row.h;
    const at = laneStart;
    if (!reversed) laneStart += row.h;
    const segs = row.segs.filter(seg => {
      const rect = vertical
        ? { x: at, y: seg.x, w: row.h, h: seg.w, len: seg.w, type: seg.type, lane, label: seg.label, size: seg.size }
        : { x: seg.x, y: at, w: seg.w, h: row.h, len: seg.w, type: seg.type, lane, label: seg.label, size: seg.size };
      if (inside(rect)) return false;
      pieces.push(rect);
      return true;
    });
    return { ...row, segs };
  });

  return {
    rows,
    pieces,
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
      /* The side R1 is drawn on; the 2D view reads it as its `rowStart`. */
      rowStart: reversed ? "bottom" : "top",
      exactRows: true,
      palClasses: ["color-s1"],
      /* Drawn over the pieces, in surface mm. */
      openings
    }
  };
}

/**
 * Packs every piece into stock sheets: whole pieces are a sheet each; cut
 * pieces go first-fit-decreasing into sheet lengths, grouped by lane width,
 * because the strip left after ripping a narrow lane is no use for a full one.
 * A narrow lane can come several to a sheet (two 600 strips from one 1200).
 *
 * `fullBoards` buys a whole board for every piece, cut or not: offcuts are
 * not reused and strips are not doubled up, for a crew that does not keep
 * them or a job that wants spare board on site.
 */
export function packSheets(pieces, sheetW, sheetL, { fullBoards = false } = {}) {
  let whole = 0;
  const byWidth = new Map();
  if (fullBoards) {
    for (const piece of pieces) if (piece.type === "full") whole++;
    return { whole, cutSheets: pieces.length - whole, total: pieces.length };
  }
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

export const WALLS = ["A", "B", "C", "D"];

/* How much filler a metre of joint holds, as a skim-equivalent: millimetres
   of thickness times metres of width. Knauf states Fill & Finish Light per m²
   of board — 0.2 kg/m² filling plus 0.1 kg/m² finishing the joints, and
   1.1 kg/m² per mm as a skim (Knauf DE data sheet K495). On 1250 mm boards a
   m² carries about 0.8 m of joint, so a metre of joint takes 0.3 / 0.8 =
   0.375 kg, which is 1.1 kg/m²·mm × 0.34: a joint filled and finished is
   worth 1 mm over a 340 mm strip. It turns any filler's per-mm figure into a
   per-metre one when the maker gives no per-metre figure. */
export const JOINT_FILL_MM_M = 0.34;

/**
 * A filler's rate per metre of joint: the stated one when there is one
 * (Uniflott: 0.25 kg/m), else derived from its kg/m² per mm. `derived` says
 * which, so the page can show the figure it worked out.
 */
export function jointFillerRate(perMetre, perMm) {
  if (given(perMetre)) return { rate: num(perMetre), derived: false };
  if (given(perMm) && num(perMm) > 0) return { rate: round(num(perMm) * JOINT_FILL_MM_M, 3), derived: true };
  return { rate: null, derived: false };
}

/**
 * Reads the openings list into numbers and checks each against its wall.
 *
 * An opening is a door or window on wall A–D (a room) or on the one wall. Its
 * position — `x`, mm from the wall's left end as seen from inside the room —
 * is optional: without it the opening still comes off the area, it just is
 * not drawn and removes no pieces. A window stands on its sill; a door on the
 * floor. Sizes are what is cut out of the board, not the frame.
 *
 * Returns every opening with `status`: "ok", "unplaced", "invalid" (no usable
 * size) or "misfit" (placed, but runs off its wall). The last two take no
 * part in anything except the warning that names them.
 */
export function readOpenings(list, { room, wallSize }) {
  const counters = { door: 0, window: 0 };
  return (Array.isArray(list) ? list : []).map(o => {
    const kind = o.kind === "window" ? "window" : "door";
    counters[kind] += 1;
    const label = `${kind === "door" ? "D" : "W"}${counters[kind]}`;
    const wall = room && WALLS.includes(o.wall) ? o.wall : "A";
    const w = num(o.w), h = num(o.h);
    const sill = kind === "window" ? num(o.sill) : 0;
    const placed = given(o.x);
    const x = num(o.x);
    const base = { label, kind, wall, w, h, sill, x: placed ? x : null };
    if (!(w > 0 && h > 0)) return { ...base, status: given(o.w) || given(o.h) ? "invalid" : "empty" };
    const size = wallSize(wall);
    if (size && (w > size.w + EPS || sill + h > size.h + EPS)) return { ...base, status: "misfit" };
    if (!placed) return { ...base, status: "unplaced" };
    if (size && x + w > size.w + EPS) return { ...base, status: "misfit" };
    return { ...base, status: "ok" };
  });
}

/**
 * Builds the gypsum take-off from the page's raw fields. Returns a model even
 * when half-filled; `ready` says whether there is enough to print.
 */
export function buildGypsumTakeOff(fields) {
  const {
    mode, lenMm, widMm, heightMm, wallW, wallH, ceiling,
    openings: openingList,
    sheetW, sheetL, orientation, layers, waste,
    screwRate, compoundRate, bagKg, sheetPrice, product,
    fixing, adhesiveRate, adhesiveBagKg, fillerProduct, adhesiveProduct,
    skimRate, skimMm, firstOffset, fullBoards, rowStart, fullStart
  } = fields;

  const room = mode !== "wall";
  const SW = num(sheetW), SL = num(sheetL);
  /* Glued ("dot and dab") is a lining stuck straight onto masonry: walls only,
     one layer. A ceiling cannot hang on adhesive, so it stays screwed, and a
     second layer has nothing to be screwed into — glued forces one layer. */
  const glued = fixing === "glue";
  const layerCount = !glued && String(layers) === "2" ? 2 : 1;
  const fix = orientation === "H" ? "H" : "V";
  const start = rowStart === "bottom" ? "bottom" : "top";

  const dimsReady = room
    ? [lenMm, widMm, heightMm].every(supplied)
    : [wallW, wallH].every(supplied);
  const sheetReady = supplied(sheetW) && supplied(sheetL);

  /* The walls, one each. A room's go A (back), B (right), C (front), D
     (left) — clockwise seen from above, and the order the 3D view folds them
     in. Each wall's openings sit in its own frame: x from its left end as seen
     from inside, y down from its top. */
  const L = num(lenMm), W = num(widMm), H = num(heightMm);
  const wallDims = !dimsReady ? []
    : room ? [["A", L, H], ["B", W, H], ["C", L, H], ["D", W, H]]
    : [["A", num(wallW), num(wallH)]];
  const wallSize = letter => {
    const found = wallDims.find(([id]) => id === letter);
    return found ? { w: found[1], h: found[2] } : null;
  };
  const openingsRead = readOpenings(openingList, { room, wallSize });
  const counted = openingsRead.filter(o => o.status === "ok" || o.status === "unplaced");
  const placed = openingsRead.filter(o => o.status === "ok");

  /* Walls that match exactly — same size, same openings in the same places —
     are laid out and drawn once with a count; any difference splits them. */
  const groups = new Map();
  for (const [letter, w, h] of wallDims) {
    const rects = placed.filter(o => o.wall === letter)
      .map(o => ({ x: o.x, y: h - o.sill - o.h, w: o.w, h: o.h, kind: o.kind, label: o.label }));
    const key = JSON.stringify([w, h, rects.map(r => [r.x, r.y, r.w, r.h])]);
    if (groups.has(key)) {
      const g = groups.get(key);
      g.walls.push(letter); g.count += 1;
      /* Labels differ between identical twins (D1 on A, D2 on C); the
         drawing shows the first wall's. */
    } else {
      groups.set(key, { w, h, walls: [letter], count: 1, wall: true, openings: rects });
    }
  }
  let surfaces = [...groups.values()].map(g => ({
    ...g,
    id: room ? `wall-${g.walls.join("").toLowerCase()}` : "wall",
    label: !room ? "Wall" : `${g.walls.length > 1 ? "Walls" : "Wall"} ${g.walls.join(", ")}`
  }));
  if (dimsReady && room && ceiling) {
    surfaces.push({ id: "ceiling", label: "Ceiling", w: L, h: W, count: 1, wall: false, walls: [], openings: [] });
  }

  /* First-panel offset: walls only (a ceiling's joists are another grid),
     and shorter than the board side it cuts — the width fixed vertically,
     the length fixed horizontally — or it would be a whole board. */
  const offsetAsked = given(firstOffset) ? num(firstOffset) : 0;
  const offsetLimit = fix === "V" ? SW : SL;
  const offsetFits = offsetAsked > 0 && offsetLimit > 0 && offsetAsked < offsetLimit;
  const offset = offsetFits ? offsetAsked : 0;

  const tooLarge = sheetReady && surfaces.some(s => {
    const vertical = fix === "V";
    const lanes = Math.ceil((vertical ? s.w : s.h) / SW);
    const perLane = Math.ceil((vertical ? s.h : s.w) / SL) + 1;
    return lanes > MAX_LANES || lanes * perLane > MAX_PIECES;
  });

  /* `boards` on a layout is what one of those surfaces takes on its own,
     every layer: its pieces packed with only its own offcuts. The room's
     count below packs every surface together, so it can be less than these
     added up — an offcut from one wall finishes another. */
  const laidOut = sheetReady && !tooLarge
    ? surfaces.map(s => {
        const layout = layoutSurface({ w: s.w, h: s.h, sheetW: SW, sheetL: SL, orientation: fix, openings: s.openings,
          firstLane: s.wall ? offset : 0, rowStart: start, fullStart: Boolean(fullStart) });
        const own = packSheets(layout.rows.flatMap(row => row.segs), SW, SL, { fullBoards: Boolean(fullBoards) });
        return { ...s, layout: { ...layout, boards: own.total * layerCount } };
      })
    : surfaces.map(s => ({ ...s, layout: null }));

  /* Pack one face layer; a second layer is the same count again (its joints
     are offset from the first, which moves pieces but not how many). */
  const pieces = laidOut.flatMap(s => s.layout
    ? Array.from({ length: s.count }, () => s.layout.rows.flatMap(row => row.segs)).flat()
    : []);
  const packed = packSheets(pieces, SW || 1, SL || 1, { fullBoards: Boolean(fullBoards) });
  const layoutSheets = packed.total * layerCount;

  const wastePct = given(waste) ? num(waste) : 0;
  const sheetsExact = layoutSheets * (1 + wastePct / 100);
  const toBuy = layoutSheets > 0 ? Math.ceil(sheetsExact - EPS) : 0;

  // Area, in m². Openings come off walls only.
  const gross = surfaces.reduce((total, s) => total + s.w * s.h * s.count, 0) / 1e6;
  const openingArea = counted.reduce((t, o) => t + o.w * o.h, 0) / 1e6;
  const wallArea = surfaces.filter(s => s.wall).reduce((t, s) => t + s.w * s.h * s.count, 0) / 1e6;
  const openings = Math.min(wallArea, openingArea);
  const net = Math.max(0, gross - openings);
  const boarded = net * layerCount;

  /* Glued walls take adhesive instead of screws; the ceiling, if boarded,
     is screwed either way. Openings come off the walls, so the glued area is
     the walls' net. */
  const wallNet = Math.max(0, wallArea - openings);
  const screwedArea = (glued ? net - wallNet : net) * layerCount;
  const screws = Math.max(0, Math.ceil(screwedArea * num(screwRate) - EPS));   // max: ceil(-EPS) is -0
  const adhesiveKg = glued ? wallNet * num(adhesiveRate) : 0;
  const adhesiveBag = num(adhesiveBagKg);
  const adhesiveBags = adhesiveBag > 0 ? Math.ceil(adhesiveKg / adhesiveBag - EPS) : 0;
  /* Tape goes on the face layer only — the layer underneath is filled, not
     taped. Board joints come from the layout; a room adds its four internal
     corners and, with a ceiling, the ceiling-to-wall angle. */
  const boardJoints = laidOut.reduce((t, s) => t + (s.layout ? s.layout.joints * s.count : 0), 0) / 1000;
  const corners = room && dimsReady ? (4 * H + (ceiling ? 2 * (L + W) : 0)) / 1000 : 0;

  /* Joint filler is given per metre of joint, as the makers give it (Knauf
     Uniflott: 0.25 kg per m of joint), not per m² of board. Filled: every
     board joint on every layer — the layer underneath is filled though not
     taped — plus the corners. Openings change it only through the joints the
     layout loses with the pieces they remove. */
  const filledLength = boardJoints * layerCount + corners;
  const jointRate = jointFillerRate(compoundRate, skimRate);
  const jointKg = filledLength * (jointRate.rate || 0);
  /* A full-surface skim (Knauf's Q4, at least 1 mm) goes over the face
     layer's net area at the filler's per-mm rate. */
  const skimThickness = given(skimMm) ? num(skimMm) : 0;
  const skimPerMm = given(skimRate) ? num(skimRate) : 0;
  const skimKg = skimThickness > 0 ? net * skimThickness * skimPerMm : 0;
  const compoundKg = jointKg + skimKg;
  const bag = num(bagKg);
  const bagsExact = bag > 0 ? compoundKg / bag : 0;
  const bags = Math.ceil(bagsExact - EPS);

  const price = num(sheetPrice);
  const total = toBuy > 0 && price > 0 ? toBuy * price : null;

  const openingsTooBig = openingArea > wallArea + EPS && wallArea > 0;
  const misfits = openingsRead.filter(o => o.status === "misfit");
  const invalid = openingsRead.filter(o => o.status === "invalid");
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
    warning: misfits.length
      ? `${misfits.map(o => room ? `${o.label} (wall ${o.wall})` : o.label).join(", ")} ${misfits.length === 1 ? "does" : "do"} not fit on ${misfits.length === 1 ? "its" : "their"} wall and ${misfits.length === 1 ? "is" : "are"} left out.`
      : invalid.length ? `${invalid.map(o => o.label).join(", ")}: enter a width and height.`
      : openingsTooBig ? "Openings are larger than the wall area; they are capped at it."
      : skimThickness > 0 && !skimPerMm ? "Enter the filler's kg/m² per 1 mm to count the surface skim."
      : offsetAsked > 0 && offsetLimit > 0 && !offsetFits
        ? `First panel offset must be less than the sheet ${fix === "V" ? "width" : "length"}; it is left out.` : null,

    /* The box the 3D view folds the surfaces into, in mm. A single wall has
       no depth and no ceiling. */
    room: dimsReady
      ? (room ? { length: L, width: W, height: H, ceiling: Boolean(ceiling) }
              : { length: num(wallW), width: 0, height: num(wallH), ceiling: false })
      : null,
    orientation: fix,
    rowStart: start,
    fullStart: Boolean(fullStart),
    firstOffset: offset || null,
    fixing: glued ? "glue" : "screw",
    layers: layerCount,
    sheet: { width: SW || null, length: SL || null },
    surfaces: laidOut.map(s => ({
      id: s.id, label: s.label, width: s.w, height: s.h, count: s.count,
      walls: s.walls, openings: s.openings,
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
      list: openingsRead,
      doors: counted.filter(o => o.kind === "door").length,
      windows: counted.filter(o => o.kind === "window").length
    },
    sheets: {
      full: packed.whole * layerCount,
      fromCuts: packed.cutSheets * layerCount,
      layout: layoutSheets,
      /* Every piece bought as a whole board (`packSheets`). */
      fullBoards: Boolean(fullBoards),
      waste: wastePct,
      exact: round(sheetsExact, 2),
      toBuy,
      price: price || null,
      total: total === null ? null : round(total, 2)
    },
    screws: { rate: given(screwRate) ? num(screwRate) : null, count: screws, area: round(screwedArea, 2) },
    adhesive: glued ? {
      rate: given(adhesiveRate) ? num(adhesiveRate) : null,
      area: round(wallNet, 2),
      kg: round(adhesiveKg, 1),
      bagKg: adhesiveBag || null,
      bags: adhesiveBags,
      product: given(adhesiveProduct) ? adhesiveProduct : null
    } : null,
    compound: {
      rate: jointRate.rate,
      rateDerived: jointRate.derived,
      perMm: skimPerMm || null,
      length: round(filledLength, 1),
      jointKg: round(jointKg, 1),
      skim: skimThickness > 0 ? { mm: skimThickness, area: round(net, 2), kg: round(skimKg, 1) } : null,
      product: given(fillerProduct) ? fillerProduct : null,
      kg: round(compoundKg, 1),
      bagKg: bag || null,
      bags
    },
    /* `needed`: tape is bought with a joint filler. A room with none set is
       taped by nobody here, so every view leaves tape out with the filler. */
    tape: {
      needed: jointRate.rate !== null || skimThickness > 0 && skimPerMm > 0,
      joints: round(boardJoints, 1),
      corners: round(corners, 1),
      total: round(boardJoints + corners, 1)
    },
    product: given(product) ? product : null
  };
}

/**
 * The whole project: every room and wall the Gypsum page holds, added up.
 *
 * `entries` are `{ id, name, takeOff }`, each `takeOff` straight from
 * `buildGypsumTakeOff`, so a room's own figures here are the ones its own
 * card shows. Only rooms that are `ready` count; the rest are listed with the
 * reason, so a half-entered room cannot quietly add nothing to an order.
 *
 * Materials are grouped by what is bought, not summed blindly: boards by
 * product, sheet size and price (a bathroom's moisture board is a separate
 * order line from a bedroom's standard board), filler and adhesive by product
 * and bag. Sheets add the rooms' exact counts, waste included, and round up
 * once — a fraction of a sheet left over in each of three rooms is one sheet,
 * not three. Bags are rounded up from the summed kilograms the same way.
 * Offcuts are not shared between rooms: each room's layout count is its own.
 */
export function buildGypsumProjectTakeOff(entries) {
  const list = entries || [];
  const ready = list.filter(e => e.takeOff && e.takeOff.ready);
  const byKey = (items, keyOf, make, add) => {
    const groups = new Map();
    for (const item of items) {
      const key = JSON.stringify(keyOf(item));
      if (!groups.has(key)) groups.set(key, make(item));
      add(groups.get(key), item);
    }
    return [...groups.values()];
  };

  const boards = byKey(ready, ({ takeOff: t }) => [t.product, t.sheet.width, t.sheet.length, t.sheets.price],
    ({ takeOff: t }) => ({ product: t.product, width: t.sheet.width, length: t.sheet.length, price: t.sheets.price,
      exact: 0, rooms: [] }),
    (g, { name, takeOff: t }) => { g.exact += t.sheets.exact; g.rooms.push(name); })
    .map(g => {
      const toBuy = g.exact > 0 ? Math.ceil(g.exact - EPS) : 0;
      return { ...g, exact: round(g.exact, 2), toBuy, total: g.price ? round(toBuy * g.price, 2) : null };
    });

  const bagged = (items, part) => byKey(items, e => [part(e).product, part(e).bagKg],
    e => ({ product: part(e).product, bagKg: part(e).bagKg, kg: 0, rooms: [] }),
    (g, e) => { g.kg += part(e).kg; g.rooms.push(e.name); })
    .map(g => ({ ...g, kg: round(g.kg, 1), bags: g.bagKg ? Math.ceil(g.kg / g.bagKg - EPS) : 0 }));

  const filler = bagged(ready.filter(({ takeOff: t }) => t.compound.rate !== null || t.compound.skim), e => e.takeOff.compound);
  const adhesive = bagged(ready.filter(({ takeOff: t }) => t.adhesive && t.adhesive.rate !== null), e => e.takeOff.adhesive);
  const screwed = ready.filter(({ takeOff: t }) => t.screws.rate !== null && t.screws.area > 0);
  const sum = (items, read) => items.reduce((total, e) => total + read(e.takeOff), 0);

  const priced = boards.filter(b => b.total !== null);
  return {
    ready: ready.length > 0,
    count: list.length,
    readyCount: ready.length,
    rooms: list.map(({ id, name, takeOff: t }) => ({
      id, name,
      ready: t.ready,
      net: t.ready ? t.area.net : 0,
      sheets: t.ready ? t.sheets.toBuy : 0,
      product: t.product,
      sheet: t.sheet,
      total: t.ready ? t.sheets.total : null
    })),
    area: {
      gross: round(sum(ready, t => t.area.gross), 2),
      openings: round(sum(ready, t => t.area.openings), 2),
      net: round(sum(ready, t => t.area.net), 2)
    },
    boards,
    screws: { count: sum(screwed, t => t.screws.count) },
    adhesive,
    filler,
    /* Only rooms with a joint filler are taped (see `tape.needed`). */
    tape: (taped => ({ needed: taped.length > 0, total: round(sum(taped, t => t.tape.total), 1) }))(
      ready.filter(({ takeOff: t }) => t.tape.needed)),
    /* Board only, as on a room's sheet. `partial` when some boards carry no
       price, so the figure is not read as the whole order. */
    cost: priced.length ? { total: round(priced.reduce((t, b) => t + b.total, 0), 2), partial: priced.length < boards.length } : null
  };
}

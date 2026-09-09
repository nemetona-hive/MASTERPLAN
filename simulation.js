const symEdge = (total, step) => {
  if (!Number.isFinite(total) || !Number.isFinite(step) || step <= 0 || total <= 0) return { edgeWidth: 0, finalFullCount: 0 };
  if (total < step) return { edgeWidth: total / 2, finalFullCount: 0 };
  let fullCount = Math.floor(total / step);
  let remainder = total - fullCount * step;
  // If edge pieces would be less than 20% of a plank,
  // reduce full count to make edges larger/more stable.
  const useSimpleSplit = (remainder / 2) >= (step * 0.2);
  return {
	edgeWidth: useSimpleSplit ? remainder / 2 : (remainder + step) / 2,
	finalFullCount: useSimpleSplit ? fullCount : Math.max(0, fullCount - 1)
  };
};

const mkRowHeights = (H, PP, useSymmetry) => {
  if (PP <= 0) return [H];
  if (useSymmetry) {
	const { edgeWidth, finalFullCount } = symEdge(H, PP);
	return [edgeWidth, ...Array(Math.max(0, finalFullCount)).fill(PP), edgeWidth];
  }
  const count = Math.ceil(H / PP);
  if (count <= 0 || !isFinite(count)) return [H];
  return [...Array(count - 1).fill(PP), H - (count - 1) * PP];
};

function getSourceId(index) {
  let id = "";
  let i = index;
  while (i >= 0) {
    id = String.fromCharCode(65 + (i % 26)) + id;
    i = Math.floor(i / 26) - 1;
  }
  return id;
}

// Safety cap: prevent runaway loops with extreme values. Shared by both
// simulators and by the compute* wrappers, so the UI can tell "capped" apart
// from "legitimately empty" instead of silently rendering a valid 0-panel
// layout.
const MAX_SIM_STEPS = 2000;
const MAX_LAYOUT_SEGMENTS = 5000;
const exceedsSimCap = (span, step) => !Number.isFinite(span) || !Number.isFinite(step) || !(step > 0) || span / step > MAX_SIM_STEPS;
// Include leading/trailing cuts in the budget before allocating any rows.
const exceedsLayoutBudget = (width, height, length, pitch) =>
  exceedsSimCap(width, length) || exceedsSimCap(height, pitch) ||
  (Math.ceil(width / length) + 2) * (Math.ceil(height / pitch) + 2) > MAX_LAYOUT_SEGMENTS;

const simulate = (W, H, PP, PL, offset, minJ, sys, useSymmetry = false, startOff = 0, mirror = false) => {
  if (W <= 0 || H <= 0 || PP <= 0 || PL <= 0) return [];
  if (exceedsLayoutBudget(W, H, PL, PP)) return [];
  const heights = mkRowHeights(H, PP, useSymmetry);
  const startRemainder = startOff > 0 ? Math.max(0, Math.min(startOff, PL)) : 0;
  const rows = [];
  let remainder = startRemainder;
  let cutIndex = 0;
  let activeSourceId = null;
  for (let i = 0; i < heights.length; i++) {
	if (useSymmetry) remainder = startRemainder;
	const off = sys === 1 ? 0 : sys === 2 ? (i % 2 === 1 ? offset * PL : 0) : (i % 3) * (PL / 3);
	const segs = [];
	let x = -off;
	if (remainder > 0) {
	  const vs = Math.max(x, 0);
	  const ve = Math.min(x + remainder, W);
	  if (ve > vs) segs.push({ x: vs, w: ve - vs, type: "offcut", sourceId: activeSourceId });
	  x += remainder;
	}
	let pid = 0;
	while (x < W) {
	  const vs = Math.max(x, 0);
	  const ve = Math.min(x + PL, W);
	  if (ve > vs) {
		const isFull = x >= 0 && x + PL <= W;
		const cutW  = ve - vs;
		const type  = isFull ? "full" : (cutW >= minJ ? "cut" : "gap");
		let sourceId;
		if (type === "cut") {
		  activeSourceId = getSourceId(cutIndex++);
		  sourceId = activeSourceId;
		}
		segs.push({ x: vs, w: cutW, type, pid: isFull ? pid : undefined, sourceId });
		if (isFull) pid++;
	  }
	  x += PL;
	}
	const offsetW = W + off;
	const nj = remainder + Math.ceil(Math.max(0, offsetW - remainder) / PL) * PL - offsetW;
	remainder = nj >= minJ && isFinite(nj) && !isNaN(nj) ? nj : 0;

    if (mirror) {
      segs.forEach(s => { s.x = W - s.x - s.w; });
      segs.reverse();
    }
	rows.push({ segs, h: heights[i] });
  }
  return rows;
};

function simulateS4(W, H, PP, PLong, minJ, useSymmetry, mirror = false) {
  if (W <= 0 || H <= 0 || PP <= 0 || PLong <= 0) return [];
  if (exceedsLayoutBudget(W, H, PLong, PP)) return [];
  const heights = mkRowHeights(H, PP, useSymmetry);
  const rows = [];

  const fullCount = Math.floor(W / PLong);
  const shortPiece = W - fullCount * PLong; // 0 means no short piece needed

  for (let i = 0; i < heights.length; i++) {
    const h = heights[i];
    const segs = [];
    let x = 0, pid = 0;
    const startsWithShort = (i % 2 === 1) && shortPiece > 0;

    if (startsWithShort) {
      segs.push({ x, w: shortPiece, type: "cut", long: false });
      x += shortPiece;
    }

    while (x + PLong <= W) {
      segs.push({ x, w: PLong, type: "full", pid, long: true });
      x += PLong;
      pid++;
    }

    // For even rows, short piece goes at the end
    if (!startsWithShort && shortPiece > 0 && x < W) {
      const rem = W - x;
      segs.push({ x, w: rem, type: "cut", long: false });
    }

    if (mirror) {
      segs.forEach(s => { s.x = W - s.x - s.w; });
      segs.reverse();
    }
    rows.push({ segs, h });
  }
  return rows;
}

// Single helper replaces the old per-type nPanels/nCut/nGap/nOffcut wrappers.
const countSegs = (rows, type) =>
  Array.isArray(rows) ? rows.reduce((a, r) =>
    a + (Array.isArray(r.segs) ? r.segs.filter(s => s.type === type).length : 0)
  , 0) : 0;

const sumSegWidth = (rows, type) =>
  Array.isArray(rows) ? rows.reduce((a, r) =>
    a + (Array.isArray(r.segs) ? r.segs.reduce((acc, s) => acc + (s.type === type ? s.w : 0), 0) : 0)
  , 0) : 0;
const gapWidth = rows => sumSegWidth(rows, "gap");

function emptyLayoutResult() {
  return { status: "empty", valid: false, rows: [], stats: { full: 0, cut: 0, total: 0, stockPanels: 0 }, summaryRows: [], meta: {} };
}

// Same shape as emptyLayoutResult, but carries a summary row so the user sees
// why the visualization is blank rather than a silent "0 panels".
function cappedLayoutResult() {
  return {
    ...emptyLayoutResult(),
    status: "limited",
    capped: true,
    summaryRows: [
      { label: `Layout exceeds ${MAX_SIM_STEPS} pieces per axis or ${MAX_LAYOUT_SEGMENTS} segments \u2014 increase the material size or reduce the surface.`, value: "Too large", unit: "", hi: true, danger: true }
    ]
  };
}

function invalidLayoutResult(reason) {
  return { ...emptyLayoutResult(), status: "invalid", reason,
    summaryRows: [{ label: reason, value: "Invalid", unit: "", danger: true, hi: true }] };
}

// One procurement model shared by the page and the cut list. Simulation row
// indices are stable; a renderer may reorder them but must not recount stock.
function buildStockPlan(rows, stockLength) {
  const panels = new Map();
  let whole = 0;
  rows.forEach((row, rowIndex) => row.segs.forEach((seg, segmentIndex) => {
    if (seg.type === "gap") return;
    if (seg.type === "full" && !seg.sourceId) { whole++; return; }
    const id = seg.sourceId || `R${rowIndex + 1}-${segmentIndex + 1}`;
    seg.sourceId = id;
    if (!panels.has(id)) panels.set(id, { id, stock: stockLength, pieces: [] });
    panels.get(id).pieces.push({ row: rowIndex, segment: segmentIndex, width: seg.w, kind: seg.type });
  }));
  const cuts = [...panels.values()].map(panel => ({ ...panel,
    waste: Math.max(0, stockLength - panel.pieces.reduce((n, piece) => n + piece.width, 0))
  }));
  return { whole, panels: cuts, panelsToBuy: whole + cuts.length };
}

// First-fit decreasing: reuse remaining stock for short pieces as well as
// long ones. This is a feasible cutting plan, not a claim of global optimality.
function allocateS4Stock(rows, stockLength) {
  const pending = rows.flatMap(row => row.segs).filter(seg => seg.w < stockLength - 1e-7)
    .sort((a, b) => b.w - a.w);
  const bins = [];
  for (const seg of pending) {
    let bin = bins.find(candidate => candidate.remaining + 1e-7 >= seg.w);
    if (!bin) { bin = { id: `S${bins.length + 1}`, remaining: stockLength }; bins.push(bin); }
    seg.type = "cut";
    seg.sourceId = bin.id;
    bin.remaining -= seg.w;
  }
  return buildStockPlan(rows, stockLength);
}

function makeStats(rows) {
  let full = 0, cut = 0;
  if (Array.isArray(rows)) for (const r of rows)
    if (Array.isArray(r.segs)) for (const s of r.segs) {
      if (s.type === "full") full++;
      else if (s.type === "cut") cut++;
    }
  return { full, cut, total: full + cut };
}

function computeS0(state) {
  const roomWidth = Number(state.roomWidth), panelWidth = Number(state.panelWidth);
  const { oneFullEdge } = state;
  if (![roomWidth, panelWidth].every(Number.isFinite)) return invalidLayoutResult("Enter finite dimensions.");
  if (roomWidth <= 0 || panelWidth <= 0) return emptyLayoutResult();
  
  if (exceedsSimCap(roomWidth, panelWidth)) return cappedLayoutResult();
  const L = SUMMARY_LABELS.s0;
  
  if (oneFullEdge) {
    if (state.customFirstPieceWidth != null && !Number.isFinite(Number(state.customFirstPieceWidth))) return invalidLayoutResult("Enter a finite first-piece width.");
    const hasCustom = state.customFirstPieceWidth !== null && state.customFirstPieceWidth !== undefined && state.customFirstPieceWidth > 0;
    let firstPieceWidth = hasCustom ? Number(state.customFirstPieceWidth) : 0;
    if (!Number.isFinite(firstPieceWidth) || firstPieceWidth > Math.min(roomWidth, panelWidth) || Number(state.customFirstPieceWidth) < 0) {
      return invalidLayoutResult("First piece must fit both the product and the area width.");
    }
    let remainingWidth = roomWidth - firstPieceWidth;
    const finalFullCount = Math.floor(remainingWidth / panelWidth);
    const remainder = remainingWidth - (finalFullCount * panelWidth);
    
    const fullPanels = Array.from({ length: Math.max(0, finalFullCount) }, (_, i) => ({ w: panelWidth, type: "full", pid: i }));
    const segs = [];
    
    let cutCount = 0;
    if (hasCustom && firstPieceWidth > 0) {
      segs.push({ w: firstPieceWidth, type: "edge" });
      cutCount = 1;
    }
    segs.push(...fullPanels);
    if (remainder > 0) {
      segs.push({ w: remainder, type: "edge" });
      cutCount = hasCustom ? cutCount + 1 : 1;
    }
    
    const totalToBuy = (hasCustom && firstPieceWidth > 0 ? 1 : 0) + Math.max(0, finalFullCount) + (remainder > 0 ? 1 : 0);
    const layoutLength = firstPieceWidth + (Math.max(0, finalFullCount) * panelWidth) + remainder;
    const roomGap = Math.abs(roomWidth - layoutLength);
    
    return {
      status: "ready", valid: true,
      rows: [{ segs }],
      stats: { full: Math.max(0, finalFullCount), cut: cutCount, total: totalToBuy },
      summaryRows: [
        ...(hasCustom && firstPieceWidth > 0 ? [{ label: "First piece width", value: fmt.decimal(firstPieceWidth), unit: "mm", hi: true, hoverType: "edge" }] : []),
        { label: L.fullPanels,   value: Math.max(0, finalFullCount),  unit: "pcs", hi: true, hoverType: "full" },
        { label: "Last piece width", value: fmt.decimal(Math.max(0, remainder)), unit: "mm", hi: true, hoverType: "edge" },
        { label: L.cutEdge,      value: cutCount.toString(),          unit: "pcs", hoverType: "edge" },
        { label: L.totalToBuy,   value: totalToBuy,   unit: "pcs", hi: true },
        { label: L.layoutLength, value: layoutLength, unit: "mm" },
        { label: L.roomGap,      value: fmt.decimal(roomGap), unit: "mm" }
      ],
      meta: { edgeWidth: remainder, panelWidth, roomWidth, visualization: "strip" }
    };
  }

  const { edgeWidth, finalFullCount } = symEdge(Number(roomWidth), Number(panelWidth));
  const fullPanels = Array.from({ length: Math.max(0, finalFullCount) }, (_, i) => ({ w: panelWidth, type: "full", pid: i }));
  const segs = [{ w: edgeWidth, type: "edge" }, ...fullPanels, { w: edgeWidth, type: "edge" }];
  const totalToBuy = Math.max(0, finalFullCount) + 2;
  const layoutLength = (Math.max(0, finalFullCount) * panelWidth) + (2 * edgeWidth);
  const roomGap = Math.abs(roomWidth - layoutLength);
  
  return {
	status: "ready", valid: true,
	rows: [{ segs }],
	stats: { full: Math.max(0, finalFullCount), cut: 2, total: totalToBuy },
	summaryRows: [
	  { label: L.fullPanels,   value: Math.max(0, finalFullCount),  unit: "pcs", hi: true, hoverType: "full" },
	  { label: L.edgeWidth,    value: fmt.decimal(Math.max(0, edgeWidth)), unit: "mm", hi: true, hoverType: "edge" },
	  { label: L.cutEdge,      value: "2",          unit: "pcs", hoverType: "edge" },
	  { label: L.totalToBuy,   value: totalToBuy,   unit: "pcs", hi: true },
	  { label: L.layoutLength, value: layoutLength, unit: "mm" },
	  { label: L.roomGap,      value: fmt.decimal(roomGap), unit: "mm" }
	],
	meta: { edgeWidth, panelWidth, roomWidth, visualization: "strip" }
  };
}

// Single helper replaces computeS1, computeS2, computeS3
function computeStandard(sh, sysNum, offset, palKey) {
  const { W, H, PPi, PLa, direction, minJ, startOff, patternStart } = sh;
  if (![W, H, PPi, PLa, minJ, startOff, offset].every(n => Number.isFinite(Number(n)))) return invalidLayoutResult("Enter finite dimensions and offsets.");
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const sH = vSym ? W : H;
  if (exceedsLayoutBudget(sW, sH, PPi, PLa)) return cappedLayoutResult();
  const activePatternStart = patternStart || (vSym ? "bottom" : "left");
  const isMirror = vSym ? activePatternStart === "bottom" : activePatternStart === "right";
  const rows = simulate(sW, sH, PLa, PPi, offset, minJ, sysNum, false, startOff, isMirror);
  const stockPlan = buildStockPlan(rows, PPi);
  const stats = { ...makeStats(rows), stockPanels: stockPlan.panelsToBuy };
  const gaps = countSegs(rows, "gap");
  const offcuts = countSegs(rows, "offcut");
  const totalGapWidth = gapWidth(rows);
  const valid = gaps === 0;
  const L = SUMMARY_LABELS.s1s2s3;
  return {
	status: valid ? "ready" : "invalid", valid, rows, stats, stockPlan,
	summaryRows: [
	  { label: L.total,     value: stockPlan.panelsToBuy,                   unit: "pcs", hi: true },
	  { label: L.placed,    value: stats.full + stats.cut + offcuts, unit: "pcs", hi: true },
	  { label: L.full,      value: stats.full,                             unit: "pcs", hoverType: "full" },
	  { label: L.cut,       value: stats.cut,                              unit: "pcs", hoverType: "cut" },
	  { label: L.remainder, value: offcuts,                          unit: "pcs", hoverType: "offcut" },
	  ...(gaps > 0 ? [
	    { label: L.gaps,      value: gaps,                                   unit: "pcs", hoverType: "gap" },
	    { label: L.gapWidth,  value: fmt.decimal(totalGapWidth),             unit: "mm",  hoverType: "gap" },
	  ] : []),
	  { label: valid ? L.status : L.statusInvalid, value: valid ? "Valid" : "Invalid", unit: "", hi: !valid, danger: !valid }
	],
	meta: { width: sW, visualization: "rows", palClasses: PAL_CLASSES[palKey], surfaceW: sh.W, surfaceH: sh.H, simW: sW, simH: sH, PPi: sh.PPi, PLa: sh.PLa, direction: sh.direction }
  };
}

const computeS1 = sh => computeStandard(sh, 1, 0,          "s1");
const computeS2 = sh => computeStandard(sh, 2, sh.offset,  "s2");
const computeS3 = sh => computeStandard(sh, 3, 0,          "s3");

function computeS4(sh) {
  const { W, H, PPi, PLa, direction, minJ, s4Long, patternStart } = sh;
  if (![W, H, PPi, PLa, minJ, s4Long].every(n => Number.isFinite(Number(n)))) return invalidLayoutResult("Enter finite dimensions.");
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0 || s4Long <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const sH = vSym ? W : H;
  if (s4Long > PPi) return invalidLayoutResult("Long piece cannot exceed the stock length.");
  if (exceedsLayoutBudget(sW, sH, s4Long, PLa)) return cappedLayoutResult();
  const activePatternStart = patternStart || (vSym ? "bottom" : "left");
  const isMirror = vSym ? activePatternStart === "bottom" : activePatternStart === "right";
  const rows = simulateS4(sW, sH, PLa, s4Long, minJ, false, isMirror);
  const stockPlan = allocateS4Stock(rows, PPi);
  const stats = { ...makeStats(rows), stockPanels: stockPlan.panelsToBuy };
  const shortPiece = sW - Math.floor(sW / s4Long) * s4Long;
  const nLong = rows.reduce((n, row) => n + row.segs.filter(seg => seg.long).length, 0);
  const nShort = rows.reduce((n, row) => n + row.segs.filter(seg => !seg.long).length, 0);

  const L = SUMMARY_LABELS.s4;
  return {
    status: "ready", valid: true, rows, stats, stockPlan,
    summaryRows: [
      { label: "Long piece",  value: fmt.decimal(s4Long),                                        unit: "mm",  hi: true },
      { label: "Short piece", value: shortPiece > 0 ? fmt.decimal(shortPiece) : "none",          unit: shortPiece > 0 ? "mm" : "", hi: true },
      { label: L.stock,       value: stockPlan.panelsToBuy,                                                    unit: "pcs", hi: true },
      { label: "Long pieces", value: nLong,                                                  unit: "pcs", hoverType: "full" },
      { label: "Short pieces", value: nShort,                                                   unit: "pcs", hoverType: "cut" }
    ],
    meta: { width: sW, visualization: "rows", s4: true, useS4Colors: s4Long !== PPi, surfaceW: sh.W, surfaceH: sh.H, simW: sW, simH: sH, PPi: sh.PPi, PLa: sh.PLa, s4Long, direction: sh.direction }
  };
}

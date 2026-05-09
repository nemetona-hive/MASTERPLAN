const symEdge = (total, step) => {
  if (step <= 0) return { edgeWidth: 0, finalFullCount: 0 };
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

const mkRowHeights = (H, PP, vSym) => {
  if (PP <= 0) return [H];
  if (vSym) {
	const { edgeWidth, finalFullCount } = symEdge(H, PP);
	return [edgeWidth, ...Array(Math.max(0, finalFullCount)).fill(PP), edgeWidth];
  }
  const count = Math.ceil(H / PP);
  if (count <= 0 || !isFinite(count)) return [H];
  return [...Array(count - 1).fill(PP), H - (count - 1) * PP];
};

const simulate = (W, H, PP, PL, offset, minJ, sys, vSym = false, startOff = 0) => {
  if (W <= 0 || H <= 0 || PP <= 0 || PL <= 0) return [];
  // Safety cap: prevent runaway loops with extreme values
  if (W / PL > 2000 || H / PP > 2000) return [];
  const heights = mkRowHeights(H, PP, vSym);
  const startRemainder = startOff > 0 ? Math.max(0, Math.min(startOff, PL)) : 0;
  const rows = [];
  let remainder = startRemainder;
  for (let i = 0; i < heights.length; i++) {
	if (vSym) remainder = startRemainder;
	const off = sys === 1 ? 0 : sys === 2 ? (i % 2 === 1 ? offset * PL : 0) : (i % 3) * (PL / 3);
	const segs = [];
	let x = -off;
	if (remainder > 0) {
	  const vs = Math.max(x, 0);
	  const ve = Math.min(x + remainder, W);
	  if (ve > vs) segs.push({ x: vs, w: ve - vs, type: "offcut" });
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
		segs.push({ x: vs, w: cutW, type, pid: isFull ? pid : undefined });
		if (isFull) pid++;
	  }
	  x += PL;
	}
	const offsetW = W + off;
	const nj = remainder + Math.ceil(Math.max(0, offsetW - remainder) / PL) * PL - offsetW;
	remainder = nj >= minJ && isFinite(nj) && !isNaN(nj) ? nj : 0;
	rows.push({ segs, h: heights[i] });
  }
  return rows;
};

function simulateS4(W, H, PP, PLong, minJ, vSym) {
  if (W <= 0 || H <= 0 || PP <= 0 || PLong <= 0) return [];
  const heights = mkRowHeights(H, PP, vSym);
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

    rows.push({ segs, h });
  }
  return rows;
}

// Single helper replaces nPanels, nCut, nGap, nOffcut
const countSegs = (rows, type) =>
  Array.isArray(rows) ? rows.reduce((a, r) =>
    a + (Array.isArray(r.segs) ? r.segs.filter(s => s.type === type).length : 0)
  , 0) : 0;

const nPanels = rows => countSegs(rows, "full");
const nCut    = rows => countSegs(rows, "cut");
const nGap    = rows => countSegs(rows, "gap");
const nOffcut = rows => countSegs(rows, "offcut");
const sumSegWidth = (rows, type) =>
  Array.isArray(rows) ? rows.reduce((a, r) =>
    a + (Array.isArray(r.segs) ? r.segs.reduce((acc, s) => acc + (s.type === type ? s.w : 0), 0) : 0)
  , 0) : 0;
const gapWidth = rows => sumSegWidth(rows, "gap");
const nTotal = rows => nPanels(rows) + nCut(rows);

function emptyLayoutResult() {
  return { valid: false, rows: [], stats: { full: 0, cut: 0, total: 0 }, summaryRows: [], meta: {} };
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
  const { roomWidth, panelWidth, oneFullEdge } = state;
  if (roomWidth <= 0 || panelWidth <= 0) return emptyLayoutResult();
  
  const L = SUMMARY_LABELS.s0;
  
  if (oneFullEdge) {
    const hasCustom = state.customFirstPieceWidth !== null && state.customFirstPieceWidth !== undefined && state.customFirstPieceWidth > 0;
    let firstPieceWidth = hasCustom ? state.customFirstPieceWidth : 0;
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
      valid: true,
      rows: [{ segs }],
      stats: { full: Math.max(0, finalFullCount), cut: cutCount, total: totalToBuy },
      summaryRows: [
        ...(hasCustom && firstPieceWidth > 0 ? [{ label: "First piece width", value: fmt.decimal(firstPieceWidth), unit: "mm", hi: true, hoverType: "edge" }] : []),
        { label: L.fullPanels,   value: Math.max(0, finalFullCount),  unit: "pcs", hi: true, hoverType: "full" },
        { label: hasCustom ? "Last piece width" : "Last piece width", value: fmt.decimal(Math.max(0, remainder)), unit: "mm", hi: true, hoverType: "edge" },
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
	valid: true,
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
  const { W, H, PPi, PLa, direction, minJ, startOff } = sh;
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const rows = simulate(sW, vSym ? W : H, PLa, PPi, offset, minJ, sysNum, vSym, startOff);
  const stats = makeStats(rows);
  const gaps = nGap(rows);
  const totalGapWidth = gapWidth(rows);
  const valid = gaps === 0;
  const L = SUMMARY_LABELS.s1s2s3;
  return {
	valid, rows, stats,
	summaryRows: [
	  { label: L.total,     value: stats.total,                            unit: "pcs", hi: true },
	  { label: L.placed,    value: stats.full + stats.cut + nOffcut(rows), unit: "pcs", hi: true },
	  { label: L.full,      value: stats.full,                             unit: "pcs", hoverType: "full" },
	  { label: L.cut,       value: stats.cut,                              unit: "pcs", hoverType: "cut" },
	  { label: L.remainder, value: nOffcut(rows),                          unit: "pcs", hoverType: "offcut" },
	  ...(gaps > 0 ? [
	    { label: L.gaps,      value: gaps,                                   unit: "pcs", hoverType: "gap" },
	    { label: L.gapWidth,  value: fmt.decimal(totalGapWidth),             unit: "mm",  hoverType: "gap" },
	  ] : []),
	  { label: valid ? L.status : "Uncovered gaps \u2014 increase min remainder or adjust panel size.", value: valid ? "Valid" : "Invalid", unit: "", hi: !valid, danger: !valid }
	],
	meta: { width: sW, visualization: "rows", palClasses: PAL_CLASSES[palKey], surfaceW: sh.W, surfaceH: sh.H, PPi: sh.PPi, PLa: sh.PLa, direction: sh.direction }
  };
}

const computeS1 = sh => computeStandard(sh, 1, 0,          "s1");
const computeS2 = sh => computeStandard(sh, 2, sh.offset,  "s2");
const computeS3 = sh => computeStandard(sh, 3, 0,          "s3");

function computeS4(sh) {
  const { W, H, PPi, PLa, direction, minJ, s4Long } = sh;
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0 || s4Long <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const sH = vSym ? W : H;
  const rows = simulateS4(sW, sH, PLa, s4Long, minJ, vSym);
  const stats = makeStats(rows);
  const shortPiece = sW - Math.floor(sW / s4Long) * s4Long;
  const fullCount  = Math.floor(sW / s4Long);

  // Stock pieces: each full long comes from one stock piece (PPi)
  // Short pieces are cut from the same stock piece as the last long in each row
  const nLong = rows.reduce((a, r) => a + r.segs.filter(s => s.type === "full").length, 0);
  const nShort = rows.reduce((a, r) => a + r.segs.filter(s => s.type === "cut").length, 0);
  const perStock = Math.max(1, Math.floor(PPi / s4Long));
  const stockPcs = Math.ceil(nLong / perStock) + (shortPiece > 0 ? Math.ceil(nShort / Math.max(1, Math.floor(PPi / shortPiece))) : 0);

  const L = SUMMARY_LABELS.s4;
  return {
    valid: true, rows, stats,
    summaryRows: [
      { label: "Long piece",  value: fmt.decimal(s4Long),                                        unit: "mm",  hi: true },
      { label: "Short piece", value: shortPiece > 0 ? fmt.decimal(shortPiece) : "none",          unit: shortPiece > 0 ? "mm" : "", hi: true },
      { label: L.stock,       value: stockPcs,                                                    unit: "pcs", hi: true },
      { label: L.full,        value: stats.full,                                                  unit: "pcs", hoverType: "full" },
      { label: L.cut,         value: stats.cut,                                                   unit: "pcs", hoverType: "cut" }
    ],
    meta: { width: sW, visualization: "rows", s4: true, useS4Colors: s4Long !== PPi, surfaceW: sh.W, surfaceH: sh.H, PPi: sh.PPi, PLa: sh.PLa, s4Long, direction: sh.direction }
  };
}

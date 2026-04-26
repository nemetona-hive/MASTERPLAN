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
  return Array(count).fill(PP);
};

const simulate = (W, H, PP, PL, offset, minJ, sys, vSym = false, startOff = 0) => {
  if (W <= 0 || H <= 0 || PP <= 0 || PL <= 0) return [];
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
		segs.push({ x: vs, w: ve - vs, type: isFull ? "full" : "cut", pid: isFull ? pid : undefined });
		if (isFull) pid++;
	  }
	  x += PL;
	}
	const offsetW = W + off;
	const neededFromPlanks = Math.max(0, offsetW - remainder);
	const nj = offsetW <= remainder ? remainder - offsetW : (remainder + Math.ceil(neededFromPlanks / PL) * PL) - offsetW;
	remainder = nj >= minJ && isFinite(nj) && !isNaN(nj) ? nj : 0;
	rows.push({ segs, h: heights[i] });
  }
  return rows;
};

function simulateS4(W, H, PP, PLong, PShort, minJ, vSym) {
  if (W <= 0 || H <= 0 || PP <= 0 || PLong <= 0 || PShort <= 0) return [];
  return mkRowHeights(H, PP, vSym).map(function(h, i) {
	var startsLong = i % 2 === 0;
	var segs = [];
	var x = 0, pid = 0, phase = 0;
	while (x < W) {
	  var isLong = startsLong ? phase % 2 === 0 : phase % 2 === 1;
	  var PL = isLong ? PLong : PShort;
	  if (x + PL <= W) {
		segs.push({ x: x, w: PL, type: "full", pid: pid, "long": isLong });
		x += PL; pid++; phase++;
	  } else {
		var remainder = W - x;
		if (remainder > 0) segs.push({ x: x, w: remainder, type: remainder >= minJ ? "cut" : "gap", pid: pid, "long": isLong });
		break;
	  }
	}
	return { segs: segs, h: h, "long": startsLong };
  });
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
const gapWidth = rows =>
  Array.isArray(rows) ? rows.reduce((a, r) =>
    a + (Array.isArray(r.segs) ? r.segs.reduce((acc, s) => acc + (s.type === "gap" ? s.w : 0), 0) : 0)
  , 0) : 0;
const nTotal = rows => nPanels(rows) + nCut(rows);

function emptyLayoutResult() {
  return { valid: false, rows: [], stats: { full: 0, cut: 0, total: 0 }, summaryRows: [], meta: {} };
}
function makeStats(rows) {
  return { full: nPanels(rows), cut: nCut(rows), total: Math.ceil(nTotal(rows)) };
}

function computeS0(state) {
  const { roomWidth, panelWidth } = state;
  if (roomWidth <= 0 || panelWidth <= 0) return emptyLayoutResult();
  const { edgeWidth, finalFullCount } = symEdge(Number(roomWidth), Number(panelWidth));
  const fullPanels = Array.from({ length: Math.max(0, finalFullCount) }, (_, i) => ({ w: panelWidth, type: "full", pid: i }));
  const segs = [{ w: edgeWidth, type: "edge" }, ...fullPanels, { w: edgeWidth, type: "edge" }];
  const totalToBuy = Math.max(0, finalFullCount) + 2;
  const layoutLength = (Math.max(0, finalFullCount) * panelWidth) + (2 * edgeWidth);
  const roomGap = Math.abs(roomWidth - layoutLength);
  const L = SUMMARY_LABELS.s0;
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
  const L = SUMMARY_LABELS.s1s2s3;
  return {
	valid: true, rows, stats,
	summaryRows: [
	  { label: L.full,      value: stats.full,    unit: "pcs", hi: true, hoverType: "full" },
	  { label: L.cut,       value: stats.cut,     unit: "pcs", hoverType: "cut" },
	  { label: L.remainder, value: nOffcut(rows), unit: "pcs", hoverType: "offcut" },
	  { label: L.total,     value: stats.total,   unit: "pcs", hi: true }
	],
	meta: { width: sW, visualization: "rows", palClasses: PAL_CLASSES[palKey] }
  };
}

const computeS1 = sh => computeStandard(sh, 1, 0,          "s1");
const computeS2 = sh => computeStandard(sh, 2, sh.offset,  "s2");
const computeS3 = sh => computeStandard(sh, 3, 0,          "s3");

function computeS4(sh) {
  const { W, H, PPi, PLa, direction, minJ, s4Long, s4Short } = sh;
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0 || s4Long <= 0 || s4Short <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const rows = simulateS4(sW, vSym ? W : H, PLa, s4Long, s4Short, minJ, vSym);
  const stats = makeStats(rows);
  const gaps = nGap(rows);
  const totalGapWidth = gapWidth(rows);
  const valid = gaps === 0;

  // Count long and short pieces separately (full + cut each consume one panel of that size).
  // Multiple panels can come from one stock piece (PPi), so divide accordingly.
  const countByLong = isLong => rows.reduce((a, r) =>
	a + r.segs.filter(s => (s.type === "full" || s.type === "cut") && s.long === isLong).length, 0);
  const nL        = countByLong(true);
  const nS        = countByLong(false);
  const perStockL = Math.max(1, Math.floor(PPi / s4Long));
  const perStockS = Math.max(1, Math.floor(PPi / s4Short));
  const stockPcs  = Math.ceil(nL / perStockL) + Math.ceil(nS / perStockS);

  const L = SUMMARY_LABELS.s4;
  return {
	valid, rows, stats,
	summaryRows: [
	  { label: L.stock,    value: stockPcs,                   unit: "pcs", hi: true },
	  { label: L.full,     value: stats.full,                 unit: "pcs", hi: true, hoverType: "full" },
	  { label: L.cut,      value: stats.cut,                  unit: "pcs", hoverType: "cut" },
	  { label: L.total,    value: stats.total,                unit: "pcs", hi: true },
	  { label: L.gaps,     value: gaps,                       unit: "pcs", hoverType: "gap" },
	  { label: L.gapWidth, value: fmt.decimal(totalGapWidth), unit: "mm",  hoverType: "gap" },
	  { label: L.status,   value: valid ? "Valid" : "Invalid", unit: valid ? "" : L.statusInvalid, hi: !valid }
	],
	meta: { width: sW, visualization: "rows", s4: true }
  };
}

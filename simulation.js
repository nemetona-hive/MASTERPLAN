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

function simulateS4Jointed(W, rowDefs, PLong, horizontalGap, mirror = false) {
  const baseShort = W - Math.floor(W / PLong) * PLong;
  return rowDefs.map((rowDef, i) => {
    const segs = [];
    let x = 0;
    let first = true;
    const startsWithShort = i % 2 === 1 && baseShort > 0;
    while (x < W - 1e-7) {
      const preferred = first && startsWithShort ? baseShort : PLong;
      const width = Math.min(preferred, W - x);
      const long = width >= PLong - 1e-7;
      segs.push({ x, w: width, type: long ? "full" : "cut", long });
      x += width;
      first = false;
      if (W - x <= horizontalGap + 1e-7) break;
      if (horizontalGap > 0) {
        segs.push({ x, w: horizontalGap, type: "joint" });
        x += horizontalGap;
      }
    }
    if (mirror) {
      segs.forEach(s => { s.x = W - s.x - s.w; });
      segs.reverse();
    }
    return { segs, h: rowDef.h, jointAfter: rowDef.jointAfter };
  });
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

const jointWidth = rows => sumSegWidth(rows, "joint");

function effectiveJointGaps(state) {
  const base = state.gap === "" || state.gap == null ? 0 : Number(state.gap);
  // Directional values only apply when their mode is selected. The fallback
  // keeps pre-mode saved documents working as they did before this switch.
  const separate = state.separateGaps ?? (state.horizontalGap !== "" || state.verticalGap !== "");
  const horizontal = separate && state.horizontalGap !== "" && state.horizontalGap != null ? Number(state.horizontalGap) : base;
  const vertical = separate && state.verticalGap !== "" && state.verticalGap != null ? Number(state.verticalGap) : base;
  return { horizontal, vertical };
}

function jointedRowHeights(total, pitch, verticalGap) {
  const rows = [];
  let remaining = total;
  while (remaining > 1e-7) {
    const h = Math.min(pitch, remaining);
    rows.push({ h, jointAfter: 0 });
    remaining -= h;
    if (remaining > verticalGap + 1e-7) {
      rows[rows.length - 1].jointAfter = verticalGap;
      remaining -= verticalGap;
    } else break;
  }
  return rows;
}

function simulateJointed(W, rowDefs, PL, offset, minJ, sys, horizontalGap, startOff = 0, mirror = false) {
  const rows = [];
  let carriedRemainder = startOff > 0 ? Math.min(startOff, PL) : 0;
  let carriedSourceId = carriedRemainder > 0 ? getSourceId(0) : null;
  let cutIndex = carriedRemainder > 0 ? 1 : 0;
  for (let i = 0; i < rowDefs.length; i++) {
    // Straight layout's defining behaviour is that the final cut of a row
    // supplies the next row's opening offcut. Gaps change placement distance,
    // never that material relationship.
    if (sys === 1) {
      const segs = [];
      let x = 0;
      let pid = 0;
      let nextRemainder = 0;
      let nextSourceId = null;
      if (carriedRemainder > 0) {
        const width = Math.min(carriedRemainder, W);
        segs.push({ x, w: width, type: "offcut", sourceId: carriedSourceId });
        x += width;
      }
      while (x < W - 1e-7) {
        if (x > 0 && horizontalGap > 0) {
          if (W - x <= horizontalGap + 1e-7) break;
          segs.push({ x, w: horizontalGap, type: "joint" });
          x += horizontalGap;
        }
        const width = Math.min(PL, W - x);
        if (width <= 1e-7) break;
        const isFull = width >= PL - 1e-7;
        const type = isFull ? "full" : (width >= minJ ? "cut" : "gap");
        const sourceId = type === "cut" ? getSourceId(cutIndex++) : undefined;
        segs.push({ x, w: width, type, pid: isFull ? pid++ : undefined, sourceId });
        x += width;
        if (type === "cut") {
          nextRemainder = PL - width;
          nextSourceId = sourceId;
        }
        if (!isFull) break;
      }
      carriedRemainder = nextRemainder;
      carriedSourceId = nextSourceId;
      if (mirror) {
        segs.forEach(s => { s.x = W - s.x - s.w; });
        segs.reverse();
      }
      rows.push({ segs, h: rowDefs[i].h, jointAfter: rowDefs[i].jointAfter });
      continue;
    }
    // Shifted and stepped rows retain the same carry chain, but their offset
    // may trim the carried offcut at the layout edge before the next stock
    // panel begins. Horizontal joints are added only between visible pieces.
    if (sys === 2 || sys === 3) {
      const off = sys === 2 ? (i % 2 === 1 ? offset * PL : 0) : (i % 3) * (PL / 3);
      const segs = [];
      let x = 0;
      let pid = 0;
      let nextRemainder = 0;
      let nextSourceId = null;
      let firstStock = true;
      const carryVisible = Math.max(0, carriedRemainder - off);
      const consumedOffset = Math.max(0, off - carriedRemainder);

      if (carryVisible > 1e-7) {
        const width = Math.min(carryVisible, W);
        segs.push({ x, w: width, type: "offcut", sourceId: carriedSourceId });
        x += width;
      }
      while (x < W - 1e-7) {
        if (x > 0 && horizontalGap > 0) {
          if (W - x <= horizontalGap + 1e-7) break;
          segs.push({ x, w: horizontalGap, type: "joint" });
          x += horizontalGap;
        }
        const skipped = firstStock ? consumedOffset : 0;
        const availableStock = PL - skipped;
        const width = Math.min(availableStock, W - x);
        if (width <= 1e-7) break;
        const isFull = skipped === 0 && width >= PL - 1e-7;
        const type = isFull ? "full" : (width >= minJ ? "cut" : "gap");
        const sourceId = type === "cut" ? getSourceId(cutIndex++) : undefined;
        segs.push({ x, w: width, type, pid: isFull ? pid++ : undefined, sourceId });
        x += width;
        if (type === "cut" && width < availableStock - 1e-7) {
          nextRemainder = availableStock - width;
          nextSourceId = sourceId;
        }
        firstStock = false;
        if (!isFull && width < availableStock - 1e-7) break;
      }
      carriedRemainder = nextRemainder;
      carriedSourceId = nextSourceId;
      if (mirror) {
        segs.forEach(s => { s.x = W - s.x - s.w; });
        segs.reverse();
      }
      rows.push({ segs, h: rowDefs[i].h, jointAfter: rowDefs[i].jointAfter });
      continue;
    }
    const off = sys === 1 ? 0 : sys === 2 ? (i % 2 === 1 ? offset * PL : 0) : (i % 3) * (PL / 3);
    const segs = [];
    let x = 0;
    let pid = 0;
    let firstWidth = i === 0 && startOff > 0 ? startOff : (off > 0 ? PL - off : PL);
    let first = true;
    while (x < W - 1e-7) {
      const width = Math.min(first ? firstWidth : PL, W - x);
      const isFull = !first && width >= PL - 1e-7 || first && off === 0 && startOff <= 0 && width >= PL - 1e-7;
      const type = isFull ? "full" : (width >= minJ ? "cut" : "gap");
      segs.push({ x, w: width, type, pid: isFull ? pid++ : undefined });
      x += width;
      first = false;
      if (W - x <= horizontalGap + 1e-7) break;
      if (horizontalGap > 0) {
        segs.push({ x, w: horizontalGap, type: "joint" });
        x += horizontalGap;
      }
    }
    if (mirror) {
      segs.forEach(s => { s.x = W - s.x - s.w; });
      segs.reverse();
    }
    rows.push({ segs, h: rowDefs[i].h, jointAfter: rowDefs[i].jointAfter });
  }
  return rows;
}

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
    if (seg.type === "gap" || seg.type === "joint") return;
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
  const pending = rows.flatMap(row => row.segs).filter(seg => seg.type !== "gap" && seg.type !== "joint" && seg.w < stockLength - 1e-7)
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
  // Older saved sessions have no gap value; they retain the original flush fit.
  const gap = state.gap === "" || state.gap == null ? 0 : Number(state.gap);
  if (!Number.isFinite(gap) || gap < 0) return invalidLayoutResult("Enter a non-negative gap.");
  
  if (exceedsSimCap(roomWidth, panelWidth)) return cappedLayoutResult();
  const L = SUMMARY_LABELS.s0;
  
  if (oneFullEdge) {
    if (state.customFirstPieceWidth != null && !Number.isFinite(Number(state.customFirstPieceWidth))) return invalidLayoutResult("Enter a finite first-piece width.");
    const hasCustom = state.customFirstPieceWidth !== null && state.customFirstPieceWidth !== undefined && state.customFirstPieceWidth > 0;
    let firstPieceWidth = hasCustom ? Number(state.customFirstPieceWidth) : 0;
    if (!Number.isFinite(firstPieceWidth) || firstPieceWidth > Math.min(roomWidth, panelWidth) || Number(state.customFirstPieceWidth) < 0) {
      return invalidLayoutResult("First piece must fit both the product and the area width.");
    }
    const segs = [];
    let remainingWidth = roomWidth;
    let cutCount = 0;

    if (hasCustom && firstPieceWidth > 0) {
      segs.push({ w: firstPieceWidth, type: "edge" });
      remainingWidth -= firstPieceWidth;
      cutCount = 1;
    } else if (remainingWidth >= panelWidth) {
      // Asymmetric always starts with an uncut full panel when it can.
      segs.push({ w: panelWidth, type: "full", pid: 0 });
      remainingWidth -= panelWidth;
    } else {
      segs.push({ w: remainingWidth, type: "edge" });
      remainingWidth = 0;
      cutCount = 1;
    }

    // Every piece after the first needs one joint before it. Keep adding full
    // panels while the pair fits; a trailing space no wider than a joint stays
    // as room gap rather than manufacturing an impossible last cut.
    while (remainingWidth >= gap + panelWidth) {
      segs.push({ w: panelWidth, type: "full", pid: segs.filter(seg => seg.type === "full").length });
      remainingWidth -= gap + panelWidth;
    }
    if (remainingWidth > gap) {
      const remainder = remainingWidth - gap;
      segs.push({ w: remainder, type: "edge" });
      remainingWidth = 0;
      cutCount += 1;
    }

    const finalFullCount = segs.filter(seg => seg.type === "full").length;
    const remainder = segs.at(-1)?.type === "edge" && segs.length > (hasCustom ? 1 : 0) ? segs.at(-1).w : 0;
    const totalToBuy = segs.length;
    const gapCount = Math.max(0, totalToBuy - 1);
    const gapTotal = gapCount * gap;
    const layoutLength = segs.reduce((total, seg) => total + seg.w, 0) + gapTotal;
    const roomGap = Math.max(0, remainingWidth);
    
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
        { label: L.gap,           value: fmt.decimal(gap), unit: "mm" },
        { label: L.gapTotal,      value: fmt.decimal(gapTotal), unit: "mm" },
        { label: L.layoutLength, value: layoutLength, unit: "mm" },
        { label: L.roomGap,      value: fmt.decimal(roomGap), unit: "mm" }
      ],
      // A custom opening cut and a closing remainder are independent pieces.
      // Keep both widths in the model so the strip legend cannot describe a
      // real first piece with the (possibly zero) final remainder.
      meta: {
        edgeWidth: remainder,
        firstPieceWidth: hasCustom ? firstPieceWidth : 0,
        panelWidth,
        roomWidth,
        gap,
        gapCount,
        visualization: "strip",
        oneFullEdge: true
      }
    };
  }

  let edgeWidth = 0;
  let finalFullCount = 0;
  let foundFit = false;
  for (let fullCount = Math.floor(roomWidth / panelWidth); fullCount >= 0; fullCount--) {
    const pieceSpan = roomWidth - (fullCount + 1) * gap;
    const candidate = symEdge(pieceSpan, panelWidth);
    if (pieceSpan > 0 && candidate.finalFullCount === fullCount) {
      edgeWidth = candidate.edgeWidth;
      finalFullCount = candidate.finalFullCount;
      foundFit = true;
      break;
    }
  }
  if (!foundFit) return invalidLayoutResult("Gap is too large for the area and selected pieces.");
  const fullPanels = Array.from({ length: Math.max(0, finalFullCount) }, (_, i) => ({ w: panelWidth, type: "full", pid: i }));
  const segs = [{ w: edgeWidth, type: "edge" }, ...fullPanels, { w: edgeWidth, type: "edge" }];
  const totalToBuy = Math.max(0, finalFullCount) + 2;
  const gapCount = Math.max(0, totalToBuy - 1);
  const gapTotal = gapCount * gap;
  const layoutLength = (Math.max(0, finalFullCount) * panelWidth) + (2 * edgeWidth) + gapTotal;
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
	  { label: L.gap,          value: fmt.decimal(gap), unit: "mm" },
	  { label: L.gapTotal,     value: fmt.decimal(gapTotal), unit: "mm" },
	  { label: L.layoutLength, value: layoutLength, unit: "mm" },
	  { label: L.roomGap,      value: fmt.decimal(roomGap), unit: "mm" }
	],
	meta: { edgeWidth, panelWidth, roomWidth, gap, gapCount, visualization: "strip" }
  };
}

// Single helper replaces computeS1, computeS2, computeS3
function computeStandard(sh, sysNum, offset, palKey) {
  const { W, H, PPi, PLa, direction, minJ, startOff, patternStart } = sh;
  const joints = effectiveJointGaps(sh);
  if (![W, H, PPi, PLa, minJ, startOff, offset, joints.horizontal, joints.vertical].every(n => Number.isFinite(Number(n)))) return invalidLayoutResult("Enter finite dimensions, offsets and gaps.");
  if (joints.horizontal < 0 || joints.vertical < 0) return invalidLayoutResult("Enter non-negative gaps.");
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const sH = vSym ? W : H;
  if (exceedsLayoutBudget(sW, sH, PPi, PLa)) return cappedLayoutResult();
  const activePatternStart = patternStart || (vSym ? "bottom" : "left");
  const isMirror = vSym ? activePatternStart === "bottom" : activePatternStart === "right";
  const hasJoints = joints.horizontal > 0 || joints.vertical > 0;
  const rows = hasJoints
    ? simulateJointed(sW, jointedRowHeights(sH, PLa, joints.vertical), PPi, offset, minJ, sysNum, joints.horizontal, startOff, isMirror)
    : simulate(sW, sH, PLa, PPi, offset, minJ, sysNum, false, startOff, isMirror);
  const stockPlan = buildStockPlan(rows, PPi);
  const stats = { ...makeStats(rows), stockPanels: stockPlan.panelsToBuy };
  const gaps = countSegs(rows, "gap");
  const offcuts = countSegs(rows, "offcut");
  const totalGapWidth = gapWidth(rows);
  const horizontalJointTotal = jointWidth(rows);
  const verticalJointCount = rows.filter(row => row.jointAfter > 0).length;
  const verticalJointTotal = rows.reduce((total, row) => total + (row.jointAfter || 0), 0);
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
	  ...(hasJoints ? [
	    { label: "Horizontal joint gap", value: fmt.decimal(joints.horizontal), unit: "mm", hoverType: "joint" },
	    { label: "Horizontal joints total", value: fmt.decimal(horizontalJointTotal), unit: "mm", hoverType: "joint" },
	    { label: "Vertical joint gap", value: fmt.decimal(joints.vertical), unit: "mm", hoverType: "joint" },
	    { label: "Vertical joints total", value: fmt.decimal(verticalJointTotal), unit: "mm", hoverType: "joint" }
	  ] : []),
	  { label: valid ? L.status : L.statusInvalid, value: valid ? "Valid" : "Invalid", unit: "", hi: !valid, danger: !valid }
	],
	meta: { width: sW, visualization: "rows", palClasses: PAL_CLASSES[palKey], surfaceW: sh.W, surfaceH: sh.H, simW: sW, simH: sH, PPi: sh.PPi, PLa: sh.PLa, direction: sh.direction, hasJoints, horizontalGap: joints.horizontal, verticalGap: joints.vertical, verticalJointCount }
  };
}

const computeS1 = sh => computeStandard(sh, 1, 0,          "s1");
const computeS2 = sh => computeStandard(sh, 2, sh.offset,  "s2");
const computeS3 = sh => computeStandard(sh, 3, 0,          "s3");

function computeS4(sh) {
  const { W, H, PPi, PLa, direction, minJ, s4Long, patternStart } = sh;
  const joints = effectiveJointGaps(sh);
  if (![W, H, PPi, PLa, minJ, s4Long, joints.horizontal, joints.vertical].every(n => Number.isFinite(Number(n)))) return invalidLayoutResult("Enter finite dimensions and gaps.");
  if (joints.horizontal < 0 || joints.vertical < 0) return invalidLayoutResult("Enter non-negative gaps.");
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0 || s4Long <= 0) return emptyLayoutResult();
  const vSym = direction === "V";
  const sW = vSym ? H : W;
  const sH = vSym ? W : H;
  if (s4Long > PPi) return invalidLayoutResult("Long piece cannot exceed the stock length.");
  if (exceedsLayoutBudget(sW, sH, s4Long, PLa)) return cappedLayoutResult();
  const activePatternStart = patternStart || (vSym ? "bottom" : "left");
  const isMirror = vSym ? activePatternStart === "bottom" : activePatternStart === "right";
  const hasJoints = joints.horizontal > 0 || joints.vertical > 0;
  const rows = hasJoints
    ? simulateS4Jointed(sW, jointedRowHeights(sH, PLa, joints.vertical), s4Long, joints.horizontal, isMirror)
    : simulateS4(sW, sH, PLa, s4Long, minJ, false, isMirror);
  const stockPlan = allocateS4Stock(rows, PPi);
  const stats = { ...makeStats(rows), stockPanels: stockPlan.panelsToBuy };
  const shortPiece = sW - Math.floor(sW / s4Long) * s4Long;
  const nLong = rows.reduce((n, row) => n + row.segs.filter(seg => seg.long).length, 0);
  const nShort = rows.reduce((n, row) => n + row.segs.filter(seg => seg.type !== "joint" && !seg.long).length, 0);
  const horizontalJointTotal = jointWidth(rows);
  const verticalJointTotal = rows.reduce((total, row) => total + (row.jointAfter || 0), 0);

  const L = SUMMARY_LABELS.s4;
  return {
    status: "ready", valid: true, rows, stats, stockPlan,
    summaryRows: [
      { label: "Long piece",  value: fmt.decimal(s4Long),                                        unit: "mm",  hi: true },
      { label: "Short piece", value: shortPiece > 0 ? fmt.decimal(shortPiece) : "none",          unit: shortPiece > 0 ? "mm" : "", hi: true },
      { label: L.stock,       value: stockPlan.panelsToBuy,                                                    unit: "pcs", hi: true },
      { label: "Long pieces", value: nLong,                                                  unit: "pcs", hoverType: "full" },
      { label: "Short pieces", value: nShort,                                                   unit: "pcs", hoverType: "cut" },
      ...(hasJoints ? [
        { label: "Horizontal joint gap", value: fmt.decimal(joints.horizontal), unit: "mm", hoverType: "joint" },
        { label: "Horizontal joints total", value: fmt.decimal(horizontalJointTotal), unit: "mm", hoverType: "joint" },
        { label: "Vertical joint gap", value: fmt.decimal(joints.vertical), unit: "mm", hoverType: "joint" },
        { label: "Vertical joints total", value: fmt.decimal(verticalJointTotal), unit: "mm", hoverType: "joint" }
      ] : [])
    ],
    meta: { width: sW, visualization: "rows", s4: true, useS4Colors: s4Long !== PPi, surfaceW: sh.W, surfaceH: sh.H, simW: sW, simH: sH, PPi: sh.PPi, PLa: sh.PLa, s4Long, direction: sh.direction, hasJoints, horizontalGap: joints.horizontal, verticalGap: joints.vertical }
  };
}

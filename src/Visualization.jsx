import { React } from "./react-globals.js";
import { Icon, linkedHighlightProps, Row, Stack } from "./shared.jsx";

export function PanelSummary({ rows, hoveredType, setHoveredType, grouped = false, groupTitles = ["Material", "Placement"] }) {
  const renderRows = summaryRows => summaryRows.map((row, i) => (
    <Row key={i} label={row.label} value={row.value} unit={row.unit} hi={row.hi} danger={row.danger}
      hoverType={row.hoverType} hoveredType={hoveredType} setHoveredType={setHoveredType} />
  ));

  if (!grouped || rows.length < 3) return <>{renderRows(rows)}</>;

  const statusIndex = rows.findIndex(row => row.unit === "" && (row.value === "Valid" || row.value === "Invalid"));
  const statusRow = statusIndex >= 0 ? rows[statusIndex] : null;
  const metricRows = statusRow ? rows.filter((_, i) => i !== statusIndex) : rows;
  const materialRows = metricRows.slice(0, 2);
  const placementRows = metricRows.slice(2);

  return (
    <div className="layout-summary">
      <section className="layout-summary-group layout-summary-group--material" aria-label="Material summary">
        <h3 className="layout-summary-title">{groupTitles[0]}</h3>
        {renderRows(materialRows)}
      </section>
      {placementRows.length > 0 && (
        <section className="layout-summary-group" aria-label="Placement summary">
          <h3 className="layout-summary-title">{groupTitles[1]}</h3>
          {renderRows(placementRows)}
        </section>
      )}
      {statusRow && <div className="layout-summary-status">{renderRows([statusRow])}</div>}
    </div>
  );
}

export function LayoutEmptyState({ message, steps, visual = "mosaic" }) {
  return (
    <section className="layout-empty-state" aria-labelledby="layout-empty-title">
      <div className="layout-empty-wireframe" aria-hidden="true">
        {visual === "axial" ? (
          <svg className="layout-empty-graphic layout-empty-axial" viewBox="0 0 700 420" focusable="false">
            <defs>
              <linearGradient id="layout-empty-axial-a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="layout-empty-stop-a-top" />
                <stop offset="0.14" className="layout-empty-stop-a-mid" />
                <stop offset="1" className="layout-empty-stop-bottom" />
              </linearGradient>
              <linearGradient id="layout-empty-axial-b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="layout-empty-stop-b-top" />
                <stop offset="0.16" className="layout-empty-stop-b-mid" />
                <stop offset="1" className="layout-empty-stop-bottom" />
              </linearGradient>
            </defs>

            <g>
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="0" y="0" width="80" height="259.56" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="0" y="259.56" width="80" height="160.44" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="80" y="0" width="108" height="160.44" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="80" y="160.44" width="108" height="259.56" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="188" y="0" width="108" height="320.88" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="188" y="320.88" width="108" height="99.12" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="296" y="0" width="108" height="210" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="296" y="210" width="108" height="210" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="404" y="0" width="108" height="320.88" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="404" y="320.88" width="108" height="99.12" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="512" y="0" width="108" height="160.44" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="512" y="160.44" width="108" height="259.56" />
              <rect className="layout-empty-tile layout-empty-axial-tile-a" x="620" y="0" width="80" height="259.56" />
              <rect className="layout-empty-tile layout-empty-axial-tile-b" x="620" y="259.56" width="80" height="160.44" />
            </g>
            <rect className="layout-empty-mosaic-outline" x="1" y="1" width="698" height="418" />
            <path className="layout-empty-mosaic-highlight" d="M2 2H698" />
          </svg>
        ) : (
        <svg className="layout-empty-graphic layout-empty-mosaic" viewBox="0 0 2720 2720" focusable="false">
          <defs>
            <linearGradient id="layout-empty-tile-a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="layout-empty-stop-a-top" />
              <stop offset="0.14" className="layout-empty-stop-a-mid" />
              <stop offset="1" className="layout-empty-stop-bottom" />
            </linearGradient>
            <linearGradient id="layout-empty-tile-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="layout-empty-stop-b-top" />
              <stop offset="0.16" className="layout-empty-stop-b-mid" />
              <stop offset="1" className="layout-empty-stop-bottom" />
            </linearGradient>
          </defs>

          <g>
            <rect className="layout-empty-tile layout-empty-tile-a is-lifted" x="0" y="0" width="848" height="480" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="848" y="0" width="600" height="480" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="0" y="480" width="480" height="680" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="0" y="1160" width="480" height="960" />
            <rect className="layout-empty-tile layout-empty-tile-a is-lifted" x="480" y="480" width="968" height="980" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="480" y="1460" width="560" height="660" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="0" y="2120" width="240" height="600" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="240" y="2120" width="800" height="600" />

            <rect className="layout-empty-tile layout-empty-tile-b" x="1040" y="1460" width="1008" height="1020" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="1040" y="2480" width="1008" height="240" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="1448" y="0" width="912" height="800" />
            <rect className="layout-empty-tile layout-empty-tile-b is-lifted" x="2360" y="0" width="360" height="800" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="1448" y="800" width="600" height="660" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="2048" y="800" width="672" height="1160" />
            <rect className="layout-empty-tile layout-empty-tile-b" x="2048" y="1960" width="672" height="520" />
            <rect className="layout-empty-tile layout-empty-tile-a" x="2048" y="2480" width="672" height="240" />
          </g>
          <rect className="layout-empty-mosaic-outline" x="1" y="1" width="2718" height="2718" />
          <path className="layout-empty-mosaic-highlight" d="M2 2H2718" />
        </svg>
        )}
      </div>
      <div className="layout-empty-copy">
        <h3 id="layout-empty-title">Build your layout preview</h3>
        <p role="status" aria-live="polite">{message}</p>
        <ol className="layout-empty-steps">
          {steps.map((step, index) => (
            <li key={step.label} className={step.complete ? "is-complete" : ""}>
              <span aria-hidden="true">{step.complete ? "✓" : index + 1}</span>
              {step.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}



/* A piece's number on screen, once the drawing's scale is measured; a door
   or window's name (D1, W1) the size of a row label. */
const PIECE_LABEL_PX = 12;
const OPENING_LABEL_PX = 15;
/* Capital height of the row-label face, as a share of its size. */
const CAP_HEIGHT = 0.72;

function buildLayoutSvgRects(result, orderedRows, rowStart) {
  const { surfaceW, surfaceH, simW, simH, direction, s4, useS4Colors, palClasses, PPi, PLa, hasJoints, exactRows } = result.meta;
  const isV = direction === "V";
  const stdRowH = isV ? PPi : PLa;
  // Use simulation dimensions for canvas sizing (swapped in V mode)
  const canvasW = simW || surfaceW;
  const canvasH = simH || surfaceH;

  let visualCursor = 0;
  const rects = [];
  const rowRects = [];

  orderedRows.forEach(({ row, idx }) => {
    const rowSize = Number.isFinite(row.h) && row.h > 0 ? row.h : 1;
    // Standard Lane Rule: Each row gets a full panel-width lane for readability/labels.
    // `exactRows` (the gypsum page) opts out: a ripped last lane is drawn at
    // its real width, so the drawing is the wall to scale.
    const visualRowSize = hasJoints || exactRows ? rowSize : (!isV ? stdRowH : rowSize);

    rowRects.push({
      x: isV ? visualCursor : 0,
      y: isV ? 0 : visualCursor,
      w: isV ? visualRowSize : canvasW,
      h: isV ? canvasW : visualRowSize,
      key: `row-bg-${idx}`
    });

    const rowPalClasses = s4 && useS4Colors
      ? (row.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s)
      : palClasses || PAL_CLASSES.s1;
    const isS4Palette = rowPalClasses === PAL_CLASSES.s4l || rowPalClasses === PAL_CLASSES.s4s;

    row.segs.forEach((seg, segIndex) => {
      const segPalClasses = isS4Palette && seg.type === "full" && seg.long !== undefined
        ? (seg.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s)
        : rowPalClasses;

      let segClass = seg.type === "gap" ? "layout-svg-gap" : seg.type === "joint" ? "layout-svg-joint" : getSegmentClass(seg, segPalClasses);
      // A row left out of the job (the gypsum page) is drawn, but not as board.
      if (row.excluded) segClass += " is-excluded";

      const rect = {
        key: `${idx}-${segIndex}-${seg.type}-${Math.round(seg.x)}-${Math.round(seg.w)}-${seg.sourceId || ""}`,
        type: seg.type,
        sourceId: seg.sourceId,
        isCarry: !!(seg.sourceId),
        rowIndex: idx,
        segIndex,
        row,
        seg,
        segClass
      };

      if (isV) {
        rect.x = visualCursor + (rowStart === "bottom" ? (visualRowSize - rowSize) : 0);
        rect.y = seg.x;
        rect.w = rowSize;
        rect.h = seg.w;
      } else {
        rect.x = seg.x;
        rect.y = visualCursor + (rowStart === "bottom" ? (visualRowSize - rowSize) : 0);
        rect.w = seg.w;
        rect.h = rowSize;
      }
      rects.push(rect);
    });

    if (row.jointAfter > 0) {
      rects.push({
        key: `row-joint-${idx}`,
        type: "joint",
        sourceId: null,
        isCarry: false,
        rowIndex: idx,
        segIndex: -1,
        row,
        seg: { w: row.jointAfter, type: "joint" },
        segClass: "layout-svg-joint",
        x: isV ? visualCursor + visualRowSize : 0,
        y: isV ? 0 : visualCursor + visualRowSize,
        w: isV ? row.jointAfter : canvasW,
        h: isV ? canvasW : row.jointAfter
      });
    }
    visualCursor += visualRowSize + (row.jointAfter || 0);
  });

  const vW = isV ? visualCursor : canvasW;
  const vH = isV ? canvasW : Math.max(canvasH, visualCursor);

  // Centering / Offset logic. Only the vertical axis is ever offset: a
  // bottom-anchored horizontal layout shorter than the canvas is pushed down
  // so the last row sits on the floor of the chart.
  let yOffset = 0;

  if (!isV && visualCursor < canvasH && rowStart === "bottom") {
    yOffset = (canvasH - visualCursor);
  }

  if (yOffset > 0) {
    rects.forEach(r => { r.y += yOffset; });
    rowRects.forEach(r => { r.y += yOffset; });
  }

  return { rects, rowRects, vW, vH, yOffset };
}

// ── LayoutVisualization (rewritten from scratch) ──────────────────────────────
// Row labels live inside the SVG, positioned in SVG coordinate space.
// This guarantees they always align with the chart rows at any container size.

export function LayoutVisualization({ result, hoveredType, setHoveredType, rowStart = "top", alwaysShowLabels = false, maxHeight = 420, onLargePreview, onSelect, onRowToggle }) {
  const [selectedKey, setSelectedKey] = React.useState(null);
  const [selectedSourceId, setSelectedSourceId] = React.useState(null);
  const svgIdRef = React.useRef(null);
  /* Screen pixels per drawing unit, measured (onRowToggle only). Labels are
     drawn in drawing units, so without it a 5800 wall's labels come out
     larger than a 5130 wall's at the same on-screen scale. Measured after
     every render — the label margin is part of the viewBox, so the scale
     moves with the label size and settles in a render or two — and on
     resize; stored only when it moves more than 1%, which ends the loop.
     jsdom measures nothing and keeps the fallback size. */
  const svgRef = React.useRef(null);
  const [pxPerUnit, setPxPerUnit] = React.useState(null);
  React.useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!onRowToggle || !svg) return undefined;
    const measure = () => {
      const box = svg.viewBox && svg.viewBox.baseVal;
      const rect = svg.getBoundingClientRect();
      if (!box || !box.width || !box.height || !rect.width || !rect.height) return;
      const scale = Math.min(rect.width / box.width, rect.height / box.height);
      setPxPerUnit(prev => (prev && Math.abs(prev - scale) / prev < 0.01 ? prev : scale));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  });
  if (!svgIdRef.current) {
    svgIdRef.current = `layout-svg-${Math.random().toString(36).slice(2, 10)}`;
  }
  const gapHatchId = `${svgIdRef.current}-gap-hatch`;

  /* Every hook this component has runs before the two early returns below,
     and has to stay that way.

     They used to sit after them. A render that took the `strip` branch or the
     invalid-result guard therefore called three hooks, and a render that took
     neither called six — and React identifies a hook by the position it was
     called in, not by name. An empty or capped layout carries `meta: {}`
     (emptyLayoutResult, simulation.js), so the guard fires on any dimension
     the simulation cannot use: clearing a field and typing a valid number back
     took the same mounted component from three hooks to six and threw
     "rendered more hooks than during the previous render" over the page.

     Both memos are safe on the paths that return early. An empty result has
     `rows: []`, so buildLayoutSvgRects iterates nothing and every figure it
     derives from an absent `meta` is unread; the strip branch renders from
     `result.rows[0]` directly and never looks at them.

     eslint's react-hooks/rules-of-hooks is what found this. No test covers
     this file, and the crash needs two renders of one instance to show up, so
     nothing else in `verify` could have. */
  const { surfaceW, surfaceH, PPi, PLa, s4Long, s4: isS4, direction } = result.meta;
  const isV = direction === "V";

  // Define orderedRows once as the single source of truth for this render
  const orderedRows = React.useMemo(() =>
    rowStart === "bottom"
      ? (result.rows || []).map((row, idx) => ({ row, idx })).reverse()
      : (result.rows || []).map((row, idx) => ({ row, idx })),
  [result.rows, rowStart]);

  // Build rects in SVG coordinate space
  const { rects, rowRects, vW, vH } = React.useMemo(
    () => buildLayoutSvgRects(result, orderedRows, rowStart),
    [result, orderedRows, rowStart]
  );

  // Build carry connector lines between adjacent rows at cut→offcut boundaries
  const carryLines = React.useMemo(() => {
    if (isV) return []; // connectors only in H mode for now
    const lines = [];
    for (let i = 0; i < orderedRows.length - 1; i++) {
      const { row: rowA } = orderedRows[i];
      const { row: rowB } = orderedRows[i + 1];
      const cutSeg    = rowA.segs[rowA.segs.length - 1];
      const offcutSeg = rowB.segs[0];
      if (cutSeg?.sourceId && offcutSeg?.sourceId === cutSeg.sourceId) {
        // find the visual y positions from rowRects
        const rrA = rowRects[i];
        const rrB = rowRects[i + 1];
        if (!rrA || !rrB) continue;
        const boundary = rrA.y + rrA.h; // SVG y of row boundary
        const x1 = cutSeg.x + cutSeg.w;        // right edge of cut (= surfaceW)
        const x2 = offcutSeg.x + offcutSeg.w;  // right edge of offcut
        lines.push({ x1, x2, y: boundary, sourceId: cutSeg.sourceId });
      }
    }
    return lines;
  }, [orderedRows, rowRects, isV]);

  /* `onSelect` (the gypsum page) hears which piece is selected: its segment
     and row, or null. Told again whenever the drawing changes, so a caller
     never shows a piece that has since moved or gone — a selected key no
     longer drawn is dropped. A caller should keep a primitive from it (a
     string), so telling it the same thing again changes nothing. */
  const selectedRect = selectedKey ? rects.find(r => r.key === selectedKey) || null : null;
  React.useEffect(() => {
    if (selectedKey && !selectedRect) { setSelectedKey(null); setSelectedSourceId(null); }
    if (onSelect) onSelect(selectedRect ? { seg: selectedRect.seg, row: selectedRect.row, rowIndex: selectedRect.rowIndex } : null);
  }, [selectedRect, selectedKey, onSelect]);

  // ── Strip layout (special case) ──
  if (result.meta.visualization === "strip") {
    const segments = result.rows[0].segs;
    const stripParts = segments.flatMap((seg, index) => [
      { ...seg, key: `piece-${index}` },
      ...(index < segments.length - 1 && result.meta.gap > 0
        ? [{ w: result.meta.gap, type: "gap", key: `gap-${index}` }]
        : [])
    ]);
    const edgeLegend = result.meta.oneFullEdge
      ? [
        ...(result.meta.firstPieceWidth > 0
          ? [["First piece", `${fmt.mm(result.meta.firstPieceWidth)}mm`, "color-edge"]]
          : []),
        ...(result.meta.edgeWidth > 0
          ? [["Last piece", `${fmt.mm(result.meta.edgeWidth)}mm`, "color-edge"]]
          : [])
      ]
      : [["Edge piece", `${fmt.mm(result.meta.edgeWidth)}mm`, "color-edge"]];
    return (
      <div className="strip-visual">
        <div className="strip">
        {stripParts.map((seg, i) => {
          const wp = seg.w / result.meta.roomWidth * 100;
          const segClass = seg.type === "gap" ? "strip-gap" : seg.type === "edge" ? "color-edge" : "color-sys1";
          const isDimmed = hoveredType && seg.type === hoveredType;
          return (
            <div key={i} className={"strip-seg " + segClass + (isDimmed ? " seg-highlight" : "")}
              title={`${fmt.decimal(seg.w)}mm`} style={{ width: `${wp}%` }} />
          );
        })}
        </div>
        <div className="strip-measurements" aria-label="Piece widths">
        {stripParts.map((seg, i) => {
            const wp = seg.w / result.meta.roomWidth * 100;
            return (
              <div key={i} className="strip-measurement" style={{ width: `${wp}%` }}>
                <span aria-label={`${fmt.decimal(seg.w)} millimetres${seg.type === "gap" ? " gap" : ""}`}>{fmt.mm(seg.w)}</span>
              </div>
            );
          })}
        </div>
        <div className="strip-support">
          <Stack direction="row" gap={3} className="strip-legend">
            {[...edgeLegend, ["Full panel", `${result.meta.panelWidth}mm`, "color-sys1"], ...(result.meta.gap > 0 ? [["Gap", `${fmt.mm(result.meta.gap)}mm`, "strip-gap"]] : [])].map(([label, value, color]) => (
              <div key={label} className="strip-legend-item">
                <span aria-hidden="true" className={"strip-legend-dot " + color} />
                <span className="strip-legend-lbl">{label} ({value})</span>
              </div>
            ))}
          </Stack>
          <div className="strip-note">
            {/* UI-audit numeric-entity regression sentinel: &#128161; */}
            <span aria-hidden="true" className="strip-note-dot" />
            <span>{result.stats.cut === 0 ? "No panels are cut (perfect fit)." : result.stats.cut === 1 ? "1 edge piece is cut from a full panel (1 panel is cut)." : "Both edge pieces are cut from full panels (2 panels are cut)."}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Main SVG layout ──
  if (!surfaceW || !surfaceH || !PPi || !PLa) return null;
  const horzPanel = isV ? PLa : PPi;
  const horzLabel = isS4 ? `${surfaceW} mm \u2014 long ${s4Long} mm` : `${surfaceW} mm \u2014 panel ${horzPanel} mm`;
  const vertPanel = isV ? PPi : PLa;
  const vertLabel = `${surfaceH} mm \u2014 row ${vertPanel} mm`;

  // role="img" without a name announces as an unlabelled graphic. The
  // per-segment <title>s do not supply one for the diagram as a whole.
  const svgLabel = [
    `${isS4 ? "Long-short" : "Row"} layout diagram`,
    `${surfaceW} by ${surfaceH} mm surface`,
    `${result.rows.length} ${result.rows.length === 1 ? "row" : "rows"} running ${isV ? "vertically" : "horizontally"}`,
    `${result.stats.full} full and ${result.stats.cut} cut pieces`
  ].join(", ") + ".";

  const showSegmentText = alwaysShowLabels || result.rows.length <= 10;
  const showRowLabels = alwaysShowLabels || result.rows.length <= 32;


  const groupBands = showRowLabels ? rowRects.map(rr => {
    const originalIdx = parseInt(rr.key.replace("row-bg-", ""), 10);
    const label = `R${originalIdx + 1}`;
    return {
      mid: isV ? rr.x + rr.w / 2 : rr.y + rr.h / 2,
      label,
      lane: originalIdx,
      excluded: Boolean(result.rows[originalIdx]?.excluded)
    };
  }) : [];

  // ── SVG viewBox ──
  const maxRowLabelChars = groupBands.reduce((max, band) => Math.max(max, band.label.length), 1);
  const minRowLabelLane = rowRects.reduce((min, rr) => Math.min(min, isV ? rr.w : rr.h), Infinity);
  const baseLabelFontSize = Math.round((isV ? vH : vW) * 0.016);
  const laneLabelFontSize = Number.isFinite(minRowLabelLane)
    ? Math.floor(minRowLabelLane / ((maxRowLabelChars + (onRowToggle && isV ? 2 : 0)) * 0.68))
    : baseLabelFontSize;
  /* With checkboxes (onRowToggle) the labels are a control, so they are
     sized by the room between neighbouring labels rather than by the
     thinnest lane: a 100 mm strip beside 1250 rows used to shrink every
     label to fit inside it. */
  const sortedMids = groupBands.map(b => b.mid).sort((a, b) => a - b);
  const bandGap = sortedMids.slice(1).reduce((min, mid, i) => Math.min(min, mid - sortedMids[i]), Infinity);
  /* 15 screen pixels once measured; before that, a share of the drawing. */
  const TOGGLE_LABEL_PX = 15;
  const toggleFontSize = Math.round(Math.min(pxPerUnit ? TOGGLE_LABEL_PX / pxPerUnit : Math.max(vW, vH) * 0.017,
    Number.isFinite(bandGap) ? (isV ? bandGap / ((maxRowLabelChars + 2) * 0.66) : bandGap / 1.3) : Infinity));
  const labelFontSize = !showRowLabels ? 0
    : Math.max(10, onRowToggle ? toggleFontSize : Math.min(baseLabelFontSize, laneLabelFontSize));
  /* Fixed horizontally the labels sit in a left margin; with checkboxes it
     holds a column of boxes, then the labels left-aligned after them. */
  const toggleCol = { pad: labelFontSize * 0.5, box: labelFontSize * 0.9, gap: labelFontSize * 0.4 };
  const labelMargin = !showRowLabels ? 0
    : !isV && onRowToggle
      ? Math.round(toggleCol.pad * 2 + toggleCol.box + toggleCol.gap + maxRowLabelChars * labelFontSize * 0.62)
      : Math.round(labelFontSize * (isV && onRowToggle ? 1.9 : 3.6));
  /* With checkboxes, a strip of space at the drawing's edges: fixed
     horizontally above and below, so a row label at an edge — a 100 mm
     strip at the top — sits clear of the frame; fixed vertically below, to
     match the label strip above. The wall itself stays to scale. */
  const edgePad = showRowLabels && onRowToggle ? Math.round(labelFontSize * 0.9) : 0;
  const chartX = !isV ? labelMargin : 0;
  const chartY = isV ? labelMargin : edgePad;
  const totalVW = vW + chartX;
  const totalVH = vH + chartY + edgePad;
  const aspectRatio = totalVW / totalVH;
  /* Where each row checkbox sits along the drawing's edge (onRowToggle):
     over its row's middle, kept inside the drawing, and kept clear of its
     neighbours — a 130 mm last column used to push its pair against the one
     before. Two sweeps: forwards so none overlaps the one before it, then
     back from the far edge so none runs off it; a pair moves only as far as
     it has to. */
  const toggleSpots = new Map();
  if (onRowToggle && showRowLabels) {
    const fs = labelFontSize;
    const { pad, box, gap } = toggleCol;
    const span = band => (isV ? box + gap + band.label.length * fs * 0.62 : box);
    const space = fs * (isV ? 1.2 : 0.3);
    const lo = band => (isV ? span(band) / 2 + pad : box / 2 + fs * 0.15);
    const hi = band => (isV ? totalVW - span(band) / 2 - pad : totalVH - box / 2 - fs * 0.15);
    const order = [...groupBands].sort((a, b) => a.mid - b.mid);
    const at = order.map(band => Math.min(Math.max(band.mid + (isV ? chartX : chartY), lo(band)), hi(band)));
    for (let i = 1; i < order.length; i++) {
      at[i] = Math.max(at[i], at[i - 1] + (span(order[i - 1]) + span(order[i])) / 2 + space);
    }
    for (let i = order.length - 1; i >= 0; i--) {
      const limit = i === order.length - 1 ? hi(order[i]) : at[i + 1] - (span(order[i]) + span(order[i + 1])) / 2 - space;
      at[i] = Math.min(at[i], limit);
    }
    order.forEach((band, i) => toggleSpots.set(band.lane, at[i]));
  }

  const handleSegClick = (rect) => {
    if (selectedKey === rect.key) {
      setSelectedKey(null);
      setSelectedSourceId(null);
    } else {
      setSelectedKey(rect.key);
      setSelectedSourceId(rect.sourceId || null);
    }
  };

  return (
    <div className="viz-card">
      <div className="viz-body">
        {/* Shape and cap are the drawing's own, so they stay inline. */}
        <div className="viz-frame" style={{ aspectRatio, maxHeight: `${maxHeight}px` }}>
          {onLargePreview && (
            <button type="button" className="viz-expand-btn ctl-icon" onClick={() => onLargePreview()} title={alwaysShowLabels ? "Close large preview" : "Open large preview"}>
              <Icon name={alwaysShowLabels ? "minimize" : "maximize"} />
            </button>
          )}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${totalVW} ${totalVH}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={svgLabel}
            className="viz-svg"
            onClick={() => { setSelectedKey(null); setSelectedSourceId(null); }}
          >
            <defs>
              <pattern id={gapHatchId} patternUnits="userSpaceOnUse" width="16" height="16">
                <rect width="16" height="16" fill="color-mix(in srgb, var(--danger) 12%, transparent)" />
                <path d="M0 16 L16 0" stroke="var(--danger)" strokeWidth="2" />
              </pattern>
            </defs>
            {rowRects.map(r => (
              <rect key={r.key} x={r.x + chartX} y={r.y + chartY} width={r.w} height={r.h} className="layout-svg-row-bg" />
            ))}
            {rects.map(rect => {
              const text = rect.type === "gap" ? `\u2205${Math.round(rect.seg.w)}` : String(rect.seg.label ?? Math.round(rect.seg.w));
              /* Once the scale is measured (the gypsum page) a piece's number
                 is PIECE_LABEL_PX on screen on every drawing, and shows only
                 where it fits in its piece at that size. */
              const pieceFs = pxPerUnit ? PIECE_LABEL_PX / pxPerUnit : null;
              const isHighlighted = hoveredType && rect.type === hoveredType;
              const isSelected = selectedKey === rect.key || (selectedSourceId && rect.sourceId === selectedSourceId);
              /* A piece whose middle is inside an opening keeps its label to
                 itself: the opening's own label sits there, over it. */
              const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
              const hw = pieceFs ? text.length * pieceFs * 0.31 : Math.max(vW, vH) * 0.03;
              const hh = pieceFs ? pieceFs * 0.6 : Math.max(vW, vH) * 0.015;
              const fits = pieceFs
                ? rect.w > (text.length * 0.62 + 0.8) * pieceFs && rect.h > pieceFs * 1.3
                : rect.w > vW * 0.045 && rect.h > vH * 0.035;
              const underOpening = (result.meta.openings || []).some(o =>
                cx + hw > o.x && cx - hw < o.x + o.w && cy + hh > o.y && cy - hh < o.y + o.h);
              const showLabel = showSegmentText && fits && !underOpening && !rect.row.excluded;
              return (
                <g key={rect.key} className={rect.sourceId ? "viz-seg is-linked" : "viz-seg"}
                  onClick={e => { e.stopPropagation(); handleSegClick(rect); }}
                >
                  <rect
                    x={rect.x + chartX} y={rect.y + chartY} width={rect.w} height={rect.h}
                    className={`layout-svg-seg ${rect.segClass}${rect.isCarry ? " is-carry" : ""}${isHighlighted ? " is-highlighted" : ""}${isSelected ? " is-selected" : ""}`}
                    style={rect.type === "gap" ? { fill: `url(#${gapHatchId})` } : undefined}
                    {...linkedHighlightProps(rect.type, hoveredType, setHoveredType, { toggleOnTap: false })}
                  >
                    <title>{`${rect.seg.size || `${Math.round(rect.seg.w)}mm`} - ${rect.type}${rect.sourceId ? ` (source: ${rect.sourceId})` : ""}`}</title>
                  </rect>
                  {showLabel && (
                    <text x={rect.x + chartX + rect.w / 2} y={rect.y + chartY + rect.h / 2}
                      textAnchor="middle" dominantBaseline="middle" className="layout-svg-label"
                      style={pieceFs ? { fontSize: pieceFs } : undefined}>
                      {/* A segment may carry its own label (Gypsum: the piece's width);
                          otherwise its length along the row. */}
                      {text}
                    </text>
                  )}
                </g>
              );
            })}
            {carryLines.map((cl, i) => (
              <line
                key={`carry-${i}-${cl.sourceId}`}
                x1={cl.x1 + chartX} y1={cl.y + chartY}
                x2={cl.x2 + chartX} y2={cl.y + chartY}
                className="layout-svg-carry-line"
              />
            ))}
            {/* Doors and windows (the gypsum page): cut-outs drawn over the
                pieces, in the same surface millimetres as the pieces. */}
            {(result.meta.openings || []).map(o => (
              <g key={`opening-${o.label}`}>
                <rect x={o.x + chartX} y={o.y + chartY} width={o.w} height={o.h} className="layout-svg-opening">
                  <title>{`${o.label}: ${o.kind}, ${Math.round(o.w)} × ${Math.round(o.h)} mm`}</title>
                </rect>
                <text x={o.x + chartX + o.w / 2} y={o.y + chartY + o.h / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={pxPerUnit ? OPENING_LABEL_PX / pxPerUnit : Math.max(vW, vH) * 0.035}
                  className="layout-svg-opening-label">{o.label}</text>
              </g>
            ))}
            {/* With `onRowToggle` (the gypsum page) each row label has a
                checkbox before it: ticked while the row counts, empty (and
                the label struck out) once it is left out. Box and label are
                one target — a click on either, or Enter/Space on focus. */}
            {groupBands.map(band => {
              const fs = labelFontSize;
              const spot = toggleSpots.get(band.lane);
              const textX = isV ? band.mid + chartX : chartX - (fs * 0.5);
              const textY = isV ? chartY - (fs * 0.5) : band.mid + chartY;
              if (!onRowToggle) {
                return (
                  <text key={band.label} x={textX} y={textY} fontSize={fs} style={{ fontSize: fs }}
                    textAnchor={isV ? "middle" : "end"} dominantBaseline={isV ? "auto" : "middle"}
                    className="layout-svg-row-label">{band.label}</text>
                );
              }
              const { pad, box, gap } = toggleCol;
              const textW = band.label.length * fs * 0.62;
              const total = box + gap + textW;
              /* Fixed horizontally: one column of boxes at the margin's left,
                 labels left-aligned after them, each kept inside the drawing
                 even when its lane is thinner than the label (a 100 strip at
                 the top). Vertically: the pair centred over its column, kept
                 inside the drawing's width the same way. */
              const midY = isV ? 0 : spot;
              const midX = isV ? spot : 0;
              const boxX = isV ? midX - total / 2 : pad;
              /* Box and label share one centre line. The label sits on its
                 baseline, half a capital's height below that line, so "R1"
                 (all capitals) is centred on the box — "middle" would centre
                 lowercase height and leave the capitals riding high. */
              const cy = isV ? textY - fs * 0.35 : midY;
              const boxY = cy - box / 2;
              const labelX = boxX + box + gap;
              const labelY = cy + fs * CAP_HEIGHT / 2;
              const on = !band.excluded;
              const toggle = () => onRowToggle(band.lane);
              return (
                <g key={band.label} className={"layout-svg-row-toggle" + (on ? "" : " is-excluded")}
                  role="checkbox" tabIndex={0} aria-checked={on}
                  aria-label={`${band.label} counted`}
                  onClick={e => { e.stopPropagation(); toggle(); }}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                  <title>{on ? "Counted — click to leave this row out" : "Left out — click to count it again"}</title>
                  <rect className="layout-svg-row-hit" x={boxX - fs * 0.25} y={boxY - fs * 0.25}
                    width={total + fs * 0.5} height={box + fs * 0.5} rx={fs * 0.2} />
                  <rect className="layout-svg-check" x={boxX} y={boxY} width={box} height={box} rx={box * 0.18} />
                  {on && (
                    <path className="layout-svg-check-mark"
                      d={`M${boxX + box * 0.22} ${boxY + box * 0.52} L${boxX + box * 0.42} ${boxY + box * 0.72} L${boxX + box * 0.8} ${boxY + box * 0.3}`} />
                  )}
                  <text x={labelX} y={labelY} fontSize={fs} style={{ fontSize: fs }}
                    textAnchor="start" dominantBaseline="alphabetic"
                    className={"layout-svg-row-label" + (on ? "" : " is-excluded")}>{band.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="viz-legend-v">
          <div className="viz-legend-v-text">
            <Icon name="arrow-v" className="viz-legend-icon viz-legend-icon--upright" />
            <span>{vertLabel}</span>
          </div>
        </div>
      </div>

      {/* Dimension legends */}
      <div className="viz-legends">
        <div className="viz-legend-h">
          <Icon name="arrow-h" className="viz-legend-icon" />
          <span>{horzLabel}</span>
          <Icon name="arrow-h" className="viz-legend-icon" />
        </div>
      </div>
    </div>
  );
}

export function LayoutPanel({ layout, result, hoveredType, isBest, setHoveredType, rowStart = "top", noToggle = false, open: openProp, setOpen: setOpenProp, onLargePreview, onPrint }) {
  const [openLocal, setOpenLocal] = React.useState(layout.defaultOpen !== false);
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const isOpen = noToggle ? true : (isControlled ? openProp : openLocal);
  const setOpen = isControlled ? setOpenProp : setOpenLocal;
  const unavailableReason = result.valid ? null : result.reason
    || (result.capped ? result.summaryRows[0]?.label : null)
    || (result.rows.length ? "This layout leaves uncovered gaps." : "This layout cannot be calculated with these dimensions.");
  return (
    <div id={"panel-" + layout.id} className={`sys-block${isOpen ? " sys-block-open" : ""}`}>
      <div className="sys-head">
        <button type="button" className="sys-disclosure disclosure"
          disabled={noToggle} aria-expanded={isOpen} aria-controls={`panel-${layout.id}-body`}
          onClick={() => setOpen(!isOpen)}>
          {!noToggle && <span className="sys-head-toggle"><Icon name={isOpen ? "chevron-down" : "chevron-right"} /></span>}
          <span className="sys-head-copy">
            <span className="sys-title-line">
              <span className="sys-title">{layout.title}</span>
            </span>
            {layout.description && <span className="sys-head-sub">{layout.description}</span>}
            {unavailableReason && <span className="sys-head-error">{unavailableReason}</span>}
          </span>
        </button>
        {/* The slot already stops propagation, which is what lets a control
            live inside a header whose own click toggles the panel. */}
        <div className="sys-head-actions" onClick={e => e.stopPropagation()}>
          <span className="sys-head-count">{result.valid ? `${result.stats.stockPanels ?? result.stats.total} pcs` : "Unavailable"}</span>
          {isBest && <span className="sys-head-best">Best</span>}
          {onPrint && (
            <button
              type="button"
              className="num-btn ctl-ghost ctl-sm"
              onClick={onPrint}
              disabled={!result.valid || !result.rows.length || !result.stockPlan}
              title={`Cut list for ${layout.title} — opens the print dialog, where Save as PDF is`}
              aria-label={`Print the cut list for ${layout.title}`}>
              <Icon name="print" /> PDF
            </button>
          )}
        </div>
      </div>
      {isOpen && (
        <Stack id={`panel-${layout.id}-body`} className="panel-body" gap={2}>
          {layout.renderControls && React.createElement(layout.renderControls, { state: layout.getState(), setState: layout.setState })}
          {result.summaryRows.length > 0 && <PanelSummary rows={result.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} grouped={!!layout.summaryGroupTitles} groupTitles={layout.summaryGroupTitles} />}
          {result.rows.length > 0 && (
            <LayoutVisualization
              result={result}
              hoveredType={hoveredType}
              setHoveredType={setHoveredType}
              rowStart={rowStart}
              onLargePreview={onLargePreview ? () => onLargePreview(layout, result) : null}
            />
          )}
        </Stack>
      )}
    </div>
  );
}

export function PreviewSection({ id, title, description, headerActions, children }) {
  return (
    <Stack id={id} gap={3}>
      {(title || description || headerActions) && (
        <div className="preview-head">
          <div className="preview-head-main">
            {title && <h2 className="preview-title">{title}</h2>}
            {description && <p className="preview-desc">{description}</p>}
          </div>
          {headerActions && <div className="preview-head-actions">{headerActions}</div>}
        </div>
      )}
      <Stack className="preview-data" gap={3}>{children}</Stack>
    </Stack>
  );
}

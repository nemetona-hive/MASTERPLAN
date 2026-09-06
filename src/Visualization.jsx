import { React } from "./react-globals.js";
import { Icon, linkedHighlightProps, Row, Stack } from "./shared.jsx";

export function PanelSummary({ rows, hoveredType, setHoveredType }) {
  return (
    <>
      {rows.map((row, i) => (
        <Row key={i} label={row.label} value={row.value} unit={row.unit} hi={row.hi} danger={row.danger}
          hoverType={row.hoverType} hoveredType={hoveredType} setHoveredType={setHoveredType} />
      ))}
    </>
  );
}



function buildLayoutSvgRects(result, orderedRows, rowStart) {
  const { surfaceW, surfaceH, simW, simH, direction, s4, useS4Colors, palClasses, PPi, PLa } = result.meta;
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
    const visualRowSize = !isV ? stdRowH : rowSize;

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

      let segClass = seg.type === "gap" ? "layout-svg-gap" : getSegmentClass(seg, segPalClasses);

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

    visualCursor += visualRowSize;
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

export function LayoutVisualization({ result, hoveredType, setHoveredType, rowStart = "top", alwaysShowLabels = false, maxHeight = 420, onLargePreview }) {
  const [selectedKey, setSelectedKey] = React.useState(null);
  const [selectedSourceId, setSelectedSourceId] = React.useState(null);
  const svgIdRef = React.useRef(null);
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

  // ── Strip layout (special case) ──
  if (result.meta.visualization === "strip") {
    return (
      <div className="strip">
        {result.rows[0].segs.map((seg, i) => {
          const wp = seg.w / result.meta.roomWidth * 100;
          const segClass = seg.type === "edge" ? "color-edge" : "color-sys1";
          const isDimmed = hoveredType && seg.type === hoveredType;
          return (
            <div key={i} className={"strip-seg " + segClass + (isDimmed ? " seg-highlight" : "")}
              title={`${fmt.decimal(seg.w)}mm`} style={{ width: `${wp}%` }}>
              {wp > 5 && <span className="strip-seg-lbl">{fmt.mm(seg.w)}</span>}
            </div>
          );
        })}
        <Stack direction="row" gap={3} className="strip-legend strip-legend-mt">
          {[["Edge piece", `${fmt.mm(result.meta.edgeWidth)}mm`, "color-edge"],
            ["Full panel", `${result.meta.panelWidth}mm`, "color-sys1"]].map(([label, value, color]) => (
            <div key={label} className="strip-legend-item">
              <div className={"strip-legend-dot " + color} />
              <span className="strip-legend-lbl">{label} ({value})</span>
            </div>
          ))}
        </Stack>
        <div className="strip-note">
          &#128161; {result.stats.cut === 0 ? "No panels are cut (perfect fit)." : result.stats.cut === 1 ? "1 edge piece is cut from a full panel (1 panel is cut)." : "Both edge pieces are cut from full panels (2 panels are cut)."}
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
      label
    };
  }) : [];

  // ── SVG viewBox ──
  const maxRowLabelChars = groupBands.reduce((max, band) => Math.max(max, band.label.length), 1);
  const minRowLabelLane = rowRects.reduce((min, rr) => Math.min(min, isV ? rr.w : rr.h), Infinity);
  const baseLabelFontSize = Math.round((isV ? vH : vW) * 0.016);
  const laneLabelFontSize = Number.isFinite(minRowLabelLane)
    ? Math.floor(minRowLabelLane / (maxRowLabelChars * 0.68))
    : baseLabelFontSize;
  const labelFontSize = showRowLabels ? Math.max(10, Math.min(baseLabelFontSize, laneLabelFontSize)) : 0;
  const labelMargin = showRowLabels ? Math.round(labelFontSize * 3.6) : 0;
  const chartX = !isV ? labelMargin : 0;
  const chartY = isV ? labelMargin : 0;
  const totalVW = vW + chartX;
  const totalVH = vH + chartY;
  const aspectRatio = totalVW / totalVH;
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
      <div style={{ display: "flex", alignItems: "stretch", gap: "var(--sp-2)" }}>
        <div style={{ position: "relative", flex: 1, aspectRatio, maxHeight: `${maxHeight}px` }}>
          {onLargePreview && (
            <button type="button" className="viz-expand-btn ctl-icon" onClick={() => onLargePreview()} title={alwaysShowLabels ? "Close large preview" : "Open large preview"}>
              <Icon name={alwaysShowLabels ? "minimize" : "maximize"} />
            </button>
          )}
          <svg
            viewBox={`0 0 ${totalVW} ${totalVH}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={svgLabel}
            style={{ display: "block", width: "100%", height: "100%", borderRadius: "8px" }}
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
              const isHighlighted = hoveredType && rect.type === hoveredType;
              const isSelected = selectedKey === rect.key || (selectedSourceId && rect.sourceId === selectedSourceId);
              const showLabel = showSegmentText && rect.w > vW * 0.045 && rect.h > vH * 0.035;
              return (
                <g key={rect.key} style={{ cursor: rect.sourceId ? "pointer" : "default" }}
                  onClick={e => { e.stopPropagation(); handleSegClick(rect); }}
                >
                  <rect
                    x={rect.x + chartX} y={rect.y + chartY} width={rect.w} height={rect.h}
                    className={`layout-svg-seg ${rect.segClass}${rect.isCarry ? " is-carry" : ""}${isHighlighted ? " is-highlighted" : ""}${isSelected ? " is-selected" : ""}`}
                    style={rect.type === "gap" ? { fill: `url(#${gapHatchId})` } : undefined}
                    {...linkedHighlightProps(rect.type, hoveredType, setHoveredType, { toggleOnTap: false })}
                  >
                    <title>{`${Math.round(rect.seg.w)}mm - ${rect.type}${rect.sourceId ? ` (source: ${rect.sourceId})` : ""}`}</title>
                  </rect>
                  {showLabel && (
                    <text x={rect.x + chartX + rect.w / 2} y={rect.y + chartY + rect.h / 2}
                      textAnchor="middle" dominantBaseline="middle" className="layout-svg-label">
                      {rect.type === "gap" ? `\u2205${Math.round(rect.seg.w)}` : Math.round(rect.seg.w)}
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
            {groupBands.map(band => (
              <text key={band.label}
                x={isV ? band.mid + chartX : chartX - (labelFontSize * 0.5)}
                y={isV ? chartY - (labelFontSize * 0.5) : band.mid + chartY}
                fontSize={labelFontSize}
                style={{ fontSize: labelFontSize }}
                textAnchor={isV ? "middle" : "end"}
                dominantBaseline={isV ? "auto" : "middle"}
                className="layout-svg-row-label"
              >
                {band.label}
              </text>
            ))}
          </svg>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-1)", writingMode: "vertical-rl", fontFamily: "var(--mono)", fontSize: "var(--fs-md)", color: "var(--color-gray-opa80)", whiteSpace: "nowrap" }}>
            <Icon name="arrow-v" style={{ writingMode: "horizontal-tb", fontSize: "var(--fs-md)", color: "var(--color-primary)" }} />
            <span>{vertLabel}</span>
          </div>
        </div>
      </div>

      {/* Dimension legends */}
      <div className="viz-legends">
        <div className="viz-legend-h">
          <Icon name="arrow-h" style={{ color: "var(--color-primary)" }} />
          <span>{horzLabel}</span>
          <Icon name="arrow-h" style={{ color: "var(--color-primary)" }} />
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
  return (
    <div id={"panel-" + layout.id} className="sys-block">
      <div className="sys-head" onClick={noToggle ? undefined : () => setOpen(!isOpen)} style={noToggle ? { cursor: "default" } : {}}>
        {!noToggle && <span className="sys-head-toggle"><Icon name={isOpen ? "chevron-down" : "chevron-right"} /></span>}
        <h3 className="sys-title">
          {layout.icon && <Icon name={layout.icon} className="sys-title-icon" />} {layout.title}
        </h3>
        <span className="sys-head-sub">{layout.description}</span>
        {/* The slot already stops propagation, which is what lets a control
            live inside a header whose own click toggles the panel. */}
        <div className="sys-head-actions" onClick={e => e.stopPropagation()}>
          {onPrint && (
            <button
              type="button"
              className="num-btn ctl-ghost ctl-sm ctl-icon"
              onClick={onPrint}
              title={`Cut list for ${layout.title} — opens the print dialog, where Save as PDF is`}
              aria-label={`Print the cut list for ${layout.title}`}>
              <Icon name="print" />
            </button>
          )}
          <span className="sys-head-count">{result.stats.total} pcs {isBest ? <Icon name="best-badge" /> : ""}</span>
        </div>
      </div>
      {isOpen && (
        <Stack className="panel-body" gap={2}>
          {layout.renderControls && React.createElement(layout.renderControls, { state: layout.getState(), setState: layout.setState })}
          {result.summaryRows.length > 0 && <PanelSummary rows={result.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} />}
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


function PanelSummary({ rows, hoveredType, setHoveredType }) {
  return (
    <>
      {rows.map((row, i) => (
        <Row key={i} label={row.label} value={row.value} unit={row.unit} hi={row.hi} danger={row.danger}
          hoverType={row.hoverType} hoveredType={hoveredType} setHoveredType={setHoveredType} />
      ))}
    </>
  );
}

function rowSignature(row) {
  return row.segs
    .map(seg => [seg.type, Math.round(seg.x), Math.round(seg.w), seg.long ? 1 : 0, seg.sourceId || ""].join(":"))
    .join("|") + (row.long ? "-L" : "-S") + `-H${Math.round(row.h || 0)}`;
}

function groupAdjacentRows(rowsWithIndexes) {
  const groups = [];
  rowsWithIndexes.forEach(item => {
    const signature = rowSignature(item.row);
    const last = groups[groups.length - 1];
    const rowHeight = Number.isFinite(item.row.h) && item.row.h > 0 ? item.row.h : 1;
    if (last && last.signature === signature) {
      last.items.push(item);
      last.height += rowHeight;
    } else {
      groups.push({ signature, items: [item], height: rowHeight });
    }
  });
  return groups;
}

function buildLayoutSvgRects(result, orderedRows, rowStart) {
  const { surfaceW, surfaceH, direction, s4, useS4Colors, palClasses, PPi, PLa } = result.meta;
  const isV = direction === "V";
  const stdRowH = isV ? PPi : PLa;

  let physicalCursor = 0;
  let visualCursor = 0;
  const rects = [];
  const rowRects = [];

  orderedRows.forEach(({ row, idx }) => {
    const rowSize = Number.isFinite(row.h) && row.h > 0 ? row.h : 1;
    const visualRowSize = !isV ? stdRowH : rowSize;

    rowRects.push({
      x: isV ? visualCursor : 0,
      y: isV ? 0 : visualCursor,
      w: isV ? visualRowSize : surfaceW,
      h: isV ? surfaceH : visualRowSize,
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

  const vW = isV ? Math.max(surfaceW, visualCursor) : surfaceW;
  const vH = isV ? surfaceH : Math.max(surfaceH, visualCursor);

  // Centering / Offset logic
  let xOffset = 0;
  let yOffset = 0;

  if (isV && visualCursor < surfaceW) {
    xOffset = (surfaceW - visualCursor) / 2;
  } else if (!isV && visualCursor < surfaceH && rowStart === "bottom") {
    // For horizontal, only shift to bottom if rowStart was bottom
    yOffset = (surfaceH - visualCursor);
  }

  if (xOffset > 0 || yOffset > 0) {
    rects.forEach(r => { r.x += xOffset; r.y += yOffset; });
    rowRects.forEach(r => { r.x += xOffset; r.y += yOffset; });
  }

  return { rects, rowRects, vW, vH, xOffset, yOffset };
}

// ── LayoutVisualization (rewritten from scratch) ──────────────────────────────
// Row labels live inside the SVG, positioned in SVG coordinate space.
// This guarantees they always align with the chart rows at any container size.

function LayoutVisualization({ result, hoveredType, setHoveredType, rowStart = "top", alwaysShowLabels = false, maxHeight = 420, onLargePreview }) {
  const [selectedKey, setSelectedKey] = React.useState(null);
  const [selectedSourceId, setSelectedSourceId] = React.useState(null);
  const svgIdRef = React.useRef(null);
  if (!svgIdRef.current) {
    svgIdRef.current = `layout-svg-${Math.random().toString(36).slice(2, 10)}`;
  }
  const gapHatchId = `${svgIdRef.current}-gap-hatch`;

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
  const { surfaceW, surfaceH, PPi, PLa, s4Long, s4: isS4, direction } = result.meta;
  const isV = direction === "V";
  const horzPanel = isV ? PLa : PPi;
  const horzLabel = isS4 ? `${surfaceW} mm \u2014 long ${s4Long} mm` : `${surfaceW} mm \u2014 panel ${horzPanel} mm`;
  const vertPanel = isV ? PPi : PLa;
  const vertLabel = `${surfaceH} mm \u2014 row ${vertPanel} mm`;

  // Define orderedRows once as the single source of truth for this render
  const orderedRows = rowStart === "bottom"
    ? result.rows.map((row, idx) => ({ row, idx })).reverse()
    : result.rows.map((row, idx) => ({ row, idx }));

  // Build rects in SVG coordinate space
  const { rects, rowRects, vW, vH, yOffset } = buildLayoutSvgRects(result, orderedRows, rowStart);
  const showSegmentText = alwaysShowLabels || result.rows.length <= 10;
  const showRowLabels = !isV && result.rows.length <= 12;

  // ── Compute row label bands in SVG coordinate space ──
  const rowGroups = groupAdjacentRows(orderedRows);

  const groupBands = showRowLabels ? rowGroups.map(group => {
    const idxSet = new Set(group.items.map(item => item.idx));
    // Use row background rects so labels center on the full visual lane
    const matching = rowRects.filter(r => idxSet.has(parseInt(r.key.replace("row-bg-", ""), 10)));
    if (matching.length === 0) return null;
    const topY = Math.min(...matching.map(r => r.y));
    const botY = Math.max(...matching.map(r => r.y + r.h));
    const count = group.items.length;
    const startR = group.items[0].idx + 1;
    const endR = group.items[count - 1].idx + 1;
    const label = count > 1 ? `R${Math.min(startR, endR)}-R${Math.max(startR, endR)}` : `R${startR}`;
    return { midY: (topY + botY) / 2, label };
  }).filter(Boolean) : [];

  // ── SVG viewBox — reserve a left strip for row labels ──
  // Font size in SVG user units, capped relative to chart width (not row height)
  // so it stays consistent regardless of row count.
  const rowLabelFontSize = showRowLabels ? Math.round(vW * 0.018) : 0;
  // Column wide enough for ~5 chars ("R1-R9") at that font size
  const labelColW = showRowLabels ? Math.round(rowLabelFontSize * 3.2) : 0;
  const gap = showRowLabels ? Math.round(rowLabelFontSize * 0.4) : 0;
  const chartX = labelColW + gap;
  const totalVW = vW + chartX;
  const aspectRatio = totalVW / vH;
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
            <button type="button" className="viz-expand-btn" onClick={() => onLargePreview()} title="Open large preview">
              <Icon name="maximize" />
            </button>
          )}
          <svg
            viewBox={`0 0 ${totalVW} ${vH}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            style={{ display: "block", width: "100%", height: "100%", borderRadius: "8px" }}
            onClick={() => { setSelectedKey(null); setSelectedSourceId(null); }}
          >
            <defs>
              <pattern id={gapHatchId} patternUnits="userSpaceOnUse" width="16" height="16">
                <rect width="16" height="16" fill="rgba(255,68,68,0.12)" />
                <path d="M0 16 L16 0" stroke="var(--danger)" strokeWidth="2" />
              </pattern>
            </defs>
            {rowRects.map(r => (
              <rect key={r.key} x={r.x + chartX} y={r.y} width={r.w} height={r.h} className="layout-svg-row-bg" />
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
                    x={rect.x + chartX} y={rect.y} width={rect.w} height={rect.h}
                    className={`layout-svg-seg ${rect.segClass}${isHighlighted ? " is-highlighted" : ""}${isSelected ? " is-selected" : ""}`}
                    style={rect.type === "gap" ? { fill: `url(#${gapHatchId})` } : undefined}
                    onMouseEnter={() => setHoveredType && setHoveredType(rect.type)}
                    onMouseLeave={() => setHoveredType && setHoveredType(null)}
                  >
                    <title>{`${Math.round(rect.seg.w)}mm - ${rect.type}${rect.sourceId ? ` (source: ${rect.sourceId})` : ""}`}</title>
                  </rect>
                  {showLabel && (
                    <text x={rect.x + chartX + rect.w / 2} y={rect.y + rect.h / 2}
                      textAnchor="middle" dominantBaseline="middle" className="layout-svg-label">
                      {rect.type === "gap" ? `\u2205${Math.round(rect.seg.w)}` : Math.round(rect.seg.w)}
                    </text>
                  )}
                </g>
              );
            })}
            {groupBands.map(band => (
              <text key={band.label} x={labelColW * 0.92} y={band.midY}
                fontSize={rowLabelFontSize}
                textAnchor="end" dominantBaseline="middle" className="layout-svg-row-label">
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

function LayoutPanel({ layout, result, hoveredType, isBest, setHoveredType, rowStart = "top", noToggle = false, open: openProp, setOpen: setOpenProp, onLargePreview }) {
  const [openLocal, setOpenLocal] = React.useState(layout.defaultOpen !== false);
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const isOpen = noToggle ? true : (isControlled ? openProp : openLocal);
  const setOpen = isControlled ? setOpenProp : setOpenLocal;
  const canLargePreview = onLargePreview && result.rows.length > 0;
  return (
    <div id={"panel-" + layout.id} className="sys-block">
      <div className="sys-head" onClick={noToggle ? undefined : () => setOpen(!isOpen)} style={noToggle ? { cursor: "default" } : {}}>
        {!noToggle && <span className="sys-head-toggle"><Icon name={isOpen ? "chevron-down" : "chevron-right"} /></span>}
        <h3 className="sys-title">
          {layout.icon && <Icon name={layout.icon} className="sys-title-icon" />} {layout.title}
        </h3>
        <span className="sys-head-sub">{layout.description}</span>
        <div className="sys-head-actions" onClick={e => e.stopPropagation()}>
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

function PreviewSection({ id, title, description, headerActions, children }) {
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

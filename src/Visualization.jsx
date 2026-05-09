// ── Visualization components ──────────────────────────────────────────────────

const PanelRowVis = React.memo(function PanelRowVis({ segs, W, palClasses, hoveredType, showLabels = true }) {
  return (
    <div className="panel-row">
      {segs.map((seg, i) => {
        const l = seg.x / W * 100, w = seg.w / W * 100;
        const isGap = seg.type === "gap";
        const isS4Palette = palClasses === PAL_CLASSES.s4l || palClasses === PAL_CLASSES.s4s;
        const segPalClasses = isS4Palette && seg.type === "full" && seg.long !== undefined
          ? (seg.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s)
          : palClasses;
        const segClass = getSegmentClass(seg, segPalClasses);
        const isDimmed = hoveredType && seg.type === hoveredType;
        const tc = isGap ? "#ff6666" : "var(--color-white)";
        const bgStyle = isGap ? {
          background: "repeating-linear-gradient(45deg,#ff444433 0,#ff444433 4px,#09101a55 4px,#09101a55 8px)",
          border: "1px dashed #ff4444"
        } : undefined;
        const titleText = isGap
          ? `${Math.round(seg.w)}mm \u2014 gap`
          : `${Math.round(seg.w)}mm \u2014 ${seg.type === "offcut" ? "remainder from prev" : seg.type === "cut" ? "cut" : seg.type === "edge" ? "edge piece" : "full panel"}` + (seg.sourceId ? ` (source: ${seg.sourceId})` : "");
        return (
          <div key={i}
            className={"panel-seg " + (!isGap ? segClass : "") + (isDimmed ? " seg-highlight" : "")}
            style={{ left: `${l}%`, width: `${w}%`, ...bgStyle }}
            title={titleText}>
            {showLabels && w > 4 && <span className="panel-seg-lbl" style={{ color: tc }}>
              {isGap ? `\u2205${Math.round(seg.w)}` : Math.round(seg.w)}
              {seg.sourceId && <span className="source-marker">{seg.type === "offcut" ? `${seg.sourceId}'` : seg.sourceId}</span>}
            </span>}
          </div>
        );
      })}
    </div>
  );
});

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
    .map(seg => [seg.type, Math.round(seg.x), Math.round(seg.w), seg.long ? 1 : 0].join(":"))
    .join("|") + (row.long ? "-L" : "-S");
}

function groupAdjacentRows(rowsWithIndexes) {
  const groups = [];
  rowsWithIndexes.forEach(item => {
    const signature = rowSignature(item.row);
    const last = groups[groups.length - 1];
    if (last && last.signature === signature) {
      last.items.push(item);
    } else {
      groups.push({ signature, items: [item] });
    }
  });
  return groups;
}

function LayoutVisualization({ result, hoveredType, rowStart = "top" }) {
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
  const orderedRows = (rowStart === "bottom"
    ? result.rows.map((row, idx) => ({ row, idx })).reverse()
    : result.rows.map((row, idx) => ({ row, idx })));
  const { surfaceW, surfaceH, PPi, PLa, s4Long, s4: isS4, direction } = result.meta;
  const isV = direction === "V";
  // In H mode: horizontal axis = W (panel length PPi runs along it), vertical = H (row height PLa)
  // In V mode: axes swap — horizontal axis = H, vertical = W; PPi runs vertically, PLa horizontally
  const horzTotal = isV ? surfaceH : surfaceW;
  const vertTotal = isV ? surfaceW : surfaceH;
  const horzPanel = isV ? PLa : PPi;
  const vertPanel = isV ? PPi : PLa;
  const horzLabel = isS4
    ? `${horzTotal} mm — long ${s4Long} mm`
    : `${horzTotal} mm — panel ${horzPanel} mm`;
  const vertLabel = `${vertTotal} mm — row ${vertPanel} mm`;

  const chartAspectRatio = horzTotal && vertTotal ? horzTotal / vertTotal : 1;
  const showRowText = orderedRows.length <= 12;
  const showSegmentText = orderedRows.length <= 10;
  const rowGroups = groupAdjacentRows(orderedRows);

  return (
    <Stack gap={0}>
      <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "stretch" }}>
        {/* Labels Column — Left Side */}
        {showRowText && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {rowGroups.map((group, i) => {
              const count = group.items.length;
              const startR = group.items[0].idx + 1;
              const endR = group.items[count - 1].idx + 1;
              const label = count > 1 
                ? `R${Math.min(startR, endR)}-R${Math.max(startR, endR)} ×${count}` 
                : `R${startR}`;
              return (
                <div key={i} style={{ flexGrow: count, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span className="sys-row-lbl-outer">{label}</span>
                </div>
              );
            })}
          </div>
        )}

        <Stack className="sys-rows sys-rows-border" gap={0} style={{ flex: 1, aspectRatio: chartAspectRatio, maxHeight: "420px" }}>
          {rowGroups.map((group, i) => {
            const count = group.items.length;
            
            return (
              <div key={i} className="sys-row" style={{ flexGrow: count }}>
                <div className="sys-row-vis">
                  <PanelRowVis
                    segs={group.items[0].row.segs}
                    W={result.meta.width}
                    palClasses={result.meta.s4 && result.meta.useS4Colors ? (group.items[0].row.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s) : result.meta.palClasses || PAL_CLASSES.s1}
                    hoveredType={hoveredType}
                    showLabels={showSegmentText} />
                </div>
              </div>
            );
          })}
        </Stack>

        {/* Vertical legend — Right side, rotated */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-1)", writingMode: "vertical-rl", fontFamily: "var(--mono)", fontSize: "var(--fs-md)", color: "var(--color-gray-opa80)", whiteSpace: "nowrap" }}>
            <Icon name="arrow-v" style={{ writingMode: "horizontal-tb", fontSize: "var(--fs-md)", color: "var(--color-primary)" }} />
            <span>{vertLabel}</span>
          </div>
        </div>
      </div>

      {/* Horizontal legend — Mirrored layout to align with sys-rows border */}
      <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
        {/* Left padding/spacer for labels */}
        {showRowText && (
          <div style={{ visibility: "hidden", pointerEvents: "none", display: "flex", flexDirection: "column", gap: 0 }}>
             <span className="sys-row-lbl-outer">R8-R8 ×8</span> {/* Representative width */}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--sp-1)", fontFamily: "var(--mono)", fontSize: "var(--fs-md)", color: "var(--color-gray-opa80)" }}>
          <Icon name="arrow-h" style={{ fontSize: "var(--fs-md)", color: "var(--color-primary)" }} />
          <span>{horzLabel}</span>
          <Icon name="arrow-h" style={{ fontSize: "var(--fs-md)", color: "var(--color-primary)" }} />
        </div>

        {/* Right padding/spacer for vertical legend */}
        <div style={{ visibility: "hidden", pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center", minWidth: "18px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-1)", writingMode: "vertical-rl" }}>
            <Icon name="arrow-v" style={{ fontSize: "var(--fs-md)" }} />
            <span>0000 mm</span>
          </div>
        </div>
      </div>
    </Stack>
  );
}

function LayoutPanel({ layout, result, hoveredType, isBest, setHoveredType, rowStart = "top", noToggle = false, open: openProp, setOpen: setOpenProp }) {
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
        <span className="sys-head-count">{result.stats.total} pcs {isBest ? <Icon name="best-badge" /> : ""}</span>
      </div>
      {isOpen && (
        <Stack className="panel-body" gap={2}>
          {layout.renderControls && React.createElement(layout.renderControls, { state: layout.getState(), setState: layout.setState })}
          {result.summaryRows.length > 0 && <PanelSummary rows={result.summaryRows} hoveredType={hoveredType} setHoveredType={setHoveredType} />}
          {result.rows.length > 0 && <LayoutVisualization result={result} hoveredType={hoveredType} rowStart={rowStart} />}
        </Stack>
      )}
    </div>
  );
}

function PreviewSection({ id, title, description, children }) {
  return (
    <Stack gap={3}>
      <Stack className="preview-data" gap={3}>{children}</Stack>
    </Stack>
  );
}

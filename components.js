"use strict";

const {
  useState
} = React;

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Icon({
  name,
  className = ""
}) {
  const faClass = ICONS[name] || "fa-solid fa-circle-question";
  return /*#__PURE__*/React.createElement("i", {
    className: [faClass, className].filter(Boolean).join(" "),
    style: {
      display: "inline-flex",
      alignItems: "center"
    }
  });
}
function NumInput({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 1
}) {
  const [local, setLocal] = React.useState(String(value));
  React.useEffect(() => {
    setLocal(String(value));
  }, [value]);
  const commit = () => {
    const n = Number(local);
    if (!isNaN(n) && n >= min) onChange(Math.max(min, Math.round(n * 100) / 100));else setLocal(String(value));
  };
  return /*#__PURE__*/React.createElement("label", {
    id: id,
    className: "num-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "num-lbl"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "num-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "num-input",
    type: "number",
    value: local,
    min: min,
    step: step,
    onChange: e => setLocal(e.target.value),
    onKeyDown: e => e.key === "Enter" && commit(),
    onBlur: commit
  }), /*#__PURE__*/React.createElement("button", {
    className: "num-btn",
    onClick: commit
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "corner-down-left"
  }))));
}
function SLabel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "slabel"
  }, children);
}

// Single collapsible replaces both Section and ControlPanel
function Collapsible({
  id,
  title,
  bg,
  open: openProp,
  setOpen: setOpenProp,
  children,
  variant = "section"
}) {
  const [openLocal, setOpenLocal] = React.useState(true);
  const open = setOpenProp ? openProp : openLocal;
  const setOpen = setOpenProp ? setOpenProp : setOpenLocal;
  if (variant === "panel") {
    return /*#__PURE__*/React.createElement("div", {
      id: id,
      className: "control-panel"
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head",
      onClick: () => setOpen(!open)
    }, /*#__PURE__*/React.createElement("span", {
      className: "sys-head-toggle"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: open ? "chevron-down" : "chevron-right"
    })), title), open && /*#__PURE__*/React.createElement("div", {
      className: "panel-data"
    }, children));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head",
    style: bg ? {
      background: bg
    } : undefined,
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-head-toggle"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: open ? "chevron-down" : "chevron-right"
  })), title), open && /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, children));
}

// Convenience aliases for readability at call sites
const Section = ({
  title,
  bg,
  children
}) => /*#__PURE__*/React.createElement(Collapsible, {
  title: title,
  bg: bg
}, children);
const ControlPanel = ({
  id,
  title,
  open,
  setOpen,
  children
}) => /*#__PURE__*/React.createElement(Collapsible, {
  id: id,
  title: title,
  open: open,
  setOpen: setOpen,
  variant: "panel"
}, children);
function Row({
  label,
  value,
  unit,
  hi,
  hoverType,
  hoveredType,
  setHoveredType
}) {
  const isHovered = hoverType && hoveredType === hoverType;
  return /*#__PURE__*/React.createElement("div", {
    className: "data-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl" + (hoverType ? " hoverable" : "") + (isHovered ? " hovered" : ""),
    onMouseEnter: hoverType && setHoveredType ? () => setHoveredType(hoverType) : undefined,
    onMouseLeave: hoverType && setHoveredType ? () => setHoveredType(null) : undefined
  }, label), /*#__PURE__*/React.createElement("span", {
    className: hi ? "data-row-val hi" : "data-row-val"
  }, value), unit && /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit"
  }, unit));
}
// ── Visualization components ──────────────────────────────────────────────────

const PanelRowVis = React.memo(function PanelRowVis({
  segs,
  W,
  palClasses,
  hoveredType
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel-row"
  }, segs.map((seg, i) => {
    const l = seg.x / W * 100,
      w = seg.w / W * 100;
    const isGap = seg.type === "gap";
    const segPalClasses = seg.type === "full" && seg.long === true ? PAL_CLASSES.s4s : palClasses;
    const segClass = getSegmentClass(seg, segPalClasses);
    const isDimmed = hoveredType && seg.type === hoveredType;
    const tc = isGap ? "#ff6666" : "var(--color-white)";
    const bgStyle = isGap ? {
      background: "repeating-linear-gradient(45deg,#ff444433 0,#ff444433 4px,#09101a55 4px,#09101a55 8px)",
      border: "1px dashed #ff4444"
    } : undefined;
    const titleText = isGap ? `${Math.round(seg.w)}mm \u2014 gap` : `${Math.round(seg.w)}mm \u2014 ${seg.type === "offcut" ? "remainder from prev" : seg.type === "cut" ? "cut" : seg.type === "edge" ? "edge piece" : "full panel"}`;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "panel-seg " + (!isGap ? segClass : "") + (isDimmed ? " seg-highlight" : ""),
      style: {
        left: `${l}%`,
        width: `${w}%`,
        ...bgStyle
      },
      title: titleText
    }, w > 4 && /*#__PURE__*/React.createElement("span", {
      className: "panel-seg-lbl",
      style: {
        color: tc
      }
    }, isGap ? `\u2205${Math.round(seg.w)}` : Math.round(seg.w)));
  }));
});
function PanelSummary({
  rows,
  hoveredType,
  setHoveredType
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, rows.map((row, i) => /*#__PURE__*/React.createElement(Row, {
    key: i,
    label: row.label,
    value: row.value,
    unit: row.unit,
    hi: row.hi,
    hoverType: row.hoverType,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType
  })));
}
function LayoutVisualization({
  result,
  hoveredType,
  rowStart = "top"
}) {
  if (result.meta.visualization === "strip") {
    return /*#__PURE__*/React.createElement("div", {
      className: "strip"
    }, result.rows[0].segs.map((seg, i) => {
      const wp = seg.w / result.meta.roomWidth * 100;
      const segClass = seg.type === "edge" ? "color-edge" : "color-sys1";
      const isDimmed = hoveredType && seg.type === hoveredType;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "strip-seg " + segClass + (isDimmed ? " seg-highlight" : ""),
        title: `${fmt.decimal(seg.w)}mm`,
        style: {
          width: `${wp}%`
        }
      }, wp > 5 && /*#__PURE__*/React.createElement("span", {
        className: "strip-seg-lbl"
      }, fmt.mm(seg.w)));
    }), /*#__PURE__*/React.createElement("div", {
      className: "strip-legend",
      style: {
        marginTop: "10px"
      }
    }, [["Edge piece", `${fmt.mm(result.meta.edgeWidth)}mm`, "color-edge"], ["Full panel", `${result.meta.panelWidth}mm`, "color-sys1"]].map(([label, value, color]) => /*#__PURE__*/React.createElement("div", {
      key: label,
      className: "strip-legend-item"
    }, /*#__PURE__*/React.createElement("div", {
      className: "strip-legend-dot " + color
    }), /*#__PURE__*/React.createElement("span", {
      className: "strip-legend-lbl"
    }, label, " (", value, ")")))), /*#__PURE__*/React.createElement("div", {
      className: "strip-note"
    }, "\uD83D\uDCA1 Both edge pieces are cut from full panels (2 panels are cut)."));
  }
  const orderedRows = rowStart === "bottom" ? result.rows.map((row, idx) => ({
    row,
    idx
  })).reverse() : result.rows.map((row, idx) => ({
    row,
    idx
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "sys-rows",
    style: {
      border: "1px solid #233342"
    }
  }, orderedRows.map(({
    row,
    idx
  }, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "sys-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-row-lbl"
  }, "R", idx + 1), /*#__PURE__*/React.createElement("div", {
    className: "sys-row-vis"
  }, /*#__PURE__*/React.createElement(PanelRowVis, {
    segs: row.segs,
    W: result.meta.width,
    palClasses: result.meta.s4 ? row.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s : result.meta.palClasses || PAL_CLASSES.s1,
    hoveredType: hoveredType
  })))));
}
function LayoutPanel({
  layout,
  result,
  hoveredType,
  isBest,
  setHoveredType,
  rowStart = "top"
}) {
  const [open, setOpen] = React.useState(layout.defaultOpen !== false);
  return /*#__PURE__*/React.createElement("div", {
    id: "panel-" + layout.id,
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sys-head",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-head-toggle"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: open ? "chevron-down" : "chevron-right"
  })), /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, layout.icon && /*#__PURE__*/React.createElement(Icon, {
    name: layout.icon,
    className: "sys-title-icon"
  }), " ", layout.title), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, result.meta.description || layout.description), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-count"
  }, result.stats.total, " pcs ", isBest ? /*#__PURE__*/React.createElement(Icon, {
    name: "best-badge"
  }) : "")), open && /*#__PURE__*/React.createElement("div", {
    className: "section-pad",
    style: {
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, layout.renderControls && React.createElement(layout.renderControls, {
    state: layout.getState(),
    setState: layout.setState
  }), result.summaryRows.length > 0 && /*#__PURE__*/React.createElement(PanelSummary, {
    rows: result.summaryRows,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType
  }), !result.valid && /*#__PURE__*/React.createElement("p", {
    className: "desc"
  }, "This layout leaves uncovered gaps and is excluded from best-layout scoring."), result.rows.length > 0 && /*#__PURE__*/React.createElement(LayoutVisualization, {
    result: result,
    hoveredType: hoveredType,
    rowStart: rowStart
  })));
}
function PreviewSection({
  id,
  title,
  description,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "preview-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "layout-section-title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "layout-section-desc"
  }, description)), /*#__PURE__*/React.createElement("div", {
    className: "preview-data"
  }, children));
}
// ── Layout controls & registry ────────────────────────────────────────────────

function S0Controls({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-s0-room",
    label: "Room width (mm)",
    value: state.roomWidth,
    onChange: v => setState({
      roomWidth: v
    }),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-s0-panel",
    label: "Panel width (mm)",
    value: state.panelWidth,
    onChange: v => setState({
      panelWidth: v
    }),
    step: 10
  }));
}
function S4Controls({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-s4long",
    label: "Long (mm)",
    value: state.s4Long,
    onChange: v => setState({
      s4Long: v
    }),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-s4short",
    label: "Short (mm)",
    value: state.s4Short,
    onChange: v => setState({
      s4Short: v
    }),
    step: 10
  }));
}
function S2Controls({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Offset (\xD7PL)"), /*#__PURE__*/React.createElement("input", {
    id: "input-offset",
    type: "range",
    min: 0.1,
    max: 0.9,
    step: 0.05,
    value: state.offset,
    onChange: e => setState({
      offset: +e.target.value
    }),
    style: {
      accentColor: "var(--color-primary)",
      width: "100%",
      height: "6px",
      borderRadius: "3px",
      appearance: "none"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-range-val"
  }, fmt.decimals(state.offset, 2)));
}

// Derives title and icon from SYSTEMS — edit titles/icons in config.js only
var LAYOUT_REGISTRY = ["s1", "s2", "s3", "s4"].map(id => {
  const sys = SYSTEMS.find(s => `s${s.id}` === id);
  return {
    id,
    icon: sys.icon,
    title: sys.title,
    compute: {
      s1: computeS1,
      s2: computeS2,
      s3: computeS3,
      s4: computeS4
    }[id],
    renderControls: {
      s2: S2Controls,
      s4: S4Controls
    }[id] || null,
    includeInBest: true
  };
});
// ── Page sheets ───────────────────────────────────────────────────────────────

function SheetHome({
  page,
  setPage
}) {
  const cards = PAGES.filter(pg => !pg.noNav && !pg.parentId);
  return /*#__PURE__*/React.createElement("div", {
    className: "home-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "home-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "home-brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "home-brand-name"
  }, "NEMETONA"), /*#__PURE__*/React.createElement("div", {
    className: "home-brand-sub"
  }, "MASTERPLAN")), /*#__PURE__*/React.createElement("div", {
    className: "home-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "home-cards"
  }, cards.map(pg => {
    const isActive = page === pg.id || PAGES.some(p => p.parentId === pg.id && p.id === page);
    const firstChild = PAGES.find(p => p.parentId === pg.id);
    const target = firstChild ? firstChild.id : pg.id;
    return /*#__PURE__*/React.createElement("button", {
      key: pg.id,
      className: "home-card" + (isActive ? " home-card-active" : ""),
      onClick: () => setPage(target),
      onKeyDown: e => (e.key === "Enter" || e.key === " ") && setPage(target)
    }, /*#__PURE__*/React.createElement("span", {
      className: "home-card-icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: pg.icon
    })), /*#__PURE__*/React.createElement("span", {
      className: "home-card-title"
    }, pg.title), /*#__PURE__*/React.createElement("span", {
      className: "home-card-desc"
    }, pg.desc), /*#__PURE__*/React.createElement("span", {
      className: "home-card-arrow"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right"
    })));
  })), /*#__PURE__*/React.createElement("div", {
    className: "home-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "home-footer"
  }, "NEMETONA HIVE")));
}
function SheetConcrete() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }));
}
function SheetArea({
  sh
}) {
  const {
    W,
    H,
    PPi,
    PLa
  } = sh;
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) {
    return /*#__PURE__*/React.createElement("div", {
      className: "page-inner"
    }, /*#__PURE__*/React.createElement("p", {
      className: "desc"
    }, "Select input values - all values must be greater than 0"));
  }
  const grossArea = W * H / 1e6,
    panelArea = PPi * PLa / 1e6;
  return /*#__PURE__*/React.createElement("div", {
    className: "page-inner"
  }, /*#__PURE__*/React.createElement("p", {
    className: "desc"
  }, "Linked from Layout page \u2014 change data in Layout view"), /*#__PURE__*/React.createElement(Section, {
    title: "Surface dimensions",
    bg: "#09101a"
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Surface width",
    value: Math.max(0, W),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Surface height",
    value: Math.max(0, H),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Area",
    value: fmt.area(Math.max(0, grossArea)),
    unit: "m\xB2",
    hi: true
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Panel length",
    value: Math.max(0, PPi),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Panel width",
    value: Math.max(0, PLa),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Panel area",
    value: fmt.decimals(Math.max(0, panelArea), 4),
    unit: "m\xB2"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Panel direction",
    value: sh.direction
  })));
}
function SheetSymmetricLayout({
  sym,
  setSym
}) {
  const [hoveredType, setHoveredType] = React.useState(null);
  const [surfaceOpen, setSurfaceOpen] = React.useState(true);
  const layout = {
    id: "s0",
    title: "Symmetric layout",
    description: "Equal edge pieces, full pieces in center",
    defaultOpen: true,
    renderControls: null,
    icon: "s0",
    getState: () => ({}),
    setState: () => {},
    compute: () => computeS0(sym),
    includeInBest: false
  };
  const result = layout.compute();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-sym-surface",
    title: "Surface Area",
    open: surfaceOpen,
    setOpen: setSurfaceOpen
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-sym-room-width",
    label: "Room width (mm)",
    value: sym.roomWidth,
    onChange: v => setSym(s => ({
      ...s,
      roomWidth: v
    })),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-sym-panel-width",
    label: "Panel width (mm)",
    value: sym.panelWidth,
    onChange: v => setSym(s => ({
      ...s,
      panelWidth: v
    })),
    step: 10
  }))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement(LayoutPanel, {
    layout: layout,
    result: result,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType,
    isBest: false
  })));
}
function SheetSurfaceLayout({
  sh,
  setSh
}) {
  const {
    W,
    H,
    PPi,
    PLa,
    offset,
    direction,
    minJ,
    startOff,
    s4Long,
    s4Short
  } = sh;
  const rowStart = sh.rowStart || "top";
  const [hoveredType, setHoveredType] = React.useState(null);
  const [materialOpen, setMaterialOpen] = React.useState(true);
  const [surfaceOpen, setSurfaceOpen] = React.useState(true);
  const [settingsOpen, setSettingsOpen] = React.useState(true);
  const set = k => v => setSh(s => ({
    ...s,
    [k]: v
  }));
  const setS2PanelState = patch => setSh(s => ({
    ...s,
    offset: patch.offset !== undefined ? patch.offset : s.offset
  }));
  const setS4PanelState = patch => setSh(s => ({
    ...s,
    s4Long: patch.s4Long !== undefined ? patch.s4Long : s.s4Long,
    s4Short: patch.s4Short !== undefined ? patch.s4Short : s.s4Short
  }));
  const stateGetters = {
    s1: () => ({}),
    s2: () => ({
      offset
    }),
    s3: () => ({}),
    s4: () => ({
      s4Long,
      s4Short
    })
  };
  const stateSetters = {
    s1: () => {},
    s2: setS2PanelState,
    s3: () => {},
    s4: setS4PanelState
  };
  const layoutRegistry = LAYOUT_REGISTRY.map(sys => ({
    ...sys,
    description: getDescription(sys.id, sh),
    defaultOpen: false,
    getState: stateGetters[sys.id] || (() => ({})),
    setState: stateSetters[sys.id] || (() => {}),
    compute: () => sys.compute(sh)
  }));
  const panelResults = layoutRegistry.map(layout => ({
    layout,
    result: layout.compute()
  }));
  const panelResultsById = panelResults.reduce((acc, p) => {
    acc[p.layout.id] = p;
    return acc;
  }, {});
  const comparableResults = panelResults.filter(p => p.layout.includeInBest && p.result.valid);
  const best = comparableResults.length ? Math.min(...comparableResults.map(p => p.result.stats.total)) : 0;
  if (W <= 0 || H <= 0 || PPi <= 0 || PLa <= 0) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      id: "data-control",
      className: "data-control"
    }, /*#__PURE__*/React.createElement(SLabel, null, "Material Specification"), /*#__PURE__*/React.createElement(NumInput, {
      id: "input-PPi",
      label: "Length (mm)",
      value: Math.max(1, PPi),
      onChange: set("PPi"),
      step: 10
    }), /*#__PURE__*/React.createElement(NumInput, {
      id: "input-PLa",
      label: "Width (mm)",
      value: Math.max(1, PLa),
      onChange: set("PLa"),
      step: 10
    }), /*#__PURE__*/React.createElement(SLabel, null, "Surface Area"), /*#__PURE__*/React.createElement(NumInput, {
      id: "input-W",
      label: "Width (mm)",
      value: Math.max(1, W),
      onChange: set("W"),
      step: 10
    }), /*#__PURE__*/React.createElement(NumInput, {
      id: "input-H",
      label: "Height (mm)",
      value: Math.max(1, H),
      onChange: set("H"),
      step: 10
    })), /*#__PURE__*/React.createElement("div", {
      id: "data-preview",
      className: "data-preview"
    }, /*#__PURE__*/React.createElement("p", {
      className: "desc"
    }, "Select all input values - all must be greater than 0!")));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-material",
    title: "Material Specification",
    open: materialOpen,
    setOpen: setMaterialOpen
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-PPi",
    label: "Length (mm)",
    value: PPi,
    onChange: set("PPi"),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-PLa",
    label: "Width (mm)",
    value: PLa,
    onChange: set("PLa"),
    step: 10
  })), /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-surface",
    title: "Surface Area",
    open: surfaceOpen,
    setOpen: setSurfaceOpen
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-W",
    label: "Width (mm)",
    value: W,
    onChange: set("W"),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-H",
    label: "Height (mm)",
    value: H,
    onChange: set("H"),
    step: 10
  })), /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-settings",
    title: "Settings",
    open: settingsOpen,
    setOpen: setSettingsOpen
  }, /*#__PURE__*/React.createElement("div", {
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Direction"), /*#__PURE__*/React.createElement("div", {
    id: "ctrl-direction",
    className: "ctrl-btns"
  }, ["V", "H"].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    className: "ctrl-dir " + (direction === s ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      direction: s
    }))
  }, s)))), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Row order"), /*#__PURE__*/React.createElement("div", {
    id: "ctrl-row-order",
    className: "ctrl-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (rowStart === "top" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      rowStart: "top"
    }))
  }, "R1 top"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (rowStart === "bottom" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      rowStart: "bottom"
    }))
  }, "R1 bottom"))), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-minJ",
    label: "Min remainder (mm)",
    value: minJ,
    onChange: set("minJ"),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-startOff",
    label: "R1 start point (mm)",
    value: startOff,
    onChange: v => setSh(s => ({
      ...s,
      startOff: Math.min(v, Math.max(1, PPi) - 1)
    })),
    step: 10,
    min: 0
  }))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement(PreviewSection, {
    id: "pattern-layouts",
    title: "Pattern Layouts",
    description: "Compare row-based layouts that share the same surface and material settings."
  }, ["s1", "s2", "s3", "s4"].map(id => {
    const panel = panelResultsById[id];
    if (!panel) return null;
    return /*#__PURE__*/React.createElement(LayoutPanel, {
      key: id,
      layout: panel.layout,
      result: panel.result,
      hoveredType: hoveredType,
      setHoveredType: setHoveredType,
      rowStart: rowStart,
      isBest: panel.layout.includeInBest && panel.result.valid && panel.result.stats.total === best
    });
  }))));
}
// ── Navigation ────────────────────────────────────────────────────────────────

function isNavPageActive(page, pg) {
  const childActive = PAGES.some(p => p.parentId === pg.id && p.id === page);
  return page === pg.id && !childActive;
}
function NavButton({
  page,
  item,
  navOpen,
  setPage,
  openGroups,
  setOpenGroups,
  onKeyNav
}) {
  const isGroup = item.isParent === true;
  const hasChildren = PAGES.some(pg => pg.parentId === item.id);
  const isOpen = isGroup && hasChildren && !!openGroups[item.id];
  const childActive = isGroup && PAGES.some(pg => pg.parentId === item.id && pg.id === page);
  const isActive = isNavPageActive(page, item);
  const isGroupActive = isGroup && hasChildren && isOpen && (page === "home" || childActive);
  const classes = ["nav-btn"];
  if (isActive || isGroupActive) classes.push("active");
  if (isGroup) classes.push("nav-parent");
  if (childActive) classes.push("child-active");
  if (item.parentId) classes.push("nav-sub-btn");
  if (!navOpen) classes.push("nav-btn-icon-only");
  const toggleGroup = () => {
    setOpenGroups(prev => ({
      ...prev,
      [item.id]: !prev[item.id]
    }));
    setPage("home");
  };
  const handleClick = () => {
    if (isGroup && hasChildren) toggleGroup();else setPage(item.id);
  };
  const handleKeyDown = e => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        handleClick();
        break;
      case "ArrowDown":
        e.preventDefault();
        onKeyNav("next");
        break;
      case "ArrowUp":
        e.preventDefault();
        onKeyNav("prev");
        break;
      case "ArrowRight":
        e.preventDefault();
        if (isGroup && hasChildren && !isOpen) setOpenGroups(prev => ({
          ...prev,
          [item.id]: true
        }));else onKeyNav("next");
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (isGroup && hasChildren && isOpen) setOpenGroups(prev => ({
          ...prev,
          [item.id]: false
        }));else onKeyNav("parent");
        break;
      case "Escape":
        e.preventDefault();
        if (isGroup && hasChildren) setOpenGroups(prev => ({
          ...prev,
          [item.id]: false
        }));
        break;
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "nav-btn-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: classes.join(" "),
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    "aria-current": isActive ? "page" : undefined,
    "aria-expanded": isGroup && hasChildren ? isOpen : undefined,
    "aria-haspopup": isGroup && hasChildren ? "true" : undefined,
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-btn-icon"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: item.icon
  })), /*#__PURE__*/React.createElement("span", {
    className: "nav-btn-label"
  }, item.label), isGroup && hasChildren && /*#__PURE__*/React.createElement("span", {
    className: "nav-parent-chevron " + (isOpen ? "open" : "closed")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isOpen ? "chevron-down" : "chevron-right"
  })), /*#__PURE__*/React.createElement("span", {
    className: "nav-tooltip"
  }, item.label)));
}
function AppNav({
  page,
  setPage,
  navOpen,
  setNavOpen,
  mobileMenuOpen,
  setMobileMenuOpen
}) {
  const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const showSubs = mobile ? mobileMenuOpen : navOpen;
  const navRef = React.useRef(null);

  // Per-parent open state — keyed by parent id
  // Initialize all parents with children as open
  const initOpenGroups = () => PAGES.reduce((acc, pg) => {
    if (pg.isParent && PAGES.some(p => p.parentId === pg.id)) acc[pg.id] = true;
    return acc;
  }, {});
  const [openGroups, setOpenGroups] = React.useState(initOpenGroups);

  // Auto-open parent when navigating to a child
  React.useEffect(() => {
    const currentPage = PAGES.find(pg => pg.id === page);
    if (currentPage && currentPage.parentId) {
      setOpenGroups(prev => ({
        ...prev,
        [currentPage.parentId]: true
      }));
    }
  }, [page]);
  const navItems = PAGES.filter(pg => {
    if (pg.noNav) return false;
    if (!showSubs && pg.parentId) {
      // In collapsed mode show sub-items only if their parent is open
      return !!openGroups[pg.parentId];
    }
    // In expanded mode hide sub-items if their parent is closed
    if (pg.parentId && !openGroups[pg.parentId]) return false;
    return true;
  });
  const handleToggle = () => mobile ? setMobileMenuOpen(o => !o) : setNavOpen(o => !o);
  const handleKeyNav = direction => {
    if (!navRef.current) return;
    const btns = Array.from(navRef.current.querySelectorAll(".nav-btn"));
    const current = document.activeElement;
    const idx = btns.indexOf(current);
    if (direction === "next" && idx < btns.length - 1) btns[idx + 1].focus();
    if (direction === "prev" && idx > 0) btns[idx - 1].focus();
    if (direction === "parent") {
      const parentBtn = btns.find(b => b.classList.contains("nav-parent"));
      if (parentBtn) parentBtn.focus();
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    id: "page-side",
    className: "page-side"
  }, /*#__PURE__*/React.createElement("nav", {
    id: "side-navi",
    ref: navRef,
    className: "nav" + (!mobile && !navOpen ? " nav-collapsed" : ""),
    role: "navigation",
    "aria-label": "Main navigation"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-section nav-toggle"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-toggle-label",
    onClick: () => setPage("home"),
    role: "button",
    tabIndex: 0,
    onKeyDown: e => (e.key === "Enter" || e.key === " ") && setPage("home")
  }, "HIVE"), /*#__PURE__*/React.createElement("span", {
    className: "nav-menu-icon",
    onClick: handleToggle,
    role: "button",
    tabIndex: 0,
    "aria-label": navOpen ? "Collapse sidebar" : "Expand sidebar",
    onKeyDown: e => (e.key === "Enter" || e.key === " ") && handleToggle()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "panel-left-close"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "nav-items",
    role: "menubar",
    "aria-orientation": "vertical"
  }, navItems.map(item => /*#__PURE__*/React.createElement(NavButton, {
    key: item.id,
    page: page,
    item: item,
    navOpen: mobile ? mobileMenuOpen : navOpen,
    setPage: id => {
      setPage(id);
      if (mobile) setMobileMenuOpen(false);
    },
    openGroups: openGroups,
    setOpenGroups: setOpenGroups,
    onKeyNav: handleKeyNav
  }))), /*#__PURE__*/React.createElement("div", {
    className: "nav-bottom",
    role: "menubar",
    "aria-orientation": "vertical"
  })));
}
// ── App root ──────────────────────────────────────────────────────────────────

// Read page id from URL hash, fallback to "home"
const getHashPage = () => {
  const hash = window.location.hash.replace("#", "");
  return PAGES.some(p => p.id === hash) ? hash : "home";
};
function MainPageContent({
  page,
  setPage,
  sh,
  setSh,
  sym,
  setSym
}) {
  const pageMeta = PAGES.find(pg => pg.id === page);
  if (page === "home") {
    return /*#__PURE__*/React.createElement("div", {
      id: "page-home",
      className: "page-main-full"
    }, /*#__PURE__*/React.createElement(SheetHome, {
      page: page,
      setPage: setPage
    }));
  }
  if (page === "concrete") {
    return /*#__PURE__*/React.createElement("div", {
      id: "main-data",
      className: "main-data"
    }, /*#__PURE__*/React.createElement(SheetConcrete, null));
  }
  if (page === "area") {
    return /*#__PURE__*/React.createElement("div", {
      id: "page-area",
      className: "page-scroll"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, pageMeta?.title || "Area"), /*#__PURE__*/React.createElement(SheetArea, {
      sh: sh
    }));
  }
  if (pageMeta) {
    const content = page === "symmetric-layout" ? /*#__PURE__*/React.createElement(SheetSymmetricLayout, {
      sym: sym,
      setSym: setSym
    }) : /*#__PURE__*/React.createElement(SheetSurfaceLayout, {
      sh: sh,
      setSh: setSh
    });
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      id: "main-head",
      className: "main-head"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, pageMeta.title || pageMeta.label), /*#__PURE__*/React.createElement("p", {
      className: "desc"
    }, pageMeta.desc)), /*#__PURE__*/React.createElement("div", {
      id: "main-data",
      className: "main-data"
    }, content));
  }
  return null;
}
function App() {
  const [page, setPageState] = useState(getHashPage);
  const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;
  const [navOpen, setNavOpen] = React.useState(!isMobile());
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Sync page state with URL hash
  const setPage = id => {
    if (id === "home") {
      history.pushState(null, "", window.location.pathname);
    } else {
      history.pushState(null, "", "#" + id);
    }
    setPageState(id);
  };

  // Handle browser back/forward
  React.useEffect(() => {
    const onPop = () => setPageState(getHashPage());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  React.useEffect(() => {
    const handler = () => {
      if (!isMobile()) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [sh, setSh] = useState(DEFAULT_SH);
  const [sym, setSym] = useState(DEFAULT_SYM);
  return /*#__PURE__*/React.createElement("div", {
    id: "app",
    className: "app"
  }, /*#__PURE__*/React.createElement("div", {
    id: "app-head",
    className: "app-head"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "header-logo",
    id: "Layer_1",
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 410.86 63.9"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "logo-grad",
    x1: "0%",
    y1: "0%",
    x2: "100%",
    y2: "0%"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    style: {
      stopColor: "var(--color-primary)",
      stopOpacity: "0.6"
    }
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    style: {
      stopColor: "var(--color-primary)",
      stopOpacity: "1"
    }
  })), /*#__PURE__*/React.createElement("style", null, ".cls-1 { fill: url(#logo-grad); stroke: var(--color-primary); stroke-miterlimit: 10; stroke-width: .25px; }")), /*#__PURE__*/React.createElement("polygon", {
    className: "cls-1",
    points: "139.77 17.47 124.34 36.01 109.47 17.34 109.33 45.2 103.74 45.47 103.78 1.73 124.43 26.68 145.78 1.24 146.04 45.35 140.11 45.17 139.77 17.47"
  }), /*#__PURE__*/React.createElement("path", {
    className: "cls-1",
    d: "M298.6,23.64c0,12.05-9.77,21.82-21.82,21.82s-21.82-9.77-21.82-21.82,9.77-21.82,21.82-21.82,21.82,9.77,21.82,21.82ZM292.72,23.54c0-8.83-7.16-15.99-15.99-15.99s-15.99,7.16-15.99,15.99,7.16,15.99,15.99,15.99,15.99-7.16,15.99-15.99Z"
  }), /*#__PURE__*/React.createElement("polygon", {
    className: "cls-1",
    points: "34.23 46.06 5.83 15.34 5.61 45.44 .13 45.39 .22 .83 28.71 31.46 28.84 2.64 34.28 2.68 34.23 46.06"
  }), /*#__PURE__*/React.createElement("path", {
    className: "cls-1",
    d: "M77.95,20.88c.63,1.15.57,3.5.25,5.35l-15.41.14.04,13.59h20.13c.37,1.36.45,3.51.35,5.38l-26.47-.07-.04-42.69,25.74-.05.05,5.46-19.91.03.13,12.72c2.58-.23,4.57-.29,7.08-.19l8.08.33Z"
  }), /*#__PURE__*/React.createElement("path", {
    className: "cls-1",
    d: "M188.78,20.77l.05,5.6-15.54-.03-.02,13.58,19.81.04.23,5.41-25.52.02-.06-42.84,25.22-.02-.04,5.5-19.6.02.05,12.67c3.4-.19,5.96-.28,9.01-.18l6.42.22Z"
  }), /*#__PURE__*/React.createElement("polygon", {
    className: "cls-1",
    points: "353.08 45.8 323.34 14.85 323.22 45.43 317.7 45.27 317.73 .31 347.49 31.92 347.38 2.79 353.21 2.64 353.08 45.8"
  }), /*#__PURE__*/React.createElement("polygon", {
    className: "cls-1",
    points: "391.02 14.13 377.36 45.29 370.64 45.12 391.01 .77 410.67 45.08 404.24 45.3 391.02 14.13"
  }), /*#__PURE__*/React.createElement("polygon", {
    className: "cls-1",
    points: "228.58 45.3 222.92 45.41 222.92 8.13 210.46 8.01 210.74 2.51 240.7 2.52 240.71 8.06 228.79 8.06 228.58 45.3"
  }), /*#__PURE__*/React.createElement("rect", {
    className: "cls-1",
    x: ".13",
    y: "57.59",
    width: "174.77",
    height: "1.36"
  }), /*#__PURE__*/React.createElement("rect", {
    className: "cls-1",
    x: "235.9",
    y: "56.91",
    width: "174.77",
    height: "1.36"
  }))), /*#__PURE__*/React.createElement("div", {
    id: "app-page",
    className: "app-page"
  }, /*#__PURE__*/React.createElement(AppNav, {
    page: page,
    setPage: setPage,
    navOpen: navOpen,
    setNavOpen: setNavOpen,
    mobileMenuOpen: mobileMenuOpen,
    setMobileMenuOpen: setMobileMenuOpen
  }), /*#__PURE__*/React.createElement("div", {
    id: "page-main",
    className: "page-main"
  }, /*#__PURE__*/React.createElement(MainPageContent, {
    page: page,
    setPage: setPage,
    sh: sh,
    setSh: setSh,
    sym: sym,
    setSym: setSym
  }))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));

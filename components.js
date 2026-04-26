"use strict";

function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
  variant = "section",
  className = ""
}) {
  const [openLocal, setOpenLocal] = React.useState(true);
  const open = setOpenProp ? openProp : openLocal;
  const setOpen = setOpenProp ? setOpenProp : setOpenLocal;
  if (variant === "panel") {
    return /*#__PURE__*/React.createElement("div", {
      id: id,
      className: ["control-panel", className].filter(Boolean).join(" ")
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
  children,
  className = ""
}) => /*#__PURE__*/React.createElement(Collapsible, {
  id: id,
  title: title,
  open: open,
  setOpen: setOpen,
  variant: "panel",
  className: className
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

// Stable visual identity for id-driven cards (A/B/C... + tone buckets)
function getLinkedCardTone(id) {
  const key = String(id || "").toLowerCase();
  const tones = ["a", "b", "c", "d"];
  if (tones.includes(key)) return key;
  const hash = key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return tones[hash % tones.length];
}
function getLinkedCardMarker(id) {
  const match = String(id || "").toUpperCase().match(/[A-Z0-9]/);
  return match ? match[0] : "X";
}

// Reusable linked-card interaction:
// click control card -> matching preview card stays active
// click elsewhere -> clear active preview
function useLinkedCardHighlight(groupId) {
  const [activeId, setActiveId] = React.useState(null);
  React.useEffect(() => {
    const onGlobalPointerDown = e => {
      if (e.target.closest(`[data-link-group="${groupId}"][data-link-role="control"]`)) return;
      setActiveId(null);
    };
    window.addEventListener("pointerdown", onGlobalPointerDown);
    return () => window.removeEventListener("pointerdown", onGlobalPointerDown);
  }, [groupId]);
  const bindControl = id => ({
    "data-link-group": groupId,
    "data-link-role": "control",
    onPointerDown: () => setActiveId(id)
  });
  const isActive = id => activeId === id;
  return {
    activeId,
    setActiveId,
    bindControl,
    isActive
  };
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
    const segPalClasses = seg.type === "full" && seg.long !== undefined ? seg.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s : palClasses;
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
    }, "\uD83D\uDCA1 ", result.stats.cut === 0 ? "No panels are cut (perfect fit)." : result.stats.cut === 1 ? "1 edge piece is cut from a full panel (1 panel is cut)." : "Both edge pieces are cut from full panels (2 panels are cut)."));
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
      border: "1px solid var(--color-gray-light)"
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
  }, layout.description), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-count"
  }, result.stats.total, " pcs ", isBest ? /*#__PURE__*/React.createElement(Icon, {
    name: "best-badge"
  }) : "")), open && /*#__PURE__*/React.createElement("div", {
    className: "panel-body"
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
    })
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

// ── Timesheet utilities ───────────────────────────────────────────────────────
// Pure parse/format helpers — no DOM, no React. Safe to unit-test independently.

function parseTime(raw) {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim().replace(',', '.');
  let m;
  if (m = s.match(/^(\d{1,2})[:\.](\d{2})$/)) return +m[1] * 60 + +m[2];
  if (/^\d{3}$/.test(s)) return +s[0] * 60 + +s.slice(1);
  if (/^\d{4}$/.test(s)) return +s.slice(0, 2) * 60 + +s.slice(2);
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}
function parseLunch(raw) {
  // ".30" → 30 min (dot-prefix = minutes literal)
  if (!raw || !raw.trim()) return 0;
  let s = raw.trim();
  let m;
  if (m = s.match(/^\.(\d+)$/)) return +m[1];
  s = s.replace(',', '.');
  if (m = s.match(/^(\d{1,2})[:\.](\d{2})$/)) return +m[1] * 60 + +m[2];
  if (/^\d{3}$/.test(s)) return +s[0] * 60 + +s.slice(1);
  if (/^\d{4}$/.test(s)) return +s.slice(0, 2) * 60 + +s.slice(2);
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}
function roundMins(mins, to) {
  return to ? Math.round(mins / to) * to : mins;
}
// Formats as H:MM (e.g. 8:05 not 8:5)
function fmtHHMM(mins) {
  return Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0');
}
// Rounds to nearest quarter hour: .00 / .25 / .50 / .75
function fmtDecimal(mins) {
  return (Math.round(mins / 60 * 4) / 4).toFixed(2);
}

// ── SheetTimesheet ────────────────────────────────────────────────────────────

const LUNCH_PRESETS = [['15 min', '.15'], ['20 min', '.20'], ['30 min', '.30'], ['45 min', '.45'], ['1 h', '1:00']];
function makeCalcRows() {
  return [1, 2, 3].map(id => ({
    id,
    start: '',
    end: '',
    lunch: ''
  }));
}
function calcRowResult(row) {
  const s = parseTime(row.start);
  const e = parseTime(row.end);
  const lunch = parseLunch(row.lunch);
  const hasInput = row.start.trim() || row.end.trim();
  if (!hasInput) return {
    dur: '',
    dec: '',
    status: 'empty',
    mins: 0
  };
  if (s !== null && e !== null) {
    if (lunch === null) return {
      dur: 'invalid lunch',
      dec: '',
      status: 'error',
      mins: 0
    };
    let diff = e - s;
    if (diff < 0) diff += 24 * 60; // overnight support
    if (lunch > diff) return {
      dur: 'lunch > work',
      dec: '',
      status: 'warn',
      mins: 0
    };
    diff -= lunch;
    return {
      dur: fmtHHMM(diff),
      dec: fmtDecimal(diff),
      status: 'ok',
      mins: diff
    };
  }
  const badStart = row.start.trim() && s === null;
  const badEnd = row.end.trim() && e === null;
  if (badStart || badEnd) return {
    dur: 'invalid',
    dec: '',
    status: 'error',
    mins: 0
  };
  return {
    dur: '',
    dec: '',
    status: 'partial',
    mins: 0
  };
}
function SheetTimesheet() {
  const [calcRows, setCalcRows] = useState(makeCalcRows);
  const [activeRowId, setActiveRowId] = useState(null);
  const [copied, setCopied] = useState(false);
  const nextCalcId = React.useRef(4);
  const startRefs = React.useRef({});

  // ── Derived ────────────────────────────────────────────────────────────────

  const calcResults = calcRows.map(r => calcRowResult(r));
  const calcTotalMins = calcResults.reduce((s, r) => s + r.mins, 0);
  const hasCalcTotal = calcResults.some(r => r.status === 'ok');

  // ── Calc actions ───────────────────────────────────────────────────────────

  const addCalcRow = () => {
    const id = nextCalcId.current++;
    setCalcRows(prev => [...prev, {
      id,
      start: '',
      end: '',
      lunch: ''
    }]);
    return id;
  };
  const removeCalcRow = id => setCalcRows(prev => prev.filter(r => r.id !== id));
  const updateCalcRow = (id, field, value) => setCalcRows(prev => prev.map(r => r.id === id ? {
    ...r,
    [field]: value
  } : r));
  const clearCalc = () => {
    nextCalcId.current = 4;
    setCalcRows(makeCalcRows());
    setActiveRowId(null);
  };
  const applyLunchPreset = val => {
    if (activeRowId != null) updateCalcRow(activeRowId, 'lunch', val);
  };

  // Format time input to HH:MM on blur
  const formatTimeInput = (id, field, value) => {
    if (field === 'lunch') return; // lunch uses .MM format, don't convert
    const parsed = parseTime(value);
    if (parsed !== null && value.trim()) {
      updateCalcRow(id, field, fmtHHMM(parsed));
    }
  };

  // Tab from Lunch → next row Start; auto-adds row if on last
  const handleLunchTab = (e, rowIdx) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const nextRow = calcRows[rowIdx + 1];
    if (nextRow) {
      startRefs.current[nextRow.id]?.focus();
    } else {
      const newId = nextCalcId.current++;
      setCalcRows(prev => [...prev, {
        id: newId,
        start: '',
        end: '',
        lunch: ''
      }]);
      setTimeout(() => startRefs.current[newId]?.focus(), 0);
    }
  };

  // ── Copy ───────────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!hasCalcTotal) return;
    navigator.clipboard.writeText(fmtDecimal(calcTotalMins)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return /*#__PURE__*/React.createElement("div", {
    className: "ts-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ts-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ts-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ts-tab ts-tab--on"
  }, "Calculate hours")), /*#__PURE__*/React.createElement("div", {
    className: "ts-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ts-grid-hd"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts-col-lbl"
  }, "Start"), /*#__PURE__*/React.createElement("span", {
    className: "ts-col-lbl"
  }, "End"), /*#__PURE__*/React.createElement("span", {
    className: "ts-col-lbl"
  }, "Lunch"), /*#__PURE__*/React.createElement("span", {
    className: "ts-col-lbl"
  }, "Duration"), /*#__PURE__*/React.createElement("span", {
    className: "ts-col-lbl ts-col-dec"
  }, "Decimal"), /*#__PURE__*/React.createElement("span", null)), calcRows.map((row, idx) => {
    const res = calcResults[idx];
    return /*#__PURE__*/React.createElement("div", {
      key: row.id,
      className: "ts-grid-row" + (row.id === activeRowId ? " ts-grid-row--active" : "")
    }, /*#__PURE__*/React.createElement("input", {
      className: "num-input ts-input",
      type: "text",
      placeholder: "9, 9:30, 0930",
      value: row.start,
      ref: el => {
        startRefs.current[row.id] = el;
      },
      onFocus: () => setActiveRowId(row.id),
      onChange: e => updateCalcRow(row.id, 'start', e.target.value),
      onBlur: e => formatTimeInput(row.id, 'start', e.target.value)
    }), /*#__PURE__*/React.createElement("input", {
      className: "num-input ts-input",
      type: "text",
      placeholder: "17, 17:30",
      value: row.end,
      onFocus: () => setActiveRowId(row.id),
      onChange: e => updateCalcRow(row.id, 'end', e.target.value),
      onBlur: e => formatTimeInput(row.id, 'end', e.target.value)
    }), /*#__PURE__*/React.createElement("input", {
      className: "num-input ts-input",
      type: "text",
      placeholder: ".30",
      value: row.lunch,
      onFocus: () => setActiveRowId(row.id),
      onKeyDown: e => handleLunchTab(e, idx),
      onChange: e => updateCalcRow(row.id, 'lunch', e.target.value)
    }), /*#__PURE__*/React.createElement("div", {
      className: "ts-duration" + (res.status === 'error' ? " ts-duration--error" : res.status === 'warn' ? " ts-duration--warn" : "")
    }, res.dur), /*#__PURE__*/React.createElement("div", {
      className: "ts-decimal ts-col-dec"
    }, res.dec), /*#__PURE__*/React.createElement("button", {
      className: "num-btn ts-remove",
      tabIndex: -1,
      onClick: () => removeCalcRow(row.id)
    }, "\xD7"));
  }), /*#__PURE__*/React.createElement("div", {
    className: "ts-pills"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts-pill-lbl"
  }, "Lunch:"), LUNCH_PRESETS.map(([label, val]) => /*#__PURE__*/React.createElement("button", {
    key: val,
    className: "ts-pill",
    onClick: () => applyLunchPreset(val)
  }, label))), /*#__PURE__*/React.createElement("div", {
    className: "ts-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ts-btn",
    onClick: addCalcRow
  }, "+ Add row"), /*#__PURE__*/React.createElement("button", {
    className: "ts-btn ts-btn--muted",
    onClick: clearCalc
  }, "Clear all")), /*#__PURE__*/React.createElement("div", {
    className: "ts-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts-total-lbl"
  }, "Total"), /*#__PURE__*/React.createElement("div", {
    className: "ts-total-vals"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ts-total-val"
  }, fmtHHMM(calcTotalMins)), /*#__PURE__*/React.createElement("span", {
    className: "ts-total-dec"
  }, "= ", fmtDecimal(calcTotalMins)), /*#__PURE__*/React.createElement("button", {
    className: "ts-copy" + (copied ? " ts-copy--done" : ""),
    onClick: handleCopy
  }, copied ? 'Copied!' : 'Copy decimal'))))));
}
const PRESETS = [100, 125, 160, 200];
function PipeWrapCalculator() {
  const [pipeDiam, setPipeDiam] = React.useState(100);
  const [matThick, setMatThick] = React.useState(50);
  const [overlap, setOverlap] = React.useState(0);
  const [gap, setGap] = React.useState(0);
  const svgRef = React.useRef(null);
  const outer = pipeDiam + 2 * matThick;
  const base = Math.PI * outer;
  const total = Math.max(0, base + overlap - gap);
  React.useEffect(() => {
    drawDiagram();
  }, [pipeDiam, matThick, overlap, gap]);
  function drawDiagram() {
    const svg = svgRef.current;
    if (!svg) return;
    const cx = 100,
      cy = 90,
      maxR = 72;
    const totalR_mm = pipeDiam / 2 + matThick || 1;
    // Lower reference radius = more "zoom" for smaller pipes
    const refR_mm = 110;
    const scale = maxR / Math.max(refR_mm, totalR_mm);
    const rP = pipeDiam / 2 * scale;
    const rO = totalR_mm * scale;
    const gapAngle = outer > 0 ? gap / (Math.PI * outer) * Math.PI * 2 : 0;
    const overAngle = outer > 0 ? overlap / (Math.PI * outer) * Math.PI * 2 : 0;
    const arc = (r, startA, endA) => {
      const x1 = cx + r * Math.cos(startA),
        y1 = cy + r * Math.sin(startA);
      const x2 = cx + r * Math.cos(endA),
        y2 = cy + r * Math.sin(endA);
      const lg = endA - startA > Math.PI ? 1 : 0;
      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
    };
    let ty = 28;
    const lines = [`<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-gray-opa80)">` + `π × (${pipeDiam} + 2×${matThick}) = ${base.toFixed(1)} mm</text>`];
    if (overlap > 0) {
      ty += 20;
      lines.push(`<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-blue)">` + `+ overlap  ${overlap} mm</text>`);
    }
    if (gap > 0) {
      ty += 20;
      lines.push(`<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-gray-opa80)">` + `− gap  ${gap} mm</text>`);
    }
    ty += 22;
    lines.push(`<text x="230" y="${ty}" style="font-family:var(--mono);font-size:14px;font-weight:700;fill:var(--color-primary)">` + `= ${total.toFixed(1)} mm</text>`);
    const cmResult = `
      <g transform="translate(230, 155)">
        <rect x="-8" y="-22" width="120" height="30" rx="6" 
          fill="color-mix(in srgb, var(--color-primary) 8%, transparent)"
          stroke="color-mix(in srgb, var(--color-primary) 20%, transparent)"
          stroke-width="0.5" />
        <text x="8" y="2" style="font-family:var(--mono);font-size:22px;font-weight:800;fill:var(--color-primary)">
          ${(total / 10).toFixed(1)} cm
        </text>
      </g>
    `;
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${rO}"
        fill="color-mix(in srgb, var(--color-gray-light) 80%, transparent)"
        stroke="var(--color-gray)" stroke-width="0.5"/>

      ${gap > 0 ? `<path d="${arc(rO, -Math.PI / 2, -Math.PI / 2 + gapAngle)}"
        fill="color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)"
        stroke="var(--color-gray)" stroke-width="0.5"/>` : ""}

      ${overlap > 0 ? `<path d="${arc(rO, -Math.PI / 2 + gapAngle, -Math.PI / 2 + gapAngle + overAngle)}"
        fill="color-mix(in srgb, var(--color-blue) 35%, transparent)"
        stroke="var(--color-blue)" stroke-width="0.5" opacity="0.9"/>` : ""}

      <circle cx="${cx}" cy="${cy}" r="${rP}"
        fill="var(--color-darkblue)"
        stroke="var(--color-gray)" stroke-width="0.5"/>

      <text x="${cx}" y="${cy - 4}"
        style="font-family:var(--mono);font-size:9px;fill:var(--color-gray-opa80)"
        text-anchor="middle">pipe</text>
      <text x="${cx}" y="${cy + 8}"
        style="font-family:var(--mono);font-size:9px;fill:var(--color-gray-opa80)"
        text-anchor="middle">Ø${pipeDiam}mm</text>

      ${lines.join("\n")}
      ${cmResult}

      ${gap > 0 ? `
        <rect x="230" y="${ty + 14}" width="9" height="9" rx="2"
          fill="color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)"
          stroke="var(--color-gray)" stroke-width="0.5"/>
        <text x="243" y="${ty + 22}"
          style="font-family:var(--mono);font-size:10px;fill:var(--color-gray-opa80)">gap</text>
      ` : ""}
      ${overlap > 0 ? `
        <rect x="230" y="${ty + (gap > 0 ? 30 : 14)}" width="9" height="9" rx="2"
          fill="color-mix(in srgb, var(--color-blue) 35%, transparent)"
          stroke="var(--color-blue)" stroke-width="0.5"/>
        <text x="243" y="${ty + (gap > 0 ? 38 : 22)}"
          style="font-family:var(--mono);font-size:10px;fill:var(--color-blue)">overlap</text>
      ` : ""}
    `;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "page-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "main-head",
    style: {
      padding: "0 0 0",
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "title"
  }, "Pipe wrap calculator"), /*#__PURE__*/React.createElement("div", {
    className: "desc"
  }, "Material length needed to wrap around a pipe")), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Dimensions")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-pad"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "num-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "num-lbl"
  }, "Pipe outer diameter"), /*#__PURE__*/React.createElement("div", {
    className: "num-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "num-input",
    value: pipeDiam,
    min: 1,
    step: 1,
    onChange: e => setPipeDiam(Math.max(1, Number(e.target.value)))
  }), /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit",
    style: {
      display: "flex",
      alignItems: "center",
      marginLeft: 6
    }
  }, "mm"))), /*#__PURE__*/React.createElement("div", {
    className: "num-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "num-lbl"
  }, "Material thickness"), /*#__PURE__*/React.createElement("div", {
    className: "num-row"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    className: "num-input",
    value: matThick,
    min: 0,
    step: 1,
    onChange: e => setMatThick(Math.max(0, Number(e.target.value)))
  }), /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit",
    style: {
      display: "flex",
      alignItems: "center",
      marginLeft: 6
    }
  }, "mm")))), /*#__PURE__*/React.createElement("div", {
    className: "num-lbl",
    style: {
      marginBottom: 8
    }
  }, "Pipe diameter presets"), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-btns"
  }, PRESETS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: `ctrl-dir${pipeDiam === p ? " on" : ""}`,
    style: {
      flex: 1,
      padding: "6px 0",
      fontSize: "var(--fs-md)"
    },
    onClick: () => setPipeDiam(p)
  }, "\xD8 ", p)))))), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Adjustments")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-pad"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOverlap(prev => Math.min(200, prev + 5)),
    style: {
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      background: "color-mix(in srgb, var(--color-blue) 18%, transparent)",
      color: "var(--color-blue)",
      border: "1px solid color-mix(in srgb, var(--color-blue) 45%, transparent)",
      borderRadius: 4,
      padding: "1px 7px",
      flexShrink: 0,
      width: 22,
      textAlign: "center",
      cursor: "pointer"
    }
  }, "+"), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl",
    style: {
      width: 160,
      flexShrink: 0
    }
  }, "Overlap / extra (mm)"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 200,
    step: 5,
    value: overlap,
    style: {
      flex: 1
    },
    onChange: e => setOverlap(Number(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-range-val",
    style: {
      minWidth: 36,
      textAlign: "right"
    }
  }, overlap)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setGap(prev => Math.min(200, prev + 5)),
    style: {
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      background: "color-mix(in srgb, var(--color-gray-opa80) 18%, transparent)",
      color: "var(--color-gray-opa80)",
      border: "1px solid color-mix(in srgb, var(--color-gray-opa80) 45%, transparent)",
      borderRadius: 4,
      padding: "1px 7px",
      flexShrink: 0,
      width: 22,
      textAlign: "center",
      cursor: "pointer"
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl",
    style: {
      width: 160,
      flexShrink: 0
    }
  }, "Gap / cutout (mm)"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 200,
    step: 5,
    value: gap,
    style: {
      flex: 1
    },
    onChange: e => setGap(Number(e.target.value))
  }), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-range-val",
    style: {
      minWidth: 36,
      textAlign: "right"
    }
  }, gap))))), /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Result")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: "1px solid var(--color-gray)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "data-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl"
  }, "Outer diameter"), /*#__PURE__*/React.createElement("span", {
    className: "data-row-val"
  }, outer.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit"
  }, "mm")), /*#__PURE__*/React.createElement("div", {
    className: "data-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl"
  }, "Base wrap length"), /*#__PURE__*/React.createElement("span", {
    className: "data-row-val"
  }, base.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit"
  }, "mm")), /*#__PURE__*/React.createElement("div", {
    className: "data-row",
    style: {
      borderBottom: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl"
  }, "Final length needed"), /*#__PURE__*/React.createElement("span", {
    className: "data-row-val hi"
  }, total.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "data-row-unit"
  }, "mm"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    ref: svgRef,
    viewBox: "0 0 420 180",
    width: "100%",
    style: {
      display: "block"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 16px 14px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      color: "var(--color-gray-opa80)"
    }
  }, "formula: \u03C0 \xD7 (pipe \xD8 + 2 \xD7 thickness) + overlap \u2212 gap"))))));
}

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
function SheetNewTool({
  grItems: baseItems,
  setGrItems: setBaseItems
}) {
  const [baseOpen, setBaseOpen] = React.useState(true);
  const link = useLinkedCardHighlight("golden-ratio");
  const PHI = 1.6180339887499;
  const setItemField = (id, key, value) => {
    setBaseItems(items => items.map(item => item.id === id ? {
      ...item,
      [key]: value
    } : item));
  };
  const saveItem = id => {
    setBaseItems(items => items.map(item => item.id === id ? {
      ...item,
      saved: {
        value: item.value,
        suffix: item.suffix
      },
      savedCommitted: true
    } : item));
  };
  const resetItem = id => {
    setBaseItems(items => items.map(item => item.id === id ? {
      ...item,
      value: "",
      suffix: "",
      savedCommitted: false
    } : item));
  };
  const commitBaseValue = id => {
    setBaseItems(items => items.map(item => {
      if (item.id !== id) return item;
      const raw = String(item.value ?? "").trim().replace(",", ".");
      if (raw === "") return {
        ...item,
        value: ""
      };
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1) return {
        ...item,
        value: ""
      };
      const rounded = Math.max(1, Math.round(n * 100) / 100);
      return {
        ...item,
        value: String(rounded)
      };
    }));
  };
  const buildSteps = base => {
    const rows = [];
    let value = base / PHI;
    for (let i = 1; i <= 7; i++) {
      rows.push({
        step: i,
        value
      });
      value = value / PHI;
    }
    return rows;
  };
  const fmtInt = v => Math.round(v).toString();
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-base-number",
    title: "Base Number",
    open: baseOpen,
    setOpen: setBaseOpen
  }, baseItems.map(item => {
    const tone = getLinkedCardTone(item.id);
    const trimmedSuffix = item.suffix.trim();
    const isStored = item.savedCommitted && item.value === item.saved.value && item.suffix === item.saved.suffix;
    const valueInputLabel = trimmedSuffix ? /*#__PURE__*/React.createElement(React.Fragment, null, "Value (mm) ", /*#__PURE__*/React.createElement("span", {
      className: "num-lbl-raw"
    }, trimmedSuffix)) : "Value (mm)";
    return /*#__PURE__*/React.createElement("div", _extends({
      key: item.id,
      id: `control-base-number-${item.id}`,
      className: `control-panel gr-control-card gr-control-card-${tone}${isStored ? " gr-card-saved" : ""}`
    }, link.bindControl(item.id)), /*#__PURE__*/React.createElement("div", {
      className: "panel-data"
    }, /*#__PURE__*/React.createElement("label", {
      id: `input-base-number-${item.id}`,
      className: "num-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "num-lbl"
    }, valueInputLabel), /*#__PURE__*/React.createElement("div", {
      className: "num-row"
    }, /*#__PURE__*/React.createElement("input", {
      id: `input-base-number-field-${item.id}`,
      className: "num-input",
      type: "number",
      value: item.value,
      min: 1,
      step: 10,
      onChange: e => setItemField(item.id, "value", e.target.value),
      onBlur: () => commitBaseValue(item.id)
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "num-btn",
      onClick: () => commitBaseValue(item.id)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "corner-down-left"
    })))), /*#__PURE__*/React.createElement("div", {
      className: "ctrl-lbl"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ctrl-sublbl"
    }, "Custom label"), /*#__PURE__*/React.createElement("div", {
      className: "num-row"
    }, /*#__PURE__*/React.createElement("input", {
      id: `input-base-label-suffix-${item.id}`,
      className: "num-input gr-label-input",
      type: "text",
      value: item.suffix,
      onChange: e => setItemField(item.id, "suffix", e.target.value),
      placeholder: "e.g. A, L, Start"
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "num-btn",
      onClick: () => {
        const input = document.getElementById(`input-base-label-suffix-${item.id}`);
        if (input instanceof HTMLInputElement) input.blur();
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "corner-down-left"
    })))), /*#__PURE__*/React.createElement("div", {
      className: "ctrl-lbl"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ctrl-sublbl"
    }, "Entry"), /*#__PURE__*/React.createElement("div", {
      className: "ctrl-btns"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ctrl-dir",
      onClick: () => saveItem(item.id)
    }, "Save"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "ctrl-dir",
      onClick: () => resetItem(item.id)
    }, "Reset")))));
  }))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gr-preview-list"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sys-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "golden-phi",
    className: "sys-title-icon"
  }), " Golden Ratio phi"), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, "phi = 1.6180339887499")), baseItems.map((item, idx) => {
    const tone = getLinkedCardTone(item.id);
    const trimmedSuffix = item.suffix.trim();
    const isStored = item.savedCommitted && item.value === item.saved.value && item.suffix === item.saved.suffix;
    const numericValue = Number(item.value);
    const hasValidValue = String(item.value).trim() !== "" && Number.isFinite(numericValue) && numericValue >= 1;
    const valueRowLabel = trimmedSuffix ? /*#__PURE__*/React.createElement(React.Fragment, null, "Value ", /*#__PURE__*/React.createElement("span", {
      className: "num-lbl-raw"
    }, trimmedSuffix)) : "Value";
    const steps = hasValidValue ? buildSteps(numericValue) : [];
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      id: `panel-golden-ratio-${item.id}`,
      className: `sys-block gr-preview-card gr-preview-card-${tone}${isStored ? " gr-card-saved" : ""}${link.isActive(item.id) ? " linked-preview-active" : ""}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "section-pad gr-section-pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "data-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "data-row-lbl"
    }, valueRowLabel), /*#__PURE__*/React.createElement("span", {
      className: "data-row-val hi"
    }, hasValidValue ? fmtInt(numericValue) : "-"), /*#__PURE__*/React.createElement("span", {
      className: "data-row-unit"
    }, "mm"), /*#__PURE__*/React.createElement("span", {
      className: "gr-row-marker"
    }, getLinkedCardMarker(item.id))), hasValidValue && /*#__PURE__*/React.createElement("div", {
      className: "gr-steps-wrap"
    }, steps.map((stepItem, stepIdx) => /*#__PURE__*/React.createElement("div", {
      key: stepItem.step,
      className: "gr-step-row" + (stepIdx === 0 ? " gr-step-row-first" : "")
    }, /*#__PURE__*/React.createElement("div", {
      className: "data-row gr-step-cell gr-step-cell-index"
    }, /*#__PURE__*/React.createElement("span", {
      className: "data-row-val"
    }, stepItem.step)), /*#__PURE__*/React.createElement("div", {
      className: "data-row gr-step-cell"
    }, /*#__PURE__*/React.createElement("span", {
      className: "data-row-val"
    }, fmtInt(stepItem.value))))))));
  }))));
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
  }), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Layout style"), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (sym.oneFullEdge ? "on" : ""),
    onClick: () => setSym(s => ({
      ...s,
      oneFullEdge: true
    }))
  }, "Asymmetric"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (!sym.oneFullEdge ? "on" : ""),
    onClick: () => setSym(s => ({
      ...s,
      oneFullEdge: false
    }))
  }, "Symmetric"))))), /*#__PURE__*/React.createElement("div", {
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
  const best = comparableResults.length ? Math.min(...comparableResults.map(p => p.result.stats.total)) : Infinity;
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
function initOpenGroups(isMob) {
  return PAGES.reduce((acc, pg) => {
    if (pg.isParent && PAGES.some(p => p.parentId === pg.id)) {
      acc[pg.id] = !isMob;
    }
    return acc;
  }, {});
}
function AppNav({
  page,
  setPage,
  navOpen,
  setNavOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
  isMobile
}) {
  const mobile = isMobile;
  const showSubs = mobile ? mobileMenuOpen : navOpen;
  const navRef = React.useRef(null);
  const [openGroups, setOpenGroups] = React.useState(() => initOpenGroups(mobile));

  // Reinitialize open groups when switching between mobile and desktop
  React.useEffect(() => {
    setOpenGroups(initOpenGroups(mobile));
  }, [mobile]);

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
    if (pg.noNav && pg.id !== "home") return false;
    if (mobile) {
      // Mobile closed state: show parent-level items only.
      if (!mobileMenuOpen) return !pg.parentId;
      // Mobile open state: show children only when their parent group is open.
      if (pg.parentId && !openGroups[pg.parentId]) return false;
      return true;
    }

    // Desktop collapsed mode: show sub-items only if their parent group is open.
    if (!showSubs && pg.parentId) return !!openGroups[pg.parentId];
    // Desktop expanded mode: hide sub-items when parent is closed.
    if (pg.parentId && !openGroups[pg.parentId]) return false;
    return true;
  });
  const handleToggle = () => {
    if (mobile) {
      setMobileMenuOpen(o => !o);
      return;
    }
    setNavOpen(o => !o);
  };
  const handleKeyNav = direction => {
    if (!navRef.current) return;
    const btns = Array.from(navRef.current.querySelectorAll(".nav-btn"));
    const current = document.activeElement;
    const idx = btns.indexOf(current);
    if (direction === "next" && idx < btns.length - 1) btns[idx + 1].focus();
    if (direction === "prev" && idx > 0) btns[idx - 1].focus();
    if (direction === "parent") {
      const parentBtn = btns.slice(0, idx).reverse().find(b => b.classList.contains("nav-parent"));
      if (parentBtn) parentBtn.focus();
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    id: "page-side",
    className: "page-side"
  }, /*#__PURE__*/React.createElement("nav", {
    id: "side-navi",
    ref: navRef,
    className: "nav" + (!mobile && !navOpen ? " nav-collapsed" : "") + (mobile && mobileMenuOpen ? " nav-mobile-open" : ""),
    role: "navigation",
    "aria-label": "Main navigation"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-section nav-toggle",
    role: "button",
    tabIndex: 0,
    onClick: () => {
      setPage("home");
      if (mobile) setMobileMenuOpen(false);
    },
    onKeyDown: e => (e.key === "Enter" || e.key === " ") && (setPage("home"), mobile && setMobileMenuOpen(false))
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-toggle-label"
  }, "HIVE"), /*#__PURE__*/React.createElement("span", {
    className: "nav-menu-icon",
    onClick: e => {
      e.stopPropagation();
      handleToggle();
    },
    role: "button",
    tabIndex: 0,
    "aria-label": mobile ? mobileMenuOpen ? "Close menu" : "Open menu" : navOpen ? "Collapse sidebar" : "Expand sidebar",
    onKeyDown: e => {
      e.stopPropagation();
      if (e.key === "Enter" || e.key === " ") handleToggle();
    }
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

/**
 * THEME DEFINITIONS
 * ─────────────────────────────────────────────────────────────
 * Define all themes here. Each theme is a map of CSS variable names
 * to color values. These are applied dynamically via document.documentElement.
 * 
 * To add a new theme:
 * 1. Add a new object below with a unique key
 * 2. Include all color variables you want to override
 * 3. The theme will automatically be available in the toggle button
 */

const THEMES = {
  navi: {
    name: 'navi',
    label: 'Navi',
    icon: '◇',
    colors: {
      '--color-darkblue': '#09101a',
      '--color-darkblue-light': '#131923',
      '--color-gray': '#506070',
      '--color-gray-light': '#233342',
      '--color-gray-opa80': '#73808d',
      '--color-blue': '#3d7a9e',
      '--color-white': '#fff'
    }
  },
  sharp: {
    name: 'sharp',
    label: 'Sharp',
    icon: '◆',
    colors: {
      '--color-darkblue': '#0c0d10',
      '--color-darkblue-light': '#13141a',
      '--color-gray': '#7e8088',
      '--color-gray-light': '#20222a',
      '--color-gray-opa80': '#585a62',
      '--color-blue': '#4a90c0',
      '--color-white': '#fff'
    }
  }

  // TEMPLATE FOR NEW THEMES:
  // themeName: {
  //   name: 'themeName',
  //   label: 'Display Label',
  //   icon: '✦',
  //   colors: {
  //     '--color-darkblue':       '#XXXXXX',
  //     '--color-darkblue-light': '#XXXXXX',
  //     '--color-gray':           '#XXXXXX',
  //     '--color-gray-light':     '#XXXXXX',
  //     '--color-gray-opa80':     '#XXXXXX',
  //     '--color-blue':           '#XXXXXX',
  //     '--color-white':          '#XXXXXX',
  //   },
  // },
};

/**
 * Get ordered list of theme names
 */
const getThemeOrder = () => Object.keys(THEMES);

/**
 * Get next theme in rotation
 */
const getNextTheme = currentTheme => {
  const themes = getThemeOrder();
  const currentIndex = themes.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % themes.length;
  return themes[nextIndex];
};

/**
 * Apply theme by name
 */
const applyTheme = themeName => {
  const theme = THEMES[themeName];
  if (!theme) {
    console.warn(`Theme "${themeName}" not found. Available themes:`, getThemeOrder());
    return;
  }

  // Apply colors to CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });

  // Store current theme for reference
  document.documentElement.setAttribute('data-theme', themeName);
};

// ── App root ──────────────────────────────────────────────────────────────────

const getIsMobile = () => typeof window !== "undefined" && (window.innerWidth <= 768 || window.innerHeight <= 500);

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
  setSym,
  grItems,
  setGrItems
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
  if (page === "timesheet") {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      id: "main-head",
      className: "main-head"
    }, /*#__PURE__*/React.createElement("h2", {
      className: "title"
    }, pageMeta?.title), /*#__PURE__*/React.createElement("p", {
      className: "desc"
    }, pageMeta?.desc)), /*#__PURE__*/React.createElement("div", {
      className: "page-main-full"
    }, /*#__PURE__*/React.createElement(SheetTimesheet, null)));
  }
  if (page === "golden-ratio") {
    return /*#__PURE__*/React.createElement("div", {
      id: "main-data",
      className: "main-data"
    }, /*#__PURE__*/React.createElement(SheetNewTool, {
      grItems: grItems,
      setGrItems: setGrItems
    }));
  }
  if (page === "pipe-wrap") {
    return /*#__PURE__*/React.createElement(PipeWrapCalculator, null);
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
const DEV_MODE = true;
function App() {
  const [page, setPageState] = useState(getHashPage);

  // Track mobile state reactively — updates on resize/rotate
  const [isMobile, setIsMobile] = React.useState(getIsMobile);
  const [navOpen, setNavOpen] = React.useState(!getIsMobile());
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [theme, setTheme] = useState("navi");

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

  // Handle resize and orientation changes
  React.useEffect(() => {
    const handler = () => {
      const nowMobile = getIsMobile();
      setIsMobile(nowMobile);
      if (!nowMobile) {
        setMobileMenuOpen(false);
        setNavOpen(true);
      } else {
        setMobileMenuOpen(false); // always close on rotate/resize within mobile
      }
    };
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, []);

  // Enter in any input commits by blurring the field (matches NumInput button intent)
  React.useEffect(() => {
    const onEnterCommit = e => {
      if (e.key !== "Enter") return;
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      e.preventDefault();
      target.blur();
    };
    window.addEventListener("keydown", onEnterCommit, true);
    return () => window.removeEventListener("keydown", onEnterCommit, true);
  }, []);
  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  const [sh, setSh] = useState(DEFAULT_SH);
  const [sym, setSym] = useState(DEFAULT_SYM);
  const [grItems, setGrItems] = useState(DEFAULT_GR);
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
    className: "app-page" + (mobileMenuOpen ? " nav-open" : "")
  }, /*#__PURE__*/React.createElement(AppNav, {
    page: page,
    setPage: setPage,
    navOpen: navOpen,
    setNavOpen: setNavOpen,
    mobileMenuOpen: mobileMenuOpen,
    setMobileMenuOpen: setMobileMenuOpen,
    isMobile: isMobile
  }), /*#__PURE__*/React.createElement("div", {
    id: "page-main",
    className: "page-main",
    onClick: () => mobileMenuOpen && setMobileMenuOpen(false)
  }, /*#__PURE__*/React.createElement(MainPageContent, {
    page: page,
    setPage: setPage,
    sh: sh,
    setSh: setSh,
    sym: sym,
    setSym: setSym,
    grItems: grItems,
    setGrItems: setGrItems
  }))), DEV_MODE && /*#__PURE__*/React.createElement("button", {
    onClick: () => setTheme(getNextTheme(theme)),
    style: {
      position: 'fixed',
      bottom: '12px',
      left: '12px',
      zIndex: 9999,
      fontSize: '10px',
      padding: '4px 10px',
      border: '0.5px solid var(--color-gray-light)',
      borderRadius: '4px',
      background: 'var(--color-darkblue-light)',
      color: 'var(--color-primary)',
      fontFamily: 'var(--mono)',
      letterSpacing: '0.06em',
      cursor: 'pointer',
      opacity: 0.7
    }
  }, THEMES[theme]?.icon, " ", THEMES[theme]?.label));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
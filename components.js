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
    className: [faClass, className, "u-inline-flex-center"].filter(Boolean).join(" ")
  });
}
function isMobileViewport() {
  return typeof window !== "undefined" && (window.innerWidth <= 1024 || window.innerHeight <= 500);
}
function safeSaveStaticDefaults(key, value) {
  if (typeof saveStaticDefaults === "undefined") {
    return Promise.reject(new Error("saveStaticDefaults is not available"));
  }
  return saveStaticDefaults(key, value);
}
function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clampNumber(value, min, max, fallback = min) {
  return Math.min(max, Math.max(min, toNumber(value, fallback)));
}
function useTimedState(initialValue, defaultDelay = 2500) {
  const [value, setValue] = React.useState(initialValue);
  const timerRef = React.useRef(null);
  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);
  const setTimedValue = (nextValue, delay = defaultDelay) => {
    setValue(nextValue);
    clearTimeout(timerRef.current);
    if (delay > 0) {
      timerRef.current = window.setTimeout(() => setValue(initialValue), delay);
    }
  };
  const clearTimedValue = () => {
    clearTimeout(timerRef.current);
    setValue(initialValue);
  };
  return [value, setTimedValue, clearTimedValue];
}
function useTimedSet(defaultDelay = 600) {
  const [values, setValues] = React.useState(() => new Set());
  const timerRefs = React.useRef({});
  React.useEffect(() => {
    return () => Object.values(timerRefs.current).forEach(clearTimeout);
  }, []);
  const add = React.useCallback((item, delay = defaultDelay) => {
    setValues(prev => {
      const next = new Set(prev);
      next.add(item);
      return next;
    });
    clearTimeout(timerRefs.current[item]);
    timerRefs.current[item] = window.setTimeout(() => {
      setValues(prev => {
        const next = new Set(prev);
        next.delete(item);
        return next;
      });
      delete timerRefs.current[item];
    }, delay);
  }, [defaultDelay]);
  const remove = React.useCallback(item => {
    setValues(prev => {
      const next = new Set(prev);
      next.delete(item);
      return next;
    });
    clearTimeout(timerRefs.current[item]);
    delete timerRefs.current[item];
  }, []);
  const clear = React.useCallback(() => {
    Object.values(timerRefs.current).forEach(clearTimeout);
    timerRefs.current = {};
    setValues(new Set());
  }, []);
  return [values, add, remove, clear];
}
function useClickOutside(refs, handler, active = true) {
  React.useEffect(() => {
    if (!active) return;
    const onMouseDown = e => {
      const target = e.target;
      const clickedInside = refs.some(ref => ref.current && ref.current.contains(target));
      if (!clickedInside) handler(e);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("touchstart", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("touchstart", onMouseDown);
    };
  }, [handler, active]);
}
function useDropdownKeyboard(itemsLength, onSelect, onClose) {
  const [hoveredIndex, setHoveredIndex] = React.useState(-1);

  // Reset hovered index when items change or dropdown opens
  React.useEffect(() => {
    setHoveredIndex(-1);
  }, [itemsLength]);
  const onKeyDown = e => {
    if (itemsLength === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoveredIndex(prev => prev < itemsLength - 1 ? prev + 1 : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoveredIndex(prev => prev > 0 ? prev - 1 : itemsLength - 1);
    } else if (e.key === "Enter" && hoveredIndex >= 0) {
      e.preventDefault(); // Prevent NumInput from committing its partial value
      onSelect(hoveredIndex);
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };
  return {
    hoveredIndex,
    onKeyDown
  };
}

/**
 * Hook for protecting range sliders from accidental touch during scroll on mobile.
 * On mobile, touches are tracked to distinguish between horizontal slider adjustment
 * and vertical scroll. Only allows slider changes on primarily horizontal gestures.
 * @param {Function} onChange - Original onChange callback for the slider
 * @returns {Object} { onChange: protected onChange, onTouchStart: touch start handler, onTouchMove: touch move handler }
 */
function useProtectedRangeSlider(onChange) {
  const touchState = React.useRef({
    startX: 0,
    startY: 0,
    isScrolling: false
  });
  const onTouchStart = e => {
    if (!isMobileViewport()) return;
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isScrolling: false
    };
  };
  const onTouchMove = e => {
    if (!isMobileViewport() || touchState.current.isScrolling) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;

    // Determine if user is scrolling (vertical movement) or adjusting slider (horizontal)
    // If vertical movement is significantly larger than horizontal, treat as scroll
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      touchState.current.isScrolling = true;
    }
  };
  const protectedOnChange = e => {
    const isMobileMode = isMobileViewport();
    // On desktop, always allow changes
    if (!isMobileMode) {
      onChange(e);
      return;
    }

    // On mobile, only trigger onChange if we're not scrolling
    if (!touchState.current.isScrolling) {
      onChange(e);
    }
  };
  return {
    onChange: protectedOnChange,
    onTouchStart,
    onTouchMove
  };
}

/**
 * A lockable range slider component to prevent accidental movement on mobile.
 */
function RangeSlider({
  id,
  value,
  onChange,
  min,
  max,
  step,
  className = ""
}) {
  const isMobileMode = isMobileViewport();
  // Default to locked on both mobile and desktop
  const [isLocked, setIsLocked] = React.useState(true);
  const {
    onChange: protectedOnChange,
    onTouchStart,
    onTouchMove
  } = useProtectedRangeSlider(onChange);
  const handleRowClick = e => {
    // Only unlock if currently locked. 
    // If clicking the button itself, let the button's onClick handle it.
    if (isLocked && !e.target.closest('.range-lock-btn')) {
      setIsLocked(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `range-slider-wrap ${isLocked ? 'is-locked' : 'is-unlocked'} ${className}`,
    onClick: handleRowClick
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    name: id,
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value,
    disabled: isLocked,
    onChange: protectedOnChange,
    onTouchStart: onTouchStart,
    onTouchMove: onTouchMove,
    className: "range-input"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "range-lock-btn",
    onClick: e => {
      e.stopPropagation(); // Prevent handleRowClick from firing
      setIsLocked(!isLocked);
    },
    title: isLocked ? "Unlock to adjust" : "Lock to prevent accidental changes"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isLocked ? "lock" : "unlock"
  })));
}
function NumInput({
  id,
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Infinity,
  unit,
  req = false,
  onFocus,
  onMouseDown,
  labelIcon,
  onKeyDown,
  onCommit
}) {
  const [local, setLocal] = React.useState(value === "" ? "" : String(value));
  React.useEffect(() => {
    setLocal(value === "" ? "" : String(value));
  }, [value]);

  // Commits the numeric value — called on blur and as part of confirm
  const commitValue = () => {
    if (local === "") {
      onChange("");
    } else {
      const n = Number(local);
      if (!isNaN(n)) {
        const val = Math.max(min, Math.min(max, Math.round(n * 100) / 100));
        onChange(val);
        setLocal(String(val));
      } else {
        setLocal(value === "" ? "" : String(value));
      }
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "num-wrap"
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "num-lbl"
  }, label, labelIcon && /*#__PURE__*/React.createElement(Icon, {
    name: labelIcon,
    className: "num-lbl-icon"
  })), /*#__PURE__*/React.createElement("div", {
    className: "num-row"
  }, /*#__PURE__*/React.createElement("input", {
    id: id,
    name: id,
    className: "num-input" + (req ? " num-input--req" : ""),
    type: "number",
    value: local,
    min: min,
    max: max === Infinity ? undefined : max,
    step: step,
    onChange: e => setLocal(e.target.value),
    onKeyDown: e => {
      // Parent handler runs first — can e.preventDefault() to intercept Enter
      if (onKeyDown) onKeyDown(e);
      if (e.key === "Enter" && !e.defaultPrevented) {
        e.preventDefault();
        e.stopPropagation();
        commitValue();
        if (onCommit) onCommit();
      }
    },
    onBlur: () => {
      commitValue();
      if (onCommit) onCommit();
    },
    onFocus: onFocus,
    onMouseDown: onMouseDown
  }), /*#__PURE__*/React.createElement("button", {
    className: "num-btn",
    type: "button",
    onClick: () => {
      commitValue();
      if (onCommit) onCommit();
    }
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
  className = "",
  noToggle = false
}) {
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const defaultOpen = variant === "detail" ? false : true;
  const [openLocal, setOpenLocal] = React.useState(openProp !== undefined ? openProp : defaultOpen);

  // Sync local state if openProp changes and we are not in controlled mode
  React.useEffect(() => {
    if (openProp !== undefined && !isControlled) {
      setOpenLocal(openProp);
    }
  }, [openProp, isControlled]);
  const open = noToggle ? true : isControlled ? openProp : openLocal;
  const setOpen = isControlled ? setOpenProp : setOpenLocal;
  const headStyle = {
    ...(bg ? {
      background: bg
    } : {}),
    cursor: noToggle ? "default" : "pointer"
  };
  if (variant === "panel") {
    return /*#__PURE__*/React.createElement("div", {
      id: id,
      className: ["control-panel", className].filter(Boolean).join(" ")
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-head",
      style: headStyle,
      onClick: noToggle ? undefined : () => setOpen(!open)
    }, /*#__PURE__*/React.createElement("span", null, title), !noToggle && /*#__PURE__*/React.createElement("span", {
      className: "sys-head-toggle"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: open ? "minus" : "plus"
    }))), open && /*#__PURE__*/React.createElement("div", {
      className: "panel-data"
    }, children));
  }
  if (variant === "detail") {
    return /*#__PURE__*/React.createElement("div", {
      id: id,
      className: ["detail-section", className].filter(Boolean).join(" ")
    }, /*#__PURE__*/React.createElement("div", {
      className: "detail-section-head",
      style: headStyle,
      onClick: noToggle ? undefined : () => setOpen(!open)
    }, /*#__PURE__*/React.createElement("span", null, title), !noToggle && /*#__PURE__*/React.createElement("span", {
      className: "sys-head-toggle"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: open ? "minus" : "plus"
    }))), open && /*#__PURE__*/React.createElement("div", {
      className: "detail-section-body"
    }, children));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head",
    style: headStyle,
    onClick: noToggle ? undefined : () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("span", null, title), !noToggle && /*#__PURE__*/React.createElement("span", {
    className: "sys-head-toggle"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: open ? "minus" : "plus"
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, children));
}

// Convenience aliases for readability at call sites
const Section = props => /*#__PURE__*/React.createElement(Collapsible, props);
const ControlPanel = props => /*#__PURE__*/React.createElement(Collapsible, _extends({}, props, {
  variant: "panel"
}));
const DetailSection = props => /*#__PURE__*/React.createElement(Collapsible, _extends({}, props, {
  variant: "detail"
}));
function Row({
  label,
  value,
  unit,
  hi,
  danger,
  hoverType,
  hoveredType,
  setHoveredType
}) {
  const isHovered = hoverType && hoveredType === hoverType;
  return /*#__PURE__*/React.createElement("div", {
    className: "data-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl" + (hoverType ? " hoverable" : "") + (isHovered ? " hovered" : "") + (danger ? " data-row-danger" : ""),
    onMouseEnter: hoverType && setHoveredType ? () => setHoveredType(hoverType) : undefined,
    onMouseLeave: hoverType && setHoveredType ? () => setHoveredType(null) : undefined
  }, label), /*#__PURE__*/React.createElement("span", {
    className: (hi ? "data-row-val hi" : "data-row-val") + (danger ? " data-row-danger" : "")
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

/**
 * Primitive layout component to enforce spacing scale
 * @param {1|2|3|4|5|6|7|0.5} gap - Spacing level from scale
 * @param {"column"|"row"} direction - Flex direction
 */
function Stack({
  children,
  gap = 2,
  direction = "column",
  className = "",
  style = {},
  as: Tag = "div",
  ...props
}) {
  const gClass = `u-gap-${String(gap).replace('.', '')}`;
  const dClass = `u-flex-${direction === "row" ? "row" : "col"}`;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: [dClass, gClass, className].filter(Boolean).join(" "),
    style: style
  }, props), children);
}

/**
 * Text Typography component
 * @param {"xs"|"sm"|"md"|"lg"|"xl"|"xxl"} size - Font size level
 * @param {"reg"|"med"|"semi"|"bold"|"black"} weight - Font weight level
 * @param {"sans"|"mono"} variant - Font family variant
 */
function Text({
  children,
  size,
  weight,
  variant,
  color,
  className = "",
  style = {},
  as: Tag = "span",
  ...props
}) {
  const classes = [size && `u-fs-${size}`, weight && `u-fw-${weight}`, variant && `u-${variant}`, className].filter(Boolean).join(" ");
  const s = {
    ...style
  };
  if (color) s.color = color;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: classes,
    style: s
  }, props), children);
}
function SaveDefaultsButton({
  status,
  onClick,
  disabled = false,
  labels = {},
  className = "",
  style = {}
}) {
  if (typeof canSaveStaticDefaults === "undefined" || !canSaveStaticDefaults()) return null;
  const {
    savingLabel = "Saving...",
    savedLabel = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
      name: "check"
    }), " Saved Defaults"),
    errorLabel = "Error Saving",
    defaultLabel = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
      name: "check"
    }), " Save Defaults")
  } = labels;
  return /*#__PURE__*/React.createElement("button", {
    className: ["ctrl-dir", status === "saved" ? "on pw-preset-flash" : "", className].filter(Boolean).join(" "),
    type: "button",
    onClick: onClick,
    disabled: disabled || status === "saving",
    style: style
  }, status === "saving" ? savingLabel : status === "saved" ? savedLabel : status === "error" ? errorLabel : defaultLabel);
}
function MaterialPresetDropdown({
  anchorRef,
  presets,
  activePreset,
  onApply,
  field,
  hoveredIndex = -1
}) {
  const [pos, setPos] = React.useState({
    top: 0,
    left: 0,
    width: 0
  });
  React.useLayoutEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + window.scrollY + 4,
        left: r.left + window.scrollX,
        width: r.width
      });
    }
  }, [anchorRef]);
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "rate-presets-dropdown",
    style: {
      position: "absolute",
      top: pos.top,
      left: pos.left,
      width: pos.width,
      zIndex: 9999
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rate-presets-header"
  }, "Material Presets"), /*#__PURE__*/React.createElement("div", {
    className: "rate-presets-list",
    role: "listbox"
  }, presets.map((p, idx) => {
    if (!p.name) return null;
    const displayVal = field === "width" ? p.width : p.length;
    const displayUnit = field === "width" ? "w" : "l";
    const isActive = activePreset === idx;
    const isHovered = hoveredIndex === idx;
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      role: "option",
      "aria-selected": isHovered,
      className: "rate-preset-item" + (isActive ? " active" : "") + (isHovered ? " focused" : ""),
      onMouseDown: e => {
        e.preventDefault();
        e.stopPropagation();
        onApply(p, idx);
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "rate-preset-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-name"
    }, p.name), /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-meta"
    }, p.width, " \xD7 ", p.length, " mm")), /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-val"
    }, displayVal, /*#__PURE__*/React.createElement("small", null, displayUnit)));
  }))), document.body);
}
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
    danger: row.danger,
    hoverType: row.hoverType,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType
  })));
}
function buildLayoutSvgRects(result, orderedRows, rowStart) {
  const {
    surfaceW,
    surfaceH,
    simW,
    simH,
    direction,
    s4,
    useS4Colors,
    palClasses,
    PPi,
    PLa
  } = result.meta;
  const isV = direction === "V";
  const stdRowH = isV ? PPi : PLa;
  // Use simulation dimensions for canvas sizing (swapped in V mode)
  const canvasW = simW || surfaceW;
  const canvasH = simH || surfaceH;
  let physicalCursor = 0;
  let visualCursor = 0;
  const rects = [];
  const rowRects = [];
  orderedRows.forEach(({
    row,
    idx
  }) => {
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
    const rowPalClasses = s4 && useS4Colors ? row.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s : palClasses || PAL_CLASSES.s1;
    const isS4Palette = rowPalClasses === PAL_CLASSES.s4l || rowPalClasses === PAL_CLASSES.s4s;
    row.segs.forEach((seg, segIndex) => {
      const segPalClasses = isS4Palette && seg.type === "full" && seg.long !== undefined ? seg.long ? PAL_CLASSES.s4l : PAL_CLASSES.s4s : rowPalClasses;
      let segClass = seg.type === "gap" ? "layout-svg-gap" : getSegmentClass(seg, segPalClasses);
      const rect = {
        key: `${idx}-${segIndex}-${seg.type}-${Math.round(seg.x)}-${Math.round(seg.w)}-${seg.sourceId || ""}`,
        type: seg.type,
        sourceId: seg.sourceId,
        isCarry: !!seg.sourceId,
        rowIndex: idx,
        segIndex,
        row,
        seg,
        segClass
      };
      if (isV) {
        rect.x = visualCursor + (rowStart === "bottom" ? visualRowSize - rowSize : 0);
        rect.y = seg.x;
        rect.w = rowSize;
        rect.h = seg.w;
      } else {
        rect.x = seg.x;
        rect.y = visualCursor + (rowStart === "bottom" ? visualRowSize - rowSize : 0);
        rect.w = seg.w;
        rect.h = rowSize;
      }
      rects.push(rect);
    });
    visualCursor += visualRowSize;
  });
  const vW = isV ? visualCursor : canvasW;
  const vH = isV ? canvasW : Math.max(canvasH, visualCursor);

  // Centering / Offset logic
  let xOffset = 0;
  let yOffset = 0;
  if (!isV && visualCursor < canvasH && rowStart === "bottom") {
    yOffset = canvasH - visualCursor;
  }
  if (xOffset > 0 || yOffset > 0) {
    rects.forEach(r => {
      r.x += xOffset;
      r.y += yOffset;
    });
    rowRects.forEach(r => {
      r.x += xOffset;
      r.y += yOffset;
    });
  }
  return {
    rects,
    rowRects,
    vW,
    vH,
    xOffset,
    yOffset
  };
}

// ── LayoutVisualization (rewritten from scratch) ──────────────────────────────
// Row labels live inside the SVG, positioned in SVG coordinate space.
// This guarantees they always align with the chart rows at any container size.

function LayoutVisualization({
  result,
  hoveredType,
  setHoveredType,
  rowStart = "top",
  alwaysShowLabels = false,
  maxHeight = 420,
  onLargePreview
}) {
  const [selectedKey, setSelectedKey] = React.useState(null);
  const [selectedSourceId, setSelectedSourceId] = React.useState(null);
  const svgIdRef = React.useRef(null);
  if (!svgIdRef.current) {
    svgIdRef.current = `layout-svg-${Math.random().toString(36).slice(2, 10)}`;
  }
  const gapHatchId = `${svgIdRef.current}-gap-hatch`;

  // ── Strip layout (special case) ──
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
    }), /*#__PURE__*/React.createElement(Stack, {
      direction: "row",
      gap: 3,
      className: "strip-legend strip-legend-mt"
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

  // ── Main SVG layout ──
  const {
    surfaceW,
    surfaceH,
    PPi,
    PLa,
    s4Long,
    s4: isS4,
    direction
  } = result.meta;
  if (!surfaceW || !surfaceH || !PPi || !PLa) return null;
  const isV = direction === "V";
  const horzPanel = isV ? PLa : PPi;
  const horzLabel = isS4 ? `${surfaceW} mm \u2014 long ${s4Long} mm` : `${surfaceW} mm \u2014 panel ${horzPanel} mm`;
  const vertPanel = isV ? PPi : PLa;
  const vertLabel = `${surfaceH} mm \u2014 row ${vertPanel} mm`;

  // Define orderedRows once as the single source of truth for this render
  const orderedRows = React.useMemo(() => rowStart === "bottom" ? result.rows.map((row, idx) => ({
    row,
    idx
  })).reverse() : result.rows.map((row, idx) => ({
    row,
    idx
  })), [result.rows, rowStart]);

  // Build rects in SVG coordinate space
  const {
    rects,
    rowRects,
    vW,
    vH,
    yOffset
  } = React.useMemo(() => buildLayoutSvgRects(result, orderedRows, rowStart), [result, orderedRows, rowStart]);
  const showSegmentText = alwaysShowLabels || result.rows.length <= 10;
  const showRowLabels = alwaysShowLabels || result.rows.length <= 32;

  // Build carry connector lines between adjacent rows at cut→offcut boundaries
  const carryLines = React.useMemo(() => {
    if (isV) return []; // connectors only in H mode for now
    const lines = [];
    for (let i = 0; i < orderedRows.length - 1; i++) {
      const {
        row: rowA
      } = orderedRows[i];
      const {
        row: rowB
      } = orderedRows[i + 1];
      const cutSeg = rowA.segs[rowA.segs.length - 1];
      const offcutSeg = rowB.segs[0];
      if (cutSeg?.sourceId && offcutSeg?.sourceId === cutSeg.sourceId) {
        // find the visual y positions from rowRects
        const rrA = rowRects[i];
        const rrB = rowRects[i + 1];
        if (!rrA || !rrB) continue;
        const boundary = rrA.y + rrA.h; // SVG y of row boundary
        const x1 = cutSeg.x + cutSeg.w; // right edge of cut (= surfaceW)
        const x2 = offcutSeg.x + offcutSeg.w; // right edge of offcut
        lines.push({
          x1,
          x2,
          y: boundary,
          sourceId: cutSeg.sourceId
        });
      }
    }
    return lines;
  }, [orderedRows, rowRects, isV]);
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
  const laneLabelFontSize = Number.isFinite(minRowLabelLane) ? Math.floor(minRowLabelLane / (maxRowLabelChars * 0.68)) : baseLabelFontSize;
  const labelFontSize = showRowLabels ? Math.max(10, Math.min(baseLabelFontSize, laneLabelFontSize)) : 0;
  const labelMargin = showRowLabels ? Math.round(labelFontSize * 3.6) : 0;
  const chartX = !isV ? labelMargin : 0;
  const chartY = isV ? labelMargin : 0;
  const totalVW = vW + chartX;
  const totalVH = vH + chartY;
  const aspectRatio = totalVW / totalVH;
  const handleSegClick = rect => {
    if (selectedKey === rect.key) {
      setSelectedKey(null);
      setSelectedSourceId(null);
    } else {
      setSelectedKey(rect.key);
      setSelectedSourceId(rect.sourceId || null);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "viz-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "stretch",
      gap: "var(--sp-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      flex: 1,
      aspectRatio,
      maxHeight: `${maxHeight}px`
    }
  }, onLargePreview && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "viz-expand-btn",
    onClick: () => onLargePreview(),
    title: alwaysShowLabels ? "Close large preview" : "Open large preview"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: alwaysShowLabels ? "minimize" : "maximize"
  })), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${totalVW} ${totalVH}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      borderRadius: "8px"
    },
    onClick: () => {
      setSelectedKey(null);
      setSelectedSourceId(null);
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: gapHatchId,
    patternUnits: "userSpaceOnUse",
    width: "16",
    height: "16"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "16",
    height: "16",
    fill: "rgba(255,68,68,0.12)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 16 L16 0",
    stroke: "var(--danger)",
    strokeWidth: "2"
  }))), rowRects.map(r => /*#__PURE__*/React.createElement("rect", {
    key: r.key,
    x: r.x + chartX,
    y: r.y + chartY,
    width: r.w,
    height: r.h,
    className: "layout-svg-row-bg"
  })), rects.map(rect => {
    const isHighlighted = hoveredType && rect.type === hoveredType;
    const isSelected = selectedKey === rect.key || selectedSourceId && rect.sourceId === selectedSourceId;
    const showLabel = showSegmentText && rect.w > vW * 0.045 && rect.h > vH * 0.035;
    return /*#__PURE__*/React.createElement("g", {
      key: rect.key,
      style: {
        cursor: rect.sourceId ? "pointer" : "default"
      },
      onClick: e => {
        e.stopPropagation();
        handleSegClick(rect);
      }
    }, /*#__PURE__*/React.createElement("rect", {
      x: rect.x + chartX,
      y: rect.y + chartY,
      width: rect.w,
      height: rect.h,
      className: `layout-svg-seg ${rect.segClass}${rect.isCarry ? " is-carry" : ""}${isHighlighted ? " is-highlighted" : ""}${isSelected ? " is-selected" : ""}`,
      style: rect.type === "gap" ? {
        fill: `url(#${gapHatchId})`
      } : undefined,
      onMouseEnter: () => setHoveredType && setHoveredType(rect.type),
      onMouseLeave: () => setHoveredType && setHoveredType(null)
    }, /*#__PURE__*/React.createElement("title", null, `${Math.round(rect.seg.w)}mm - ${rect.type}${rect.sourceId ? ` (source: ${rect.sourceId})` : ""}`)), showLabel && /*#__PURE__*/React.createElement("text", {
      x: rect.x + chartX + rect.w / 2,
      y: rect.y + chartY + rect.h / 2,
      textAnchor: "middle",
      dominantBaseline: "middle",
      className: "layout-svg-label"
    }, rect.type === "gap" ? `\u2205${Math.round(rect.seg.w)}` : Math.round(rect.seg.w)));
  }), carryLines.map((cl, i) => /*#__PURE__*/React.createElement("line", {
    key: `carry-${i}-${cl.sourceId}`,
    x1: cl.x1 + chartX,
    y1: cl.y + chartY,
    x2: cl.x2 + chartX,
    y2: cl.y + chartY,
    className: "layout-svg-carry-line"
  })), groupBands.map(band => /*#__PURE__*/React.createElement("text", {
    key: band.label,
    x: isV ? band.mid + chartX : chartX - labelFontSize * 0.5,
    y: isV ? chartY - labelFontSize * 0.5 : band.mid + chartY,
    fontSize: labelFontSize,
    style: {
      fontSize: labelFontSize
    },
    textAnchor: isV ? "middle" : "end",
    dominantBaseline: isV ? "auto" : "middle",
    className: "layout-svg-row-label"
  }, band.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "18px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--sp-1)",
      writingMode: "vertical-rl",
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-md)",
      color: "var(--color-gray-opa80)",
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-v",
    style: {
      writingMode: "horizontal-tb",
      fontSize: "var(--fs-md)",
      color: "var(--color-primary)"
    }
  }), /*#__PURE__*/React.createElement("span", null, vertLabel)))), /*#__PURE__*/React.createElement("div", {
    className: "viz-legends"
  }, /*#__PURE__*/React.createElement("div", {
    className: "viz-legend-h"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-h",
    style: {
      color: "var(--color-primary)"
    }
  }), /*#__PURE__*/React.createElement("span", null, horzLabel), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-h",
    style: {
      color: "var(--color-primary)"
    }
  }))));
}
function LayoutPanel({
  layout,
  result,
  hoveredType,
  isBest,
  setHoveredType,
  rowStart = "top",
  noToggle = false,
  open: openProp,
  setOpen: setOpenProp,
  onLargePreview
}) {
  const [openLocal, setOpenLocal] = React.useState(layout.defaultOpen !== false);
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const isOpen = noToggle ? true : isControlled ? openProp : openLocal;
  const setOpen = isControlled ? setOpenProp : setOpenLocal;
  const canLargePreview = onLargePreview && result.rows.length > 0;
  return /*#__PURE__*/React.createElement("div", {
    id: "panel-" + layout.id,
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sys-head",
    onClick: noToggle ? undefined : () => setOpen(!isOpen),
    style: noToggle ? {
      cursor: "default"
    } : {}
  }, !noToggle && /*#__PURE__*/React.createElement("span", {
    className: "sys-head-toggle"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: isOpen ? "chevron-down" : "chevron-right"
  })), /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, layout.icon && /*#__PURE__*/React.createElement(Icon, {
    name: layout.icon,
    className: "sys-title-icon"
  }), " ", layout.title), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, layout.description), /*#__PURE__*/React.createElement("div", {
    className: "sys-head-actions",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("span", {
    className: "sys-head-count"
  }, result.stats.total, " pcs ", isBest ? /*#__PURE__*/React.createElement(Icon, {
    name: "best-badge"
  }) : ""))), isOpen && /*#__PURE__*/React.createElement(Stack, {
    className: "panel-body",
    gap: 2
  }, layout.renderControls && React.createElement(layout.renderControls, {
    state: layout.getState(),
    setState: layout.setState
  }), result.summaryRows.length > 0 && /*#__PURE__*/React.createElement(PanelSummary, {
    rows: result.summaryRows,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType
  }), result.rows.length > 0 && /*#__PURE__*/React.createElement(LayoutVisualization, {
    result: result,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType,
    rowStart: rowStart,
    onLargePreview: onLargePreview ? () => onLargePreview(layout, result) : null
  })));
}
function PreviewSection({
  id,
  title,
  description,
  headerActions,
  children
}) {
  return /*#__PURE__*/React.createElement(Stack, {
    id: id,
    gap: 3
  }, (title || description || headerActions) && /*#__PURE__*/React.createElement("div", {
    className: "preview-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "preview-head-main"
  }, title && /*#__PURE__*/React.createElement("h2", {
    className: "preview-title"
  }, title), description && /*#__PURE__*/React.createElement("p", {
    className: "preview-desc"
  }, description)), headerActions && /*#__PURE__*/React.createElement("div", {
    className: "preview-head-actions"
  }, headerActions)), /*#__PURE__*/React.createElement(Stack, {
    className: "preview-data",
    gap: 3
  }, children));
}

// ── Layout controls & registry ────────────────────────────────────────────────

function S4Controls({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-s4long",
    label: "Long piece (mm)",
    value: state.s4Long,
    onChange: v => setState({
      s4Long: v
    }),
    step: 10
  }));
}
function S2Controls({
  state,
  setState
}) {
  return /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 2,
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Offset (\xD7PL)"), /*#__PURE__*/React.createElement(RangeSlider, {
    id: "input-offset",
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
  if (m = s.match(/^(\d{1,2})[:\.](\d{2})$/)) {
    const h = +m[1],
      mm = +m[2];
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{3}$/.test(s)) {
    const h = +s[0],
      mm = +s.slice(1);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{4}$/.test(s)) {
    const h = +s.slice(0, 2),
      mm = +s.slice(2);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
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
  if (m = s.match(/^(\d{1,2})[:\.](\d{2})$/)) {
    const h = +m[1],
      mm = +m[2];
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{3}$/.test(s)) {
    const h = +s[0],
      mm = +s.slice(1);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{4}$/.test(s)) {
    const h = +s.slice(0, 2),
      mm = +s.slice(2);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
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
  const [copied, setCopied] = useTimedState(false, 1800);
  const [copyError, setCopyError] = useTimedState(false, 1800);
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
  const removeCalcRow = id => {
    setCalcRows(prev => prev.filter(r => r.id !== id));
    if (activeRowId === id) setActiveRowId(null);
  };
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
    if (!navigator.clipboard) {
      setCopyError(true);
      return;
    }
    navigator.clipboard.writeText(fmtDecimal(calcTotalMins)).then(() => {
      setCopied(true);
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      setCopyError(true);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return /*#__PURE__*/React.createElement("div", {
    className: "ts-page"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "ts-body",
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "layout-split"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "ts-section",
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "section unboxed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Time Entries")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 1
  }, /*#__PURE__*/React.createElement("div", {
    className: "ts-grid-hd",
    style: {
      marginTop: 'var(--sp-2)'
    }
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
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "Start"), /*#__PURE__*/React.createElement("input", {
      id: `ts-start-${row.id}`,
      name: `ts-start-${row.id}`,
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
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "End"), /*#__PURE__*/React.createElement("input", {
      id: `ts-end-${row.id}`,
      name: `ts-end-${row.id}`,
      className: "num-input ts-input",
      type: "text",
      placeholder: "17, 17:30",
      value: row.end,
      onFocus: () => setActiveRowId(row.id),
      onChange: e => updateCalcRow(row.id, 'end', e.target.value),
      onBlur: e => formatTimeInput(row.id, 'end', e.target.value)
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "Lunch"), /*#__PURE__*/React.createElement("input", {
      id: `ts-lunch-${row.id}`,
      name: `ts-lunch-${row.id}`,
      className: "num-input ts-input",
      type: "text",
      placeholder: ".30",
      value: row.lunch,
      onFocus: () => setActiveRowId(row.id),
      onKeyDown: e => handleLunchTab(e, idx),
      onChange: e => updateCalcRow(row.id, 'lunch', e.target.value)
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "Duration"), /*#__PURE__*/React.createElement("div", {
      className: "ts-duration" + (res.status === 'error' ? " ts-duration--error" : res.status === 'warn' ? " ts-duration--warn" : "")
    }, res.dur)), /*#__PURE__*/React.createElement("div", {
      className: "ts-col-dec"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "Decimal"), /*#__PURE__*/React.createElement("div", {
      className: "ts-decimal"
    }, res.dec)), /*#__PURE__*/React.createElement("div", {
      className: "ts-remove-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pw-preset-lbl-hide"
    }, "\xA0"), /*#__PURE__*/React.createElement("button", {
      className: "num-btn ts-remove",
      tabIndex: -1,
      onClick: () => removeCalcRow(row.id)
    }, "\xD7")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '1px',
      background: 'var(--divider-subtle)',
      margin: 'var(--sp-2) 0'
    }
  }), /*#__PURE__*/React.createElement(Stack, {
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 2,
    className: "ts-pills"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-header",
    style: {
      display: 'block',
      gridTemplateColumns: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lunch presets:")), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-btns",
    style: {
      flexWrap: 'wrap',
      gap: '8px',
      justifyContent: 'flex-start'
    }
  }, LUNCH_PRESETS.map(([label, val]) => /*#__PURE__*/React.createElement("button", {
    key: val,
    className: "pill-btn",
    onClick: () => applyLunchPreset(val)
  }, label)))), /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 2,
    className: "ts-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ts-btn",
    onClick: addCalcRow
  }, "+ Add row"), /*#__PURE__*/React.createElement("button", {
    className: "ts-btn ts-btn--muted",
    onClick: clearCalc
  }, "Clear all"))))))), /*#__PURE__*/React.createElement("div", {
    className: "u-sticky u-sticky-top",
    style: {
      marginTop: 'var(--sticky-offset)',
      top: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "result-card-title"
  }, "Total Hours"), /*#__PURE__*/React.createElement("span", {
    className: "result-card-value"
  }, fmtHHMM(calcTotalMins) || "0:00", " ", /*#__PURE__*/React.createElement("span", {
    className: "result-card-val-sub"
  }, "h")), /*#__PURE__*/React.createElement("div", {
    className: "result-card-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-card-footer-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "result-card-footer-lbl"
  }, "Decimal time: "), /*#__PURE__*/React.createElement("span", {
    className: "result-card-footer-val"
  }, fmtDecimal(calcTotalMins) || "0.00")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--sp-4)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "ts-copy" + (copied ? " ts-copy--done" : "") + (copyError ? " ts-copy--error" : ""),
    onClick: handleCopy,
    style: {
      width: '100%',
      padding: '12px',
      fontSize: 'var(--fs-md)',
      borderRadius: '6px',
      textAlign: 'center'
    }
  }, copied ? 'Copied!' : copyError ? 'Error' : 'Copy decimal'))))))));
}

// ── Concrete Calculator ────────────────────────────────────────────────────────

function SheetConcrete() {
  const [areaMode, setAreaMode] = React.useState("direct"); // "direct" | "dims"
  const [thickMode, setThickMode] = React.useState("avg"); // "avg" | "corners"

  // Area inputs
  const [areaManual, setAreaManual] = React.useState("");
  const [lenMm, setLenMm] = React.useState("");
  const [widMm, setWidMm] = React.useState("");

  // Thickness inputs
  const [avgH, setAvgH] = React.useState("");
  const [ca, setCa] = React.useState("");
  const [cb, setCb] = React.useState("");
  const [cc, setCc] = React.useState("");
  const [cd, setCd] = React.useState("");

  // Consumption & packaging
  const [rate, setRate] = React.useState("");
  const [bagKg, setBagKg] = React.useState("");
  const [bagPrice, setBagPrice] = React.useState("");
  const [activePreset, setActivePreset] = React.useState(null);
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [showUpdated, setShowUpdated] = useTimedState(false, 2500);
  const rateInputRef = React.useRef(null);
  const [showRatePresets, setShowRatePresets] = React.useState(false);

  // Product presets (quick fill)
  const [presets, setPresets] = React.useState(() => (typeof DEFAULT_CONCRETE_PRESETS !== "undefined" ? DEFAULT_CONCRETE_PRESETS : [{
    name: "weber S-100",
    rate: 2,
    bagKg: 25,
    bagPrice: 4
  }, {
    name: "weberfloor 200 RAPID",
    rate: 1.7,
    bagKg: 20,
    bagPrice: 15
  }, {
    name: "",
    rate: "",
    bagKg: "",
    bagPrice: ""
  }]).map(p => ({
    ...p
  })));
  const [presetSaveStatus, setPresetSaveStatus] = React.useState("");
  const saveConcreteDefaults = async () => {
    setPresetSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("concretePresets", presets);
      setPresetSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setPresetSaveStatus("error");
    }
  };
  const resetAll = () => {
    setAreaManual("");
    setLenMm("");
    setWidMm("");
    setAvgH("");
    setCa("");
    setCb("");
    setCc("");
    setCd("");
    setRate("");
    setBagKg("");
    setBagPrice("");
    setActivePreset(null);
    setFlashIdx(null);
    setFieldFlash(false);
    setShowUpdated(false);
  };
  const updatePreset = (idx, field, val) => {
    const next = [...presets];
    next[idx] = {
      ...next[idx],
      [field]: val
    };
    setPresets(next);
  };
  const addPreset = () => {
    setPresets([...presets, {
      name: "",
      rate: "",
      bagKg: "",
      bagPrice: ""
    }]);
  };
  const applyPreset = (p, idx) => {
    setRate(p.rate === "" ? "" : parseFloat(p.rate) || 0);
    setBagKg(p.bagKg === "" ? "" : parseFloat(p.bagKg) || 0);
    setBagPrice(p.bagPrice);
    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
    setShowUpdated(true);
  };
  const handleRateChange = v => {
    setRate(v);
    setActivePreset(null);
  };
  const handleBagKgChange = v => {
    setBagKg(v);
    setActivePreset(null);
  };
  const handleBagPriceChange = v => {
    setBagPrice(v);
    setActivePreset(null);
  };
  useClickOutside([rateInputRef], () => setShowRatePresets(false));
  const validPresets = presets.filter(p => p.name);
  const {
    hoveredIndex,
    onKeyDown
  } = useDropdownKeyboard(showRatePresets ? validPresets.length : 0, idx => applyPreset(validPresets[idx], presets.indexOf(validPresets[idx])), () => setShowRatePresets(false));

  // ── Derived values ─────────────────────────────────────────────────────────
  const parseNum = toNumber;
  const area = areaMode === "dims" ? parseNum(lenMm) * parseNum(widMm) / 1_000_000 : parseNum(areaManual);
  const computedDimsArea = parseNum(lenMm) * parseNum(widMm) / 1_000_000;
  let computedAvgH, diff;
  if (thickMode === "avg") {
    computedAvgH = parseNum(avgH);
    diff = null;
  } else {
    const va = parseNum(ca);
    const vb = parseNum(cb);
    const vc = parseNum(cc);
    const vd = parseNum(cd);
    computedAvgH = (va + vb + vc + vd) / 4;
    diff = Math.max(va, vb, vc, vd) - Math.min(va, vb, vc, vd);
  }
  const mass = area * computedAvgH * parseNum(rate);
  const bagsExact = parseNum(bagKg) > 0 ? mass / parseNum(bagKg) : 0;
  const bags = Math.ceil(bagsExact);
  const bPrice = parseNum(bagPrice);
  const totalPrice = bags > 0 && bPrice > 0 ? bags * bPrice : null;
  const fmtEur = n => n.toLocaleString("et-EE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const hasAnyInput = Boolean(areaManual || lenMm || widMm || avgH || ca || cb || cc || cd || rate || bagKg || bagPrice);

  // ── Render ─────────────────────────────────────────────────────────────────

  return /*#__PURE__*/React.createElement("div", {
    className: "page-scroll"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "page-inner",
    gap: 5
  }, /*#__PURE__*/React.createElement("div", {
    className: "layout-split"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "calc-main-stack",
    gap: 4
  }, /*#__PURE__*/React.createElement("div", {
    className: "section unboxed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Area & Thickness")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-wrap section-pad"
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "seg-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir" + (areaMode === "direct" ? " on" : ""),
    onClick: () => setAreaMode("direct")
  }, "Enter area"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir" + (areaMode === "dims" ? " on" : ""),
    onClick: () => setAreaMode("dims")
  }, "Dimensions")), /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-content"
  }, areaMode === "direct" && /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-area",
    label: "Area (m\xB2)",
    value: areaManual,
    min: 0,
    step: 0.1,
    onChange: v => setAreaManual(String(v)),
    req: hasAnyInput && !areaManual
  }), areaMode === "dims" && /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-grid-2col",
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-len",
    label: "Length (mm)",
    value: lenMm,
    min: 1,
    step: 10,
    onChange: setLenMm,
    req: hasAnyInput && !lenMm
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-wid",
    label: "Width (mm)",
    value: widMm,
    min: 1,
    step: 10,
    onChange: setWidMm,
    req: hasAnyInput && !widMm
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Calculated area",
    value: computedDimsArea.toFixed(1),
    unit: "m\xB2"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-divider"
  }), /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "seg-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir" + (thickMode === "avg" ? " on" : ""),
    onClick: () => setThickMode("avg")
  }, "Avg thickness"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir" + (thickMode === "corners" ? " on" : ""),
    onClick: () => setThickMode("corners")
  }, "4 corners")), /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-content"
  }, thickMode === "avg" && /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-havg",
    label: "Average thickness (mm)",
    value: avgH,
    min: 1,
    step: 1,
    onChange: setAvgH,
    req: hasAnyInput && !avgH
  }), thickMode === "corners" && /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-grid-2col",
    style: {
      marginBottom: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-ca",
    label: "Corner A (mm)",
    value: ca,
    min: 0,
    step: 1,
    onChange: setCa,
    req: hasAnyInput && !ca
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-cb",
    label: "Corner B (mm)",
    value: cb,
    min: 0,
    step: 1,
    onChange: setCb,
    req: hasAnyInput && !cb
  })), /*#__PURE__*/React.createElement("div", {
    className: "pw-grid-2col",
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-cc",
    label: "Corner C (mm)",
    value: cc,
    min: 0,
    step: 1,
    onChange: setCc,
    req: hasAnyInput && !cc
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-cd",
    label: "Corner D (mm)",
    value: cd,
    min: 0,
    step: 1,
    onChange: setCd,
    req: hasAnyInput && !cd
  })))))))), /*#__PURE__*/React.createElement("div", {
    className: "section unboxed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "u-flex-row",
    style: {
      flex: 1,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Consumption & Packaging"), /*#__PURE__*/React.createElement("span", {
    className: "pw-updated-note" + (showUpdated ? " pw-updated-note-visible" : "")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), " updated"))), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-wrap section-pad"
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "num-input-wrap-relative" + (fieldFlash ? " num-input-flash" : ""),
    ref: rateInputRef,
    onClick: () => setShowRatePresets(true)
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-rate",
    label: "Consumption (kg/m\xB2\xB7mm)",
    value: rate,
    min: 0.1,
    step: 0.1,
    onChange: handleRateChange,
    req: hasAnyInput && !rate,
    onFocus: () => setShowRatePresets(true),
    onCommit: () => setShowRatePresets(false),
    onKeyDown: onKeyDown
  }), showRatePresets && validPresets.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "rate-presets-dropdown"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rate-presets-header"
  }, "Quick Presets"), /*#__PURE__*/React.createElement("div", {
    className: "rate-presets-list",
    role: "listbox"
  }, validPresets.map((p, idx) => {
    const originalIdx = presets.indexOf(p);
    const isActive = activePreset === originalIdx;
    const isHovered = hoveredIndex === idx;
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      role: "option",
      "aria-selected": isHovered,
      className: "rate-preset-item" + (isActive ? " active" : "") + (isHovered ? " focused" : ""),
      onMouseDown: e => {
        e.preventDefault();
        e.stopPropagation();
        applyPreset(p, originalIdx);
        setShowRatePresets(false);
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "rate-preset-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-name"
    }, p.name), /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-meta"
    }, p.bagKg, "kg \xB7 ", p.bagPrice, "\u20AC")), /*#__PURE__*/React.createElement("span", {
      className: "rate-preset-val"
    }, p.rate, " ", /*#__PURE__*/React.createElement("small", null, "kg")));
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "concrete-split-divider"
  }), /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: fieldFlash ? "num-input-flash" : ""
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-bagkg",
    label: "Bag weight (kg)",
    value: bagKg,
    min: 1,
    step: 1,
    onChange: handleBagKgChange,
    req: hasAnyInput && !bagKg
  })), /*#__PURE__*/React.createElement("div", {
    className: fieldFlash ? "num-input-flash" : ""
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-slf-bagprice",
    label: "Bag price (\u20AC)",
    value: bagPrice,
    min: 0,
    step: 0.01,
    onChange: handleBagPriceChange
  })))))), /*#__PURE__*/React.createElement(DetailSection, {
    title: "Product Presets",
    open: false
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-header"
  }, /*#__PURE__*/React.createElement("span", null, "Product Name"), /*#__PURE__*/React.createElement("span", null, "kg/m\xB2\xB7mm"), /*#__PURE__*/React.createElement("span", null, "Bag kg"), /*#__PURE__*/React.createElement("span", null, "Price \u20AC"), /*#__PURE__*/React.createElement("span", null, "\xA0")), presets.map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-fields"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Product Name"), /*#__PURE__*/React.createElement("input", {
    id: `preset-name-${idx}`,
    name: `preset-name-${idx}`,
    type: "text",
    className: "num-input",
    placeholder: "Product description...",
    value: p.name,
    onChange: e => updatePreset(idx, "name", e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "kg/m\xB2\xB7mm"), /*#__PURE__*/React.createElement("input", {
    id: `preset-rate-${idx}`,
    name: `preset-rate-${idx}`,
    type: "number",
    className: "num-input",
    value: p.rate,
    onChange: e => updatePreset(idx, "rate", e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Bag kg"), /*#__PURE__*/React.createElement("input", {
    id: `preset-bagkg-${idx}`,
    name: `preset-bagkg-${idx}`,
    type: "number",
    className: "num-input",
    value: p.bagKg,
    onChange: e => updatePreset(idx, "bagKg", e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Price \u20AC"), /*#__PURE__*/React.createElement("input", {
    id: `preset-price-${idx}`,
    name: `preset-price-${idx}`,
    type: "number",
    className: "num-input",
    value: p.bagPrice,
    onChange: e => updatePreset(idx, "bagPrice", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "num-wrap",
    style: {
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "\xA0"), activePreset === idx ? /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-badge"
  }, "active") : /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : ""),
    onClick: () => applyPreset(p, idx),
    title: "Apply these values to the calculator"
  }, flashIdx === idx ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), " Applied") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), " Apply"))))))), /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 2
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir",
    onClick: addPreset
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Add Row"), /*#__PURE__*/React.createElement(SaveDefaultsButton, {
    status: presetSaveStatus,
    onClick: saveConcreteDefaults
  })), /*#__PURE__*/React.createElement("div", {
    className: "pw-formula-text",
    style: {
      opacity: 0.7
    }
  }, "Fill product data above and click \"Apply\" to update the calculator values."))), /*#__PURE__*/React.createElement("div", {
    className: "section unboxed",
    style: {
      marginTop: 'var(--sp-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Calculation Details")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 1
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Floor area",
    value: area.toFixed(1),
    unit: "m\xB2"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Avg thickness",
    value: Math.round(computedAvgH),
    unit: "mm"
  }), diff !== null && /*#__PURE__*/React.createElement(Row, {
    label: "Height difference",
    value: Math.round(diff),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Total mix mass",
    value: mass > 0 ? mass.toFixed(1) : "0.0",
    unit: "kg"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Exact bags calculated",
    value: bagsExact > 0 ? bagsExact.toFixed(2) : "0.00",
    unit: "pcs"
  }), /*#__PURE__*/React.createElement("div", {
    className: "pw-formula-wrap",
    style: {
      marginTop: "1rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-formula-text"
  }, "mass = area \xD7 avg thickness \xD7 consumption rate")), /*#__PURE__*/React.createElement("div", {
    className: "pw-formula-wrap",
    style: {
      paddingBottom: "1rem"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-formula-text"
  }, "Results are approximate \u2014 actual consumption may vary due to substrate absorption and mixing residue.")))))), /*#__PURE__*/React.createElement("div", {
    className: "u-sticky u-sticky-top",
    style: {
      marginTop: 'var(--sticky-offset)',
      top: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "result-card-title"
  }, "Bags Needed"), /*#__PURE__*/React.createElement("span", {
    className: "result-card-value"
  }, bags > 0 ? bags : "0", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-md)',
      fontWeight: 'var(--fw-reg)',
      opacity: 0.8,
      marginLeft: '4px'
    }
  }, "pcs")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 'var(--fs-md)',
      color: 'var(--color-gray-opa80)',
      marginTop: '-2px'
    }
  }, "exact: ", bagsExact > 0 ? bagsExact.toFixed(2) : "0.00", " pcs"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--sp-4)',
      paddingTop: 'var(--sp-4)',
      borderTop: '1px solid color-mix(in srgb, var(--color-white) 15%, transparent)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "result-card-title"
  }, "Total Price"), /*#__PURE__*/React.createElement("span", {
    className: "result-card-value",
    style: {
      fontSize: 'var(--fs-xl)',
      display: 'flex',
      alignItems: 'baseline',
      gap: '6px'
    }
  }, totalPrice !== null ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-lg)',
      opacity: 0.8
    }
  }, "\u20AC"), /*#__PURE__*/React.createElement("span", null, fmtEur(totalPrice))) : "—"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'var(--sp-4)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: resetAll,
    style: {
      width: '100%',
      padding: '12px',
      fontSize: 'var(--fs-md)',
      borderRadius: '6px',
      textAlign: 'center',
      background: 'transparent',
      border: '1px solid color-mix(in srgb, var(--color-gray) 40%, transparent)',
      color: 'var(--color-gray)',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'center',
      gap: '8px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw"
  }), " Global Reset"))))));
}
const PRESETS = [100, 125, 160, 200];
function PipeWrapCalculator() {
  const [pipeDiam, setPipeDiam] = React.useState("");
  const [matThick, setMatThick] = React.useState("");
  const [overlap, setOverlap] = React.useState("");
  const [gap, setGap] = React.useState("");
  const d = parseFloat(pipeDiam) || 0;
  const t = parseFloat(matThick) || 0;
  const o = parseFloat(overlap) || 0;
  const g = parseFloat(gap) || 0;
  const outer = d + 2 * t;
  const base = Math.PI * outer;
  const total = Math.max(0, base + o - g);
  const [adjOpen, setAdjOpen] = React.useState(false);

  // ── Diagram calculations ───────────────────────────────────────────────────
  const cx = 100,
    cy = 90,
    maxR = 72;
  const totalR_mm = d / 2 + t || 1;
  const refR_mm = 110;
  const scale = maxR / Math.max(refR_mm, totalR_mm);
  const rP = d / 2 * scale;
  const rO = totalR_mm * scale;
  const gapAngle = outer > 0 ? g / (Math.PI * outer) * Math.PI * 2 : 0;
  const overAngle = outer > 0 ? o / (Math.PI * outer) * Math.PI * 2 : 0;
  const getArcPath = (r, startA, endA) => {
    const x1 = cx + r * Math.cos(startA),
      y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA),
      y2 = cy + r * Math.sin(endA);
    const lg = endA - startA > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
  };

  // Text vertical positions
  const ty1 = 28;
  const ty2 = ty1 + 20;
  const ty3 = ty2 + (o > 0 ? 20 : 0);
  const tyTotal = ty1 + (o > 0 ? 20 : 0) + (g > 0 ? 20 : 0) + 22;
  const tyLegend = tyTotal + 14;
  return /*#__PURE__*/React.createElement("div", {
    className: "page-scroll"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "page-inner",
    gap: 5
  }, /*#__PURE__*/React.createElement("div", {
    className: "layout-split"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "calc-main-stack",
    gap: 4
  }, /*#__PURE__*/React.createElement("div", {
    className: "section unboxed"
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Dimensions")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-grid-2col",
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-pipeDiam",
    label: "Pipe outer diameter (mm)",
    value: pipeDiam,
    min: 1,
    onChange: setPipeDiam
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-matThick",
    label: "Material thickness (mm)",
    value: matThick,
    min: 0,
    onChange: setMatThick
  })), /*#__PURE__*/React.createElement(Stack, {
    gap: 2
  }, /*#__PURE__*/React.createElement("div", {
    className: "num-lbl pw-preset-label"
  }, "Pipe diameter presets"), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-btns"
  }, PRESETS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    className: `pill-btn${pipeDiam === p ? " on" : ""}`,
    onClick: () => setPipeDiam(p)
  }, "\xD8 ", p))))))), /*#__PURE__*/React.createElement(Section, {
    title: "Adjustments",
    open: adjOpen,
    setOpen: setAdjOpen
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 3
  }, /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 3,
    className: "pw-adj-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl pw-adj-label"
  }, "Overlap / extra (mm)"), /*#__PURE__*/React.createElement(RangeSlider, {
    id: "input-overlap",
    min: 0,
    max: 200,
    step: 5,
    value: overlap,
    className: "pw-adj-range",
    onChange: e => setOverlap(e.target.value)
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-overlap-val",
    value: overlap,
    min: 0,
    max: 200,
    step: 1,
    onChange: setOverlap
  })), /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 3,
    className: "pw-adj-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl pw-adj-label"
  }, "Gap / cutout (mm)"), /*#__PURE__*/React.createElement(RangeSlider, {
    id: "input-gap",
    min: 0,
    max: 200,
    step: 5,
    value: gap,
    className: "pw-adj-range",
    onChange: e => setGap(e.target.value)
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-gap-val",
    value: gap,
    min: 0,
    max: 200,
    step: 1,
    onChange: setGap
  })))), /*#__PURE__*/React.createElement("div", {
    className: "section unboxed",
    style: {
      marginTop: 'var(--sp-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", null, "Calculation Details")), /*#__PURE__*/React.createElement("div", {
    className: "section-body"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-res-wrap"
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Outer diameter",
    value: outer.toFixed(1),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Base wrap length",
    value: base.toFixed(1),
    unit: "mm"
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Calculated total",
    value: total.toFixed(1),
    unit: "mm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "pw-diag-wrap"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 420 180",
    width: "100%",
    className: "pw-diag-svg"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: rO,
    fill: "color-mix(in srgb, var(--color-gray-light) 80%, transparent)",
    stroke: "var(--color-gray)",
    strokeWidth: "0.5"
  }), g > 0 && /*#__PURE__*/React.createElement("path", {
    d: getArcPath(rO, -Math.PI / 2, -Math.PI / 2 + gapAngle),
    fill: "color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)",
    stroke: "var(--color-gray)",
    strokeWidth: "0.5"
  }), o > 0 && /*#__PURE__*/React.createElement("path", {
    d: getArcPath(rO, -Math.PI / 2 + gapAngle, -Math.PI / 2 + gapAngle + overAngle),
    fill: "color-mix(in srgb, var(--color-blue) 35%, transparent)",
    stroke: "var(--color-blue)",
    strokeWidth: "0.5",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: rP,
    fill: "var(--color-darkblue)",
    stroke: "var(--color-gray)",
    strokeWidth: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy - 4,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '9px',
      fill: 'var(--color-gray-opa80)'
    },
    textAnchor: "middle"
  }, "pipe"), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 8,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '9px',
      fill: 'var(--color-gray-opa80)'
    },
    textAnchor: "middle"
  }, "\xD8", d, "mm"), /*#__PURE__*/React.createElement("text", {
    x: "230",
    y: ty1,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      fill: 'var(--color-gray-opa80)'
    }
  }, "\u03C0 \xD7 (", d, " + 2\xD7", t, ") = ", base.toFixed(1), " mm"), o > 0 && /*#__PURE__*/React.createElement("text", {
    x: "230",
    y: ty2,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      fill: 'var(--color-blue)'
    }
  }, "+ overlap ", o, " mm"), g > 0 && /*#__PURE__*/React.createElement("text", {
    x: "230",
    y: ty3,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      fill: 'var(--color-gray-opa80)'
    }
  }, "\u2212 gap ", g, " mm"), /*#__PURE__*/React.createElement("text", {
    x: "230",
    y: tyTotal,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '14px',
      fontWeight: 700,
      fill: 'var(--color-primary)'
    }
  }, "= ", total.toFixed(1), " mm"), g > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "230",
    y: tyLegend,
    width: "9",
    height: "9",
    rx: "2",
    fill: "color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)",
    stroke: "var(--color-gray)",
    strokeWidth: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: "243",
    y: tyLegend + 8,
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '10px',
      fill: 'var(--color-gray-opa80)'
    }
  }, "gap")), o > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
    x: "230",
    y: tyLegend + (g > 0 ? 16 : 0),
    width: "9",
    height: "9",
    rx: "2",
    fill: "color-mix(in srgb, var(--color-blue) 35%, transparent)",
    stroke: "var(--color-blue)",
    strokeWidth: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: "243",
    y: tyLegend + 8 + (g > 0 ? 16 : 0),
    style: {
      fontFamily: 'var(--mono)',
      fontSize: '10px',
      fill: 'var(--color-blue)'
    }
  }, "overlap")))), /*#__PURE__*/React.createElement("div", {
    className: "pw-formula-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-formula-text"
  }, "formula: \u03C0 \xD7 (pipe \xD8 + 2 \xD7 thickness) + overlap \u2212 gap")))))), /*#__PURE__*/React.createElement("div", {
    className: "u-sticky u-sticky-top",
    style: {
      marginTop: 'var(--sticky-offset)',
      top: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "result-card"
  }, /*#__PURE__*/React.createElement("span", {
    className: "result-card-title"
  }, "Final length needed"), /*#__PURE__*/React.createElement("span", {
    className: "result-card-value"
  }, (total / 10).toFixed(1), " cm"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--color-gray-opa80)'
    }
  }, total.toFixed(1), " mm"))))));
}
function SheetHome({
  page,
  setPage
}) {
  const items = PAGES.filter(pg => !pg.noNav);
  return /*#__PURE__*/React.createElement("div", {
    className: "home-scroll"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "home-inner",
    gap: 3
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "home-brand",
    gap: 1
  }, /*#__PURE__*/React.createElement("div", {
    className: "home-brand-name"
  }, "NEMETONA"), /*#__PURE__*/React.createElement("div", {
    className: "home-brand-sub"
  }, "MASTERPLAN")), /*#__PURE__*/React.createElement("div", {
    className: "home-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "home-cards"
  }, items.map(pg => {
    if (pg.isParent) return null;
    const isActive = page === pg.id;
    return /*#__PURE__*/React.createElement(Stack, {
      key: pg.id,
      as: "button",
      className: "home-card" + (isActive ? " home-card-active" : ""),
      gap: 3,
      onClick: () => setPage(pg.id),
      onKeyDown: e => (e.key === "Enter" || e.key === " ") && setPage(pg.id)
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
function SheetGoldenRatio({
  grItems: baseItems,
  setGrItems: setBaseItems
}) {
  const [baseOpen, setBaseOpen] = React.useState(true);
  const link = useLinkedCardHighlight("golden-ratio");
  const PHI = 1.6180339887499;
  const [committedIds, addCommittedId, removeCommittedId, clearCommittedIds] = useTimedSet(600);
  const flashCommit = id => {
    addCommittedId(id);
  };
  React.useEffect(() => () => clearCommittedIds(), []);
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
  const commitBaseValue = (id, flash = false) => {
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
    if (flash) flashCommit(id);
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
  const normalizeGoldenRatioDefaults = items => items.map(item => ({
    id: item.id,
    value: item.value,
    suffix: item.suffix,
    saved: {
      value: item.value,
      suffix: item.suffix
    },
    savedCommitted: String(item.value).trim() !== ""
  }));
  const [saveStatus, setSaveStatus] = useTimedState("");
  const saveGoldenRatioDefaults = async () => {
    setSaveStatus("saving", 0);
    try {
      const nextDefaults = normalizeGoldenRatioDefaults(baseItems);
      await safeSaveStaticDefaults("goldenRatioDefaults", nextDefaults);
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-base-number",
    title: "Base Number",
    open: baseOpen,
    setOpen: setBaseOpen
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--sp-4) var(--sp-4) var(--sp-4)",
      display: "flex",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(SaveDefaultsButton, {
    status: saveStatus,
    onClick: saveGoldenRatioDefaults
  })), /*#__PURE__*/React.createElement(Stack, {
    gap: 2
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
    }, link.bindControl(item.id)), /*#__PURE__*/React.createElement(Stack, {
      className: "panel-data",
      gap: 3
    }, /*#__PURE__*/React.createElement(Stack, {
      gap: 1,
      className: "num-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "num-lbl"
    }, valueInputLabel), /*#__PURE__*/React.createElement("div", {
      className: "num-row"
    }, /*#__PURE__*/React.createElement("input", {
      id: `input-base-number-field-${item.id}`,
      name: `input-base-number-field-${item.id}`,
      className: "num-input",
      type: "number",
      value: item.value,
      min: 1,
      step: 10,
      onChange: e => setItemField(item.id, "value", e.target.value),
      onBlur: () => commitBaseValue(item.id, false),
      onKeyDown: e => e.key === "Enter" && commitBaseValue(item.id, true)
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "num-btn",
      onClick: () => commitBaseValue(item.id, true)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "corner-down-left"
    })))), /*#__PURE__*/React.createElement(Stack, {
      gap: 1,
      className: "ctrl-lbl"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ctrl-sublbl"
    }, "Custom label"), /*#__PURE__*/React.createElement("div", {
      className: "num-row"
    }, /*#__PURE__*/React.createElement("input", {
      id: `input-base-label-suffix-${item.id}`,
      name: `input-base-label-suffix-${item.id}`,
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
    })))), /*#__PURE__*/React.createElement(Stack, {
      gap: 1,
      className: "ctrl-lbl"
    }, /*#__PURE__*/React.createElement("span", {
      className: "ctrl-sublbl"
    }, "Entry"), /*#__PURE__*/React.createElement(Stack, {
      direction: "row",
      gap: 1,
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
  })))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "gr-preview-list",
    gap: 3
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "sys-head",
    gap: 1
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
    }, /*#__PURE__*/React.createElement(Stack, {
      className: "section-pad gr-section-pad",
      gap: 3
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
function GuiderLihtluliti() {
  return /*#__PURE__*/React.createElement(Stack, {
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "sys-head",
    gap: 1
  }, /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "guider",
    className: "sys-title-icon"
  }), " Lihtl\xFCliti"), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, "Valgusti ja l\xFCliti skeem \u2014 1-juhtmeline l\xFClitus")), /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-5) var(--sp-4) var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: "var(--sp-4)",
      paddingBottom: "var(--sp-3)",
      borderBottom: "1px solid var(--border)"
    }
  }, "Skeem"), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 560 310",
    width: "100%",
    "aria-label": "Valgusti ja l\xFCliti skeem",
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "110",
    y1: "190",
    x2: "175",
    y2: "190",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "275",
    y1: "190",
    x2: "275",
    y2: "80",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "275",
    y1: "80",
    x2: "346",
    y2: "80",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "110",
    y1: "240",
    x2: "460",
    y2: "240",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "460",
    y1: "240",
    x2: "460",
    y2: "80",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "414",
    y1: "80",
    x2: "460",
    y2: "80",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "110",
    cy: "190",
    r: "4.5",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "110",
    cy: "240",
    r: "4.5",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("text", {
    x: "14",
    y: "190",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fontWeight: "700",
      fill: "var(--text)"
    }
  }, "Toide L"), /*#__PURE__*/React.createElement("text", {
    x: "14",
    y: "240",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fontWeight: "700",
      fill: "var(--text)"
    }
  }, "Toide N"), /*#__PURE__*/React.createElement("rect", {
    x: "155",
    y: "168",
    width: "140",
    height: "44",
    rx: "5",
    fill: "none",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2",
    strokeDasharray: "6 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "175",
    cy: "190",
    r: "4",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "275",
    cy: "190",
    r: "4",
    fill: "none",
    stroke: "var(--text)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "175",
    y1: "190",
    x2: "266",
    y2: "172",
    stroke: "var(--text)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "225",
    y: "158",
    textAnchor: "middle",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "11px",
      fill: "var(--text-muted)"
    }
  }, "L\xFCliti"), /*#__PURE__*/React.createElement("line", {
    x1: "275",
    y1: "80",
    x2: "275",
    y2: "73",
    stroke: "var(--viz-carry)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "437",
    y1: "80",
    x2: "437",
    y2: "73",
    stroke: "var(--accent)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "380",
    cy: "80",
    r: "34",
    fill: "none",
    stroke: "var(--text-muted)",
    strokeWidth: "2.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "356",
    y1: "56",
    x2: "404",
    y2: "104",
    stroke: "var(--text-muted)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "404",
    y1: "56",
    x2: "356",
    y2: "104",
    stroke: "var(--text-muted)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "380",
    y: "30",
    textAnchor: "middle",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fill: "var(--text-muted)"
    }
  }, "Valgusti"), /*#__PURE__*/React.createElement("line", {
    x1: "155",
    y1: "272",
    x2: "185",
    y2: "272",
    stroke: "var(--viz-carry)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "192",
    y: "276",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "10px",
      fill: "var(--text-muted)"
    }
  }, "faas (L)"), /*#__PURE__*/React.createElement("line", {
    x1: "155",
    y1: "292",
    x2: "185",
    y2: "292",
    stroke: "var(--accent)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "192",
    y: "296",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "10px",
      fill: "var(--text-muted)"
    }
  }, "null (N)")))), /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-3) var(--sp-4)",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.12em"
    }
  }, "\xDChendused"), /*#__PURE__*/React.createElement(Stack, {
    gap: 0
  }, [{
    n: "1",
    wire: "L",
    text: "Toite faas (L) → lüliti sisend"
  }, {
    n: "2",
    wire: "L",
    text: "Lüliti väljund → valgusti (põhjaklemm)"
  }, {
    n: "3",
    wire: "N",
    text: "Valgusti null → toite null (N)"
  }].map(row => /*#__PURE__*/React.createElement("div", {
    key: row.n,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      padding: "10px var(--sp-4)",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-md)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      border: "1px solid var(--border-strong)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "var(--fs-xs)",
      color: "var(--text-subtle)",
      flexShrink: 0
    }
  }, row.n), /*#__PURE__*/React.createElement("span", {
    style: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: row.wire === "L" ? "var(--viz-carry)" : "var(--accent)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)"
    }
  }, row.text))))));
}
function GuiderVeksellulit() {
  return /*#__PURE__*/React.createElement(Stack, {
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "sys-head",
    gap: 1
  }, /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "guider",
    className: "sys-title-icon"
  }), " Veksell\xFCliti"), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, "Valgusti ja kahe l\xFClitiga skeem \u2014 3-juhtmeline veksel")), /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-5) var(--sp-4) var(--sp-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      marginBottom: "var(--sp-4)",
      paddingBottom: "var(--sp-3)",
      borderBottom: "1px solid var(--border)"
    }
  }, "Skeem"), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 640 340",
    width: "100%",
    "aria-label": "Veksell\xFCliti skeem",
    style: {
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "310",
    x2: "80",
    y2: "200",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "80",
    cy: "200",
    r: "4",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "200",
    y1: "310",
    x2: "200",
    y2: "92",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "200",
    cy: "310",
    r: "4",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("text", {
    x: "58",
    y: "330",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fontWeight: "700",
      fill: "var(--text)"
    }
  }, "L"), /*#__PURE__*/React.createElement("text", {
    x: "188",
    y: "330",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fontWeight: "700",
      fill: "var(--text)"
    }
  }, "N"), /*#__PURE__*/React.createElement("rect", {
    x: "42",
    y: "138",
    width: "132",
    height: "100",
    rx: "5",
    fill: "none",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2",
    strokeDasharray: "6 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "80",
    cy: "200",
    r: "4",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "80",
    cy: "158",
    r: "4",
    fill: "none",
    stroke: "var(--text)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "80",
    cy: "215",
    r: "4",
    fill: "none",
    stroke: "var(--text)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "200",
    x2: "80",
    y2: "162",
    stroke: "var(--text)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "158",
    x2: "155",
    y2: "158",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "80",
    y1: "215",
    x2: "155",
    y2: "215",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "155",
    cy: "158",
    r: "3",
    fill: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "155",
    cy: "215",
    r: "3",
    fill: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("text", {
    x: "108",
    y: "258",
    textAnchor: "middle",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "11px",
      fill: "var(--text-muted)"
    }
  }, "L\xFCliti 1"), /*#__PURE__*/React.createElement("line", {
    x1: "155",
    y1: "158",
    x2: "475",
    y2: "158",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "155",
    y1: "215",
    x2: "475",
    y2: "215",
    stroke: "var(--sys-s3)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "458",
    y: "138",
    width: "132",
    height: "100",
    rx: "5",
    fill: "none",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2",
    strokeDasharray: "6 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "475",
    cy: "158",
    r: "3",
    fill: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "475",
    cy: "215",
    r: "3",
    fill: "var(--text-subtle)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "475",
    y1: "158",
    x2: "550",
    y2: "158",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "475",
    y1: "215",
    x2: "550",
    y2: "215",
    stroke: "var(--text-subtle)",
    strokeWidth: "1.2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "550",
    cy: "158",
    r: "4",
    fill: "none",
    stroke: "var(--text)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "550",
    cy: "215",
    r: "4",
    fill: "none",
    stroke: "var(--text)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "550",
    cy: "185",
    r: "4",
    fill: "var(--text)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "550",
    y1: "215",
    x2: "550",
    y2: "189",
    stroke: "var(--text)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "524",
    y: "258",
    textAnchor: "middle",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "11px",
      fill: "var(--text-muted)"
    }
  }, "L\xFCliti 2"), /*#__PURE__*/React.createElement("line", {
    x1: "550",
    y1: "185",
    x2: "580",
    y2: "185",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "580",
    y1: "185",
    x2: "580",
    y2: "60",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "232",
    y1: "60",
    x2: "580",
    y2: "60",
    stroke: "var(--viz-carry)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "200",
    cy: "60",
    r: "32",
    fill: "none",
    stroke: "var(--text-muted)",
    strokeWidth: "2.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "177",
    y1: "37",
    x2: "223",
    y2: "83",
    stroke: "var(--text-muted)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "223",
    y1: "37",
    x2: "177",
    y2: "83",
    stroke: "var(--text-muted)",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "200",
    y: "18",
    textAnchor: "middle",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "12px",
      fill: "var(--text-muted)"
    }
  }, "Valgusti"), /*#__PURE__*/React.createElement("line", {
    x1: "230",
    y1: "280",
    x2: "258",
    y2: "280",
    stroke: "var(--viz-carry)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "265",
    y: "284",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "10px",
      fill: "var(--text-muted)"
    }
  }, "faas (L)"), /*#__PURE__*/React.createElement("line", {
    x1: "230",
    y1: "298",
    x2: "258",
    y2: "298",
    stroke: "var(--accent)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "265",
    y: "302",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "10px",
      fill: "var(--text-muted)"
    }
  }, "null (N)"), /*#__PURE__*/React.createElement("line", {
    x1: "230",
    y1: "316",
    x2: "258",
    y2: "316",
    stroke: "var(--sys-s3)",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("text", {
    x: "265",
    y: "320",
    style: {
      fontFamily: "var(--mono)",
      fontSize: "10px",
      fill: "var(--text-muted)"
    }
  }, "veksel (kommuteeriv juhe)")))), /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-3) var(--sp-4)",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-sm)",
      color: "var(--text-subtle)",
      textTransform: "uppercase",
      letterSpacing: "0.12em"
    }
  }, "\xDChendused"), /*#__PURE__*/React.createElement(Stack, {
    gap: 0
  }, [{
    n: "1",
    color: "var(--viz-carry)",
    text: "Toite faas (L) → Lüliti 1 ühisklemmile"
  }, {
    n: "2",
    color: "var(--viz-carry)",
    text: "Lüliti 1 väljund 1 ↔ Lüliti 2 sisend 1 (vekseltraat)"
  }, {
    n: "3",
    color: "var(--sys-s3)",
    text: "Lüliti 1 väljund 2 ↔ Lüliti 2 sisend 2 (vekseltraat)"
  }, {
    n: "4",
    color: "var(--viz-carry)",
    text: "Lüliti 2 ühisklemmilt → valgusti (põhjaklemm)"
  }, {
    n: "5",
    color: "var(--accent)",
    text: "Toite null (N) → valgusti nullklemmile"
  }].map(row => /*#__PURE__*/React.createElement("div", {
    key: row.n,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--sp-3)",
      padding: "10px var(--sp-4)",
      borderBottom: "1px solid var(--border)",
      fontFamily: "var(--mono)",
      fontSize: "var(--fs-md)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      border: "1px solid var(--border-strong)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "var(--fs-xs)",
      color: "var(--text-subtle)",
      flexShrink: 0
    }
  }, row.n), /*#__PURE__*/React.createElement("span", {
    style: {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: row.color,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-muted)"
    }
  }, row.text))))));
}
function SheetGuider() {
  const [listOpen, setListOpen] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState(null);
  const ENTRIES = [{
    id: "lihtluliti",
    label: "Lihtlüliti"
  }, {
    id: "veksellulit",
    label: "Veksellüliti"
  }
  // more entries added here later
  ];
  const selected = ENTRIES.find(e => e.id === selectedId) || null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    id: "data-control",
    className: "data-control"
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-guider-list",
    title: "Electrism",
    open: listOpen,
    setOpen: setListOpen
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 1
  }, ENTRIES.map(entry => /*#__PURE__*/React.createElement("button", {
    key: entry.id,
    type: "button",
    className: "ctrl-dir" + (selectedId === entry.id ? " on" : ""),
    onClick: () => setSelectedId(selectedId === entry.id ? null : entry.id)
  }, entry.label))))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3,
    className: "guider-preview-list"
  }, selected ? selected.id === "lihtluliti" ? /*#__PURE__*/React.createElement(GuiderLihtluliti, null) : selected.id === "veksellulit" ? /*#__PURE__*/React.createElement(GuiderVeksellulit, null) : /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 2
  }, /*#__PURE__*/React.createElement("div", {
    className: "data-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "data-row-lbl"
  }, selected.label)), /*#__PURE__*/React.createElement("div", {
    className: "ctrl-sublbl"
  }, "Data for ", selected.label, " will be added here later."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stack, {
    className: "sys-head",
    gap: 1
  }, /*#__PURE__*/React.createElement("h3", {
    className: "sys-title"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "guider",
    className: "sys-title-icon"
  }), " Guider"), /*#__PURE__*/React.createElement("span", {
    className: "sys-head-sub"
  }, "Select an entry to view details")), /*#__PURE__*/React.createElement("div", {
    className: "sys-block"
  }, /*#__PURE__*/React.createElement(Stack, {
    className: "section-pad",
    gap: 2
  }, /*#__PURE__*/React.createElement("div", {
    className: "ctrl-sublbl"
  }, "No entry selected. Pick one from the panel on the left.")))))));
}
function SheetSymmetricLayout({
  sym,
  setSym
}) {
  const [hoveredType, setHoveredType] = React.useState(null);

  // ── Material presets (shared with pattern layouts) ─────────────────────────
  const presets = React.useMemo(() => (typeof DEFAULT_MATERIAL_PRESETS !== "undefined" ? DEFAULT_MATERIAL_PRESETS : []).filter(p => p.name), []);
  const [activePreset, setActivePreset] = React.useState(null);
  const [showWidDropdown, setShowWidDropdown] = React.useState(false);
  const widWrapRef = React.useRef(null);
  useClickOutside([widWrapRef], () => setShowWidDropdown(false));
  const applyPreset = (p, idx) => {
    setSym(s => ({
      ...s,
      panelWidth: p.width
    }));
    setActivePreset(idx);
    setShowWidDropdown(false);
  };
  const {
    hoveredIndex,
    onKeyDown
  } = useDropdownKeyboard(showWidDropdown ? presets.length : 0, idx => applyPreset(presets[idx], idx), () => setShowWidDropdown(false));
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
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stack, {
    id: "data-control",
    className: "data-control",
    gap: 3
  }, /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-sym-surface",
    title: "Inputs",
    noToggle: true
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-sym-room-width",
    label: "Area width (mm)",
    value: sym.roomWidth,
    onChange: v => setSym(s => ({
      ...s,
      roomWidth: clampNumber(v, 100, 50000, 100)
    })),
    step: 10,
    min: 100
  }), /*#__PURE__*/React.createElement("div", {
    ref: widWrapRef,
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-sym-panel-width",
    label: "Product width (mm)",
    value: sym.panelWidth,
    onChange: v => {
      setSym(s => ({
        ...s,
        panelWidth: clampNumber(v, 100, 8000, 100)
      }));
      setActivePreset(null);
    },
    step: 10,
    min: 100,
    onFocus: () => setShowWidDropdown(true),
    onCommit: () => setShowWidDropdown(false),
    onKeyDown: onKeyDown
  }), showWidDropdown && presets.length > 0 && /*#__PURE__*/React.createElement(MaterialPresetDropdown, {
    anchorRef: widWrapRef,
    presets: presets,
    activePreset: activePreset,
    onApply: applyPreset,
    field: "width",
    hoveredIndex: hoveredIndex
  })))), /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-sym-settings",
    title: "Settings",
    noToggle: true
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 1,
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Layout style"), /*#__PURE__*/React.createElement("div", {
    className: "seg-group"
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
  }, "Symmetric"))), sym.oneFullEdge && /*#__PURE__*/React.createElement(NumInput, {
    id: "input-sym-custom-first",
    label: "First piece width (mm)",
    value: sym.customFirstPieceWidth ?? "",
    onChange: v => setSym(s => ({
      ...s,
      customFirstPieceWidth: clampNumber(v, 0, 50000, 0)
    })),
    step: 10,
    min: 0
  })))), /*#__PURE__*/React.createElement("div", {
    id: "data-preview",
    className: "data-preview"
  }, /*#__PURE__*/React.createElement(LayoutPanel, {
    layout: layout,
    result: result,
    hoveredType: hoveredType,
    setHoveredType: setHoveredType,
    isBest: false,
    noToggle: true
  })));
}
function SheetSurfaceLayout({
  sh,
  setSh,
  panelOpen,
  setPanelOpen
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
    patternStart: psRaw
  } = sh;
  const rowStart = sh.rowStart || "top";
  const patternStart = psRaw || (direction === "V" ? "bottom" : "left");
  const [hoveredType, setHoveredType] = React.useState(null);
  const [settingsOpen, setSettingsOpen] = React.useState(true);

  // ── Material presets ───────────────────────────────────────────────────────
  const [presets, setPresets] = React.useState(() => (typeof DEFAULT_MATERIAL_PRESETS !== "undefined" ? DEFAULT_MATERIAL_PRESETS : [{
    name: "",
    length: 300,
    width: 300
  }]).map(p => ({
    ...p
  })));
  const [activePreset, setActivePreset] = React.useState(null);
  const [flashIdx, setFlashIdx] = useTimedState(null, 1200);
  const [showModal, setShowModal] = React.useState(false);
  const [largePreview, setLargePreview] = React.useState(null);
  const [fieldFlash, setFieldFlash] = useTimedState(false, 900);
  const [presetSaveStatus, setPresetSaveStatus] = useTimedState("");
  const [activePresetDropdown, setActivePresetDropdown] = React.useState(null);
  const openLargePreview = (layout, result) => setLargePreview({
    layout,
    result
  });
  const closeLargePreview = () => setLargePreview(null);
  const applyPreset = (p, idx) => {
    setSh(s => ({
      ...s,
      PPi: p.length,
      PLa: p.width
    }));
    setActivePreset(idx);
    setFlashIdx(idx);
    setFieldFlash(true);
  };
  const updatePreset = (idx, field, val) => {
    const next = [...presets];
    next[idx] = {
      ...next[idx],
      [field]: val
    };
    setPresets(next);
  };
  const addPreset = () => setPresets([...presets, {
    name: "",
    length: "",
    width: ""
  }]);
  const saveMaterialDefaults = async () => {
    setPresetSaveStatus("saving", 0);
    try {
      await safeSaveStaticDefaults("materialPresets", presets);
      setPresetSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setPresetSaveStatus("error");
    }
  };
  const setShField = (key, normalize = v => v, resetActive = false) => value => {
    setSh(s => ({
      ...s,
      [key]: normalize(value)
    }));
    if (resetActive) setActivePreset(null);
  };
  const set = k => setShField(k, v => v, true);
  const setMat = k => setShField(k, v => clampNumber(v, 100, 8000, 100), true);
  const setSurf = k => setShField(k, v => clampNumber(v, 100, 50000, 100));
  const setS2PanelState = patch => setSh(s => ({
    ...s,
    offset: patch.offset !== undefined ? patch.offset : s.offset
  }));
  const setS4PanelState = patch => setSh(s => ({
    ...s,
    s4Long: patch.s4Long !== undefined ? patch.s4Long : s.s4Long
  }));
  const stateGetters = {
    s1: () => ({}),
    s2: () => ({
      offset
    }),
    s3: () => ({}),
    s4: () => ({
      s4Long
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
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stack, {
      id: "data-control",
      className: "data-control",
      gap: 3
    }, /*#__PURE__*/React.createElement(MaterialSpecification, {
      sh: sh,
      setSh: setSh,
      setMat: setMat,
      presets: presets,
      activePreset: activePreset,
      applyPreset: applyPreset,
      fieldFlash: fieldFlash,
      setShowModal: setShowModal,
      activePresetDropdown: activePresetDropdown,
      setActivePresetDropdown: setActivePresetDropdown
    }), /*#__PURE__*/React.createElement(SurfaceInputs, {
      sh: sh,
      setSh: setSh,
      setSurf: setSurf
    })), /*#__PURE__*/React.createElement("div", {
      id: "data-preview",
      className: "data-preview"
    }, /*#__PURE__*/React.createElement("p", {
      className: "desc"
    }, "Select all input values - all must be greater than 0!")));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Stack, {
    id: "data-control",
    className: "data-control",
    gap: 3
  }, /*#__PURE__*/React.createElement(MaterialSpecification, {
    sh: sh,
    setSh: setSh,
    setMat: setMat,
    presets: presets,
    activePreset: activePreset,
    applyPreset: applyPreset,
    fieldFlash: fieldFlash,
    setShowModal: setShowModal,
    activePresetDropdown: activePresetDropdown,
    setActivePresetDropdown: setActivePresetDropdown
  }), /*#__PURE__*/React.createElement(SurfaceInputs, {
    sh: sh,
    setSh: setSh,
    setSurf: setSurf
  }), /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-settings",
    title: "Settings",
    open: settingsOpen,
    setOpen: setSettingsOpen
  }, /*#__PURE__*/React.createElement(LayoutSettings, {
    sh: sh,
    setField: setShField,
    setSh: setSh
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
      open: panelOpen[id],
      setOpen: v => setPanelOpen(s => ({
        ...s,
        [id]: v
      })),
      onLargePreview: openLargePreview,
      isBest: panel.layout.includeInBest && panel.result.valid && panel.result.stats.total === best
    });
  }))), showModal && /*#__PURE__*/React.createElement("div", {
    className: "mp-modal-overlay",
    onMouseDown: e => {
      if (e.target === e.currentTarget) setShowModal(false);
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mp-modal"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mp-modal-head"
  }, /*#__PURE__*/React.createElement("span", null, "Manage Material Presets"), /*#__PURE__*/React.createElement("button", {
    className: "mp-modal-close",
    onClick: () => setShowModal(false)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "minus"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mp-modal-body"
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 4
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-header",
    style: {
      gridTemplateColumns: "2.2fr 1fr 1fr 84px"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Product Name"), /*#__PURE__*/React.createElement("span", null, "Width mm"), /*#__PURE__*/React.createElement("span", null, "Length mm"), /*#__PURE__*/React.createElement("span", null, "\xA0")), presets.map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "pw-preset-row" + (activePreset === idx ? " pw-preset-active" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-fields",
    style: {
      gridTemplateColumns: "2.2fr 1fr 1fr 84px"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Product Name"), /*#__PURE__*/React.createElement("input", {
    id: `mat-preset-name-${idx}`,
    name: `mat-preset-name-${idx}`,
    type: "text",
    className: "num-input",
    placeholder: "e.g. Standard Tile 300\xD7300",
    value: p.name,
    onChange: e => updatePreset(idx, "name", e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Width mm"), /*#__PURE__*/React.createElement("input", {
    id: `mat-preset-wid-${idx}`,
    name: `mat-preset-wid-${idx}`,
    type: "number",
    className: "num-input",
    value: p.width,
    onChange: e => updatePreset(idx, "width", e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "Length mm"), /*#__PURE__*/React.createElement("input", {
    id: `mat-preset-len-${idx}`,
    name: `mat-preset-len-${idx}`,
    type: "number",
    className: "num-input",
    value: p.length,
    onChange: e => updatePreset(idx, "length", e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "num-wrap",
    style: {
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-preset-lbl-hide"
  }, "\xA0"), activePreset === idx ? /*#__PURE__*/React.createElement("div", {
    className: "pw-preset-badge"
  }, "active") : /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir on pw-preset-apply" + (flashIdx === idx ? " pw-preset-flash" : ""),
    onClick: () => applyPreset(p, idx),
    title: "Apply these values to the calculator"
  }, flashIdx === idx ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), " Applied") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), " Apply"))))))), /*#__PURE__*/React.createElement(Stack, {
    direction: "row",
    gap: 2
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir",
    onClick: addPreset
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Add Row"), /*#__PURE__*/React.createElement(SaveDefaultsButton, {
    status: presetSaveStatus,
    onClick: saveMaterialDefaults
  })), /*#__PURE__*/React.createElement("div", {
    className: "pw-formula-text",
    style: {
      opacity: 0.7
    }
  }, "Fill preset data above and click \"Apply\" to update the calculator, or \"Save Defaults\" to persist."))))), largePreview && (() => {
    const currentResult = panelResultsById[largePreview.layout.id]?.result || largePreview.result;
    return /*#__PURE__*/React.createElement("div", {
      className: "mp-modal-overlay",
      onMouseDown: e => {
        if (e.target === e.currentTarget) closeLargePreview();
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mp-modal mp-modal-large"
    }, /*#__PURE__*/React.createElement("div", {
      className: "mp-modal-head"
    }, /*#__PURE__*/React.createElement("span", null, "Large layout preview \u2014 ", largePreview.layout.title), /*#__PURE__*/React.createElement("button", {
      className: "mp-modal-close",
      onClick: closeLargePreview
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "minus"
    }))), /*#__PURE__*/React.createElement("div", {
      className: "mp-modal-body"
    }, /*#__PURE__*/React.createElement(Stack, {
      gap: 4
    }, currentResult.summaryRows.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "summary-grid"
    }, /*#__PURE__*/React.createElement(PanelSummary, {
      rows: currentResult.summaryRows,
      hoveredType: hoveredType,
      setHoveredType: setHoveredType
    })), /*#__PURE__*/React.createElement("div", {
      className: "large-layout-vis-wrap data-preview",
      style: {
        background: "var(--color-bg-alt)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)"
      }
    }, /*#__PURE__*/React.createElement(LayoutVisualization, {
      result: currentResult,
      hoveredType: hoveredType,
      setHoveredType: setHoveredType,
      rowStart: rowStart,
      maxHeight: 1000,
      alwaysShowLabels: true,
      onLargePreview: closeLargePreview
    })), /*#__PURE__*/React.createElement("div", {
      className: "large-preview-grid"
    }, /*#__PURE__*/React.createElement(Stack, {
      gap: 4,
      className: "u-hide-mobile"
    }, /*#__PURE__*/React.createElement(LargePreviewMaterialSpec, {
      sh: sh,
      setSh: setSh,
      setMat: setMat,
      presets: presets,
      activePreset: activePreset,
      applyPreset: applyPreset,
      fieldFlash: fieldFlash,
      setShowModal: setShowModal
    }), /*#__PURE__*/React.createElement(SurfaceInputs, {
      sh: sh,
      setSh: setSh,
      setSurf: setSurf
    })), /*#__PURE__*/React.createElement(ControlPanel, {
      id: "control-settings-large",
      title: "Layout Engine",
      open: true,
      noToggle: true,
      className: "u-hide-mobile"
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-data"
    }, /*#__PURE__*/React.createElement(LayoutSettings, {
      sh: sh,
      setField: setShField,
      setSh: setSh
    }))), /*#__PURE__*/React.createElement(Stack, {
      gap: 4
    }, /*#__PURE__*/React.createElement(ControlPanel, {
      id: "control-stats-large",
      title: "Detailed Statistics",
      open: true,
      noToggle: true
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel-data"
    }, (() => {
      const r = currentResult.rows;
      const firstRow = rowStart === "bottom" ? r[r.length - 1] : r[0];
      const lastRow = rowStart === "bottom" ? r[0] : r[r.length - 1];
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Row, {
        label: sh.direction === "V" ? "Total columns" : "Total rows",
        value: r.length,
        unit: sh.direction === "V" ? "cols" : "rows"
      }), /*#__PURE__*/React.createElement(Row, {
        label: sh.direction === "V" ? "Left column width" : "Top row width",
        value: firstRow.h,
        unit: "mm"
      }), /*#__PURE__*/React.createElement(Row, {
        label: sh.direction === "V" ? "Right column width" : "Bottom row width",
        value: lastRow.h,
        unit: "mm"
      }));
    })())), /*#__PURE__*/React.createElement("div", {
      className: "pw-formula-text",
      style: {
        opacity: 0.6
      }
    }, "Advanced material analysis and optimized cut-list integration will appear here in the next update.")))))));
  })());
}
function LayoutSettings({
  sh,
  setField,
  setSh
}) {
  const {
    PPi,
    direction,
    minJ,
    startOff
  } = sh;
  const rowStart = sh.rowStart || "top";
  const psRaw = sh.patternStart;
  const patternStart = psRaw || (direction === "V" ? "bottom" : "left");
  const set = k => setField(k);
  return /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-3)",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
      background: "color-mix(in srgb, var(--color-primary) 6%, transparent)"
    }
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 1,
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl",
    style: {
      fontSize: "var(--fs-lg)",
      fontWeight: "var(--fw-bold)"
    }
  }, "Direction"), /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl",
    style: {
      opacity: 0.75
    }
  }, "Primary layout axis for the pattern preview.")), /*#__PURE__*/React.createElement("div", {
    id: "ctrl-direction",
    className: "seg-group",
    style: {
      marginTop: "var(--sp-2)"
    }
  }, ["V", "H"].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    className: "ctrl-dir " + (direction === s ? "on" : ""),
    onClick: () => setSh(st => {
      const curDir = st.direction;
      const rsKey = curDir === "V" ? "rowStartV" : "rowStartH";
      const psKey = curDir === "V" ? "patternStartV" : "patternStartH";
      const trsKey = s === "V" ? "rowStartV" : "rowStartH";
      const tpsKey = s === "V" ? "patternStartV" : "patternStartH";
      return {
        ...st,
        [rsKey]: st.rowStart,
        // save current rowStart
        [psKey]: st.patternStart || (curDir === "V" ? "bottom" : "left"),
        // save current patternStart
        direction: s,
        rowStart: st[trsKey] || (s === "V" ? "top" : "bottom"),
        patternStart: st[tpsKey] || (s === "V" ? "bottom" : "left")
      };
    })
  }, s)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--sp-3)",
      borderRadius: "14px",
      border: "1px solid color-mix(in srgb, var(--color-primary) 20%, transparent)",
      background: "color-mix(in srgb, var(--color-primary) 6%, transparent)"
    }
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 1,
    className: "ctrl-lbl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, direction === "V" ? "Column order" : "Row order"), /*#__PURE__*/React.createElement("div", {
    id: "ctrl-row-order",
    className: "seg-group"
  }, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (rowStart === "top" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      rowStart: "top"
    }))
  }, direction === "V" ? "R1 Left" : "R1 top"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (rowStart === "bottom" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      rowStart: "bottom"
    }))
  }, direction === "V" ? "R1 Right" : "R1 bottom"))), /*#__PURE__*/React.createElement(Stack, {
    gap: 1,
    className: "ctrl-lbl",
    style: {
      marginTop: "var(--sp-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ctrl-sublbl"
  }, "Layout Start"), /*#__PURE__*/React.createElement("div", {
    id: "ctrl-pattern-start",
    className: "seg-group"
  }, direction === "V" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (patternStart === "bottom" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      patternStart: "bottom"
    }))
  }, "bottom"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (patternStart === "top" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      patternStart: "top"
    }))
  }, "top")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (patternStart === "left" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      patternStart: "left"
    }))
  }, "left"), /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir " + (patternStart === "right" ? "on" : ""),
    onClick: () => setSh(st => ({
      ...st,
      patternStart: "right"
    }))
  }, "right"))))), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-minJ",
    label: "Min remainder (mm)",
    value: minJ,
    onChange: set("minJ"),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-startOff",
    label: "R1 start point (mm)",
    value: startOff,
    onChange: v => setField("startOff", v => Math.min(v, Math.max(1, PPi) - 1))(v),
    step: 10,
    min: 0
  }));
}
function LargePreviewMaterialSpec({
  sh,
  setSh,
  setMat,
  presets,
  activePreset,
  applyPreset,
  fieldFlash,
  setShowModal
}) {
  const [activePresetDropdown, setActivePresetDropdown] = React.useState(null);
  return /*#__PURE__*/React.createElement(MaterialSpecification, {
    sh: sh,
    setSh: setSh,
    setMat: setMat,
    presets: presets,
    activePreset: activePreset,
    applyPreset: applyPreset,
    fieldFlash: fieldFlash,
    setShowModal: setShowModal,
    activePresetDropdown: activePresetDropdown,
    setActivePresetDropdown: setActivePresetDropdown,
    isLargePreview: true
  });
}
function MaterialSpecification({
  sh,
  setMat,
  presets,
  activePreset,
  applyPreset,
  fieldFlash,
  setShowModal,
  activePresetDropdown,
  setActivePresetDropdown,
  isLargePreview = false
}) {
  const {
    PLa,
    PPi
  } = sh;
  const validPresets = presets.filter(p => p.name);
  const widWrapRef = React.useRef(null);
  const lenWrapRef = React.useRef(null);

  // If we are in the main page but Large Preview is open, disable our click-outside
  // to prevent us from closing dropdowns that belong to the modal.
  const isBackground = !isLargePreview && document.querySelector('.large-preview-overlay');
  useClickOutside([widWrapRef, lenWrapRef], () => {
    setActivePresetDropdown(null);
  }, activePresetDropdown !== null && !isBackground);
  const localApply = (p, idx) => {
    applyPreset(p, idx);
    setActivePresetDropdown(null);
  };
  const {
    hoveredIndex: widHovered,
    onKeyDown: onWidKeyDown
  } = useDropdownKeyboard(activePresetDropdown === "wid" ? validPresets.length : 0, idx => localApply(validPresets[idx], presets.indexOf(validPresets[idx])), () => setActivePresetDropdown(null));
  const {
    hoveredIndex: lenHovered,
    onKeyDown: onLenKeyDown
  } = useDropdownKeyboard(activePresetDropdown === "len" ? validPresets.length : 0, idx => localApply(validPresets[idx], presets.indexOf(validPresets[idx])), () => setActivePresetDropdown(null));
  return /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-material",
    title: "Material Specification",
    noToggle: true
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement("div", {
    className: fieldFlash ? "num-input-flash" : "",
    ref: widWrapRef,
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-PLa",
    label: "Width (mm)",
    labelIcon: "arrow-h",
    value: PLa,
    onChange: setMat("PLa"),
    step: 10,
    min: 100,
    onMouseDown: () => setActivePresetDropdown("wid"),
    onCommit: () => setActivePresetDropdown(null),
    onKeyDown: onWidKeyDown
  }), activePresetDropdown === "wid" && validPresets.length > 0 && /*#__PURE__*/React.createElement(MaterialPresetDropdown, {
    anchorRef: widWrapRef,
    presets: validPresets,
    activePreset: activePreset,
    onApply: localApply,
    field: "width",
    hoveredIndex: widHovered
  })), /*#__PURE__*/React.createElement("div", {
    className: fieldFlash ? "num-input-flash" : "",
    ref: lenWrapRef,
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-PPi",
    label: "Length (mm)",
    labelIcon: "arrow-v",
    value: PPi,
    onChange: setMat("PPi"),
    step: 10,
    min: 100,
    onMouseDown: () => setActivePresetDropdown("len"),
    onCommit: () => setActivePresetDropdown(null),
    onKeyDown: onLenKeyDown
  }), activePresetDropdown === "len" && validPresets.length > 0 && /*#__PURE__*/React.createElement(MaterialPresetDropdown, {
    anchorRef: lenWrapRef,
    presets: validPresets,
    activePreset: activePreset,
    onApply: localApply,
    field: "length",
    hoveredIndex: lenHovered
  })), typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults() && /*#__PURE__*/React.createElement("button", {
    className: "ctrl-dir",
    style: {
      marginTop: "var(--sp-1)"
    },
    onClick: () => setShowModal(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), " Manage Presets")));
}
function SurfaceInputs({
  sh,
  setSh,
  setSurf
}) {
  const {
    W,
    H
  } = sh;
  return /*#__PURE__*/React.createElement(ControlPanel, {
    id: "control-surface",
    title: "Inputs",
    noToggle: true
  }, /*#__PURE__*/React.createElement(Stack, {
    gap: 3
  }, /*#__PURE__*/React.createElement(NumInput, {
    id: "input-W",
    label: "Width \u2014 horizontal (mm)",
    labelIcon: "arrow-h",
    value: W,
    onChange: setSurf("W"),
    step: 10
  }), /*#__PURE__*/React.createElement(NumInput, {
    id: "input-H",
    label: "Length \u2014 vertical (mm)",
    labelIcon: "arrow-v",
    value: H,
    onChange: setSurf("H"),
    step: 10
  })));
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
  const isGroupActive = isGroup && hasChildren && isOpen && childActive;
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
  isMobile,
  theme,
  setTheme
}) {
  const mobile = isMobile;
  const showSubs = mobile ? mobileMenuOpen : navOpen;
  const navRef = React.useRef(null);
  const isNavCollapsed = !mobile && !navOpen;
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
    className: "nav" + (isNavCollapsed ? " nav-collapsed" : "") + (mobile && mobileMenuOpen ? " nav-mobile-open" : ""),
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
  }, /*#__PURE__*/React.createElement("div", {
    className: "nav-btn-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    className: "nav-btn" + (!navOpen ? " nav-btn-icon-only" : ""),
    onClick: () => setTheme(getNextTheme(theme)),
    title: `Theme: ${THEMES[theme]?.label}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "nav-btn-icon"
  }, THEMES[theme]?.icon ?? '◇'), /*#__PURE__*/React.createElement("span", {
    className: "nav-btn-label"
  }, THEMES[theme]?.label), /*#__PURE__*/React.createElement("span", {
    className: "nav-tooltip"
  }, "Theme: ", THEMES[theme]?.label))))));
}

// ── App root ──────────────────────────────────────────────────────────────────

const getIsMobile = isMobileViewport;

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
  setGrItems,
  theme,
  setTheme,
  panelOpen,
  setPanelOpen
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
  let content = null;
  let wrapperClass = "page-main-full";
  if (page === "concrete") {
    content = /*#__PURE__*/React.createElement(SheetConcrete, null);
  } else if (page === "timesheet") {
    content = /*#__PURE__*/React.createElement(SheetTimesheet, null);
  } else if (page === "golden-ratio") {
    content = /*#__PURE__*/React.createElement(SheetGoldenRatio, {
      grItems: grItems,
      setGrItems: setGrItems
    });
    wrapperClass = "main-data";
  } else if (page === "pipe-wrap") {
    content = /*#__PURE__*/React.createElement(PipeWrapCalculator, null);
  } else if (page === "guider") {
    content = /*#__PURE__*/React.createElement(SheetGuider, null);
    wrapperClass = "main-data";
  } else if (page === "symmetric-layout") {
    content = /*#__PURE__*/React.createElement(SheetSymmetricLayout, {
      sym: sym,
      setSym: setSym
    });
    wrapperClass = "main-data";
  } else if (pageMeta) {
    content = /*#__PURE__*/React.createElement(SheetSurfaceLayout, {
      sh: sh,
      setSh: setSh,
      panelOpen: panelOpen,
      setPanelOpen: setPanelOpen
    });
    wrapperClass = "main-data";
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: wrapperClass
  }, content));
}
const DEV_MODE = false; // reserved for future use

function App() {
  const [page, setPageState] = useState(getHashPage);

  // Track mobile state reactively — updates on resize/rotate
  const [isMobile, setIsMobile] = React.useState(getIsMobile);
  const [navOpen, setNavOpen] = React.useState(!getIsMobile());
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      return saved && THEMES[saved] ? saved : "naviPro";
    } catch {
      return "naviPro";
    }
  });

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
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    applyTheme(theme);
  }, [theme]);
  const [sh, setSh] = useState(DEFAULT_SH);
  const [sym, setSym] = useState(DEFAULT_SYM);
  const [grItems, setGrItems] = useState(DEFAULT_GR);
  const [s4PanelOpen, setS4PanelOpen] = useState({
    s1: false,
    s2: false,
    s3: false,
    s4: false
  });
  const isInitialSh = React.useRef(true);
  React.useEffect(() => {
    if (isInitialSh.current) {
      isInitialSh.current = false;
      return;
    }
    if (typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults()) {
      safeSaveStaticDefaults("shDefaults", sh).catch(err => {
        console.error("Error saving pattern layouts defaults:", err);
      });
    }
  }, [sh]);
  const isInitialSym = React.useRef(true);
  React.useEffect(() => {
    if (isInitialSym.current) {
      isInitialSym.current = false;
      return;
    }
    if (typeof canSaveStaticDefaults !== "undefined" && canSaveStaticDefaults()) {
      safeSaveStaticDefaults("symDefaults", sym).catch(err => {
        console.error("Error saving symmetric layouts defaults:", err);
      });
    }
  }, [sym]);
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
    isMobile: isMobile,
    theme: theme,
    setTheme: setTheme
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
    setGrItems: setGrItems,
    theme: theme,
    setTheme: setTheme,
    panelOpen: s4PanelOpen,
    setPanelOpen: setS4PanelOpen
  }))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
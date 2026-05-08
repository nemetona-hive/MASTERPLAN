"use strict";
const { useState } = React;

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Icon({ name, className = "" }) {
  const faClass = ICONS[name] || "fa-solid fa-circle-question";
  return <i className={[faClass, className, "u-inline-flex-center"].filter(Boolean).join(" ")} />;
}

/**
 * Hook for protecting range sliders from accidental touch during scroll on mobile.
 * On mobile, touches are tracked to distinguish between horizontal slider adjustment
 * and vertical scroll. Only allows slider changes on primarily horizontal gestures.
 * @param {Function} onChange - Original onChange callback for the slider
 * @returns {Object} { onChange: protected onChange, onTouchStart: touch start handler, onTouchMove: touch move handler }
 */
function useProtectedRangeSlider(onChange) {
  const touchState = React.useRef({ startX: 0, startY: 0, isScrolling: false, initialValue: 0 });
  const isMobileMode = typeof window !== "undefined" && (window.innerWidth <= 768 || window.innerHeight <= 500);

  const onTouchStart = (e) => {
    if (!isMobileMode) return;
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isScrolling: false,
      initialValue: parseFloat(e.target.value)
    };
  };

  const onTouchMove = (e) => {
    if (!isMobileMode || touchState.current.isScrolling) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;

    // Determine if user is scrolling (vertical movement) or adjusting slider (horizontal)
    // If vertical movement is significantly larger than horizontal, treat as scroll
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      touchState.current.isScrolling = true;
    }
  };

  const protectedOnChange = (e) => {
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

  return { onChange: protectedOnChange, onTouchStart, onTouchMove };
}

/**
 * A lockable range slider component to prevent accidental movement on mobile.
 */
function RangeSlider({ id, value, onChange, min, max, step, className = "" }) {
  const isMobileMode = typeof window !== "undefined" && (window.innerWidth <= 768 || window.innerHeight <= 500);
  // Default to locked on both mobile and desktop
  const [isLocked, setIsLocked] = React.useState(true);

  const { onChange: protectedOnChange, onTouchStart, onTouchMove } = useProtectedRangeSlider(onChange);

  const handleRowClick = (e) => {
    // Only unlock if currently locked. 
    // If clicking the button itself, let the button's onClick handle it.
    if (isLocked && !e.target.closest('.range-lock-btn')) {
      setIsLocked(false);
    }
  };

  return (
    <div
      className={`range-slider-wrap ${isLocked ? 'is-locked' : 'is-unlocked'} ${className}`}
      onClick={handleRowClick}
    >
      <input
        id={id}
        name={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={isLocked}
        onChange={protectedOnChange}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        className="range-input"
      />
      <button
        type="button"
        className="range-lock-btn"
        onClick={(e) => {
          e.stopPropagation(); // Prevent handleRowClick from firing
          setIsLocked(!isLocked);
        }}
        title={isLocked ? "Unlock to adjust" : "Lock to prevent accidental changes"}
      >
        <Icon name={isLocked ? "lock" : "unlock"} />
      </button>
    </div>
  );
}

function NumInput({ id, label, value, onChange, step = 1, min = 0, unit, req = false, onFocus, labelIcon }) {
  const [local, setLocal] = React.useState(value === "" ? "" : String(value));
  const [committed, setCommitted] = React.useState(false);
  const commitTimer = React.useRef(null);

  React.useEffect(() => { setLocal(value === "" ? "" : String(value)); }, [value]);

  const commit = (flash = false) => {
    if (local === "") {
      onChange("");
    } else {
      const n = Number(local);
      if (!isNaN(n)) {
        const val = Math.max(min, Math.round(n * 100) / 100);
        onChange(val);
        setLocal(String(val));
      } else {
        setLocal(value === "" ? "" : String(value));
      }
    }
    if (flash) {
      setCommitted(true);
      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => setCommitted(false), 600);
    }
  };

  React.useEffect(() => () => clearTimeout(commitTimer.current), []);

  return (
    <div className="num-wrap">
      <span className="num-lbl">{label}{labelIcon && <Icon name={labelIcon} className="num-lbl-icon" />}</span>
      <div className="num-row">
        <input
          id={id}
          name={id}
          className={"num-input" + (req ? " num-input--req" : "")}
          type="number"
          value={local}
          min={min}
          step={step}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit()}
          onBlur={() => commit()}
          onFocus={onFocus} />
        <button
          className="num-btn"
          type="button"
          onClick={() => commit()}>
          <Icon name="corner-down-left" />
        </button>
      </div>
    </div>
  );
}

function SLabel({ children }) {
  return <div className="slabel">{children}</div>;
}

// Single collapsible replaces both Section and ControlPanel
function Collapsible({ id, title, bg, open: openProp, setOpen: setOpenProp, children, variant = "section", className = "", noToggle = false }) {
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const defaultOpen = variant === "detail" ? false : true;
  const [openLocal, setOpenLocal] = React.useState(openProp !== undefined ? openProp : defaultOpen);

  // Sync local state if openProp changes and we are not in controlled mode
  React.useEffect(() => {
    if (openProp !== undefined && !isControlled) {
      setOpenLocal(openProp);
    }
  }, [openProp, isControlled]);

  const open = noToggle ? true : (isControlled ? openProp : openLocal);
  const setOpen = isControlled ? setOpenProp : setOpenLocal;

  const headStyle = {
    ...(bg ? { background: bg } : {}),
    cursor: noToggle ? "default" : "pointer"
  };

  if (variant === "panel") {
    return (
      <div id={id} className={["control-panel", className].filter(Boolean).join(" ")}>
        <div className="panel-head" style={headStyle} onClick={noToggle ? undefined : () => setOpen(!open)}>
          <span>{title}</span>
          {!noToggle && (
            <span className="sys-head-toggle">
              <Icon name={open ? "minus" : "plus"} />
            </span>
          )}
        </div>
        {open && <div className="panel-data">{children}</div>}
      </div>
    );
  }
  if (variant === "detail") {
    return (
      <div id={id} className={["detail-section", className].filter(Boolean).join(" ")}>
        <div className="detail-section-head" style={headStyle} onClick={noToggle ? undefined : () => setOpen(!open)}>
          <span>{title}</span>
          {!noToggle && (
            <span className="sys-head-toggle">
              <Icon name={open ? "minus" : "plus"} />
            </span>
          )}
        </div>
        {open && <div className="detail-section-body">{children}</div>}
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section-head" style={headStyle} onClick={noToggle ? undefined : () => setOpen(!open)}>
        <span>{title}</span>
        {!noToggle && (
          <span className="sys-head-toggle">
            <Icon name={open ? "minus" : "plus"} />
          </span>
        )}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// Convenience aliases for readability at call sites
const Section = (props) => <Collapsible {...props} />;
const ControlPanel = (props) => <Collapsible {...props} variant="panel" />;
const DetailSection = (props) => <Collapsible {...props} variant="detail" />;

function Row({ label, value, unit, hi, hoverType, hoveredType, setHoveredType }) {
  const isHovered = hoverType && hoveredType === hoverType;
  return (
    <div className="data-row">
      <span
        className={"data-row-lbl" + (hoverType ? " hoverable" : "") + (isHovered ? " hovered" : "")}
        onMouseEnter={hoverType && setHoveredType ? () => setHoveredType(hoverType) : undefined}
        onMouseLeave={hoverType && setHoveredType ? () => setHoveredType(null) : undefined}
      >{label}</span>
      <span className={hi ? "data-row-val hi" : "data-row-val"}>{value}</span>
      {unit && <span className="data-row-unit">{unit}</span>}
    </div>
  );
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

  return { activeId, setActiveId, bindControl, isActive };
}

/**
 * Primitive layout component to enforce spacing scale
 * @param {1|2|3|4|5|6|7|0.5} gap - Spacing level from scale
 * @param {"column"|"row"} direction - Flex direction
 */
function Stack({ children, gap = 2, direction = "column", className = "", style = {}, as: Tag = "div", ...props }) {
  const gClass = `u-gap-${String(gap).replace('.', '')}`;
  const dClass = `u-flex-${direction === "row" ? "row" : "col"}`;
  return (
    <Tag className={[dClass, gClass, className].filter(Boolean).join(" ")} style={style} {...props}>
      {children}
    </Tag>
  );
}

/**
 * Text Typography component
 * @param {"xs"|"sm"|"md"|"lg"|"xl"|"xxl"} size - Font size level
 * @param {"reg"|"med"|"semi"|"bold"|"black"} weight - Font weight level
 * @param {"sans"|"mono"} variant - Font family variant
 */
function Text({ children, size, weight, variant, color, className = "", style = {}, as: Tag = "span", ...props }) {
  const classes = [
    size && `u-fs-${size}`,
    weight && `u-fw-${weight}`,
    variant && `u-${variant}`,
    className
  ].filter(Boolean).join(" ");

  const s = { ...style };
  if (color) s.color = color;

  return (
    <Tag className={classes} style={s} {...props}>
      {children}
    </Tag>
  );
}

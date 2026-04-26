"use strict";
const { useState } = React;

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Icon({ name, className = "" }) {
  const faClass = ICONS[name] || "fa-solid fa-circle-question";
  return <i className={[faClass, className, "u-inline-flex-center"].filter(Boolean).join(" ")} />;
}

function NumInput({ id, label, value, onChange, step = 1, min = 1, unit }) {
  const [local, setLocal] = React.useState(String(value));
  React.useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = Number(local);
    if (!isNaN(n) && n >= min) onChange(Math.max(min, Math.round(n * 100) / 100));
    else setLocal(String(value));
  };
  return (
    <div id={id} className="num-wrap">
      <span className="num-lbl">{label}</span>
      <div className="num-row">
        <input className="num-input" type="number" value={local} min={min} step={step}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit()}
          onBlur={commit} />
        {unit && <span className="data-row-unit num-unit-span">{unit}</span>}
        <button className="num-btn" onClick={commit}><Icon name="corner-down-left" /></button>
      </div>
    </div>
  );
}

function SLabel({ children }) {
  return <div className="slabel">{children}</div>;
}

// Single collapsible replaces both Section and ControlPanel
function Collapsible({ id, title, bg, open: openProp, setOpen: setOpenProp, children, variant = "section", className = "" }) {
  const [openLocal, setOpenLocal] = React.useState(true);
  const open    = setOpenProp ? openProp    : openLocal;
  const setOpen = setOpenProp ? setOpenProp : setOpenLocal;
  if (variant === "panel") {
    return (
      <div id={id} className={["control-panel", className].filter(Boolean).join(" ")}>
        <div className="panel-head" onClick={() => setOpen(!open)}>
          <span className="sys-head-toggle"><Icon name={open ? "chevron-down" : "chevron-right"} /></span>
          {title}
        </div>
        {open && <div className="panel-data">{children}</div>}
      </div>
    );
  }
  return (
    <div className="section">
      <div className="section-head" style={bg ? { background: bg } : undefined} onClick={() => setOpen(!open)}>
        <span className="sys-head-toggle"><Icon name={open ? "chevron-down" : "chevron-right"} /></span>
        {title}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// Convenience aliases for readability at call sites
const Section      = ({ title, bg, children }) => <Collapsible title={title} bg={bg}>{children}</Collapsible>;
const ControlPanel = ({ id, title, open, setOpen, children, className = "" }) => (
  <Collapsible id={id} title={title} open={open} setOpen={setOpen} variant="panel" className={className}>
    {children}
  </Collapsible>
);

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

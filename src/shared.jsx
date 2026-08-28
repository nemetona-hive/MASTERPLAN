import { React, ReactDOM } from "./react-globals.js";

// ── Shared UI primitives ──────────────────────────────────────────────────────

export function Icon({ name, className = "" }) {
  const faClass = ICONS[name] || "fa-solid fa-circle-question";
  return <i className={[faClass, className, "u-inline-flex-center"].filter(Boolean).join(" ")} />;
}

/* The mobile breakpoint, written down once. app.css asks the same question in
   the same words (src/styles/80-mobile.css and every other @media that opens
   with these numbers), so the two cannot drift: this used to say 1024px while
   the stylesheet said 768px, which left every tablet between the two in a state
   neither side had styling for — JS handed the nav its mobile props while CSS
   was still laying it out as a desktop sidebar.

   The height arm is bounded by width because a short viewport is not proof of a
   phone: opening the soft keyboard on a landscape tablet shrinks innerHeight
   past 500 too, and an unbounded arm collapsed the nav to icons mid-edit. No
   phone is wider than 950px in landscape; no tablet is narrower. */
const MOBILE_MAX_W = 768;
const SHORT_MAX_H  = 500;
const SHORT_MAX_W  = 950;

export const MOBILE_MEDIA_QUERY =
  `(max-width: ${MOBILE_MAX_W}px), (max-height: ${SHORT_MAX_H}px) and (max-width: ${SHORT_MAX_W}px)`;

/* The nav's own threshold, wider than the mobile one and deliberately separate.
   The sidebar is 260px and .data-control a fixed 384px, so on a portrait tablet
   the preview column — the part of the page the tool exists to show — was down
   to 190px and clipped by .main-data's overflow. Collapsing the sidebar to its
   icon strip hands 200px of that back before the columns have to stack at all.

   1280px covers tablet landscape as well as portrait — an 11" iPad on its side
   is 1194-1210px, which cleared the old 1024px line and got the full sidebar
   back at the preview's expense. Above 1280 a 260px sidebar still leaves the
   preview 640px+, which is enough, so laptops are left alone; 1366x768 is a
   common one and sits just clear of this.

   Read by App.jsx, which owns navOpen. CSS cannot do this on its own: the
   collapsed nav is a JS state — .nav-collapsed, icon-only buttons, tooltips
   swapped in for labels — and not merely a narrower width. Styling it collapsed
   without telling JS is exactly the split that produced the 768/1024 bug. */
const COMPACT_NAV_MAX_W = 1280;

export const COMPACT_NAV_MEDIA_QUERY = `(max-width: ${COMPACT_NAV_MAX_W}px)`;

export function isCompactNavViewport() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") {
    return window.innerWidth <= COMPACT_NAV_MAX_W;
  }
  return window.matchMedia(COMPACT_NAV_MEDIA_QUERY).matches;
}

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  /* jsdom implements no layout and therefore no matchMedia, so tests read the
     same thresholds straight off the window rather than losing the check. */
  if (typeof window.matchMedia !== "function") {
    return window.innerWidth <= MOBILE_MAX_W
      || (window.innerHeight <= SHORT_MAX_H && window.innerWidth <= SHORT_MAX_W);
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

/* Whether hover is a real thing on this device, rather than something a tap
   fakes for one event and never takes back. Falls back to true where matchMedia
   is missing (jsdom), which keeps the desktop behaviour under test. */
export function canHover() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover)").matches;
}

/* Whether focus landed by keyboard rather than by a tap or a click.
   :focus-visible is exactly that question, and the browser already answers it —
   a tap focuses the button without matching. Engines that cannot parse the
   selector throw, and there the old always-show behaviour is the safer miss. */
export function isKeyboardFocus(target) {
  try {
    return typeof target?.matches === "function" && target.matches(":focus-visible");
  } catch {
    return true;
  }
}

export function safeSaveStaticDefaults(key, value) {
  if (typeof saveStaticDefaults === "undefined") {
    return Promise.reject(new Error("saveStaticDefaults is not available"));
  }
  return saveStaticDefaults(key, value);
}

export function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampNumber(value, min, max, fallback = min) {
  return Math.min(max, Math.max(min, toNumber(value, fallback)));
}

export function useTimedState(initialValue, defaultDelay = 2500) {
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

export function useTimedSet(defaultDelay = 600) {
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

  const remove = React.useCallback((item) => {
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

export function useClickOutside(refs, handler, active = true) {
  React.useEffect(() => {
    if (!active) return;

    const onMouseDown = (e) => {
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

/**
 * Hands the browser a generated file to save.
 *
 * The object URL is revoked on a later tick rather than straight after
 * `click()` — the download reads from that URL asynchronously, and revoking it
 * in the same turn cancels the save in Firefox and Safari before it starts.
 */
export function downloadFile(fileName, data, mimeType) {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Every armed mode — an open dropdown, a preset being renamed — takes the same
// two ways out: click away, or Escape. useClickOutside already gives the first
// half; leaving the second to each caller is how the same control ends up
// behaving differently on two pages.
//
// `inside` is an array of refs, or a CSS selector for a subtree that cannot
// forward one. Pass a stable handler: it re-subscribes on identity change, the
// same as useClickOutside.
export function useModeExit(inside, onExit, active = true) {
  const isSelector = typeof inside === "string";

  useClickOutside(isSelector ? [] : inside, event => {
    if (isSelector && event.target?.closest?.(inside)) return;
    onExit(event);
  }, active);

  React.useEffect(() => {
    if (!active) return;
    const onKeyDown = event => { if (event.key === "Escape") onExit(event); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onExit]);
}

export function useDropdownKeyboard(itemsLength, onSelect, onClose) {
  const [hoveredIndex, setHoveredIndex] = React.useState(-1);

  // Reset hovered index when items change or dropdown opens
  React.useEffect(() => {
    setHoveredIndex(-1);
  }, [itemsLength]);

  const onKeyDown = (e) => {
    if (itemsLength === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoveredIndex(prev => (prev < itemsLength - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoveredIndex(prev => (prev > 0 ? prev - 1 : itemsLength - 1));
    } else if (e.key === "Enter" && hoveredIndex >= 0) {
      e.preventDefault(); // Prevent NumInput from committing its partial value
      onSelect(hoveredIndex);
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return { hoveredIndex, onKeyDown };
}

/**
 * Hook for protecting range sliders from accidental touch during scroll on mobile.
 * On mobile, touches are tracked to distinguish between horizontal slider adjustment
 * and vertical scroll. Only allows slider changes on primarily horizontal gestures.
 * @param {Function} onChange - Original onChange callback for the slider
 * @returns {Object} { onChange: protected onChange, onTouchStart: touch start handler, onTouchMove: touch move handler }
 */
function useProtectedRangeSlider(onChange) {
  const touchState = React.useRef({ startX: 0, startY: 0, isScrolling: false });

  const onTouchStart = (e) => {
    if (!isMobileViewport()) return;
    const touch = e.touches[0];
    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isScrolling: false
    };
  };

  const onTouchMove = (e) => {
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

  const protectedOnChange = (e) => {
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

  return { onChange: protectedOnChange, onTouchStart, onTouchMove };
}

/**
 * A lockable range slider component to prevent accidental movement on mobile.
 */
export function RangeSlider({ id, value, onChange, min, max, step, className = "" }) {
  const isMobileMode = isMobileViewport();
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

export function NumInput({ id, label, value, onChange, step = 1, min = 0, max = Infinity, unit, req = false, onFocus, onMouseDown, labelIcon, onKeyDown, onCommit }) {
  const [local, setLocal] = React.useState(value === "" ? "" : String(value));

  React.useEffect(() => { setLocal(value === "" ? "" : String(value)); }, [value]);

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


  return (
    <div className="num-wrap">
      {label && <span className="num-lbl">{label}{labelIcon && <Icon name={labelIcon} className="num-lbl-icon" />}</span>}
      <div className="num-row">
        <input
          id={id}
          name={id}
          className={"num-input" + (req ? " num-input--req" : "")}
          type="number"
          value={local}
          min={min}
          max={max === Infinity ? undefined : max}
          step={step}
          onChange={e => setLocal(e.target.value)}
          onKeyDown={e => {
            // Parent handler runs first — can e.preventDefault() to intercept Enter
            if (onKeyDown) onKeyDown(e);
            if (e.key === "Enter" && !e.defaultPrevented) {
              e.preventDefault();
              e.stopPropagation();
              commitValue();
              if (onCommit) onCommit();
            }
          }}
          onBlur={() => { commitValue(); if (onCommit) onCommit(); }}
          onFocus={onFocus}
          onMouseDown={onMouseDown} />
        <button
          className="num-btn"
          type="button"
          onClick={() => {
            commitValue();
            if (onCommit) onCommit();
          }}>
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
  // Uncontrolled: `open` seeds the initial state and nothing more. Every
  // uncontrolled call site passes a literal (open={false}, open={true}
  // noToggle), so the effect that used to copy openProp into local state on
  // every change never had a value to copy — it only cost a second render and
  // stood ready to clobber a user's toggle mid-interaction.
  const [openLocal, setOpenLocal] = React.useState(openProp !== undefined ? openProp : defaultOpen);

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
export const Section = (props) => <Collapsible {...props} />;
export const ControlPanel = (props) => <Collapsible {...props} variant="panel" />;
export const DetailSection = (props) => <Collapsible {...props} variant="detail" />;

export function Row({ label, value, unit, hi, danger, hoverType, hoveredType, setHoveredType }) {
  const isHovered = hoverType && hoveredType === hoverType;
  return (
    <div className="data-row">
      <span
        className={"data-row-lbl" + (hoverType ? " hoverable" : "") + (isHovered ? " hovered" : "") + (danger ? " data-row-danger" : "")}
        onMouseEnter={hoverType && setHoveredType ? () => setHoveredType(hoverType) : undefined}
        onMouseLeave={hoverType && setHoveredType ? () => setHoveredType(null) : undefined}
      >{label}</span>
      <span className={(hi ? "data-row-val hi" : "data-row-val") + (danger ? " data-row-danger" : "")}>{value}</span>
      {unit && <span className="data-row-unit">{unit}</span>}
    </div>
  );
}

// Stable visual identity for id-driven cards (A/B/C... + tone buckets)
export function getLinkedCardTone(id) {
  const key = String(id || "").toLowerCase();
  const tones = ["a", "b", "c", "d"];
  if (tones.includes(key)) return key;
  const hash = key.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return tones[hash % tones.length];
}

export function getLinkedCardMarker(id) {
  const match = String(id || "").toUpperCase().match(/[A-Z0-9]/);
  return match ? match[0] : "X";
}

// Reusable linked-card interaction:
// click control card -> matching preview card stays active
// click elsewhere -> clear active preview
export function useLinkedCardHighlight(groupId) {
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
export function Stack({ children, gap = 2, direction = "column", className = "", style = {}, as: Tag = "div", ...props }) {
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
export function Text({ children, size, weight, variant, color, className = "", style = {}, as: Tag = "span", ...props }) {
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

export function SaveDefaultsButton({ status, onClick, disabled = false, errorMessage = "", labels = {}, className = "", style = {} }) {
  if (typeof canSaveStaticDefaults === "undefined" || !canSaveStaticDefaults()) return null;
  const {
    savingLabel = "Saving...",
    savedLabel = <><Icon name="check" /> Saved Defaults</>,
    errorLabel = "Error Saving",
    defaultLabel = <><Icon name="check" /> Save Defaults</>
  } = labels;

  return (
    <button
      className={["ctrl-dir", status === "saved" ? "on pw-preset-flash" : "", className].filter(Boolean).join(" ")}
      type="button"
      onClick={onClick}
      disabled={disabled || status === "saving"}
      /* A bare "Error Saving" badge sent the only diagnostic to the console.
         Hand the reason to anyone who hovers the button. */
      title={status === "error" && errorMessage ? errorMessage : undefined}
      style={style}
    >
      {status === "saving" ? savingLabel : status === "saved" ? savedLabel : status === "error" ? errorLabel : defaultLabel}
    </button>
  );
}

export function MaterialPresetDropdown({ anchorRef, presets, activePreset, onApply, field, hoveredIndex = -1 }) {
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });

  React.useLayoutEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <div className="rate-presets-dropdown" style={{ position: "absolute", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="rate-presets-header">Material Presets</div>
      <div className="rate-presets-list" role="listbox">
        {presets.map((p, idx) => {
          if (!p.name) return null;
          const displayVal = field === "width" ? p.width : p.length;
          const displayUnit = field === "width" ? "w" : "l";
          const isActive = activePreset === idx;
          const isHovered = hoveredIndex === idx;
          return (
            <div
              key={idx}
              role="option"
              aria-selected={isHovered}
              className={"rate-preset-item" + (isActive ? " active" : "") + (isHovered ? " focused" : "")}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onApply(p, idx); }}
            >
              <div className="rate-preset-info">
                <span className="rate-preset-name">{p.name}</span>
                <span className="rate-preset-meta">{p.width} × {p.length} mm</span>
              </div>
              <span className="rate-preset-val">{displayVal}<small>{displayUnit}</small></span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

import { React, ReactDOM } from "./react-globals.js";
import { recordDocStep, registerDocHistory } from "./utils/doc-undo.js";

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

/* The deployed build id, from the generated version.js. Read through `typeof`
   because a browser holding a cached pre-versioning index.html never loaded
   that script, and a bare reference would throw. Returns null when absent, so
   a caller renders nothing rather than "build undefined". */
export function getBuildId() {
  return typeof BUILD !== "undefined" ? BUILD.id : null;
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

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])"
].join(",");

/*
 * Keeps focus inside an open dialog, and gives it back when the dialog goes.
 *
 * `aria-modal="true"` is a promise about behaviour, and the markup alone does
 * not keep it: Tab walks straight out of the panel and into the page behind,
 * which is still there, still focusable, and now unreachable by mouse behind
 * the scrim.
 *
 * That is not hypothetical here. The large layout preview renders its own copy
 * of the material fields over a page that still holds the originals, so tabbing
 * out of it lands you on the same three inputs you thought you were editing —
 * the ones underneath, changing the layout behind the dialog you are looking
 * at. The dropdowns already needed `isBackground` to stop the two copies
 * fighting; this is the same collision on the keyboard.
 *
 * Returning focus matters as much. Without it, close puts focus on <body> and
 * the next Tab starts again from the top of the app rather than from the
 * control that opened the dialog — which for the large preview is a button
 * inside a panel some way down the page.
 *
 * Guarded on `document.contains`: the thing that opened the dialog may not have
 * survived it, and focusing a detached node silently moves focus to <body> —
 * exactly the state this exists to avoid, reached by a different road.
 *
 * Ported from MONEYFLOW. Its `Dialog` component is NOT ported: that recipe
 * reads several tokens this theme has no answer for, and this app already has
 * its own modal chrome in `.mp-modal-*`. The behaviour was the missing half.
 */
export function useDialogFocus(panelRef) {
  React.useEffect(() => {
    const opener = document.activeElement;
    if (panelRef.current) panelRef.current.focus();

    const onKeyDown = event => {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;

      const stops = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (stops.length === 0) {
        // Nothing to land on: hold focus on the panel rather than let Tab out.
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;

      // Starting from the panel itself, Shift+Tab wraps to the end — otherwise
      // the first backwards Tab of a freshly opened dialog leaves it.
      if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [panelRef]);
}

/**
 * A modal built on the chrome this app already had.
 *
 * `.mp-modal-overlay` / `.mp-modal` were being written inline at each call
 * site, which is how both of them ended up with a close button and a scrim and
 * neither of them with a role, a focus trap, an Escape, or focus restored on
 * close. The markup was never the missing part; having it in one place is what
 * makes the behaviour arrive everywhere at once.
 *
 * The scrim click and Escape both come from `useModeExit`, so the two ways of
 * dismissing a dialog cannot drift apart. It replaces a hand-written
 * `onMouseDown` comparing `e.target === e.currentTarget`, which was the same
 * rule stated a second time.
 */
export function Modal({ title, onClose, className = "", children }) {
  const panelRef = React.useRef(null);
  const titleId = React.useId();

  useDialogFocus(panelRef);
  useModeExit([panelRef], onClose);

  return (
    <div className="mp-modal-overlay">
      {/* tabIndex -1 so the panel itself can hold focus on open, before the
          user has reached a control — and so the trap has somewhere to park
          focus in a dialog with nothing focusable in it. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={"mp-modal" + (className ? " " + className : "")}>
        <div className="mp-modal-head">
          <span id={titleId}>{title}</span>
          <button className="mp-modal-close ctl-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="mp-modal-body">{children}</div>
      </div>
    </div>
  );
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

/* A text field accepts letters, and Number("12a") is NaN — which commitValue
   below reads as "put the old value back", so one mistyped character silently
   throws away everything typed with it. Filtering on the way in keeps the field
   numeric with no validation state to explain. A comma becomes a point because
   it is the decimal separator on the keyboards this is typed on, and a number
   holding one otherwise stops dead at the comma. */
function cleanNumericInput(raw) {
  return String(raw).replace(/,/g, ".").replace(/[^0-9.-]/g, "");
}

/*
 * A number field the arrow keys cannot edit.
 *
 * WHY IT IS type="text". A number input steps its value on ArrowUp/ArrowDown —
 * and on a wheel scroll while it holds focus — so a key pressed to move the
 * caret rewrites a dimension the whole layout is drawn from, with nothing on
 * screen to say it happened and no undo to reach for. The spinner those keys
 * drive has been hidden in CSS since the start, so stepping was never a control
 * anybody could see: it was only ever reachable by accident.
 *
 * Ported from MONEYFLOW's MoneyInput, which is text plus inputMode for exactly
 * this reason. inputMode="decimal" keeps the numeric keypad on phones, which is
 * the one thing type="number" was still earning here.
 *
 * min and max stay props and no longer reach the DOM: they were never browser
 * validation — commitValue clamps with them — and a text input ignores them.
 * step went with the spinner it belonged to.
 */
export function NumInput({ id, label, value, onChange, min = 0, max = Infinity, unit, req = false, labelIcon, onKeyDown, onCommit, presetsOpen = false, onTogglePresets }) {
  const [local, setLocal] = React.useState(value === "" ? "" : String(value));
  const inputRef = React.useRef(null);

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
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={local}
          onChange={e => {
            const cleaned = cleanNumericInput(e.target.value);
            // A rejected character leaves `local` unchanged, and React then
            // rewrites the field with the caret at the end. Bailing keeps the
            // caret where it was, so a stray letter mid-number does nothing at
            // all rather than jumping the cursor to the end of the value.
            if (cleaned === local && e.target.value !== "") return;
            setLocal(cleaned);
          }}
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
          ref={inputRef} />
        {/*
          * The presets toggle, on the fields that have a list behind them.
          *
          * It exists because the list used to open on its own: clicking or
          * tabbing into the field was enough, so a panel covered the controls
          * below whenever somebody went to type a number, and the only way to
          * be rid of it was to click somewhere else. Opening a menu is a thing
          * you ask for, so now there is something to ask with.
          *
          * mousedown is swallowed so the click cannot pull focus out of the
          * field and fire its commit-on-blur mid-edit. Focus is then moved to
          * this field's own input deliberately, because the arrow/Enter/Escape
          * handling for the open list lives on the field's own keydown — the
          * button holding focus would leave the list open and unwalkable.
          *
          * FOCUS FIRST, THEN TOGGLE, and the order is the whole of a bug worth
          * keeping in mind. Moving focus here blurs whichever field had it,
          * which fires that field's commit — and a page whose fields share one
          * "which list is open" between them closes the list from there. Toggle
          * first and that close lands second and undoes it: the list opened and
          * shut inside one click, and a second click was needed to reach a list
          * that had looked one click away all along.
          */}
        {onTogglePresets && (
          <button
            className="num-btn num-btn--presets"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={presetsOpen}
            aria-label={presetsOpen ? "Hide presets" : "Show presets"}
            title="Presets"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { if (inputRef.current) inputRef.current.focus(); onTogglePresets(); }}>
            <Icon name="chevron-down" />
          </button>
        )}
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

/* Handlers for an element that highlights its linked counterparts elsewhere —
   a summary row lighting up the matching segments, and the reverse.

   On a pointer that really hovers this is mouseenter/mouseleave, unchanged. On
   touch there is no mouseleave to answer the mouseenter a tap fires, so the
   highlight used to latch on with nothing able to clear it. The tap becomes a
   toggle instead: it is reversible, and it is the only way a finger can turn
   the thing off again.

   toggleOnTap: false where a tap already means something else. On the layout
   segments it means select, and the <g> above them handles that — a second
   meaning for the same tap would fire both at once, so the highlight stands
   aside there and lets selection speak. */
export function linkedHighlightProps(type, hoveredType, setHoveredType, { toggleOnTap = true } = {}) {
  if (!type || !setHoveredType) return {};
  if (canHover()) {
    return {
      onMouseEnter: () => setHoveredType(type),
      onMouseLeave: () => setHoveredType(null)
    };
  }
  if (!toggleOnTap) return {};
  return { onClick: () => setHoveredType(hoveredType === type ? null : type) };
}

export function Row({ label, value, unit, hi, danger, hoverType, hoveredType, setHoveredType }) {
  const isHovered = hoverType && hoveredType === hoverType;
  return (
    <div className="data-row">
      <span
        className={"data-row-lbl" + (hoverType ? " hoverable" : "") + (isHovered ? " hovered" : "") + (danger ? " data-row-danger" : "")}
        {...linkedHighlightProps(hoverType, hoveredType, setHoveredType)}
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
/**
 * Undo for a page's structural actions — the ones a button performs.
 *
 * Returns `markStep(label)`. Call it at the TOP of a mutating handler, before
 * the `setState` that changes anything: it snapshots the state as it stands,
 * and a call made after the write would record the state the action produced
 * rather than the one it replaced.
 *
 * Only structural handlers take one. Typing does not: text has its own undo
 * (`src/utils/field-undo.js`), and a page-level step per keystroke would be two
 * systems answering for the same edit. The line runs between what a BUTTON did
 * and what a KEYSTROKE did, not between kinds of state — the timesheet's lunch
 * presets write a text field and are still a button, so they take a step.
 *
 * `key` is the document on screen — `timesheet`, `surface-layout`. Changing it
 * drops the history, because an undo across a page change would rewrite
 * figures you are no longer looking at. It does NOT change when the route does:
 * every pattern-layout page edits the one `sh` document, so they share a key
 * and the history survives moving between them.
 *
 * `snapshot` returns the page's DATA state only. View state stays out
 * deliberately: which panel is expanded, which preset is highlighted, which row
 * is active. An undo restores what the document held and never moves you
 * somewhere else to show you.
 */
export function useDocHistory({ key, snapshot, apply }) {
  /* Registered from an effect, not during render, and with no dependency list:
     `snapshot` and `apply` close over this render's state, so the store has to
     be handed the current pair after every commit. Effects flush before the
     next event is dispatched, so a handler can never read a stale closure. */
  React.useEffect(() => {
    registerDocHistory({ key, snapshot, apply });
  });

  React.useEffect(() => () => registerDocHistory(null), []);

  return recordDocStep;
}

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

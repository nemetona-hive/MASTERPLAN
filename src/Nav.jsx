import { React, ReactDOM } from "./react-globals.js";
import { Icon, canHover, getBuildId, isKeyboardFocus } from "./shared.jsx";

// ── Navigation ────────────────────────────────────────────────────────────────

/* Shared by every collapsed-nav tooltip (NavButton and the theme toggle
   below). Mounted on hover rather than kept in the DOM at opacity 0 — see
   the comment on the portal in NavTooltipPortal for why that matters. */
function useNavTooltip(isCollapsed) {
  const wrapRef = React.useRef(null);
  const [tip, setTip] = React.useState(null);

  /* A tap is not a hover. It fires mouseenter with no mouseleave behind it and
     focuses the button on the way, so a tooltip built for a pointer that will
     move away instead appears and stays — over whatever page the tap just
     navigated to. Since the sidebar started collapsing at 1280px, every tablet
     reaches this code, where before only a narrow desktop window did.

     Two gates, because the two triggers ask different questions. The pointer
     one asks whether hover exists at all; the keyboard one asks
     :focus-visible, so the label still follows Tab and no longer follows a
     fingertip. */
  const showTip = event => {
    if (!isCollapsed || !wrapRef.current) return;
    if (event && event.type === "focus" ? !isKeyboardFocus(event.target) : !canHover()) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setTip({ left: rect.right + 10, top: rect.top + rect.height / 2 });
  };
  const hideTip = () => setTip(null);

  // Expanding while one is open would leave it pointing at a button that has
  // moved and a label that is now visible anyway.
  React.useEffect(() => {
    if (!isCollapsed) setTip(null);
  }, [isCollapsed]);

  // A rect goes stale the moment anything moves under it. Rather than
  // tracking the anchor, the tooltip closes: it exists for the length of a
  // hover, and a scroll or a resize during one is the user doing something else.
  React.useEffect(() => {
    if (!tip) return undefined;
    window.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
    return () => {
      window.removeEventListener("scroll", hideTip, true);
      window.removeEventListener("resize", hideTip);
    };
  }, [tip]);

  return { wrapRef, tip, showTip, hideTip };
}

/* Into <body>, not left parked in the strip at opacity 0. `.nav` is
   `overflow-y: auto`, and a box with one scrollable axis computes the other
   to `auto` too — so a tooltip sitting well to the right of a collapsed
   60px strip doesn't just risk being clipped, it gives `.nav` horizontal
   scroll room it should never have. With focus on a nav button, arrow-key
   navigation then scrolled the whole sidebar sideways and slid every label
   out of its own strip.

   aria-hidden, because the triggering button's own label is still in the
   accessibility tree — clipped to 0 width, not removed. Without it, every
   collapsed button would announce its label twice. */
function NavTooltipPortal({ tip, label }) {
  if (!tip) return null;
  return ReactDOM.createPortal(
    <span
      className="nav-tooltip"
      aria-hidden="true"
      style={{ left: `${tip.left}px`, top: `${tip.top}px` }}>
      {label}
    </span>,
    document.body
  );
}

function NavButton({ page, item, navOpen, setPage, onKeyNav, onToggleNav }) {
  const isActive = page === item.id;
  const { wrapRef, tip, showTip, hideTip } = useNavTooltip(!navOpen);

  const classes = ["nav-btn"];
  if (isActive) classes.push("active");
  if (!navOpen) classes.push("nav-btn-icon-only");

  const handleClick = () => setPage(item.id);

  /* The nav is one flat list, so both axes rove it: Down/Right step forward,
     Up/Left step back. Left and Right used to open and close a group. */
  const handleKeyDown = e => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        handleClick();
        break;
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        onKeyNav("next");
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        onKeyNav("prev");
        break;
    }
  };

  return (
    <div
      className="nav-btn-wrap"
      ref={wrapRef}
      onDoubleClick={onToggleNav}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      /* React's onFocus/onBlur are focusin/focusout, so they reach here from
         the button inside — the keyboard gets the label the pointer gets. */
      onFocus={showTip}
      onBlur={hideTip}>
      <button
        className={classes.join(" ")}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-current={isActive ? "page" : undefined}
        tabIndex={0}>
        <span className="nav-btn-icon"><Icon name={item.icon} /></span>
        <span className="nav-btn-label">{item.label}</span>
      </button>
      <NavTooltipPortal tip={tip} label={item.label} />
    </div>
  );
}

export function AppNav({ page, setPage, navOpen, setNavOpen, mobileMenuOpen, setMobileMenuOpen, isMobile, theme, setTheme }) {
  const mobile = isMobile;
  const navRef = React.useRef(null);
  const isNavCollapsed = !mobile && !navOpen;

  /* home is the one page that opts out of the ordinary list and still appears:
     collapsed, the HIVE label is disabled, so its own item is the way back. */
  const navItems = PAGES.filter(pg => !pg.noNav || pg.id === "home");

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
    // Deliberately does not wrap: running off either end with no signal that
    // the list ended is worse than stopping.
    if (direction === "next" && idx < btns.length - 1) btns[idx + 1].focus();
    if (direction === "prev" && idx > 0) btns[idx - 1].focus();
  };

  return (
    <div id="page-side" className="page-side">
      <nav id="side-navi" ref={navRef}
        className={"nav" + (isNavCollapsed ? " nav-collapsed" : "") + (mobile && mobileMenuOpen ? " nav-mobile-open" : "")}
        role="navigation" aria-label="Main navigation">

        {/* Header
            Collapsed, this shrinks to just the centered toggle icon — the
            HIVE label goes to zero width, so a click near the icon would
            otherwise fire setPage("home") as a side effect of trying to
            toggle. The label button is disabled when collapsed for that
            reason, which also takes it out of the tab order; Home stays
            reachable as its own item in the list below, which renders in
            every state. */}
        <div className={"nav-section nav-toggle" + (page === "home" && !isNavCollapsed ? " active" : "")}>
          {/* Two separate controls, not one nested inside the other: a
              role="button" wrapping another role="button" is two overlapping
              focus stops that look like one target. The label button stretches
              to fill the strip (flex: 1), so the click area is what it always
              was — everything left of the icon — minus the ambiguous overlap. */}
          <button
            type="button"
            className="nav-toggle-label"
            disabled={isNavCollapsed}
            aria-current={page === "home" && !isNavCollapsed ? "page" : undefined}
            onClick={() => {
              setPage("home");
              if (mobile) setMobileMenuOpen(false);
            }}
          >HIVE</button>
          <button
            type="button"
            className="nav-menu-icon"
            onClick={handleToggle}
            aria-label={mobile ? (mobileMenuOpen ? "Close menu" : "Open menu") : (navOpen ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)")}
            aria-expanded={mobile ? mobileMenuOpen : navOpen}
            title={mobile ? undefined : (navOpen ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)")}
          >
            <Icon name="panel-left-close" />
          </button>
        </div>

        {/* Main nav items */}
        {/* No role="menubar". These are links to pages, not commands in an
            application menu, and the buttons underneath were never menuitems —
            axe flagged the menubar as having children that are not allowed. The
            <nav> above already names the region for a screen reader, which is
            the semantic that was actually doing the work. Arrow-key roving is
            unaffected: handleKeyNav walks .nav-btn elements directly. */}
        <div className="nav-items">
          {navItems.map(item => (
            <NavButton key={item.id} page={page} item={item}
              navOpen={mobile ? mobileMenuOpen : navOpen}
              setPage={id => { setPage(id); if (mobile) setMobileMenuOpen(false); }}
              onKeyNav={handleKeyNav} onToggleNav={handleToggle} />
          ))}
        </div>

        {/* Bottom pinned section — add utility items here */}
        <div className="nav-bottom">
          <NavThemeButton navOpen={navOpen} theme={theme} setTheme={setTheme} onToggleNav={handleToggle} />
          <NavBuildStamp navOpen={navOpen} mobile={mobile} />
        </div>

      </nav>
    </div>
  );
}

/* The deployed build id, so what is on screen can be checked against what was
   pushed.

   Desktop rail only, and only while expanded: the collapsed strip is 60px and
   this is the one thing in the nav with no icon to shrink to. On mobile the
   nav is a drawer that is shut by default, which would put the stamp two taps
   away — it lives in the Home page footer there instead (Home.jsx), visible
   without opening anything. */
function NavBuildStamp({ navOpen, mobile }) {
  const id = getBuildId();
  if (!id || mobile || !navOpen) return null;
  return (
    <div className="nav-build" title={`Build ${id} — compare with 'npm run deploy:check'`}>
      build {id}
    </div>
  );
}

function NavThemeButton({ navOpen, theme, setTheme, onToggleNav }) {
  const { wrapRef, tip, showTip, hideTip } = useNavTooltip(!navOpen);
  const label = `Theme: ${THEMES[theme]?.label}`;

  return (
    <div
      className="nav-btn-wrap"
      ref={wrapRef}
      onDoubleClick={onToggleNav}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}>
      <button
        className={"nav-btn" + (!navOpen ? " nav-btn-icon-only" : "")}
        onClick={() => setTheme(getNextTheme(theme))}
      >
        <span className="nav-btn-icon">
          {THEMES[theme]?.icon ?? '◇'}
        </span>
        <span className="nav-btn-label">
          {THEMES[theme]?.label}
        </span>
      </button>
      <NavTooltipPortal tip={tip} label={label} />
    </div>
  );
}

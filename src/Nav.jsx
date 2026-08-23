import { React, ReactDOM } from "./react-globals.js";
import { Icon } from "./shared.jsx";

// ── Navigation ────────────────────────────────────────────────────────────────

function isNavPageActive(page, pg) {
  const childActive = PAGES.some(p => p.parentId === pg.id && p.id === page);
  return page === pg.id && !childActive;
}

/* Shared by every collapsed-nav tooltip (NavButton and the theme toggle
   below). Mounted on hover rather than kept in the DOM at opacity 0 — see
   the comment on the portal in NavTooltipPortal for why that matters. */
function useNavTooltip(isCollapsed) {
  const wrapRef = React.useRef(null);
  const [tip, setTip] = React.useState(null);

  const showTip = () => {
    if (!isCollapsed || !wrapRef.current) return;
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

function NavButton({ page, item, navOpen, setPage, openGroups, setOpenGroups, onKeyNav, onToggleNav }) {
  const isGroup     = item.isParent === true;
  const hasChildren = PAGES.some(pg => pg.parentId === item.id);
  const isOpen      = isGroup && hasChildren && !!openGroups[item.id];
  const childActive = isGroup && PAGES.some(pg => pg.parentId === item.id && pg.id === page);
  const isActive    = isNavPageActive(page, item);
  const isGroupActive = isGroup && hasChildren && isOpen && childActive;
  const { wrapRef, tip, showTip, hideTip } = useNavTooltip(!navOpen);

  const classes = ["nav-btn"];
  if (isActive || isGroupActive) classes.push("active");
  if (isGroup)       classes.push("nav-parent");
  if (childActive)   classes.push("child-active");
  if (item.parentId) classes.push("nav-sub-btn");
  if (!navOpen)      classes.push("nav-btn-icon-only");

  const toggleGroup = () => {
    setOpenGroups(prev => ({ ...prev, [item.id]: !prev[item.id] }));
  };

  const handleClick = () => {
    if (isGroup && hasChildren) toggleGroup();
    else setPage(item.id);
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
        if (isGroup && hasChildren && !isOpen) setOpenGroups(prev => ({ ...prev, [item.id]: true }));
        else onKeyNav("next");
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (isGroup && hasChildren && isOpen) setOpenGroups(prev => ({ ...prev, [item.id]: false }));
        else onKeyNav("parent");
        break;
      case "Escape":
        e.preventDefault();
        if (isGroup && hasChildren) setOpenGroups(prev => ({ ...prev, [item.id]: false }));
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
        aria-expanded={isGroup && hasChildren ? isOpen : undefined}
        aria-haspopup={isGroup && hasChildren ? "true" : undefined}
        tabIndex={0}>
        <span className="nav-btn-icon"><Icon name={item.icon} /></span>
        <span className="nav-btn-label">{item.label}</span>
        {isGroup && hasChildren && (
          <span className={"nav-parent-chevron " + (isOpen ? "open" : "closed")}>
            <Icon name={isOpen ? "chevron-down" : "chevron-right"} />
          </span>
        )}
      </button>
      <NavTooltipPortal tip={tip} label={item.label} />
    </div>
  );
}

function initOpenGroups(isMob) {
  return PAGES.reduce((acc, pg) => {
    if (pg.isParent && PAGES.some(p => p.parentId === pg.id)) {
      acc[pg.id] = !isMob;
    }
    return acc;
  }, {});
}

export function AppNav({ page, setPage, navOpen, setNavOpen, mobileMenuOpen, setMobileMenuOpen, isMobile, theme, setTheme }) {
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
      setOpenGroups(prev => ({ ...prev, [currentPage.parentId]: true }));
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

  return (
    <div id="page-side" className="page-side">
      <nav id="side-navi" ref={navRef}
        className={"nav" + (isNavCollapsed ? " nav-collapsed" : "") + (mobile && mobileMenuOpen ? " nav-mobile-open" : "")}
        role="navigation" aria-label="Main navigation">

        {/* Header
            Collapsed, this shrinks to just the centered toggle icon — the
            HIVE label goes to zero width but the div still spans the full
            strip, so a click anywhere near the icon would otherwise fire
            setPage("home") as a side effect of trying to toggle. Disabled
            when collapsed for that reason; Home stays reachable as its own
            item in the list below, which renders in every state. */}
        <div
          className={"nav-section nav-toggle" + (page === "home" && !isNavCollapsed ? " active" : "")}
          role="button"
          aria-current={page === "home" && !isNavCollapsed ? "page" : undefined}
          tabIndex={isNavCollapsed ? -1 : 0}
          onClick={() => {
            if (isNavCollapsed) return;
            setPage("home");
            if (mobile) setMobileMenuOpen(false);
          }}
          onKeyDown={e => {
            if (isNavCollapsed || (e.key !== "Enter" && e.key !== " ")) return;
            e.preventDefault();
            setPage("home");
            if (mobile) setMobileMenuOpen(false);
          }}
        >
          <span className="nav-toggle-label">HIVE</span>
          <span className="nav-menu-icon"
            onClick={e => { e.stopPropagation(); handleToggle(); }}
            role="button" tabIndex={0}
            aria-label={mobile ? (mobileMenuOpen ? "Close menu" : "Open menu") : (navOpen ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)")}
            title={mobile ? undefined : (navOpen ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)")}
            onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter" || e.key === " ") handleToggle(); }}>
            <Icon name="panel-left-close" />
          </span>
        </div>

        {/* Main nav items */}
        <div className="nav-items" role="menubar" aria-orientation="vertical">
          {navItems.map(item => (
            <NavButton key={item.id} page={page} item={item}
              navOpen={mobile ? mobileMenuOpen : navOpen}
              setPage={id => { setPage(id); if (mobile) setMobileMenuOpen(false); }}
              openGroups={openGroups} setOpenGroups={setOpenGroups}
              onKeyNav={handleKeyNav} onToggleNav={handleToggle} />
          ))}
        </div>

        {/* Bottom pinned section — add utility items here */}
        <div className="nav-bottom" role="menubar" aria-orientation="vertical">
          <NavThemeButton navOpen={navOpen} theme={theme} setTheme={setTheme} onToggleNav={handleToggle} />
        </div>

      </nav>
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

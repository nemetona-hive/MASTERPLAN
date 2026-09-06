import { React, ReactDOM, useState } from "./react-globals.js";
import { SheetConcrete } from "./components/Concrete.jsx";
import { SheetGoldenRatio } from "./components/GoldenRatio.jsx";
import { SheetGuider } from "./components/Guider.jsx";
import { SheetHome } from "./components/Home.jsx";
import { PipeWrapCalculator } from "./components/PipeWrapCalculator.jsx";
import { SheetSurfaceLayout } from "./components/SurfaceLayout.jsx";
import { SheetSymmetricLayout } from "./components/SymmetricLayout.jsx";
import { SheetTimesheet } from "./components/Timesheet.jsx";
import { AppNav } from "./Nav.jsx";
import { installFieldUndo } from "./utils/field-undo.js";
import { COMPACT_NAV_MEDIA_QUERY, MOBILE_MEDIA_QUERY, isCompactNavViewport, isMobileViewport, safeSaveStaticDefaults } from "./shared.jsx";

/* ── The NEMETONA wordmark ─────────────────────────────────────────────────
 *
 * Geometry declared ONCE and cloned by each layer. These shapes carry no fill
 * or stroke of their own on purpose — that is what lets one set of paths be
 * painted as shadow, bloom and glyph by the three <g> layers in the header.
 * Styling lives in src/styles/20-shell.css; nothing about how this looks is
 * decided here.
 *
 * Ported from MONEYFLOW, where the same mark is drawn the same way. The paths
 * are byte-identical to the ones MASTERPLAN already shipped — this changes how
 * the wordmark is PAINTED, not what it is.
 */
const LOGO_GEOMETRY = (
  <>
    <polygon id="lg-n1" points="34.23 46.06 5.83 15.34 5.61 45.44 .13 45.39 .22 .83 28.71 31.46 28.84 2.64 34.28 2.68 34.23 46.06" />
    <path id="lg-e1" d="M77.95,20.88c.63,1.15.57,3.5.25,5.35l-15.41.14.04,13.59h20.13c.37,1.36.45,3.51.35,5.38l-26.47-.07-.04-42.69,25.74-.05.05,5.46-19.91.03.13,12.72c2.58-.23,4.57-.29,7.08-.19l8.08.33Z" />
    <polygon id="lg-m" points="139.77 17.47 124.34 36.01 109.47 17.34 109.33 45.2 103.74 45.47 103.78 1.73 124.43 26.68 145.78 1.24 146.04 45.35 140.11 45.17 139.77 17.47" />
    <path id="lg-e2" d="M188.78,20.77l.05,5.6-15.54-.03-.02,13.58,19.81.04.23,5.41-25.52.02-.06-42.84,25.22-.02-.04,5.5-19.6.02.05,12.67c3.4-.19,5.96-.28,9.01-.18l6.42.22Z" />
    <polygon id="lg-t" points="228.58 45.3 222.92 45.41 222.92 8.13 210.46 8.01 210.74 2.51 240.7 2.52 240.71 8.06 228.79 8.06 228.58 45.3" />
    <path id="lg-o" d="M298.6,23.64c0,12.05-9.77,21.82-21.82,21.82s-21.82-9.77-21.82-21.82,9.77-21.82,21.82-21.82,21.82,9.77,21.82,21.82ZM292.72,23.54c0-8.83-7.16-15.99-15.99-15.99s-15.99,7.16-15.99,15.99,7.16,15.99,15.99,15.99,15.99-7.16,15.99-15.99Z" />
    <polygon id="lg-n2" points="353.08 45.8 323.34 14.85 323.22 45.43 317.7 45.27 317.73 .31 347.49 31.92 347.38 2.79 353.21 2.64 353.08 45.8" />
    <polygon id="lg-a" points="391.02 14.13 377.36 45.29 370.64 45.12 391.01 .77 410.67 45.08 404.24 45.3 391.02 14.13" />
    <rect id="lg-r1" x=".13" y="57.59" width="174.77" height="1.36" />
    <rect id="lg-r2" x="235.9" y="56.91" width="174.77" height="1.36" />
  </>
);

/* Reading order, which is NOT the order the shapes are declared in above and
   is not the order the original export had them in either. `--i` is the
   shape's place in the word, and the stagger runs along it — declaration order
   would send the wave across the mark in the sequence Illustrator happened to
   write. */
const LOGO_SHAPE_IDS = ["lg-n1", "lg-e1", "lg-m", "lg-e2", "lg-t", "lg-o", "lg-n2", "lg-a", "lg-r1", "lg-r2"];

/* --i is written as a string: React appends "px" to bare numbers for some
   style properties, and a unit here would break the delay calc(). */
function LogoLayer({ className, filter }) {
  return (
    <g className={className} filter={filter}>
      {LOGO_SHAPE_IDS.map((id, i) => (
        <use key={id} href={"#" + id} style={{ "--i": String(i) }} />
      ))}
    </g>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────

const getIsMobile = isMobileViewport;

// Read page id from URL hash, fallback to "home"
const getHashPage = () => {
  const hash = window.location.hash.replace("#", "");
  return PAGES.some(p => p.id === hash) ? hash : "home";
};

function MainPageContent({ page, setPage, sh, setSh, sym, setSym, grItems, setGrItems, theme, setTheme, panelOpen, setPanelOpen }) {
  const pageMeta = PAGES.find(pg => pg.id === page);

  if (page === "home") {
    return <div id="page-home" className="page-main-full"><SheetHome page={page} setPage={setPage} /></div>;
  }

  let content = null;
  let wrapperClass = "page-main-full";

  if (page === "concrete") {
    content = <SheetConcrete />;
  } else if (page === "timesheet") {
    content = <SheetTimesheet />;
  } else if (page === "golden-ratio") {
    content = <SheetGoldenRatio grItems={grItems} setGrItems={setGrItems} />;
    wrapperClass = "main-data";
  } else if (page === "pipe-wrap") {
    content = <PipeWrapCalculator />;
  } else if (page === "guider") {
    content = <SheetGuider />;
    wrapperClass = "main-data";
  } else if (page === "symmetric-layout") {
    content = <SheetSymmetricLayout sym={sym} setSym={setSym} />;
    wrapperClass = "main-data";
  } else if (pageMeta) {
    content = <SheetSurfaceLayout sh={sh} setSh={setSh} panelOpen={panelOpen} setPanelOpen={setPanelOpen} />;
    wrapperClass = "main-data";
  }

  return (
    <>

      <div className={wrapperClass}>{content}</div>
    </>
  );
}

function App() {
  const [page, setPageState]                = useState(getHashPage);
  
  // Track mobile state reactively — updates on resize/rotate
  const [isMobile, setIsMobile]            = React.useState(getIsMobile);
  /* Expanded only when there is room for it: mobile has its own drawer, and a
     tablet cannot afford 260px of sidebar next to a 384px control column. */
  const [navOpen, setNavOpen]               = React.useState(() => !getIsMobile() && !isCompactNavViewport());
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [theme, setTheme]                   = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      return saved && THEMES[saved] ? saved : "graphite";
    } catch {
      return "graphite";
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

  // Follow the stylesheet's own breakpoint rather than a second opinion about
  // it — MOBILE_MEDIA_QUERY is the string app.css is written against. Listening
  // to the query also means one re-render per actual crossing, where the old
  // resize listener fired on every URL-bar nudge and every soft-keyboard open.
  React.useEffect(() => {
    const mq = typeof window.matchMedia === "function"
      ? window.matchMedia(MOBILE_MEDIA_QUERY)
      : null;
    if (!mq) return undefined;

    const onCross = e => {
      setIsMobile(e.matches);
      setMobileMenuOpen(false);
      // Leaving mobile does not automatically mean there is room for the full
      // sidebar — 800px is desktop layout on a tablet-width screen.
      if (!e.matches) setNavOpen(!isCompactNavViewport());
    };
    // Rotating usually stays on the same side of the query, so it arrives as no
    // change event — but every button has moved out from under the thumb that
    // was reaching for it, so the drawer closes on that too.
    const onRotate = () => setMobileMenuOpen(false);

    /* Collapse the sidebar to its icon strip once the viewport can no longer
       carry it beside the control column. Mobile owns the nav below its own
       breakpoint, so this stands aside there. */
    const compact = typeof window.matchMedia === "function"
      ? window.matchMedia(COMPACT_NAV_MEDIA_QUERY)
      : null;
    const onCompact = e => {
      if (isMobileViewport()) return;
      setNavOpen(!e.matches);
    };

    mq.addEventListener("change", onCross);
    if (compact) compact.addEventListener("change", onCompact);
    window.addEventListener("orientationchange", onRotate);
    return () => {
      mq.removeEventListener("change", onCross);
      if (compact) compact.removeEventListener("change", onCompact);
      window.removeEventListener("orientationchange", onRotate);
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

  /* Undo inside a text field, replacing the native stack the app keeps
     truncating. One delegated listener covers every input in the app; see
     src/utils/field-undo.js for why it is not a hook. */
  React.useEffect(() => installFieldUndo(), []);

  // Ctrl/Cmd+B toggles the sidebar — mobile gets its overlay menu instead
  React.useEffect(() => {
    const onToggleShortcut = e => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "b") return;
      e.preventDefault();
      if (isMobile) setMobileMenuOpen(o => !o);
      else setNavOpen(o => !o);
    };
    window.addEventListener("keydown", onToggleShortcut, true);
    return () => window.removeEventListener("keydown", onToggleShortcut, true);
  }, [isMobile]);

  React.useEffect(() => {
    try { localStorage.setItem("theme", theme); } catch {}
    applyTheme(theme);
  }, [theme]);

  const [sh,      setSh]      = useState(DEFAULT_SH);
  const [sym,     setSym]     = useState(DEFAULT_SYM);
  const [grItems, setGrItems] = useState(DEFAULT_GR);
  const [s4PanelOpen, setS4PanelOpen] = useState({ s1: false, s2: false, s3: false, s4: false });

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

  return (
    <div id="app" className="app">
      <div id="app-head" className="app-head">
        <svg className="header-logo" viewBox="0 0 410.86 63.9" xmlns="http://www.w3.org/2000/svg"
          role="img" aria-label="NEMETONA">
          <defs>
            {LOGO_GEOMETRY}
            <filter id="logo-drop" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="2.3" />
            </filter>
            <filter id="logo-glow" x="-25%" y="-60%" width="150%" height="220%">
              <feGaussianBlur stdDeviation="3.1" />
            </filter>
          </defs>
          <LogoLayer className="logo-drop" filter="url(#logo-drop)" />
          <LogoLayer className="logo-glow" filter="url(#logo-glow)" />
          <LogoLayer className="logo-core" />
        </svg>
      </div>
      <div id="app-page" className={"app-page" + (mobileMenuOpen ? " nav-open" : "")}>
        <AppNav page={page} setPage={setPage} navOpen={navOpen} setNavOpen={setNavOpen}
          mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMobile={isMobile}
          theme={theme} setTheme={setTheme} />
        {/* <main>, not a div: every page needs exactly one main landmark for a
            screen reader to skip the nav with. Styling is unchanged — .page-main
            is a class and nothing selects on the tag. */}
        <main id="page-main" className="page-main"
          onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
        <MainPageContent page={page} setPage={setPage} sh={sh} setSh={setSh} sym={sym} setSym={setSym}
          grItems={grItems} setGrItems={setGrItems} theme={theme} setTheme={setTheme}
          panelOpen={s4PanelOpen} setPanelOpen={setS4PanelOpen} />
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

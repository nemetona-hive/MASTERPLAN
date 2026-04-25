// ── App root ──────────────────────────────────────────────────────────────────

const getIsMobile = () => typeof window !== "undefined" && (window.innerWidth <= 768 || window.innerHeight <= 500);

// Read page id from URL hash, fallback to "home"
const getHashPage = () => {
  const hash = window.location.hash.replace("#", "");
  return PAGES.some(p => p.id === hash) ? hash : "home";
};

function MainPageContent({ page, setPage, sh, setSh, sym, setSym, grItems, setGrItems }) {
  const pageMeta = PAGES.find(pg => pg.id === page);
  if (page === "home") {
    return <div id="page-home" className="page-main-full"><SheetHome page={page} setPage={setPage} /></div>;
  }
  if (page === "concrete") {
    return <div id="main-data" className="main-data"><SheetConcrete /></div>;
  }
  if (page === "timesheet") {
    return (
      <>
        <div id="main-head" className="main-head">
          <h2 className="title">{pageMeta?.title}</h2>
          <p className="desc">{pageMeta?.desc}</p>
        </div>
        <div className="page-main-full"><SheetTimesheet /></div>
      </>
    );
  }
  if (page === "golden-ratio") {
    return <div id="main-data" className="main-data"><SheetNewTool grItems={grItems} setGrItems={setGrItems} /></div>;
  }
  if (page === "area") {
    return (
      <div id="page-area" className="page-scroll">
        <h2 className="title">{pageMeta?.title || "Area"}</h2>
        <SheetArea sh={sh} />
      </div>
    );
  }
  if (pageMeta) {
    const content = page === "symmetric-layout"
      ? <SheetSymmetricLayout sym={sym} setSym={setSym} />
      : <SheetSurfaceLayout sh={sh} setSh={setSh} />;
    return (
      <>
        <div id="main-head" className="main-head">
          <h2 className="title">{pageMeta.title || pageMeta.label}</h2>
          <p className="desc">{pageMeta.desc}</p>
        </div>
        <div id="main-data" className="main-data">{content}</div>
      </>
    );
  }
  return null;
}

function App() {
  const [page, setPageState]                = useState(getHashPage);
  
  // Track mobile state reactively — updates on resize/rotate
  const [isMobile, setIsMobile]            = React.useState(getIsMobile);
  const [navOpen, setNavOpen]               = React.useState(!getIsMobile());
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

  const [sh,      setSh]      = useState(DEFAULT_SH);
  const [sym,     setSym]     = useState(DEFAULT_SYM);
  const [grItems, setGrItems] = useState(DEFAULT_GR);

  return (
    <div id="app" className="app">
      <div id="app-head" className="app-head">
        <svg className="header-logo" id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 410.86 63.9">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: "var(--color-primary)", stopOpacity: "0.6" }} />
              <stop offset="100%" style={{ stopColor: "var(--color-primary)", stopOpacity: "1" }} />
            </linearGradient>
            <style>{".cls-1 { fill: url(#logo-grad); stroke: var(--color-primary); stroke-miterlimit: 10; stroke-width: .25px; }"}</style>
          </defs>
          <polygon className="cls-1" points="139.77 17.47 124.34 36.01 109.47 17.34 109.33 45.2 103.74 45.47 103.78 1.73 124.43 26.68 145.78 1.24 146.04 45.35 140.11 45.17 139.77 17.47" />
          <path className="cls-1" d="M298.6,23.64c0,12.05-9.77,21.82-21.82,21.82s-21.82-9.77-21.82-21.82,9.77-21.82,21.82-21.82,21.82,9.77,21.82,21.82ZM292.72,23.54c0-8.83-7.16-15.99-15.99-15.99s-15.99,7.16-15.99,15.99,7.16,15.99,15.99,15.99,15.99-7.16,15.99-15.99Z" />
          <polygon className="cls-1" points="34.23 46.06 5.83 15.34 5.61 45.44 .13 45.39 .22 .83 28.71 31.46 28.84 2.64 34.28 2.68 34.23 46.06" />
          <path className="cls-1" d="M77.95,20.88c.63,1.15.57,3.5.25,5.35l-15.41.14.04,13.59h20.13c.37,1.36.45,3.51.35,5.38l-26.47-.07-.04-42.69,25.74-.05.05,5.46-19.91.03.13,12.72c2.58-.23,4.57-.29,7.08-.19l8.08.33Z" />
          <path className="cls-1" d="M188.78,20.77l.05,5.6-15.54-.03-.02,13.58,19.81.04.23,5.41-25.52.02-.06-42.84,25.22-.02-.04,5.5-19.6.02.05,12.67c3.4-.19,5.96-.28,9.01-.18l6.42.22Z" />
          <polygon className="cls-1" points="353.08 45.8 323.34 14.85 323.22 45.43 317.7 45.27 317.73 .31 347.49 31.92 347.38 2.79 353.21 2.64 353.08 45.8" />
          <polygon className="cls-1" points="391.02 14.13 377.36 45.29 370.64 45.12 391.01 .77 410.67 45.08 404.24 45.3 391.02 14.13" />
          <polygon className="cls-1" points="228.58 45.3 222.92 45.41 222.92 8.13 210.46 8.01 210.74 2.51 240.7 2.52 240.71 8.06 228.79 8.06 228.58 45.3" />
          <rect className="cls-1" x=".13" y="57.59" width="174.77" height="1.36" />
          <rect className="cls-1" x="235.9" y="56.91" width="174.77" height="1.36" />
        </svg>
      </div>
      <div id="app-page" className={"app-page" + (mobileMenuOpen ? " nav-open" : "")}>
        <AppNav page={page} setPage={setPage} navOpen={navOpen} setNavOpen={setNavOpen}
          mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMobile={isMobile} />
        <div id="page-main" className="page-main"
          onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}>
        <MainPageContent page={page} setPage={setPage} sh={sh} setSh={setSh} sym={sym} setSym={setSym}
          grItems={grItems} setGrItems={setGrItems} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

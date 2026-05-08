function SheetHome({ page, setPage, theme, setTheme }) {
  const items = PAGES.filter(pg => !pg.noNav);
  const [menuOpen, setMenuOpen] = React.useState(false);
  
  const handleToggleMenu = (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const selectTheme = (id) => {
    setTheme(id);
    setMenuOpen(false);
  };

  // Close menu when clicking elsewhere
  React.useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <div className="home-scroll">
      <Stack className="home-inner" gap={3}>

        <Stack className="home-brand" gap={1}>
          <div className="home-brand-name">NEMETONA</div>
          <div className="home-brand-sub">MASTERPLAN</div>
        </Stack>

        <div className="home-divider" />

        <div className="home-cards">
          {items.map(pg => {
            if (pg.isParent) return null;
            const isActive = page === pg.id;
            return (
              <Stack
                key={pg.id}
                as="button"
                className={"home-card" + (isActive ? " home-card-active" : "")}
                gap={3}
                onClick={() => setPage(pg.id)}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && setPage(pg.id)}
              >
                <span className="home-card-icon">
                  <Icon name={pg.icon} />
                </span>
                <span className="home-card-title">{pg.title}</span>
                <span className="home-card-desc">{pg.desc}</span>
                <span className="home-card-arrow">
                  <Icon name="chevron-right" />
                </span>
              </Stack>
            );
          })}
        </div>

        <div className="home-divider" />

        <div className="home-footer">NEMETONA HIVE</div>

      </Stack>

      {menuOpen && (
        <div className="theme-menu" onClick={e => e.stopPropagation()}>
          {Object.keys(THEMES).map(id => (
            <button 
              key={id}
              className={"theme-item" + (theme === id ? " active" : "")}
              onClick={() => selectTheme(id)}
            >
              <span className="theme-swatches" style={{ display: 'flex', gap: '2px', marginRight: '6px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[id].colors['--bg'] }}></span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[id].colors['--surface-1'] }}></span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[id].colors['--brand'] }}></span>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: THEMES[id].colors['--accent'] }}></span>
              </span>
              <span className="theme-item-icon">{THEMES[id].icon}</span>
              <span className="theme-item-label">{THEMES[id].label}</span>
            </button>
          ))}
        </div>
      )}

      <button 
        className="theme-toggle" 
        onClick={handleToggleMenu}
        title="Switch Color Theme"
        aria-label="Switch Color Theme"
      >
        <Icon name="palette" />
      </button>
    </div>
  );
}



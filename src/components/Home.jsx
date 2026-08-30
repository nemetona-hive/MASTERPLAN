import { Icon, Stack, getBuildId } from "../shared.jsx";

export function SheetHome({ page, setPage }) {
  const items = PAGES.filter(pg => !pg.noNav);

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
            const isActive = page === pg.id;
            return (
              <Stack
                key={pg.id}
                as="button"
                className={"home-card" + (isActive ? " home-card-active" : "")}
                gap={3}
                onClick={() => setPage(pg.id)}
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

        {/* Mobile's copy of the nav rail's build stamp. Shown by a media query
            rather than a prop: the rail's copy is hidden below the same
            breakpoint, so exactly one is ever on screen, and CSS re-evaluates
            on resize without this component tracking the viewport. */}
        {getBuildId() && <div className="home-build">build {getBuildId()}</div>}

      </Stack>
    </div>
  );
}



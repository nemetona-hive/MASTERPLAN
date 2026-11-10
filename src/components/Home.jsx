import { Icon, Stack, getBuildId } from "../shared.jsx";

/* The page cards. Home is only ever shown as itself and has no card of its
   own, so no card is "the page you are on": there is no active state here. */
export function SheetHome({ setPage, projectsAvailable = false }) {
  const items = PAGES.filter(pg => !pg.noNav);
  const build = getBuildId();

  return (
    <div className="home-scroll">
      <Stack className="home-inner" gap={3}>

        <Stack className="home-brand" gap={1}>
          <div className="home-brand-name">NEMETONA</div>
          <div className="home-brand-sub">MASTERPLAN</div>
        </Stack>

        <div className="home-divider" />

        <div className="home-cards">
          {items.map(pg => (
            <Stack key={pg.id} as="button" type="button" className="home-card" gap={3} onClick={() => setPage(pg.id)}>
              <span className="home-card-icon">
                <Icon name={pg.icon} />
              </span>
              <span className="home-card-title">{pg.title}</span>
              <span className="home-card-arrow">
                <Icon name="chevron-right" />
              </span>
            </Stack>
          ))}
        </div>

        {/* Only the static site, which has no projects, warns that a reload
            clears entries. In local mode a page's values persist with its
            project, and the note is left out. */}
        {!projectsAvailable && (
          <p className="home-note">
            Entries are kept only while this window stays open. Reloading or closing it clears them.
          </p>
        )}

        <div className="home-divider" />

        <div className="home-footer">NEMETONA HIVE</div>

        {/* Mobile's copy of the nav rail's build stamp. Shown by a media query
            rather than a prop: the rail's copy is hidden below the same
            breakpoint, so exactly one is ever on screen, and CSS re-evaluates
            on resize without this component tracking the viewport. */}
        {build && <div className="home-build">build {build}</div>}

      </Stack>
    </div>
  );
}

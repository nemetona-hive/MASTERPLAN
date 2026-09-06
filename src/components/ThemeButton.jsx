import { React } from "../react-globals.js";

/**
 * The header's theme toggle.
 *
 * One control that cycles: click it and you get the next theme in `THEMES`.
 * There are two, so a cycle and a switch are the same thing today; the cycle is
 * what keeps a third from needing a different control.
 *
 * It carries its NAME, not just an icon, and that is the reason for the
 * `is-wide` variant. An icon-only toggle says what it does and never what it is
 * on — and with the palettes as close in weight as Graphite and Verdant are,
 * "which one am I looking at" is a fair question to be able to answer without
 * clicking to find out.
 *
 * It came out of the nav's bottom section, where it was the only thing in the
 * rail that did not act on where you are — everything else there moves you
 * between pages. Its collapsed-rail tooltip went with it: the header has room
 * for the label at all times, so there is nothing to reveal on hover.
 *
 * A component rather than markup inside App.jsx because App.jsx mounts itself
 * on import and exports nothing, so anything written inline there cannot be
 * rendered by a test.
 */
export function ThemeButton({ theme, setTheme }) {
  const label = THEMES[theme]?.label;
  return (
    <button
      type="button"
      className="hdr-btn is-wide ctl-ghost"
      onClick={() => setTheme(getNextTheme(theme))}
      title={`Theme: ${label}`}
      aria-label={`Theme: ${label}`}
    >
      <span className="header-theme-icon" aria-hidden="true">{THEMES[theme]?.icon ?? "◇"}</span>
      <span className="header-theme-label">{label}</span>
    </button>
  );
}

import { getBuildId } from "../shared.jsx";

/**
 * The head of every printed document: what it is, a line under it, and when
 * and from which build it was printed. The cut list, the concrete take-off and
 * both gypsum sheets use it, so the stamp a merchant reads is the same on each.
 */
export function DocHead({ title, children }) {
  const printed = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  const build = getBuildId();
  return (
    <header className="doc-sheet-head">
      <div>
        <h1 className="doc-sheet-title">{title}</h1>
        <p className="doc-sheet-sub">{children}</p>
      </div>
      <div className="doc-sheet-stamp">
        <div>{printed}</div>
        {build && <div>build {build}</div>}
      </div>
    </header>
  );
}

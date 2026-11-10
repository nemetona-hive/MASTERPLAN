import { React } from "../react-globals.js";
import { ControlPanel, Stack } from "../shared.jsx";
import { useSessionState } from "../utils/session-state.js";
import { GuiderToruPolv70 } from "./guider/ToruPolv70.jsx";
import { ProjectSection } from "./ProjectMenu.jsx";

/* A wiring guide: the page head, the diagram in a "Skeem" card, and the
   numbered connections in an "Ühendused" card. The two switch guides share
   it, and its card head is the one the pipe calculator uses (.guider-card-head).
   A connection's `wire` picks its dot's colour, the same one the diagram and
   its legend draw that wire in. */
function WiringGuide({ title, desc, connections, children }) {
  return (
    <Stack gap={4}>
      <div className="preview-head">
        <div className="preview-head-main">
          <h2 className="preview-title">{title}</h2>
          <p className="preview-desc">{desc}</p>
        </div>
      </div>

      <div className="sys-block">
        <div className="guider-card-head">Skeem</div>
        <div className="guider-wire-body">{children}</div>
      </div>

      <div className="sys-block">
        <div className="guider-card-head">Ühendused</div>
        <ol className="guider-conn-list">
          {connections.map(row => (
            <li key={row.n} className="guider-conn-row">
              <span className="guider-conn-num">{row.n}</span>
              <span className={`guider-conn-dot guider-conn-dot--${row.wire}`} aria-hidden="true" />
              <span className="guider-conn-text">{row.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </Stack>
  );
}

const LIHTLULITI_CONNECTIONS = [
  { n: "1", wire: "phase", text: "Toite faas (L) → lüliti sisend" },
  { n: "2", wire: "phase", text: "Lüliti väljund → valgusti" },
  { n: "3", wire: "neutral", text: "Valgusti null → toite null (N)" }
];

function GuiderLihtluliti() {
  return (
    <WiringGuide title="Lihtlüliti" desc="Valgusti ja lüliti skeem — 1-juhtmeline lülitus" connections={LIHTLULITI_CONNECTIONS}>
      <svg
        viewBox="0 0 560 330"
        width="100%"
        aria-label="Valgusti ja lüliti skeem"
        role="img"
        className="guider-wire-svg"
      >
        {/*
          Key coordinates
          ───────────────────────────────────────────
          Toide L junction:   (110, 170)
          Toide N junction:   (110, 260)
          Switch left pin:    (175, 170)
          Switch right pin:   (275, 170)
          Switch box:         x=155..295  y=120..220  (square, matches Veksellüliti)
          Vertical rise x:    275, y 170→80
          Lamp centre:        (380, 80)   r=34
          Lamp left edge:     (346, 80)
          Lamp right edge:    (414, 80)
          Neutral rail right: x=460, y 260→80
          ───────────────────────────────────────────
        */}

        {/* ── Toide L → switch left pin: straight horizontal ── */}
        <line x1="110" y1="170" x2="175" y2="170"
          stroke="var(--viz-carry)" strokeWidth="2" />

        {/* ── Switch right → rise → lamp left ── */}
        <line x1="275" y1="170" x2="275" y2="80"
          stroke="var(--viz-carry)" strokeWidth="2" />
        <line x1="275" y1="80" x2="346" y2="80"
          stroke="var(--viz-carry)" strokeWidth="2" />

        {/* ── Neutral bus ── */}
        <line x1="110" y1="260" x2="460" y2="260"
          stroke="var(--accent)" strokeWidth="2" />
        <line x1="460" y1="260" x2="460" y2="80"
          stroke="var(--accent)" strokeWidth="2" />
        <line x1="414" y1="80" x2="460" y2="80"
          stroke="var(--accent)" strokeWidth="2" />

        {/* ── Supply junction dots ── */}
        <circle cx="110" cy="170" r="4.5" fill="var(--text)" />
        <circle cx="110" cy="260" r="4.5" fill="var(--text)" />

        {/* ── Toide labels ── */}
        {/* L */}
        <text x="14" y="170"
          className="guider-wire-label">
          Toide L
        </text>
        {/* N */}
        <text x="14" y="260"
          className="guider-wire-label">
          Toide N
        </text>

        {/* ── Switch box (dashed, square — matches Veksellüliti) ── */}
        <rect x="155" y="120" width="140" height="100" rx="5"
          fill="none"
          stroke="var(--text-subtle)"
          strokeWidth="1.2"
          strokeDasharray="6 3" />
        {/* common — left side, open circle */}
        <circle cx="175" cy="170" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
        {/* output — right side, open circle */}
        <circle cx="275" cy="170" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
        {/* lever — from common, angled toward output, OPEN (floating, short) */}
        <line x1="175" y1="170" x2="220" y2="154"
          stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
        {/* Lüliti label below box */}
        <text x="225" y="237" textAnchor="middle"
          className="guider-wire-caption">
          Lüliti
        </text>

        {/* ── Lamp (Valgusti) ── */}
        {/* outer circle */}
        <circle cx="380" cy="80" r="34"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2.2" />
        {/* X — cross */}
        <line x1="356" y1="56" x2="404" y2="104"
          stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="404" y1="56" x2="356" y2="104"
          stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
        {/* Valgusti label */}
        <text x="380" y="30" textAnchor="middle"
          className="guider-wire-name">
          Valgusti
        </text>

        {/* ── Legend ── */}
        <line x1="155" y1="292" x2="185" y2="292"
          stroke="var(--viz-carry)" strokeWidth="2.2" strokeLinecap="round" />
        <text x="192" y="296"
          className="guider-wire-legend">
          faas (L)
        </text>
        <line x1="155" y1="309" x2="185" y2="309"
          stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
        <text x="192" y="313"
          className="guider-wire-legend">
          null (N)
        </text>
      </svg>
    </WiringGuide>
  );
}

const VEKSELLULITI_CONNECTIONS = [
  { n: "1", wire: "phase", text: "Toite faas (L) → Lüliti 1" },
  { n: "2", wire: "traveller", text: "Lüliti 1 väljund 1 ↔ Lüliti 2 sisend 1" },
  { n: "3", wire: "traveller", text: "Lüliti 1 väljund 2 ↔ Lüliti 2 sisend 2" },
  { n: "4", wire: "phase", text: "Lüliti 2 ühisklemmilt → valgusti" },
  { n: "5", wire: "neutral", text: "Toite null (N) → valgusti nullklemmile" }
];

function GuiderVeksellulit() {
  return (
    <WiringGuide title="Veksellüliti" desc="Valgusti ja kahe lülitiga skeem — 3-juhtmeline veksel" connections={VEKSELLULITI_CONNECTIONS}>
      <svg
        viewBox="0 0 660 320"
        width="100%"
        aria-label="Veksellüliti skeem"
        role="img"
        className="guider-wire-svg"
      >
        {/*
          ── Coordinate map ───────────────────────────────────────────
          L supply:   x=100, enters bottom, rises to L1 common at y=210
          N supply:   x=220, enters bottom, rises straight to lamp y=92

          Lamp centre: (220, 60) r=32

          Lüliti 1 box: x=60..200, y=155..255
            common (L in):     left side  (75,  205)
            traveller A pin:   right side (185, 175)  — upper
            traveller B pin:   right side (185, 235)  — lower
            lever: from common (75,205) angled up-right, floating open
                   endpoint ~(130, 188)  — does NOT reach traveller pin

          Traveller wires:
            A: y=175, x 185 → 475
            B: y=235, x 185 → 475

          Lüliti 2 box: x=460..600, y=155..255  (mirror of L1)
            traveller A pin:   left side (475, 175)
            traveller B pin:   left side (475, 235)
            common (lamp out): right side (585, 205)
            lever: from common (585,205) angled up-left, floating open
                   endpoint ~(530, 188)

          Switched phase: (585,205)→(620,205)→(620,60)→(252,60)
          ─────────────────────────────────────────────────────────────
        */}

        {/* ── L supply: straight into L1 common, no jog ── */}
        <line x1="75" y1="290" x2="75" y2="205"
          stroke="var(--viz-carry)" strokeWidth="2" />
        <circle cx="75" cy="290" r="4" fill="var(--text)" />
        <text x="61" y="308"
          className="guider-wire-label">
          L
        </text>

        {/* ── N supply: straight to lamp bottom ── */}
        <line x1="220" y1="290" x2="220" y2="92"
          stroke="var(--accent)" strokeWidth="2" />
        <circle cx="220" cy="290" r="4" fill="var(--text)" />
        <text x="206" y="308"
          className="guider-wire-label">
          N
        </text>

        {/* ── Lamp ── */}
        <circle cx="220" cy="60" r="32"
          fill="none" stroke="var(--text-muted)" strokeWidth="2.2" />
        <line x1="197" y1="37" x2="243" y2="83"
          stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="243" y1="37" x2="197" y2="83"
          stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
        <text x="220" y="16" textAnchor="middle"
          className="guider-wire-name">
          Valgusti
        </text>

        {/* ── Switched phase: L2 common → lamp right edge ── */}
        <line x1="585" y1="205" x2="620" y2="205"
          stroke="var(--viz-carry)" strokeWidth="2" />
        <line x1="620" y1="205" x2="620" y2="60"
          stroke="var(--viz-carry)" strokeWidth="2" />
        <line x1="252" y1="60" x2="620" y2="60"
          stroke="var(--viz-carry)" strokeWidth="2" />

        {/* ── Traveller wires: both in the traveller colour, whichever one the
             levers happen to make live in the drawn position ── */}
        <line x1="185" y1="175" x2="475" y2="175"
          stroke="var(--sys-s3)" strokeWidth="2" />
        <line x1="185" y1="235" x2="475" y2="235"
          stroke="var(--sys-s3)" strokeWidth="2" />

        {/* ════ LÜLITI 1 ════ */}
        <rect x="60" y="155" width="140" height="100" rx="5"
          fill="none" stroke="var(--text-subtle)"
          strokeWidth="1.2" strokeDasharray="6 3" />

        {/* L1 common — left side, open circle */}
        <circle cx="75" cy="205" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />

        {/* L1 traveller A — right side, open circle */}
        <circle cx="185" cy="175" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
        {/* L1 traveller B — right side, open circle */}
        <circle cx="185" cy="235" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />

        {/* L1 lever — from common, angled toward traveller A, OPEN (floating, short) */}
        <line x1="75" y1="205" x2="138" y2="182"
          stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />

        {/* Lüliti 1 label */}
        <text x="130" y="272" textAnchor="middle"
          className="guider-wire-caption">
          Lüliti 1
        </text>

        {/* ════ LÜLITI 2 ════ */}
        <rect x="460" y="155" width="140" height="100" rx="5"
          fill="none" stroke="var(--text-subtle)"
          strokeWidth="1.2" strokeDasharray="6 3" />

        {/* L2 traveller A — left side, open circle */}
        <circle cx="475" cy="175" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
        {/* L2 traveller B — left side, open circle */}
        <circle cx="475" cy="235" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />

        {/* L2 common — right side, open circle */}
        <circle cx="585" cy="205" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />

        {/* L2 lever — from common, angled toward traveller B, OPEN (floating, short, mirrored) */}
        <line x1="585" y1="205" x2="522" y2="228"
          stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />

        {/* Lüliti 2 label */}
        <text x="530" y="272" textAnchor="middle"
          className="guider-wire-caption">
          Lüliti 2
        </text>

        {/* ── Legend ── */}
        <line x1="240" y1="272" x2="265" y2="272"
          stroke="var(--viz-carry)" strokeWidth="2.2" strokeLinecap="round" />
        <text x="272" y="276"
          className="guider-wire-legend">
          faas (L)
        </text>
        <line x1="240" y1="289" x2="265" y2="289"
          stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
        <text x="272" y="293"
          className="guider-wire-legend">
          null (N)
        </text>
        <line x1="240" y1="306" x2="265" y2="306"
          stroke="var(--sys-s3)" strokeWidth="2.2" strokeLinecap="round" />
        <text x="272" y="310"
          className="guider-wire-legend">
          veksel (kommuteeriv juhe)
        </text>
      </svg>
    </WiringGuide>
  );
}

/* The guides, by category. Each entry names the view it opens, so the list
   and what it opens cannot fall out of step. */
const CATEGORIES = [
  {
    id: "electrism",
    panelId: "control-guider-list",
    label: "Electrism",
    entries: [
      { id: "lihtluliti", label: "Lihtlüliti", View: GuiderLihtluliti },
      { id: "veksellulit", label: "Veksellüliti", View: GuiderVeksellulit }
    ]
  },
  {
    id: "ruukki",
    panelId: "control-guider-ruukki",
    label: "Ruukki",
    entries: [
      { id: "vihmaveesusteemid", label: "Vihmaveesüsteemid", View: GuiderToruPolv70 }
    ]
  }
];
const ENTRIES = CATEGORIES.flatMap(c => c.entries);

export function SheetGuider() {
  const [openPanels, setOpenPanels] = React.useState({ electrism: true, ruukki: true });
  /* Kept with the page's other values, so coming back to the page, or opening
     a project, shows the guide its values belong to rather than an empty
     page with them hidden behind an entry. */
  const [selectedId, setSelectedId] = useSessionState("Guider.page:selected", null);
  const selected = ENTRIES.find(e => e.id === selectedId) || null;

  return (
    <>
      <div id="data-control" className="data-control">
        <ProjectSection />
        {CATEGORIES.map(cat => (
          <ControlPanel key={cat.id} id={cat.panelId} title={cat.label}
            open={openPanels[cat.id]} setOpen={open => setOpenPanels(prev => ({ ...prev, [cat.id]: open }))}>
            <Stack gap={1} className="ctrl-list">
              {cat.entries.map(entry => (
                <button key={entry.id} type="button" className={"ctrl-dir" + (selectedId === entry.id ? " on" : "")}
                  aria-pressed={selectedId === entry.id}
                  onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}>
                  {entry.label}
                </button>
              ))}
            </Stack>
          </ControlPanel>
        ))}
      </div>
      <div id="data-preview" className="data-preview">
        <Stack gap={3}>
          {selected ? <selected.View /> : (
            <>
              <div className="preview-head">
                <div className="preview-head-main">
                  <h2 className="preview-title">Guider</h2>
                  <p className="preview-desc">Select an entry to view details</p>
                </div>
              </div>
              <div className="sys-block">
                <Stack className="section-pad" gap={2}>
                  <div className="ctrl-sublbl">No entry selected. Pick one from the panel on the left.</div>
                </Stack>
              </div>
            </>
          )}
        </Stack>
      </div>
    </>
  );
}

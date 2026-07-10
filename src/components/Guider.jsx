function GuiderLihtluliti() {
  return (
    <Stack gap={4}>
      {/* Page head */}
      <Stack className="sys-head" gap={1}>
        <h3 className="sys-title">
          <Icon name="guider" className="sys-title-icon" /> Lihtlüliti
        </h3>
        <span className="sys-head-sub">Valgusti ja lüliti skeem — 1-juhtmeline lülitus</span>
      </Stack>

      {/* Diagram card */}
      <div className="sys-block">
        <div style={{ padding: "var(--sp-5) var(--sp-4) var(--sp-4)" }}>

          {/* Card title */}
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: "var(--fs-sm)",
            color: "var(--text-subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "var(--sp-4)",
            paddingBottom: "var(--sp-3)",
            borderBottom: "1px solid var(--border)"
          }}>
            Skeem
          </div>

          <svg
            viewBox="0 0 560 310"
            width="100%"
            aria-label="Valgusti ja lüliti skeem"
            style={{ display: "block" }}
          >
            {/*
              Key coordinates
              ───────────────────────────────────────────
              Toide L junction:   (110, 190)
              Toide N junction:   (110, 240)
              Switch left pin:    (175, 190)
              Switch right pin:   (275, 190)
              Switch box:         x=155..295  y=168..212
              Vertical rise x:    275, y 190→80
              Lamp centre:        (380, 80)   r=34
              Lamp left edge:     (346, 80)
              Lamp right edge:    (414, 80)
              Neutral rail right: x=460, y 240→80
              ───────────────────────────────────────────
            */}

            {/* ── Toide L → switch left pin: straight horizontal ── */}
            <line x1="110" y1="190" x2="175" y2="190"
              stroke="var(--viz-carry)" strokeWidth="2" />

            {/* ── Switch right → rise → lamp left ── */}
            <line x1="275" y1="190" x2="275" y2="80"
              stroke="var(--viz-carry)" strokeWidth="2" />
            <line x1="275" y1="80" x2="346" y2="80"
              stroke="var(--viz-carry)" strokeWidth="2" />

            {/* ── Neutral bus ── */}
            <line x1="110" y1="240" x2="460" y2="240"
              stroke="var(--accent)" strokeWidth="2" />
            <line x1="460" y1="240" x2="460" y2="80"
              stroke="var(--accent)" strokeWidth="2" />
            <line x1="414" y1="80" x2="460" y2="80"
              stroke="var(--accent)" strokeWidth="2" />

            {/* ── Supply junction dots ── */}
            <circle cx="110" cy="190" r="4.5" fill="var(--text)" />
            <circle cx="110" cy="240" r="4.5" fill="var(--text)" />

            {/* ── Toide labels ── */}
            {/* L */}
            <text x="14" y="190"
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: "700", fill: "var(--text)" }}>
              Toide L
            </text>
            {/* N */}
            <text x="14" y="240"
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: "700", fill: "var(--text)" }}>
              Toide N
            </text>

            {/* ── Switch box (dashed) ── */}
            <rect x="155" y="168" width="140" height="44" rx="5"
              fill="none"
              stroke="var(--text-subtle)"
              strokeWidth="1.2"
              strokeDasharray="6 3" />
            {/* common — left side, open circle */}
            <circle cx="175" cy="190" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
            {/* output — right side, open circle */}
            <circle cx="275" cy="190" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
            {/* lever — from common, angled toward output, OPEN (floating, short) */}
            <line x1="175" y1="190" x2="220" y2="174"
              stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
            {/* Lüliti label below box */}
            <text x="225" y="229" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fill: "var(--text-muted)" }}>
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
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fill: "var(--text-muted)" }}>
              Valgusti
            </text>

            {/* ── Legend ── */}
            <line x1="155" y1="272" x2="185" y2="272"
              stroke="var(--viz-carry)" strokeWidth="2.2" strokeLinecap="round" />
            <text x="192" y="276"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              faas (L)
            </text>
            <line x1="155" y1="289" x2="185" y2="289"
              stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
            <text x="192" y="293"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              null (N)
            </text>
          </svg>
        </div>
      </div>

      {/* Wiring instructions card */}
      <div className="sys-block">
        <div style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderBottom: "1px solid var(--border)",
          fontFamily: "var(--mono)",
          fontSize: "var(--fs-sm)",
          color: "var(--text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.12em"
        }}>
          Ühendused
        </div>
        <Stack gap={0}>
          {[
            { n: "1", color: "var(--viz-carry)", text: "Toite faas (L) → lüliti sisend" },
            { n: "2", color: "var(--viz-carry)", text: "Lüliti väljund → valgusti (põhjaklemm)" },
            { n: "3", color: "var(--accent)",    text: "Valgusti null → toite null (N)" },
          ].map(row => (
            <div key={row.n} style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              padding: "10px var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-md)"
            }}>
              <span style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                border: "1px solid var(--border-strong)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--fs-xs)",
                color: "var(--text-subtle)",
                flexShrink: 0
              }}>
                {row.n}
              </span>
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: row.color,
                flexShrink: 0
              }} />
              <span style={{ color: "var(--text-muted)" }}>{row.text}</span>
            </div>
          ))}
        </Stack>
      </div>

    </Stack>
  );
}

function GuiderVeksellulit() {
  return (
    <Stack gap={4}>
      <Stack className="sys-head" gap={1}>
        <h3 className="sys-title">
          <Icon name="guider" className="sys-title-icon" /> Veksellüliti
        </h3>
        <span className="sys-head-sub">Valgusti ja kahe lülitiga skeem — 3-juhtmeline veksel</span>
      </Stack>

      <div className="sys-block">
        <div style={{ padding: "var(--sp-5) var(--sp-4) var(--sp-4)" }}>
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: "var(--fs-sm)",
            color: "var(--text-subtle)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "var(--sp-4)",
            paddingBottom: "var(--sp-3)",
            borderBottom: "1px solid var(--border)"
          }}>
            Skeem
          </div>

          <svg
            viewBox="0 0 660 320"
            width="100%"
            aria-label="Veksellüliti skeem"
            style={{ display: "block" }}
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

            {/* ── L supply ── */}
            <line x1="100" y1="290" x2="100" y2="205"
              stroke="var(--viz-carry)" strokeWidth="2" />
            <circle cx="100" cy="205" r="4" fill="var(--text)" />
            <text x="86" y="308"
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: "700", fill: "var(--text)" }}>
              L
            </text>

            {/* ── N supply: straight to lamp bottom ── */}
            <line x1="220" y1="290" x2="220" y2="92"
              stroke="var(--accent)" strokeWidth="2" />
            <circle cx="220" cy="290" r="4" fill="var(--text)" />
            <text x="206" y="308"
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fontWeight: "700", fill: "var(--text)" }}>
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
              style={{ fontFamily: "var(--mono)", fontSize: "12px", fill: "var(--text-muted)" }}>
              Valgusti
            </text>

            {/* ── Switched phase: L2 common → lamp right edge ── */}
            <line x1="585" y1="205" x2="620" y2="205"
              stroke="var(--viz-carry)" strokeWidth="2" />
            <line x1="620" y1="205" x2="620" y2="60"
              stroke="var(--viz-carry)" strokeWidth="2" />
            <line x1="252" y1="60" x2="620" y2="60"
              stroke="var(--viz-carry)" strokeWidth="2" />

            {/* ── Traveller wires ── */}
            <line x1="185" y1="175" x2="475" y2="175"
              stroke="var(--viz-carry)" strokeWidth="2" />
            <line x1="185" y1="235" x2="475" y2="235"
              stroke="var(--sys-s3)" strokeWidth="2" />

            {/* ════ LÜLITI 1 ════ */}
            <rect x="60" y="155" width="140" height="100" rx="5"
              fill="none" stroke="var(--text-subtle)"
              strokeWidth="1.2" strokeDasharray="6 3" />

            {/* L1 common — left side, open circle */}
            <circle cx="75" cy="205" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
            {/* Wire from L supply into common */}
            <line x1="100" y1="205" x2="79" y2="205"
              stroke="var(--viz-carry)" strokeWidth="2" />

            {/* L1 traveller A — right side, open circle */}
            <circle cx="185" cy="175" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />
            {/* L1 traveller B — right side, open circle */}
            <circle cx="185" cy="235" r="4.5" fill="none" stroke="var(--text)" strokeWidth="2" />

            {/* L1 lever — from common, angled toward traveller A, OPEN (floating, short) */}
            <line x1="75" y1="205" x2="138" y2="182"
              stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />

            {/* Lüliti 1 label */}
            <text x="130" y="272" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fill: "var(--text-muted)" }}>
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
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fill: "var(--text-muted)" }}>
              Lüliti 2
            </text>

            {/* ── Legend ── */}
            <line x1="240" y1="272" x2="265" y2="272"
              stroke="var(--viz-carry)" strokeWidth="2.2" strokeLinecap="round" />
            <text x="272" y="276"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              faas (L)
            </text>
            <line x1="240" y1="289" x2="265" y2="289"
              stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
            <text x="272" y="293"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              null (N)
            </text>
            <line x1="240" y1="306" x2="265" y2="306"
              stroke="var(--sys-s3)" strokeWidth="2.2" strokeLinecap="round" />
            <text x="272" y="310"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              veksel (kommuteeriv juhe)
            </text>
          </svg>
        </div>
      </div>

      {/* Connections */}
      <div className="sys-block">
        <div style={{
          padding: "var(--sp-3) var(--sp-4)",
          borderBottom: "1px solid var(--border)",
          fontFamily: "var(--mono)",
          fontSize: "var(--fs-sm)",
          color: "var(--text-subtle)",
          textTransform: "uppercase",
          letterSpacing: "0.12em"
        }}>
          Ühendused
        </div>
        <Stack gap={0}>
          {[
            { n: "1", color: "var(--viz-carry)",  text: "Toite faas (L) → Lüliti 1 ühisklemmile" },
            { n: "2", color: "var(--viz-carry)",  text: "Lüliti 1 väljund 1 ↔ Lüliti 2 sisend 1 (vekseltraat)" },
            { n: "3", color: "var(--sys-s3)",      text: "Lüliti 1 väljund 2 ↔ Lüliti 2 sisend 2 (vekseltraat)" },
            { n: "4", color: "var(--viz-carry)",  text: "Lüliti 2 ühisklemmilt → valgusti (põhjaklemm)" },
            { n: "5", color: "var(--accent)",     text: "Toite null (N) → valgusti nullklemmile" },
          ].map(row => (
            <div key={row.n} style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-3)",
              padding: "10px var(--sp-4)",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--mono)",
              fontSize: "var(--fs-md)"
            }}>
              <span style={{
                width: "20px", height: "20px", borderRadius: "50%",
                border: "1px solid var(--border-strong)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "var(--fs-xs)", color: "var(--text-subtle)", flexShrink: 0
              }}>
                {row.n}
              </span>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                background: row.color, flexShrink: 0
              }} />
              <span style={{ color: "var(--text-muted)" }}>{row.text}</span>
            </div>
          ))}
        </Stack>
      </div>

    </Stack>
  );
}

function SheetGuider() {
  const [listOpen, setListOpen] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState(null);

  const ENTRIES = [
    { id: "lihtluliti",   label: "Lihtlüliti" },
    { id: "veksellulit",  label: "Veksellüliti" }
    // more entries added here later
  ];

  const selected = ENTRIES.find(e => e.id === selectedId) || null;

  return (
    <>
      <div id="data-control" className="data-control">
        <ControlPanel id="control-guider-list" title="Electrism" open={listOpen} setOpen={setListOpen}>
          <Stack gap={1}>
            {ENTRIES.map(entry => (
              <button
                key={entry.id}
                type="button"
                className={"ctrl-dir" + (selectedId === entry.id ? " on" : "")}
                onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </Stack>
        </ControlPanel>
      </div>
      <div id="data-preview" className="data-preview">
        <Stack gap={3} className="guider-preview-list">

          {selected ? (
            selected.id === "lihtluliti"  ? <GuiderLihtluliti /> :
            selected.id === "veksellulit" ? <GuiderVeksellulit /> :
            (
              <div className="sys-block">
                <Stack className="section-pad" gap={2}>
                  <div className="data-row"><span className="data-row-lbl">{selected.label}</span></div>
                  <div className="ctrl-sublbl">Data for {selected.label} will be added here later.</div>
                </Stack>
              </div>
            )
          ) : (
            <>
              <Stack className="sys-head" gap={1}>
                <h3 className="sys-title"><Icon name="guider" className="sys-title-icon" /> Guider</h3>
                <span className="sys-head-sub">Select an entry to view details</span>
              </Stack>
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

function GuiderLihtluliti() {
  return (
    <Stack gap={3}>
      {/* Title */}
      <Stack className="sys-head" gap={1}>
        <h3 className="sys-title">
          <Icon name="guider" className="sys-title-icon" /> Lihtlüliti
        </h3>
        <span className="sys-head-sub">Valgusti ja lüliti skeem</span>
      </Stack>

      {/* Wiring diagram */}
      <div className="sys-block">
        <div className="section-pad">
          <svg
            viewBox="0 0 520 290"
            width="100%"
            aria-label="Valgusti ja lüliti skeem"
            style={{ display: "block", maxWidth: "620px" }}
          >
            {/*
              ── Layout key points ─────────────────────────────────────────
              Toide L dot:        (130, 185)
              Toide N dot:        (130, 225)
              Switch box:         x=145..255, y=165..205  centre y=185
              Switch left pin:    (160, 185)   ← Toide L connects here directly
              Switch right pin:   (240, 185)   ← switched phase exits here
              Vertical rise x:    240, from y=185 up to y=80
              Lamp centre:        (350, 80)    r=28
              Lamp left edge:     (322, 80)    ← pruun arrives here
              Lamp right edge:    (378, 80)    ← sinine leaves here
              Neutral bus y:      225, x 130→430
              Neutral vertical:   x=430, y=225 up to y=80
            */}

            {/* ── Toide L → switch left pin: straight horizontal ── */}
            <line x1="130" y1="185" x2="160" y2="185"
              stroke="var(--viz-carry)" strokeWidth="2.5" />

            {/* ── Switch right pin → vertical rise → horizontal to lamp left ── */}
            {/* vertical up */}
            <line x1="240" y1="185" x2="240" y2="80"
              stroke="var(--viz-carry)" strokeWidth="2.5" />
            {/* horizontal to lamp */}
            <line x1="240" y1="80" x2="322" y2="80"
              stroke="var(--viz-carry)" strokeWidth="2.5" />

            {/* pruun label: above the horizontal run to lamp */}
            <text x="281" y="72" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--viz-carry)" }}>
              pruun
            </text>

            {/* ── Neutral N: horizontal bus ── */}
            <line x1="130" y1="225" x2="430" y2="225"
              stroke="var(--accent)" strokeWidth="2.5" />
            {/* vertical rise to lamp right */}
            <line x1="430" y1="225" x2="430" y2="80"
              stroke="var(--accent)" strokeWidth="2.5" />
            {/* horizontal to lamp right edge */}
            <line x1="378" y1="80" x2="430" y2="80"
              stroke="var(--accent)" strokeWidth="2.5" />

            {/* sinine label: above the horizontal run from lamp right */}
            <text x="404" y="72" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--accent)" }}>
              sinine
            </text>

            {/* ── Junction dots ── */}
            <circle cx="130" cy="185" r="4" fill="var(--text)" />
            <circle cx="130" cy="225" r="4" fill="var(--text)" />

            {/* ── Toide labels ── */}
            <text x="18" y="183"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: "700", fill: "var(--text)" }}>
              Toide L
            </text>
            <text x="18" y="196"
              style={{ fontFamily: "var(--mono)", fontSize: "9px", fill: "var(--viz-carry)" }}>
              pruun
            </text>
            <text x="18" y="223"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: "700", fill: "var(--text)" }}>
              Toide N
            </text>
            <text x="18" y="236"
              style={{ fontFamily: "var(--mono)", fontSize: "9px", fill: "var(--accent)" }}>
              sinine
            </text>

            {/* ── Switch (Lüliti) — dashed box ── */}
            <rect x="145" y="165" width="110" height="40" rx="4"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.2"
              strokeDasharray="5 3" />
            {/* left contact dot (connected to Toide L) */}
            <circle cx="160" cy="185" r="3.5" fill="var(--text)" />
            {/* right contact dot (open / switched output) */}
            <circle cx="240" cy="185" r="3.5" fill="none" stroke="var(--text)" strokeWidth="1.8" />
            {/* lever tilted toward open contact */}
            <line x1="160" y1="185" x2="233" y2="170"
              stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
            {/* Lüliti label above box */}
            <text x="200" y="158" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fill: "var(--text-muted)" }}>
              Lüliti
            </text>

            {/* ── Lamp (Valgusti) — circle with X ── */}
            <circle cx="350" cy="80" r="28"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2" />
            <line x1="330" y1="60" x2="370" y2="100"
              stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="370" y1="60" x2="330" y2="100"
              stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
            {/* Valgusti label above lamp */}
            <text x="350" y="38" textAnchor="middle"
              style={{ fontFamily: "var(--mono)", fontSize: "11px", fill: "var(--text-muted)" }}>
              Valgusti
            </text>

            {/* ── Legend ── */}
            <line x1="145" y1="245" x2="172" y2="245"
              stroke="var(--viz-carry)" strokeWidth="2.5" strokeLinecap="round" />
            <text x="178" y="249"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              pruun – faas (L)
            </text>
            <line x1="145" y1="263" x2="172" y2="263"
              stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
            <text x="178" y="267"
              style={{ fontFamily: "var(--mono)", fontSize: "10px", fill: "var(--text-muted)" }}>
              sinine – null (N)
            </text>
          </svg>
        </div>
      </div>

      {/* Wiring instructions */}
      <div className="sys-block">
        <Stack className="section-pad" gap={1}>
          <Row label="Toite pruun kokku lüliti pruuniga" value="" />
          <Row label="Lüliti sinine kokku valgusti pruuniga" value="" />
          <Row label="(lambi põhjaklemm)" value="" />
          <Row label="Valgusti sinine kokku toite sinisega" value="" />
        </Stack>
      </div>
    </Stack>
  );
}

function SheetGuider() {
  const [listOpen, setListOpen] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState(null);

  const ENTRIES = [
    { id: "lihtluliti", label: "Lihtlüliti" }
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
            selected.id === "lihtluliti" ? <GuiderLihtluliti /> : (
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

import { useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { Icon, NumInput, RangeSlider, Row, Section, Stack, useTimedState } from "../shared.jsx";
import { buildPipeWrap } from "../utils/pipe-wrap.js";
import { ProjectSection } from "./ProjectMenu.jsx";

const PRESETS = [100, 125, 160, 200];
const THICKNESS_PRESETS = [20, 30, 50, 100];

/* The diagram's frame, in SVG units: the ring sits left, the sum right. */
const VIEW_W = 420, CX = 100, CY = 90, RING = 72, TEXT_X = 230;
const TURN = Math.PI * 2;
/* A label fits inside the pipe only when the pipe is drawn at least this big;
   a thick wrap on a thin pipe moves it under the ring instead. */
const LABEL_INSIDE_R = 24;
/* The pipe never takes more of the ring than this, so the wrap is always a
   band you can see: thin material drawn to scale would be a hairline, and the
   gap and overlap drawn on it would vanish under the pipe. */
const PIPE_MAX = 0.8;

/* The sum's lines are monospaced, so their width is their length times 0.6 of
   the font size. A line that would run past the frame is drawn condensed to
   fit rather than cut off at the edge. */
const fit = (text, size) => {
  const room = VIEW_W - TEXT_X - 6;
  return text.length * size * 0.6 > room ? { textLength: room, lengthAdjust: "spacingAndGlyphs" } : {};
};

/* A wedge of the outer ring, from `start` round `span` radians. A full turn is
   a circle: an arc whose ends meet draws nothing. */
function Wedge({ start, span, className }) {
  if (span <= 0) return null;
  if (span >= TURN - 1e-6) return <circle cx={CX} cy={CY} r={RING} className={className} />;
  const at = a => `${CX + RING * Math.cos(a)} ${CY + RING * Math.sin(a)}`;
  const large = span > Math.PI ? 1 : 0;
  return <path d={`M ${CX} ${CY} L ${at(start)} A ${RING} ${RING} 0 ${large} 1 ${at(start + span)} Z`} className={className} />;
}

/* The wrap drawn round its pipe, with the sum beside it. Drawn only once there
   is a pipe: before that every figure in it would be a zero nobody entered. */
function WrapDiagram({ wrap }) {
  const { pipe: d, thickness: t, overlap: o, gap: g, base, total, angles } = wrap;
  /* The outer ring always fills the frame, and the pipe is drawn in
     proportion inside it, so a thin pipe is as readable as a thick one. */
  const rPipe = RING * Math.min(PIPE_MAX, (d / 2) / (d / 2 + t));
  const top = -Math.PI / 2;
  const lines = [
    { text: `π × (${d} + 2×${t}) = ${base.toFixed(1)} mm`, className: "pw-diag-line", size: 11 },
    o > 0 && { text: `+ overlap ${o} mm`, className: "pw-diag-line pw-diag-line--overlap", size: 11 },
    g > 0 && { text: `− gap ${g} mm`, className: "pw-diag-line", size: 11 }
  ].filter(Boolean);
  const totalY = 28 + lines.length * 20 + 2;
  const legendY = totalY + 14;
  const keys = [g > 0 && ["gap", "pw-diag-key--gap"], o > 0 && ["overlap", "pw-diag-key--overlap"]].filter(Boolean);
  const pipeLabel = `Ø${d}mm`;

  return (
    <svg viewBox={`0 0 ${VIEW_W} 180`} width="100%" className="pw-diag-svg" role="img"
      aria-label={`Pipe wrap diagram: pipe ${d} mm, wrap length ${total.toFixed(1)} mm`}>
      <circle cx={CX} cy={CY} r={RING} className="pw-diag-ring" />
      <Wedge start={top} span={angles.gap} className="pw-diag-gap" />
      <Wedge start={top + angles.gap} span={angles.overlap} className="pw-diag-overlap" />
      <circle cx={CX} cy={CY} r={rPipe} className="pw-diag-pipe" />

      {rPipe >= LABEL_INSIDE_R ? <>
        <text x={CX} y={CY - 4} className="pw-diag-label" textAnchor="middle">pipe</text>
        <text x={CX} y={CY + 8} className="pw-diag-label" textAnchor="middle">{pipeLabel}</text>
      </> : (
        <text x={CX} y={CY + RING + 14} className="pw-diag-label" textAnchor="middle">pipe {pipeLabel}</text>
      )}

      {lines.map((line, i) => (
        <text key={i} x={TEXT_X} y={28 + i * 20} className={line.className} {...fit(line.text, line.size)}>{line.text}</text>
      ))}
      <text x={TEXT_X} y={totalY} className="pw-diag-total" {...fit(`= ${total.toFixed(1)} mm`, 14)}>= {total.toFixed(1)} mm</text>

      {keys.map(([label, keyClass], i) => (
        <g key={label}>
          <rect x={TEXT_X} y={legendY + i * 16} width="9" height="9" rx="2" className={keyClass} />
          <text x={TEXT_X + 13} y={legendY + 8 + i * 16} className={`pw-diag-legend pw-diag-legend--${label}`}>{label}</text>
        </g>
      ))}
    </svg>
  );
}

export function PipeWrapCalculator() {
  const [pipeDiam, setPipeDiam] = useSessionState("PipeWrapCalculator.jsx:pipeDiam", "");
  const [matThick, setMatThick] = useSessionState("PipeWrapCalculator.jsx:matThick", "");
  const [overlap, setOverlap] = useSessionState("PipeWrapCalculator.jsx:overlap", "");
  const [gap, setGap] = useSessionState("PipeWrapCalculator.jsx:gap", "");
  const [adjOpen, setAdjOpen] = React.useState(false);
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);

  const wrap = buildPipeWrap({ pipeDiam, matThick, overlap, gap });
  const { ready, pipe: d, thickness: t, overlap: o, gap: g, outer, base, total } = wrap;
  const dash = "—";

  /* Reset arms on the first click and fires on the second, as on the other
     calculators, and disarms itself after a while. */
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    setPipeDiam(""); setMatThick(""); setOverlap(""); setGap("");
  };

  /* Collapsed, the section still says what it is adding and taking off: an
     overlap left in from the last pipe would otherwise apply out of sight. */
  const adjustments = [o > 0 && `+${o} mm overlap`, g > 0 && `−${g} mm gap`].filter(Boolean).join(" · ");

  return (
    <div className="page-scroll">
      <Stack className="page-inner" gap={5}>

        <div className="layout-split">
          <Stack className="calc-main-stack" gap={4}>
            <ProjectSection variant="section" />
            {/* ── Inputs ── */}
            <div className="section unboxed">
              <div className="section-head">
                <span>Dimensions</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={3}>
                  <div className="pw-grid-2col">
                    <Stack gap={3}>
                      <NumInput
                        id="input-pipeDiam"
                        label="Pipe outer diameter (mm)"
                        value={pipeDiam}
                        min={1}
                        onChange={setPipeDiam}
                      />
                      <div className="preset-group">
                        <span className="ctrl-sublbl">Pipe diameter presets</span>
                        <div className="ctrl-btns preset-options">
                          {PRESETS.map(p => (
                            <button
                              key={p}
                              className={`pill-btn${d === p ? " on" : ""}`}
                              onClick={() => setPipeDiam(d === p ? "" : p)}
                            >
                              Ø {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Stack>

                    <Stack gap={3}>
                      <NumInput
                        id="input-matThick"
                        label="Material thickness (mm)"
                        value={matThick}
                        min={0}
                        onChange={setMatThick}
                      />
                      <div className="preset-group">
                        <span className="ctrl-sublbl">Material thickness presets</span>
                        <div className="ctrl-btns preset-options">
                          {THICKNESS_PRESETS.map(p => (
                            <button
                              key={p}
                              className={`pill-btn${t === p ? " on" : ""}`}
                              onClick={() => setMatThick(t === p ? "" : p)}
                            >
                              {p} mm
                            </button>
                          ))}
                        </div>
                      </div>
                    </Stack>
                  </div>

                </Stack>
              </div>
            </div>

            {/* ── adjustments ── */}
            <Section open={adjOpen} setOpen={setAdjOpen}
              title={<>Adjustments{!adjOpen && adjustments && <span className="pw-adj-summary"> {adjustments}</span>}</>}>
              <Stack className="section-pad" gap={3}>

                {/* overlap */}
                <Stack direction="row" gap={3} className="pw-adj-row">
                  <label className="ctrl-sublbl pw-adj-label" htmlFor="input-overlap-val">Overlap / extra (mm)</label>
                  <RangeSlider
                    id="input-overlap" label="Overlap in millimetres"
                    min={0} max={200} step={5} value={overlap}
                    className="pw-adj-range"
                    onChange={e => setOverlap(Number(e.target.value))}
                  />
                  <NumInput
                    id="input-overlap-val"
                    value={overlap}
                    min={0}
                    max={200}
                    onChange={setOverlap}
                  />
                </Stack>

                {/* gap */}
                <Stack direction="row" gap={3} className="pw-adj-row">
                  <label className="ctrl-sublbl pw-adj-label" htmlFor="input-gap-val">Gap / cutout (mm)</label>
                  <RangeSlider
                    id="input-gap" label="Gap in millimetres"
                    min={0} max={200} step={5} value={gap}
                    className="pw-adj-range"
                    onChange={e => setGap(Number(e.target.value))}
                  />
                  <NumInput
                    id="input-gap-val"
                    value={gap}
                    min={0}
                    max={200}
                    onChange={setGap}
                  />
                </Stack>

              </Stack>
            </Section>

            {/* ── details ── */}
            <div className="section unboxed calc-details">
              <div className="section-head">
                <span>Calculation Details</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={3}>
                  <div className="pw-res-wrap">
                    <Row label="Outer diameter" value={ready ? outer.toFixed(1) : dash} unit="mm" />
                    <Row label="Base wrap length" value={ready ? base.toFixed(1) : dash} unit="mm" />
                    <Row label="Calculated total" value={ready ? total.toFixed(1) : dash} unit="mm" />
                  </div>

                  {ready && <div className="pw-diag-wrap"><WrapDiagram wrap={wrap} /></div>}

                  <div className="pw-formula-wrap">
                    <span className="pw-formula-text">
                      formula: π × (pipe Ø + 2 × thickness) + overlap − gap
                    </span>
                  </div>
                </Stack>
              </div>
            </div>

            {/* Ends the form, as on Concrete: below the breakpoint the result
                column is a fixed bar, and clearing every field does not belong
                pinned under the thumb. */}
            <div className="form-action">
              <button onClick={handleReset} onBlur={disarmReset}
                className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
                aria-label={resetArmed ? "Confirm global reset — clears every field" : "Global reset — clears every field, asks first"}>
                <Icon name="refresh-cw" /> {resetArmed ? "Confirm reset?" : "Global Reset"}
              </button>
            </div>
          </Stack>

          <div className="result-sticky">
            <div className="result-card">
              <div className="result-card-primary">
              <span className="result-card-title">Final length needed</span>
              <span className="result-card-value">{ready ? `${(total / 10).toFixed(1)} cm` : dash}</span>
              </div>
              <span className="result-card-detail">
                {ready ? `${total.toFixed(1)} mm` : "Enter the pipe outer diameter."}
              </span>
              {wrap.gapTooLong && (
                <span role="status" className="input-error">The gap is longer than the wrap, so nothing is left to cut.</span>
              )}
            </div>
          </div>
        </div>

      </Stack>
    </div>
  );
}

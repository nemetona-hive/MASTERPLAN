import { React } from "../../react-globals.js";
import { useSessionState } from "../../utils/session-state.js";
import { NumInput, Section, Stack } from "../../shared.jsx";
import {
  ANGLE_MAX, ANGLE_MIN, CHART_L_MAX, CHART_L_MIN, DEFAULT_ANGLE, DEFAULT_ELBOW_OFFSET,
  MESSAGES, lengthFromOffset, offsetFromLength, roundMm, solveOffset
} from "../../utils/downpipe-offset.js";

const KEY = "Guider.ToruPolv70:";

/* The drawing is the manufacturer's schematic, not to scale: it shows what L
   and B measure, and stays the same whatever is entered. */
const PIPE_PATH = "M295 1220 L295 650 A80 80 0 0 1 347.6 574.8 L629.6 472.2 A80 80 0 0 0 682.2 397 L682.2 330";

function PipeDrawing() {
  return (
    <svg viewBox="0 0 860 1220" className="guider-pipe-svg" role="img"
      aria-label="Vihmaveetoru nihe kahe 70° põlvega: L on põlvede vaheline kaldtoru, B vertikaaltorude horisontaalne nihe">
      <g fill="none" strokeLinejoin="round">
        <path d={PIPE_PATH} stroke="var(--text-muted)" strokeWidth="64" />
        <path d={PIPE_PATH} stroke="var(--surface-2)" strokeWidth="59" />
      </g>
      <g stroke="var(--text-muted)" strokeWidth="2.5">
        <line x1="263" y1="650" x2="327" y2="650" />
        <line x1="336.6" y1="544.7" x2="358.6" y2="604.9" />
        <line x1="618.6" y1="442.1" x2="640.6" y2="502.3" />
        <line x1="650.2" y1="397" x2="714.2" y2="397" />
      </g>
      {/* Outlet funnel on the upper pipe */}
      <g stroke="var(--text-muted)" strokeWidth="2.5" strokeLinejoin="round">
        <rect x="648" y="316" width="68" height="22" fill="var(--surface-2)" />
        <path d="M650 316 L622 238 L742 238 L714 316 Z" fill="var(--surface-2)" />
        <path d="M626 238 Q682 292 738 238" fill="var(--surface-1)" />
        <rect x="612" y="226" width="140" height="12" rx="4" fill="var(--surface-2)" />
      </g>
      {/* Dimension B, edge to edge of the vertical pipes */}
      <g stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round">
        <line x1="265" y1="640" x2="265" y2="345" />
        <line x1="265" y1="360" x2="652.2" y2="360" />
        <line x1="255" y1="370" x2="275" y2="350" />
        <line x1="642.2" y1="370" x2="662.2" y2="350" />
      </g>
      <text x="458" y="335" textAnchor="middle" className="guider-pipe-lbl">B</text>
      {/* Dimension L, parallel to the sloped pipe */}
      <g stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round">
        <line x1="361.3" y1="612.4" x2="393.8" y2="701.7" />
        <line x1="643.3" y1="509.8" x2="675.8" y2="599.1" />
        <line x1="388.6" y1="687.6" x2="670.6" y2="585" />
        <line x1="382.7" y1="700.3" x2="394.5" y2="674.9" />
        <line x1="664.7" y1="597.7" x2="676.5" y2="572.3" />
      </g>
      <text x="560" y="720" textAnchor="middle" className="guider-pipe-lbl">L</text>
    </svg>
  );
}

/* ── L ↔ B graph ──────────────────────────────────────────────────────────
 * B across, L up, over the manufacturer chart's range. Drawn in real pixels
 * rather than a scaled viewBox, so the tick labels stay a readable size on a
 * phone. Pointing at it reads the line off at that B; pressing or dragging
 * sets the value, keeping whichever field the user is entering in. */
export const GRAPH_B = [200, 1250];
export const GRAPH_L = [50, 1150];
const PAD = { left: 52, right: 14, top: 14, bottom: 40 };
const range = (lo, hi, step) => {
  const out = [];
  for (let v = lo; v <= hi; v += step) out.push(v);
  return out;
};
const GRID_B = range(200, GRAPH_B[1], 100);
const GRID_L = range(100, GRAPH_L[1], 100);

function useWidth(ref, fallback) {
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function OffsetGraph({ angle, C, point, onPick }) {
  const wrapRef = React.useRef(null);
  const width = useWidth(wrapRef, 640);
  const height = Math.round(Math.min(420, Math.max(260, width * 0.62)));
  const [hover, setHover] = React.useState(null);
  const dragging = React.useRef(false);
  const clipId = React.useId();

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const x = b => PAD.left + (b - GRAPH_B[0]) / (GRAPH_B[1] - GRAPH_B[0]) * plotW;
  const y = l => PAD.top + (1 - (l - GRAPH_L[0]) / (GRAPH_L[1] - GRAPH_L[0])) * plotH;
  const valid = Number.isFinite(angle) && Number.isFinite(C);

  // The pointer's B, read back onto the line.
  const readAt = e => {
    if (!valid) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return null;
    const px = (e.clientX - rect.left) * (width / rect.width);
    const b = GRAPH_B[0] + (px - PAD.left) / plotW * (GRAPH_B[1] - GRAPH_B[0]);
    const B = Math.round(Math.min(GRAPH_B[1], Math.max(GRAPH_B[0], b)));
    const L = lengthFromOffset(B, angle, C);
    return L >= 0 ? { B, L } : null;
  };

  const lineFrom = { L: CHART_L_MIN, B: valid ? offsetFromLength(CHART_L_MIN, angle, C) : 0 };
  const lineTo = { L: CHART_L_MAX, B: valid ? offsetFromLength(CHART_L_MAX, angle, C) : 0 };
  const label = point
    ? `Graafik: L ${roundMm(point.L)} mm vastab B ${roundMm(point.B)} mm`
    : "Graafik: mõõt L sõltuvalt mõõdust B";

  return (
    <div ref={wrapRef} className="guider-graph">
      <svg width={width} height={height} className="guider-graph-svg" role="img" aria-label={label}
        onPointerDown={e => {
          const hit = readAt(e);
          if (!hit) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          onPick(hit);
        }}
        onPointerMove={e => {
          const hit = readAt(e);
          setHover(hit);
          if (dragging.current && hit) onPick(hit);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        onPointerLeave={() => { if (!dragging.current) setHover(null); }}>
        <defs>
          <clipPath id={clipId}><rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} /></clipPath>
        </defs>

        {/* 100 mm grid */}
        <g strokeWidth="1" shapeRendering="crispEdges">
          {GRID_B.map(b => (
            <line key={"b" + b} x1={x(b)} x2={x(b)} y1={PAD.top} y2={PAD.top + plotH}
              className="guider-graph-grid" />
          ))}
          {GRID_L.map(l => (
            <line key={"l" + l} y1={y(l)} y2={y(l)} x1={PAD.left} x2={PAD.left + plotW}
              className="guider-graph-grid" />
          ))}
        </g>

        {/* Ticks every 100 mm; every 200 on a narrow screen */}
        {GRID_B.filter(b => b % (plotW < 420 ? 200 : 100) === 0).map(b => (
          <text key={"tb" + b} x={x(b)} y={PAD.top + plotH + 16} textAnchor="middle" className="guider-graph-tick">{b}</text>
        ))}
        {GRID_L.filter(l => l % (plotH < 300 ? 200 : 100) === 0).map(l => (
          <text key={"tl" + l} x={PAD.left - 6} y={y(l) + 4} textAnchor="end" className="guider-graph-tick">{l}</text>
        ))}
        <text x={PAD.left + plotW} y={height - 4} textAnchor="end" className="guider-graph-axis">B (mm)</text>
        <text x={4} y={PAD.top + 4} className="guider-graph-axis" dominantBaseline="hanging"
          transform={`rotate(-90 4 ${PAD.top + 4})`} textAnchor="end">L (mm)</text>

        <g clipPath={`url(#${clipId})`}>
          {valid && (
            <line x1={x(lineFrom.B)} y1={y(lineFrom.L)} x2={x(lineTo.B)} y2={y(lineTo.L)}
              className="guider-graph-line" />
          )}

          {hover && (
            <g className="guider-graph-hover">
              <line x1={x(hover.B)} x2={x(hover.B)} y1={PAD.top} y2={PAD.top + plotH} />
              <circle cx={x(hover.B)} cy={y(hover.L)} r="4" />
            </g>
          )}

          {point && (
            <g>
              <line x1={PAD.left} x2={x(point.B)} y1={y(point.L)} y2={y(point.L)} className="guider-graph-cross" />
              <line x1={x(point.B)} x2={x(point.B)} y1={y(point.L)} y2={PAD.top + plotH} className="guider-graph-cross" />
              <circle cx={x(point.B)} cy={y(point.L)} r="5.5" className="guider-graph-dot" />
            </g>
          )}
        </g>

        {hover && (
          <text x={PAD.left + 8} y={PAD.top + 8} dominantBaseline="hanging" className="guider-graph-readout">
            B {hover.B} mm · L {roundMm(hover.L).toFixed(1)} mm
          </text>
        )}
      </svg>
    </div>
  );
}

export function GuiderToruPolv70() {
  // The field typed in last stays fixed; the other is always derived from it.
  const [source, setSource] = useSessionState(KEY + "source", "L");
  const [value, setValue] = useSessionState(KEY + "value", "");
  const [angle, setAngle] = useSessionState(KEY + "angle", DEFAULT_ANGLE);
  const [elbowOffset, setElbowOffset] = useSessionState(KEY + "C", DEFAULT_ELBOW_OFFSET);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const result = solveOffset({
    source,
    value: value === "" ? null : value,
    angle: angle === "" ? null : angle,
    C: elbowOffset === "" ? null : elbowOffset
  });
  const derived = source === "L" ? "B" : "L";
  const shown = {
    [source]: value,
    [derived]: result[derived] === null ? "" : roundMm(result[derived])
  };

  /* Tabbing through the derived field commits the figure it is showing; that
     is not the user entering it, so it must not swap which field is fixed. */
  const onField = field => v => {
    if (field !== source && v === shown[field]) return;
    setSource(field);
    setValue(v);
  };

  const pickFromGraph = hit => {
    setValue(source === "B" ? hit.B : roundMm(hit.L));
  };

  const resetParams = () => { setAngle(DEFAULT_ANGLE); setElbowOffset(DEFAULT_ELBOW_OFFSET); };
  const atChartValues = angle === DEFAULT_ANGLE && elbowOffset === DEFAULT_ELBOW_OFFSET;

  return (
    <Stack gap={4}>
      <div className="preview-head">
        <div className="preview-head-main">
          <h2 className="preview-title">Toru põlv 70°</h2>
          <p className="preview-desc">Vihmaveetoru nihe kahe 70° põlvega — sisesta L või B, teine arvutatakse</p>
        </div>
      </div>

      <div className="guider-calc">
        <div className="sys-block">
          <div className="guider-card-head">Mõõdud</div>
          <Stack className="section-pad" gap={3}>
            <NumInput id="input-toru-L" label="Mõõt L (mm)" value={shown.L} live onChange={onField("L")} />
            <NumInput id="input-toru-B" label="Mõõt B (mm)" value={shown.B} live onChange={onField("B")} />
            <div className="ctrl-sublbl">{source} sisestatud · {derived} arvutatud</div>
            <div aria-live="polite">
              {/* Nothing entered yet is a prompt, not a fault. */}
              {result.error && (
                <p className={"guider-msg" + (result.error === MESSAGES.empty ? "" : " guider-msg--error")}>
                  {result.error}
                </p>
              )}
              {result.warning && <p className="guider-msg guider-msg--warning">{result.warning}</p>}
            </div>
          </Stack>

          <Section title="Täpsemalt" open={advancedOpen} setOpen={setAdvancedOpen}>
            <Stack className="section-pad" gap={3}>
              <NumInput id="input-toru-angle" label="Nurk α (°)" value={angle}
                min={ANGLE_MIN} max={ANGLE_MAX} live onChange={setAngle} />
              <NumInput id="input-toru-C" label="Konstant C (mm)" value={elbowOffset}
                live onChange={setElbowOffset} />
              <div className="ctrl-sublbl">B = L · sin α + C · L = (B − C) / sin α</div>
              <button type="button" className="num-btn ctl-ghost guider-reset" onClick={resetParams}
                disabled={atChartValues}>
                Taasta tabeli väärtused
              </button>
            </Stack>
          </Section>
        </div>

        <div className="sys-block">
          <div className="guider-card-head">Skeem</div>
          <div className="section-pad">
            <PipeDrawing />
          </div>
        </div>
      </div>

      <div className="sys-block">
        <div className="guider-card-head">Graafik — vali punkt joonel</div>
        <div className="section-pad">
          <OffsetGraph
            angle={angle === "" ? NaN : angle}
            C={elbowOffset === "" ? NaN : elbowOffset}
            point={result.L === null ? null : { L: result.L, B: result.B }}
            onPick={pickFromGraph} />
        </div>
      </div>
    </Stack>
  );
}

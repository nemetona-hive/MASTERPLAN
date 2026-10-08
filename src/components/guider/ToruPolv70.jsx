import { React } from "../../react-globals.js";
import { useSessionState } from "../../utils/session-state.js";
import { NumInput, Row, Section, Stack } from "../../shared.jsx";
import {
  ANGLE_MAX, ANGLE_MIN, CHART_L_STEP, DEFAULT_ANGLE, DEFAULT_ELBOW_OFFSET,
  MESSAGES, chartRows, roundMm, solveOffset
} from "../../utils/downpipe-offset.js";

const KEY = "Guider.ToruPolv70:";
const CHART_ROWS = chartRows();

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

  const resetParams = () => { setAngle(DEFAULT_ANGLE); setElbowOffset(DEFAULT_ELBOW_OFFSET); };
  const atChartValues = angle === DEFAULT_ANGLE && elbowOffset === DEFAULT_ELBOW_OFFSET;
  const nearestRow = result.L === null ? null
    : CHART_ROWS.find(r => Math.abs(r.L - result.L) < CHART_L_STEP / 2);

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
        <div className="guider-card-head">Tootja tabel (α {DEFAULT_ANGLE}°, C {DEFAULT_ELBOW_OFFSET} mm)</div>
        <div className="section-pad">
          {CHART_ROWS.map(row => (
            <Row key={row.L} label={`L ${row.L} mm`} value={roundMm(row.B).toFixed(1)} unit="mm"
              hi={row === nearestRow} />
          ))}
        </div>
      </div>
    </Stack>
  );
}

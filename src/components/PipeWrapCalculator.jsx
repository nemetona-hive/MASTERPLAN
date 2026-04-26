const PRESETS = [100, 125, 160, 200];

function PipeWrapCalculator() {
  const [pipeDiam, setPipeDiam] = React.useState(100);
  const [matThick, setMatThick] = React.useState(50);
  const [overlap, setOverlap] = React.useState(0);
  const [gap, setGap]         = React.useState(0);
  const svgRef = React.useRef(null);

  const outer = pipeDiam + 2 * matThick;
  const base  = Math.PI * outer;
  const total = Math.max(0, base + overlap - gap);

  React.useEffect(() => {
    drawDiagram();
  }, [pipeDiam, matThick, overlap, gap]);

  function drawDiagram() {
    const svg = svgRef.current;
    if (!svg) return;

    const cx = 100, cy = 90, maxR = 72;
    const totalR_mm = (pipeDiam / 2 + matThick) || 1;
    // Lower reference radius = more "zoom" for smaller pipes
    const refR_mm = 110; 
    const scale = maxR / Math.max(refR_mm, totalR_mm);
    const rP = (pipeDiam / 2) * scale;
    const rO = totalR_mm * scale;

    const gapAngle  = outer > 0 ? (gap     / (Math.PI * outer)) * Math.PI * 2 : 0;
    const overAngle = outer > 0 ? (overlap / (Math.PI * outer)) * Math.PI * 2 : 0;

    const arc = (r, startA, endA) => {
      const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
      const x2 = cx + r * Math.cos(endA),   y2 = cy + r * Math.sin(endA);
      const lg = (endA - startA) > Math.PI ? 1 : 0;
      return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} Z`;
    };

    let ty = 28;
    const lines = [
      `<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-gray-opa80)">` +
        `π × (${pipeDiam} + 2×${matThick}) = ${base.toFixed(1)} mm</text>`
    ];
    if (overlap > 0) {
      ty += 20;
      lines.push(
        `<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-blue)">` +
          `+ overlap  ${overlap} mm</text>`
      );
    }
    if (gap > 0) {
      ty += 20;
      lines.push(
        `<text x="230" y="${ty}" style="font-family:var(--mono);font-size:11px;fill:var(--color-gray-opa80)">` +
          `− gap  ${gap} mm</text>`
      );
    }
    ty += 22;
    lines.push(
      `<text x="230" y="${ty}" style="font-family:var(--mono);font-size:14px;font-weight:700;fill:var(--color-primary)">` +
        `= ${total.toFixed(1)} mm</text>`
    );

    const cmResult = `
      <g transform="translate(230, 155)">
        <rect x="-8" y="-22" width="120" height="30" rx="6" 
          fill="color-mix(in srgb, var(--color-primary) 8%, transparent)"
          stroke="color-mix(in srgb, var(--color-primary) 20%, transparent)"
          stroke-width="0.5" />
        <text x="8" y="2" style="font-family:var(--mono);font-size:22px;font-weight:800;fill:var(--color-primary)">
          ${(total / 10).toFixed(1)} cm
        </text>
      </g>
    `;

    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${rO}"
        fill="color-mix(in srgb, var(--color-gray-light) 80%, transparent)"
        stroke="var(--color-gray)" stroke-width="0.5"/>

      ${gap > 0 ? `<path d="${arc(rO, -Math.PI/2, -Math.PI/2 + gapAngle)}"
        fill="color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)"
        stroke="var(--color-gray)" stroke-width="0.5"/>` : ""}

      ${overlap > 0 ? `<path d="${arc(rO, -Math.PI/2 + gapAngle, -Math.PI/2 + gapAngle + overAngle)}"
        fill="color-mix(in srgb, var(--color-blue) 35%, transparent)"
        stroke="var(--color-blue)" stroke-width="0.5" opacity="0.9"/>` : ""}

      <circle cx="${cx}" cy="${cy}" r="${rP}"
        fill="var(--color-darkblue)"
        stroke="var(--color-gray)" stroke-width="0.5"/>

      <text x="${cx}" y="${cy - 4}"
        style="font-family:var(--mono);font-size:9px;fill:var(--color-gray-opa80)"
        text-anchor="middle">pipe</text>
      <text x="${cx}" y="${cy + 8}"
        style="font-family:var(--mono);font-size:9px;fill:var(--color-gray-opa80)"
        text-anchor="middle">Ø${pipeDiam}mm</text>

      ${lines.join("\n")}
      ${cmResult}

      ${gap > 0 ? `
        <rect x="230" y="${ty + 14}" width="9" height="9" rx="2"
          fill="color-mix(in srgb, var(--color-gray-opa80) 40%, transparent)"
          stroke="var(--color-gray)" stroke-width="0.5"/>
        <text x="243" y="${ty + 22}"
          style="font-family:var(--mono);font-size:10px;fill:var(--color-gray-opa80)">gap</text>
      ` : ""}
      ${overlap > 0 ? `
        <rect x="230" y="${ty + (gap > 0 ? 30 : 14)}" width="9" height="9" rx="2"
          fill="color-mix(in srgb, var(--color-blue) 35%, transparent)"
          stroke="var(--color-blue)" stroke-width="0.5"/>
        <text x="243" y="${ty + (gap > 0 ? 38 : 22)}"
          style="font-family:var(--mono);font-size:10px;fill:var(--color-blue)">overlap</text>
      ` : ""}
    `;
  }

  return (
    <div className="page-scroll">
      <div className="page-inner">

        {/* ── header ── */}
        <div className="main-head pw-head-adj">
          <div className="title">Pipe wrap calculator</div>
          <div className="desc">Material length needed to wrap around a pipe</div>
        </div>

        {/* ── inputs ── */}
        <div className="section">
          <div className="section-head">
            <span>Dimensions</span>
          </div>
          <div className="section-body">
            <div className="section-pad">
              <div className="pw-grid-2col">

                <NumInput
                  id="input-pipeDiam"
                  label="Pipe outer diameter"
                  value={pipeDiam}
                  min={1}
                  unit="mm"
                  onChange={setPipeDiam}
                />

                <NumInput
                  id="input-matThick"
                  label="Material thickness"
                  value={matThick}
                  min={0}
                  unit="mm"
                  onChange={setMatThick}
                />
              </div>

              {/* presets */}
              <div className="num-lbl pw-preset-label">Pipe diameter presets</div>
              <div className="ctrl-btns">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    className={`ctrl-dir${pipeDiam === p ? " on" : ""}`}
                    onClick={() => setPipeDiam(p)}
                  >
                    Ø {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── adjustments ── */}
        <div className="section">
          <div className="section-head">
            <span>Adjustments</span>
          </div>
          <div className="section-body">
            <div className="section-pad">

              {/* overlap */}
              <div className="pw-adj-row mb">
                <button
                  onClick={() => setOverlap(prev => Math.min(200, prev + 5))}
                  className="pw-adj-btn pw-adj-btn-overlap"
                >+</button>
                <span className="ctrl-sublbl pw-adj-label">Overlap / extra (mm)</span>
                <input
                  type="range" min={0} max={200} step={5} value={overlap}
                  className="pw-adj-range"
                  onChange={e => setOverlap(Number(e.target.value))}
                />
                <span className="ctrl-range-val pw-adj-val">{overlap}</span>
              </div>

              {/* gap */}
              <div className="pw-adj-row">
                <button
                  onClick={() => setGap(prev => Math.min(200, prev + 5))}
                  className="pw-adj-btn pw-adj-btn-gap"
                >−</button>
                <span className="ctrl-sublbl pw-adj-label">Gap / cutout (mm)</span>
                <input
                  type="range" min={0} max={200} step={5} value={gap}
                  className="pw-adj-range"
                  onChange={e => setGap(Number(e.target.value))}
                />
                <span className="ctrl-range-val pw-adj-val">{gap}</span>
              </div>

            </div>
          </div>
        </div>

        {/* ── results ── */}
        <div className="section">
          <div className="section-head">
            <span>Result</span>
          </div>
          <div className="section-body">

            <div className="pw-res-wrap">
              <div className="data-row">
                <span className="data-row-lbl">Outer diameter</span>
                <span className="data-row-val">{outer.toFixed(1)}</span>
                <span className="data-row-unit">mm</span>
              </div>
              <div className="data-row">
                <span className="data-row-lbl">Base wrap length</span>
                <span className="data-row-val">{base.toFixed(1)}</span>
                <span className="data-row-unit">mm</span>
              </div>
              <div className="data-row pw-res-row-last">
                <span className="data-row-lbl">Final length needed</span>
                <span className="data-row-val hi">{total.toFixed(1)}</span>
                <span className="data-row-unit">mm</span>
              </div>
            </div>

            {/* diagram */}
            <div className="pw-diag-wrap">
              <svg
                ref={svgRef}
                viewBox="0 0 420 180"
                width="100%"
                className="pw-diag-svg"
              />
            </div>

            <div className="pw-formula-wrap">
              <span className="pw-formula-text">
                formula: π × (pipe Ø + 2 × thickness) + overlap − gap
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

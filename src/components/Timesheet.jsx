// ── SheetTimesheet ────────────────────────────────────────────────────────────

const LUNCH_PRESETS = [
  ['15 min', '.15'],
  ['20 min', '.20'],
  ['30 min', '.30'],
  ['45 min', '.45'],
  ['1 h',    '1:00'],
];


function makeCalcRows() {
  return [1, 2, 3].map(id => ({ id, start: '', end: '', lunch: '' }));
}

function makeSumRows() {
  return [1, 2, 3, 4, 5].map(id => ({ id, value: '' }));
}

function calcRowResult(row) {
  const s     = parseTime(row.start);
  const e     = parseTime(row.end);
  const lunch = parseLunch(row.lunch);
  const hasInput = row.start.trim() || row.end.trim();

  if (!hasInput) return { dur: '', dec: '', status: 'empty', mins: 0 };

  if (s !== null && e !== null) {
    if (lunch === null) return { dur: 'invalid lunch', dec: '', status: 'error', mins: 0 };
    let diff = e - s;
    if (diff < 0) diff += 24 * 60;        // overnight support
    if (lunch > diff) return { dur: 'lunch > work', dec: '', status: 'warn', mins: 0 };
    diff -= lunch;
    return { dur: fmtHHMM(diff), dec: fmtDecimal(diff), status: 'ok', mins: diff };
  }

  const badStart = row.start.trim() && s === null;
  const badEnd   = row.end.trim()   && e === null;
  if (badStart || badEnd) return { dur: 'invalid', dec: '', status: 'error', mins: 0 };
  return { dur: '', dec: '', status: 'partial', mins: 0 };
}

function SheetTimesheet() {
  const [activeTab,   setActiveTab]   = useState('calc');
  const [calcRows,    setCalcRows]    = useState(makeCalcRows);
const [activeRowId, setActiveRowId] = useState(null);
  const [sumRows,     setSumRows]     = useState(makeSumRows);
  const [copied,      setCopied]      = useState(false);

  const nextCalcId = React.useRef(4);
  const nextSumId  = React.useRef(6);
  const startRefs  = React.useRef({});

  // ── Derived ────────────────────────────────────────────────────────────────

  const calcResults   = calcRows.map(r => calcRowResult(r));
  const calcTotalMins = calcResults.reduce((s, r) => s + r.mins, 0);
  const hasCalcTotal  = calcResults.some(r => r.status === 'ok');

  const sumTotalMins = sumRows.reduce((s, r) => {
    const v = parseSumTime(r.value);
    return v !== null ? s + v : s;
  }, 0);
  const hasSumTotal = sumRows.some(r => parseSumTime(r.value) !== null);

  const showTotal = activeTab === 'calc' ? hasCalcTotal : hasSumTotal;
  const totalMins = activeTab === 'calc' ? calcTotalMins : sumTotalMins;

  // ── Calc actions ───────────────────────────────────────────────────────────

  const addCalcRow = () => {
    const id = nextCalcId.current++;
    setCalcRows(prev => [...prev, { id, start: '', end: '', lunch: '' }]);
    return id;
  };

  const removeCalcRow  = id => setCalcRows(prev => prev.filter(r => r.id !== id));
  const updateCalcRow  = (id, field, value) =>
    setCalcRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const clearCalc = () => {
    nextCalcId.current = 4;
    setCalcRows(makeCalcRows());
    setActiveRowId(null);
  };

  const applyLunchPreset = val => {
    if (activeRowId != null) updateCalcRow(activeRowId, 'lunch', val);
  };

  // Tab from Lunch → next row Start; auto-adds row if on last
  const handleLunchTab = (e, rowIdx) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const nextRow = calcRows[rowIdx + 1];
    if (nextRow) {
      startRefs.current[nextRow.id]?.focus();
    } else {
      const newId = nextCalcId.current++;
      setCalcRows(prev => [...prev, { id: newId, start: '', end: '', lunch: '' }]);
      setTimeout(() => startRefs.current[newId]?.focus(), 0);
    }
  };

  // ── Sum actions ────────────────────────────────────────────────────────────

  const addSumRow   = () => { const id = nextSumId.current++; setSumRows(prev => [...prev, { id, value: '' }]); };
  const removeSumRow = id => setSumRows(prev => prev.filter(r => r.id !== id));
  const updateSumRow = (id, value) => setSumRows(prev => prev.map(r => r.id === id ? { ...r, value } : r));
  const clearSum    = () => { nextSumId.current = 6; setSumRows(makeSumRows()); };

  // ── Copy ───────────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!hasCalcTotal) return;
    navigator.clipboard.writeText(fmtDecimal(calcTotalMins)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ts-page">

      <div className="ts-body">

        <div className="ts-tabs">
          <button className={"ts-tab" + (activeTab === 'calc' ? " ts-tab--on" : "")}
            onClick={() => setActiveTab('calc')}>Calculate hours</button>
          <button className={"ts-tab" + (activeTab === 'sum'  ? " ts-tab--on" : "")}
            onClick={() => setActiveTab('sum')}>Sum hours</button>
        </div>

        {/* ── Calculate tab ────────────────────────────────────────────────── */}
        {activeTab === 'calc' && (
          <div className="ts-section">
            <div className="ts-grid-hd">
              <span className="ts-col-lbl">Start</span>
              <span className="ts-col-lbl">End</span>
              <span className="ts-col-lbl">Lunch</span>
              <span className="ts-col-lbl">Duration</span>
              <span className="ts-col-lbl ts-col-dec">Decimal</span>
              <span />
            </div>

            {calcRows.map((row, idx) => {
              const res = calcResults[idx];
              return (
                <div key={row.id}
                  className={"ts-grid-row" + (row.id === activeRowId ? " ts-grid-row--active" : "")}>
                  <input className="ts-input" type="text" placeholder="9, 9:30, 0930"
                    value={row.start}
                    ref={el => { startRefs.current[row.id] = el; }}
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={e => updateCalcRow(row.id, 'start', e.target.value)} />
                  <input className="ts-input" type="text" placeholder="17, 17:30"
                    value={row.end}
                    onFocus={() => setActiveRowId(row.id)}
                    onChange={e => updateCalcRow(row.id, 'end', e.target.value)} />
                  <input className="ts-input" type="text" placeholder=".30"
                    value={row.lunch}
                    onFocus={() => setActiveRowId(row.id)}
                    onKeyDown={e => handleLunchTab(e, idx)}
                    onChange={e => updateCalcRow(row.id, 'lunch', e.target.value)} />
                  <div className={
                    "ts-duration" +
                    (res.status === 'error' ? " ts-duration--error" :
                     res.status === 'warn'  ? " ts-duration--warn"  : "")
                  }>{res.dur}</div>
                  <div className="ts-decimal ts-col-dec">{res.dec}</div>
                  <button className="ts-remove" tabIndex={-1}
                    onClick={() => removeCalcRow(row.id)}>×</button>
                </div>
              );
            })}

            <div className="ts-pills">
              <span className="ts-pill-lbl">Lunch:</span>
              {LUNCH_PRESETS.map(([label, val]) => (
                <button key={val} className="ts-pill"
                  onClick={() => applyLunchPreset(val)}>{label}</button>
              ))}
            </div>

            <div className="ts-controls">
              <button className="ts-btn" onClick={addCalcRow}>+ Add row</button>
              <button className="ts-btn ts-btn--muted" onClick={clearCalc}>Clear all</button>
            </div>
          </div>
        )}

        {/* ── Sum tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'sum' && (
          <div className="ts-section">
            {sumRows.map(row => (
              <div key={row.id} className="ts-sum-row">
                <input className="ts-input" type="text" placeholder="e.g. 6:35, 8:15"
                  value={row.value}
                  onChange={e => updateSumRow(row.id, e.target.value)} />
                <button className="ts-remove" tabIndex={-1}
                  onClick={() => removeSumRow(row.id)}>×</button>
              </div>
            ))}
            <div className="ts-controls">
              <button className="ts-btn" onClick={addSumRow}>+ Add row</button>
              <button className="ts-btn ts-btn--muted" onClick={clearSum}>Clear all</button>
            </div>
          </div>
        )}

      </div>

      {/* ── Sticky total bar ───────────────────────────────────────────────── */}
      {showTotal && (
        <div className="ts-footer">
          <span className="ts-total-lbl">Total</span>
          <div className="ts-total-vals">
            <span className="ts-total-val">{fmtHHMM(totalMins)}</span>
            {activeTab === 'calc' && (
              <span className="ts-total-dec">= {fmtDecimal(totalMins)}</span>
            )}
            {activeTab === 'calc' && (
              <button className={"ts-copy" + (copied ? " ts-copy--done" : "")}
                onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy decimal'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

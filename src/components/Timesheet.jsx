import { React, useState } from "../react-globals.js";
import { Icon, Stack, useTimedState } from "../shared.jsx";
import { fmtDecimal, fmtHHMM, parseLunch, parseTime } from "../utils/timesheet.js";

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

export function SheetTimesheet() {
  const [calcRows,    setCalcRows]    = useState(makeCalcRows);
  const [activeRowId, setActiveRowId] = useState(null);
  const [copied,      setCopied]      = useTimedState(false, 1800);
  const [copyError,   setCopyError]   = useTimedState(false, 1800);

  const nextCalcId = React.useRef(4);
  const startRefs  = React.useRef({});

  // ── Derived ────────────────────────────────────────────────────────────────

  const calcResults   = calcRows.map(r => calcRowResult(r));
  const calcTotalMins = calcResults.reduce((s, r) => s + r.mins, 0);
  const hasCalcTotal  = calcResults.some(r => r.status === 'ok');

  // ── Calc actions ───────────────────────────────────────────────────────────

  const addCalcRow = () => {
    const id = nextCalcId.current++;
    setCalcRows(prev => [...prev, { id, start: '', end: '', lunch: '' }]);
    return id;
  };

  const removeCalcRow = id => {
    setCalcRows(prev => prev.filter(r => r.id !== id));
    if (activeRowId === id) setActiveRowId(null);
  };
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

  // Format time input to HH:MM on blur
  const formatTimeInput = (id, field, value) => {
    if (field === 'lunch') return; // lunch uses .MM format, don't convert
    const parsed = parseTime(value);
    if (parsed !== null && value.trim()) {
      updateCalcRow(id, field, fmtHHMM(parsed));
    }
  };

  // Tab from Lunch → next row Start; auto-adds row if on last
  const handleLunchTab = (e, rowIdx) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    e.preventDefault();
    const nextRow = calcRows[rowIdx + 1];
    if (nextRow) {
      startRefs.current[nextRow.id]?.focus();
    } else {
      const newId = addCalcRow();
      setTimeout(() => startRefs.current[newId]?.focus(), 0);
    }
  };


  // ── Copy ───────────────────────────────────────────────────────────────────

  // navigator.clipboard is undefined outside a secure context — file://, plain
  // http on a LAN address, older browsers — which is exactly how this page gets
  // opened. Falling back to the deprecated execCommand keeps the copy working
  // there instead of leaving the user at a dead "Error" badge.
  const legacyCopy = text => {
    const ta = document.createElement('textarea');
    ta.value = text;
    // Keep it off-screen but still selectable; display:none is not.
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    try {
      ta.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  };

  const handleCopy = () => {
    if (!hasCalcTotal) return;
    const text = fmtDecimal(calcTotalMins);

    if (!navigator.clipboard) {
      if (legacyCopy(text)) setCopied(true);
      else setCopyError(true);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      if (legacyCopy(text)) setCopied(true);
      else setCopyError(true);
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="ts-page">
      <Stack className="ts-body" gap={3}>
        
        <div className="layout-split">
          
          <Stack className="ts-section" gap={3}>
            {/* ── Calculate tab ────────────────────────────────────────────────── */}
            <div className="section unboxed">
              <div className="section-head">
                <span>Time Entries</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={4}>
                  
                  {/* Entries */}
                  <Stack gap={1}>
                    <div className="ts-grid-hd" style={{marginTop: 'var(--sp-2)'}}>
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
                            <div>
                              <span className="pw-preset-lbl-hide">Start</span>
                              <input 
                                id={`ts-start-${row.id}`}
                                name={`ts-start-${row.id}`}
                                className="num-input ts-input" type="text" placeholder="9, 9:30, 0930"
                                value={row.start}
                                ref={el => { startRefs.current[row.id] = el; }}
                                onFocus={() => setActiveRowId(row.id)}
                                onChange={e => updateCalcRow(row.id, 'start', e.target.value)}
                                onBlur={e => formatTimeInput(row.id, 'start', e.target.value)} />
                            </div>
                            <div>
                              <span className="pw-preset-lbl-hide">End</span>
                              <input 
                                id={`ts-end-${row.id}`}
                                name={`ts-end-${row.id}`}
                                className="num-input ts-input" type="text" placeholder="17, 17:30"
                                value={row.end}
                                onFocus={() => setActiveRowId(row.id)}
                                onChange={e => updateCalcRow(row.id, 'end', e.target.value)}
                                onBlur={e => formatTimeInput(row.id, 'end', e.target.value)} />
                            </div>
                            <div>
                              <span className="pw-preset-lbl-hide">Lunch</span>
                              <input 
                                id={`ts-lunch-${row.id}`}
                                name={`ts-lunch-${row.id}`}
                                className="num-input ts-input" type="text" placeholder=".30"
                                value={row.lunch}
                                onFocus={() => setActiveRowId(row.id)}
                                onKeyDown={e => handleLunchTab(e, idx)}
                                onChange={e => updateCalcRow(row.id, 'lunch', e.target.value)} />
                            </div>
                            <div>
                              <span className="pw-preset-lbl-hide">Duration</span>
                              <div className={
                                "ts-duration" +
                                (res.status === 'error' ? " ts-duration--error" :
                                 res.status === 'warn'  ? " ts-duration--warn"  : "")
                              }>{res.dur}</div>
                            </div>
                            <div className="ts-col-dec">
                              <span className="pw-preset-lbl-hide">Decimal</span>
                              <div className="ts-decimal">{res.dec}</div>
                            </div>
                            <div className="ts-remove-wrap">
                              <span className="pw-preset-lbl-hide">&nbsp;</span>
                              <button className="num-btn ts-remove ctl-ghost ctl-sm ctl-icon ctl-danger" tabIndex={-1}
                                aria-label="Remove row"
                                onClick={() => removeCalcRow(row.id)}><Icon name="close" /></button>
                            </div>
                        </div>
                      );
                    })}
                  </Stack>

                  <div style={{height: '1px', background: 'var(--divider-subtle)', margin: 'var(--sp-2) 0'}} />

                  {/* Controls */}
                  <Stack gap={4}>
                    <Stack gap={2} className="ts-pills">
                      <div className="pw-preset-header" style={{ display: 'block', gridTemplateColumns: 'none' }}>
                        <span>Lunch presets:</span>
                      </div>
                      <div className="ctrl-btns" style={{ flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-start' }}>
                        {LUNCH_PRESETS.map(([label, val]) => (
                          <button key={val} className="pill-btn"
                            onClick={() => applyLunchPreset(val)}>{label}</button>
                        ))}
                      </div>
                    </Stack>

                    <Stack direction="row" gap={2} className="ts-controls">
                      <button className="ts-btn" onClick={addCalcRow}>+ Add row</button>
                      <button className="ts-btn ctl-ghost ctl-danger" onClick={clearCalc}>Clear all</button>
                    </Stack>
                  </Stack>

                </Stack>
              </div>
            </div>
          </Stack>

          {/* Sticky Result Column */}
          <div className="u-sticky u-sticky-top" style={{ marginTop: 'var(--sticky-offset)', top: '20px' }}>
            <div className="result-card">
              <span className="result-card-title">Total Hours</span>
              <span className="result-card-value">
                {fmtHHMM(calcTotalMins) || "0:00"} <span className="result-card-val-sub">h</span>
              </span>
              
              <div className="result-card-footer">
                <div className="result-card-footer-item">
                  <span className="result-card-footer-lbl">Decimal time: </span>
                  <span className="result-card-footer-val">{fmtDecimal(calcTotalMins) || "0.00"}</span>
                </div>
                
                <div style={{marginTop: 'var(--sp-4)'}}>
                  <button 
                    className={"ts-copy" + (copied ? " ts-copy--done" : "") + (copyError ? " ts-copy--error" : "")}
                    onClick={handleCopy}
                    style={{width: '100%', padding: '12px', fontSize: 'var(--fs-md)', borderRadius: '6px', textAlign: 'center'}}
                  >
                    {copied ? 'Copied!' : copyError ? 'Error' : 'Copy decimal'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </Stack>
    </div>
  );
}

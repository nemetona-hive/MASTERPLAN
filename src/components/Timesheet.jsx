import { useSessionState } from "../utils/session-state.js";
import { React, useState } from "../react-globals.js";
import { Icon, Stack, useDocHistory, useTimedState } from "../shared.jsx";
import { fmtDecimal, fmtHHMM, parseTime, rowResult } from "../utils/timesheet.js";
import { useGridNav } from "../utils/grid-nav.js";
import { ProjectSection } from "./ProjectMenu.jsx";

// ── SheetTimesheet ────────────────────────────────────────────────────────────

const LUNCH_PRESETS = [
  ['15 min', '.15'],
  ['20 min', '.20'],
  ['30 min', '.30'],
  ['45 min', '.45'],
  ['1 h',    '1:00'],
];


/* The typed columns, in the order they are rendered. The index into this is the
   grid column an arrow key moves through, and the name is half the DOM id every
   cell already has — `ts-start-4` and the rest — so arrow-nav needs no refs and
   no new bookkeeping on the page. Duration and Decimal are not columns here:
   they are read-only results, and an arrow that landed on one would be a move
   into a dead end. */
const TS_COLUMNS = ['start', 'end', 'lunch'];

function makeCalcRows() {
  return [1, 2, 3].map(id => ({ id, start: '', end: '', lunch: '' }));
}

export function SheetTimesheet() {
  const [calcRows,    setCalcRows]    = useSessionState("Timesheet.jsx:calcRows", makeCalcRows);
  const [activeRowId, setActiveRowId] = useState(null);
  const [copied,      setCopied]      = useTimedState(false, 1800);
  const [copyError,   setCopyError]   = useTimedState(false, 1800);
  const [needRow,     setNeedRow]     = useTimedState(false, 3000);

  const nextCalcId = React.useRef(Math.max(3, ...calcRows.map(row => row.id)) + 1);
  const startRefs  = React.useRef({});

  /* Undo for the buttons on this page. `nextCalcId` rides along in the
     snapshot and is NOT an implementation detail leaking in: "Clear all"
     resets it to 4, so an undo that restored seven rows without it would hand
     the next "Add row" an id that two rows already answer to, and React would
     key them the same. The active row is view state and stays out — an undo
     restores what the sheet held, it does not move your cursor. */
  const markStep = useDocHistory({
    key: "timesheet",
    snapshot: () => ({ rows: calcRows, nextId: nextCalcId.current }),
    apply: ({ rows, nextId }) => {
      nextCalcId.current = nextId;
      setCalcRows(rows);
    }
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const calcResults   = calcRows.map(rowResult);
  const calcTotalMins = calcResults.reduce((s, r) => s + r.mins, 0);
  const incomplete = calcResults.some(r => ['partial', 'error', 'warn'].includes(r.status));
  const hasCalcTotal = !incomplete && calcResults.some(r => r.status === 'ok');

  // ── Calc actions ───────────────────────────────────────────────────────────

  const addCalcRow = () => {
    markStep("Add row");
    const id = nextCalcId.current++;
    setCalcRows(prev => [...prev, { id, start: '', end: '', lunch: '' }]);
    return id;
  };

  const removeCalcRow = id => {
    markStep("Remove row");
    setCalcRows(prev => prev.filter(r => r.id !== id));
    if (activeRowId === id) setActiveRowId(null);
  };
  const updateCalcRow  = (id, field, value) =>
    setCalcRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const clearCalc = () => {
    markStep("Clear all");
    nextCalcId.current = 4;
    setCalcRows(makeCalcRows());
    setActiveRowId(null);
  };

  /* A step, even though it writes a text field. The line runs between what a
     button did and what a keystroke did: nobody typed this, so field-undo
     never saw it and there would be nothing to take it back with. */
  const applyLunchPreset = val => {
    if (activeRowId == null) { setNeedRow(true); return; }
    markStep("Set lunch");
    updateCalcRow(activeRowId, 'lunch', val);
  };

  // Format time input to HH:MM on blur
  const formatTimeInput = (id, field, value) => {
    if (field === 'lunch') return; // lunch uses .MM format, don't convert
    const parsed = parseTime(value);
    if (parsed !== null && value.trim()) {
      updateCalcRow(id, field, fmtHHMM(parsed));
    }
  };

  /* Arrow-key movement across the three typed columns: Up and Down step between
     rows in the same column, Left and Right cross to the neighbouring column
     once the caret has run out of field. Tab is untouched — see the note in
     grid-nav.js about why the roving tabindex stayed in MONEYFLOW. */
  const gridNav = useGridNav({
    rowCount: calcRows.length,
    colCount: TS_COLUMNS.length,
    cellId: (rowIndex, colIndex) => {
      const row = calcRows[rowIndex];
      return row ? `ts-${TS_COLUMNS[colIndex]}-${row.id}` : "";
    }
  });

  /* One props bag per cell. Lunch brings a keydown of its own — Tab there walks
     to the next row and adds one at the end — so the two are merged here rather
     than spread one after the other at the call site, where the second would
     silently replace the first. The page handler runs first and the arrows only
     answer keys it did not take. */
  const cellProps = (rowIndex, colIndex, onKeyDown) => {
    const nav = gridNav.cellProps(rowIndex, colIndex);
    if (!onKeyDown) return nav;
    return {
      ...nav,
      onKeyDown: event => { onKeyDown(event); nav.onKeyDown(event); }
    };
  };

  /* Tab from Lunch goes to the next row's Start, and from the last row adds a
     row — but only when that row has something in it. From an empty last row
     Tab carries on to the presets and buttons as normal: adding a row every
     time was a trap a keyboard could never leave. */
  const handleLunchTab = (e, rowIdx) => {
    if (e.key !== 'Tab' || e.shiftKey) return;
    const nextRow = calcRows[rowIdx + 1];
    if (!nextRow && calcResults[rowIdx].status === 'empty') return;
    e.preventDefault();
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
            <ProjectSection variant="section" />
            {/* ── Calculate tab ────────────────────────────────────────────────── */}
            <div className="section unboxed">
              <div className="section-head">
                <span>Time Entries</span>
              </div>
              <div className="section-body">
                <Stack className="section-pad" gap={4}>
                  
                  {/* Entries */}
                  <Stack gap={1}>
                    <div className="ts-grid-hd">
                      <span className="ts-col-lbl">Start</span>
                      <span className="ts-col-lbl">End</span>
                      <span className="ts-col-lbl">Lunch</span>
                      <span className="ts-col-lbl">Duration</span>
                      <span className="ts-col-lbl ts-col-dec" title="Rounded to the nearest quarter hour">Decimal (¼ h)</span>
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
                                aria-label={`Start time, row ${idx + 1}`}
                                name={`ts-start-${row.id}`}
                                className="num-input ts-input" type="text"
                                value={row.start}
                                ref={el => { startRefs.current[row.id] = el; }}
                                {...cellProps(idx, 0)}
                                onFocus={() => setActiveRowId(row.id)}
                                onChange={e => updateCalcRow(row.id, 'start', e.target.value)}
                                onBlur={e => formatTimeInput(row.id, 'start', e.target.value)} />
                            </div>
                            <div>
                              <span className="pw-preset-lbl-hide">End</span>
                              <input 
                                id={`ts-end-${row.id}`}
                                aria-label={`End time, row ${idx + 1}`}
                                name={`ts-end-${row.id}`}
                                className="num-input ts-input" type="text"
                                value={row.end}
                                {...cellProps(idx, 1)}
                                onFocus={() => setActiveRowId(row.id)}
                                onChange={e => updateCalcRow(row.id, 'end', e.target.value)}
                                onBlur={e => formatTimeInput(row.id, 'end', e.target.value)} />
                            </div>
                            <div>
                              <span className="pw-preset-lbl-hide">Lunch</span>
                              <input 
                                id={`ts-lunch-${row.id}`}
                                aria-label={`Lunch duration, row ${idx + 1}`}
                                name={`ts-lunch-${row.id}`}
                                placeholder=".30" title="Minutes as .30, hours as 1:00"
                                className="num-input ts-input" type="text"
                                value={row.lunch}
                                {...cellProps(idx, 2, e => handleLunchTab(e, idx))}
                                onFocus={() => setActiveRowId(row.id)}
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
                              <button className="num-btn ts-remove ctl-ghost ctl-sm ctl-icon ctl-danger"
                                aria-label={`Remove row ${idx + 1}`}
                                onClick={() => removeCalcRow(row.id)}><Icon name="close" /></button>
                            </div>
                        </div>
                      );
                    })}
                  </Stack>

                  <div className="ts-divider" aria-hidden="true" />

                  {/* Controls */}
                  <Stack gap={4}>
                    <div className="preset-group">
                      <span className="ctrl-sublbl">Lunch presets</span>
                      <div className="ctrl-btns preset-options">
                        {LUNCH_PRESETS.map(([label, val]) => (
                          <button key={val} className="pill-btn"
                            onClick={() => applyLunchPreset(val)}>{label}</button>
                        ))}
                      </div>
                    </div>

                    {needRow && <span role="status" className="input-error">Click a row first, then choose a lunch length.</span>}

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
          <div className="result-sticky">
            <div className="result-card">
              <div className="result-card-primary">
              <span className="result-card-title">Total Hours</span>
              <span className="result-card-value">
                {fmtHHMM(calcTotalMins)}<span className="result-card-unit">h</span>
              </span>
              
              </div>
              {incomplete && <span role="status" className="input-error">Incomplete total — check the entries.</span>}
              <div className="result-card-footer">
                <div className="result-card-footer-item">
                  <span className="result-card-footer-lbl">Decimal time</span>
                  <span className="result-card-footer-val">{fmtDecimal(calcTotalMins)}</span>
                </div>
                <p className="result-card-note">Decimal time is rounded to the nearest quarter hour.</p>
                
                <div className="ts-copy-wrap">
                  <button
                    type="button"
                    className={"ts-copy result-card-print" + (copied ? " ts-copy--done" : "") + (copyError ? " ts-copy--error" : "")}
                    onClick={handleCopy}
                    title="Copies the decimal total, rounded to the nearest quarter hour"
                    disabled={!hasCalcTotal}
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

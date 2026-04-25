/**
 * Timesheet.jsx
 *
 * HANDOFF NOTES FOR CLAUDE CODE
 * ─────────────────────────────
 * This component was prototyped as a vanilla HTML/JS artifact and is ready
 * to be converted into a proper React component for the NEMETONA app.
 *
 * TASKS FOR CLAUDE CODE:
 *  1. Convert all vanilla JS state (calcRowCount, window._calcTotal, etc.)
 *     into React useState / useRef hooks.
 *  2. Replace imperative DOM manipulation (getElementById, innerHTML, etc.)
 *     with declarative JSX rendering driven by state arrays.
 *  3. Remap CSS custom properties (var(--color-background-primary) etc.) to
 *     whatever system this project already uses (CSS modules, Tailwind, etc.).
 *     Read the existing component files and global CSS first to match conventions.
 *  4. Inline <style> block should move to the project's stylesheet convention.
 *  5. The sticky total bar uses `position: fixed` — check if the app layout
 *     needs this scoped differently (e.g. position: sticky inside a scroll container).
 *  6. Keep all parsing logic (parseTime, parseLunch, parseSumTime) as pure
 *     utility functions, ideally extracted to src/utils/timesheet.js so they
 *     can be unit tested independently.
 *  7. The keyboard shortcut (Tab from Lunch → next row Start, auto-add row)
 *     should use onKeyDown on the lunch input with useRef for focus management.
 *
 * SUGGESTED FILE LOCATIONS:
 *  - src/components/Timesheet.jsx   ← main component
 *  - src/utils/timesheet.js         ← pure parsing + formatting helpers
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORIGINAL VANILLA IMPLEMENTATION BELOW — use as the source of truth for
 * all logic, UX behaviour, and feature completeness.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── FEATURES ────────────────────────────────────────────────────────────────
//
//  CALCULATE HOURS TAB
//  • Rows: Start time | End time | Lunch | Duration (H:MM) | Decimal | Remove
//  • Flexible time input: "9", "9:30", "930", "0930" all parse correctly
//  • Lunch input: ".30" → 30 min, "0:30" → 30 min, "30" → 30 min
//  • Lunch presets: 15 / 20 / 30 / 45 min / 1h pills — apply to last focused row
//  • Rounding selector: none, 5, 6, 7, 10, 15, 30, 60 min
//  • Decimal column: rounds to nearest quarter (.00 / .25 / .50 / .75)
//  • Negative lunch guard: shows "lunch > work" warning instead of silent 0
//  • Active row highlight: darker background on the row currently being edited
//  • Keyboard shortcut: Tab from Lunch jumps to next row's Start; auto-adds row
//    if on the last one
//
//  STICKY TOTAL BAR (fixed to viewport bottom)
//  • Shows H:MM total + decimal equivalent
//  • "Copy decimal" button — copies to clipboard, flashes "Copied!" confirmation
//  • Hidden when no valid rows exist
//
//  SUM HOURS TAB
//  • Accepts H:MM inputs, sums them into a total
//
// ─────────────────────────────────────────────────────────────────────────────

const TIMESHEET_HTML = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .wrap { padding: 1rem 0 120px; }
  .tabs { display: flex; margin-bottom: 1rem; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); overflow: hidden; width: fit-content; }
  .tab { padding: 7px 18px; font-size: 13px; cursor: pointer; background: none; border: none; color: var(--color-text-secondary); }
  .tab.active { background: var(--color-background-secondary); color: var(--color-text-primary); font-weight: 500; }
  .panel { display: none; }
  .panel.active { display: block; }
  .section { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1.25rem; }
  .grid-header { display: grid; grid-template-columns: 1fr 1fr 72px 90px 70px 36px; gap: 8px; margin-bottom: 6px; }
  .grid-row { display: grid; grid-template-columns: 1fr 1fr 72px 90px 70px 36px; gap: 8px; margin-bottom: 4px; align-items: center; border-radius: var(--border-radius-md); padding: 3px 4px; transition: background 0.1s; }
  .grid-row.row-active { background: var(--color-background-secondary); }
  .col-label { font-size: 12px; color: var(--color-text-secondary); padding: 0 4px; }
  input[type="text"] { width: 100%; font-size: 14px; background: transparent; }
  .duration { font-size: 14px; font-weight: 500; color: var(--color-text-primary); padding: 0 4px; min-height: 36px; display: flex; align-items: center; }
  .decimal { font-size: 14px; font-weight: 500; color: var(--color-text-secondary); padding: 0 4px; min-height: 36px; display: flex; align-items: center; }
  .duration.error { color: var(--color-text-danger); font-weight: 400; font-size: 12px; }
  .duration.warn { color: var(--color-text-warning); font-weight: 400; font-size: 12px; }
  .remove-btn { background: none; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); width: 36px; height: 36px; cursor: pointer; color: var(--color-text-secondary); font-size: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .remove-btn:hover { background: var(--color-background-danger); color: var(--color-text-danger); border-color: var(--color-border-danger); }
  .controls { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  select { font-size: 13px; }
  .rounding-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-secondary); margin-left: auto; }
  .lunch-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .pill { font-size: 12px; padding: 3px 9px; border: 0.5px solid var(--color-border-tertiary); border-radius: 99px; cursor: pointer; background: none; color: var(--color-text-secondary); }
  .pill:hover { background: var(--color-background-secondary); color: var(--color-text-primary); }
  .pill-label { font-size: 12px; color: var(--color-text-tertiary); align-self: center; }
  .sticky-total { position: fixed; bottom: 0; left: 0; right: 0; background: var(--color-background-primary); border-top: 0.5px solid var(--color-border-tertiary); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; z-index: 10; }
  .sticky-total .total-label { font-size: 13px; color: var(--color-text-secondary); }
  .sticky-totals-right { display: flex; align-items: baseline; gap: 12px; }
  .sticky-total .total-value { font-size: 22px; font-weight: 500; color: var(--color-text-primary); }
  .sticky-total .total-decimal { font-size: 17px; color: var(--color-text-secondary); }
  .copy-btn { font-size: 12px; padding: 5px 12px; border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); cursor: pointer; background: none; color: var(--color-text-secondary); white-space: nowrap; }
  .copy-btn:hover { background: var(--color-background-secondary); }
  .copy-btn.copied { color: var(--color-text-success); border-color: var(--color-border-success); }
  .sum-row { display: grid; grid-template-columns: 1fr 36px; gap: 8px; margin-bottom: 6px; align-items: center; }
</style>
</head>
<body>
<div class="wrap">
  <div class="tabs">
    <button class="tab active" onclick="switchTab('calc')">Calculate hours</button>
    <button class="tab" onclick="switchTab('sum')">Sum hours</button>
  </div>

  <div id="panel-calc" class="panel active">
    <div class="section">
      <div class="grid-header">
        <span class="col-label">Start time</span>
        <span class="col-label">End time</span>
        <span class="col-label">Lunch</span>
        <span class="col-label">Duration</span>
        <span class="col-label">Decimal</span>
        <span></span>
      </div>
      <div id="calc-rows"></div>
      <div class="lunch-pills">
        <span class="pill-label">Lunch:</span>
        <button class="pill" onclick="applyLunchPreset('.15')">15 min</button>
        <button class="pill" onclick="applyLunchPreset('.20')">20 min</button>
        <button class="pill" onclick="applyLunchPreset('.30')">30 min</button>
        <button class="pill" onclick="applyLunchPreset('.45')">45 min</button>
        <button class="pill" onclick="applyLunchPreset('1:00')">1 h</button>
      </div>
      <div class="controls">
        <button onclick="addCalcRow()">+ Add row</button>
        <button onclick="clearCalc()" style="color: var(--color-text-secondary);">Clear all</button>
        <div class="rounding-row">
          <span>Round:</span>
          <select id="rounding" onchange="updateDurations()">
            <option value="0">No rounding</option>
            <option value="5">Nearest 5 min</option>
            <option value="6">Nearest 6 min</option>
            <option value="7">Nearest 7 min</option>
            <option value="10">Nearest 10 min</option>
            <option value="15">Nearest 15 min</option>
            <option value="30">Nearest 30 min</option>
            <option value="60">Nearest 60 min</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <div id="panel-sum" class="panel">
    <div class="section">
      <div id="sum-rows"></div>
      <div class="controls">
        <button onclick="addSumRow()">+ Add row</button>
        <button onclick="clearSum()" style="color: var(--color-text-secondary);">Clear all</button>
      </div>
    </div>
  </div>
</div>

<div class="sticky-total">
  <span class="total-label">Total</span>
  <div class="sticky-totals-right">
    <span class="total-value" id="calc-total">—</span>
    <span class="total-decimal" id="calc-total-dec"></span>
    <button class="copy-btn" id="copy-btn" onclick="copyTotal()" style="display:none">Copy decimal</button>
  </div>
</div>

<script>
let calcRowCount = 0;
let sumRowCount = 0;
let activeTab = 'calc';
let lastFocusedLunchId = null;

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['calc','sum'][i] === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
  updateStickyTotal();
}

function setActiveRow(id) {
  document.querySelectorAll('#calc-rows .grid-row').forEach(r => r.classList.remove('row-active'));
  if (id !== null) {
    const row = document.getElementById('calc-row-' + id);
    if (row) row.classList.add('row-active');
  }
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────
// Extract these to src/utils/timesheet.js in the React version.

function parseTime(raw) {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim().replace(',', '.');
  let m;
  if ((m = s.match(/^(\d{1,2})[:\.](\d{2})$/))) return +m[1] * 60 + +m[2];
  if (/^\d{3}$/.test(s)) return +s[0] * 60 + +s.slice(1);
  if (/^\d{4}$/.test(s)) return +s.slice(0,2) * 60 + +s.slice(2);
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}

function parseLunch(raw) {
  // ".30" → 30 min (dot-prefix = minutes literal)
  if (!raw || !raw.trim()) return 0;
  let s = raw.trim();
  let m;
  if ((m = s.match(/^\.(\d+)$/))) return +m[1];
  s = s.replace(',', '.');
  if ((m = s.match(/^(\d{1,2})[:\.](\d{2})$/))) return +m[1] * 60 + +m[2];
  if (/^\d{3}$/.test(s)) return +s[0] * 60 + +s.slice(1);
  if (/^\d{4}$/.test(s)) return +s.slice(0,2) * 60 + +s.slice(2);
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}

function parseSumTime(raw) {
  if (!raw || !raw.trim()) return null;
  const m = raw.trim().match(/^(\d+)[:\.](\d{2})$/);
  return m ? +m[1] * 60 + +m[2] : null;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────

function roundMins(mins, to) { return to ? Math.round(mins / to) * to : mins; }
function fmtHHMM(mins) { return Math.floor(mins/60) + ':' + String(mins%60).padStart(2,'0'); }
// Rounds to nearest quarter hour: .00 / .25 / .50 / .75
function fmtDecimal(mins) { return (Math.round((mins/60)*4)/4).toFixed(2); }

// ─── LUNCH PRESETS ───────────────────────────────────────────────────────────

function applyLunchPreset(val) {
  if (lastFocusedLunchId !== null) {
    const el = document.getElementById('lunch-' + lastFocusedLunchId);
    if (el) { el.value = val; updateDurations(); return; }
  }
  const all = document.querySelectorAll('[id^="lunch-"]');
  if (all.length) { all[all.length-1].value = val; updateDurations(); }
}

// ─── ROW MANAGEMENT ──────────────────────────────────────────────────────────

function addCalcRow() {
  const id = ++calcRowCount;
  const container = document.getElementById('calc-rows');
  const div = document.createElement('div');
  div.className = 'grid-row';
  div.id = 'calc-row-' + id;
  div.innerHTML = \`
    <input type="text" id="start-\${id}" placeholder="9, 9:30, 0930"
      oninput="updateDurations()"
      onfocus="setActiveRow(\${id}); lastFocusedLunchId=null"
      onkeydown="handleKey(event,\${id},'start')" />
    <input type="text" id="end-\${id}" placeholder="17, 17:30, 1730"
      oninput="updateDurations()"
      onfocus="setActiveRow(\${id}); lastFocusedLunchId=null"
      onkeydown="handleKey(event,\${id},'end')" />
    <input type="text" id="lunch-\${id}" placeholder=".30, 0:30"
      oninput="updateDurations()"
      onfocus="setActiveRow(\${id}); lastFocusedLunchId=\${id}"
      onkeydown="handleKey(event,\${id},'lunch')" />
    <div class="duration" id="dur-\${id}"></div>
    <div class="decimal" id="dec-\${id}"></div>
    <button class="remove-btn" tabindex="-1" onclick="removeCalcRow(\${id})">×</button>
  \`;
  container.appendChild(div);
}

// Tab from Lunch → next Start; auto-add row if on last
function handleKey(e, id, field) {
  if (e.key !== 'Tab' || e.shiftKey) return;
  if (field === 'lunch') {
    e.preventDefault();
    const nextStart = document.getElementById('start-' + (id + 1));
    if (nextStart) nextStart.focus();
    else { addCalcRow(); setTimeout(() => document.getElementById('start-' + (id+1))?.focus(), 0); }
  }
}

function removeCalcRow(id) {
  const el = document.getElementById('calc-row-' + id);
  if (el) el.remove();
  updateDurations();
}

// ─── CALCULATION ─────────────────────────────────────────────────────────────

function updateDurations() {
  const rounding = parseInt(document.getElementById('rounding').value);
  let totalMins = 0;
  let hasAny = false;

  document.querySelectorAll('#calc-rows .grid-row').forEach(row => {
    const id = row.id.replace('calc-row-', '');
    const startEl = document.getElementById('start-' + id);
    const endEl   = document.getElementById('end-'   + id);
    const lunchEl = document.getElementById('lunch-' + id);
    const durEl   = document.getElementById('dur-'   + id);
    const decEl   = document.getElementById('dec-'   + id);
    if (!startEl || !endEl || !durEl) return;

    const s     = parseTime(startEl.value);
    const e     = parseTime(endEl.value);
    const lunch = parseLunch(lunchEl.value);
    durEl.className = 'duration';
    durEl.textContent = '';
    decEl.textContent = '';

    if (s !== null && e !== null) {
      if (lunch === null) {
        durEl.className = 'duration error';
        durEl.textContent = 'invalid lunch';
        return;
      }
      const rs = roundMins(s, rounding);
      const re = roundMins(e, rounding);
      let diff = re - rs;
      if (diff < 0) diff += 24 * 60;          // overnight support
      if (lunch > diff) {
        durEl.className = 'duration warn';
        durEl.textContent = 'lunch > work';    // negative lunch guard
        return;
      }
      diff -= lunch;
      durEl.textContent = fmtHHMM(diff);
      decEl.textContent = fmtDecimal(diff);
      totalMins += diff;
      hasAny = true;
    } else if (startEl.value.trim() || endEl.value.trim()) {
      const badStart = startEl.value.trim() && parseTime(startEl.value) === null;
      const badEnd   = endEl.value.trim()   && parseTime(endEl.value)   === null;
      if (badStart || badEnd) {
        durEl.className = 'duration error';
        durEl.textContent = 'invalid';
      }
    }
  });

  window._calcTotal = hasAny ? totalMins : null;
  updateStickyTotal();
}

// ─── STICKY TOTAL ─────────────────────────────────────────────────────────────

function updateStickyTotal() {
  const totalEl   = document.getElementById('calc-total');
  const totalDecEl = document.getElementById('calc-total-dec');
  const copyBtn   = document.getElementById('copy-btn');
  if (activeTab === 'calc') {
    if (window._calcTotal != null) {
      totalEl.textContent    = fmtHHMM(window._calcTotal);
      totalDecEl.textContent = '= ' + fmtDecimal(window._calcTotal);
      copyBtn.style.display  = '';
    } else {
      totalEl.textContent    = '—';
      totalDecEl.textContent = '';
      copyBtn.style.display  = 'none';
    }
  } else {
    totalEl.textContent    = window._sumTotal != null ? fmtHHMM(window._sumTotal) : '—';
    totalDecEl.textContent = '';
    copyBtn.style.display  = 'none';
  }
}

function copyTotal() {
  const val = window._calcTotal != null ? fmtDecimal(window._calcTotal) : null;
  if (!val) return;
  navigator.clipboard.writeText(val).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy decimal'; btn.classList.remove('copied'); }, 1800);
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function clearCalc() {
  document.getElementById('calc-rows').innerHTML = '';
  calcRowCount = 0;
  window._calcTotal = null;
  for (let i = 0; i < 3; i++) addCalcRow();
  updateStickyTotal();
}

function addSumRow() {
  const id = ++sumRowCount;
  const container = document.getElementById('sum-rows');
  const div = document.createElement('div');
  div.className = 'sum-row';
  div.id = 'sum-row-' + id;
  div.innerHTML = \`
    <input type="text" id="sum-\${id}" placeholder="e.g. 6:35, 8:15" oninput="updateSumTotal()" />
    <button class="remove-btn" tabindex="-1" onclick="removeSumRow(\${id})">×</button>
  \`;
  container.appendChild(div);
}

function removeSumRow(id) {
  const el = document.getElementById('sum-row-' + id);
  if (el) el.remove();
  updateSumTotal();
}

function updateSumTotal() {
  let totalMins = 0, hasAny = false;
  document.querySelectorAll('#sum-rows .sum-row').forEach(row => {
    const id = row.id.replace('sum-row-', '');
    const el = document.getElementById('sum-' + id);
    if (!el) return;
    const v = parseSumTime(el.value);
    if (v !== null) { totalMins += v; hasAny = true; }
  });
  window._sumTotal = hasAny ? totalMins : null;
  updateStickyTotal();
}

function clearSum() {
  document.getElementById('sum-rows').innerHTML = '';
  sumRowCount = 0;
  window._sumTotal = null;
  for (let i = 0; i < 5; i++) addSumRow();
  updateStickyTotal();
}

window._calcTotal = null;
window._sumTotal  = null;
clearCalc();
clearSum();
document.getElementById('copy-btn').style.display = 'none';
<\/script>
</body>
</html>
`;

// Export placeholder — Claude Code will replace this with a real React component
export default function Timesheet() {
  return <div dangerouslySetInnerHTML={{ __html: TIMESHEET_HTML }} />;
}

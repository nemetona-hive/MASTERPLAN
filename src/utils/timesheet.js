// ── Timesheet utilities ───────────────────────────────────────────────────────
// Pure parse/format helpers — no DOM, no React. Safe to unit-test independently.

// The clock-shaped forms a time can be typed in, most specific first. Each
// captures hours then minutes; "830" and "0830" differ only in how the digits
// split, so the pattern carries that rather than a slice() per branch.
const HHMM_FORMS = [
  /^(\d{1,2})[:.](\d{2})$/,  // 8:30, 8.30 (a comma is normalised to a dot first)
  /^(\d)(\d{2})$/,           // 830
  /^(\d{2})(\d{2})$/         // 0830
];

// Shared body of parseTime and parseLunch. Takes an already-trimmed,
// comma-normalised string and returns minutes, or null if it reads as nothing.
// A minute field of 60 or more is rejected rather than rolled over: accepting
// 8:70 as 9:10 turns a typo into a plausible working day.
function parseHHMM(s) {
  for (const form of HHMM_FORMS) {
    const m = s.match(form);
    if (m) {
      const mm = +m[2];
      return mm >= 60 ? null : +m[1] * 60 + mm;
    }
  }
  if (/^\d{1,2}$/.test(s)) return +s * 60;  // bare hours
  return null;
}

// Blank is absent, not midnight — a day with no start time is not a day that
// started at 00:00.
export function parseTime(raw) {
  if (!raw || !raw.trim()) return null;
  const minutes = parseHHMM(raw.trim().replace(',', '.'));
  return minutes !== null && minutes < 24 * 60 ? minutes : null;
}

export function parseLunch(raw) {
  // Blank is a day without a break, so 0 rather than parseTime's null.
  if (!raw || !raw.trim()) return 0;
  const s = raw.trim();
  // The one rule that differs from parseTime: a lunch break is normally spoken
  // in minutes, so ".30" is half an hour, not half past midnight. Checked
  // before the comma is normalised so ",30" stays unparseable.
  const dotPrefix = s.match(/^\.(\d+)$/);
  if (dotPrefix) return +dotPrefix[1];
  return parseHHMM(s.replace(',', '.'));
}

// Formats as H:MM (e.g. 8:05 not 8:5)
export function fmtHHMM(mins) { return Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0'); }
// Rounds to nearest quarter hour: .00 / .25 / .50 / .75
export function fmtDecimal(mins) { return (Math.round((mins / 60) * 4) / 4).toFixed(2); }

/**
 * One row of the sheet: its worked time, as H:MM and as quarter-hour decimal,
 * and a status the page colours by — "empty" (nothing typed), "partial" (one
 * of start and end), "ok", "warn" (a figure that reads as a mistake: equal
 * times, a break longer than the day) or "error" (a field that is not a time).
 * `mins` is what the total adds, and is 0 for anything but "ok".
 */
export function rowResult(row) {
  const s     = parseTime(row.start);
  const e     = parseTime(row.end);
  const lunch = parseLunch(row.lunch);
  const hasInput = row.start.trim() || row.end.trim() || row.lunch.trim();

  if (!hasInput) return { dur: '', dec: '', status: 'empty', mins: 0 };

  if (s !== null && e !== null) {
    if (lunch === null) return { dur: 'invalid lunch', dec: '', status: 'error', mins: 0 };
    let diff = e - s;
    // Equal times are ambiguous (no time, or a full day), so neither is assumed.
    if (diff === 0) return { dur: 'start = end', dec: '', status: 'warn', mins: 0 };
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

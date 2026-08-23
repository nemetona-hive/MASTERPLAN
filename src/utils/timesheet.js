// ── Timesheet utilities ───────────────────────────────────────────────────────
// Pure parse/format helpers — no DOM, no React. Safe to unit-test independently.

export function parseTime(raw) {
  if (!raw || !raw.trim()) return null;
  let s = raw.trim().replace(',', '.');
  let m;
  if ((m = s.match(/^(\d{1,2})[:\.](\d{2})$/))) {
    const h = +m[1], mm = +m[2];
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{3}$/.test(s)) {
    const h = +s[0], mm = +s.slice(1);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{4}$/.test(s)) {
    const h = +s.slice(0, 2), mm = +s.slice(2);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}

export function parseLunch(raw) {
  // ".30" → 30 min (dot-prefix = minutes literal)
  if (!raw || !raw.trim()) return 0;
  let s = raw.trim();
  let m;
  if ((m = s.match(/^\.(\d+)$/))) return +m[1];
  s = s.replace(',', '.');
  if ((m = s.match(/^(\d{1,2})[:\.](\d{2})$/))) {
    const h = +m[1], mm = +m[2];
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{3}$/.test(s)) {
    const h = +s[0], mm = +s.slice(1);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{4}$/.test(s)) {
    const h = +s.slice(0, 2), mm = +s.slice(2);
    if (mm >= 60) return null;
    return h * 60 + mm;
  }
  if (/^\d{1,2}$/.test(s)) return +s * 60;
  return null;
}

function roundMins(mins, to) { return to ? Math.round(mins / to) * to : mins; }
// Formats as H:MM (e.g. 8:05 not 8:5)
export function fmtHHMM(mins) { return Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0'); }
// Rounds to nearest quarter hour: .00 / .25 / .50 / .75
export function fmtDecimal(mins) { return (Math.round((mins / 60) * 4) / 4).toFixed(2); }

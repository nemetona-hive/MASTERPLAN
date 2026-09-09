/**
 * Whole-value decimal parsing shared by the browser and local save boundary.
 * null = missing, NaN = invalid, finite number (including zero) = supplied.
 * Commas are decimal separators, never thousands separators. Units and exponent
 * notation are rejected rather than silently truncated by parseFloat.
 * @param {unknown} value
 * @returns {number|null}
 */
function parseMeasurement(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const text = value.trim();
  if (!text) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return NaN;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}
module.exports = { parseMeasurement };

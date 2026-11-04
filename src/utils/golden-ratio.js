import { parseMeasurement } from "./measurements.cjs";

/*
 * The golden ratio series, described once: the page reads every figure from
 * here, as the other calculators read theirs from their own models.
 *
 * A base is divided by φ seven times. Each step is the one before it over φ,
 * the first being the base over φ. A base under 1 mm has no series worth
 * marking out, so it is refused rather than drawn.
 */

export const PHI = (1 + Math.sqrt(5)) / 2;
export const STEPS = 7;
export const MIN_BASE = 1;

export function buildSeries(value) {
  const n = parseMeasurement(value);
  const given = n !== null;
  const valid = Number.isFinite(n) && n >= MIN_BASE;
  const steps = [];
  if (valid) {
    let step = n;
    for (let i = 1; i <= STEPS; i++) {
      step /= PHI;
      steps.push({ step: i, value: step });
    }
  }
  /* `refused`: something was entered and it is not a base the page can use,
     so the page says why instead of quietly showing nothing. */
  return { base: valid ? n : null, valid, refused: given && !valid, steps };
}

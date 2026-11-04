import { parseMeasurement } from "./measurements.cjs";

/*
 * What a pipe wrap needs, described once: the page and its diagram read every
 * figure from here, as Concrete and Gypsum read theirs from their take-offs.
 *
 * The wrap goes round the OUTER surface — the pipe plus the material's own
 * thickness on both sides — so the length is π × (pipe Ø + 2 × thickness),
 * plus the overlap, less the gap. Missing the thickness is a wrap that comes
 * up short by 2·π·t, which is the mistake this page exists to stop.
 *
 * EVERYTHING NUMERIC IS A NUMBER. The page formats on the way to the screen.
 */

/* The same strict parser as the other pages: blank, malformed and negative
   all read as "not entered" rather than being half-parsed. */
const measure = value => {
  const n = parseMeasurement(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const TURN = Math.PI * 2;

export function buildPipeWrap({ pipeDiam, matThick, overlap, gap }) {
  const d = measure(pipeDiam), t = measure(matThick), o = measure(overlap), g = measure(gap);
  /* Without a pipe there is nothing to wrap: an overlap alone must not read as
     a length to cut. */
  const ready = d > 0;
  const outer = d + 2 * t;
  const base = Math.PI * outer;
  const raw = base + o - g;

  /* The gap and the overlap as angles round the outer ring, for the diagram.
     Each is its share of the circumference, and together they never go past
     one turn: an overlap longer than the whole wrap is drawn as the full ring,
     not wound round it a second time out of sight. */
  const share = length => (base > 0 ? Math.min(TURN, (length / base) * TURN) : 0);
  const gapAngle = share(g);
  const overlapAngle = Math.min(TURN - gapAngle, share(o));

  return {
    ready,
    pipe: d, thickness: t, overlap: o, gap: g,
    outer: ready ? outer : 0,
    base: ready ? base : 0,
    total: ready ? Math.max(0, raw) : 0,
    gapTooLong: ready && raw < 0,
    angles: { gap: ready ? gapAngle : 0, overlap: ready ? overlapAngle : 0 }
  };
}

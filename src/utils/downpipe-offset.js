/*
 * Downpipe offset made from two elbows and a straight sloped pipe between them
 * (Ruukki "Toru põlv 70°").
 *
 *   B = L · sin(α) + C        L = (B − C) / sin(α)
 *
 * L is the straight pipe between the elbows, B the horizontal offset between
 * the two vertical pipes, C what the two elbows contribute on their own. C was
 * fitted to the manufacturer's chart and holds to about ±5 mm, so the chart
 * range is the range the answer is trusted over.
 */

export const DEFAULT_ANGLE = 70;
export const DEFAULT_ELBOW_OFFSET = 152;
export const ANGLE_MIN = 1;
export const ANGLE_MAX = 89;
export const CHART_L_MIN = 100;
export const CHART_L_MAX = 1150;

export const MESSAGES = {
  empty: "Sisesta L või B.",
  params: `Sisesta nurk α (${ANGLE_MIN}–${ANGLE_MAX}°) ja konstant C.`,
  tooShort: "B on väiksem kui kaks põlve kokku. Seda nihet ei saa kahe 70° põlvega teha.",
  extrapolated: `Väljaspool tootja tabelit (L ${CHART_L_MIN}–${CHART_L_MAX} mm). Väärtus on ekstrapoleeritud.`
};

const sinDeg = deg => Math.sin(deg * Math.PI / 180);
const finite = v => typeof v === "number" && Number.isFinite(v);

export function offsetFromLength(L, angle = DEFAULT_ANGLE, C = DEFAULT_ELBOW_OFFSET) {
  return L * sinDeg(angle) + C;
}

export function lengthFromOffset(B, angle = DEFAULT_ANGLE, C = DEFAULT_ELBOW_OFFSET) {
  return (B - C) / sinDeg(angle);
}

/*
 * Solves for whichever field was not entered. `source` is the field the user
 * typed in last; it stays fixed and the other one is derived from it, so
 * changing α or C moves only the derived value.
 *
 * Returns { L, B, error, warning }. On an error L and B are null: a negative
 * pipe length is not a result to show.
 */
export function solveOffset({ source, value, angle, C }) {
  const none = { L: null, B: null, error: null, warning: null };
  if (!finite(angle) || angle < ANGLE_MIN || angle > ANGLE_MAX || !finite(C)) {
    return { ...none, error: MESSAGES.params };
  }
  if (!finite(value)) return { ...none, error: MESSAGES.empty };

  const L = source === "B" ? lengthFromOffset(value, angle, C) : value;
  const B = source === "B" ? value : offsetFromLength(value, angle, C);
  if (L < 0) return { ...none, error: MESSAGES.tooShort };

  const warning = L < CHART_L_MIN || L > CHART_L_MAX ? MESSAGES.extrapolated : null;
  return { L, B, error: null, warning };
}

export const roundMm = n => Math.round(n * 10) / 10;

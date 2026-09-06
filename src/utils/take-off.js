/*
 * What a concrete pour needs, described once.
 *
 * A "take-off" is the trade term: you take quantities off a drawing and turn
 * them into a list of what to buy. This is that list — the volume, the mass of
 * mix, and the order line.
 *
 * SAME RULE AS `cut-list.js`, and a second document is what makes the rule
 * worth having rather than a claim: one model, many renderers, and a new
 * derivation goes in the model, never in a renderer.
 *
 * This one goes further than the cut list did, deliberately. It takes the RAW
 * FIELDS and does the arithmetic, and `Concrete.jsx` reads its own on-screen
 * figures back out of it. The alternative — the page computing for the screen
 * and this reshaping the results for paper — leaves two places that can round.
 * That matters here more than anywhere else in the app:
 *
 *   `bagsExact` is 12.4 and `bagsToBuy` is 13.
 *
 * Both are real answers to different questions, and a screen showing one while
 * a printout showed the other is exactly the failure the rule exists to
 * prevent — with the answer being how much concrete somebody buys.
 *
 * EVERYTHING NUMERIC IS A NUMBER. The sheet formats on the way to the page.
 */

/*
 * A field is a string from an input, and blank is not zero.
 *
 * `toNumber` in shared.jsx already coerces; this is not a second copy of it,
 * because the question here is different — the model has to tell "the user has
 * not filled this in" apart from "the user typed 0", and a coercion that
 * answers 0 for both cannot. `ready` below depends on the distinction.
 */
const num = value => {
  if (value === "" || value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const given = value => value !== "" && value !== null && value !== undefined;

/* Rounded where a figure is read rather than carried. Volume keeps three
   decimals because a cubic metre is a big unit and the third decimal is a
   litre; mass and money keep two. Done here so every renderer prints the same
   number rather than each rounding its own way. */
const round = (value, places) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

/**
 * Builds the take-off from the page's raw fields.
 *
 * Returns a model even when the fields are half-filled — `ready` says whether
 * there is enough to print. The page renders from it either way, so a partially
 * filled form still shows the figures it can.
 */
export function buildTakeOff(fields) {
  const {
    areaMode, areaManual, lenMm, widMm,
    thickMode, avgH, ca, cb, cc, cd,
    rate, bagKg, bagPrice, product
  } = fields;

  /* Area, from a figure or from dimensions. `fromDims` is kept whichever mode
     is on, because the page shows it as a running total while somebody types
     the two dimensions — a number you can watch is what makes the mode worth
     having. */
  const fromDims = (num(lenMm) * num(widMm)) / 1_000_000;
  const area = areaMode === "dims" ? fromDims : num(areaManual);

  /* Thickness, averaged or from four corners. The DIFFERENCE is the reason the
     corner mode exists and is carried separately: a slab averaging 100mm across
     corners of 80/80/120/120 is a very different pour from a flat 100mm one,
     and the average alone cannot say so. */
  const corners = [ca, cb, cc, cd].map(num);
  const average = thickMode === "avg" ? num(avgH) : corners.reduce((a, b) => a + b, 0) / 4;
  const difference = thickMode === "avg" ? null : Math.max(...corners) - Math.min(...corners);

  const volume = area * (average / 1000);
  // Consumption is stated per m² per mm, so the thickness goes in as mm here
  // rather than as the metres the volume used.
  const mass = area * average * num(rate);

  const weight = num(bagKg);
  const exact = weight > 0 ? mass / weight : 0;
  /* Ceiling, because you cannot buy 0.4 of a bag. The two figures are both
     printed: `exact` is what the pour needs and `toBuy` is what leaves the
     merchant, and the gap between them is the offcut of this page. */
  const toBuy = Math.ceil(exact);

  const price = num(bagPrice);
  const total = toBuy > 0 && price > 0 ? toBuy * price : null;

  return {
    /* Enough to be worth printing. Area and thickness alone give a volume,
       which is a real answer even with no product chosen — somebody ordering
       ready-mix wants the m³ and nothing else on this page. */
    ready: area > 0 && average > 0,

    area: {
      value: round(area, 2),
      mode: areaMode === "dims" ? "dims" : "direct",
      length: given(lenMm) ? num(lenMm) : null,
      width: given(widMm) ? num(widMm) : null,
      fromDims: round(fromDims, 2)
    },
    thickness: {
      average: round(average, 1),
      mode: thickMode === "avg" ? "avg" : "corners",
      corners: thickMode === "avg" ? null : corners,
      difference: difference === null ? null : round(difference, 1)
    },
    volume: round(volume, 3),
    mass: round(mass, 1),
    bags: {
      exact: round(exact, 2),
      toBuy,
      weight: weight || null,
      price: price || null,
      total: total === null ? null : round(total, 2)
    },
    product: {
      name: given(product) ? product : null,
      rate: given(rate) ? num(rate) : null
    }
  };
}

/*
 * Number formats the app shows and prints, written once. They were copied into
 * every page and every printed sheet, and a copy is how a screen and the paper
 * come to disagree about a decimal comma.
 */

/** A plain figure, to `places` decimals, with thousands grouped (1,250.00). */
export const nf = (value, places = 0) =>
  Number(value).toLocaleString("en-GB", { minimumFractionDigits: places, maximumFractionDigits: places });

/* Millimetres never take a thousands separator (1000, not 1,000); a fraction
   keeps the app's decimal comma (12,5), and a whole number carries no ",0". */
export const mm = (value, places = 0) =>
  Number(value).toLocaleString("et-EE", { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: places });

/** Euros in the app's own locale: always two decimals, comma separated. */
export const eur = value =>
  Number(value).toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

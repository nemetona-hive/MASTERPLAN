/* ============================================================
 * ICON CONFIGURATION
 * Edit the Font Awesome class on the right to change any icon.
 * Format: "fa-solid fa-[name]" — solid only. The brands and regular faces are
 * no longer shipped (fa-brands-400.woff2 was 115 KB to draw one icon), and
 * scripts/build-icons.js fails the build if an icon asks for them.
 * Reference: https://fontawesome.com/icons
 * ============================================================ */
const ICONS = {
  // UI Actions
  "corner-down-left": "fa-solid fa-check",                      // Confirm / Enter button
  "check": "fa-solid fa-check",                     // Commit confirmation flash
  "home": "fa-solid fa-compass-drafting",           // Home icon

  // Collapse / Expand toggles
  "chevron-down": "fa-solid fa-chevron-down",     // Section open
  "chevron-right": "fa-solid fa-chevron-right",    // Section closed
  "maximize": "fa-solid fa-expand",
  "minimize": "fa-solid fa-compress",

  // Navigation sidebar
  "panel-left-close": "fa-solid fa-kaaba",   // Toggle sidebar
  "rows-3": "fa-solid fa-table-list",       // Nav: Pattern Layouts
  "columns-2": "fa-solid fa-columns",          // Nav: Symmetric Layout
  "layer-group": "fa-solid fa-layer-group",       // Nav: Concrete
  "golden-phi": "fa-solid fa-dharmachakra",     // Nav: Golden Ratio
  "guider": "fa-solid fa-book-open",             // Nav: Guider

  // Layout system title icons
  "s0": "fa-solid fa-0",                // S0: Symmetric layout
  "s1": "fa-solid fa-1",                // S1: Straight layout
  "s2": "fa-solid fa-2",                // S2: Shifted layout
  "s3": "fa-solid fa-3",                // S3: Stepped layout
  "s4": "fa-solid fa-4",                // S4: Long-Short

  // Best layout badge
  "best-badge": "fa-solid fa-star-of-david",             // Best layout indicator

  // Timesheet
  "clock": "fa-solid fa-clock",                     // Timesheet page

  // Pipe Wrap
  "ring": "fa-solid fa-circle-notch",                       // Pipe Wrap page
  "palette": "fa-solid fa-palette",                         // Theme toggle

  // Cut list export — the browser's print dialog is the PDF writer
  "print": "fa-solid fa-file-pdf",

  // Header undo pair
  "undo": "fa-solid fa-rotate-left",
  "redo": "fa-solid fa-rotate-right",

  "plus": "fa-solid fa-plus",
  "minus": "fa-solid fa-minus",
  "close": "fa-solid fa-xmark",
  "refresh-cw": "fa-solid fa-arrows-rotate",
  // Lock / Unlock
  "lock": "fa-solid fa-lock",
  "unlock": "fa-solid fa-lock-open",
  // Dimension arrows
  "arrow-h": "fa-solid fa-arrows-left-right",
  "arrow-v": "fa-solid fa-arrows-up-down"
};

const PAL_CLASSES = {
  s1: ["color-s1"],
  s2: ["color-s1"],
  s3: ["color-s1"],
  s4l: ["color-s4l"],
  s4s: ["color-s4s"]
};

// System definitions. Only id/icon/title/subtitle are read (Controls.jsx builds
// LAYOUT_REGISTRY, getDescription resolves subtitle) — keep this shape minimal.
const SYSTEMS = [{
  id: 0,
  icon: "s0",
  title: "Symmetric layout",
  subtitle: "equal edge pieces, full pieces in center"
}, {
  id: 1,
  icon: "s1",
  title: "Straight layout",
  subtitle: "remainder carries over to next row"
}, {
  id: 2,
  icon: "s2",
  title: "Shifted layout",
  subtitle: (offset) => `offset ${offset.toFixed(2)} \xD7 panel length`
}, {
  id: 3,
  icon: "s3",
  title: "Stepped layout",
  subtitle: "offset +\u2153 per row (0 \u2192 \u2153 \u2192 \u2154 \u2192 0\u2026)"
}, {
  id: 4,
  icon: "s4",
  title: "Long-Short",
  subtitle: (s4Long) => `long ${s4Long}mm / short auto`
}];
// Text formatting utilities
// Values reach these straight from user input, so a NaN or Infinity can arrive
// here and .toFixed() would render it verbatim in the UI. Fall back to an em
// dash instead of showing "NaN" next to a millimetre unit.
const fmtFixed = (v, d) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : "\u2014";

const fmt = {
  mm: (v) => fmtFixed(v, 0),
  decimal: (v) => fmtFixed(v, 1),
  area: (v) => fmtFixed(v, 2),
  decimals: (v, d) => fmtFixed(v, d)
};

const getDescription = (id, sh) => {
  const sys = SYSTEMS.find(s => `s${s.id}` === id);
  if (!sys) return "";
  const sub = sys.subtitle;
  if (typeof sub === "function") {
    if (id === "s2") return sub(sh.offset || 0);
    if (id === "s4") return sub(sh.s4Long);
  }
  return sub || "";
};

const getSegmentClass = (seg, segPalClasses) => {
  if (seg.type === "offcut") return "color-offcut";
  if (seg.type === "cut") return "color-cut";
  if (seg.type === "edge") return "color-edge";
  return segPalClasses[seg.pid % segPalClasses.length] || "";
};

var PAGES = [{
  id: "home",
  label: "Home",
  title: "HIVE",
  desc: "",
  icon: "home",
  noNav: true
}, {
  id: "pattern-layout",
  label: "Pattern Layouts",
  title: "Pattern Layouts",
  desc: "Compare straight, shifted, stepped and long-short panel strategies. Highlights the fewest-piece option automatically.",
  icon: "rows-3"
}, {
  id: "symmetric-layout",
  label: "Symmetric Layout",
  title: "Symmetric Layout",
  desc: "Equal edge pieces with full panels in the center. Asymmetric and custom first-piece modes included.",
  icon: "columns-2"
}, {
  id: "concrete",
  label: "Concrete",
  title: "Concrete",
  desc: "Select product — calculate bags, mass and total price from area and layer thickness.",
  icon: "layer-group"
}, {
  id: "pipe-wrap",
  label: "Pipe Wrap",
  title: "Pipe Wrap Calculator",
  desc: "Material length to wrap around a pipe. Overlap and gap adjustments with live SVG diagram.",
  icon: "ring"
}, {
  id: "golden-ratio",
  label: "Golden Ratio φ",
  title: "Golden Ratio φ",
  desc: "Generate phi-based proportion sequences from any base value. Up to 4 parallel series.",
  icon: "golden-phi"
}, {
  id: "guider",
  label: "Guider",
  title: "Guider",
  desc: "Guider page. Content and data will be added later.",
  icon: "guider"
}, {
  id: "timesheet",
  label: "Timesheet",
  title: "Timesheet",
  desc: "Work hours from start, end and lunch. Multi-row, decimal output and one-tap clipboard copy.",
  icon: "clock"
}];


// Default application state — edit initial values here
const DEFAULT_SH = {
  W: 1390,
  H: 2200,
  PPi: 2500,
  PLa: 1250,
  offset: 0.5,
  direction: "H",
  rowStart: "top",
  rowStartH: "top",
  rowStartV: "top",
  patternStartH: "left",
  patternStartV: "bottom",
  minJ: 100,
  startOff: 0,
  s4Long: 2400
};

const DEFAULT_SYM = {
  roomWidth: 2500,
  panelWidth: 300,
  oneFullEdge: true,
  customFirstPieceWidth: null
};

const DEFAULT_GR = [
  { id: "a", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false },
  { id: "b", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false },
  { id: "c", value: "", suffix: "", saved: { value: "", suffix: "" }, savedCommitted: false }
];

const DEFAULT_MATERIAL_PRESETS = [
  {
    name: "OSB-3 1250×2500",
    length: 2500,
    width: 1250
  },
  {
    name: "KIPSPLAAT",
    length: 2600,
    width: 1200
  },
  {
    name: "Välisvoodrilaud UYVK 18×120",
    length: 6000,
    width: 110
  },
  {
    name: "Plaat 600×300",
    length: 600,
    width: 300
  }
];

const DEFAULT_CONCRETE_PRESETS = [
  {
    name: "weber S-100",
    rate: 2,
    bagKg: 25,
    bagPrice: 4
  },
  {
    name: "weberfloor 200 RAPID",
    rate: 1.7,
    bagKg: 20,
    bagPrice: 15
  },
  {
    name: "mira x-plan",
    rate: 1.7,
    bagKg: 25,
    bagPrice: 20
  },
  {
    name: "sakret BE",
    rate: 2.2,
    bagKg: 25,
    bagPrice: 3.6
  }
];

const canSaveStaticDefaults = () =>
  typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");

async function saveStaticDefaults(key, value) {
  const res = await fetch("/api/save-defaults", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value })
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

const SUMMARY_LABELS = {
  s0: {
    fullPanels: "Number of full panels",
    edgeWidth: "Edge piece width",
    cutEdge: "Cut edge panels",
    totalToBuy: "TOTAL panels to buy",
    layoutLength: "Total layout length",
    roomGap: "Gap from room"
  },
  s1s2s3: {
    full: "Full panels",
    cut: "Cut panels",
    remainder: "Remainder from prev",
    total: "Material pieces (full length)",
    placed: "Total panels placed",
    gaps: "Uncovered gaps",
    gapWidth: "Gap width total",
    status: "Status",
    statusInvalid: "Uncovered gaps \u2014 increase min remainder or adjust panel size."
  },
  s4: {
    full: "Full panels",
    cut: "Cut panels",
    stock: "Material pieces (full length)"
  }
};

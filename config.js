const PAL_CLASSES = {
  s1: ["color-s1"],
  s2: ["color-s1"],
  s3: ["color-s1"],
  s4l: ["color-s4l"],
  s4s: ["color-s4s"]
};

// System definitions with colors and labels
const SYSTEMS = [{
  id: 0,
  label: "S0",
  color: "#c4b48a",
  icon: "s0",
  title: "Symmetric layout",
  subtitle: "equal edge pieces, full pieces in center"
}, {
  id: 1,
  label: "S1",
  color: "#3d7a9e",
  icon: "s1",
  title: "Straight layout",
  subtitle: "remainder carries over to next row"
}, {
  id: 2,
  label: "S2",
  color: "#73808d",
  icon: "s2",
  title: "Shifted layout",
  subtitle: (offset) => `offset ${offset.toFixed(2)} \xD7 panel length`
}, {
  id: 3,
  label: "S3",
  color: "#c4b48a",
  icon: "s3",
  title: "Stepped layout",
  subtitle: "offset +\u2153 per row (0 \u2192 \u2153 \u2192 \u2154 \u2192 0\u2026)"
}, {
  id: 4,
  label: "S4",
  color: "#3d7a9e",
  icon: "s4",
  title: "Long-Short",
  subtitle: (s4Long, s4Short) => `long ${s4Long}mm / short ${s4Short}mm`
}];
// Text formatting utilities
const fmt = {
  mm: (v) => v.toFixed(0),
  decimal: (v) => v.toFixed(1),
  area: (v) => v.toFixed(2),
  decimals: (v, d) => v.toFixed(d)
};

const getDescription = (id, sh) => {
  const sys = SYSTEMS.find(s => `s${s.id}` === id);
  if (!sys) return "";
  const sub = sys.subtitle;
  if (typeof sub === "function") {
    if (id === "s2") return sub(sh.offset || 0);
    if (id === "s4") return sub(sh.s4Long, sh.s4Short);
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
  label: "HIVE",
  title: "HIVE",
  desc: "",
  icon: "layout-template",
  noNav: true
}, {
  id: "layout",
  label: "Layout",
  title: "Layout",
  desc: "Choose a layout tool from the submenu.",
  icon: "layout-template",
  isParent: true
}, {
  id: "pattern-layout",
  label: "Pattern Layouts",
  title: "Pattern Layouts",
  desc: "2D Layout Calculator",
  icon: "rows-3",
  parentId: "layout"
}, {
  id: "symmetric-layout",
  label: "Symmetric Layout",
  title: "Symmetric Layout",
  desc: "Standalone symmetric layout",
  icon: "columns-2",
  parentId: "layout"
}, {
  id: "area",
  label: "Area",
  title: "Area",
  icon: "square",
  isParent: true
}, {
  id: "concrete",
  label: "Concrete",
  title: "Concrete",
  desc: "Concrete calculator — coming soon",
  icon: "layer-group",
  isParent: true
}, {
  id: "golden-ratio",
  label: "Golden Ratio φ",
  title: "Golden Ratio φ",
  desc: "Blank tool scaffold — coming soon",
  icon: "golden-phi"
}];


// Default application state — edit initial values here
const DEFAULT_SH = {
  W:         5600,
  H:         2500,
  PPi:       2400,
  PLa:        300,
  offset:     0.5,
  direction: "H",
  rowStart:  "bottom",
  minJ:       100,
  startOff:     0,
  s4Long:    2400,
  s4Short:   1200
};

const DEFAULT_SYM = {
  roomWidth:  2500,
  panelWidth:  300
};
const SUMMARY_LABELS = {
  s0: {
    fullPanels:    "Number of full panels",
    edgeWidth:     "Edge piece width",
    cutEdge:       "Cut edge panels",
    totalToBuy:    "TOTAL panels to buy",
    layoutLength:  "Total layout length",
    roomGap:       "Gap from room"
  },
  s1s2s3: {
    full:          "Full panels",
    cut:           "Cut panels",
    remainder:     "Remainder from prev",
    total:         "Total"
  },
  s4: {
    full:          "Full panels",
    cut:           "Cut panels",
    total:         "Total",
    gaps:          "Uncovered gaps",
    gapWidth:      "Gap width total",
    status:        "Status",
    statusInvalid: "increase cut size or adjust lengths"
  }
};

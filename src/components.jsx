// Entry point — concatenated by build script in this order:
// 1.  shared.jsx                       — Icon, useProtectedRangeSlider, RangeSlider, NumInput, SLabel,
//                                         Collapsible, Section, ControlPanel, Row,
//                                         getLinkedCardTone, getLinkedCardMarker, useLinkedCardHighlight,
//                                         Stack, Text
// 2.  Visualization.jsx                — PanelRowVis, PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
// 3.  Controls.jsx                     — S2Controls, S4Controls, LAYOUT_REGISTRY
// 4.  utils/timesheet.js               — parseTime, parseLunch, parseSumTime, roundMins, fmtHHMM, fmtDecimal
// 5.  components/Timesheet.jsx         — SheetTimesheet
// 6.  components/Concrete.jsx          — SheetConcrete
// 7.  components/PipeWrapCalculator.jsx — PipeWrapCalculator
// 8.  components/Home.jsx              — SheetHome
// 9.  components/GoldenRatio.jsx       — SheetGoldenRatio
// 10. components/Guider.jsx            — SheetGuider
// 11. components/SymmetricLayout.jsx   — SheetSymmetricLayout
// 12. components/SurfaceLayout.jsx     — SheetSurfaceLayout
// 13. Nav.jsx                          — isNavPageActive, NavButton, initOpenGroups, AppNav
// 14. App.jsx                          — MainPageContent, App, ReactDOM.createRoot
//
// Note: themes.js is loaded directly in index.html (before React renders) — not part of this build.

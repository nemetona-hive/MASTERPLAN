// Entry point — concatenated by build script in this order:
// 1. shared.jsx                  — Icon, NumInput, SLabel, Section, Row
// 2. Visualization.jsx           — PanelRowVis, PanelSummary, LayoutVisualization, LayoutPanel, PreviewSection
// 3. Controls.jsx                — S2Controls, S4Controls, LAYOUT_REGISTRY
// 4. utils/timesheet.js          — parseTime, parseLunch, parseSumTime, roundMins, fmtHHMM, fmtDecimal
// 5. components/Timesheet.jsx    — SheetTimesheet
// 6. Sheets.jsx                  — SheetHome, SheetSymmetricLayout, SheetSurfaceLayout, SheetConcrete, SheetNewTool
// 7. Nav.jsx                     — isNavPageActive, NavButton, AppNav
// 8. App.jsx                     — MainPageContent, App, ReactDOM.createRoot

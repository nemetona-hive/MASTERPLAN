---
paths:
  - "src/utils/cut-list.js"
  - "src/utils/take-off.js"
  - "src/components/CutListSheet.jsx"
  - "src/components/TakeOffSheet.jsx"
  - "src/styles/99-print.css"
---

A figure is derived once, in the report model. A renderer formats it and derives
nothing, and a page reads its on-screen figures back out of the model. See
[exports](../../docs/exports.md). `@media print` is only visible to
`npm run layout`.

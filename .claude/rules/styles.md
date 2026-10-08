---
paths:
  - "src/styles/**"
---

Colour comes from a theme token, never a literal; a control picks a tier and a
step and never states a height. See [theme](../../docs/theme.md) and
[controls](../../docs/controls.md). Run `npm run audit:ui` and
`npm run theme:check`, and `npm run layout` for anything that moves a box.

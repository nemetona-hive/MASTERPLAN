---
paths:
  - "config.js"
  - "scripts/local-dev-server.js"
---

`/api/save-defaults` rewrites tracked `config.js` and there is no backup. Keep
browser checks on `npm run layout` / `npm run test:browser`, which answer it with
a no-op, and inspect `git diff config.js` after any manual **Save Defaults**.
See [deploying](../../docs/deploying.md#local-static-defaults-dev-environment-only).

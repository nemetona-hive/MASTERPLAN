---
paths:
  - "components.js"
  - "app.css"
  - "version.js"
  - "vendor/*.subset.*"
  - "githooks/**"
  - "scripts/build-*.js"
---

Never hand-edit these; `npm run build` regenerates them. They are committed
because a push is the deploy, and `githooks/pre-push` refuses a stale tree. See
[deploying](../../docs/deploying.md) and [testing](../../docs/testing.md).

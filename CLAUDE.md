@AGENTS.md

## Claude Code

- Path-scoped rules in `.claude/rules/` load when you read or edit a matching
  file (styles, printed documents, `config.js` and the dev server, committed
  build output). They point at the owning `docs/` topic; read that topic.
- Skills: `masterplan-ui-audit` for any CSS or UI change before calling it done;
  `/wrap` to close out a session (it commits, so it only runs on request).
- Personal permissions go in `.claude/settings.local.json`, which is git-ignored.

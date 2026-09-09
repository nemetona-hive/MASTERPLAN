---
name: wrap
description: Wrap up a MASTERPLAN session when the user asks to wrap up or invokes $wrap. Review session work, update durable repository guidance, verify and commit completed changes, and report remaining work without deploying.
---

# Wrap up MASTERPLAN

Adapted from VLOGBOOK's `.claude/commands/wrap.md` and MASTERPLAN's existing
`.claude/commands/wrap.md`. Creating or editing this skill is not an instruction
to execute the wrap workflow.

## Review the session

Read `git status --short`, the working diff, and the last 15 commits. Use the
conversation to identify this session's work; the log may include other sessions.
Inspect the configured upstream and report local commits ahead of it. If no
upstream exists, say so instead of assuming `origin/main`. Local tracking refs
may be stale; do not claim to have checked the remote unless you have.

Read `AGENTS.md` and `MASTERPLAN_DEVELOPER_GUIDE.md`. Decide whether a real rule,
system, decision, file-map entry, or component contract needs recording. Update
the owning topic under `docs/`; change the hub only for app-wide guidance.
Keep `AGENTS.md` and `CLAUDE.md` focused on essential constraints. Do not add a
session changelog or duplicate existing guidance.

Only update assistant memory when the user explicitly requested a memory update,
using the environment's permitted memory mechanism. Wrapping alone is not such a
request. Durable project guidance belongs in the repository.

## Verify and commit

- Inspect `_temp_masterplan/` if it exists and report whether sketches remain.
  Do not delete anything or ask to clear it; clearing it belongs to the user.
- Load the Linux Node toolchain when necessary: `source ~/.nvm/nvm.sh`.
- Run `npm run build` before `npm run verify`, so tests see the current generated
  build stamp. Resolve failures caused by this session's work. Report unrelated
  failures and any unrun checks accurately.
- Browser checks must use the read-only fixture server, never `npm run dev`.
  The development API writes defaults into tracked `config.js`. Inspect git
  status and the config diff after browser sessions; preserve intentional edits.
- Commit completed session work, including any necessary generated
  `components.js`, `app.css`, `version.js`, and font subsets. Inspect and stage
  explicit paths or hunks; do not sweep unrelated or unexplained changes into
  the commit. Honour an explicit instruction not to commit. Do not bypass hooks.
- Check status after committing. Report remaining changes honestly.
- Do not push unless the user requested it: a push deploys this app. If a push
  was authorised and performed, report the actual `npm run deploy:check` result.
- If local server code changed, explain that a running server needs restarting
  to load it. Do not restart a user's live server merely to wrap up.

## Final handoff

Give a short summary of what changed, verification actually performed, commit
and unpushed status, genuinely unfinished work, and what the user still needs
to test in the app. Mention temporary sketches if present.

Unfinished means work started but not completed. Keep optional improvements on a
separate line explicitly marked as suggestions. Do not present old results as
fresh verification or Chromium emulation as physical iOS/Android testing.
If no work is unfinished, say so plainly. The user may clear the conversation
following the handoff; do not clear or archive it yourself.

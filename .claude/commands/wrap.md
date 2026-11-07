---
description: Wrap up the session and update the developer guide if needed
allowed-tools: Bash(git log:*), Bash(git status:*)
---

Recent commits:
!`git log -15 --date=short --pretty=format:'%h %ad %s'`

Committed but not pushed — a push to this repo is the deploy:
!`git log origin/main..HEAD --pretty=format:'%h %s'`

Uncommitted work:
!`git status --short`

Let's wrap up this session.

Read the commits above against what we actually did — the log covers more than
this session, so use it to place our work, not to define it.

Then decide whether the guide is now out of date or missing something a future
session would need: a rule, a system, a decision, a file-map entry, a
primitive's props. Update it only if there is something real to record. Do not
add a changelog of what we did.

The guide is a hub plus topic files — `MASTERPLAN_DEVELOPER_GUIDE.md` holds
what is true of the whole app, and `docs/*.md` holds one system each. **Put a
change in the file that owns the system**, not in the hub; the hub grows only
when something applies everywhere. `CLAUDE.md` is shorter still and holds only
what bites — the build step, the config.js write hazard, and the token systems.
It should almost never need editing.

If something came up that a future session would get wrong without knowing it —
and that the repo does not already say — save it to memory.

Then:

- Commit anything still outstanding. GitHub Pages serves this tree exactly as
  committed, so a commit touching `src/`, the stylesheets or the classic scripts
  carries the rebuilt `components.js`, `app.css` and `version.js` with it.
- Tell me if `_temp_masterplan/` has sketches left in it, and ask before
  deleting any.
- Confirm the tree is actually in the state you are about to claim: rebuilt
  since the last edit, `npm run verify` run and passing. If you did not run
  something, say that plainly instead of implying it passed.
- Say what is still unpushed, and do not push unless I ask. If we did push, say
  what `npm run deploy:check` actually reported rather than assuming Pages has
  caught up.
- Give me a short summary: what changed, what is genuinely unfinished, and what
  I still need to test myself in the browser.

Unfinished means work we started and did not finish. It does not mean things you
noticed, would like to do, or think the app is missing — if you want to raise one
of those, raise it as its own line, named as a suggestion, after the summary. If
nothing is unfinished, say so in one line and stop there.

I will run `/clear` after that.

# Restoring MASTERPLAN on a clean WSL

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

**For Claude, in a new session.** The user has reinstalled Windows and/or WSL,
restored this folder from a backup, and asked you to follow this page. The
goal: `./run.sh` serves the app on <http://localhost:3005>, and `npm run verify`
passes. Work top to bottom, run each check, and report what you changed.

Three rules hold for the whole restore:

- **Never push, and never run a `git` command that rewrites history**
  (`reset --hard`, `rebase`, `commit --amend`, `filter-*`, `gc --prune`,
  `clean`). A push here is the deploy: GitHub Pages serves the pushed tree as
  is. Commits made since the last push exist only in the restored `.git/`.
- **Never write to the running app.** Once `run.sh` is up, port 3005 serves the
  user's real projects, and `/api/save-defaults` rewrites tracked `config.js`.
  Read-only `GET`s are fine; a `POST`, `PUT`, `PATCH` or `DELETE` with test
  values changes a real file. Browser checks belong on `npm run layout`, whose
  own server answers that endpoint with a no-op.
- **Never delete, `git clean`, or "tidy" `_personal/` or `_temp_masterplan/`.**

The folder is the backup. It carries everything except the machine around it,
and the machine is what this page rebuilds. Nothing here needs the old distro.

## What the restored folder already holds

| Present | Because |
|---|---|
| Source (`src/`, `scripts/`, `tests/`), the committed build output (`components.js`, `app.css`, `version.js`, the font and icon subsets in `vendor/`), `assets/`, `docs/`, `config.js`, `.nvmrc`, `package-lock.json`, `githooks/`, `.claude/` (commands, rules, skill) | tracked in git, and on GitHub up to the last push |
| `.git/` | the full history, including any commits not yet pushed |
| `_personal/projects/*.json` | the user's saved projects. **Gitignored, so only the folder backup has them.** |
| `_personal/projects/.trash/` | deleted projects, stamped, kept until removed by hand. Also backup-only. |
| `_temp_masterplan/` | gitignored scratch folder the user relies on. Never remove it, even when empty. |
| `node_modules/` (about 190 MB) | gitignored, but usually restored with the folder |
| `.claude/settings.local.json` | gitignored personal permissions, if it was in the backup |

**Not present, and that is expected, not a fault:** `components.js.map` is the
one gitignored build output. `npm run build` (section 4) writes it again.

Everything the server writes goes to two places: `_personal/projects/` (one
file per project, plus `.trash/`) and tracked `config.js`, which a
**Save Defaults** control rewrites. Preset saves that were never committed exist
only in the folder's `config.js`, so a modified `config.js` after a restore is
the user's data, not damage. The app makes no network calls: React, Font
Awesome and the fonts are vendored, and there is no `.env`, API key or login.
Nothing needs re-entering by hand.

If `git status` is not clean on a fresh restore, show the user before touching
anything. `config.js` is the file that can legitimately differ.

## What lives outside the folder

None of these come back with the folder. Each is rebuilt or re-entered below.

- The Ubuntu distro and its packages (git, `gh`, build tools, nvm and Node).
- Git identity in `~/.gitconfig`, and the GitHub login. Credentials go through
  `gh` (`credential.helper = !/usr/bin/gh auth git-credential`); `~/.ssh` is
  empty.
- Playwright's Chromium in `~/.cache/ms-playwright`. `npm run layout` and
  `npm run test:browser` need it, and both are inside `npm run verify`.
- The Windows side: the desktop shortcut, the `%LOCALAPPDATA%\MASTERPLAN\`
  copies of the `.vbs` and the icon, and the Edge-installed app.
- Claude Code's own config and memory in `~/.claude`.

## 1. The distro must match what the launchers assume

`launch-hidden.vbs` and `run.bat` both hardcode the distro, and the `.vbs` also
hardcodes the path, so the shortcut breaks if either differs. Check with
`wsl.exe -l -v` from PowerShell and `pwd` in WSL:

- distro name is exactly `Ubuntu` (`wsl.exe -d Ubuntu`, in both files)
- the repo is at `/home/nemetona/NEMETONA-hive/MASTERPLAN` (user `nemetona`;
  only the `.vbs` has this path, `run.bat` works it out)

If the user cannot keep the name or path, edit `launch-hidden.vbs` (and
`run.bat` for the distro name) to match, and re-copy the `.vbs` (section 6).

The old distro had `/etc/wsl.conf` with systemd on and the default user set.
Recreate it if the user lands as root:

```ini
[boot]
systemd=true

[user]
default=nemetona
```

Then `wsl --shutdown` from PowerShell and reopen. Nothing in the app needs
systemd, so skip it if the user would rather not.

**Check:** `whoami` says `nemetona`, and
`ls ~/NEMETONA-hive/MASTERPLAN/_personal/projects` lists the project files.

## 2. System packages

```bash
sudo apt update
sudo apt install -y build-essential curl git unzip gh
```

(The old distro was Ubuntu 26.04 with git 2.53 and gh 2.46; any current Ubuntu
is fine.)

**Check:** `git --version && gh --version` print versions.

## 3. Node, from `.nvmrc`

Node comes from nvm, not apt. `run.sh` and both git hooks look for
`$HOME/.nvm/nvm.sh`, and the hooks refuse a `node` or `npm` resolved under
`/mnt/` (a Windows install, which cannot run this Linux checkout).

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
. ~/.nvm/nvm.sh
cd ~/NEMETONA-hive/MASTERPLAN
nvm install          # reads .nvmrc -> 24.16.0
nvm alias default 24.16.0
```

**Check:** `node -v && command -v node` prints `v24.16.0` and a path under
`~/.nvm`, not `/mnt/`. `package.json` requires `node >= 24.16.0`.

## 4. Dependencies and the build

If `node_modules/` came back with the folder, try it first:

```bash
npm run build && npm test
```

If that fails (a missing module, an esbuild platform error, or the folder was
copied through Explorer and lost its symlinks and executable bits), rebuild it:

```bash
rm -rf node_modules
npm ci               # exact versions from package-lock.json; also runs `prepare`
```

`prepare` sets `core.hooksPath` to `githooks` and runs `npm run build`.

**Check:**

```bash
git config core.hooksPath      # githooks
chmod +x githooks/* run.sh     # only if they lost the executable bit
ls components.js.map           # present again
git status --short             # components.js / app.css / version.js / vendor subsets unchanged
```

A changed bundle after a clean build means the restore was from a stale
backup or the Node version differs. Report it; do not commit it unasked.

## 5. Git identity, GitHub, and the history

```bash
git config --global user.name nemetona
git config --global user.email nemetona@ananda
git config --global init.defaultBranch main
git config --global pull.rebase false
gh auth login                  # HTTPS, GitHub.com; the user completes this in the browser
gh auth setup-git              # writes the credential helper
```

The user does the login; do not ask for or handle a token.

**Check:**

```bash
git fsck --no-dangling         # no errors
git remote -v                  # https://github.com/nemetona-hive/MASTERPLAN.git
git fetch && git status -sb    # ## main...origin/main, and how far ahead
```

`git fetch` only reads. If `main` is ahead of `origin/main`, those commits
exist nowhere but this folder: tell the user, and leave pushing to them. If it
is behind, the backup is older than GitHub; tell the user before pulling
anything. If `fsck` reports errors, stop and tell the user. Do not try to
repair `.git/`.

## 6. Run it

```bash
./run.sh          # serves http://localhost:3005 and opens a window
# or, without opening one:
npm run dev
```

`run.sh` builds only when `components.js` or `app.css` is missing. The port is
fixed at 3005 in both `run.sh` and the server, and there is no restart
supervisor, so after a server change stop it (Ctrl+C) and start it again.

**Check**, read-only:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/    # 200
curl -s http://localhost:3005/api/projects | head -c 300; echo      # the saved projects
```

Then ask the user to open the app: a saved project listed on Home proves
`_personal/projects` survived. If the page is blank, `components.js` or
`app.css` is missing or stale: `npm run build`, then refresh.

**Windows shortcut.** These live outside WSL. Ask before touching them, then
either do them from WSL or give the user the steps. Details are in
[Running it](../MASTERPLAN_DEVELOPER_GUIDE.md#running-it).

1. Copy `launch-hidden.vbs` and `masterplan.ico` from the repo to
   `%LOCALAPPDATA%\MASTERPLAN\`. A `.vbs` run from the `\\wsl.localhost\` path
   trips Windows' security prompt, which is why the shortcut uses a copy. From
   WSL:

   ```bash
   LAD="$(wslpath -u "$(cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')")"
   mkdir -p "$LAD/MASTERPLAN" && cp launch-hidden.vbs masterplan.ico "$LAD/MASTERPLAN/"
   ```

   (`node scripts/make-icon.js --deploy` also copies the icon across.)
2. Make `Desktop\MASTERPLAN.lnk`: target
   `C:\Windows\System32\wscript.exe "%LOCALAPPDATA%\MASTERPLAN\launch-hidden.vbs"`,
   icon `%LOCALAPPDATA%\MASTERPLAN\masterplan.ico`.
3. Optional: with the app open in Edge, *… → Apps → Install this site as an
   app*, for the sharp taskbar icon. `run.sh` then opens the installed
   `Nemetona MASTERPLAN` window, and falls back to `msedge --app` when it is
   not installed.

If the shortcut starts nothing, run `./run.sh` in a WSL shell to see why. The
usual cause is Node missing from the non-interactive PATH (section 3).

## 7. Prove it works

```bash
npm run verify
```

That is tests, build, bundle size, style contract, theme contrast, code
analysis, UI audit, lint, then `npm run layout` and `npm run test:browser`.
Only those last two need a browser. Both serve the build from their own
throwaway server, never the live app.

Unlike MONEYFLOW and VLOGBOOK, these two do **not** skip without Chromium:
they fail, so `verify` fails at `layout`. Everything before it has already
passed by then. Install the browser once:

```bash
npx playwright install --with-deps chromium
npm run layout && npm run test:browser
```

`--with-deps` runs apt, so it asks for sudo. The restore is done when `layout`
prints `Layout checks clean` and `verify` exits 0. If any run leaves
`config.js` modified, show `git diff config.js` before doing anything else.

## 8. Claude Code itself

A new Ubuntu has no `~/.claude`. Project instructions come from `CLAUDE.md`,
`.claude/rules/`, `.claude/commands/` and `.claude/skills/` in the folder, so
they are already there. What is lost is the user's memory notes
(`~/.claude/projects/-home-nemetona-NEMETONA-hive-MASTERPLAN/memory/`) unless
they were backed up too. If the user has that folder, restore it to the same
path. If not, say so; the project docs hold every rule that matters, and the
rest were preferences the user can restate.

## Keeping the backup restorable

The user wants the folder to survive a drive failure at any time, without
preparing anything. What makes that true:

- The whole folder is the backup, **including `.git/`**. GitHub holds the
  tracked tree only up to the last push. `_personal/` (with
  `projects/.trash/`), `_temp_masterplan/` and any uncommitted preset saves in
  `config.js` are the irreplaceable parts it never holds.
- Make it with `tar` from inside WSL, not by copying in Explorer. Explorer
  drops the symlinks in `node_modules/.bin` and the executable bits on `run.sh`
  and `githooks/*`. Section 4 repairs that, but only by reinstalling.

  ```bash
  tar -czpf /mnt/c/Users/<windows-user>/MASTERPLAN-$(date +%F).tar.gz -C ~/NEMETONA-hive MASTERPLAN
  # restore into a clean WSL:
  mkdir -p ~/NEMETONA-hive && tar -xzpf /mnt/c/Users/<windows-user>/MASTERPLAN-<date>.tar.gz -C ~/NEMETONA-hive
  ```

  Stop the server first (Ctrl+C in its window), so no write lands mid-archive.
- Back up `~/.claude/projects/-home-nemetona-NEMETONA-hive-MASTERPLAN/memory/`
  alongside it if the memory notes matter.

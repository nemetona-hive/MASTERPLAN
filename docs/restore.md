# Restoring MASTERPLAN on a clean WSL

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

**For Claude, in a new session.** The user has reinstalled Windows and/or WSL,
restored this folder from a backup, and asked you to follow this page. The
goal: `./run.sh` serves the app on <http://localhost:3005>, and the gates pass.
Work top to bottom, run each check, and report what you changed. Do not push,
and do not run `git` commands that rewrite history.

The folder is the backup. It carries everything except the machine around it,
and the machine is what this page rebuilds. Nothing here needs the old distro.

## What the restored folder already holds

| Present | Because |
|---|---|
| Source, committed build output (`components.js`, `app.css`, `version.js`, fonts), `vendor/`, `docs/`, `.nvmrc`, `package-lock.json` | tracked in git |
| `_personal/projects/*.json` | the user's saved projects. **Gitignored, so only the folder backup has them.** Never delete or `git clean` it. |
| `_temp_masterplan/` | gitignored scratch folder the user relies on. Never remove it. |
| `node_modules/` (about 190 MB) | gitignored, but usually restored with the folder |
| `.claude/settings.local.json` | gitignored personal permissions, if it was in the backup |

If `git status` is not clean on a fresh restore, show the user before touching
anything: `config.js` can legitimately differ, since presets are saved into it.

## What lives outside the folder

None of these come back with the folder. Each is rebuilt or re-entered below.

- The Ubuntu distro and its packages (Node, git, `gh`, build tools).
- Git identity and GitHub login. Credentials go through `gh`
  (`credential.helper = !/usr/bin/gh auth git-credential`); `~/.ssh` is empty.
- Playwright's browsers, `~/.cache/ms-playwright` (only `npm run layout`,
  `test:browser` and `audit:ui` need them).
- The Windows side: the desktop shortcut, the `%LOCALAPPDATA%` copy of the
  `.vbs`, and the Edge-installed app.
- Claude Code's own config and memory in `~/.claude`.

## 1. The distro must match what the launchers assume

`launch-hidden.vbs` hardcodes both of these, so the shortcut breaks if either
differs. Check with `wsl.exe -l -v` from PowerShell and `pwd` in WSL:

- distro name is exactly `Ubuntu`
- the repo is at `/home/nemetona/NEMETONA-hive/MASTERPLAN` (user `nemetona`)

If the user cannot keep the name or path, edit `launch-hidden.vbs` and
`run.bat` to match and tell them to re-copy the `.vbs` (section 6).

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

## 2. System packages

```bash
sudo apt update
sudo apt install -y build-essential curl git unzip gh
```

(The old distro was Ubuntu 26.04 with git 2.53 and gh 2.46; any current Ubuntu
is fine.)

## 3. Node, from `.nvmrc`

Node comes from nvm, not apt. `run.sh` and both git hooks look for
`$HOME/.nvm/nvm.sh`, and the hooks refuse a `node` resolved under `/mnt/`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.5/install.sh | bash
. ~/.nvm/nvm.sh
cd ~/NEMETONA-hive/MASTERPLAN
nvm install          # reads .nvmrc -> 24.16.0
node -v && command -v node    # v24.x, under ~/.nvm, not /mnt/
```

`package.json` requires `node >= 24.16.0`.

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

`prepare` sets `core.hooksPath` to `githooks` and runs the build. Confirm:

```bash
git config core.hooksPath      # githooks
chmod +x githooks/* run.sh     # only if they lost the executable bit
git status --short             # components.js / app.css / version.js must be unchanged
```

A changed bundle after a clean build means the restore was from a stale
backup or the Node version differs. Report it; do not commit it unasked.

## 5. Git identity and GitHub

```bash
git config --global user.name nemetona
git config --global user.email nemetona@ananda
git config --global init.defaultBranch main
git config --global pull.rebase false
gh auth login                  # HTTPS, GitHub.com; the user completes this in the browser
gh auth setup-git              # writes the credential helper
git remote -v                  # https://github.com/nemetona-hive/MASTERPLAN.git
git fetch && git status -sb    # should say up to date with origin/main
```

The user does the login; do not ask for or handle a token. A push is the
deploy to GitHub Pages and `githooks/pre-push` checks the bundle first, so
never push during a restore unless asked.

## 6. Run it

```bash
./run.sh          # serves http://localhost:3005 and opens a browser
# or, without opening one:
npm run dev
```

Open <http://localhost:3005>. A saved project listed on the Home page proves
`_personal/projects` survived. If the page is blank, `components.js` or
`app.css` is missing or stale: `npm run build`, then refresh.

**Windows shortcut** (the user does these; they are outside WSL). Details are
in [Running it](../MASTERPLAN_DEVELOPER_GUIDE.md#running-it):

1. `masterplan.ico` and `launch-hidden.vbs` are in the repo. Copy the `.vbs`
   to `%LOCALAPPDATA%\MASTERPLAN\`. `node scripts/make-icon.js --deploy` copies
   the icon across.
2. Make `Desktop\MASTERPLAN.lnk` pointing at
   `wscript.exe %LOCALAPPDATA%\MASTERPLAN\launch-hidden.vbs`.
3. Optional: in Edge open the app, then *Apps → Install this site as an app*,
   for the sharp taskbar icon. `run.sh` finds the Start Menu shortcut itself.

If the shortcut starts nothing, run `./run.sh` in a WSL shell to see why; the
usual cause is node missing from the non-interactive PATH (section 3).

## 7. Prove it works

```bash
npm run verify
```

Everything except `layout` and `test:browser` runs with no browser. Those two
need Playwright's Chromium, so install it only if the user wants the full run:

```bash
npx playwright install --with-deps chromium
```

`--with-deps` runs apt, so it asks for sudo. Keep browser checks on
`npm run layout`, never on the dev server, because the dev server's
`/api/save-defaults` writes straight into `config.js`. If any run leaves
`config.js` modified, show `git diff config.js` before doing anything else.

## 8. Claude Code itself

A new Ubuntu has no `~/.claude`. Project instructions come from `CLAUDE.md` in
the folder, so they are already there. What is lost is the user's memory notes
(`~/.claude/projects/-home-nemetona-NEMETONA-hive-MASTERPLAN/memory/`) unless
they were backed up too. If the user has that folder, restore it to the same
path. If not, say so; the project docs hold every rule that matters, and the
rest were preferences the user can restate.

## Keeping the backup restorable

The user wants the folder to survive an accidental drive failure at any time,
without preparing anything. What makes that true:

- Commit and push, so the tracked tree is on GitHub. `_personal/` and
  `_temp_masterplan/` are the only irreplaceable parts that are not, so those
  are what the folder backup must include.
- Back the folder up with `tar -czpf` from inside WSL, not by copying it in
  Explorer. Explorer drops the symlinks in `node_modules/.bin` and the
  executable bits on `run.sh` and `githooks/*`. Section 4 repairs this, but
  only by reinstalling.
- Back up `~/.claude/projects/-home-nemetona-NEMETONA-hive-MASTERPLAN/memory/`
  alongside it if the memory notes matter.

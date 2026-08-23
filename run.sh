#!/usr/bin/env bash

# Set window title if supported
echo -ne "\033]0;Nemetona MASTERPLAN\007"

# Navigate to the script's directory
cd "$(dirname "$0")" || exit 1

echo "Starting Nemetona MASTERPLAN local server..."

# Load an NVM-managed Node.js installation when this script is launched
# non-interactively from run.bat.
if ! command -v node >/dev/null 2>&1; then
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "$NVM_DIR/nvm.sh"
    fi
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed in WSL."
    echo "Install it with NVM, then run this launcher again."
    exit 1
fi

# Unlike MONEYFLOW, components.js and app.css are tracked files here rather than
# gitignored build output — GitHub Pages serves the tree directly — so a fresh
# clone has both. Either can still be stale, and is missing only if something
# deleted it: build in that case rather than serving an index.html that loads
# nothing. This is not a staleness check — use `npm run watch` while developing.
if [ ! -f components.js ] || [ ! -f app.css ]; then
    echo "Build output missing. Running npm run build..."
    if ! npm run build; then
        echo "Build failed. Run 'npm install' first if this is a fresh clone."
        exit 1
    fi
fi

open_browser() {
    local url="http://localhost:3005"
    if grep -qi microsoft /proc/version 2>/dev/null || grep -qi wsl /proc/sys/kernel/osrelease 2>/dev/null; then
        # From WSL the browser is on the Windows side, so it has to be launched
        # through cmd.exe. --app drops the tab strip and address bar, which is
        # what makes this feel like the app rather than a page.
        cmd.exe /c "start msedge --app=$url" 2>/dev/null || \
        cmd.exe /c "start chrome --app=$url" 2>/dev/null || \
        cmd.exe /c "start $url" 2>/dev/null || \
        explorer.exe "$url" 2>/dev/null
    elif [ "$(uname)" = "Darwin" ]; then
        open "$url" 2>/dev/null
    else
        xdg-open "$url" 2>/dev/null || \
        google-chrome --app="$url" 2>/dev/null || \
        firefox "$url" 2>/dev/null
    fi
}

# Port check via an inline Node listener, so this needs no lsof/ss/netstat and
# behaves the same wherever Node runs.
if ! node -e "const net = require('net'); const s = net.createServer().once('error', e => process.exit(e.code === 'EADDRINUSE' ? 1 : 0)).once('listening', () => { s.close(); process.exit(0); }).listen(3005);" 2>/dev/null; then
    echo "MASTERPLAN local server is already running on http://localhost:3005"
    open_browser
    exit 0
fi

# Give the server a moment to bind before the browser asks for the page.
(sleep 2 && open_browser) >/dev/null 2>&1 &

node scripts/local-dev-server.js

echo
echo "Server has stopped."

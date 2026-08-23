' Launches MASTERPLAN with no console window at all.
'
' A Windows .lnk can only ask for Normal, Maximized or Minimized — there is no
' "hidden" window style for a shortcut, so pointing one straight at wsl.exe
' always leaves a console somewhere, even if only in the taskbar. WScript.Shell's
' Run() takes an intWindowStyle, and 0 means hidden, which is the only way to get
' none. The third argument (bWaitOnReturn = False) lets wscript exit immediately
' rather than sitting there for the life of the server.
'
' The cost of hiding it: if the server fails to start you get no message. The
' browser still opens and will fail to connect, which is the signal. To see what
' went wrong, run ./run.sh from a WSL shell instead.
'
' Source of truth for this file is the repo. The shortcut points at the copy in
' %LOCALAPPDATA%\MASTERPLAN\ because a .vbs on a \\wsl.localhost\... UNC path sits
' in an untrusted zone and trips Windows' security prompt, exactly like run.bat.
CreateObject("WScript.Shell").Run "wsl.exe -d Ubuntu --cd /home/nemetona/NEMETONA-hive/MASTERPLAN -e bash ./run.sh", 0, False

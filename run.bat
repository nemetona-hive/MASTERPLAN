@echo off
title Nemetona MASTERPLAN
setlocal

where wsl.exe >nul 2>nul
if errorlevel 1 (
    echo WSL is not installed or is not available on PATH.
    pause
    exit /b 1
)

for %%I in ("%~dp0.") do set "WINDOWS_DIR=%%~fI"
for /f "delims=" %%I in ('wsl.exe -d Ubuntu -e wslpath -u "%WINDOWS_DIR%"') do set "WSL_DIR=%%I"
if not defined WSL_DIR (
    echo Could not translate the MASTERPLAN folder path into a WSL path.
    pause
    exit /b 1
)

wsl.exe -d Ubuntu --cd "%WSL_DIR%" -e bash ./run.sh
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo MASTERPLAN stopped with exit code %EXIT_CODE%.
    pause
)

exit /b %EXIT_CODE%

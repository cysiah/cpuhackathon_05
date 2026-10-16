@echo off
rem Atrium Heat Lab - starts a local web server and opens the app. Close this window to stop it.
title Atrium Heat Lab - local server (close to stop)
cd /d "%~dp0"
set "PY="
if exist "%ProgramFiles%\ladybug_tools\python\python.exe" set "PY=%ProgramFiles%\ladybug_tools\python\python.exe"
if not defined PY if exist "%USERPROFILE%\ladybug_tools\python\python.exe" set "PY=%USERPROFILE%\ladybug_tools\python\python.exe"
if not defined PY (where py >nul 2>nul && set "PY=py")
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (
  echo No Python found. Install Ladybug Tools, or Python 3 from https://www.python.org/downloads/
  pause
  exit /b 1
)
set PYTHONHOME=
echo Atrium Heat Lab is running at http://localhost:8000  - close this window to stop it.
start "" "http://localhost:8000"
"%PY%" -m http.server 8000
pause

#!/bin/bash
# Atrium Heat Lab - starts a local web server and opens the app. Close this window to stop it.
# First time: right-click this file > Open > Open (macOS asks because it was downloaded).
cd "$(dirname "$0")"
PY=""
for p in "$HOME/ladybug_tools/python/bin/python3" "$(command -v python3)"; do
  if [ -n "$p" ] && [ -x "$p" ]; then PY="$p"; break; fi
done
if [ -z "$PY" ]; then
  echo "No Python found. Install Ladybug Tools, or Python 3 from https://www.python.org/downloads/"
  read -n 1 -s -r -p "Press any key to close"; exit 1
fi
unset PYTHONHOME
echo "Atrium Heat Lab is running at http://localhost:8000 - close this window to stop it."
( sleep 1; open "http://localhost:8000" ) &
"$PY" -m http.server 8000

# tool/

The new Track 01 tool. It opens on the route map (`index.html`). Folders follow the chain: `tools/` (exporters and sweep) → `data/` (JSON) → `js/` (web app). See `docs/ROUTE_MAP.md`.

Serve it with `python -m http.server 8000` from this folder. Opening the file directly works, but then the file-status dots stay blank.

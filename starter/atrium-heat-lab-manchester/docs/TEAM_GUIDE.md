# Atrium Heat Lab: team guide

How to get geometry from Rhino into the app, what the app can already analyse, and which files to read.

| Read this | For |
|---|---|
| [heat-ledger.html](share/heat-ledger.html) | The student guide: sustainability concept, trade-offs, Rhino → JSON (open in a browser, or print to PDF) |
| [ANALYSES.md](ANALYSES.md) | Every analysis and intervention, labelled by what the current model can answer |
| [../README.md](../README.md) | The starter pack: running the app, the data, the sweep |

## 1. Run the app

Double-click **Mac - Start web app.command** (or the Windows `.bat`), or run `python3 -m http.server 8000` in this folder, then open <http://localhost:8000>. Edit a file and refresh the browser. There's no build step.

## 2. The Rhino → JSON translator

The app never reads Rhino. It reads JSON in `data/`, written by three scripts run from **Rhino 8 → ScriptEditor → open file → Run**. All three convert model units to metres and keep Rhino coordinates; true north is 60.9° anticlockwise from +Y.

| Script | Reads | Writes | Changes scores? |
|---|---|---|---|
| `tools/export_from_grasshopper.py` (IronPython 2) | The solved Grasshopper script (FF components, read only) | `data/baseline, climate, radiation, context.json` + `tools/inputs/sweep_inputs.json` | Yes, after the sweep |
| `tools/export_atrium_geometry.py` | Objects on the `ATRIUM::*` layers or with an `atrium_role` key | `tools/inputs/atrium_geometry.json` + the atrium areas in `data/baseline.json` | Yes, after the sweep; proxies update immediately |
| `tools/export_selection_to_json.py` | Whatever you select | `data/context.json` (Add / Replace, with backup) or `data/selection.json` | No, it only changes the 3D view |

### Tagging the atrium

| Layer | Put on it | Becomes in EnergyPlus |
|---|---|---|
| `ATRIUM::Exposed` | Roof slopes, clerestories, gables (touching outside air) | Outdoor surfaces, glazing allowed |
| `ATRIUM::Mass` | Floor and walls to the rest of the building | Adiabatic thermal mass (downward faces = floor) |
| `ATRIUM::Glazing` | Glass panes lying on Exposed faces (within 0.5 m) | Glazed area on that face |

- Exposed and Mass together must join into **one closed volume** with **flat faces**.
- Objects that must stay on their own layer (shared RhinoSync model) get **Properties → Attribute User Text**: `atrium_role` = `exposed`, `mass` or `glazing`. The key always wins over the layer.
- The first run offers to create the layers. Delete `tools/inputs/atrium_geometry.json` to go back to the original box.

### Which route do I need?

| I changed… | Do this | Time |
|---|---|---|
| Nothing in Rhino: I want a new metric or chart | Add it to `js/mechanisms.js` and register it in `H.extraMetrics()`, then refresh | Minutes |
| Surrounding buildings, 3D view only | Select them → `export_selection_to_json.py` → **Add** → refresh | Minutes |
| Surrounding buildings that should shade the simulation | Grasshopper solves → `export_from_grasshopper.py` → back up `sweep.json` → sweep `--quick` → full sweep | An hour or more |
| The atrium shape, glass layout or exposed faces | Tag the layers → `export_atrium_geometry.py` → back up `sweep.json` → sweep `--quick` → full sweep | An hour or more |
| A Ladybug study in Grasshopper | Add its GUID to `IR` in `export_from_grasshopper.py` → export → add it to `STUDIES` in `js/app.js` | Under an hour |
| Nothing in Rhino: I want a new lever | `LEVERS` + `build_model()` in `sweep_atrium.py`, `H.LEVER_META` in `js/model.js` → `--quick` → full sweep | Hours of computing |

### Running the sweep

```
# Mac
~/ladybug_tools/python/bin/python3 tools/sweep_atrium.py --quick       # 32 designs, about 1 min
~/ladybug_tools/python/bin/python3 tools/sweep_atrium.py --workers 6   # full grid

# Windows
"C:\Program Files\ladybug_tools\python\python.exe" tools\sweep_atrium.py --quick
```

Before you run anything:

- **Copy `data/sweep.json` first.** Even `--quick` overwrites it.
- **Never edit group 0 or any FF component.**
- After a new atrium export, the **baseline EnergyPlus card is stale** until you re-run the Grasshopper export.
- The full grid took about 25 min on 14 cores. Each extra lever with five levels multiplies the run count by five.

## 3. What the app can analyse

The full breakdown is in [ANALYSES.md](ANALYSES.md): 6 items analysable now, 3 partial, 14 approximations and 9 that need new simulations. In the app:

- **Explore designs / Trade-offs / Sensitivity**: the EnergyPlus metrics plus TM52, the night-flush check, winter glass balance, stack ventilation, cooling need and night fan energy.
- **Diagnose**: weekly heat balance, solar by glazing element, TM52 criteria, night flush, cost and carbon (rates still to source), and interventions outside the sweep.
- **Assumptions**: every proxy assumption is editable, and the catalogue table sits at the bottom.

Every number carries its source: **EnergyPlus** (simulated), **derived** (post-processed EnergyPlus), **proxy** (estimated with editable assumptions) or **approx** (an intervention outside the sweep). Quote the tag with the number.

## 4. Keeping the docs current

```
python3 tools/build_docs.py
```

This rebuilds `docs/ANALYSES.md` from `data/design_catalogue.json` and `docs/share/heat-ledger.html` from `docs/heat-ledger.html`. Edit the sources, not the outputs.

**PDF:** open `docs/share/heat-ledger.html` in a browser → Print → Save as PDF. The page has an A4 print layout that lists every route.

# Route map: the chain at a glance

This is the **main route map of the tool**. Every file in `tool/` sits on one link of this chain. The live version is `tool/index.html`: click a box to see what it reads, writes and how to rerun it, and the dots show which files are in the repo.

The web app never opens a Rhino file. Geometry and results are written to JSON by Python scripts, the EnergyPlus sweep adds simulated results, and the browser reads only JSON. Each link in the chain can be rerun on its own.

```
RHINO 8                 EXPORTERS                        JSON                                 WEB APP
                        export_from_grasshopper.py ──┬─> sweep_inputs.json ─┐                  model.js
                        (official, solved script)    │   atrium_geometry.json ┤                (surrogate, metrics)
Model .3dm         ─┬─>                              │      sweep_atrium.py · EnergyPlus  ─>        │
+ Grasshopper       ├─> export_atrium_geometry.py ───┼─>    sweep.json (3,125 + 40 runs) ───>  mechanisms.js
(FF comps, read only)│  (atrium zone, layers/keys)   │                                         (derived, proxy, approx)
                    └─> export_selection_to_json.py ─┴─> baseline · climate · radiation ──>         │
                        (any selection, 3D only)         context · design_catalogue.json ──>  app.js · viewer3d.js
                                                                                               (charts, 3D view)
```

**Rule:** only the two files feeding `sweep_atrium.py` (`sweep_inputs.json`, `atrium_geometry.json`) change simulated scores. Everything else changes what is shown or estimated.

## Links

| Link | File | Reads | Writes | Numbers are | Status |
|---|---|---|---|---|---|
| Rhino | Model .3dm + starter GH | — | — | Official | Google Drive via RhinoSync, not in repo |
| Exporter | `tool/tools/export_from_grasshopper.py` | solved GH script | `sweep_inputs.json` + display JSON | Official | copy in from starter pack |
| Exporter | `tool/tools/export_atrium_geometry.py` | atrium layers / keys | `atrium_geometry.json` | Official geometry | to write |
| Exporter | `tool/tools/export_selection_to_json.py` | Rhino selection | display geometry | Display only | to write |
| Sweep | `tool/tools/sweep_atrium.py` | the two inputs above | `sweep.json` | EnergyPlus | copy in from starter pack |
| JSON | `tool/data/sweep.json` | — | — | EnergyPlus | **in repo** (recovered from deck) |
| JSON | `tool/data/baseline.json`, `climate.json`, `radiation.json`, `context.json` | — | — | Official / Ladybug / display | **in repo** (recovered from deck) |
| JSON | `tool/data/design_catalogue.json` | — | — | — | to make |
| App | `tool/js/model.js` | `sweep.json` | score, peak, h>26 °C ± error | Interpolated | to write |
| App | `tool/js/mechanisms.js` | model + display JSON | daylight, winter loss, vent area, K·h per surface | Estimated / assumed | to write |
| App | `tool/js/app.js`, `tool/js/viewer3d.js` | all of the above | charts, 3D view | — | to write |

## Recovered data (from the Heat Headroom deck)

The deck in `app/heat-headroom-deck/` had the data built in. I pulled it out into `tool/data/`:

- `sweep.json`: keys, levels, base, `score`/`peak`/`h26`/`h28`/`solar` × 3,125, hourly op temps (packed string, `opMin` 12, `opStep` 0.25), 40 `validation` runs, `hdh` 68,281.4.
- `radiation.json`: 5,531 faces (`v`, `f`, `cat`, `area`), 11 categories (atrium roof, clerestory, roof, façade by 8 directions), results `hot_week`, `annual`, `benefit_present`, `benefit_future`; `north` 60.9°.
- `context.json`: surrounding city mesh (`v`, `t`).
- `baseline.json`: baseline atrium operative temperature, hot week, 168 h. Score 320.6 K·h, peak 40.5 °C, EVAL ID EC2F526D.
- `climate.json`: outdoor hot week 2050 and today (168 h each), plus the summer series from day 120.

The schema is the deck's, which may differ from the starter `data/*.json`. When the real exporters run, they replace these files.

## Run

```
cd tool
python -m http.server 8000
# open http://localhost:8000
```

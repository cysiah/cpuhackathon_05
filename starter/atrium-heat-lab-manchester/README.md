# Atrium Heat Lab: Track 01 starter app

Forecast Factory 00 · Track 01 (build your own analysis tool or app)

A small web app that explains why the Geoffrey Manton atrium overheats in a 2050 heatwave,
which design levers move it, and what each choice costs. It is a **starting point**: take it
apart, replace pieces, and grow it into a better tool.

Your job in Track 01 is to build an analytical computational tool that identifies and
communicates where the opportunities for intervention are, and highlights the potential
trade-offs. Start in Rhino: open the central model `3_Team_Work/GeoffreyManton_CaseStudy.3dm`
(with RhinoSync) and `GM_Atrium_Overheat_2050_Baseline_v2.gh` (in `2_Setup_DOWNLOAD_ME`) to see
the building and the baseline. Then
build a tool that helps people **understand the building as a system** of variables,
trade-offs and constraints, and be honest about what your tool does and does not know.

## Team docs and tools (Manchester case)

This repository holds only the Geoffrey Manton atrium case: Manchester weather (2050 crude morph),
the model's geometry and radiation, and the full EnergyPlus sweep. The Rhino model and Grasshopper
script are not included; they come from the course setup folders.

| Read | For |
|---|---|
| [docs/TEAM_GUIDE.md](docs/TEAM_GUIDE.md) | Rhino → JSON scripts, layer tagging, which route to run, the sweep |
| [docs/ANALYSES.md](docs/ANALYSES.md) | Every analysis and intervention, labelled by what the current model can answer |
| [docs/share/atrium-toolchain.html](docs/share/atrium-toolchain.html) | Tooling reference: the chain, the JSON files, how the analyses are layered |
| [docs/share/heat-ledger.html](docs/share/heat-ledger.html) | Student guide: overheating as a sustainability question |

New since the starter pack: `js/mechanisms.js` (TM52, heat balance, proxies, interventions outside the
sweep, shown under **Diagnose** in the app), `data/design_catalogue.json`, and the Rhino exporters
`tools/export_atrium_geometry.py` and `tools/export_selection_to_json.py`.

## Run it

Double-click **Windows - Start web app.bat** or **Mac - Start web app.command**. It starts a
small local web server and opens http://localhost:8000 in your browser. Close the window to stop it.

Or by hand (browsers block `fetch()` from `file://` pages, so you need a server):

```
python -m http.server 8000
```

No build step, no npm. Edit a file and refresh the browser.

The published demo (single-file version) is built with `python tools/build_demo.py`.

## What is in the box

| Path | What it does |
|---|---|
| `index.html` | Page structure, one `<section>` per part of the story |
| `css/app.css` | All styling; colour tokens at the top, light and dark themes |
| `js/model.js` | The maths: surrogate interpolation, proxies, Pareto front, sensitivity. No drawing. |
| `js/viewer3d.js` | three.js view of the envelope radiation mesh |
| `js/app.js` | Builds each section from the data (one function per section) |
| `data/*.json` | The analysis, exported from the Grasshopper script and the EnergyPlus sweep |
| `tools/export_from_grasshopper.py` | Re-exports `data/` from the GH script (run inside Rhino) |
| `tools/sweep_atrium.py` | Runs the EnergyPlus design-space sweep → `data/sweep.json` |
| `tools/build_demo.py` | Inlines CSS/JS into `demo/index.html` for single-file hosting |

Libraries load from CDNs: Chart.js 4.4.1, three.js r128 (+ OrbitControls). Swap them freely.

## The data

| File | Contents |
|---|---|
| `baseline.json` | Official baseline: EnergyPlus score, hourly operative temperature for the hot week, screening model, lever values, EVAL ID |
| `climate.json` | 8760 h dry-bulb present and 2050 (crude morph), solar radiation, hot week, occupied hours |
| `radiation.json` | Envelope analysis mesh (m, Z up), per-face category and area, results for 4 Ladybug studies (kWh/m²) |
| `context.json` | Surrounding building massing as light triangle meshes; north angle |
| `sweep.json` | Every design in the full-factorial EnergyPlus sweep + off-grid validation runs |

Coordinates are Rhino model coordinates in metres. True north is **60.9° counter-clockwise
from +Y**. Facade categories in `radiation.json` already use true compass directions.

### The sweep

`sweep.json` holds **5 × 5 × 5 × 5 × 5 = 3,125** EnergyPlus runs of the official atrium model
(the same one behind the E+ SCORE CARD in the Grasshopper script), for every combination of:

| Lever | Levels |
|---|---|
| `g` glazing g-value | 0.2, 0.35, 0.5, 0.6, 0.7 |
| `u` glazing U-value (W/m²K) | 1.0, 1.6, 2.8, 4.0, 5.8 |
| `ach_day` ventilation 08–18 h | 1, 2, 4, 7, 10 |
| `ach_night` night ventilation | 0, 1, 3, 6, 10 |
| `screen_opacity` roof screen | 0, 0.25, 0.5, 0.75, 0.9 |

plus 40 random **off-grid** runs used only to measure how wrong the interpolation is. Each run
records the score, peak operative temperature, hours above 26/28/30 °C, transmitted solar and
the full hourly operative temperature for the week.

To explore a different design space, edit `LEVERS` in `tools/sweep_atrium.py` and run it with
the Python that ships with Ladybug Tools (about 25 min on 14 cores for 3,165 runs):

```
"C:\Program Files\ladybug_tools\python\python.exe" tools\sweep_atrium.py --workers 14
```

On a Mac:

```
~/ladybug_tools/python/bin/python3 tools/sweep_atrium.py --workers 6
```

The 2050 weather file it simulates is bundled in `tools/inputs/`.

`--quick` runs a 32-design grid to test changes in about a minute.

## Methodology we expect from Track 01 teams

These principles run through the template. Keep them in whatever you build.

1. **Search the whole design space, not one lever at a time.** Levers interact: the U-value
   effect changes sign depending on shading. Show combinations.
2. **Show trade-offs, not just optima.** Every gain costs something (daylight, winter heat,
   opening area, energy, money, carbon). Plot fronts, not single best answers.
3. **Say where every number comes from.** The app labels EnergyPlus results, interpolated
   values and proxies differently. Do the same for anything you add.
4. **Measure your own error.** The surrogate is checked against off-grid simulations and the
   error is shown next to the result. If you add a model, validate it the same way.
5. **List what you do not model.** The Assumptions section is part of the product, not small print.

## Ideas to take it further

- Add an objective: Radiance daylight autonomy or glare, embodied carbon, cost.
- Replace the full grid with adaptive sampling or a fitted model, and show its uncertainty.
- Run several weather years or climate projections and plot score ranges.
- Explain the physics for a chosen hour: solar in, ventilation out, heat into the concrete.
- Map the opportunities onto the Rhino model: which surfaces, at which hours, how much each could save.
- Make it usable by a non-specialist (an estates manager, a student union) and test it with one.

## Keep it honest

- The 2050 weather is a **crude projection**: a uniform dry-bulb shift plus a heatwave pulse,
  not a climate model output. The numbers are for comparing options, not predicting the future.
- The EnergyPlus model is one well-mixed zone with fixed air-change rates. Real atria stratify.
- The daylight, winter-loss and vent-area values are **proxies** with editable assumptions.

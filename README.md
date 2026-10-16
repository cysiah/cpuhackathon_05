# cpuhackathon_05: Floorplate Heat Map

Team 05, Track 01 (App), Forecast Factory X. A static web app that maps overheating on isolated floorplates (GF and 5F), classified as enclosed, open or void, with layers you can cross-reference.

**It currently runs on DEMO data.** Everything marked `A##` is a placeholder. See [ASSUMPTIONS.md](ASSUMPTIONS.md) for the full list with a question for each.

## Run it

```
cd app && python3 -m http.server 8000     # then open http://localhost:8000
node tests/test_model.js                  # model checks
```

Don't open `index.html` directly; browsers block the data loading.

## What it does

- **Plans:** GF and 5F heat maps on one shared colour scale. Voids are hatched; zones are outlined.
- **Four views:** one layer, two layers (3×3 bivariate), hotspots (count of flags per point), change against another scenario.
- **Layers:** overheating K·h, TM52 criteria failed, peak temperature, solar MRT rise, sun hours, transmitted solar, daylight factor.
- **Cross-reference:** a linked scatter. Drag a box and the matching points light up on both plans.
- **Zone table, ledger, source labels** on every number, and the assumption register at the bottom.

## How a number is made

```
T(point, hour) = EnergyPlus atrium operative temp(hour)       <- simulated, one value for the whole atrium
               + 0.5 * (SolarCal MRT rise at the point - its atrium-floor average)   <- estimate
               + optional stratification / enclosed-room offsets                    <- assumed, default 0
K·h = sum of (T - 26) over occupied hours, 14-20 June
```

The re-centring means the atrium floor averages back to the EnergyPlus score, which is shown as a check under the zone table.

## Files

| Path | Purpose |
|---|---|
| `app/` | The web app (`js/model.js` maths, `js/app.js` views) |
| `app/data/` | `meta.json`, `scenarios.json`, `floors/<ID>.json`, `assumptions.json` |
| `tools/make_demo_data.py` | Writes placeholder data in the real format |
| `tools/gh_export_floorplate.py` | Grasshopper Python 3 exporter for the real data (**untested in Rhino**) |
| `tools/solarcal.py` | Simplified ASHRAE 55 SolarCal |
| `tools/assumptions_to_md.py` | Rebuilds `ASSUMPTIONS.md` from `assumptions.json` |
| `docs/CONTEXT_FROM_RHINO_CHAT.md` | Full project background |

## Swapping in real data

1. Answer the open assumptions (A01-A05 and A14-A16 matter most).
2. Run Ladybug and Honeybee on the real GF and 5F grids; export with `tools/gh_export_floorplate.py`.
3. Replace `app/data/floors/*.json` and the hourly series in `scenarios.json`; set `"demo": false` in `meta.json`.

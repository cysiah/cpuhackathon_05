# Forecast Factory X · Team 05 · Track 01

An analytical tool for overheating in the Geoffrey Manton atrium (Manchester, 2050 heatwave), and the one-page site that presents it.

- **The tool:** the Floorplate Heat Map in `app/`. It maps overheating on the ground floor and the upper floor, spot by spot, then checks any intervention against the existing atrium.
- **The site:** `index.html` at the repo root. One page; the tool is embedded as its "Floorplates" section, next to the building view and the design explorer.
- **The starter:** the organisers' Atrium Heat Lab pack, kept unchanged in `starter/` so everything here can be rebuilt.

**Not everything is real yet.** Weather, the atrium geometry EnergyPlus sees, the 3,125 EnergyPlus runs and the sun on every point are real. The floor outlines, the upper-floor level, glass transmittance and more are placeholders: [ASSUMPTIONS.md](ASSUMPTIONS.md) lists all of them (and the tool shows the same list), each with a question for the team.

## Run it

Open `index.html` in a browser; the whole site, including the tool, works from disk. The 3D building view loads three.js from a CDN, so it needs a connection.

To use a local server instead (and to open the tool alone at `app/index.html`):

```
python3 -m http.server 8000      # then open http://localhost:8000  (site)  or  /app/  (tool)
node tests/test_model.js         # model and data checks
```

To publish, turn on GitHub Pages for this repository (Settings > Pages > deploy from branch, root folder).

## The tool in one minute

- **Two jobs:** evaluate the existing condition on each floor; test a proposal against it ("how far, how good are we doing").
- **Two lenses** on the same data (placeholder wording, A25): the **architect** (where does heat arrive, what decides it, what does it cost the daylight) and the **developer / estates manager** (how much floor area is fixed by each intervention).
- **Interventions:** 11 presets plus five sliders (glass g-value, glass U-value, day and night ventilation, roof screen). A scenario's hourly atrium temperature is interpolated from the real EnergyPlus runs; the sun data is scaled to match.
- **Views:** one layer, two layers (3x3), hotspot flags, change against another scenario, and **Grade**.
- **Grade (A30):** an open-ended composite per spot. You tick which layers count and set each one's weight and good/bad limits; the grade is the weighted average, classed Good / Fair / Poor / Critical.
- **Verdict:** this design against the existing atrium: atrium score, mean K.h and grade per floor, good floor area, TM52 failures, daylight, winter loss, and how sure we are.
- **Reading the starter critically:** a card in the tool, and [docs/CRITIQUE.md](docs/CRITIQUE.md).

### How a number is made

```
T(point, hour) = EnergyPlus atrium operative temperature(hour)   <- real, interpolated between runs
               + 0.5 x (sun-on-a-person rise in mean radiant temperature at the point
                        - its floor average)                      <- estimate (simplified SolarCal)
               + optional stratification / enclosed-room offsets  <- assumed, default 0
K.h = sum of (T - 26) over occupied hours, 14-20 June
```

The sun term comes from casting a ray from every point toward the sun through the official model's glazed faces and shading surfaces (`tools/build_real_data.py`), with real hourly weather. It is re-centred so the floor average matches EnergyPlus, and the tool shows that check.

## What is in the repo

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The site (diagrams, building view, design explorer, floorplates section). `js/sweep.js`, `js/building.js`, `js/data.js` are generated, see `tools/build_data.py` |
| `app/` | The Floorplate Heat Map. `js/model.js` maths (no drawing), `js/scenario.js` sweep interpolation and presets, `js/app.js` views, `data/` generated |
| `starter/atrium-heat-lab-manchester/` | The organisers' pack, unchanged: data, scripts, docs, weather file |
| `tools/build_real_data.py` | Ray-casts sun onto the GF and 5F points, writes `app/data/floors/*.json` and `meta.json` (needs numpy) |
| `tools/bundle_app_data.py` | Packs `app/data` into `bundle.js` so the tool works from disk |
| `tools/assumptions_to_md.py` | Rebuilds `ASSUMPTIONS.md` from `app/data/assumptions.json` |
| `tools/critique_stats.py` | The numbers behind `docs/CRITIQUE.md` |
| `tools/gh_export_floorplate.py` | Grasshopper exporter for the real floorplates (**untested in Rhino**) |
| `tools/solarcal.py` | Simplified ASHRAE 55 SolarCal |
| `tools/build_data.py` | Rebuilds the site's `js/data.js`, `js/sweep.js`, `js/building.js` from the starter data |
| `docs/` | `CRITIQUE.md`, `CONTEXT_FROM_RHINO_CHAT.md` (project background) |
| `tests/test_model.js` | Reproduces the organisers' numbers and checks the maths |

Rebuild after changing inputs:

```
python3 tools/build_real_data.py      # sun on the floors (about 35 s)
python3 tools/assumptions_to_md.py    # if you edited app/data/assumptions.json
python3 tools/bundle_app_data.py      # always last
```

## The site

Sections, top to bottom: problem, baseline, outdoor air, heat balance, building (three.js, Ladybug radiation), **floorplates (our tool)**, design space, explorer, headroom, honesty, pitch. Each diagram is a canvas redrawn at 12 frames per second; with reduced motion on, each shows one still frame. The Headroom framing in the hero, headroom and pitch sections is from the earlier idea, which is parked; those sections have not been rewritten.

`python tools/build_data.py path/to/atrium-heat-lab-manchester/data` rebuilds the site's generated data after the starter data changes.

## Keep it honest

- The 2050 weather is a **crude projection** (+1.5 C everywhere, +4 C heatwave pulse). It compares designs; it does not predict a year.
- EnergyPlus models the atrium as **one well-mixed zone**. The per-spot variation is our estimate and does not include stratification, wall surface temperatures, wind or glare.
- Daylight, winter loss and fan energy are **proxies** with fixed assumptions.

# Heat Headroom

One-page presentation site for Forecast Factory x CPU Zoo, Team 05 (Track 01). This is a draft.

## Page order

Home · 01 Introduction · 02 Project context (the problem, projection at the site) · 03 Scope of study and adaptive reuse · 04 Our case · 05 How the tool works · 06 The starter app · 07 Design explorer · 08 Where the heat comes in · 09 Heat balance · 10 Why openness · 11 Trade-offs and honesty · 12 Why it wins.

The "key finding" page (outdoor air fails the 2050 score) is archived in `archive/key-finding.html`.

## Run it

Open `index.html` in a browser. There is no build step and no server is needed.

To publish it, turn on GitHub Pages for this repository (Settings › Pages › deploy from branch, root folder).

## What is in the repo

| Path | What it does |
|---|---|
| `index.html` | Page structure: one `<section>` per band, top to bottom |
| `css/style.css` | All styling. Colour and type tokens are at the top |
| `js/diagrams.js` | The canvas diagrams, one `reg("c-…")` block per diagram, plus the frame loop |
| `js/pages.js` | Diagrams for the home, introduction, context, scope and openness pages |
| `js/land.js` | Generated 1° land mask for the globe. Do not edit by hand |
| `tools/build_landmask.py` | Rebuilds `js/land.js` from Natural Earth land (world-atlas `land-110m.json`) |
| `js/building-view.js` | The building section: three.js model of envelope radiation, study switcher, readout and bars |
| `js/explorer.js` | The design explorer: lever sliders, interpolation, measured error, proxies and the week chart |
| `js/data.js` | Generated data the diagrams draw from. Do not edit by hand |
| `js/building.js` | Generated envelope mesh, four radiation studies and context massing for the building section. Do not edit by hand |
| `js/sweep.js` | Generated full sweep (all 3,125 designs, hourly temperatures) for the explorer. Do not edit by hand |
| `tools/build_data.py` | Rebuilds `js/data.js` from the Atrium Heat Lab starter data |

## Building

The Building section rebuilds section 2 of the Atrium Heat Lab starter app: Ladybug incident radiation on the envelope (hot week, annual, and benefit/harm today and in 2050), shaded by the surrounding city. The model space is black and the heatmap runs from blue (little sun) to pink (most sun); for benefit/harm, blue is benefit and pink is harm. Its look borrows from the game Marathon: hazard tickers, HUD corner marks and a readout panel. The 3D view loads three.js r128 from a CDN, so it needs an internet connection.

## Design explorer

The Explorer section rebuilds section 3 of the Atrium Heat Lab starter app. It uses the same maths: multilinear interpolation between the 3,125 simulated designs, error measured against the 40 off-grid EnergyPlus runs (±4.8 K·h typical, 20.4 worst), and the starter app's daylight, winter-loss and vent-area proxies with the same assumptions. Hourly temperatures are stored to 0.25 °C to keep the file small; scores and peaks are exact.

## How the diagrams move

Each diagram is a canvas redrawn at 12 frames per second, looping every 20–24 frames like a GIF. Scrolling drives part of each one, such as the running score total and the planes moving apart. With reduced motion turned on, each diagram shows one still frame.

## Data

`js/data.js` holds the hot-week atrium temperature (EnergyPlus baseline), outdoor temperature for today and 2050, and the scores of all 3,125 designs in the EnergyPlus sweep. To rebuild it, `js/sweep.js` and `js/building.js` after the starter data changes:

```
python tools/build_data.py path/to/4_Atrium_Heat_Lab/data
```

In the Headroom section, the +0.5, +1 and +2 °C planes are placeholders until the warmer-climate sweep has run. Only the bottom plane (the 2050 file) is real.

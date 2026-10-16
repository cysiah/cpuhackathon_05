# Heat Headroom

One-page presentation site for Forecast Factory X, Team 05 (Track 01).

## Run it

Open `index.html` in a browser. There is no build step and no server is needed.

To publish it, turn on GitHub Pages for this repository (Settings › Pages › deploy from branch, root folder).

## What is in the repo

| Path | What it does |
|---|---|
| `index.html` | Page structure: one `<section>` per band, top to bottom |
| `css/style.css` | All styling. Colour and type tokens are at the top |
| `js/diagrams.js` | The canvas diagrams, one `reg("c-…")` block per diagram, plus the frame loop |
| `js/data.js` | Generated data the diagrams draw from. Do not edit by hand |
| `tools/build_data.py` | Rebuilds `js/data.js` from the Atrium Heat Lab starter data |

## How the diagrams move

Each diagram is a canvas redrawn at 12 frames per second, looping every 20–24 frames like a GIF. Scrolling drives part of each one, such as the running score total and the planes moving apart. With reduced motion turned on, each diagram shows one still frame.

## Data

`js/data.js` holds the hot-week atrium temperature (EnergyPlus baseline), outdoor temperature for today and 2050, and the scores of all 3,125 designs in the EnergyPlus sweep. To rebuild it after the starter data changes:

```
python tools/build_data.py path/to/4_Atrium_Heat_Lab/data
```

In the Headroom section, the +0.5, +1 and +2 °C planes are placeholders until the warmer-climate sweep has run. Only the bottom plane (the 2050 file) is real.

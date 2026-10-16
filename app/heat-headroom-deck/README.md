# Heat Headroom deck (imported artefact)

`index.html` is the Team 05 "Heat Headroom" interactive deck. Live copy with the route map section (06): https://claude.ai/artifact/EuEh3UfwiqPBq4Vw9iNJcH. Originally saved from
https://claude.ai/artifact/UWPrqdPZUXfDGnTstiZzaN on 16 Oct 2026. The only change is that the artifact host's injected `frame-runtime` preamble has been removed.

It is one self-contained file (about 1.7 MB). Its data is inlined as JS constants:

| Constant | Contents |
|---|---|
| `FF` | hourly 2050 weather and baseline atrium temperatures |
| `SWEEP` | the organisers' 3,125-run EnergyPlus sweep (g, U, ach_day, ach_night, screen_opacity) |
| `LAND` | land bitmap used for the context graphic |
| `BLD` | Ladybug radiation mesh of the building, tagged by element and orientation |

The deck loads three.js r128 and OrbitControls from CDNs, plus Google Fonts, so it needs a network connection. Open it in a browser directly or serve the folder with `python -m http.server 8000`.

The deck has 12 sections: intro, problem context, adaptive-reuse scope, the atrium case (320.6 K·h, peak 40.5 °C, 58 of 70 hours above 26 °C), method, the starter sweep, a five-lever design explorer, 3D envelope radiation, heat balance, openness analysis, a table of number sources and errors, and the pitch.

Notes:
- Heat Headroom is **parked** (see `CLAUDE.md`). This copy is kept as reusable material: the data, the explorer and the 3D radiation view.
- The deck calls the building "Geoffrey Manton atrium" (M15). The project brief says Trafford Wharf. Check which one is meant before reusing the wording.
- In section 05, the warmer-climate planes are placeholders. The extra ~1,000 runs were never done.

# A critical reading of the starter, and what our tool does about it

Everything below is computed from the organisers' own data (`starter/atrium-heat-lab-manchester/data/sweep.json`,
`climate.json`, `baseline.json`) with `tools/critique_stats.py`. Nothing is taken on trust from a guide.

## What the starter gets right

- It is honest about method: full-factorial sweep, an off-grid check of the interpolation, labelled proxies.
- The 3,125 EnergyPlus runs carry **hourly** temperatures, not just a score. That is what lets us rebuild any design's week.
- The numbers in "The heat ledger" guide reproduce exactly (1,041 pass; 241 pass TM52; 46.8 K·h outdoor; U-value effect −232.6 vs −5.9). The guide is trustworthy on its figures.

## What it hides, once you check

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| 1 | **"1,041 designs pass" is mostly a darkening trick.** | Only **248** of them keep daylight ≥ 5%, only **9** keep ≥ 10%. **0** passing designs have an unshaded roof with g ≥ 0.5. Lowest score in the sweep (2.9 K·h) is at about 1% daylight. | The pass line is nearly unreachable without making the atrium dark. A tool that only reports the score will recommend darkness. |
| 2 | **Passing the score is not passing TM52.** | **800 of the 1,041** passing designs fail ≥ 2 of the 3 TM52 criteria on their own hourly results. Only **241** pass both. | The UK adaptive standard disagrees with the sprint score on three quarters of the "passes". (TM52 criterion 1 is defined over May–September, so one heatwave week makes it a stress test, not compliance.) |
| 3 | **The score is mostly radiant sun, not hot air.** | Baseline = **320.6 K·h on operative temperature, 126.9 on air temperature**. Operative runs up to **5.9 K above air**. | One well-mixed zone has one number. It cannot say *where* a person is standing in that sun. This is the gap a spot-by-spot map fills. |
| 4 | **The street itself fails.** | Outdoor air scores **46.8 K·h** in the 2050 file against a limit of 42. | "Pass" in practice means "make the atrium cooler than outside at peak", which only night-cooled mass or heavy shading achieves. |
| 5 | **Insulation looks harmful.** | Raising glass U from 1.0 to 5.8 lowers the score by **232.6 K·h unshaded** but by only **5.9 behind a 90% screen**. | The lever rewards leaky glass in summer; the winter cost sits outside the model (proxy only). |
| 6 | **The surrogate is least reliable near the pass line.** | RMSE **4.8 K·h**, worst **20.4 K·h** (half the 42 limit). Mean error for designs scoring < 100 is 2.2, but the worst case is also in that range. | "Passes" between grid points can be wrong. We label every interpolated score and show the error. |
| 7 | **The weather is a crude morph.** | +1.5 °C everywhere, +0.5 °C extra at night, a +4 °C heatwave pulse. | Compare designs; do not predict a year. |

Single-lever effects at the baseline (score, K·h):
glass g 0.2 → 0.7 = 49 → 406; day ventilation 1 → 10 ACH = 633 → 228; roof screen 0 → 0.9 = 321 → 35; night ventilation 0 → 10 ACH = 470 → 225.
The biggest levers are sun-side (g, screen) and day ventilation. Night purge helps early and then flattens.

## How our tool responds

- **Where, not just how much** (finding 3): GF and 5F maps, point by point, from real sun through the real glazing.
- **The price of a fix is on screen** (finding 1): the verdict shows daylight, and the grade can include it, so darkening the room hurts.
- **A second standard next to the score** (finding 2): TM52 failures are a layer and a grade input.
- **Provenance and error everywhere** (finding 6): EnergyPlus / interpolated / estimate / proxy / assumed, with a numbered assumption list.
- **Open-ended grade** (team decision): you choose which layers count, their weights and limits.

## What our tool does *not* fix

- The per-spot pattern is **an estimate** on top of one EnergyPlus air temperature: the sun on a person (simplified SolarCal), re-centred so the floor average matches EnergyPlus. No stratification (the upper floor, near the roof glass, is surely hotter than shown), no wall surface temperatures, no wind, no glare.
- The upper floor level, gallery width, glass transmittance and posture are placeholders (A03, A04, A06, A11, A32).
- Perimeter rooms and their facade windows are not modelled (A07, A08). Enclosed rooms do not exist in the data yet (A05).
- Cost and carbon are empty until rates are sourced (A24).
- It ranks and compares designs; it does not generate them.

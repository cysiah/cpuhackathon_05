# Assumptions and placeholders

Every guess the Floorplate Heat Map makes is listed here. The app shows the same list.

**How to answer:** reply with the ID and your answer (e.g. `A04: 5F is at +17,500 mm, below the roof`).
I'll update `app/data/assumptions.json`, mark the item answered, and change the code or data.

Open: **30** of 30


## Geometry

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A01 | GF and 5F floorplate outlines | 48,000 × 30,000 mm rectangle for both floors | **Can you give me the real outlines? (closed planar curves in Rhino on layers FLOOR::GF and FLOOR::5F)** | open |
| A02 | Analysis grid | 1,000 mm grid, sensors 1,100 mm above floor (seated) | **Is 1,000 mm fine enough? Should sensors be seated (1,100) or standing (1,500)?** | open |
| A03 | Atrium void footprint | 18,000 × 12,000 mm, centred | **What is the real void outline on each floor? Does it change shape between GF and 5F?** | open |
| A04 | 5F floor level | +16,000 mm (atrium roof is at +19,350 mm) | **What is the 5F finished floor level? Is 5F still inside the atrium (below the roof glass) or above it?** | open |

## Zoning

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A05 | Enclosed / open / void zoning | 6 m strips on the north and east sides are enclosed; the rest is open  [ANSWER: You want areas, not rooms; GF and 5F one floor each. Zones are being requested from the Rhino model.] | **Can you draw the zones in Rhino on layers ZONE::Enclosed, ZONE::Open and ZONE::Void? How do you define 'enclosed' (full-height walls and a door?)** | open |

## Glazing

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A06 | Roof glazing solar transmittance | 0.55 (baseline g 0.6) | **Use the official model's roof g-value, or a measured product value?** | open |
| A07 | Facade glazing solar transmittance | 0.50 | **What glass is in the GF and 5F facades?** | open |
| A08 | Facade windows | 40% window-to-wall ratio, head at 2,700 mm; sun spread evenly along the facade (no real window positions) | **Can we export the real window openings for GF and 5F?** | open |

## Context

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A09 | Shading from neighbours on GF | GF facades get 50% of their sun; 5F gets 100% | **Run Ladybug sun hours with the context model instead? Which context set: existing, removed or future towers?** | open |

## Comfort model

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A10 | SolarCal absorptivity | 0.67 shortwave (ASHRAE 55 default) | **Keep the ASHRAE default?** | open |
| A11 | Posture | Seated (effective radiating area 0.696) | **Are people in these spaces mostly seated (study, café) or standing/walking (circulation)? Could differ by zone.** | open |
| A12 | Projected area factor | Fixed 0.25 (really depends on sun angle) | **OK to keep fixed for the hackathon, or use Ladybug's full SolarCal component?** | open |
| A13 | Floor reflectance | 0.25 | **What are the floor finishes (concrete, timber, carpet)?** | open |

## Climate

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A14 | Sun position and irradiance | Synthetic clear-ish sky over 14–20 June in Manchester | **Replace with the morphed 2050 EPW hot week from the starter pack (I need the file or its exported hourly values)** | open |

## Daylight

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A15 | Daylight factor per point | Geometric proxy from view of the roof opening and distance from the facade | **Run a Honeybee daylight-factor grid on GF and 5F? Is DF the daylight metric you want, or sDA/UDI?** | open |

## EnergyPlus

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A16 | Hourly atrium operative temperature per scenario | DEMO daily curve, scaled so its K·h matches each scenario's score  [ANSWER: Rhino session reports every sweep run (3,125 + 40 validation) stores 168 hourly operative temperatures for the hot week. Real scenario series requested from it; not yet received.] | **Paste the Rhino session's report so I can replace the demo curves with the real hourly series.** | partial |

## Climate

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A17 | TM52 running-mean outdoor temperature | DEMO values 17.5–21.2 °C per day | **Compute from the 2050 EPW (needs the days before 14 June too)** | open |

## Physics

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A18 | Warm air rising (stratification) | 0 K per metre (off); slider in the app | **Do you want a gradient on? What value, and from what source (mentor, CIBSE guide, measured)?** | open |
| A19 | Enclosed rooms' air temperature | Same as the atrium + 0 K; slider in the app | **Enclosed rooms are not simulated. Accept the atrium temperature as a stand-in, or simulate them as their own zones?** | open |

## Method

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A20 | Calibration to EnergyPlus | Point corrections are re-centred so the GF atrium floor averages back to the EnergyPlus score | **Happy with this as the honesty check?** | open |
| A21 | TM52 category | Category II (+3 K), one week only, a stress test, not compliance | **Right category for a university building?** | open |
| A22 | Hotspot thresholds | Overheating > 42 K·h (the PASS band, per point); DF < 2%; sun > 20 h | **Which thresholds make sense for your audience?** | open |

## Scenarios

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A23 | Scenario list and multipliers | 7 scenarios taken from The Heat Ledger; screens and frit scale roof sun linearly. 'g 0.2 + night purge' score of 40 K·h is a placeholder (the guide says it passes, gives no number) | **Which interventions do you want on the menu? Can you get the real scores for each from the sweep?** | open |

## Ledger

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A24 | Cost, embodied carbon, winter loss per scenario | Blank ('needs input') except where The Heat Ledger gives a number | **Where do cost and carbon rates come from (SPON's, ICE database, our own assumptions)?** | open |

## Brief

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A25 | Audience and question | Two lenses: ARCHITECT ('Where does the heat arrive on each floor, what decides it, and what does fixing it cost the daylight?') and DEVELOPER / ESTATES MANAGER ('Which parts of GF and 5F fail, how much floor area is that, and which intervention fixes the most for the money?'). Wording is mine.  [ANSWER: You want spots (heat map) rather than room rankings, as areas not rooms.] | **Are those the right two questions? Is 'developer' and 'estates manager' one lens or two? Which lens opens first on the day, and which one do you present?** | partial |
| A26 | Floor names | 'GF' and '5F' as you said  [ANSWER: You said 5F is the highest floor of the atrium building; I have asked the Rhino session to confirm the level.] | **Confirm 5F's finished floor level in mm, and that it is below the atrium roof glass.** | partial |
| A27 | What the developer / estates lens measures | Floor area (m²) over the hotspot threshold and failing TM52, per intervention, plus cost and carbon where known. No rent, lettable-area or occupancy data. | **What does a developer or estates manager actually decide on? Usable or lettable area lost? Cost per m² fixed? Compliance? Do you have occupancy or rent figures per zone?** | open |
| A28 | Score bands applied to single points | The atrium's PASS ≤ 42 / MARGINAL ≤ 150 / OVERHEATING ≤ 400 K·h bands are applied to each grid point's K·h to total floor area per band | **Is it fair to grade a point on the atrium's bands, or does the estates lens need a different test (e.g. TM52, or % of occupied hours above 26 °C)?** | open |
| A29 | The Heat Ledger guide's numbers | The 7 scenarios and their scores (122, 35, 155, 192, 225, TM52 counts) come from the guide 'The heat ledger'. The Rhino session found that the files the guide cites (mechanisms.js, design_catalogue.json, TM52 outputs) are NOT in your 4_Atrium_Heat_Lab folder, so the guide may describe a newer version of the pack. | **Where did 'The heat ledger' come from (organisers, another team, a Miro board)? Until the Rhino session checks sweep.json, treat its scores and the frit / panel / TM52 figures as unverified.** | open |
| A30 | No composite space score | Team decision: no overall quality grade per space; headline is overheating and its reduction vs existing. Hotspot view = count of flags. My reading of a garbled voice transcript. | **Is that right? Is 'cardio space' the atrium? Should the estates lens still rank interventions by floor area fixed?** | open |

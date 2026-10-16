# Assumptions and placeholders

Every guess the Floorplate Heat Map makes is listed here. The app shows the same list.

**How to answer:** reply with the ID and your answer (e.g. `A04: 5F is at +17,500 mm, below the roof`).
I'll update `app/data/assumptions.json`, mark the item answered, and change the code or data.

Open: **26** of 32


## Geometry

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A01 | GF and 5F floorplate outlines | GF is the EnergyPlus atrium floor (38.35 × 26.35 m, from the official model). 5F reuses that footprint as a 4 m open gallery ring around a void. No other floor-plate geometry yet. | **Can you give me the real GF and 5F floor-plate outlines from the Rhino model (the Rhino session was asked to extract them)? Is the atrium footprint really this rectangle?** | partial |
| A02 | Analysis grid | 1 m grid (988 points per floor), sensors 1.1 m above the floor, seated. | **Is 1,000 mm fine enough? Should sensors be seated (1,100) or standing (1,500)?** | open |
| A03 | Atrium void footprint | 5F void = the atrium footprint inset by a 4 m gallery on every side. Real galleries are probably not a uniform ring. | **What is the real void outline on 5F, and how wide are the galleries?** | open |
| A04 | 5F floor level | 5F at +16.0 m. The E+ atrium walls reach 19.35 m and the roof ridge is at 22.97 m, so the upper floor sits 3.35 m below the clerestory base. | **What is the 5F finished floor level, and is it inside the atrium volume?** | open |

## Zoning

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A05 | Enclosed / open / void zoning | Only open and void exist in the data. No enclosed rooms yet, because the E+ model has none and the Rhino floor plans are not in. | **Can you mark enclosed rooms on the real plans (layers ZONE::Enclosed / ZONE::Void)? How do you define 'enclosed'?** | open |

## Glazing

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A06 | Roof glazing solar transmittance | Roof and clerestory glass transmit the beam at 0.85 × g. At g 0.6 that is 0.51. The app scales all sun data by g/0.6; the roof screen scales roof sun by (1 − opacity). | **Use the official model's roof g-value, or a measured product value?** | open |
| A07 | Perimeter facade windows | Not modelled. Sun reaches points only through the atrium's own roof, clerestory and gable glass (the glazing EnergyPlus models). Sun through the building's outer facades into rooms is missing. | **Do you want perimeter-room sun? It needs the real window positions and the floor plates.** | open |
| A08 | Facade windows into galleries and rooms | Not modelled, as A07. | **Same as A07.** | open |

## Context

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A09 | Shading from neighbours | The 188 shading surfaces of the official EnergyPlus model are used for every ray. The guide says only 8 of 99 neighbours rise above the clerestory, so context barely matters for the atrium. | **Do you want the full city mesh (context.json) too, or is the official model's shading enough?** | answered |

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
| A14 | Sun and weather | REAL. Hourly dry-bulb, direct normal and global radiation from the organisers' 2050 crude-morph weather file for 14-20 June; sun position computed for Manchester Airport (53.354 N, 2.275 W). Diffuse = global − direct × sin(altitude). | **Nothing needed, unless you want a different weather year.** | answered |

## Daylight

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A15 | Daylight factor per point | Per-point daylight factor = share of the sky seen through the glass × glass transmittance × 0.75 frame × 0.8 maintenance. Same constants as the starter app's average DF, but per point. Not Radiance: no glare, no sun patches. | **Run a Honeybee/Radiance daylight grid on GF and 5F? Is DF the right daylight metric (vs sDA/UDI)?** | open |

## EnergyPlus

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A16 | Hourly atrium operative temperature per scenario | REAL. All 3,125 runs (and 40 off-grid runs) store 168 hourly operative temperatures. Any design's hourly series is interpolated from them. Stored to 0.25 °C, so a series can differ from the exact score by under 1 K·h. | **Nothing needed.** | answered |

## Climate

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A17 | TM52 running-mean outdoor temperature | REAL. Running-mean outdoor temperature from the 2050 weather file (alpha 0.8), 17-22 °C across the week. | **Nothing needed.** | answered |

## Physics

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A18 | Warm air rising (stratification) | 0 K per metre (off), slider in the app. The upper floor sits near the roof glass, so real stratification would make it hotter than shown. | **Should it be on by default? What value, and from what source?** | open |
| A19 | Enclosed rooms' air temperature | No enclosed rooms yet (A05). When there are, they take the atrium temperature + this offset (0 K). | **Enclosed rooms are not simulated. Accept the atrium temperature as a stand-in, or simulate them as their own zones?** | open |

## Method

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A20 | Calibration to EnergyPlus | Point corrections are re-centred so the GF atrium floor averages back to the EnergyPlus score | **Happy with this as the honesty check?** | open |
| A21 | TM52 category | Category II (+3 K), one week only, a stress test, not compliance | **Right category for a university building?** | open |
| A22 | Hotspot thresholds | Overheating > 42 K·h (the PASS band, per point); DF < 2%; sun > 20 h | **Which thresholds make sense for your audience?** | open |

## Scenarios

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A23 | Interventions on the menu | 11 presets, all real EnergyPlus grid designs (roof screens, low-g glass, night purge, day ventilation, one combination) plus the lowest-score design that keeps daylight ≥ 5%. You can also move all five levers. NOT offered yet: PV frit, replacing roof glass with panels, fans, internal blinds, more thermal mass (the starter calls these approximations or needs new simulation). | **Which interventions beyond the five levers should we add as labelled approximations?** | open |

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
| A28 | Score bands applied to single points (superseded) | Superseded by the grade classes (A30). | **Is it fair to grade a point on the atrium's bands, or does the estates lens need a different test (e.g. TM52, or % of occupied hours above 26 °C)?** | answered |
| A29 | Where 'The heat ledger' came from | ANSWERED. It documents the newer Atrium Heat Lab pack (the zip). We checked its numbers against the sweep: 1,041 designs pass, 241 pass TM52, 248 pass with daylight ≥ 5%, 9 pass unshaded-roof, outdoor air scores 46.8, U-value effect −232.6 vs −5.9. All reproduce. Your local 4_Atrium_Heat_Lab folder is the older pack without mechanisms.js and the catalogue. | **Nothing needed. Use the newer pack (now in starter/).** | answered |
| A30 | Composite grade / class for spots | Team decision (corrected): there IS a grade, built from whichever parameters the user switches on, with editable weights and good/bad limits. Defaults: overheating K·h (weight 3) + TM52 fails (weight 1) on; daylight etc. off. Classes Good / Fair / Poor / Critical at 15 / 40 / 70 out of 100. | **Which parameters should count by default for each lens? What weights? What counts as 'good' and 'bad' for each (limits)? Should the class names be A-D, or Good-Critical?** | open |

## Geometry

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A31 | The atrium box is the official model's, not the Rhino atrium | Rays are cast against the 11 faces EnergyPlus uses (walls opaque, roof/clerestory/gables fully glazed). The real building's glazing, galleries and interior surfaces differ in detail. | **Run tools/export_atrium_geometry.py in Rhino to export the real atrium faces, and I will cast rays against those instead.** | open |

## Comfort model

| ID | What | Placeholder in use | Question for you | Status |
|---|---|---|---|---|
| A32 | Sun-on-a-person estimate | Simplified SolarCal (ASHRAE 55) with a fixed seated projected-area factor of 0.25. 'Sun hours' count hours with direct beam ≥ 120 W/m². Wall and floor surface temperatures are not modelled. | **Is a posture-independent estimate acceptable, or do you want the full Ladybug SolarCal component on the real grid?** | open |

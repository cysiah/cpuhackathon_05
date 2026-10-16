# Analyses and interventions: what the current model can answer

_Generated from `data/design_catalogue.json` by `tools/build_docs.py`. Edit the JSON, not this file._

| Label | Meaning | Items |
|---|---|---|
| Analysable now | Answered by the simulated sweep | 6 |
| Partial | Exact method, limited by the data | 3 |
| Approximation | Simple physics on existing results, labelled in the app | 14 |
| Needs new simulation | Needs a new simulation or data (kept on the list) | 9 |

Mechanisms live in `js/mechanisms.js` and show in the app under **Diagnose** and as extra metrics.

## Analyses

| Analysis | Question | Now | Mechanism in the app | Limits / what it needs | Full route | Priority |
|---|---|---|---|---|---|---|
| **Hourly heat balance of the atrium** | Is overheating driven by solar gain, too little ventilation, or concrete that never cools at night - and at which hours? | Approximation | Weekly balance rebuilt from results: solar = EnergyPlus, gains = model input, ventilation and glass conduction from hourly operative vs outdoor, remainder = thermal mass + error (H.heatBalance) | Operative stands in for air temperature; opaque panels ignored; weekly totals only. Exact per-flow values need the E+ outputs listed above. | EnergyPlus sweep | 1 |
| **Transmitted solar per glazing element** | Which part of the roof or clerestory lets in most heat - where should shading go first? | Approximation | EnergyPlus transmitted solar split by each element's share of Ladybug hot-week incident radiation (H.solarByElement) | Same g on every element; angle-dependent transmittance ignored. Exact split needs per-aperture E+ output. | EnergyPlus sweep | 1 |
| **CIBSE TM52 adaptive overheating criteria** | Does the design pass the UK standard test (hours of exceedance, daily weighted exceedance, upper limit)? | Partial | All three TM52 criteria from EnergyPlus hourly operative, Category II, running mean from the 2050 file (H.tm52; metric "TM52 criteria failed") | Hot week only; criterion 1 is defined over May–September, so this is a stress test, not a compliance result. | in the app (JS) | 1 |
| **Wind- and stack-driven airflow** | Can real openings deliver the assumed air-change rates on a still, hot afternoon? | Approximation | Hourly stack flow through an assumed installed free area vs the design ACH (H.stackAch; metric "Hours stack vents meet day ACH"), plus the existing vent-area proxy | Stack only, no wind; uses temperatures from the fixed-ACH run, not coupled. Free area is an editable assumption. | EnergyPlus sweep | 1 |
| **Night cooling of the thermal mass** | Does the concrete actually cool overnight, or is night ventilation wasted? | Partial | Operative before opening and overnight drop from EnergyPlus hourly results (H.nightFlush; metric "Atrium before opening") | Concrete surface temperatures are not exported, so operative is used. | EnergyPlus sweep | 2 |
| **Whole cooling season instead of one heatwave week** | Does a design that survives the peak week still overheat across the summer? | Needs new simulation | – | E+ results cover one week. Needs a longer RunPeriod in sweep_atrium.py (climate.json already has 8760 h outdoor data). | EnergyPlus sweep | 2 |
| **Several weather files and climate projections** | Is the best design still best in other years and under real 2050/2080 projections? | Needs new simulation | – | One weather file in the sweep. Needs re-running with more EPWs. | EnergyPlus sweep | 2 |
| **Vertical temperature stratification** | How much hotter are the upper galleries than the well-mixed average? | Needs new simulation | – | Single well-mixed zone; no data on vertical gradients. Needs stacked zones or CFD. | EnergyPlus sweep | 2 |
| **Spatial daylight and glare** | Which shading designs keep the atrium usefully daylit without glare or sun patches? | Approximation | Existing BRE average daylight factor proxy | No glare, sun patches or spatial distribution. Needs Radiance. | other engine | 2 |
| **Winter heating including lost solar gain** | How much winter benefit does low-g glazing or a fixed screen give away? | Approximation | Conduction loss minus useful solar: Ladybug annual incident on the atrium glass × share falling in heating hours × g × frame × utilisation (H.winterSolar; metric "Winter glass loss − useful solar") | Present-day temperatures, screen retracted, utilisation factor is an assumption. | in the app (JS) | 2 |
| **Capital cost and embodied carbon** | What does each intervention cost in money and kgCO2e? | Partial | Quantities from the design × rates in this file (H.costCarbon) | Mechanism ready; every rate is null until sourced, so the app says which rates are missing. | in the app (JS) | 2 |
| **Comfort with elevated air speed** | How many degrees of relief do fans or cross-flow give occupants? | Approximation | ASHRAE 55 elevated-air-speed allowance subtracted from occupied-hour operative (H.fanCooling) | Assumes fans reach every occupant; fan energy not counted. | in the app (JS) | 3 |
| **Fan, cooling and electric-lighting energy** | What does each intervention cost to run? | Approximation | Cooling to hold 26 °C = (ventilation + glass conductance) × excess (H.coolingNeed); night-purge fan energy = SFP × flow × hours (H.nightFanKwh) | Steady state, ignores thermal mass; lighting energy not covered. | EnergyPlus sweep | 3 |
| **Heat exchange with the surrounding building** | Does the atrium dump heat into, or receive heat from, the galleries and offices? | Needs new simulation | – | Walls are adiabatic in the E+ model. Needs adjacent zones or boundary temperatures. | EnergyPlus sweep | 3 |


## Interventions

| Intervention | Lever | Range | Now | Mechanism in the app | Limits | Cost / carbon rate |
|---|---|---|---|---|---|---|
| **Lower solar transmittance glazing (solar control)** | `g` | 0.2–0.7 - | Analysable now | Sweep lever, EnergyPlus results | Grid 0.2–0.7; interpolated between levels with measured error. | not sourced |
| **Glazing thermal transmittance** | `u` | 1.0–5.8 W/m2K | Analysable now | Sweep lever, EnergyPlus results | Grid 1.0–5.8 W/m²K. | not sourced |
| **Daytime ventilation rate** | `ach_day` | 1–10 ACH | Analysable now | Sweep lever, EnergyPlus results | Fixed rate; achievability checked by the stack metric. | not sourced |
| **Night purge ventilation** | `ach_night` | 0–10 ACH | Analysable now | Sweep lever, EnergyPlus results; fan energy if mechanical (proxy) | Fixed rate, no temperature control of the openings. | not sourced |
| **Static external roof screen** | `screen_opacity` | 0–0.9 fraction blocked | Analysable now | Sweep lever, EnergyPlus results | Static, uniform plane. | not sourced |
| **Controlled or moving external roof shading** | `shade_trigger_w_m2` | 100–400 W/m2 on the roof | Approximation | In hours with sun above the trigger, the operative temperature of the screened design is used; daylight reduced by the share of daylight hours deployed | Ignores heat stored before deployment and control lag. | not sourced |
| **Internal roof blinds** | `blind_reflectance` | 0.3–0.8 - | Needs new simulation | – | Inside the glass: needs WindowShadingControl in E+. | not sourced |
| **Reduce glazing on the south roof slope (opaque or insulated panels)** | `rs_glazing_fraction` | 0.3–1.0 fraction of current RS glazing | Approximation | Mapped to an equivalent g using the south slope's share of incident solar (53%), then the sweep is interpolated | Conduction change through new opaque panels ignored; clamped at the lowest simulated g. | not sourced |
| **Fritted or PV-integrated roof glazing** | `frit_coverage` | 0–0.6 fraction | Approximation | Equivalent g as above, plus PV yield = annual incident on roof glass × coverage × yield factor | Frit treated as opaque; PV temperature losses and wiring not modelled. | not sourced |
| **Openable vent area and height (high- and low-level)** | `vent_area_m2` | 5–60 m2 free area | Approximation | Installed free area (editable assumption) drives the stack metric | Does not change the simulated temperatures; wind ignored. | not sourced |
| **Fan-assisted night purge** | `purge_fan_ach` | 2–8 ACH | Analysable now | Thermal effect = ach_night sweep lever; fan energy = proxy metric | No minimum outdoor temperature control. | not sourced |
| **More exposed thermal mass** | `mass_m2` | 500–3000 m2 exposed concrete | Needs new simulation | – | Mass is fixed at 1000 m² in every run. Needs MASS_M2 as a sweep lever. | not sourced |
| **Phase-change material panels** | `pcm_m2` | 0–1000 m2 | Needs new simulation | – | Needs the finite-difference heat balance in E+. | not sourced |
| **High-reflectance opaque roof finish** | `roof_solar_absorptance` | 0.2–0.8 - | Needs new simulation | – | Opaque panel absorptance is fixed in every run. | not sourced |
| **Reduce internal gains (LED, equipment)** | `q_int_w_m2` | 2–10 W/m2 | Approximation | Steady-state shift of occupied-hour temperature = Δgains / (ventilation + glass conductance) | No thermal mass, so an upper bound. | not sourced |
| **Ceiling or high-volume low-speed fans** | `air_speed_m_s` | 0.1–1.0 m/s | Approximation | Comfort allowance from air speed (see comfort_air_speed) | Fan energy and coverage not modelled. | not sourced |
| **Mechanical or evaporative cooling (last resort)** | `cooling_setpoint_c` | 24–28 C | Approximation | Cooling-to-26 °C proxy metric | Steady state; no system efficiency. | not sourced |
| **Move occupation away from the hottest zones** | – | – | Needs new simulation | – | Needs stratification results. | not sourced |


The brief rules out moving louvres: `dynamic_external_shading` is listed for completeness only.

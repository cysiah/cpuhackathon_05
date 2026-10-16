# Context carried over from the "Claude in Rhino" chat

Imported 2026-10-16 from the Claude Code session "Claude in Rhino" (last activity 09:16, 16 Oct).
That session had already absorbed the earlier "CPU Hackathon brainstorm" chat.

**Status at handoff:** Heat Headroom idea is **parked**. The team is brainstorming a **new tool from scratch** for Track 01. Recommended direction: concept **A + B** (see §6). Nothing new has been built yet.

---

## 1. The event

- **Forecast Factory X hackathon**, 16 Oct 2026. **Team 05, Track 01 (App)**, mentor **Agnieszka Thiel**.
- Context: [CPU]ai atelier, MArch 2 at MSA, 2026–27. A single whole-year project at Trafford Wharf, using knowledge graphs and AI.
- **Focus: overheating.**
- Scope agreed with the user:
  - whole-building diagnosis for Track 1
  - the atrium for the official score (and Track 2)
  - context what-if scenarios (existing, removed or future towers) as a tool feature
- Hand-drawn façade zones from the user's earlier semester-2 façade script are **not** relevant to this tool.

### Track 01 rules (from Track01_Guide.pdf)
- Build an **instrument, not a design**. Pick an **audience** and a **single question**.
- Deliverables:
  - the running app
  - a code zip in `3_Team_Work`
  - a backup video
  - a 3-minute talk
- Prizes: Best Overall, Best Track 01, Best Failure.
- The central model is opened **via RhinoSync only** (Collaborate > Google Drive).
- Practical habits: upload a code zip to `3_Team_Work` about every 30 min. Record a backup screen video by 16:15. Test with an outsider before 15:00.

## 2. Official score

- Model: Honeybee/EnergyPlus **single-zone atrium**.
- Metric: occupied (08–18) degree-hours above **26 °C operative**, over the hot week (14–20 June) of a crude 2050 climate morph.
- Bands: **PASS ≤ 42**, **MARGINAL ≤ 150**, **OVERHEATING ≤ 400**.
- Baseline:

  | | Score (K·h) |
  |---|---|
  | EnergyPlus | **320.6** |
  | Screening | 423.1 |

  EVAL ID **EC2F526D**, reproduced on the user's machine.
- Climate morph:
  - +1.5 °C on every hour
  - +0.5 °C extra at night
  - +4 °C heatwave pulse
- Outdoor-air floor:

  | Weather file | Floor (K·h) |
  |---|---|
  | Today | 3 |
  | 2050 | **46.8** |

  An earlier figure of 50.5 was a one-hour offset error and has been corrected.

### Starter Grasshopper script
- FF components:
  - Climate Morph
  - Heat Exposure
  - Envelope Loader
  - Overheat Score (screening)
  - Atrium EnergyPlus (official)
  - Evaluation ID
- The EnergyPlus atrium is a **fixed box in code**:
  - shading only counts above **19.35 m**
  - visible transmittance is fixed at 0.7
- Only **8 of 99** neighbouring buildings rise above 19.35 m, so context barely changes the atrium score.

## 3. Starter pack

Location: `G:\Other computers\DESKTOP\MMU M.ARCH\05 - Y2S1\01 - AE\08_PRESENTATION\01 - CPU HACKATHON 261016\01_REFERENCE RESOURCES\Team_05 _ Track_01-App _ Mentor-Agnieszka Thiel\`

- `1_READ_ME`: READ ME FIRST.txt and Track01_Guide.pdf (10 pages).
- `2_Setup_DOWNLOAD_ME` / `setup_check.py`:
  - read-only, apart from copying weather files and writing `setup_report.txt`
  - the user's machine is expected to pass
  - Rhino is 8.22 while the baseline used SR34, which the script doesn't check
- `3_Team_Work`: the 3dm, identical to the earlier copy.
- `4_Atrium_Heat_Lab`: the organisers' example web app (see §4).
- Working copy: `…\05_3D\02 - HEAT HEADROOM\Atrium_Heat_Lab_T05`, an unmodified copy of 4_Atrium_Heat_Lab.

## 4. Atrium Heat Lab (organisers' example), how it works

- **Sweep:**
  - 3,125-run full-factorial EnergyPlus sweep: 5 levels each of g, U, ach_day, ach_night and screen_opacity
  - 40 off-grid validation runs: about ±4.8 K·h typical error, 20.4 worst
- **Surrogate:** multilinear interpolation over 32 corners.
- **Proxies:**
  - BRE daylight factor with lsg 1.3, about 32% at baseline
  - winter loss = U × A × HDH
  - stack vent area of about 20 m² at 4 ACH
- **Views:** Pareto front, tornado and main effects, interaction checks. Example: changing U-value removes 232.6 K·h unshaded but only 5.9 behind a 90% screen.
- **Findings:**
  - 1,041 designs pass
  - best score 2.9 K·h, at about 1% daylight
  - 248 pass with daylight ≥ 5%
  - 9 pass without a screen
  - night ventilation from 1 to 10 ACH takes the baseline from 320.6 to 224.8
- **Files:**
  - `index.html`
  - `js/model.js` for the maths
  - `js/app.js` for the views
  - `tools/sweep_atrium.py`, with `--quick` (32 designs, about 1 min) and `--workers`
  - `tools/export_from_grasshopper.py` (run in Rhino)
  - `tools/build_demo.py`, which writes a single-file `demo/index.html`
  - `data/*.json`, including `radiation.json`: 5,531 faces, each tagged roof, atrium roof or façade by direction
- **Stack:** Chart.js 4.4.1 and three.js r128 from CDNs. Static site: `python -m http.server 8000`. Opening index.html directly fails, because browsers block the data loading.
- **Gaps (where an original tool can win):**
  - no help choosing among the 1,041 passing designs
  - no spatial or "where" mapping
  - no cost or carbon
  - no uncertainty beyond interpolation error
  - no named audience

## 5. Outputs already made

- **Artifact deck** "Forecast Factory X: Team Plan" (Heat Headroom framing, 17 slides, v19): https://claude.ai/artifact/D1mEjP87bFe1Ui3UTfeb5r
- **Canva deck** "CPU Hackathon_Team05", 15 pages, "Atrium Heat Lab, explained" (saved): https://www.canva.com/d/KwnH_CGJohCMamC
  - Covers what the tool is for, how it was built (GH script, data export, the sweep, the web app files), the surrogate and proxies, Pareto and sensitivity, how it is used, what the data shows, limits, how to make it ours, and how to deploy.
  - Style:
    - dark `#1B1F2A`, light `#F6F3EE`
    - accent `#B83A14` / `#F2B48F`
    - card accents `#2F6FB0`, `#E4572E`

## 6. Latest brainstorm: building the tool from scratch

### What the brief will check

| Brief says | What judges look for |
|---|---|
| **Where** the opportunities are | A map on the building, not just sliders |
| **For whom** | One named audience and the decision it supports |
| **How big** | Each opportunity sized in K·h removed |
| **Trade-offs** | Overheating vs daylight, winter heat, vent openings, cost or carbon, with at least one axis the starter lacks |
| Where numbers come from, how wrong | Every number labelled as EnergyPlus, interpolated, estimated or assumed, with a measured error |
| Instrument, not design | It ranks and compares options; it never presents one answer |
| Method, innovation, search | A real search (optimisation under limits), not "move a slider" |

### Hard constraint
The official EnergyPlus model is **one well-mixed box**, so it cannot say *where* in the atrium it overheats. Spatial detail has to come from Ladybug radiation on the envelope:

> radiation on each surface × score sensitivity to that heat (from the sweep) = estimated K·h attributable to that surface

That product is an **estimate**: label it as one, and check it against a few real EnergyPlus runs.

### Concepts
- **A. Opportunity Map: "where is the overheating coming from?"**
  - Audience: design team.
  - Shows each roof panel and façade zone coloured by the K·h it causes.
  - Ranks the surfaces and shows diminishing returns.
- **B. First-£ Planner: "what should estates fund first?"**
  - Audience: estates manager.
  - Uses the levers plus *assumed, editable* cost and embodied-carbon figures.
  - Runs a budget-constrained search for the most K·h removed, with daylight held at or above a minimum.
  - Output: a score / cost / carbon front.
- **C. Peak Hour Autopsy: "why does it hit 40.5 °C?"**
  - Hourly heat-balance breakdown.
  - Needs new EnergyPlus outputs, so it is the highest risk.
- **D. Context What-if.**
  - Only 8 of 99 neighbours rise above the roof line, so context barely matters.
  - Best used as a supporting finding inside A ("context isn't your lever; the roof is").

### Recommendation: A + B as one tool
- **Audience:** MMU estates manager.
- **Question:** "Where should we intervene first, and what does each step cost in daylight, winter heat, money and carbon?"
- **Flow:**
  1. **Map:** where the heat comes in.
  2. **Menu:** each intervention with K·h removed, cost and carbon, each labelled by source.
  3. **Search:** budget slider, best combination, score/cost/carbon front.
  4. **Honesty panel:** measured error, plus what isn't modelled.
- **Reuse the 3,125 EnergyPlus runs and exported data.** A new question, UI, analysis and search on top of them is still "from scratch". Only re-run EnergyPlus for a lever the sweep lacks (e.g. partial roof shading or operable vent area), and use `--quick` first.

### Team decisions for the first 30 minutes
1. Who is the audience, and what single question are we answering for them?
2. Which axis do we add: cost, carbon or both? Where do the figures come from?
3. How fine is "where": individual roof panels, or roof/façade by orientation?
4. Which search: exhaustive over the grid, or optimisation under a budget?
5. Who is the outside tester, and when do we test (before 15:00)?

**Next offered step:** turn the chosen concept into a build plan mapped to the day's checkpoints, with roles for each member.

## 7. Tooling notes (user's Windows machine)

- **Rhino MCP:** RhinoAiMCP at `http://127.0.0.1:3001/mcp/` (trailing slash required).
  - It can be called directly over JSON-RPC when the MCP tools drop.
  - When Rhino is closed, `GH_IO.dll` can read `.gh` files via PowerShell `Add-Type`.
- **Ladybug Tools:** reinstalled via the Pollination installer. EnergyPlus runs and the EVAL ID matches.
- Units: **mm and degrees**.
- **Do not** resume Heat Headroom scripts unless the user asks.

# cpuhackathon_05

Team 05, Forecast Factory X hackathon (16 Oct 2026). The topic is overheating at Trafford Wharf.

## Focus: Track 01 (App)

The work here is for **Track 01**: build an **instrument, not a design**. The tool has **two lenses** on the same data: **Architect** (where does heat arrive, what decides it, what does it cost daylight) and **Developer / estates manager** (which floor area fails, which intervention fixes the most for the money). Wording is a placeholder, see A25 in `ASSUMPTIONS.md`.

Deliverables:
- the running app
- a code zip in `3_Team_Work`
- a backup video
- a 3-minute talk

- Treat Track 2 as out of scope unless asked.
- The atrium EnergyPlus score (baseline 320.6 K·h) is a reference and calibration point, not the goal.
- The goal is a whole-building diagnosis tool.

## Team decisions (16 Oct, from the team discussion)

- Two jobs in one tool: (1) evaluate the **existing** condition on GF and the top floor (5F); (2) check **proposed interventions** against that benchmark ("how far, how good are we doing").
- The headline is **overheating and how much the proposal lowers it**.
- **There IS a composite grade / class for spaces (spots and areas), but it is open-ended.** The user chooses which parameters count, their weights and their good/bad limits; adding a parameter changes the grade. No fixed formula can cover every factor (material, glazing ratio...), so the grade is always shown with what went into it. The hotspot view is only a count of flags.
- The tool is **open-ended**: new parameters and data can be added later. Prefer data-driven layers over hard-coded ones.
- The two lenses (architect vs developer / estates manager) care about different things. Spots and areas, not rooms.

## Current direction (being explored)

Floor-plan heatmaps on **isolated GF and 5F floorplates** (not the single atrium box). The areas will later be classified as **enclosed, open or void**. Parameter layers you can cross-reference:
- sun hours
- radiation
- overheating K·h per point (EnergyPlus air temperature + Ladybug solar MRT)
- daylight
- where people dwell

The app is modelled on the structure of the organisers' Atrium Heat Lab: Grasshopper export, then JSON, then a static web app.

## Background

`docs/CONTEXT_FROM_RHINO_CHAT.md` holds the full background: the brief, the official score, the starter pack and the Heat Lab analysis.

## Rules

- Heat Headroom is parked; don't resume it unless asked.
- Units: mm and degrees.
- Label every number by source: EnergyPlus, interpolated, estimated or assumed.

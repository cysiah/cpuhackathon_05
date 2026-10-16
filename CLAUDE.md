# cpuhackathon_05

Team 05, Forecast Factory X hackathon (16 Oct 2026). The topic is overheating at Trafford Wharf.

## Focus: Track 01 (App)

The work here is for **Track 01**: build an **instrument, not a design**, with one audience and one question.

Deliverables:
- the running app
- a code zip in `3_Team_Work`
- a backup video
- a 3-minute talk

- Treat Track 2 as out of scope unless asked.
- The atrium EnergyPlus score (baseline 320.6 K·h) is a reference and calibration point, not the goal.
- The goal is a whole-building diagnosis tool.

## Current direction (being explored)

Floor-plan heatmaps on the GF and 3F planes, with multiple parameter layers you can cross-reference:
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

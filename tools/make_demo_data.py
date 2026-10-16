"""Write PLACEHOLDER data for the Floorplate Heat Map app.

Everything this script writes is synthetic DEMO data with the same format the
real Grasshopper export will produce (see tools/gh_export_floorplate.py). It
exists so the app can be built and tested before the real floorplates arrive.
Each guess is tagged with an assumption ID from ASSUMPTIONS.md.

    python3 tools/make_demo_data.py
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from solarcal import delta_mrt, solar_position  # noqa: E402

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "data")

# ---------------------------------------------------------------- geometry (mm)
PLATE_W, PLATE_D = 48000, 30000           # A01 floorplate outline
GRID = 1000                               # A02 grid spacing
WORK_H = 1100                             # sensor height above floor
VOID = (15000, 9000, 33000, 21000)        # A03 atrium void footprint x0,y0,x1,y1
ROOF_Z = 19350                            # official model: atrium roof height
LEVELS = {"GF": 0, "5F": 16000}           # A04 5F floor level is a guess
NORTH_ANGLE = 60.9                        # true north, degrees anticlockwise from +Y
LAT = 53.47                               # Manchester

ENCLOSED = [(0, 24000, 48000, 30000), (42000, 0, 48000, 24000)]   # A05 enclosed rooms

TAU_ROOF = 0.55      # A06 roof glazing solar transmittance (g 0.6 baseline)
TAU_FACADE = 0.50    # A07 facade glazing solar transmittance
WWR = 0.40           # A08 facade window-to-wall ratio
WIN_HEAD = 2700      # A08 window head height above floor
GF_CONTEXT = 0.5     # A09 share of sun on GF facades not blocked by neighbours

DAYS = list(range(165, 172))     # 14-20 June
HOURS = list(range(8, 18))       # occupied 08:00-18:00, hour starting


def inside(x, y, r):
    return r[0] <= x < r[2] and r[1] <= y < r[3]


def model_dir(az_deg):
    """Unit vector in model XY pointing towards a compass azimuth."""
    theta = math.radians(90.0 + NORTH_ANGLE - az_deg)
    return math.cos(theta), math.sin(theta)


def irradiance(alt, day_i):
    """DEMO clear-ish sky. A14: replace with the morphed EPW hot week."""
    if alt <= 0:
        return 0.0, 0.0
    cloud = [1.0, 1.0, 0.9, 1.0, 1.0, 0.95, 1.0][day_i]
    dni = 850.0 * (1 - math.exp(-alt / 15.0)) * cloud
    dhi = 90.0 + 60.0 * math.sin(math.radians(alt))
    return dni, dhi


def roof_view_factor(x, y, z_floor):
    """Sky view through the atrium roof opening from a seated person (numeric)."""
    h = (ROOF_Z - z_floor - WORK_H) / 1000.0
    if h <= 0:
        return 0.0
    vf, step = 0.0, 1000
    for cx in range(VOID[0] + step // 2, VOID[2], step):
        for cy in range(VOID[1] + step // 2, VOID[3], step):
            dx, dy = (cx - x) / 1000.0, (cy - y) / 1000.0
            r2 = dx * dx + dy * dy + h * h
            vf += h * h / (math.pi * r2 * r2)
    return min(vf, 1.0)


def facades(x, y):
    """(depth_mm, outward normal) for each facade, for a point on the plate."""
    return [
        (y, (0.0, -1.0)),
        (PLATE_D - y, (0.0, 1.0)),
        (x, (-1.0, 0.0)),
        (PLATE_W - x, (1.0, 0.0)),
    ]


def build_floor(fid):
    z = LEVELS[fid]
    xs, ys, zone, svf, sun_h, atrium = [], [], [], [], [], []
    rad_roof, rad_fac, df_roof, df_fac = [], [], [], []
    dmrt_roof, dmrt_fac = [], []
    for j in range(PLATE_D // GRID):
        for i in range(PLATE_W // GRID):
            x, y = i * GRID + GRID // 2, j * GRID + GRID // 2
            in_void = inside(x, y, VOID)
            if fid != "GF" and in_void:
                ztype = 2          # void: no floor here
            elif any(inside(x, y, r) for r in ENCLOSED):
                ztype = 0          # enclosed
            else:
                ztype = 1          # open
            roof_lit = fid == "GF" and in_void
            vf_roof = roof_view_factor(x, y, z) if roof_lit else 0.0
            near = min(facades(x, y), key=lambda f: f[0])
            vf_fac = 0.25 * math.exp(-near[0] / 2500.0) if ztype != 2 else 0.0
            ctx = GF_CONTEXT if fid == "GF" else 1.0

            hrs_sun, rr, rf = 0, 0.0, 0.0
            for di, doy in enumerate(DAYS):
                for h in HOURS:
                    alt, az = solar_position(LAT, doy, h + 0.5 - 1.15)   # BST, 2.25 W
                    dni, dhi = irradiance(alt, di)
                    sx, sy = model_dir(az)
                    # roof: is the shifted roof opening above this point?
                    vis_r = 0
                    if roof_lit and alt > 0:
                        run = (ROOF_Z - z - WORK_H) / math.tan(math.radians(alt))
                        vis_r = 1 if inside(x + sx * run, y + sy * run, VOID) else 0
                    # facade: sun in front of the nearest facade and deep enough
                    vis_f = 0.0
                    if ztype != 2 and alt > 0:
                        depth, n = near
                        facing = sx * n[0] + sy * n[1]
                        if facing > 0:
                            reach = (WIN_HEAD - 600) / math.tan(math.radians(alt)) * facing
                            if depth <= reach:
                                vis_f = WWR * ctx
                    d_r = delta_mrt(dni, dhi, alt, vis_r, vf_roof, TAU_ROOF) if roof_lit else 0.0
                    d_f = delta_mrt(dni, dhi, alt, vis_f, vf_fac * ctx, TAU_FACADE) if ztype != 2 else 0.0
                    dmrt_roof.append(round(d_r * 10))
                    dmrt_fac.append(round(d_f * 10))
                    i_th = dni * math.sin(math.radians(max(alt, 0)))
                    rr += (i_th * vis_r + dhi * vf_roof) * TAU_ROOF
                    rf += (i_th * vis_f + dhi * vf_fac * ctx) * TAU_FACADE
                    if vis_r or vis_f > 0:
                        hrs_sun += 1
            xs.append(x)
            ys.append(y)
            zone.append(ztype)
            atrium.append(1 if in_void else 0)
            svf.append(round(vf_roof + vf_fac, 3))
            sun_h.append(hrs_sun)
            rad_roof.append(round(rr / 1000.0, 2))
            rad_fac.append(round(rf / 1000.0, 2))
            df_roof.append(round(vf_roof * 0.7 * 100 * 2.5, 2) if roof_lit else 0.0)   # A15
            df_fac.append(round((6.0 * math.exp(-near[0] / 3000.0) + 0.3) * ctx, 2) if ztype != 2 else 0.0)
    return {
        "id": fid,
        "level_mm": z,
        "grid_mm": GRID,
        "sensor_height_mm": WORK_H,
        "outline_mm": [[0, 0], [PLATE_W, 0], [PLATE_W, PLATE_D], [0, PLATE_D]],
        "zones": (
            [{"type": "enclosed", "rect_mm": list(r)} for r in ENCLOSED]
            + ([{"type": "void", "rect_mm": list(VOID)}] if fid != "GF" else [])
        ),
        "x": xs, "y": ys, "zone": zone, "in_atrium": atrium, "svf": svf, "sun_h": sun_h,
        "rad_roof": rad_roof, "rad_fac": rad_fac,
        "df_roof": df_roof, "df_fac": df_fac,
        "dmrt_roof_x10": dmrt_roof, "dmrt_fac_x10": dmrt_fac,
        "source": "DEMO",
    }


def zone_series(target, peak_shift=0.0):
    """DEMO hourly operative temperature scaled so occupied K.h above 26 = target."""
    base = [24.0, 25.0, 27.5, 29.0, 28.0, 25.5, 24.5]   # heatwave pulse mid-week
    shape = []
    for d in range(7):
        for h in HOURS:
            shape.append(base[d] + (6.5 + peak_shift) * math.sin(math.pi * (h - 7) / 12.0))
    lo, hi = -30.0, 30.0
    for _ in range(60):
        mid = (lo + hi) / 2
        kh = sum(max(0.0, t + mid - 26.0) for t in shape)
        lo, hi = (mid, hi) if kh < target else (lo, mid)
    return [round(t + lo, 2) for t in shape]


SCENARIOS = [
    # id, name, rung, score, score_src, roof_mult, fac_mult, df_roof_mult, ledger
    ("base", "Baseline (existing atrium)", 0, 320.6, "EnergyPlus", 1.0, 1.0, 1.0,
     {"daylight_pct": [32.0, "proxy"], "fan_kwh_wk": [882, "proxy"], "winter_mwh_yr": [68, "proxy"],
      "embodied_tco2e": [0, "assumed"], "cost_gbp": [0, "assumed"]}),
    ("screen50", "External roof screen 50%", 1, 122, "EnergyPlus", 0.5, 1.0, 0.5,
     {"daylight_pct": [16.0, "proxy"], "fan_kwh_wk": [882, "proxy"], "winter_mwh_yr": [None, "needs input"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"]}),
    ("screen90", "External roof screen 90%", 1, 35, "EnergyPlus", 0.1, 1.0, 0.1,
     {"daylight_pct": [3.2, "proxy"], "fan_kwh_wk": [882, "proxy"], "winter_mwh_yr": [None, "needs input"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"]}),
    ("frit40", "40% PV frit on roof glass", 1, 155, "approx", 0.6, 1.0, 0.6,
     {"daylight_pct": [None, "needs input"], "fan_kwh_wk": [882, "proxy"], "winter_mwh_yr": [None, "needs input"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"], "pv_mwh_yr": [61, "approx"]}),
    ("sw_panel", "Half SW roof slope to insulated panel", 1, 192, "approx", 0.73, 1.0, 0.73,
     {"daylight_pct": [None, "needs input"], "fan_kwh_wk": [882, "proxy"], "winter_mwh_yr": [None, "needs input"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"]}),
    ("night10", "Night purge 10 ACH", 2, 225, "EnergyPlus", 1.0, 1.0, 1.0,
     {"daylight_pct": [32.0, "proxy"], "fan_kwh_wk": [8820, "proxy"], "winter_mwh_yr": [68, "proxy"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"]}),
    ("lowg_night", "g 0.2 glass + night purge 10 ACH", 1, 40, "assumed", 0.33, 1.0, 0.33,
     {"daylight_pct": [10.6, "proxy"], "fan_kwh_wk": [8820, "proxy"], "winter_mwh_yr": [195, "proxy"],
      "embodied_tco2e": [None, "needs input"], "cost_gbp": [None, "needs input"]}),
]


def main():
    os.makedirs(os.path.join(OUT, "floors"), exist_ok=True)
    for fid in LEVELS:
        with open(os.path.join(OUT, "floors", fid + ".json"), "w") as f:
            json.dump(build_floor(fid), f, separators=(",", ":"))

    scen = []
    for sid, name, rung, score, src, rm, fm, dm, ledger in SCENARIOS:
        scen.append({
            "id": sid, "name": name, "rung": rung,
            "atrium_score_kh": score, "score_source": src,
            "t_op_atrium": zone_series(score),
            "t_op_source": "DEMO",       # A16: replace with EnergyPlus hourly output
            "solar_mult": {"roof": rm, "facade": fm},
            "daylight_mult": {"roof": dm, "facade": 1.0},
            "ledger": {k: {"value": v[0], "source": v[1]} for k, v in ledger.items()},
        })
    with open(os.path.join(OUT, "scenarios.json"), "w") as f:
        json.dump(scen, f, indent=1)

    # A17: running-mean outdoor temperature per day for TM52 (DEMO numbers)
    meta = {
        "project": "Team 05 - Floorplate Heat Map",
        "question": "Where on GF and 5F do people overheat, and what does each intervention fix? (A25 placeholder)",
        "units": {"length": "mm", "angle": "degrees", "temperature": "C"},
        "north_angle_deg": NORTH_ANGLE,
        "days": ["14 Jun", "15 Jun", "16 Jun", "17 Jun", "18 Jun", "19 Jun", "20 Jun"],
        "hours": HOURS,
        "t_rm": [17.5, 18.3, 19.4, 20.6, 21.2, 20.8, 20.1],
        "t_rm_source": "DEMO",
        "floors": list(LEVELS),
        "demo": True,
    }
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("wrote demo data to", os.path.normpath(OUT))


if __name__ == "__main__":
    main()

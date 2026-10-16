"""Grasshopper Python 3 component: export one floorplate to app/data/floors/<ID>.json.

UNTESTED in Rhino. It was written in a cloud session without Rhino, so expect
to fix small things on first run. The JSON format matches what the app reads;
tools/make_demo_data.py writes the same format with placeholder values.

Set up the component (Rhino 8 ScriptEditor, Python 3) with these inputs:

  floor_id     str          "GF" or "5F"
  level_mm     float        finished floor level (A04)
  outline      Curve        closed planar floorplate outline (A01)
  enclosed     list Curve   closed curves on ZONE::Enclosed (A05)
  voids        list Curve   closed curves on ZONE::Void (no floor; A03, A05)
  atrium       list Curve   closed curve(s) of the atrium footprint (used for calibration, A20)
  grid_mm      float        grid spacing, e.g. 1000 (A02)
  sensor_mm    float        sensor height above floor, e.g. 1100 (A02)
  sun_vis      DataTree     one branch per point, one 0/1 item per OCCUPIED hour (70 for the hot week):
                            does the point see the sun through ROOF glass this hour?
                            (LB Direct Sun Hours with roof glazing as the only opening, cumulative off)
  sun_vis_fac  DataTree     same, through FACADE glass
  svf_roof     list float   sky view through roof glass per point (LB Sky View or similar), 0-1
  svf_fac      list float   sky view through facade glass per point, 0-1
  rad_roof     list float   hot-week transmitted radiation from the roof per point, kWh/m2 (LB Incident Radiation)
  rad_fac      list float   same from the facades
  df_roof      list float   daylight factor % from roof glass (HB daylight factor; or one total in df_fac and zeros here)
  df_fac       list float   daylight factor % from facades
  dni          list float   direct normal irradiance per occupied hour (70 values) from the 2050 EPW (A14)
  dhi          list float   diffuse horizontal per occupied hour (70 values)
  sun_alt      list float   solar altitude per occupied hour, degrees
  tau_roof     float        roof glass solar transmittance (A06)
  tau_fac      float        facade glass solar transmittance (A07)
  out_dir      str          path to app/data/floors
  run          bool         True to write

Output: points (for preview), msg.
The grid points are generated here, so feed `points` back into the Ladybug
components that produce sun_vis, svf, rad and df, so all lists line up.
"""
import json
import math
import os

import Rhino.Geometry as rg

# --- SolarCal constants: keep in sync with tools/solarcal.py (A10-A13)
ALPHA_SW, ALPHA_LW, F_EFF, H_R, F_P, R_FLOOR = 0.67, 0.95, 0.696, 6.012, 0.25, 0.25


def delta_mrt(dni_, dhi_, alt, vis, svf, tau):
    if alt <= 0:
        return 0.0
    i_th = dni_ * math.sin(math.radians(alt)) + dhi_
    erf = (0.5 * F_EFF * svf * (dhi_ + i_th * R_FLOOR) + F_EFF * F_P * vis * dni_) * tau * ALPHA_SW / ALPHA_LW
    return erf / (F_EFF * H_R)


def contains(crvs, pt):
    plane = rg.Plane.WorldXY
    for c in crvs or []:
        if c and c.Contains(pt, plane, 1.0) == rg.PointContainment.Inside:
            return True
    return False


def branch(tree, i):
    return [float(v) for v in tree.Branch(i)] if tree is not None and i < tree.BranchCount else None


# --- build grid inside the outline
bb = outline.GetBoundingBox(True)
xs, ys, zone, in_atrium, pts = [], [], [], [], []
g = float(grid_mm)
x = bb.Min.X + g / 2
while x < bb.Max.X:
    y = bb.Min.Y + g / 2
    while y < bb.Max.Y:
        p2 = rg.Point3d(x, y, bb.Min.Z)
        if contains([outline], p2):
            z = 2 if contains(voids, p2) else 0 if contains(enclosed, p2) else 1
            xs.append(round(x, 1))
            ys.append(round(y, 1))
            zone.append(z)
            in_atrium.append(1 if contains(atrium, p2) else 0)
            pts.append(rg.Point3d(x, y, float(level_mm) + float(sensor_mm)))
        y += g
    x += g
points = pts
msg = "%s: %d points" % (floor_id, len(pts))

if run:
    n, H = len(pts), len(dni)
    need = {"svf_roof": svf_roof, "svf_fac": svf_fac, "rad_roof": rad_roof, "rad_fac": rad_fac,
            "df_roof": df_roof, "df_fac": df_fac}
    bad = [k for k, v in need.items() if v is None or len(v) != n]
    if bad:
        msg = "Length mismatch (expected %d per point): %s" % (n, ", ".join(bad))
    else:
        d_r, d_f, sun_h = [], [], []
        for i in range(n):
            vr = branch(sun_vis, i) or [0.0] * H
            vf = branch(sun_vis_fac, i) or [0.0] * H
            hours = 0
            for h in range(H):
                if zone[i] == 2:
                    d_r.append(0)
                    d_f.append(0)
                    continue
                d_r.append(round(10 * delta_mrt(dni[h], dhi[h], sun_alt[h], vr[h], svf_roof[i], tau_roof)))
                d_f.append(round(10 * delta_mrt(dni[h], dhi[h], sun_alt[h], vf[h], svf_fac[i], tau_fac)))
                if vr[h] > 0 or vf[h] > 0:
                    hours += 1
            sun_h.append(hours)
        def rect(c):
            ok, pl = c.TryGetPolyline()
            pts_ = list(pl) if ok else [c.PointAt(t) for t in c.DivideByCount(64, True)]
            return [[round(p.X, 1), round(p.Y, 1)] for p in pts_]

        data = {
            "id": floor_id, "level_mm": float(level_mm), "grid_mm": g, "sensor_height_mm": float(sensor_mm),
            "outline_mm": rect(outline),
            "zones": [{"type": "enclosed", "polygon_mm": rect(c)} for c in enclosed or []]
                     + [{"type": "void", "polygon_mm": rect(c)} for c in voids or []],
            "x": xs, "y": ys, "zone": zone, "in_atrium": in_atrium,
            "svf": [round(a + b, 3) for a, b in zip(svf_roof, svf_fac)], "sun_h": sun_h,
            "rad_roof": [round(v, 2) for v in rad_roof], "rad_fac": [round(v, 2) for v in rad_fac],
            "df_roof": [round(v, 2) for v in df_roof], "df_fac": [round(v, 2) for v in df_fac],
            "dmrt_roof_x10": d_r, "dmrt_fac_x10": d_f,
            "source": "Ladybug + SolarCal estimate",
        }
        path = os.path.join(out_dir, floor_id + ".json")
        with open(path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        msg = "Wrote %s (%d points, %d hours)" % (path, n, H)

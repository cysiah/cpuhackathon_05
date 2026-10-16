"""Build the Floorplate Heat Map data from the organisers' Atrium Heat Lab pack.

    python3 tools/build_real_data.py [path/to/atrium-heat-lab-manchester]

Needs numpy. Default input is starter/atrium-heat-lab-manchester/ in this repo.

What is REAL here (from the pack):
  - hot-week weather: hourly dry-bulb (2050 crude morph), direct normal and global irradiance
  - the atrium geometry that EnergyPlus sees (the box in tools/sweep_atrium.py) and the 188 shading surfaces
  - the true-north angle (60.9 deg CCW from +Y)
What is a PLACEHOLDER (see ASSUMPTIONS.md): floorplate outlines other than the atrium box,
the upper-floor level (A04), the gallery width (A03), glass transmittance (A06), person posture (A11).

Method per floor point and occupied hour:
  1. sun position for Manchester (lat 53.354, lon -2.275) from the hour of the year
  2. a ray from the point toward the sun leaves the atrium box through exactly one face;
     if that face is glazed (roof or clerestory/gable) and no shading surface is in the way, the point is sunlit
  3. diffuse: 256 cosine-weighted rays give the share of the sky the point sees through roof glass
     and through clerestory glass
  4. SolarCal (tools/solarcal.py) turns that into the rise in mean radiant temperature on a person
Everything is stored for the BASELINE glass (g 0.6, no screen); the app scales it per design.
"""
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from solarcal import delta_mrt  # noqa: E402

ROOT = os.path.join(HERE, "..")
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "starter", "atrium-heat-lab-manchester")
OUT = os.path.join(ROOT, "app", "data")

# ---- the E+ atrium box, copied from tools/sweep_atrium.py (identical to the official model)
X0, X1, Y0, Y1 = -11.40, 26.95, -9.74, 16.61
Z_CL, Z_S, Z_R, Z_N, Y_R = 19.35, 21.26, 22.97, 21.86, 6.29
# (name, polygon, glazing group or None). Walls are opaque (adiabatic in the model).
FACES = [
    ("Floor", [(X0, Y0, 0), (X0, Y1, 0), (X1, Y1, 0), (X1, Y0, 0)], None),
    ("S_Wall", [(X0, Y0, 0), (X1, Y0, 0), (X1, Y0, Z_CL), (X0, Y0, Z_CL)], None),
    ("N_Wall", [(X1, Y1, 0), (X0, Y1, 0), (X0, Y1, Z_CL), (X1, Y1, Z_CL)], None),
    ("E_Wall", [(X1, Y0, 0), (X1, Y1, 0), (X1, Y1, Z_CL), (X1, Y0, Z_CL)], None),
    ("W_Wall", [(X0, Y1, 0), (X0, Y0, 0), (X0, Y0, Z_CL), (X0, Y1, Z_CL)], None),
    ("S_Clerestory", [(X0, Y0, Z_CL), (X1, Y0, Z_CL), (X1, Y0, Z_S), (X0, Y0, Z_S)], "cler"),
    ("N_Clerestory", [(X1, Y1, Z_CL), (X0, Y1, Z_CL), (X0, Y1, Z_N), (X1, Y1, Z_N)], "cler"),
    ("E_Gable", [(X1, Y0, Z_CL), (X1, Y1, Z_CL), (X1, Y1, Z_N), (X1, Y_R, Z_R), (X1, Y0, Z_S)], "cler"),
    ("W_Gable", [(X0, Y1, Z_CL), (X0, Y0, Z_CL), (X0, Y0, Z_S), (X0, Y_R, Z_R), (X0, Y1, Z_N)], "cler"),
    ("S_Roof", [(X0, Y0, Z_S), (X1, Y0, Z_S), (X1, Y_R, Z_R), (X0, Y_R, Z_R)], "roof"),
    ("N_Roof", [(X1, Y1, Z_N), (X0, Y1, Z_N), (X0, Y_R, Z_R), (X1, Y_R, Z_R)], "roof"),
]

# ---- placeholders (ASSUMPTIONS.md)
SENSOR = 1.1            # m above floor, seated (A02)
GRID = 1.0              # m (A02)
UPPER_LEVEL = 16.0      # m, A04 placeholder
GALLERY = 4.0           # m, width of the open gallery ring on the upper floor, A03 placeholder
G0 = 0.6                # baseline glass g-value (official model)
TAU0 = 0.85 * G0        # A06 placeholder: solar transmittance of the beam = 0.85 x g
LAT, LON, NORTH = 53.354, -2.275, 60.9


def tri(poly):
    p = [np.array(v, float) for v in poly]
    return [(p[0], p[i], p[i + 1]) for i in range(1, len(p) - 1)]


def tri_arrays(items):
    """items: list of (tag, polygon). Returns arrays A,B,C (m,3) and tag per triangle."""
    A, B, C, T = [], [], [], []
    for tag, poly in items:
        for a, b, c in tri(poly):
            A.append(a); B.append(b); C.append(c); T.append(tag)
    return np.array(A), np.array(B), np.array(C), np.array(T)


def mt_first_hit(orig, d, A, B, C):
    """Moller-Trumbore for rays orig (n,3) all with direction d (3,), against triangles (m,3).
    Returns t (n,m) with inf where there is no hit ahead."""
    e1, e2 = B - A, C - A
    h = np.cross(d, e2)                      # (m,3)
    a = np.einsum("mk,mk->m", e1, h)         # (m,)
    ok = np.abs(a) > 1e-12
    f = np.where(ok, 1.0 / np.where(ok, a, 1.0), 0.0)
    s = orig[:, None, :] - A[None, :, :]     # (n,m,3)
    u = f[None, :] * np.einsum("nmk,mk->nm", s, h)
    q = np.cross(s, e1[None, :, :])          # (n,m,3)
    v = f[None, :] * np.einsum("k,nmk->nm", d, q)
    t = f[None, :] * np.einsum("mk,nmk->nm", e2, q)
    hit = ok[None, :] & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9) & (t > 1e-6)
    return np.where(hit, t, np.inf)


def mt_rays(orig, D, A, B, C):
    """Per-ray directions D (n,3). Same as above with a different direction per ray."""
    e1, e2 = B - A, C - A
    h = np.cross(D[:, None, :], e2[None, :, :])                  # (n,m,3)
    a = np.einsum("mk,nmk->nm", e1, h)
    ok = np.abs(a) > 1e-12
    f = np.where(ok, 1.0 / np.where(ok, a, 1.0), 0.0)
    s = orig[:, None, :] - A[None, :, :]
    u = f * np.einsum("nmk,nmk->nm", s, h)
    q = np.cross(s, e1[None, :, :])
    v = f * np.einsum("nk,nmk->nm", D, q)
    t = f * np.einsum("mk,nmk->nm", e2, q)
    hit = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9) & (t > 1e-6)
    return np.where(hit, t, np.inf)


def sun_position(hoy):
    """Solar altitude, azimuth (deg, clockwise from north) at the middle of EPW hour index hoy (local standard time)."""
    doy = hoy // 24 + 1
    t = hoy % 24 + 0.5
    b = math.radians(360.0 / 365.0 * (doy - 81))
    eot = 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)
    solar_t = t + (4.0 * LON + eot) / 60.0
    decl = math.radians(23.45 * math.sin(math.radians(360.0 / 365.0 * (284 + doy))))
    ha = math.radians(15.0 * (solar_t - 12.0))
    lat = math.radians(LAT)
    sin_alt = math.sin(lat) * math.sin(decl) + math.cos(lat) * math.cos(decl) * math.cos(ha)
    alt = math.asin(max(-1, min(1, sin_alt)))
    cos_az = (math.sin(decl) - math.sin(alt) * math.sin(lat)) / (math.cos(alt) * math.cos(lat) + 1e-12)
    az = math.degrees(math.acos(max(-1, min(1, cos_az))))
    if ha > 0:
        az = 360 - az
    return math.degrees(alt), az


def sun_vector(alt, az):
    ph = math.radians(NORTH)
    n = np.array([-math.sin(ph), math.cos(ph)])      # true north in model XY
    e = np.array([n[1], -n[0]])                      # true east
    a, z = math.radians(alt), math.radians(az)
    h = math.cos(a) * (math.sin(z) * e + math.cos(z) * n)
    return np.array([h[0], h[1], math.sin(a)])


def hemisphere(n=256):
    """Cosine-weighted directions about +Z (Fibonacci disc mapping)."""
    i = np.arange(n) + 0.5
    r = np.sqrt(i / n)
    th = i * math.pi * (3 - math.sqrt(5))
    return np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - r * r)], axis=1)


def main():
    cl = json.load(open(os.path.join(SRC, "data", "climate.json")))
    sw = json.load(open(os.path.join(SRC, "data", "sweep.json")))
    bs = json.load(open(os.path.join(SRC, "data", "baseline.json")))
    inp = json.load(open(os.path.join(SRC, "tools", "inputs", "sweep_inputs.json")))
    wk0 = cl["hot_week"]["start_hoy"]
    occ = list(range(cl["occupied_hours"][0], cl["occupied_hours"][1]))
    hrs = [d * 24 + h for d in range(7) for h in occ]          # indices into the 168-hour week
    nH = len(hrs)

    # ---- check the pack: baseline design on the grid equals the official score
    base = dict(g=0.6, u=2.8, ach_day=4, ach_night=1, screen_opacity=0)
    row = next(r for r in sw["grid"] if all(abs(r[k] - v) < 1e-9 for k, v in base.items()))
    assert abs(row["score"] - bs["eplus"]["score"]) < 0.06, (row["score"], bs["eplus"]["score"])
    assert abs(sum(max(0, bs["eplus"]["operative"][h] - 26) for h in hrs) - bs["eplus"]["score"]) < 0.5

    # ---- geometry
    glaz = [(g, p) for _, p, g in FACES if g]
    zone_items = [(("glass:" + g) if g else "wall", p) for _, p, g in FACES]
    A, B, C, T = tri_arrays(zone_items)
    shades = [("shade", [tuple(v) for v in s["boundary"]]) for s in inp["shades"]]
    SA, SB, SC, _ = tri_arrays(shades)
    kind = np.array([2 if t == "glass:roof" else 1 if t == "glass:cler" else 0 for t in T])   # 2 roof, 1 clerestory/gable, 0 opaque

    def exits(orig, d):
        """For rays from inside the box: which glass kind each ray exits through, and whether a shade blocks it.
        d is (3,) for all rays, or (n,3) per ray. Returns kind (n,), blocked (n,) bool."""
        t = mt_first_hit(orig, d, A, B, C) if d.ndim == 1 else mt_rays(orig, d, A, B, C)
        j = np.argmin(t, axis=1)
        tmin = t[np.arange(len(orig)), j]
        k = np.where(np.isfinite(tmin), kind[j], 0)
        glass = k > 0
        blocked = np.zeros(len(orig), bool)
        if glass.any():
            idx = np.where(glass)[0]
            ex = orig[idx] + (d if d.ndim == 1 else d[idx]) * (tmin[idx, None] + 1e-4) if d.ndim == 1 else \
                orig[idx] + d[idx] * (tmin[idx, None] + 1e-4)
            ts = mt_first_hit(ex, d, SA, SB, SC) if d.ndim == 1 else mt_rays(ex, d[idx], SA, SB, SC)
            blocked[idx] = np.isfinite(ts).any(axis=1)
        return k, blocked

    # ---- the two floors
    def grid_pts(z, ring=None):
        xs, ys, zone = [], [], []
        nx, ny = int((X1 - X0) / GRID), int((Y1 - Y0) / GRID)
        ox, oy = X0 + ((X1 - X0) - nx * GRID) / 2, Y0 + ((Y1 - Y0) - ny * GRID) / 2
        for j in range(ny):
            for i in range(nx):
                x, y = ox + (i + 0.5) * GRID, oy + (j + 0.5) * GRID
                z_ = 1 if ring is None else (1 if (x < X0 + ring or x > X1 - ring or y < Y0 + ring or y > Y1 - ring) else 2)
                xs.append(x); ys.append(y); zone.append(z_)
        return np.array(xs), np.array(ys), np.array(zone), ox, oy, nx, ny

    sunpos = []
    for h in hrs:
        alt, az = sun_position(wk0 + h)
        sunpos.append((alt, az))
    dni = [cl["dni"][wk0 + h] for h in hrs]
    ghi = [cl["ghi"][wk0 + h] for h in hrs]
    dhi = [max(0.0, ghi[k] - dni[k] * math.sin(math.radians(max(sunpos[k][0], 0)))) for k in range(nH)]
    hemi = hemisphere(256)

    floors = {}
    for fid, z, ring in (("GF", 0.0, None), ("5F", UPPER_LEVEL, GALLERY)):
        xs, ys, zone, ox, oy, nx, ny = grid_pts(z, ring)
        n = len(xs)
        P = np.stack([xs, ys, np.full(n, z + SENSOR)], axis=1)
        live = zone != 2
        # diffuse sky view through roof / clerestory glass
        svf_r = np.zeros(n); svf_c = np.zeros(n)
        for r_ in range(0, n, 128):
            sl = slice(r_, min(n, r_ + 128))
            pts = P[sl]
            D = np.broadcast_to(hemi[None, :, :], (len(pts), len(hemi), 3)).reshape(-1, 3)
            O = np.repeat(pts, len(hemi), axis=0)
            k, bl = exits(O, D)
            k = np.where(bl, 0, k).reshape(len(pts), len(hemi))
            svf_r[sl] = (k == 2).mean(axis=1)
            svf_c[sl] = (k == 1).mean(axis=1)
        svf_r[~live] = 0; svf_c[~live] = 0
        # direct sun, hour by hour
        vis_r = np.zeros((n, nH), np.uint8); vis_c = np.zeros((n, nH), np.uint8)
        for k_, (alt, az) in enumerate(sunpos):
            if alt <= 1.0 or dni[k_] <= 0:
                continue
            d = sun_vector(alt, az)
            kk, bl = exits(P, d)
            kk = np.where(bl, 0, kk)
            vis_r[:, k_] = (kk == 2) & live
            vis_c[:, k_] = (kk == 1) & live
        dm_r = np.zeros((n, nH), int); dm_c = np.zeros((n, nH), int)
        rad_r = np.zeros(n); rad_c = np.zeros(n)
        for k_, (alt, az) in enumerate(sunpos):
            if alt <= 0:
                continue
            sa = math.sin(math.radians(alt))
            for i in range(n):
                if not live[i]:
                    continue
                dm_r[i, k_] = round(10 * delta_mrt(dni[k_], dhi[k_], alt, vis_r[i, k_], svf_r[i], TAU0))
                dm_c[i, k_] = round(10 * delta_mrt(dni[k_], dhi[k_], alt, vis_c[i, k_], svf_c[i], TAU0))
            rad_r += (dni[k_] * sa * vis_r[:, k_] + dhi[k_] * svf_r) * TAU0 / 1000.0
            rad_c += (dni[k_] * sa * vis_c[:, k_] + dhi[k_] * svf_c) * TAU0 / 1000.0
        strong = np.array([d_ >= 120.0 for d_ in dni])          # WMO sunshine threshold, W/m2
        sun_h = (((vis_r | vis_c) * strong[None, :]).sum(axis=1)).astype(int)
        tvis, frame, maint = min(0.85, 1.3 * G0), 0.75, 0.8          # A15 proxy, same constants as the starter app
        df_r = 100 * svf_r * tvis * frame * maint
        df_c = 100 * svf_c * tvis * frame * maint
        r2 = lambda a, dp: [round(float(v), dp) for v in a]
        floors[fid] = {
            "id": fid, "level_mm": round(z * 1000), "grid_mm": round(GRID * 1000), "sensor_height_mm": round(SENSOR * 1000),
            "outline_mm": [[round(X0 * 1000), round(Y0 * 1000)], [round(X1 * 1000), round(Y0 * 1000)],
                           [round(X1 * 1000), round(Y1 * 1000)], [round(X0 * 1000), round(Y1 * 1000)]],
            "zones": ([] if ring is None else [{"type": "void", "rect_mm": [round((X0 + ring) * 1000), round((Y0 + ring) * 1000),
                                                                           round((X1 - ring) * 1000), round((Y1 - ring) * 1000)]}]),
            "x": [round(v * 1000) for v in xs], "y": [round(v * 1000) for v in ys],
            "zone": [int(v) for v in zone], "in_atrium": [1] * n,
            "svf": r2(svf_r + svf_c, 3), "sun_h": [int(v) for v in sun_h],
            "rad_roof": r2(rad_r, 2), "rad_fac": r2(rad_c, 2),
            "df_roof": r2(df_r, 2), "df_fac": r2(df_c, 2),
            "dmrt_roof_x10": [int(v) for v in dm_r.ravel()], "dmrt_fac_x10": [int(v) for v in dm_c.ravel()],
            "source": "REAL sun on placeholder floor plates" if ring is not None else "REAL sun on the E+ atrium floor",
        }
        print(fid, n, "points; mean sun hours %.1f; mean dMRT roof %.2f K, clerestory %.2f K; svf roof %.2f clerestory %.2f" %
              (sun_h[live].mean(), dm_r[live].mean() / 10, dm_c[live].mean() / 10, svf_r[live].mean(), svf_c[live].mean()))

    # ---- climate: running mean outdoor temperature (same method as the starter app's mechanisms.js)
    fut = cl["dry_bulb"]["future"]
    dm = [sum(fut[d * 24:(d + 1) * 24]) / 24 for d in range(365)]
    trm = [dm[0]]
    for d in range(1, 365):
        trm.append(0.2 * dm[d - 1] + 0.8 * trm[d - 1])
    d0 = wk0 // 24
    days = ["14 Jun", "15 Jun", "16 Jun", "17 Jun", "18 Jun", "19 Jun", "20 Jun"]
    meta = {
        "project": "Team 05 - Floorplate Heat Map",
        "units": {"length": "mm", "angle": "degrees", "temperature": "C"},
        "north_angle_deg": NORTH,
        "days": days, "hours": occ, "hot_week_start_hoy": wk0,
        "t_rm": [round(trm[d0 + d], 2) for d in range(7)], "t_rm_source": "2050 crude-morph weather file, alpha 0.8",
        "t_out": [round(fut[wk0 + h], 1) for h in hrs],
        "sun": {"alt": [round(a, 1) for a, _ in sunpos], "dni": dni, "dhi": [round(v) for v in dhi]},
        "floors": list(floors),
        "demo": False, "placeholder_geometry": True,
        "weather": cl["scenario"]["label"], "location": cl["location"]["city"],
        "checks": {"baseline_score_kh": row["score"], "baseline_eval_id": bs["eval_id"]},
        "question": "",
    }
    os.makedirs(os.path.join(OUT, "floors"), exist_ok=True)
    for fid, f in floors.items():
        json.dump(f, open(os.path.join(OUT, "floors", fid + ".json"), "w"), separators=(",", ":"))
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
    print("wrote", os.path.normpath(OUT))


if __name__ == "__main__":
    main()

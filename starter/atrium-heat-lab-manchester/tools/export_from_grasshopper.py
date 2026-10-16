"""
Export the baseline analysis from the GM atrium Grasshopper script into data/*.json
(and tools/inputs/sweep_inputs.json for the EnergyPlus sweep).

How to run:
  1. Open GeoffreyManton_CaseStudy.3dm in Rhino 8 and GM_Atrium_Overheat_2050_Baseline_v2.gh
     (central model in 3_Team_Work via RhinoSync; script in 2_Setup_DOWNLOAD_ME) in Grasshopper. Let it solve with RUN EnergyPlus = True.
  2. In Rhino: Tools > Script > Edit (or the ScriptEditor command), choose IronPython 2
     (Python 2), open this file and Run.
  3. Re-run tools/sweep_atrium.py if you changed anything that affects the simulation.
The official model code is read from the 'FF Atrium EnergyPlus' component on the canvas,
so the sweep always matches the official E+ SCORE CARD.
"""
import os
import Grasshopper, System

OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_DOC = Grasshopper.Instances.ActiveCanvas.Document
gdoc = TARGET_DOC


def obj(ref):
    try:
        o = gdoc.FindObject(System.Guid(ref), True)
        if o:
            return o
    except Exception:
        pass
    for o in gdoc.Objects:
        if o.NickName == ref:
            return o
    raise KeyError('Not on the canvas: ' + ref)

import json, os, math
import Rhino
from Rhino.Geometry import Mesh, MeshingParameters

DATA = os.path.join(OUT, "data")
TOOLS = os.path.join(OUT, "tools", "inputs")
for d in (DATA, TOOLS):
    if not os.path.isdir(d):
        os.makedirs(d)

to_m = 0.001
r1 = lambda v: round(float(v), 1)
r2 = lambda v: round(float(v), 2)


def out(ref, name):
    o = obj(ref)
    for p in o.Params.Output:
        if p.Name == name or p.NickName == name:
            items = list(p.VolatileData.AllData(True))
            return [i.Value if hasattr(i, 'Value') else i for i in items]
    raise KeyError(name)


def one(ref, name):
    return out(ref, name)[0]


def dump(name, obj_, folder=DATA):
    with open(os.path.join(folder, name), 'w') as f:
        json.dump(obj_, f, separators=(',', ':'))


MORPH = "64af3299-97de-4375-8181-953fe1649532"
EXP = "7dc86a2a-2279-45ac-977b-d2ce5284dcdc"
LOAD = "a00ba384-dbcc-439b-b17c-6e2a18a16f22"
EP = "FF Atrium EnergyPlus"
SCR = "85d83554-8a86-4bef-9479-adc046d876fb"
FUT = "e5724c60-af55-4c45-8de7-7a2b0bdc63ad"
NOW = "bee9fc15-2286-4b1b-8b38-91d24b4c030c"
IR = {"hot_week": "df8c45bd-26d1-41e8-b61f-228bcfbe2a14", "annual": "7f3ec1de-6832-406d-896a-f04b5437e658",
      "benefit_present": "765335ea-be6e-419a-a375-c3ed262cb3d6", "benefit_future": "116106b0-f8a9-4c9d-9933-f6d31c0274f1"}

# ---------------- climate ----------------
present = one(MORPH, "present_dbt"); future = one(MORPH, "future_dbt"); hw = one(MORPH, "hot_week")
pk = one(MORPH, "peak_day")
loc = one(NOW, "location")
sl = lambda n: float(str(obj(n).CurrentValue))
climate = {
    "location": {"city": loc.city, "lat": loc.latitude, "lon": loc.longitude, "elevation": loc.elevation,
                 "source": "Manchester Airport TMYx 2011-2025 (climate.onebuilding.org)"},
    "scenario": {"label": "2050 +1.5C - CRUDE PROJECTION (uniform dry-bulb morph, not a climate model)",
                 "climate_delta_C": sl("Climate delta C"), "night_extra_C": sl("Night extra C"),
                 "heatwave_boost_C": sl("Heatwave boost C")},
    "hot_week": {"start_hoy": int(hw.st_time.hoy), "label": str(hw), "peak_day_hoy": int(pk.st_time.hoy)},
    "occupied_hours": [int(sl("Occupied from h")), int(sl("Occupied to h"))],
    "dry_bulb": {"present": [r1(v) for v in present.values], "future": [r1(v) for v in future.values]},
    "ghi": [int(v) for v in one(FUT, "global_horizontal_rad").values],
    "dni": [int(v) for v in one(FUT, "direct_normal_rad").values],
    "heat_exposure_report": str(one(EXP, "out")),
}
dump("climate.json", climate)

# ---------------- baseline EnergyPlus + screening ----------------
op = one(EP, "op_temp"); air = one(EP, "air_temp"); scr = one(SCR, "atrium_temp")
baseline = {
    "eval_id": [l for l in str(one(EP, "out")).split("\n") if "EVAL ID" in l][0].split()[2],
    "eplus": {"score": float(one(EP, "score")), "rating": str(one(EP, "rating")), "peak_operative": float(one(EP, "peak_temp")),
              "operative": [r2(v) for v in op.values], "air": [r2(v) for v in air.values], "card": str(one(EP, "out"))},
    "screening": {"score": float(one(SCR, "score")), "peak": float(one(SCR, "peak_temp")),
                  "air": [r2(v) for v in scr.values], "card": str(one(SCR, "out"))},
    "levers": {"g": sl("Glazing g-value"), "u": sl("Glazing U W/m2K"), "ach_day": sl("Day ventilation ACH"),
               "ach_night": sl("Night ventilation ACH"), "screen_opacity": 0.0},
    "atrium": {"floor_m2": 1010.5, "glass_m2": float(one(LOAD, "atrium_glass_m2"))},
}
dump("baseline.json", baseline)

# ---------------- radiation meshes (shared grid) ----------------
mesh = one(IR["hot_week"], "mesh")
verts = [[r2(v.X * to_m), r2(v.Y * to_m), r2(v.Z * to_m)] for v in mesh.Vertices]
faces = [[f.A, f.B, f.C] + ([f.D] if f.IsQuad else []) for f in mesh.Faces]
mesh.FaceNormals.ComputeFaceNormals()
# classify each analysis face so the app can aggregate by element
glass_pts = Mesh()
for b in out(LOAD, "atrium_glazing"):
    for m in (Mesh.CreateFromBrep(b, MeshingParameters.FastRenderMesh) or []):
        glass_pts.Append(m)
cats = []
for i in range(mesh.Faces.Count):
    c = mesh.Faces.GetFaceCenter(i); n = mesh.FaceNormals[i]
    near = glass_pts.ClosestPoint(c)
    if near.IsValid and near.DistanceTo(c) * to_m < 0.5:
        cats.append("atrium_roof" if n.Z > 0.5 else "atrium_clerestory")
    elif n.Z > 0.7:
        cats.append("roof")
    else:
        # facade orientation in TRUE compass terms (north = 60.9 deg CCW from +Y)
        ang = (math.degrees(math.atan2(n.X, n.Y)) + sl("North deg")) % 360
        cats.append("facade_" + ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][int(((ang + 22.5) % 360) // 45)])
areas = []
for f in mesh.Faces:
    pts = [mesh.Vertices[k] for k in ([f.A, f.B, f.C, f.D] if f.IsQuad else [f.A, f.B, f.C])]
    a = 0.0
    for k in range(1, len(pts) - 1):
        a += Rhino.Geometry.Vector3d.CrossProduct(
            Rhino.Geometry.Vector3d(pts[k] - pts[0]), Rhino.Geometry.Vector3d(pts[k + 1] - pts[0])).Length / 2.0
    areas.append(round(a * to_m * to_m, 3))
radiation = {"vertices": verts, "faces": faces, "category": cats, "area_m2": areas,
             "units": "kWh/m2", "results": {}}
for key, ref in IR.items():
    radiation["results"][key] = [r1(v) for v in out(ref, "results")]
dump("radiation.json", radiation)

# ---------------- context massing (light mesh for the 3D view) ----------------
ctx_tris = []
for b in out(LOAD, "context"):
    for m in (Mesh.CreateFromBrep(b, MeshingParameters.Coarse) or []):
        m.Faces.ConvertQuadsToTriangles()
        vs = [[r1(v.X * to_m), r1(v.Y * to_m), r1(v.Z * to_m)] for v in m.Vertices]
        ctx_tris.append({"v": vs, "f": [[f.A, f.B, f.C] for f in m.Faces]})
dump("context.json", {"north_deg": sl("North deg"), "meshes": ctx_tris})

# ---------------- inputs for the offline EnergyPlus sweep ----------------
src = obj("FF Atrium EnergyPlus").Code.split("if _run and _epw")[0]
g = {}
for k in ("_g_value_", "_u_value_", "_ach_", "_night_ach_", "_internal_w_m2_", "_mass_m2_", "_occ_start_", "_occ_end_", "_north_"):
    g[k] = None
exec(compile(src, "core", "exec"), g)
glass = g["to_m_faces"](out(LOAD, "atrium_glazing"))
bld = g["convex_parts"]([f for f in g["to_m_faces"](out(LOAD, "envelope"), 45.0) if g["can_shade"](f, building=True)])
ctx = g["convex_parts"]([f for f in g["to_m_faces"](out(LOAD, "context")) if g["can_shade"](f)])
dump("sweep_inputs.json", {
    "epw": str(one(MORPH, "future_epw")), "hot_week": [hw.st_month, hw.st_day, hw.end_month, hw.end_day],
    "north": sl("North deg"), "occ": [int(sl("Occupied from h")), int(sl("Occupied to h"))],
    "glazing_areas": g["glazing_by_group"](glass),
    "shades": [f.to_dict() for f in bld + ctx]}, TOOLS)
with open(os.path.join(DATA, "_export_log.txt"), "w") as f:
    f.write("verts %d faces %d ctx meshes %d shades %d\nDONE" % (len(verts), len(faces), len(ctx_tris), len(bld) + len(ctx)))

"""
Quick export: the atrium zone from Rhino -> JSON, so the EnergyPlus sweep and the app
use YOUR geometry instead of the box typed into sweep_atrium.py.
No Grasshopper needed. Rhino 8, ScriptEditor, Python 3 or IronPython 2.

TAGGING THE GEOMETRY (recommended - repeatable, no clicking)
  Put planar surfaces / polysurfaces on these layers (the script can create them):
      ATRIUM::Exposed   faces touching OUTSIDE air: roof, clerestories, gables
      ATRIUM::Mass      everything else enclosing the air: floor, walls to the rest of
                        the building (adiabatic thermal mass; downward faces = floor)
      ATRIUM::Glazing   glass panes lying ON exposed faces (within 0.5 m)
  Exposed + Mass together must join into ONE closed volume.
  Objects that must stay on their own layer (e.g. in the shared RhinoSync model) can
  instead get a User Text key   atrium_role = exposed | mass | glazing
  (Properties > Attribute User Text). A key always wins over the layer.

  No tagged objects? The script offers to create the layers, or to pick interactively:
  closed volume -> click its exposed faces -> select glazing.

OUTPUT
  tools/inputs/atrium_geometry.json   - read by sweep_atrium.py
  data/baseline.json  "atrium" block  - floor, volume, glass, surface areas for the app
Then re-run tools/sweep_atrium.py (try --quick first) and refresh the browser.
Delete atrium_geometry.json to go back to the original box.
"""
import os
import json
import Rhino
import scriptcontext as sc
import rhinoscriptsyntax as rs
from Rhino.Geometry import Brep, Vector3d, AreaMassProperties, VolumeMassProperties

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "inputs", "atrium_geometry.json")
BASELINE = os.path.join(ROOT, "data", "baseline.json")
PARENT, ROLES, KEY = "ATRIUM", ("exposed", "mass", "glazing"), "atrium_role"
tol = sc.doc.ModelAbsoluteTolerance
to_m = Rhino.RhinoMath.UnitScale(sc.doc.ModelUnitSystem, Rhino.UnitSystem.Meters)
SNAP = 0.5 / to_m  # glazing must lie within 0.5 m of a face


def layer(role):
    return PARENT + "::" + role.capitalize()


def tagged():
    """{role: [object ids]} from layers and atrium_role User Text (key wins)."""
    found = dict((r, []) for r in ROLES)
    seen = set()
    for o in sc.doc.Objects:
        if o.IsDeleted or not isinstance(o.Geometry, (Brep, Rhino.Geometry.Extrusion, Rhino.Geometry.Surface)):
            continue
        role = (o.Attributes.GetUserString(KEY) or "").strip().lower()
        if role not in ROLES:
            lname = sc.doc.Layers[o.Attributes.LayerIndex].FullPath
            role = next((r for r in ROLES if lname == layer(r)), None)
        if role and o.Id not in seen:
            seen.add(o.Id)
            found[role].append(o.Id)
    return found


def faces_of(oid):
    b = rs.coercebrep(oid)
    return [b.Faces[i].DuplicateFace(False) for i in range(b.Faces.Count)]


def loop_points(face):
    crv = face.Faces[0].OuterLoop.To3dCurve()
    ok, pl = crv.TryGetPolyline()
    if not ok:
        pl = crv.ToPolyline(0, 0, 0.1, 0, 0, tol, 0, 0, True).ToPolyline()
    pts = list(pl)
    if pts[0].DistanceTo(pts[-1]) < tol:
        pts = pts[:-1]
    return pts


def newell(pts):
    n = Vector3d(0, 0, 0)
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n += Vector3d((a.Y - b.Y) * (a.Z + b.Z), (a.Z - b.Z) * (a.X + b.X), (a.X - b.X) * (a.Y + b.Y))
    n.Unitize()
    return n


# ---------------------------------------------------------------- collect faces + roles
found = tagged()
src = []      # [(single-face brep, 'exposed'|'mass')]
glass_ids = found["glazing"]
if found["exposed"] or found["mass"]:
    mode = "layers/keys"
    for role in ("exposed", "mass"):
        for oid in found[role]:
            src += [(f, role) for f in faces_of(oid)]
    joined = Brep.JoinBreps([f for f, _ in src], tol)
    if not joined or len(joined) != 1 or not joined[0].IsSolid:
        rs.SelectObjects(found["exposed"] + found["mass"])
        raise SystemExit("Exposed + Mass objects (now selected) do not join into ONE closed volume "
                         "(%d pieces). Fix gaps or overlaps, e.g. with ShowEdges > Naked edges." % len(joined or []))
    volume = joined[0]
else:
    choice = rs.GetString("No ATRIUM layers or atrium_role keys found", "CreateLayers",
                          ["CreateLayers", "PickInteractively"])
    if choice == "CreateLayers":
        for r, col in zip(ROLES, ((230, 120, 40), (150, 150, 150), (80, 170, 230))):
            if not rs.IsLayer(layer(r)):
                rs.AddLayer(layer(r), col)
        raise SystemExit("Created %s::Exposed / Mass / Glazing. Move or copy geometry onto them and run again."
                         % PARENT)
    if choice != "PickInteractively":
        raise SystemExit("Cancelled")
    mode = "interactive"
    vid = rs.GetObject("Select the closed atrium volume (polysurface)", rs.filter.polysurface, preselect=True)
    if not vid:
        raise SystemExit("Cancelled")
    volume = rs.coercebrep(vid)
    if not volume.IsSolid:
        raise SystemExit("The atrium volume must be a closed polysurface")
    go = Rhino.Input.Custom.GetObject()
    go.SetCommandPrompt("Click the faces of the volume that touch OUTSIDE air, Enter when done")
    go.GeometryFilter = Rhino.DocObjects.ObjectType.Surface
    go.SubObjectSelect = True
    go.EnablePreSelect(False, True)
    go.GetMultiple(0, 0)
    exposed = set(go.Object(i).GeometryComponentIndex.Index for i in range(go.ObjectCount)
                  if go.Object(i).ObjectId == vid)
    rs.UnselectAllObjects()
    src = [(volume.Faces[i].DuplicateFace(False), "exposed" if i in exposed else "mass")
           for i in range(volume.Faces.Count)]
    glass_ids = rs.GetObjects("Select the glazing surfaces (Enter for none)",
                              rs.filter.surface | rs.filter.polysurface) or []

if volume.SolidOrientation == Rhino.Geometry.BrepSolidOrientation.Inward:
    volume.Flip()
if not any(r == "exposed" for _, r in src):
    raise SystemExit("No exposed faces - nothing would touch outside air")

# ---------------------------------------------------------------- glazing -> nearest face
glass_on, unassigned = {}, []
for gid in glass_ids:
    for g in faces_of(gid):
        amp = AreaMassProperties.Compute(g)
        best, best_d = None, SNAP
        for i, (f, _) in enumerate(src):
            d = f.ClosestPoint(amp.Centroid).DistanceTo(amp.Centroid)
            if d < best_d:
                best, best_d = i, d
        if best is None:
            unassigned.append(gid)
        else:
            glass_on[best] = glass_on.get(best, 0.0) + amp.Area * to_m * to_m

# ---------------------------------------------------------------- faces -> JSON
faces, warn = [], []
for i, (f, role) in enumerate(src):
    if not f.Faces[0].IsPlanar(tol * 10):
        warn.append("face %d (%s) is not planar - split it in Rhino" % (i, role))
    if f.Faces[0].Loops.Count > 1:
        warn.append("face %d (%s) has holes - they are ignored" % (i, role))
    amp = AreaMassProperties.Compute(f)
    pts = loop_points(f)
    n = newell(pts)
    if volume.IsPointInside(amp.Centroid + n * (0.05 / to_m), tol, False):
        pts.reverse()
        n.Reverse()  # vertex order must face OUT of the zone
    kind = "floor" if n.Z < -0.7 else ("roof" if n.Z > 0.3 else "wall")
    if i in glass_on and role != "exposed":
        warn.append("face %d has glazing but is tagged mass - treated as exposed" % i)
        role = "exposed"
    faces.append({"name": "F%02d_%s" % (i, kind), "type": kind,
                  "bc": "outdoors" if role == "exposed" else "adiabatic",
                  "vertices": [[round(p.X * to_m, 3), round(p.Y * to_m, 3), round(p.Z * to_m, 3)] for p in pts],
                  "area_m2": round(amp.Area * to_m * to_m, 2),
                  "glazing_m2": round(glass_on.get(i, 0.0), 2)})
if unassigned:
    rs.SelectObjects(list(set(unassigned)))
    warn.append("%d glazing pieces (now selected) are not within 0.5 m of any face - ignored" % len(unassigned))

bb = volume.GetBoundingBox(True)
summary = {
    "floor_m2": round(sum(f["area_m2"] for f in faces if f["type"] == "floor"), 1),
    "volume_m3": round(VolumeMassProperties.Compute(volume).Volume * to_m ** 3, 0),
    "glass_m2": round(sum(glass_on.values()), 1),
    "internal_area_m2": round(sum(f["area_m2"] for f in faces), 0),
    "exposed_area_m2": round(sum(f["area_m2"] for f in faces if f["bc"] == "outdoors"), 1),
    "bbox_m": [[round(v * to_m, 2) for v in (bb.Min.X, bb.Min.Y, bb.Min.Z)],
               [round(v * to_m, 2) for v in (bb.Max.X, bb.Max.Y, bb.Max.Z)]],
}
with open(OUT, "w") as fp:
    json.dump({"source": str(sc.doc.Name), "mode": mode, "faces": faces, "summary": summary}, fp, indent=1)

with open(BASELINE) as fp:
    base = json.load(fp)
base["atrium"].update(dict((k, summary[k]) for k in ("floor_m2", "volume_m3", "glass_m2", "internal_area_m2")))
base["atrium"]["geometry_source"] = "tools/inputs/atrium_geometry.json (" + str(sc.doc.Name) + ")"
with open(BASELINE, "w") as fp:
    json.dump(base, fp, separators=(",", ":"))

print("[%s] wrote %d faces (%d exposed, %d glazed)" % (
    mode, len(faces), sum(1 for f in faces if f["bc"] == "outdoors"), sum(1 for f in faces if f["glazing_m2"])))
print(json.dumps(summary))
for w in warn:
    print("WARNING: " + w)
print("Next: re-run tools/sweep_atrium.py. The baseline E+ score in the app is from the OLD "
      "geometry until you re-run the Grasshopper export too.")

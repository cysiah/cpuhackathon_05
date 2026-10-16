"""
Quick export: selected Rhino geometry -> JSON meshes for the web app's 3D view.
No Grasshopper needed.

How to run:
  1. Open the .3dm in Rhino 8, select the objects (breps, extrusions, meshes, SubDs).
  2. ScriptEditor > open this file > Run (Python 3 or IronPython 2 both work).
  3. Choose what to do with them:
       Add      - append to data/context.json (shown as context massing)
       Replace  - overwrite data/context.json with only the selection
       Separate - write data/selection.json, leave the app untouched
     Add/Replace keep a backup in data/context.backup.json.
  4. Refresh the browser.

Output uses the same format as context.json: metres, Rhino coordinates, Z up,
{"north_deg": .., "meshes": [{"v": [[x,y,z],..], "f": [[a,b,c],..]}, ..]}.
This only changes the 3D view. To make new geometry shade the EnergyPlus model,
re-run export_from_grasshopper.py and sweep_atrium.py.
"""
import os
import json
import shutil
import Rhino
import scriptcontext as sc
import rhinoscriptsyntax as rs
from Rhino.Geometry import Mesh, MeshingParameters

DATA = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CONTEXT = os.path.join(DATA, "context.json")
to_m = Rhino.RhinoMath.UnitScale(sc.doc.ModelUnitSystem, Rhino.UnitSystem.Meters)
r1 = lambda v: round(float(v) * to_m, 1)


def to_meshes(geo):
    if isinstance(geo, Mesh):
        return [geo.DuplicateMesh()]
    if isinstance(geo, Rhino.Geometry.Extrusion):
        geo = geo.ToBrep()
    if isinstance(geo, Rhino.Geometry.SubD):
        return [Mesh.CreateFromSubD(geo, 1)]
    if isinstance(geo, Rhino.Geometry.Brep):
        return list(Mesh.CreateFromBrep(geo, MeshingParameters.Coarse) or [])
    return []


ids = rs.GetObjects("Select geometry to export", preselect=True)
if not ids:
    raise SystemExit("Nothing selected")
mode = rs.GetString("Export mode", "Add", ["Add", "Replace", "Separate"])
if not mode:
    raise SystemExit("Cancelled")

meshes, skipped = [], 0
for i in ids:
    ms = to_meshes(rs.coercegeometry(i))
    if not ms:
        skipped += 1
    for m in ms:
        if m is None:
            continue
        m.Faces.ConvertQuadsToTriangles()
        meshes.append({"v": [[r1(v.X), r1(v.Y), r1(v.Z)] for v in m.Vertices],
                       "f": [[f.A, f.B, f.C] for f in m.Faces]})

ctx = {"north_deg": 60.9, "meshes": []}
if os.path.isfile(CONTEXT):
    with open(CONTEXT) as f:
        ctx = json.load(f)

if mode == "Separate":
    path, out = os.path.join(DATA, "selection.json"), {"north_deg": ctx["north_deg"], "meshes": meshes}
else:
    shutil.copyfile(CONTEXT, os.path.join(DATA, "context.backup.json"))
    path = CONTEXT
    out = {"north_deg": ctx["north_deg"], "meshes": (ctx["meshes"] if mode == "Add" else []) + meshes}

with open(path, "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("{}: wrote {} meshes from {} objects to {} ({} skipped)".format(
    mode, len(meshes), len(ids), path, skipped))

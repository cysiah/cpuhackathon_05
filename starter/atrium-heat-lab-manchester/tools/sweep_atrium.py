"""
Track 01 - design-space sweep of the Geoffrey Manton atrium (EnergyPlus).

Runs the SAME free-running atrium model as the official 'FF Atrium EnergyPlus'
Grasshopper component, for every combination of the levers below, and writes
data/sweep.json for the web app.

Run it with the Python that ships with Ladybug Tools (it has honeybee-energy,
OpenStudio and EnergyPlus wired up):

    "C:\\Program Files\\ladybug_tools\\python\\python.exe" tools\\sweep_atrium.py

Options:
    --workers N     parallel simulations (default: CPU count - 2)
    --validate N    also run N random OFF-GRID designs to measure how wrong the
                    app's interpolation is between grid points (default 40)
    --quick         tiny 2-level grid, for testing your changes

Inputs come from tools/inputs/sweep_inputs.json (exported from the GH script:
weather file path, hot week, north angle, measured glazing areas and the
shading geometry around the atrium). Edit LEVERS to explore a different design
space - and be honest about what the grid does NOT cover.
"""
import os
import sys
import json
import time
import random
import shutil
import argparse
import itertools
import subprocess
from multiprocessing import Pool, cpu_count

from ladybug_geometry.geometry3d import Point3D, Face3D
from ladybug.analysisperiod import AnalysisPeriod
from ladybug.dt import DateTime
from ladybug.sql import SQLiteResult
from honeybee.model import Model
from honeybee.room import Room
from honeybee.face import Face
from honeybee.shade import Shade
from honeybee.facetype import face_types
from honeybee.boundarycondition import boundary_conditions as bcs
from honeybee.config import folders
from honeybee_energy.material.opaque import EnergyMaterial
from honeybee_energy.material.glazing import EnergyWindowMaterialSimpleGlazSys
from honeybee_energy.construction.opaque import OpaqueConstruction
from honeybee_energy.construction.window import WindowConstruction
from honeybee_energy.schedule.ruleset import ScheduleRuleset
from honeybee_energy.load.equipment import ElectricEquipment
from honeybee_energy.load.infiltration import Infiltration
from honeybee_energy.internalmass import InternalMass
from honeybee_energy.programtype import ProgramType
from honeybee_energy.simulation.parameter import SimulationParameter
from honeybee_energy.simulation.runperiod import RunPeriod
from honeybee_energy.simulation.shadowcalculation import ShadowCalculation

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# ---------------------------------------------------------------- design space
# Every combination is simulated (full factorial). Baseline = g 0.6, U 2.8,
# ACH 4 / 1, no screen - it must be on the grid so the app can show it exactly.
LEVERS = {
    'g': [0.2, 0.35, 0.5, 0.6, 0.7],          # glazing solar transmittance (SHGC)
    'u': [1.0, 1.6, 2.8, 4.0, 5.8],           # glazing U-value, W/m2K
    'ach_day': [1, 2, 4, 7, 10],              # ventilation 08-18h, air changes/h
    'ach_night': [0, 1, 3, 6, 10],            # night (purge) ventilation, air changes/h
    'screen_opacity': [0, 0.25, 0.5, 0.75, 0.9],  # external roof screen, fraction of sun blocked
}
QUICK = {'g': [0.3, 0.6], 'u': [1.6, 2.8], 'ach_day': [2, 4], 'ach_night': [1, 6], 'screen_opacity': [0, 0.5]}

# ---------------------------------------------------------------- fixed model
# Identical to FF Atrium EnergyPlus (the official E+ SCORE CARD in the Grasshopper script).
X0, X1, Y0, Y1 = -11.40, 26.95, -9.74, 16.61
Z_CL, Z_S, Z_R, Z_N, Y_R = 19.35, 21.26, 22.97, 21.86, 6.29
Q_INT, MASS_M2 = 5.0, 1000.0
SCREEN_Z, SCREEN_MARGIN = 24.5, 2.0   # horizontal screen 1.5 m above the ridge


def face3d(pts):
    return Face3D([Point3D(*p) for p in pts])


def atrium_faces():
    return [
        ('Floor', face3d([(X0, Y0, 0), (X0, Y1, 0), (X1, Y1, 0), (X1, Y0, 0)]), face_types.floor, True, None),
        ('S_Wall', face3d([(X0, Y0, 0), (X1, Y0, 0), (X1, Y0, Z_CL), (X0, Y0, Z_CL)]), face_types.wall, True, None),
        ('N_Wall', face3d([(X1, Y1, 0), (X0, Y1, 0), (X0, Y1, Z_CL), (X1, Y1, Z_CL)]), face_types.wall, True, None),
        ('E_Wall', face3d([(X1, Y0, 0), (X1, Y1, 0), (X1, Y1, Z_CL), (X1, Y0, Z_CL)]), face_types.wall, True, None),
        ('W_Wall', face3d([(X0, Y1, 0), (X0, Y0, 0), (X0, Y0, Z_CL), (X0, Y1, Z_CL)]), face_types.wall, True, None),
        ('S_Clerestory', face3d([(X0, Y0, Z_CL), (X1, Y0, Z_CL), (X1, Y0, Z_S), (X0, Y0, Z_S)]), face_types.wall, False, 'S'),
        ('N_Clerestory', face3d([(X1, Y1, Z_CL), (X0, Y1, Z_CL), (X0, Y1, Z_N), (X1, Y1, Z_N)]), face_types.wall, False, 'N'),
        ('E_Gable', face3d([(X1, Y0, Z_CL), (X1, Y1, Z_CL), (X1, Y1, Z_N), (X1, Y_R, Z_R), (X1, Y0, Z_S)]), face_types.wall, False, 'E'),
        ('W_Gable', face3d([(X0, Y1, Z_CL), (X0, Y0, Z_CL), (X0, Y0, Z_S), (X0, Y_R, Z_R), (X0, Y1, Z_N)]), face_types.wall, False, 'W'),
        ('S_Roof', face3d([(X0, Y0, Z_S), (X1, Y0, Z_S), (X1, Y_R, Z_R), (X0, Y_R, Z_R)]), face_types.roof_ceiling, False, 'RS'),
        ('N_Roof', face3d([(X1, Y1, Z_N), (X0, Y1, Z_N), (X0, Y_R, Z_R), (X1, Y_R, Z_R)]), face_types.roof_ceiling, False, 'RN'),
    ]


def zone_faces(inp):
    """(name, Face3D, type, adiabatic, glazing m2) for the atrium zone.
    From tools/inputs/atrium_geometry.json (export_atrium_geometry.py) when present,
    otherwise the reference box above."""
    geo = inp.get('atrium')
    if geo:
        types = {'floor': face_types.floor, 'wall': face_types.wall, 'roof': face_types.roof_ceiling}
        return [(f['name'], face3d(f['vertices']), types[f['type']], f['bc'] == 'adiabatic', f['glazing_m2'])
                for f in geo['faces']]
    return [(n, g, t, a, inp['glazing_areas'].get(grp, 0.0) if grp else 0.0) for n, g, t, a, grp in atrium_faces()]


def screen_extent(inp):
    """Roof screen plane: footprint + margin, 1.5 m above the highest point of the zone."""
    geo = inp.get('atrium')
    if geo:
        (x0, y0, _), (x1, y1, z1) = geo['summary']['bbox_m']
        return x0, x1, y0, y1, z1 + 1.5
    return X0, X1, Y0, Y1, SCREEN_Z


def build_model(name, d, inp):
    occ_s, occ_e = inp['occ']
    concrete = EnergyMaterial('FF_Concrete200', 0.20, 1.95, 2240, 900)
    plaster = EnergyMaterial('FF_Plaster13', 0.013, 0.16, 800, 1090)
    screed = EnergyMaterial('FF_Screed50', 0.05, 1.4, 2100, 840)
    slab = EnergyMaterial('FF_Concrete250', 0.25, 1.95, 2240, 900)
    steel = EnergyMaterial('FF_Steel1', 0.001, 45.0, 7800, 500, solar_absorptance=0.6)
    insul = EnergyMaterial('FF_PanelInsul70', 0.07, 0.035, 30, 1400)
    mass_wall = OpaqueConstruction('FF_AtriumMassWall', [plaster, concrete, plaster])
    floor_con = OpaqueConstruction('FF_AtriumFloor', [slab, screed])
    panel = OpaqueConstruction('FF_MetalPanel', [steel, insul, steel])
    glaz = WindowConstruction('FF_AtriumGlazing', [EnergyWindowMaterialSimpleGlazSys(
        'FF_AtriumGlass', d['u'], d['g'], 0.7)])

    faces = []
    for fname, geo, ftype, adiabatic, glass_m2 in zone_faces(inp):
        fc = Face('Atrium_' + fname, geo, ftype, bcs.adiabatic if adiabatic else bcs.outdoors)
        if adiabatic:
            fc.properties.energy.construction = floor_con if ftype == face_types.floor else mass_wall
        else:
            fc.properties.energy.construction = panel
            ratio = min(0.99, glass_m2 / geo.area)
            if ratio > 0.01:
                fc.apertures_by_ratio(ratio, 0.01)
                for ap in fc.apertures:
                    ap.properties.energy.construction = glaz
        faces.append(fc)
    room = Room('FF_Atrium', faces, 0.01, 1.0)

    occ = [0] * occ_s + [1] * (occ_e - occ_s) + [0] * (24 - occ_e)
    occ_sch = ScheduleRuleset.from_daily_values('FF_Occupied', occ)
    peak_ach = max(d['ach_day'], d['ach_night'], 0.01)
    vent_sch = ScheduleRuleset.from_daily_values(
        'FF_Ventilation', [(d['ach_day'] if o else d['ach_night']) / peak_ach for o in occ])
    flow = peak_ach * room.volume / 3600.0 / room.exposed_area
    room.properties.energy.program_type = ProgramType(
        'FF_Atrium_Program',
        electric_equipment=ElectricEquipment('FF_Gains', Q_INT, occ_sch, 0.3),
        infiltration=Infiltration('FF_Ventilation', flow, vent_sch))
    room.properties.energy.add_internal_mass(InternalMass(
        'FF_GalleryMass', OpaqueConstruction('FF_MassSlab', [concrete, plaster]), MASS_M2))

    shades = [Shade('FF_Shade_{}'.format(i), Face3D.from_dict(f)) for i, f in enumerate(inp['shades'])]
    if d['screen_opacity'] > 0:
        m = SCREEN_MARGIN
        x0, x1, y0, y1, z = screen_extent(inp)
        scr = Shade('FF_RoofScreen', face3d([(x0 - m, y0 - m, z), (x1 + m, y0 - m, z),
                                             (x1 + m, y1 + m, z), (x0 - m, y1 + m, z)]))
        scr.properties.energy.transmittance_schedule = ScheduleRuleset.from_constant_value(
            'FF_ScreenTransmittance', 1.0 - d['screen_opacity'])
        shades.append(scr)
    return Model(name, rooms=[room], orphaned_shades=shades, units='Meters', tolerance=0.01, angle_tolerance=1.0)


def sim_parameter(inp):
    sm, sd, em, ed = inp['hot_week']
    warm = DateTime.from_hoy(max(0, DateTime(sm, sd).hoy - 7 * 24))
    sp = SimulationParameter(
        run_period=RunPeriod.from_analysis_period(AnalysisPeriod(warm.month, warm.day, 0, em, ed, 23)),
        timestep=6, north_angle=inp['north'],
        shadow_calculation=ShadowCalculation('FullInteriorAndExterior', 'PolygonClipping', 'Periodic', 7))
    sp.output.reporting_frequency = 'Hourly'
    for o in ('Zone Operative Temperature', 'Enclosure Windows Total Transmitted Solar Radiation Energy'):
        sp.output.add_output(o)
    return sp


def run_one(job):
    """Simulate one design. Returns a result dict (or an error dict - never silently)."""
    idx, d, inp, root = job
    name = 'FF_sweep_{:05d}'.format(idx)
    folder = os.path.join(root, name)
    if os.path.isdir(folder):
        shutil.rmtree(folder)  # never reuse a stale result
    os.makedirs(folder)
    model_json, sp_json = os.path.join(folder, 'model.hbjson'), os.path.join(folder, 'sim_par.json')
    with open(model_json, 'w') as fp:
        json.dump(build_model(name, d, inp).to_dict(), fp)
    with open(sp_json, 'w') as fp:
        json.dump(sim_parameter(inp).to_dict(), fp)
    osdir = os.path.join(folder, 'openstudio')
    env = os.environ.copy(); env['PYTHONHOME'] = ''
    subprocess.run([folders.python_exe_path, '-m', 'honeybee_energy', 'simulate', 'model', model_json,
                    inp['epw'], '--sim-par-json', sp_json, '--folder', osdir],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=env)
    sql = os.path.join(osdir, 'run', 'eplusout.sql')
    if not os.path.isfile(sql):
        return dict(d, idx=idx, error='simulation failed - see ' + folder)
    res = SQLiteResult(sql)
    sm, sd, em, ed = inp['hot_week']
    ap = AnalysisPeriod(sm, sd, 0, em, ed, 23)
    op = res.data_collections_by_output_name('Zone Operative Temperature')[0].filter_by_analysis_period(ap)
    sol = res.data_collections_by_output_name(
        'Enclosure Windows Total Transmitted Solar Radiation Energy')[0].filter_by_analysis_period(ap)
    occ_s, occ_e = inp['occ']
    occ_t = [v for v, dt in zip(op.values, op.datetimes) if occ_s <= dt.hour < occ_e]
    out = dict(d, idx=idx,
               score=round(sum(max(0.0, v - 26.0) for v in occ_t), 1),
               peak=round(max(op.values), 2),
               h26=sum(1 for v in occ_t if v > 26), h28=sum(1 for v in occ_t if v > 28),
               h30=sum(1 for v in occ_t if v > 30),
               solar_kwh=round(sum(sol.values) / (3.6e6 if sol.header.unit == 'J' else 1.0)),
               operative=[round(v, 1) for v in op.values])
    shutil.rmtree(folder, ignore_errors=True)  # keep disk use small
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--workers', type=int, default=max(1, cpu_count() - 2))
    ap.add_argument('--validate', type=int, default=40)
    ap.add_argument('--quick', action='store_true')
    args = ap.parse_args()

    with open(os.path.join(HERE, 'inputs', 'sweep_inputs.json')) as f:
        inp = json.load(f)
    if not os.path.isfile(inp['epw']):  # path from the organiser's machine - use the bundled copy
        inp['epw'] = os.path.join(HERE, 'inputs', os.path.basename(inp['epw'].replace('\\', '/')))
    if not os.path.isfile(inp['epw']):
        sys.exit('Weather file not found: ' + inp['epw'])
    geo_json = os.path.join(HERE, 'inputs', 'atrium_geometry.json')
    if os.path.isfile(geo_json):  # geometry from Rhino (export_atrium_geometry.py)
        with open(geo_json) as f:
            inp['atrium'] = json.load(f)
        print('Atrium geometry from {} ({} faces)'.format(geo_json, len(inp['atrium']['faces'])))
    else:
        print('Atrium geometry: reference box in sweep_atrium.py')
    levers = QUICK if args.quick else LEVERS
    keys = list(levers)
    grid = [dict(zip(keys, combo)) for combo in itertools.product(*[levers[k] for k in keys])]
    rng = random.Random(2026)  # fixed seed: the validation set is reproducible
    val = [{k: round(rng.uniform(min(v), max(v)), 3) for k, v in levers.items()} for _ in range(args.validate)]
    root = os.path.join(folders.default_simulation_folder, 'FF_sweep')
    jobs = [(i, d, inp, root) for i, d in enumerate(grid + val)]

    print('{} grid designs + {} validation designs on {} workers'.format(len(grid), len(val), args.workers))
    t0, results = time.time(), []
    with Pool(args.workers) as pool:
        for n, r in enumerate(pool.imap_unordered(run_one, jobs), 1):
            results.append(r)
            if n % 50 == 0 or n == len(jobs):
                print('  {}/{}  {:.0f} s'.format(n, len(jobs), time.time() - t0), flush=True)
    results.sort(key=lambda r: r['idx'])
    errors = [r for r in results if 'error' in r]

    out = {
        'about': 'Full-factorial EnergyPlus sweep of the GM atrium, hot week of the 2050 +1.5C crude morph. '
                 'Same model as the official FF Atrium EnergyPlus score.',
        'levers': levers,
        'lever_info': {
            'g': 'glazing solar transmittance (SHGC)', 'u': 'glazing U-value W/m2K',
            'ach_day': 'ventilation 08-18h, ACH', 'ach_night': 'night ventilation, ACH',
            'screen_opacity': 'external horizontal roof screen 1.5 m above the ridge, fraction of sun blocked'},
        'metrics': {'score': 'occupied K.h of operative temperature above 26 C (lower is better)',
                    'peak': 'peak operative temperature C', 'h26': 'occupied hours > 26 C',
                    'h28': 'occupied hours > 28 C', 'h30': 'occupied hours > 30 C',
                    'solar_kwh': 'solar transmitted through the atrium glazing, hot week'},
        'hot_week': inp['hot_week'], 'occupied_hours': inp['occ'],
        'geometry': inp['atrium']['summary'] if inp.get('atrium') else 'reference box',
        'grid': [r for r in results[:len(grid)] if 'error' not in r],
        'validation': [r for r in results[len(grid):] if 'error' not in r],
        'errors': errors,
        'runtime_s': round(time.time() - t0),
    }
    with open(os.path.join(ROOT, 'data', 'sweep.json'), 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print('wrote data/sweep.json - {} errors'.format(len(errors)))


if __name__ == '__main__':
    main()

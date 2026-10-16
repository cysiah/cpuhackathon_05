// Run: node tests/test_model.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const FM = require("../app/js/model.js");
const SC = require("../app/js/scenario.js");

const D = path.join(__dirname, "..", "app", "data");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "sweep.js"), "utf8") + ";this.SWEEP=SWEEP", ctx);
SC.init(ctx.SWEEP);
const meta = JSON.parse(fs.readFileSync(path.join(D, "meta.json")));
const floors = {};
meta.floors.forEach((f) => (floors[f] = JSON.parse(fs.readFileSync(path.join(D, "floors", f + ".json")))));
const H = meta.days.length * meta.hours.length;
const mk = (id, lv) => SC.build(id, id, lv, meta);
const base = mk("base", {});
SC.baseline = base;

// ---- the organisers' numbers are reproduced
assert.strictEqual(base.atrium_score_kh, 320.6, "baseline score");
assert.strictEqual(base.score_source, "EnergyPlus");
assert.strictEqual(SC.countPass(42), 1041, "1,041 designs pass");
assert.ok(Math.abs(mk("n", { ach_night: 10 }).atrium_score_kh - 224.8) < 0.05, "night purge 10 ACH");
assert.ok(Math.abs(mk("s", { screen_opacity: 0.9 }).atrium_score_kh - 35) < 0.05, "screen 90%");
assert.ok(Math.abs(SC.VAL.rmse - 4.8) < 0.1 && Math.abs(SC.VAL.max - 20.4) < 0.1, "measured interpolation error");
// an off-grid design is interpolated and says so
const off = mk("o", { g: 0.52 });
assert.strictEqual(off.score_source, "interpolated");
assert.ok(off.atrium_score_kh > mk("a", { g: 0.5 }).atrium_score_kh && off.atrium_score_kh < base.atrium_score_kh, "monotonic in g");

// ---- data shape
meta.floors.forEach((fid) => {
  const f = floors[fid], n = f.x.length;
  ["y", "zone", "in_atrium", "svf", "sun_h", "rad_roof", "rad_fac", "df_roof", "df_fac"].forEach((k) => assert.strictEqual(f[k].length, n, fid + "." + k));
  assert.strictEqual(f.dmrt_roof_x10.length, n * H, fid + " dmrt_roof hours");
  assert.strictEqual(f.dmrt_fac_x10.length, n * H, fid + " dmrt_fac hours");
});
assert.strictEqual(base.t_op_atrium.length, H);
assert.strictEqual(meta.checks.baseline_score_kh, 320.6);

// ---- the sun data is physical: more sun near the roof, none through a void, void points carry no values
const meanSun = (fid) => { const f = floors[fid]; let s = 0, n = 0; f.zone.forEach((z, i) => { if (z !== FM.ZONE.VOID) { s += f.sun_h[i]; n++; } }); return s / n; };
assert.ok(meanSun("5F") > meanSun("GF"), "the upper floor gets more direct sun than the ground floor");
const r0 = FM.computeAll(floors, base, meta, {});
meta.floors.forEach((fid) => floors[fid].zone.forEach((z, i) => { if (z === FM.ZONE.VOID) assert.strictEqual(r0[fid].kh[i], null); }));

// ---- calibration: with re-centring, the GF atrium floor averages back to the scenario's own hourly series
const mean = (a) => a.filter((x) => x !== null).reduce((s, x) => s + x, 0) / a.filter((x) => x !== null).length;
["base", "screen90", "night10"].forEach((id) => {
  const s = id === "base" ? base : id === "screen90" ? mk(id, { screen_opacity: 0.9 }) : mk(id, { ach_night: 10 });
  const r = FM.computeAll(floors, s, meta, {});
  const fromSeries = s.t_op_atrium.reduce((a, t) => a + Math.max(0, t - 26), 0);
  assert.ok(Math.abs(mean(r.GF.kh) - fromSeries) < 0.12 * fromSeries + 4, id + ": GF mean " + mean(r.GF.kh).toFixed(1) + " vs series " + fromSeries.toFixed(1));
});

// ---- interventions behave
const sc50 = mk("s50", { screen_opacity: 0.5 }), sc90 = mk("s90", { screen_opacity: 0.9 });
assert.ok(mean(FM.computeAll(floors, sc90, meta, {}).GF.kh) < mean(FM.computeAll(floors, sc50, meta, {}).GF.kh), "more screen, less overheating");
assert.ok(sc90.daylightPct < sc50.daylightPct && sc50.daylightPct < base.daylightPct, "more screen, less daylight");
assert.ok(mk("u", { u: 5.8 }).ledger.winter_mwh_yr.value > base.ledger.winter_mwh_yr.value, "leakier glass costs winter heat");

// ---- grade
const gm = (res, fid) => mean(res[fid].grade);
const gBase = FM.computeAll(floors, base, meta, {});
const gBest = FM.computeAll(floors, sc90, meta, {});
meta.floors.forEach((fid) => {
  gBase[fid].grade.forEach((g) => { if (g !== null) assert.ok(g >= 0 && g <= 100, "grade range"); });
  assert.ok(gm(gBest, fid) < gm(gBase, fid), fid + ": screen90 grades better than baseline");
});
const off0 = JSON.parse(JSON.stringify(FM.GRADE_DEFAULTS)); Object.keys(off0.layers).forEach((k) => (off0.layers[k].on = false));
assert.strictEqual(gm(FM.computeAll(floors, base, meta, { grade: off0 }), "GF"), 0, "no layers on gives grade 0");
const dfOn = JSON.parse(JSON.stringify(FM.GRADE_DEFAULTS)); dfOn.layers.df.on = true;
assert.notStrictEqual(gm(FM.computeAll(floors, base, meta, { grade: dfOn }), "GF").toFixed(3), gm(gBase, "GF").toFixed(3), "adding daylight changes the grade");
// the daylight trade-off shows up in the grade
assert.ok(gm(FM.computeAll(floors, sc90, meta, { grade: dfOn }), "GF") > gm(gBest, "GF"), "darkening the room hurts the grade once daylight counts");

// ---- TM52
const cool = new Array(H).fill(20);
assert.strictEqual(FM.tm52Fails(cool, meta, 3), 0);
const hot = cool.slice(); hot[3] = 0.33 * meta.t_rm[0] + 18.8 + 3 + 5;
assert.strictEqual(FM.tm52Fails(hot, meta, 3), 1);

// ---- stratification raises the upper floor only
const r1 = FM.computeAll(floors, base, meta, { stratKperM: 1 });
assert.ok(mean(r1["5F"].kh) > mean(r0["5F"].kh), "stratification warms 5F");
assert.strictEqual(mean(r1.GF.kh).toFixed(6), mean(r0.GF.kh).toFixed(6));

console.log("model tests passed");

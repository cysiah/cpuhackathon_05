// Run: node tests/test_model.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const FM = require("../app/js/model.js");

const D = path.join(__dirname, "..", "app", "data");
const meta = JSON.parse(fs.readFileSync(path.join(D, "meta.json")));
const scen = JSON.parse(fs.readFileSync(path.join(D, "scenarios.json")));
const floors = {};
meta.floors.forEach((f) => (floors[f] = JSON.parse(fs.readFileSync(path.join(D, "floors", f + ".json")))));
const H = meta.days.length * meta.hours.length;

// data shape
meta.floors.forEach((fid) => {
  const f = floors[fid], n = f.x.length;
  ["y", "zone", "in_atrium", "svf", "sun_h", "rad_roof", "rad_fac", "df_roof", "df_fac"].forEach((k) =>
    assert.strictEqual(f[k].length, n, fid + "." + k + " length"));
  assert.strictEqual(f.dmrt_roof_x10.length, n * H, fid + " dmrt_roof hours");
  assert.strictEqual(f.dmrt_fac_x10.length, n * H, fid + " dmrt_fac hours");
});
scen.forEach((s) => assert.strictEqual(s.t_op_atrium.length, H, s.id + " hourly length"));

// TM52: an hour 5 K over the limit fails criterion 3; a cool week fails nothing
const cool = new Array(H).fill(20);
assert.strictEqual(FM.tm52Fails(cool, meta, 3), 0);
const hot = cool.slice(); hot[3] = 0.33 * meta.t_rm[0] + 18.8 + 3 + 5;
assert.strictEqual(FM.tm52Fails(hot, meta, 3), 1);

// calibration: with re-centring, the atrium floor averages back to the scenario score
scen.forEach((s) => {
  const r = FM.computeAll(floors, s, meta, {});
  const f = floors[meta.floors[0]];
  let sum = 0, n = 0;
  for (let i = 0; i < f.x.length; i++) if (f.in_atrium[i] && r[meta.floors[0]].kh[i] !== null) { sum += r[meta.floors[0]].kh[i]; n++; }
  const mean = sum / n;
  assert.ok(Math.abs(mean - s.atrium_score_kh) < 0.1 * s.atrium_score_kh + 3,
    s.id + ": atrium mean " + mean.toFixed(1) + " vs " + s.atrium_score_kh);
});

// void points carry no values
const r0 = FM.computeAll(floors, scen[0], meta, {});
meta.floors.forEach((fid) => floors[fid].zone.forEach((z, i) => {
  if (z === FM.ZONE.VOID) assert.strictEqual(r0[fid].kh[i], null);
}));

// stratification raises upper floors only
const r1 = FM.computeAll(floors, scen[0], meta, { stratKperM: 1 });
const up = meta.floors[meta.floors.length - 1];
const idx = floors[up].zone.findIndex((z) => z !== FM.ZONE.VOID);
assert.ok(r1[up].kh[idx] > r0[up].kh[idx], "stratification warms " + up);
assert.strictEqual(r1[meta.floors[0]].kh[0].toFixed(6), r0[meta.floors[0]].kh[0].toFixed(6));

console.log("model tests passed");

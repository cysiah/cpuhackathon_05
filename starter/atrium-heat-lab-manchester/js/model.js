/* model.js - the maths behind the app. No drawing here, so you can test and extend it.
 *
 *  - Surrogate: multilinear interpolation over the full-factorial EnergyPlus sweep
 *    (data/sweep.json). Exact at simulated grid points, interpolated between them,
 *    and the error between them is MEASURED against off-grid validation runs.
 *  - Proxies: simple, clearly labelled estimates for things EnergyPlus did not
 *    calculate here (daylight, winter heat loss, ventilation opening area).
 *    Every assumption is a parameter in PARAMS so teams can challenge it.
 */
window.HeatLab = window.HeatLab || {};
(function (H) {
  'use strict';

  // ---------- editable assumptions (shown and editable in the Assumptions section) ----------
  H.PARAMS = {
    glassArea: 1351,      // m2 of atrium glazing (measured from the model)
    floorArea: 1010.5,    // m2, reference atrium floor
    volume: 21600,        // m3, reference atrium volume (approx.)
    internalArea: 4750,   // m2, all internal surfaces (floor + roof + walls)
    lsg: 1.3,             // light-to-solar-gain ratio: visible transmittance = lsg x g
    vtMax: 0.85,          // cap on visible transmittance
    frame: 0.75,          // fraction of glazed area left after frames / structure
    theta: 180,           // degrees of visible sky for a roof light (BRE formula)
    maintenance: 0.8,     // dirt on glass
    reflectance: 0.5,     // mean internal surface reflectance
    heatingBase: 18,      // C, base temperature for winter heat-loss degree-hours
    stackHeight: 20,      // m between low and high vents
    stackDeltaT: 3,       // K, inside-outside difference driving stack ventilation
    dischargeCoef: 0.6,
  };

  H.LEVER_META = {
    g: { label: 'Glazing g-value', unit: '', fmt: (v) => v.toFixed(2) },
    u: { label: 'Glazing U-value', unit: 'W/m²K', fmt: (v) => v.toFixed(1) },
    ach_day: { label: 'Day ventilation', unit: 'ACH', fmt: (v) => v.toFixed(1) },
    ach_night: { label: 'Night ventilation', unit: 'ACH', fmt: (v) => v.toFixed(1) },
    screen_opacity: { label: 'Roof screen opacity', unit: '', fmt: (v) => Math.round(v * 100) + '%' },
  };

  // ---------- data loading ----------
  H.load = async function () {
    const names = ['baseline', 'climate', 'sweep', 'radiation', 'context'];
    const out = {};
    await Promise.all(names.map(async (n) => {
      const r = await fetch('data/' + n + '.json');
      if (!r.ok) throw new Error('Could not load data/' + n + '.json (' + r.status + ')');
      out[n] = await r.json();
    }));
    // optional: catalogue of analyses and interventions (labels only, the app runs without it)
    try { const r = await fetch('data/design_catalogue.json'); out.catalogue = r.ok ? await r.json() : null; } catch (e) { out.catalogue = null; }
    return out;
  };

  // ---------- surrogate ----------
  H.Surrogate = function (sweep) {
    this.keys = Object.keys(sweep.levers);
    this.levels = this.keys.map((k) => sweep.levers[k].slice().sort((a, b) => a - b));
    this.table = new Map();
    for (const r of sweep.grid) this.table.set(this.key(this.keys.map((k) => r[k])), r);
    this.scalars = ['score', 'peak', 'h26', 'h28', 'h30', 'solar_kwh'];
  };
  H.Surrogate.prototype.key = function (vals) { return vals.map((v) => +(+v).toFixed(4)).join('|'); };
  H.Surrogate.prototype.bracket = function (i, v) {
    const L = this.levels[i];
    if (v <= L[0]) return [0, 0, 0];
    if (v >= L[L.length - 1]) return [L.length - 1, L.length - 1, 0];
    let j = 0;
    while (L[j + 1] < v) j++;
    return [j, j + 1, (v - L[j]) / (L[j + 1] - L[j])];
  };
  /** Interpolate every metric (and the hourly operative temperature) for a design. */
  H.Surrogate.prototype.predict = function (design) {
    const br = this.keys.map((k, i) => this.bracket(i, design[k]));
    const exact = br.every((b) => b[2] < 1e-9 || b[2] > 1 - 1e-9);
    const out = { exact: exact, operative: null };
    this.scalars.forEach((s) => (out[s] = 0));
    const n = this.keys.length;
    for (let mask = 0; mask < 1 << n; mask++) {
      let w = 1;
      const vals = [];
      for (let i = 0; i < n; i++) {
        const [j0, j1, t] = br[i];
        const hi = (mask >> i) & 1;
        w *= hi ? t : 1 - t;
        vals.push(this.levels[i][hi ? j1 : j0]);
      }
      if (w < 1e-12) continue;
      const r = this.table.get(this.key(vals));
      if (!r) continue;
      this.scalars.forEach((s) => (out[s] += w * r[s]));
      if (!out.operative) out.operative = new Array(r.operative.length).fill(0);
      r.operative.forEach((v, h) => (out.operative[h] += w * v));
    }
    return out;
  };
  /** Compare interpolation with EnergyPlus runs that are NOT on the grid. */
  H.Surrogate.prototype.validate = function (validation) {
    const errs = validation.map((r) => this.predict(r).score - r.score);
    if (!errs.length) return null;
    const rmse = Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length);
    const maxAbs = Math.max(...errs.map(Math.abs));
    const bias = errs.reduce((a, e) => a + e, 0) / errs.length;
    return { n: errs.length, rmse: rmse, max: maxAbs, bias: bias, errors: errs };
  };

  // ---------- proxies ----------
  H.heatingDegreeHours = function (dryBulb, base) {
    return dryBulb.reduce((a, t) => a + Math.max(0, base - t), 0);
  };
  /** BRE average daylight factor for the roof-lit atrium floor, in %. */
  H.daylightFactor = function (d, P) {
    const vt = Math.min(P.vtMax, P.lsg * d.g) * (1 - d.screen_opacity);
    // DF% = T * Aw * theta * M / (A * (1 - R^2))  (theta in degrees gives a percentage)
    return (vt * P.glassArea * P.frame * P.theta * P.maintenance) /
      (P.internalArea * (1 - P.reflectance * P.reflectance));
  };
  /** Conduction loss through the atrium glazing over a present-day year, kWh. */
  H.winterLoss = function (d, P, hdh) { return (d.u * P.glassArea * hdh) / 1000; };
  /** Free opening area needed (top and bottom) to drive the day ventilation by stack effect, m2. */
  H.ventArea = function (ach, P) {
    const q = (ach * P.volume) / 3600;
    const v = P.dischargeCoef * Math.sqrt((2 * 9.81 * P.stackHeight * P.stackDeltaT) / 293);
    return q / v;
  };

  // ---------- metric catalogue (drives every chart and picker) ----------
  H.metrics = function (P, hdh) {
    return {
      score: { label: 'Overheat score', unit: 'K·h', better: 'low', source: 'EnergyPlus', get: (d, r) => r.score },
      peak: { label: 'Peak operative temp', unit: '°C', better: 'low', source: 'EnergyPlus', get: (d, r) => r.peak },
      h28: { label: 'Occupied hours > 28 °C', unit: 'h', better: 'low', source: 'EnergyPlus', get: (d, r) => r.h28 },
      solar_kwh: { label: 'Solar through glazing', unit: 'kWh/wk', better: 'low', source: 'EnergyPlus', get: (d, r) => r.solar_kwh },
      df: { label: 'Daylight (avg DF)', unit: '%', better: 'high', source: 'proxy', get: (d) => H.daylightFactor(d, P) },
      winter: { label: 'Winter glazing loss', unit: 'MWh/yr', better: 'low', source: 'proxy', get: (d) => H.winterLoss(d, P, hdh) / 1000 },
      vent: { label: 'Vent opening needed', unit: 'm²', better: 'low', source: 'proxy', get: (d) => H.ventArea(Math.max(d.ach_day, d.ach_night), P) },
    };
  };

  /** Indices of the non-dominated points for two metrics (with their better-directions). */
  H.pareto = function (pts, bx, by) {
    const sx = bx === 'low' ? 1 : -1, sy = by === 'low' ? 1 : -1;
    const idx = pts.map((p, i) => i).sort((a, b) => sx * (pts[a].x - pts[b].x) || sy * (pts[a].y - pts[b].y));
    const front = [];
    let best = Infinity;
    for (const i of idx) {
      const y = sy * pts[i].y;
      if (y < best - 1e-9) { front.push(i); best = y; }
    }
    return front;
  };

  /** One-at-a-time ranges from the baseline + main effects averaged over the whole grid. */
  H.sensitivity = function (sur, baseline, metricKey, get) {
    const oat = sur.keys.map((k, i) => {
      const vals = sur.levels[i].map((lv) => {
        const d = Object.assign({}, baseline, { [k]: lv });
        return { level: lv, value: get(d, sur.predict(d)) };
      });
      return { key: k, vals: vals };
    });
    const main = sur.keys.map((k, i) => ({
      key: k,
      vals: sur.levels[i].map((lv) => {
        const rows = [];
        sur.table.forEach((r) => { if (Math.abs(r[k] - lv) < 1e-9) rows.push(get(r, r)); });
        return { level: lv, value: rows.reduce((a, b) => a + b, 0) / rows.length };
      }),
    }));
    return { oat: oat, main: main };
  };

  H.band = function (score) {
    return score <= 42 ? 'PASS' : score <= 150 ? 'MARGINAL' : score <= 400 ? 'OVERHEATING' : 'SEVERE';
  };
})(window.HeatLab);

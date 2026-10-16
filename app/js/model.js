/* Floorplate Heat Map: the maths. No DOM code here, so it runs in Node for tests.
 *
 * Point operative temperature, per occupied hour h:
 *   T(i,h) = T_atrium(h)                      EnergyPlus zone operative temp (one value)
 *          + strat * level_m                  A18 assumed vertical gradient
 *          + (enclosed ? enclosedOffset : 0)  A19 enclosed rooms are not simulated
 *          + 0.5 * (dMRT(i,h) - dMRT_cal(h))  SolarCal estimate, re-centred so the
 *                                             atrium floor averages back to EnergyPlus (A20)
 */
(function (root) {
  "use strict";

  var ZONE = { ENCLOSED: 0, OPEN: 1, VOID: 2 };
  var ZONE_NAMES = ["enclosed", "open", "void"];

  var LAYERS = {
    kh:     { label: "Overheating", unit: "K·h > 26 °C", source: "derived + estimate", better: "lower", dp: 0 },
    tm52:   { label: "TM52 criteria failed", unit: "of 3", source: "derived + estimate (1-week stress test)", better: "lower", dp: 0 },
    peak:   { label: "Peak operative temp", unit: "°C", source: "derived + estimate", better: "lower", dp: 1 },
    dmrt:   { label: "Mean solar MRT rise", unit: "K", source: "estimate (SolarCal)", better: "lower", dp: 1 },
    sun_h:  { label: "Sun hours (hot week)", unit: "h", source: "Ladybug", better: "lower", dp: 0 },
    rad:    { label: "Transmitted solar", unit: "kWh/m²", source: "Ladybug, scaled per scenario", better: "lower", dp: 1 },
    df:     { label: "Daylight factor", unit: "%", source: "proxy", better: "higher", dp: 1 }
  };

  var DEFAULT_PARAMS = {
    threshold: 26,          // official comfort threshold, °C operative
    stratKperM: 0,          // A18
    enclosedOffsetK: 0,     // A19
    calibrate: true,        // A20
    tm52CatK: 3,            // A21 Category II
    // hotspot thresholds (A22)
    hotKh: 42,              // official PASS band upper limit, per point
    darkDf: 2,              // %
    sunnyH: 20
  };

  function nHours(meta) { return meta.days.length * meta.hours.length; }

  function pointDmrt(floor, scen, i, h, H) {
    var k = i * H + h;
    return floor.dmrt_roof_x10[k] / 10 * scen.solar_mult.roof +
           floor.dmrt_fac_x10[k] / 10 * scen.solar_mult.facade;
  }

  /* Hourly mean dMRT over the atrium floor of the calibration floor (lowest level). */
  function calibrationSeries(floors, scen, meta) {
    var H = nHours(meta), out = new Array(H).fill(0);
    var f = floors[meta.floors[0]];
    var idx = [];
    for (var i = 0; i < f.x.length; i++) if (f.in_atrium[i] && f.zone[i] !== ZONE.VOID) idx.push(i);
    if (!idx.length) return out;
    for (var h = 0; h < H; h++) {
      var s = 0;
      for (var j = 0; j < idx.length; j++) s += pointDmrt(f, scen, idx[j], h, H);
      out[h] = s / idx.length;
    }
    return out;
  }

  function tm52Fails(temps, meta, catK) {
    var perDay = meta.hours.length, H = temps.length;
    var c1 = 0, c2 = false, c3 = false;
    for (var d = 0; d < meta.days.length; d++) {
      var tmax = 0.33 * meta.t_rm[d] + 18.8 + catK, we = 0;
      for (var k = 0; k < perDay; k++) {
        var dt = Math.round(temps[d * perDay + k] - tmax);
        if (dt >= 1) c1++;
        if (dt > 0) we += dt;
        if (dt > 4) c3 = true;
      }
      if (we > 6) c2 = true;
    }
    return (c1 / H > 0.03 ? 1 : 0) + (c2 ? 1 : 0) + (c3 ? 1 : 0);
  }

  /* All layers for one floor under one scenario. Void points get null. */
  function computeFloor(floor, scen, meta, params, cal) {
    var p = Object.assign({}, DEFAULT_PARAMS, params || {});
    var H = nHours(meta), n = floor.x.length;
    var levelM = floor.level_mm / 1000;
    var out = { kh: [], tm52: [], peak: [], dmrt: [], sun_h: [], rad: [], df: [] };
    var temps = new Array(H);
    for (var i = 0; i < n; i++) {
      if (floor.zone[i] === ZONE.VOID) {
        for (var key in out) out[key].push(null);
        continue;
      }
      var base = p.stratKperM * levelM + (floor.zone[i] === ZONE.ENCLOSED ? p.enclosedOffsetK : 0);
      var kh = 0, peak = -Infinity, sumD = 0;
      for (var h = 0; h < H; h++) {
        var d = pointDmrt(floor, scen, i, h, H);
        sumD += d;
        var t = scen.t_op_atrium[h] + base + 0.5 * (d - (p.calibrate ? cal[h] : 0));
        temps[h] = t;
        if (t > p.threshold) kh += t - p.threshold;
        if (t > peak) peak = t;
      }
      out.kh.push(kh);
      out.peak.push(peak);
      out.dmrt.push(sumD / H);
      out.tm52.push(tm52Fails(temps, meta, p.tm52CatK));
      out.sun_h.push(floor.sun_h[i]);
      out.rad.push(floor.rad_roof[i] * scen.solar_mult.roof + floor.rad_fac[i] * scen.solar_mult.facade);
      out.df.push(floor.df_roof[i] * scen.daylight_mult.roof + floor.df_fac[i] * scen.daylight_mult.facade);
    }
    return out;
  }

  function computeAll(floors, scen, meta, params) {
    var cal = calibrationSeries(floors, scen, meta), res = {};
    meta.floors.forEach(function (fid) { res[fid] = computeFloor(floors[fid], scen, meta, params, cal); });
    return res;
  }

  function hotspot(r, i, params) {
    var p = Object.assign({}, DEFAULT_PARAMS, params || {});
    if (r.kh[i] === null) return null;
    var flags = {
      hot: r.kh[i] > p.hotKh,
      tm52: r.tm52[i] >= 2,
      dark: r.df[i] < p.darkDf,
      sunny: r.sun_h[i] > p.sunnyH
    };
    var count = 0;
    for (var k in flags) if (flags[k]) count++;
    return { count: count, flags: flags };
  }

  function range(arrays) {
    var lo = Infinity, hi = -Infinity;
    arrays.forEach(function (a) {
      for (var i = 0; i < a.length; i++) {
        var v = a[i];
        if (v === null || !isFinite(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    });
    if (lo === Infinity) return [0, 1];
    if (hi === lo) hi = lo + 1;
    return [lo, hi];
  }

  /* Tertile cut points over all non-null values. */
  function tertiles(arrays) {
    var v = [];
    arrays.forEach(function (a) { a.forEach(function (x) { if (x !== null) v.push(x); }); });
    v.sort(function (a, b) { return a - b; });
    if (!v.length) return [0, 0];
    return [v[Math.floor(v.length / 3)], v[Math.floor(2 * v.length / 3)]];
  }

  function classOf(v, cuts) { return v <= cuts[0] ? 0 : v <= cuts[1] ? 1 : 2; }

  /* Per zone type summary for one floor. */
  function zoneSummary(floor, r, params) {
    var p = Object.assign({}, DEFAULT_PARAMS, params || {});
    var cell = Math.pow(floor.grid_mm / 1000, 2), rows = {};
    for (var i = 0; i < floor.x.length; i++) {
      var z = ZONE_NAMES[floor.zone[i]];
      var row = rows[z] || (rows[z] = { area: 0, n: 0, kh: 0, hotArea: 0, tm52Area: 0, df: 0 });
      row.area += cell;
      if (r.kh[i] === null) continue;
      row.n++;
      row.kh += r.kh[i];
      row.df += r.df[i];
      if (r.kh[i] > p.hotKh) row.hotArea += cell;
      if (r.tm52[i] >= 2) row.tm52Area += cell;
    }
    Object.keys(rows).forEach(function (z) {
      var row = rows[z];
      row.kh = row.n ? row.kh / row.n : null;
      row.df = row.n ? row.df / row.n : null;
    });
    return rows;
  }

  var api = {
    ZONE: ZONE, ZONE_NAMES: ZONE_NAMES, LAYERS: LAYERS, DEFAULT_PARAMS: DEFAULT_PARAMS,
    computeAll: computeAll, computeFloor: computeFloor, calibrationSeries: calibrationSeries,
    tm52Fails: tm52Fails, hotspot: hotspot, range: range, tertiles: tertiles, classOf: classOf,
    zoneSummary: zoneSummary
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FM = api;
})(this);

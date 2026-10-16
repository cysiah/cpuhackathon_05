/* Scenarios from the EnergyPlus sweep (js/sweep.js, the organisers' 3,125 runs).
 * A scenario is a setting of five levers. Its hourly atrium temperature is the multilinear
 * interpolation of the simulated runs (exact on grid points, +-4.8 K.h typical elsewhere, measured).
 * The per-point sun data is stored for the baseline glass and scaled here:
 *   roof glazing   x (g / 0.6) x (1 - screen opacity)
 *   clerestory     x (g / 0.6)
 * Maths for the surrogate is the same as the starter app's model.js / js/explorer.js. */
(function (root) {
  "use strict";
  var LEVER_KEYS = ["g", "u", "ach_day", "ach_night", "screen_opacity"];
  var LEVER_META = {
    g:              { label: "Glass g-value",    unit: "",      dp: 2, step: 0.01, rung: 1 },
    u:              { label: "Glass U-value",    unit: "W/m²K", dp: 1, step: 0.1,  rung: 1 },
    ach_day:        { label: "Day ventilation",  unit: "ACH",   dp: 1, step: 0.1,  rung: 3 },
    ach_night:      { label: "Night ventilation", unit: "ACH",  dp: 1, step: 0.1,  rung: 2 },
    screen_opacity: { label: "Roof screen",      unit: "opacity", dp: 2, step: 0.01, rung: 1 }
  };
  // The starter app's proxy assumptions (editable there; fixed here, shown in the ledger as 'proxy')
  var P = { glassArea: 1351, internalArea: 4750, volume: 21600, lsg: 1.3, vtMax: 0.85, frame: 0.75,
            theta: 180, maintenance: 0.8, reflectance: 0.5, sfp: 1.5, occHours: 10 };

  var PRESETS = [
    { id: "base",      name: "Existing atrium",                          levers: {} },
    { id: "screen25",  name: "Roof screen 25%",                          levers: { screen_opacity: 0.25 } },
    { id: "screen50",  name: "Roof screen 50%",                          levers: { screen_opacity: 0.5 } },
    { id: "screen75",  name: "Roof screen 75%",                          levers: { screen_opacity: 0.75 } },
    { id: "screen90",  name: "Roof screen 90%",                          levers: { screen_opacity: 0.9 } },
    { id: "g035",      name: "Solar-control glass, g 0.35",              levers: { g: 0.35 } },
    { id: "g020",      name: "Very low-g glass, g 0.2",                  levers: { g: 0.2 } },
    { id: "night6",    name: "Night purge 6 ACH",                        levers: { ach_night: 6 } },
    { id: "night10",   name: "Night purge 10 ACH",                       levers: { ach_night: 10 } },
    { id: "day10",     name: "Day ventilation 10 ACH",                   levers: { ach_day: 10 } },
    { id: "combo",     name: "g 0.35 + screen 25% + night purge 6 ACH",  levers: { g: 0.35, screen_opacity: 0.25, ach_night: 6 } }
  ];

  var S = null, K = LEVER_KEYS, LV, stride, OP, HOURS = 168;

  function init(sweep) {
    S = sweep; LV = S.levels;
    stride = K.map(function (_, i) { return LV.slice(i + 1).reduce(function (a, l) { return a * l.length; }, 1); });
    var raw = typeof atob === "function" ? atob(S.op) : Buffer.from(S.op, "base64").toString("binary");
    OP = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) OP[i] = raw.charCodeAt(i);
    var errs = S.validation.map(function (r) { return predict(r, false).score - r.score; });
    api.VAL = { n: errs.length, rmse: Math.sqrt(errs.reduce(function (a, e) { return a + e * e; }, 0) / errs.length),
                max: Math.max.apply(null, errs.map(Math.abs)) };
    api.BASE = Object.assign({}, S.base);
    api.ready = true;
  }

  function bracket(i, v) {
    var L = LV[i];
    if (v <= L[0]) return [0, 0, 0];
    if (v >= L[L.length - 1]) return [L.length - 1, L.length - 1, 0];
    var j = 0;
    while (L[j + 1] < v) j++;
    return [j, j + 1, (v - L[j]) / (L[j + 1] - L[j])];
  }

  function predict(d, withHours) {
    var br = K.map(function (k, i) { return bracket(i, d[k]); });
    var out = { exact: br.every(function (b) { return b[2] < 1e-9 || b[2] > 1 - 1e-9; }), score: 0, peak: 0, h28: 0, solar: 0 };
    if (withHours) out.op = new Float32Array(HOURS);
    for (var mask = 0; mask < 1 << K.length; mask++) {
      var w = 1, idx = 0;
      for (var i = 0; i < K.length; i++) {
        var b = br[i], hi = (mask >> i) & 1;
        w *= hi ? b[2] : 1 - b[2];
        idx += (hi ? b[1] : b[0]) * stride[i];
      }
      if (w < 1e-12) continue;
      out.score += w * S.score[idx]; out.peak += w * S.peak[idx]; out.h28 += w * S.h28[idx]; out.solar += w * S.solar[idx];
      if (withHours) for (var h = 0; h < HOURS; h++) out.op[h] += w * (S.opMin + OP[idx * HOURS + h] * S.opStep);
    }
    return out;
  }

  var tvis = function (g) { return Math.min(P.vtMax, P.lsg * g); };
  function daylightPct(d) {
    return (tvis(d.g) * (1 - d.screen_opacity) * P.glassArea * P.frame * P.theta * P.maintenance) / (P.internalArea * (1 - P.reflectance * P.reflectance));
  }
  var winterMwh = function (d) { return (d.u * P.glassArea * S.hdh) / 1e6; };
  var fanKwhWk = function (d) { return (P.sfp * ((d.ach_night * P.volume) / 3.6) * (7 * (24 - P.occHours))) / 1000; };

  function rungsOf(d) {
    var r = [];
    K.forEach(function (k) { if (Math.abs(d[k] - S.base[k]) > 1e-9 && r.indexOf(LEVER_META[k].rung) < 0) r.push(LEVER_META[k].rung); });
    return r.sort();
  }

  /** Build a scenario object the model understands, from lever values and the floor meta. */
  function build(id, name, levers, meta) {
    var d = Object.assign({}, S.base, levers || {});
    var pr = predict(d, true), base = api.baseline;
    var hrs = [];
    for (var day = 0; day < meta.days.length; day++) meta.hours.forEach(function (h) { hrs.push(day * 24 + h); });
    var m = { roof: (d.g / S.base.g) * (1 - d.screen_opacity), fac: d.g / S.base.g };
    var dl = daylightPct(d), dl0 = base ? base.daylightPct : dl;
    var rungs = rungsOf(d);
    return {
      id: id, name: name, levers: d, rungs: rungs, rung: rungs.length ? rungs[0] : 0,
      atrium_score_kh: Math.round(pr.score * 10) / 10, score_source: pr.exact ? "EnergyPlus" : "interpolated",
      score_error_kh: pr.exact ? 0 : api.VAL.rmse,
      peak_c: pr.peak, solar_kwh: pr.solar,
      t_op_atrium: hrs.map(function (h) { return pr.op[h]; }),
      t_op_source: pr.exact ? "EnergyPlus" : "interpolated",
      solar_mult: { roof: m.roof, facade: m.fac },
      daylight_mult: { roof: (tvis(d.g) / tvis(S.base.g)) * (1 - d.screen_opacity), facade: tvis(d.g) / tvis(S.base.g) },
      daylightPct: dl,
      ledger: {
        daylight_pct: { value: Math.round(dl * 10) / 10, source: "proxy" },
        fan_kwh_wk: { value: Math.round(fanKwhWk(d)), source: "proxy" },
        winter_mwh_yr: { value: Math.round(winterMwh(d) * 10) / 10, source: "proxy" },
        embodied_tco2e: { value: null, source: "needs input" },
        cost_gbp: { value: null, source: "needs input" }
      }
    };
  }

  /** Exhaustive search over the 3,125 simulated designs for the lowest atrium score meeting a daylight floor. */
  function bestWithDaylight(minPct) {
    var best = null;
    for (var a = 0; a < LV[0].length; a++) for (var b = 0; b < LV[1].length; b++) for (var c = 0; c < LV[2].length; c++)
      for (var e = 0; e < LV[3].length; e++) for (var f = 0; f < LV[4].length; f++) {
        var d = { g: LV[0][a], u: LV[1][b], ach_day: LV[2][c], ach_night: LV[3][e], screen_opacity: LV[4][f] };
        if (daylightPct(d) < minPct) continue;
        var idx = a * stride[0] + b * stride[1] + c * stride[2] + e * stride[3] + f * stride[4];
        if (!best || S.score[idx] < best.score) best = { score: S.score[idx], levers: d };
      }
    return best;
  }

  /** Count of simulated designs with score <= limit. */
  function countPass(limit) { var n = 0; for (var i = 0; i < S.score.length; i++) if (S.score[i] <= limit) n++; return n; }

  var api = {
    LEVER_KEYS: LEVER_KEYS, LEVER_META: LEVER_META, PRESETS: PRESETS, P: P,
    init: init, predict: predict, build: build, bestWithDaylight: bestWithDaylight, countPass: countPass,
    daylightPct: daylightPct, winterMwh: winterMwh, fanKwhWk: fanKwhWk, ready: false, baseline: null, VAL: null, BASE: null,
    levels: function () { return LV; }, sweep: function () { return S; }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SC = api;
})(this);

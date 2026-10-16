/* mechanisms.js - analyses built from the data we already have, no new simulation.
 * Each one is labelled by what it really is (see data/design_catalogue.json, field "now"):
 *  - 'derived': post-processing of EnergyPlus hourly results. Exact on simulated designs,
 *    interpolated between them (same error as the surrogate).
 *  - 'proxy':   simple physics on top of those results; assumptions live in H.PARAMS.
 * Interventions that are NOT levers in the sweep are applied by H.withExtras() as
 * approximations, kept apart from the simulated results. */
window.HeatLab = window.HeatLab || {};
(function (H) {
  'use strict';
  const RHO_CP = (1.2 * 1005) / 3600;  // Wh per m3 per K for air
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  Object.assign(H.PARAMS, {
    eplusQint: 5,       // W/m2 internal gains inside the EnergyPlus model (Q_INT in sweep_atrium.py) - not editable here
    ventFreeArea: 20,   // m2 free opening area assumed installed, top and bottom - ASSUMPTION
    solarUtil: 0.5,     // share of winter solar gain through the atrium glass that offsets heating
    tm52Cat: 3,         // K above the adaptive comfort temperature (TM52 Category II = 3)
    sfp: 1.5,           // W per l/s, specific fan power if night purge is mechanical
    pvEff: 0.15,        // PV yield per unit incident solar for PV-fritted glass (incl. losses)
  });

  // ---------- shared context, built once from the data ----------
  H.mechInit = function (data) {
    const c = data.climate, wk0 = c.hot_week.start_hoy, fut = c.dry_bulb.future;
    // TM52 running mean of daily mean outdoor temperature (alpha 0.8), from 1 Jan so the hot week has history
    const dm = [];
    for (let d = 0; d < 365; d++) dm.push(mean(fut.slice(d * 24, d * 24 + 24)));
    const trm = [dm[0]];
    for (let d = 1; d < 365; d++) trm.push(0.2 * dm[d - 1] + 0.8 * trm[d - 1]);

    // atrium glazing elements, by true compass direction (north is CCW from +Y)
    const r = data.radiation, north = (data.context && data.context.north_deg) || 0, el = {};
    r.category.forEach((cat, i) => {
      if (!cat.startsWith('atrium')) return;
      const v = r.faces[i].map((k) => r.vertices[k]);
      let nx = 0, ny = 0;
      v.forEach((a, k) => { const b = v[(k + 1) % v.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); });
      const az = (((Math.atan2(nx, ny) * 180) / Math.PI + north) % 360 + 360) % 360;
      const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(((az + 22.5) % 360) / 45)];
      const roof = cat === 'atrium_roof', key = (roof ? 'Roof ' : 'Clerestory ') + dir;
      const e = (el[key] = el[key] || { key: key, roof: roof, south: roof && az > 90 && az < 270, area: 0, hot: 0, annual: 0 });
      e.area += r.area_m2[i]; e.hot += r.results.hot_week[i] * r.area_m2[i]; e.annual += r.results.annual[i] * r.area_m2[i];
    });
    const elements = Object.values(el).sort((a, b) => b.hot - a.hot);
    const hotTot = elements.reduce((s, e) => s + e.hot, 0);
    elements.forEach((e) => (e.share = e.hot / hotTot));

    H.ctx = {
      occ: c.occupied_hours, ghiYear: c.ghi, present: c.dry_bulb.present,
      out: fut.slice(wk0, wk0 + 168), ghi: c.ghi.slice(wk0, wk0 + 168),
      trm: Array.from({ length: 168 }, (_, h) => trm[Math.floor((wk0 + h) / 24)]),
      elements: elements, annualKwh: elements.reduce((s, e) => s + e.annual, 0),
      daylightHours: c.ghi.filter((g) => g > 0).length,
    };
  };
  const occupied = (h) => { const t = h % 24; return t >= H.ctx.occ[0] && t < H.ctx.occ[1]; };

  // ---------- overheating metrics from any hourly operative series ----------
  H.scoreOf = function (op) {
    let score = 0, h28 = 0;
    op.forEach((v, h) => { if (occupied(h)) { score += Math.max(0, v - 26); if (v > 28) h28++; } });
    return { score: score, h28: h28, peak: Math.max(...op) };
  };

  /** CIBSE TM52 adaptive criteria (derived). Hot week only: criterion 1 is normally over May-September. */
  H.tm52 = function (op, P) {
    let he = 0, n = 0, dtMax = -Infinity;
    const we = new Array(Math.ceil(op.length / 24)).fill(0);
    op.forEach((v, h) => {
      if (!occupied(h)) return;
      n++;
      const dT = Math.round(v - (0.33 * H.ctx.trm[h] + 18.8 + P.tm52Cat));
      if (dT >= 1) he++;
      if (dT > 0) we[Math.floor(h / 24)] += dT;
      dtMax = Math.max(dtMax, dT);
    });
    const r = { he: he, heLimit: 0.03 * n, weMax: Math.max(...we), dtMax: dtMax };
    r.c1 = r.he <= r.heLimit; r.c2 = r.weMax <= 6; r.c3 = r.dtMax <= 4;
    r.fails = [r.c1, r.c2, r.c3].filter((ok) => !ok).length;
    return r;
  };

  /** Night-flush check (derived): temperature before occupancy and overnight drop. */
  H.nightFlush = function (op) {
    const [o0, o1] = H.ctx.occ, morning = [], drop = [], out = [];
    for (let d = 0; d * 24 + 23 < op.length; d++) {
      morning.push(op[d * 24 + o0 - 1]); out.push(H.ctx.out[d * 24 + o0 - 1]);
      if (d > 0) drop.push(op[(d - 1) * 24 + o1 - 1] - op[d * 24 + o0 - 1]);
    }
    return { morning: mean(morning), drop: mean(drop), outMorning: mean(out) };
  };

  /** Weekly heat balance (Wh). Solar = EnergyPlus; gains = model input; ventilation and glass
   *  conduction rebuilt from hourly operative vs outdoor (operative stands in for air temperature);
   *  residual = what went into the thermal mass plus every error above. */
  H.heatBalance = function (d, r, P) {
    let vent = 0, glass = 0, gains = 0;
    r.operative.forEach((ti, h) => {
      const occ = occupied(h), dT = ti - H.ctx.out[h];
      vent += RHO_CP * (occ ? d.ach_day : d.ach_night) * P.volume * dT;
      glass += d.u * P.glassArea * dT;
      if (occ) gains += P.eplusQint * P.floorArea;
    });
    const solar = r.solar_kwh * 1000;
    return { solar: solar, gains: gains, vent: vent, glass: glass, residual: solar + gains - vent - glass };
  };

  /** EnergyPlus transmitted solar split by each element's share of hot-week incident radiation (proxy). */
  H.solarByElement = (r) => H.ctx.elements.map((e) => ({ key: e.key, area: e.area, kwh: e.share * r.solar_kwh }));

  /** Stack ventilation each occupied hour through P.ventFreeArea, no wind (proxy, conservative). */
  H.stackAch = function (d, r, P) {
    let ok = 0, n = 0, sum = 0;
    r.operative.forEach((ti, h) => {
      if (!occupied(h)) return;
      const dT = Math.max(0, ti - H.ctx.out[h]);
      const q = P.dischargeCoef * P.ventFreeArea * Math.sqrt((2 * 9.81 * P.stackHeight * dT) / (273.15 + H.ctx.out[h]));
      const ach = (q * 3600) / P.volume;
      n++; sum += ach; if (ach >= d.ach_day - 1e-9) ok++;
    });
    return { pct: (100 * ok) / n, mean: sum / n };
  };

  /** Cooling to hold 26 C in occupied hours, steady state: H x (Ti - 26). Ignores thermal mass (proxy). */
  H.coolingNeed = function (d, r, P) {
    let wh = 0;
    r.operative.forEach((ti, h) => {
      if (occupied(h) && ti > 26) wh += (RHO_CP * d.ach_day * P.volume + d.u * P.glassArea) * (ti - 26);
    });
    return wh;
  };

  /** Fan energy if the night purge were mechanical, kWh per week (proxy). */
  H.nightFanKwh = function (d, P) {
    const nightHours = 7 * (24 - (H.ctx.occ[1] - H.ctx.occ[0]));
    return (P.sfp * ((d.ach_night * P.volume) / 3.6) * nightHours) / 1000;
  };

  /** Useful winter solar through the atrium glass, kWh/yr: annual incident x share falling in heating hours. */
  H.winterSolar = function (d, P) {
    const c = H.ctx;
    if (c.fHeatBase !== P.heatingBase) {
      let tot = 0, heat = 0;
      c.ghiYear.forEach((g, i) => { tot += g; if (c.present[i] < P.heatingBase) heat += g; });
      c.fHeat = heat / tot; c.fHeatBase = P.heatingBase;
    }
    return c.annualKwh * c.fHeat * d.g * P.frame * P.solarUtil;
  };

  /** Elevated air speed comfort allowance, K (ASHRAE 55 adaptive: 0.6 / 0.9 / 1.2 m/s -> 1.2 / 1.8 / 2.2 K). */
  H.fanCooling = function (v) {
    const pts = [[0.3, 0], [0.6, 1.2], [0.9, 1.8], [1.2, 2.2]];
    if (v <= pts[0][0]) return 0;
    for (let i = 1; i < pts.length; i++) {
      if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((v - x0) * (y1 - y0)) / (x1 - x0); }
    }
    return pts[pts.length - 1][1];
  };

  // ---------- interventions that are not sweep levers (approximations) ----------
  H.EXTRAS_DEFAULT = { southRoofKept: 1, frit: 0, dynOpacity: 0, dynTrigger: 250, airSpeed: 0.1, qInt: 5 };

  /** Apply the extra interventions X to design d. Returns felt/actual metrics and every simplification made. */
  H.withExtras = function (sur, d, X, P) {
    const c = H.ctx, notes = [];
    // 1. less south-roof glass and frit -> equivalent g (admitted solar scales with incident x area kept)
    let kept = 0;
    c.elements.forEach((e) => { kept += e.share * (e.roof ? (e.south ? X.southRoofKept : 1) * (1 - X.frit) : 1); });
    const gEff = d.g * kept, gMin = sur.levels[sur.keys.indexOf('g')][0];
    if (gEff < gMin - 1e-9) notes.push('Equivalent g ' + gEff.toFixed(2) + ' is below the simulated range: clamped to ' + gMin + ', so the benefit is understated.');
    if (kept < 1) notes.push('Less glass is modelled as lower g only: the conduction change through new opaque panels is ignored.');
    const d1 = Object.assign({}, d, { g: Math.max(gMin, gEff) });
    let op = sur.predict(d1).operative.slice();

    // 2. dynamic screen: in hours above the trigger use the screened design's temperature
    let deployed = 0;
    if (X.dynOpacity > d.screen_opacity) {
      const opS = sur.predict(Object.assign({}, d1, { screen_opacity: X.dynOpacity })).operative;
      op = op.map((v, h) => (c.ghi[h] > X.dynTrigger ? opS[h] : v));
      deployed = c.ghiYear.filter((g) => g > X.dynTrigger).length / c.daylightHours;
      notes.push('Dynamic screen ignores heat stored before it deploys, and its control lag.');
    }

    // 3. internal gains, steady state through ventilation + glass (no mass: upper bound)
    if (X.qInt !== P.eplusQint) {
      const dt = ((X.qInt - P.eplusQint) * P.floorArea) / (RHO_CP * d.ach_day * P.volume + d.u * P.glassArea);
      op = op.map((v, h) => (occupied(h) ? v + dt : v));
      notes.push('Internal gains shift occupied hours by ' + (dt >= 0 ? '+' : '') + dt.toFixed(2) + ' K (steady state, no thermal mass).');
    }

    // 4. fans change what people feel, not the temperature
    const ce = H.fanCooling(X.airSpeed);
    const felt = op.map((v, h) => (occupied(h) ? v - ce : v));
    if (ce > 0) notes.push('Fans: ' + ce.toFixed(1) + ' K comfort allowance in occupied hours (ASHRAE 55 elevated air speed). Fan energy not counted.');

    const s = H.scoreOf(felt);
    const dfBase = H.daylightFactor(d1, P) * (1 - deployed * X.dynOpacity);
    const pvRoof = c.elements.filter((e) => e.roof).reduce((a, e) => a + e.annual * (e.south ? X.southRoofKept : 1), 0);
    return {
      gEff: d1.g, operative: op, felt: felt, score: s.score, h28: s.h28, peak: H.scoreOf(op).peak,
      tm52: H.tm52(felt, P), df: dfBase, deployedPct: 100 * deployed,
      pvMwh: (pvRoof * X.frit * P.pvEff) / 1000, notes: notes,
    };
  };

  // ---------- cost and carbon: mechanism ready, rates come from data/design_catalogue.json ----------
  H.costCarbon = function (d, base, catalogue, P) {
    const iv = {};
    ((catalogue && catalogue.interventions) || []).forEach((i) => (iv[i.id] = i));
    const items = [];
    if (d.g !== base.g || d.u !== base.u) items.push(['glazing_g', P.glassArea]);  // one glazing replacement
    if (d.u < base.u) items.push(['glazing_u', P.glassArea]);                     // premium for a better U-value
    if (d.screen_opacity > 0) items.push(['roof_screen_opacity', P.floorArea]);
    const out = { items: items.map((x) => x[0]), missing: [], cost: 0, carbon: 0 };
    items.forEach(([id, qty]) => {
      const e = iv[id] || {};
      if (e.cost_gbp_per_unit == null || e.carbon_kgco2e_per_unit == null) out.missing.push(id);
      else { out.cost += qty * e.cost_gbp_per_unit; out.carbon += qty * e.carbon_kgco2e_per_unit; }
    });
    if (out.missing.length) { out.cost = null; out.carbon = null; }
    return out;
  };

  // ---------- extra metrics: appear in the explorer, trade-offs and sensitivity ----------
  H.extraMetrics = function (P, hdh) {
    return {
      tm52: { label: 'TM52 criteria failed (hot week)', unit: 'of 3', better: 'low', source: 'derived', dp: 0, get: (d, r) => H.tm52(r.operative, P).fails },
      morning: { label: 'Atrium before opening (night flush)', unit: '°C', better: 'low', source: 'derived', get: (d, r) => H.nightFlush(r.operative).morning },
      winter_net: { label: 'Winter glass loss − useful solar', unit: 'MWh/yr', better: 'low', source: 'proxy', get: (d) => (H.winterLoss(d, P, hdh) - H.winterSolar(d, P)) / 1000 },
      stack_ok: { label: 'Hours stack vents meet day ACH', unit: '%', better: 'high', source: 'proxy', dp: 0, get: (d, r) => H.stackAch(d, r, P).pct },
      cooling: { label: 'Cooling to hold 26 °C', unit: 'MWh/wk', better: 'low', source: 'proxy', get: (d, r) => H.coolingNeed(d, r, P) / 1e6 },
      fan_night: { label: 'Night purge fan energy if mechanical', unit: 'kWh/wk', better: 'low', source: 'proxy', dp: 0, get: (d) => H.nightFanKwh(d, P) },
    };
  };
})(window.HeatLab);

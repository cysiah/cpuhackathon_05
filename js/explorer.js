/* Design explorer: a rebuild of section 3 of the Atrium Heat Lab starter app.
 * Multilinear interpolation over the 3,125-run EnergyPlus sweep (js/sweep.js),
 * error measured against the 40 off-grid runs, and the starter app's labelled proxies.
 * Uses the frame engine exposed by js/diagrams.js as window.HH. */
(function () {
  "use strict";
  const H = window.HH, S = typeof SWEEP !== "undefined" ? SWEEP : null;
  if (!H || !S || !document.getElementById("explore")) return;
  const { clamp, lerp, font, C } = H;
  const $ = s => document.querySelector(s);
  const fmt = (v, dp) => v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });

  // ---------- data ----------
  const K = S.keys, LV = S.levels, HOURS = 168;
  const stride = K.map((_, i) => LV.slice(i + 1).reduce((a, l) => a * l.length, 1));
  const raw = atob(S.op), OP = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) OP[i] = raw.charCodeAt(i);

  // ---------- surrogate (same maths as the starter app's model.js) ----------
  function bracket(i, v) {
    const L = LV[i];
    if (v <= L[0]) return [0, 0, 0];
    if (v >= L[L.length - 1]) return [L.length - 1, L.length - 1, 0];
    let j = 0;
    while (L[j + 1] < v) j++;
    return [j, j + 1, (v - L[j]) / (L[j + 1] - L[j])];
  }
  function predict(d, withHours) {
    const br = K.map((k, i) => bracket(i, d[k]));
    const out = { exact: br.every(b => b[2] < 1e-9 || b[2] > 1 - 1e-9), score: 0, peak: 0, h26: 0, h28: 0, solar: 0 };
    if (withHours) out.op = new Float32Array(HOURS);
    for (let mask = 0; mask < 1 << K.length; mask++) {
      let w = 1, idx = 0;
      for (let i = 0; i < K.length; i++) {
        const [j0, j1, t] = br[i], hi = (mask >> i) & 1;
        w *= hi ? t : 1 - t;
        idx += (hi ? j1 : j0) * stride[i];
      }
      if (w < 1e-12) continue;
      out.score += w * S.score[idx]; out.peak += w * S.peak[idx];
      out.h26 += w * S.h26[idx]; out.h28 += w * S.h28[idx]; out.solar += w * S.solar[idx];
      if (withHours) for (let h = 0; h < HOURS; h++) out.op[h] += w * (S.opMin + OP[idx * HOURS + h] * S.opStep);
    }
    return out;
  }
  const errs = S.validation.map(r => predict(r).score - r.score);
  const VAL = { n: errs.length, rmse: Math.sqrt(errs.reduce((a, e) => a + e * e, 0) / errs.length), max: Math.max(...errs.map(Math.abs)) };

  // ---------- proxies (assumptions from the starter app's PARAMS) ----------
  const P = { glassArea: 1351, internalArea: 4750, volume: 21600, lsg: 1.3, vtMax: 0.85, frame: 0.75, theta: 180, maintenance: 0.8, reflectance: 0.5, stackHeight: 20, stackDeltaT: 3, dischargeCoef: 0.6 };
  const daylight = d => (Math.min(P.vtMax, P.lsg * d.g) * (1 - d.screen_opacity) * P.glassArea * P.frame * P.theta * P.maintenance) / (P.internalArea * (1 - P.reflectance * P.reflectance));
  const winter = d => (d.u * P.glassArea * S.hdh) / 1e6;
  const vent = ach => ((ach * P.volume) / 3600) / (P.dischargeCoef * Math.sqrt((2 * 9.81 * P.stackHeight * P.stackDeltaT) / 293));
  const band = s => s <= 42 ? "Pass" : s <= 150 ? "Marginal" : s <= 400 ? "Overheating" : "Severe";

  const METRICS = [
    { k: "score", label: "Overheat score", unit: "K·h", dp: 1, low: true, src: "E+", get: (d, r) => r.score },
    { k: "peak", label: "Peak operative", unit: "°C", dp: 1, low: true, src: "E+", get: (d, r) => r.peak },
    { k: "h28", label: "Occupied hours > 28 °C", unit: "h", dp: 0, low: true, src: "E+", get: (d, r) => r.h28 },
    { k: "solar", label: "Solar through glass", unit: "kWh/wk", dp: 0, low: true, src: "E+", get: (d, r) => r.solar },
    { k: "df", label: "Daylight, avg DF", unit: "%", dp: 1, low: false, src: "proxy", get: d => daylight(d) },
    { k: "winter", label: "Winter glazing loss", unit: "MWh/yr", dp: 1, low: true, src: "proxy", get: d => winter(d) },
    { k: "vent", label: "Vent opening needed", unit: "m²", dp: 1, low: true, src: "proxy", get: d => vent(Math.max(d.ach_day, d.ach_night)) }
  ];
  const META = {
    g: { label: "Glazing g-value", unit: "", fmt: v => v.toFixed(2), step: 0.01 },
    u: { label: "Glazing U-value", unit: "W/m²K", fmt: v => v.toFixed(1), step: 0.1 },
    ach_day: { label: "Day ventilation", unit: "ACH", fmt: v => v.toFixed(1), step: 0.1 },
    ach_night: { label: "Night ventilation", unit: "ACH", fmt: v => v.toFixed(1), step: 0.1 },
    screen_opacity: { label: "Roof screen", unit: "opacity", fmt: v => Math.round(v * 100) + "%", step: 0.01 }
  };

  // ---------- state ----------
  const base = Object.assign({}, S.base), rBase = predict(base, true);
  let design = Object.assign({}, base), result = rBase;
  const anim = { from: rBase.op, to: rBase.op, start: 0 };
  let fig = null;

  // ---------- controls ----------
  const box = $("#levers");
  K.forEach((k, i) => {
    const L = LV[i], m = META[k], lo = L[0], hi = L[L.length - 1];
    const div = document.createElement("div");
    div.className = "lever";
    let last = -1;
    const ticks = L.map(v => {
      const f = (v - lo) / (hi - lo);
      if (last >= 0 && f - last < 0.09) return "";
      last = f;
      return `<span style="left:${100 * f}%">${m.fmt(v)}</span>`;
    }).join("");
    div.innerHTML =
      `<label for="lv-${k}"><span>${m.label}${m.unit ? " · " + m.unit : ""}</span><b id="lvv-${k}"></b></label>` +
      `<input type="range" id="lv-${k}" min="${lo}" max="${hi}" step="${m.step}">` +
      `<div class="ticks" aria-hidden="true">${ticks}</div>` +
      `<span class="info">${S.info[k] || ""}</span>`;
    box.appendChild(div);
    div.querySelector("input").addEventListener("input", e => { design[k] = +e.target.value; render(); });
  });

  function setDesign(d) {
    design = {};
    K.forEach(k => { design[k] = d[k]; $("#lv-" + k).value = d[k]; });
    render();
  }
  $("#btn-base").addEventListener("click", () => setDesign(base));
  $("#btn-snap").addEventListener("click", () => {
    const d = {};
    K.forEach((k, i) => { d[k] = LV[i].reduce((a, b) => Math.abs(b - design[k]) < Math.abs(a - design[k]) ? b : a); });
    setDesign(d);
  });
  $("#btn-best").addEventListener("click", () => {
    // lowest simulated score among designs that keep the daylight proxy at or above 5 %
    let best = -1, bestScore = Infinity;
    for (let idx = 0; idx < S.score.length; idx++) {
      const d = {};
      K.forEach((k, i) => { d[k] = LV[i][Math.floor(idx / stride[i]) % LV[i].length]; });
      if (daylight(d) >= 5 && S.score[idx] < bestScore) { bestScore = S.score[idx]; best = d; }
    }
    if (best !== -1) setDesign(best);
  });

  // ---------- readout ----------
  function render() {
    K.forEach(k => ($("#lvv-" + k).textContent = META[k].fmt(design[k])));
    const prevOp = currentOp();
    result = predict(design, true);
    anim.from = prevOp; anim.to = result.op; anim.start = frameNow;

    $("#x-score").textContent = fmt(result.score, 1);
    const b = band(result.score), v = $("#x-band");
    v.textContent = b; v.className = "verdict" + (b === "Pass" ? "" : " solid");
    $("#x-fid").textContent = result.exact
      ? "Simulated design: every EnergyPlus value here is a direct result."
      : `Interpolated between simulated designs. Measured on ${VAL.n} off-grid EnergyPlus runs: ±${fmt(VAL.rmse, 1)} K·h typical, ${fmt(VAL.max, 1)} K·h worst.`;

    $("#x-metrics").innerHTML = METRICS.map(m => {
      const val = m.get(design, result), v0 = m.get(base, rBase), dv = val - v0;
      const same = Math.abs(dv) < 1e-6, better = !same && (m.low === dv < 0);
      const delta = same ? "baseline" : (dv > 0 ? "+" : "−") + fmt(Math.abs(dv), m.dp) + " vs baseline";
      return `<div class="metric${same ? "" : better ? " better" : " worse"}">` +
        `<span class="m-label">${m.label} <i>${m.src}</i></span>` +
        `<span class="m-val">${fmt(val, m.dp)} <small>${m.unit}</small></span>` +
        `<span class="m-delta">${same ? "" : better ? "▼ " : "▲ "}${delta}</span></div>`;
    }).join("");

    const flags = [];
    const df = daylight(design), vt = vent(Math.max(design.ach_day, design.ach_night));
    flags.push(df < 2 ? ["Daylight proxy below 2%: the atrium would feel dark and need electric light all day.", 0]
      : df < 5 ? [`Daylight proxy ${fmt(df, 1)}%: adequate for circulation; check glare and gloom near the floor.`, 1]
        : [`Daylight proxy ${fmt(df, 1)}%: bright. Glare and visual comfort are not assessed here.`, 1]);
    flags.push(vt > 30 ? [`Needs about ${fmt(vt, 0)} m² of free opening top and bottom for stack ventilation: likely mechanical assist, plus rain and security design.`, 0]
      : [`Stack ventilation needs about ${fmt(vt, 0)} m² of free opening top and bottom.`, 1]);
    if (design.ach_night >= 3) flags.push(["Night purge relies on secure, rain-proof openings left open overnight, or fans and their energy use.", 0]);
    if (design.u < 2 && design.screen_opacity < 0.5) flags.push(["Low U-value with little shading traps solar heat: check the score, it can go up.", 0]);
    if (design.screen_opacity > 0) flags.push(["The screen is modelled as a uniform porous plane 1.5 m above the ridge. Its structure, wind load, cleaning and cost are not.", 0]);
    $("#x-flags").innerHTML = flags.map(f => `<li class="${f[1] ? "ok" : ""}">${f[0]}</li>`).join("");

    if (fig) H.paint(fig);
  }

  // the line morphs from the previous design to the new one over 6 frames
  const MORPH = 6;
  let frameNow = 0;
  function currentOp() {
    if (!anim.to) return rBase.op;
    const f = H.REDUCED ? 1 : clamp((frameNow - anim.start) / MORPH, 0, 1);
    if (f >= 1) return anim.to;
    const o = new Float32Array(HOURS);
    for (let h = 0; h < HOURS; h++) o[h] = lerp(anim.from[h], anim.to[h], f);
    return o;
  }

  // ---------- week chart ----------
  fig = H.reg("c-design", function (c, W, Hh, t) {
    frameNow = t;
    const op = currentOp(), bop = rBase.op, out = typeof FF !== "undefined" ? FF.out : null;
    const L = 34, R = 8, T = 18, B = 40;
    const x = i => L + (W - L - R) * i / (HOURS - 1);
    let mn = Math.min(...op, ...bop), mx = Math.max(...op, ...bop);
    if (out) { mn = Math.min(mn, ...out); mx = Math.max(mx, ...out); }
    const lo = Math.floor(mn / 2) * 2 - 1, hi = Math.max(42, Math.ceil(mx / 2) * 2 + 2);
    const y = v => T + (Hh - T - B) * (1 - (v - lo) / (hi - lo));
    c.strokeStyle = C.k; c.fillStyle = C.k; font(c, 10, 400);
    for (let d = 0; d < 7; d++) {
      c.fillStyle = "rgba(11,11,10,.06)";
      c.fillRect(x(d * 24 + 8), T, x(d * 24 + 18) - x(d * 24 + 8), Hh - T - B);
      c.fillStyle = C.k; c.fillText((14 + d) + (W < 520 ? "" : " JUN"), x(d * 24 + 9), Hh - B + 16);
    }
    for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) {
      c.lineWidth = .5; c.setLineDash([2, 4]);
      c.beginPath(); c.moveTo(L, y(v)); c.lineTo(W - R, y(v)); c.stroke(); c.setLineDash([]);
      c.fillText(v + "°", 4, y(v) + 3);
    }
    c.lineWidth = 1.4; c.beginPath(); c.moveTo(L, y(26)); c.lineTo(W - R, y(26)); c.stroke();
    c.fillText("26°", 4, y(26) + 3);
    // hatch the excess of this design in occupied hours
    c.lineWidth = 1;
    for (let i = 0; i < HOURS - 1; i++) {
      const h = i % 24;
      if (h < 8 || h >= 18 || op[i] <= 26) continue;
      const x0 = x(i), x1 = x(i + 1);
      c.save(); c.beginPath(); c.rect(x0, y(op[i]), x1 - x0, y(26) - y(op[i])); c.clip();
      for (let k = -60; k < 60; k += 4) { c.beginPath(); c.moveTo(x0 + k, y(26)); c.lineTo(x0 + k + 60, y(26) - 120); c.stroke(); }
      c.restore();
    }
    if (out) { c.lineWidth = 1; c.setLineDash([1, 3]); c.beginPath(); out.forEach((v, i) => c.lineTo(x(i), y(v))); c.stroke(); }
    c.setLineDash([4, 4]); c.lineWidth = 1.1; c.strokeStyle = "rgba(11,11,10,.45)";
    c.beginPath(); bop.forEach((v, i) => c.lineTo(x(i), y(v))); c.stroke();
    c.setLineDash([]); c.strokeStyle = C.k; c.lineWidth = 2.4;
    c.beginPath(); op.forEach((v, i) => c.lineTo(x(i), y(v))); c.stroke();
    // blinking peak
    let pk = 0; for (let i = 1; i < HOURS; i++) if (op[i] > op[pk]) pk = i;
    if (t % 4 < 2 || H.REDUCED) { c.beginPath(); c.arc(x(pk), y(op[pk]), 4.5, 0, 7); c.fill(); }
    // legend
    font(c, 10, 400); const ly = Hh - 6;
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(L, ly - 3); c.lineTo(L + 20, ly - 3); c.stroke(); c.fillText("THIS DESIGN", L + 26, ly);
    c.lineWidth = 1.1; c.strokeStyle = "rgba(11,11,10,.45)"; c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(L + 118, ly - 3); c.lineTo(L + 138, ly - 3); c.stroke(); c.fillText("BASELINE", L + 144, ly);
    c.strokeStyle = C.k; c.setLineDash([1, 3]);
    c.beginPath(); c.moveTo(L + 216, ly - 3); c.lineTo(L + 236, ly - 3); c.stroke(); c.fillText("OUTDOOR 2050", L + 242, ly);
    c.setLineDash([]);
  });

  setDesign(base);
})();

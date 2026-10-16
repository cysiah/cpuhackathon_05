/* app.js - builds each section of the page from the data. One function per section:
 * start here when you want to change or add something. */
(function (H) {
  'use strict';
  const $ = (s, el) => (el || document).querySelector(s);
  const S = { data: null, sur: null, val: null, hdh: 0, metrics: null, design: null, charts: {} };

  // ---------- helpers ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const fmt = (v, d) => (v == null || isNaN(v) ? '–' : v.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }));
  const buildMetrics = () => Object.assign(H.metrics(H.PARAMS, S.hdh), H.extraMetrics(H.PARAMS, S.hdh));
  const srcTag = (src) => (src && src !== 'EnergyPlus' ? ' · ' + src : '');
  const bandHtml = (b) => '<span class="band ' + b + '">' + b + '</span>';
  function chart(id, cfg) {
    if (S.charts[id]) S.charts[id].destroy();
    const ink = css('--muted'), grid = css('--grid');
    Chart.defaults.color = ink;
    Chart.defaults.font.family = css('--font-body');
    Chart.defaults.borderColor = grid;
    S.charts[id] = new Chart(document.getElementById(id), cfg);
    return S.charts[id];
  }
  // x-axis labels for the hot week: a date at each midnight, taken from the data (hour of year)
  const weekLabels = (n) => Array.from({ length: n }, (_, h) => {
    if (h % 24) return '';
    const d = new Date(Date.UTC(2026, 0, 1) + (S.data.climate.hot_week.start_hoy + h) * 3600e3);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  });

  // ---------- 1. summary ----------
  function renderSummary() {
    const b = S.data.baseline, c = S.data.climate;
    const fut = c.dry_bulb.future, wk0 = c.hot_week.start_hoy;
    const peakOut = Math.max(...fut.slice(wk0, wk0 + 168));
    const occ = b.eplus.operative.filter((v, h) => h % 24 >= c.occupied_hours[0] && h % 24 < c.occupied_hours[1]);
    $('#summary').innerHTML = [
      ['Overheat score (EnergyPlus)', fmt(b.eplus.score, 1) + ' <small>K·h</small>', bandHtml(H.band(b.eplus.score)) + ' occupied degree-hours above 26 °C, hot week'],
      ['Peak operative temperature', fmt(b.eplus.peak_operative, 1) + ' <small>°C</small>', 'outdoor peak ' + fmt(peakOut, 1) + ' °C on the worst day'],
      ['Occupied hours above 26 °C', occ.filter((v) => v > 26).length + ' <small>of ' + occ.length + '</small>', 'in the atrium, 08:00–18:00, hot week'],
      ['Solar through the roof glass', fmt(S.sur.predict(b.levers).solar_kwh / 1000, 1) + ' <small>MWh/wk</small>', 'the dominant heat input'],
      ['Score to aim for', '≤ 42 <small>K·h</small>', 'the PASS band: reach it and show what it costs'],
    ].map((s) => '<div class="stat"><span class="eyebrow">' + s[0] + '</span><span class="value num">' + s[1] + '</span><span class="muted" style="font-size:.8rem">' + s[2] + '</span></div>').join('');
    $('#evalid').textContent = 'EVAL ID ' + b.eval_id;
  }

  // ---------- 2. climate ----------
  function drawHeatmap(canvas, vals, range, ramp, wk0) {
    const ctx = canvas.getContext('2d'), img = ctx.createImageData(365, 24);
    for (let d = 0; d < 365; d++) for (let h = 0; h < 24; h++) {
      const c = H.rampColor(ramp, (vals[d * 24 + h] - range[0]) / (range[1] - range[0]));
      const i = ((23 - h) * 365 + d) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = css('--ink'); ctx.lineWidth = 1;
    ctx.strokeRect(wk0 / 24 + 0.5, 0.5, 7, 23);
  }
  function renderClimate(mode) {
    const c = S.data.climate, p = c.dry_bulb.present, f = c.dry_bulb.future;
    const vals = mode === 'diff' ? f.map((v, i) => v - p[i]) : mode === 'present' ? p : f;
    const range = mode === 'diff' ? [0, 6] : [-5, 35];
    drawHeatmap($('#heatmap'), vals, range, 'heat', c.hot_week.start_hoy);
    $('#heat-ramp').style.background = H.rampCss('heat');
    $('#heat-range').textContent = range[0] + ' to ' + range[1] + ' °C' + (mode === 'diff' ? ' warming' : '');
    document.querySelectorAll('#climate-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode));

    // occupied-hour counts (computed here so you can change the thresholds)
    const [o0, o1] = c.occupied_hours, wk0 = c.hot_week.start_hoy;
    const count = (arr, t, from, to) => { let n = 0; for (let i = from; i < to; i++) { const h = i % 24; if (h >= o0 && h < o1 && arr[i] > t) n++; } return n; };
    const rows = [26, 28, 30].map((t) => '<tr><td>above ' + t + ' °C</td><td class="num">' + count(p, t, 0, 8760) + '</td><td class="num">' + count(f, t, 0, 8760) +
      '</td><td class="num">' + count(f, t, wk0, wk0 + 168) + '</td></tr>').join('');
    $('#exposure').innerHTML = '<thead><tr><th>Outdoor, occupied hours</th><th class="num">Present yr</th><th class="num">2050 yr</th><th class="num">2050 hot week</th></tr></thead><tbody>' + rows + '</tbody>';
  }
  function renderHotWeek() {
    const c = S.data.climate, b = S.data.baseline, wk0 = c.hot_week.start_hoy, n = 168;
    chart('hotweek', {
      type: 'line',
      data: {
        labels: weekLabels(n),
        datasets: [
          { label: 'Atrium operative, EnergyPlus', data: b.eplus.operative, borderColor: css('--accent'), borderWidth: 2, pointRadius: 0 },
          { label: 'Atrium air, screening model', data: b.screening.air, borderColor: css('--accent'), borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
          { label: 'Outdoor 2050 (crude morph)', data: c.dry_bulb.future.slice(wk0, wk0 + n), borderColor: css('--ink'), borderWidth: 1.5, pointRadius: 0 },
          { label: 'Outdoor present', data: c.dry_bulb.present.slice(wk0, wk0 + n), borderColor: css('--cool'), borderWidth: 1.5, pointRadius: 0 },
          { label: '26 °C threshold', data: new Array(n).fill(26), borderColor: css('--muted'), borderDash: [2, 3], borderWidth: 1, pointRadius: 0 },
        ],
      },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        scales: { x: { ticks: { autoSkip: false, maxRotation: 0 }, grid: { display: false } }, y: { title: { display: true, text: '°C' } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } } },
    });
  }

  // ---------- 3. where the heat comes in ----------
  const STUDIES = {
    hot_week: { label: 'Hot week incident radiation', unit: 'kWh/m²', ramp: 'heat' },
    annual: { label: 'Annual incident radiation', unit: 'kWh/m²', ramp: 'heat' },
    benefit_present: { label: 'Radiation benefit (+) / harm (−), present', unit: 'kWh/m²', ramp: 'diverge', sym: true },
    benefit_future: { label: 'Radiation benefit (+) / harm (−), 2050', unit: 'kWh/m²', ramp: 'diverge', sym: true },
  };
  function renderRadiation(key) {
    const r = S.data.radiation, st = STUDIES[key], vals = r.results[key];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (st.sym) { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
    // benefit is positive: flip so harm is red on the diverging ramp
    const shown = st.sym ? vals.map((v) => -v) : vals;
    if (S.viewer) S.viewer.setValues(shown, [lo, hi], st.ramp, st.unit, st.sym ? 'harm(+)/benefit(−)' : st.label);
    $('#rad-ramp').style.background = H.rampCss(st.ramp);
    $('#rad-range').textContent = st.sym ? 'benefit ' + fmt(hi, 0) + ' … harm ' + fmt(hi, 0) + ' ' + st.unit : fmt(lo, 0) + ' – ' + fmt(hi, 0) + ' ' + st.unit;
    document.querySelectorAll('#rad-mode button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key));

    // aggregate by building element
    const agg = {};
    r.category.forEach((c, i) => { agg[c] = agg[c] || { kwh: 0, area: 0 }; agg[c].kwh += vals[i] * r.area_m2[i]; agg[c].area += r.area_m2[i]; });
    const cats = Object.keys(agg).sort((a, b) => agg[b].kwh - agg[a].kwh);
    const totalKwh = cats.reduce((a, c) => a + Math.max(0, agg[c].kwh), 0), totalA = cats.reduce((a, c) => a + agg[c].area, 0);
    chart('radbars', {
      type: 'bar',
      data: { labels: cats.map((c) => c.replace('_', ' ')), datasets: [
        { label: 'Total (MWh)', data: cats.map((c) => agg[c].kwh / 1000), backgroundColor: cats.map((c) => (c.startsWith('atrium') ? css('--accent') : css('--cool'))) }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { afterLabel: (t) => fmt(agg[cats[t.dataIndex]].kwh / agg[cats[t.dataIndex]].area, 1) + ' ' + st.unit + ' average · ' + fmt(agg[cats[t.dataIndex]].area, 0) + ' m²' } } },
        scales: { x: { title: { display: true, text: 'MWh over the period' } }, y: { grid: { display: false } } } },
    });
    const at = (agg.atrium_roof || { kwh: 0, area: 0 }), cl = (agg.atrium_clerestory || { kwh: 0, area: 0 });
    $('#rad-insight').textContent = st.sym
      ? 'Benefit/harm weights each hour of sun by whether the outdoor air is above the ' + 'balance temperature. Compare present and 2050: surfaces that turn red are where warming flips useful solar gain into a problem.'
      : 'The atrium glazing is ' + fmt((100 * (at.area + cl.area)) / totalA, 0) + '% of the analysed envelope but receives ' +
        fmt((100 * (at.kwh + cl.kwh)) / totalKwh, 0) + '% of its solar energy in this period, at ' + fmt(at.kwh / Math.max(1, at.area), 1) + ' ' + st.unit + ' on average.';
  }

  // ---------- 4. design explorer ----------
  function leverControls() {
    const box = $('#levers'), sw = S.data.sweep;
    box.innerHTML = '';
    S.sur.keys.forEach((k, i) => {
      const L = S.sur.levels[i], m = H.LEVER_META[k];
      const step = k === 'g' || k === 'screen_opacity' ? 0.01 : 0.1;
      const div = document.createElement('div');
      div.className = 'lever';
      div.innerHTML = '<label for="lv-' + k + '"><span>' + m.label + (m.unit ? ' (' + m.unit + ')' : '') + '</span><b id="lvv-' + k + '"></b></label>' +
        '<input type="range" id="lv-' + k + '" min="' + L[0] + '" max="' + L[L.length - 1] + '" step="' + step + '" list="ls-' + k + '">' +
        '<datalist id="ls-' + k + '">' + L.map((v) => '<option value="' + v + '"></option>').join('') + '</datalist>' +
        '<div class="ticks" aria-hidden="true">' + (() => {
          let last = -1;  // skip a label that would collide with the previous one
          return L.map((v) => { const f = (v - L[0]) / (L[L.length - 1] - L[0]); if (last >= 0 && f - last < 0.09) return ''; last = f; return '<span style="left:' + 100 * f + '%">' + m.fmt(v) + '</span>'; }).join('');
        })() + '</div>' +
        '<span class="info">' + (sw.lever_info[k] || '') + '</span>';
      box.appendChild(div);
      div.querySelector('input').addEventListener('input', (e) => { S.design[k] = +e.target.value; renderDesign(); });
    });
  }
  function setDesign(d) {
    S.design = Object.assign({}, d);
    S.sur.keys.forEach((k) => { const el = $('#lv-' + k); if (el) el.value = S.design[k]; });
    renderDesign();
  }
  function snap() {
    const d = {};
    S.sur.keys.forEach((k, i) => { d[k] = S.sur.levels[i].reduce((a, b) => (Math.abs(b - S.design[k]) < Math.abs(a - S.design[k]) ? b : a)); });
    setDesign(d);
  }
  function renderDesign() {
    const d = S.design, base = S.data.baseline.levers, M = S.metrics;
    S.sur.keys.forEach((k) => ($('#lvv-' + k).textContent = H.LEVER_META[k].fmt(d[k])));
    const r = S.sur.predict(d), rb = S.sur.predict(base);
    const fid = $('#fidelity');
    fid.className = 'fidelity' + (r.exact ? ' exact' : '');
    fid.textContent = r.exact ? 'Simulated design: every value below is a direct EnergyPlus result.'
      : 'Interpolated between simulated designs. Measured error on ' + S.val.n + ' off-grid EnergyPlus runs: ±' + fmt(S.val.rmse, 1) + ' K·h typical, ' + fmt(S.val.max, 1) + ' K·h worst.';
    $('#design-metrics').innerHTML = Object.keys(M).map((k) => {
      const m = M[k], v = m.get(d, r), v0 = m.get(base, rb), dv = v - v0;
      const good = Math.abs(dv) < 1e-6 ? '' : (m.better === 'low') === dv < 0 ? 'better' : 'worse';
      const dp = m.dp != null ? m.dp : m.unit === 'kWh/wk' || m.unit === 'h' ? 0 : 1;
      return '<div class="metric ' + good + '"><span class="eyebrow">' + m.label + srcTag(m.source) + '</span>' +
        '<span class="v num">' + fmt(v, dp) + ' <small class="muted">' + m.unit + '</small>' + (k === 'score' ? ' ' + bandHtml(H.band(v)) : '') + '</span>' +
        '<span class="d num ' + good + '">' + (Math.abs(dv) < 1e-6 ? 'baseline' : (dv > 0 ? '+' : '') + fmt(dv, dp) + ' vs baseline') + '</span></div>';
    }).join('');

    // honest constraint flags
    const flags = [];
    const df = M.df.get(d), vent = M.vent.get(d);
    flags.push(df < 2 ? ['Daylight proxy below 2%: the atrium would feel dark and need electric light all day.', 0]
      : df < 5 ? ['Daylight proxy ' + fmt(df, 1) + '%: adequate for circulation, check glare and gloom near the floor.', 1]
        : ['Daylight proxy ' + fmt(df, 1) + '%: bright; glare and visual comfort are not assessed here.', 1]);
    flags.push(vent > 30 ? ['Needs about ' + fmt(vent, 0) + ' m² of free opening top and bottom for stack ventilation: likely mechanical assist, rain and security design.', 0]
      : ['Stack ventilation needs about ' + fmt(vent, 0) + ' m² of free opening top and bottom.', 1]);
    if (d.ach_night >= 3) flags.push(['Night purge relies on secure, rain-proof openings left open overnight, or fans and their energy use.', 0]);
    if (d.u < 2 && d.screen_opacity < 0.5) flags.push(['Low U-value with little shading traps solar heat: check the score, it can go up.', 0]);
    if (d.screen_opacity > 0) flags.push(['The screen is modelled as a uniform porous plane 1.5 m above the ridge. Its structure, wind load, cleaning and cost are not.', 0]);
    $('#flags').innerHTML = flags.map((f) => '<li class="' + (f[1] ? 'ok' : '') + '">' + f[0] + '</li>').join('');

    const c = S.data.climate, wk0 = c.hot_week.start_hoy;
    chart('designweek', {
      type: 'line',
      data: { labels: weekLabels(168), datasets: [
        { label: 'This design', data: r.operative, borderColor: css('--accent'), borderWidth: 2, pointRadius: 0 },
        { label: 'Baseline', data: S.data.baseline.eplus.operative, borderColor: css('--muted'), borderWidth: 1.2, pointRadius: 0 },
        { label: 'Outdoor 2050', data: c.dry_bulb.future.slice(wk0, wk0 + 168), borderColor: css('--cool'), borderWidth: 1, borderDash: [3, 3], pointRadius: 0 },
        { label: '26 °C', data: new Array(168).fill(26), borderColor: css('--muted'), borderDash: [2, 3], borderWidth: 1, pointRadius: 0 },
      ] },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        scales: { x: { ticks: { autoSkip: false, maxRotation: 0 }, grid: { display: false } }, y: { title: { display: true, text: 'Operative °C' } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 14 } } } },
    });
    renderDiagnosis(d, r);
    renderTradeoffs(true);
  }

  // ---------- 4b. diagnose and extend (js/mechanisms.js) ----------
  const MWh = (wh) => wh / 1e6;
  function renderDiagnosis(d, r) {
    const P = H.PARAMS, hb = H.heatBalance(d, r, P);
    const rows = [['Solar through glass (EnergyPlus)', hb.solar], ['Internal gains (model input)', hb.gains],
      ['Removed by ventilation', -hb.vent], ['Lost through glass', -hb.glass], ['Thermal mass + error (− = stored)', -hb.residual]];
    chart('heatbal', {
      type: 'bar',
      data: { labels: rows.map((x) => x[0]), datasets: [{ data: rows.map((x) => MWh(x[1])),
        backgroundColor: rows.map((x, i) => (i === 4 ? css('--muted') : x[1] >= 0 ? css('--accent') : css('--cool'))) }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (t) => fmt(t.raw, 1) + ' MWh in the hot week' } } },
        scales: { x: { title: { display: true, text: 'MWh over the hot week · + into the atrium air, − out' } }, y: { grid: { display: false } } } },
    });
    const inn = hb.solar + hb.gains;
    $('#hb-note').textContent = 'Solar is ' + fmt((100 * hb.solar) / inn, 0) + '% of the heat entering; ventilation carries out ' + fmt((100 * hb.vent) / inn, 0) +
      '% and the glass ' + fmt((100 * hb.glass) / inn, 0) + '%. The last bar is what is left: heat exchanged with the concrete plus the error of rebuilding the flows from operative temperature (opaque panels ignored).';
    $('#solar-el').innerHTML = '<thead><tr><th>Element</th><th class="num">Glass m²</th><th class="num">MWh/wk</th><th class="num">Share</th></tr></thead><tbody>' +
      H.solarByElement(r).map((e) => '<tr><td>' + e.key + '</td><td class="num">' + fmt(e.area, 0) + '</td><td class="num">' + fmt(e.kwh / 1000, 1) +
        '</td><td class="num">' + fmt((100 * e.kwh) / r.solar_kwh, 0) + '%</td></tr>').join('') + '</tbody>';

    const t = H.tm52(r.operative, P), ok = (b) => (b ? '<span class="tag yes">pass</span>' : '<span class="tag">fail</span>');
    $('#tm52').innerHTML = '<thead><tr><th>Criterion</th><th class="num">Value</th><th class="num">Limit</th><th></th></tr></thead><tbody>' +
      '<tr><td>1 · Occupied hours with ΔT ≥ 1 K</td><td class="num">' + t.he + ' h</td><td class="num">≤ ' + fmt(t.heLimit, 1) + ' h</td><td>' + ok(t.c1) + '</td></tr>' +
      '<tr><td>2 · Worst daily weighted exceedance</td><td class="num">' + t.weMax + '</td><td class="num">≤ 6</td><td>' + ok(t.c2) + '</td></tr>' +
      '<tr><td>3 · Highest ΔT</td><td class="num">' + t.dtMax + ' K</td><td class="num">≤ 4 K</td><td>' + ok(t.c3) + '</td></tr></tbody>';
    $('#tm52-note').textContent = (t.fails >= 2 ? 'Fails TM52 (' : 'Passes TM52 (') + t.fails + ' of 3 criteria failed; failing 2 fails the room). ' +
      'ΔT is operative minus the adaptive limit 0.33·Trm + 18.8 + ' + P.tm52Cat + ' K. Criterion 1 is defined over May–September: on one heatwave week it is far stricter, so read this as a stress test.';

    const f = H.nightFlush(r.operative);
    $('#flush').textContent = 'Just before opening the atrium averages ' + fmt(f.morning, 1) + ' °C while outside is ' + fmt(f.outMorning, 1) + ' °C; it cools ' + fmt(f.drop, 1) +
      ' K overnight at ' + d.ach_night + ' ACH. ' + (f.morning - f.outMorning > 5 ? 'A large gap to outdoors means more night ventilation or more exposed mass still has room to work.'
        : 'The night air is already being used well; further gains need less heat in by day.') + ' Concrete surface temperatures are not exported, so this uses operative temperature.';

    const cc = H.costCarbon(d, S.data.baseline.levers, S.data.catalogue, P);
    $('#costcarbon').innerHTML = !cc.items.length ? 'Baseline glazing and no screen: nothing to cost.'
      : cc.missing.length ? 'Mechanism ready. This design needs: ' + cc.items.join(', ') + '. Add <code>cost_gbp_per_unit</code> and <code>carbon_kgco2e_per_unit</code> for ' +
        cc.missing.join(', ') + ' in <code>data/design_catalogue.json</code> (from a sourced database) and they appear here.'
        : 'About £' + fmt(cc.cost / 1000, 0) + 'k and ' + fmt(cc.carbon / 1000, 0) + ' tCO₂e for ' + cc.items.join(', ') + ' (rates from data/design_catalogue.json).';
    renderExtras(d, r);
  }

  const EXTRAS = [
    ['southRoofKept', 'South roof glazing kept', 0.3, 1, 0.05, (v) => Math.round(v * 100) + '%'],
    ['frit', 'Frit / PV cells on roof glass', 0, 0.6, 0.05, (v) => Math.round(v * 100) + '%'],
    ['dynOpacity', 'Dynamic screen opacity when deployed', 0, 0.9, 0.05, (v) => Math.round(v * 100) + '%'],
    ['dynTrigger', 'Deploy above (W/m² sun on the ground)', 100, 500, 25, (v) => v + ' W/m²'],
    ['airSpeed', 'Air speed from ceiling fans', 0.1, 1.2, 0.05, (v) => v.toFixed(2) + ' m/s'],
    ['qInt', 'Internal gains', 2, 10, 0.5, (v) => v.toFixed(1) + ' W/m²'],
  ];
  function extrasControls() {
    $('#extras').innerHTML = EXTRAS.map(([k, label, lo, hi, step]) => '<div class="lever"><label for="ex-' + k + '"><span>' + label + '</span><b id="exv-' + k + '"></b></label>' +
      '<input type="range" id="ex-' + k + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + S.extras[k] + '"></div>').join('');
    EXTRAS.forEach(([k]) => $('#ex-' + k).addEventListener('input', (e) => { S.extras[k] = +e.target.value; renderExtras(S.design, S.sur.predict(S.design)); }));
    $('#btn-extras-reset').addEventListener('click', () => { S.extras = Object.assign({}, H.EXTRAS_DEFAULT); extrasControls(); renderExtras(S.design, S.sur.predict(S.design)); });
  }
  function renderExtras(d, r) {
    if (!$('#ex-qInt')) return;
    EXTRAS.forEach(([k, , , , , f]) => ($('#exv-' + k).textContent = f(S.extras[k])));
    const P = H.PARAMS, x = H.withExtras(S.sur, d, S.extras, P), t0 = H.tm52(r.operative, P);
    const rows = [['Overheat score (as felt)', r.score, x.score, 1, 'K·h'], ['Peak operative', r.peak, x.peak, 1, '°C'], ['Occupied hours > 28 °C (as felt)', r.h28, x.h28, 0, 'h'],
      ['TM52 criteria failed', t0.fails, x.tm52.fails, 0, 'of 3'], ['Daylight proxy', H.daylightFactor(d, P), x.df, 1, '%'], ['Equivalent g', d.g, x.gEff, 2, ''],
      ['Screen deployed, daylight hours/yr', 0, x.deployedPct, 0, '%'], ['PV yield', 0, x.pvMwh, 1, 'MWh/yr']];
    $('#extras-out').innerHTML = '<thead><tr><th></th><th class="num">This design</th><th class="num">+ extras</th></tr></thead><tbody>' +
      rows.map((q) => '<tr><td>' + q[0] + '</td><td class="num">' + fmt(q[1], q[3]) + '</td><td class="num"><b>' + fmt(q[2], q[3]) + '</b> ' + q[4] + '</td></tr>').join('') + '</tbody>';
    const notes = x.notes.length ? x.notes : ['All extras at their neutral setting: the right-hand column equals the simulated design.'];
    $('#extras-notes').innerHTML = notes.map((n) => '<li>' + n + '</li>').join('');
  }

  // ---------- 7b. catalogue (data/design_catalogue.json) ----------
  const NOW = { yes: 'analysable now', partial: 'partial', approx: 'approximation', no: 'needs new simulation' };
  function renderCatalogue() {
    const c = S.data.catalogue;
    if (!c) { $('#catalogue-sec').hidden = true; return; }
    const all = c.analyses.concat(c.interventions), count = {};
    all.forEach((x) => { const l = (x.now && x.now.level) || 'no'; count[l] = (count[l] || 0) + 1; });
    $('#catalogue-note').textContent = 'From data/design_catalogue.json: ' + all.length + ' items, ' + Object.keys(NOW).filter((k) => count[k]).map((k) => count[k] + ' ' + NOW[k]).join(', ') +
      '. Nothing is dropped: items the current model cannot answer stay listed with what they would need.';
    const row = (x) => { const n = x.now || { level: 'no' };
      return '<tr><td>' + x.name + '</td><td><span class="tag ' + n.level + '">' + NOW[n.level] + '</span></td><td class="mech">' + (n.how || '–') +
        (n.where ? ' <span class="muted">· ' + n.where + '</span>' : '') + '</td><td class="note">' + (n.limits || '') + '</td></tr>'; };
    $('#catalogue').innerHTML = '<thead><tr><th>Item</th><th>With the current model</th><th>Mechanism here</th><th>Limits / what it needs</th></tr></thead><tbody>' +
      '<tr class="group"><td colspan="4">Analyses</td></tr>' + c.analyses.map(row).join('') +
      '<tr class="group"><td colspan="4">Interventions</td></tr>' + c.interventions.map(row).join('') + '</tbody>';
  }

  // ---------- 5. trade-offs ----------
  function renderTradeoffs(markerOnly) {
    const M = S.metrics, xk = $('#ax-x').value, yk = $('#ax-y').value, ck = $('#ax-c').value;
    const grid = S.data.sweep.grid;
    const pts = grid.map((r) => ({ x: M[xk].get(r, r), y: M[yk].get(r, r), c: M[ck].get(r, r), r: r }));
    const cmin = Math.min(...pts.map((p) => p.c)), cmax = Math.max(...pts.map((p) => p.c));
    const front = H.pareto(pts, M[xk].better, M[yk].better);
    const cur = S.sur.predict(S.design);
    const curPt = { x: M[xk].get(S.design, cur), y: M[yk].get(S.design, cur) };
    const colour = (p) => { let t = (p.c - cmin) / (cmax - cmin || 1); if (M[ck].better === 'high') t = 1 - t; const c = H.rampColor('heat', t); return 'rgba(' + c.map(Math.round).join(',') + ',0.55)'; };
    if (markerOnly && S.charts.tradeoff && S.tradeKey === xk + yk + ck) {
      S.charts.tradeoff.data.datasets[2].data = [curPt]; S.charts.tradeoff.update('none'); return;
    }
    S.tradeKey = xk + yk + ck;
    S.front = front.map((i) => pts[i]);
    chart('tradeoff', {
      type: 'scatter',
      data: { datasets: [
        { label: 'Simulated designs (' + pts.length + ')', data: pts, pointRadius: 2.2, pointBackgroundColor: pts.map(colour), pointBorderWidth: 0, order: 3 },
        { label: 'Pareto front (best trade-offs)', data: S.front.slice().sort((a, b) => a.x - b.x), showLine: true, borderColor: css('--ink'), borderWidth: 1.5, pointRadius: 3, pointBackgroundColor: css('--ink'), order: 2 },
        { label: 'Your design', data: [curPt], pointRadius: 7, pointStyle: 'crossRot', borderColor: css('--accent'), borderWidth: 3, order: 1 },
      ] },
      options: { maintainAspectRatio: false, animation: false,
        scales: { x: { title: { display: true, text: M[xk].label + ' (' + M[xk].unit + ')' + (M[xk].better === 'low' ? ' ← better' : ' better →') } },
          y: { title: { display: true, text: M[yk].label + ' (' + M[yk].unit + ')' } } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } },
          tooltip: { callbacks: { label: (t) => { const r = t.raw.r; return r ? 'g ' + r.g + ' · U ' + r.u + ' · ACH ' + r.ach_day + '/' + r.ach_night + ' · screen ' + Math.round(r.screen_opacity * 100) + '% → ' + fmt(t.raw.y, 1) : 'your design'; } } } },
        onClick: (e, els) => { const el = els.find((x) => x.datasetIndex < 2); if (!el) return; const p = (el.datasetIndex === 0 ? pts : S.chart_front())[el.index]; if (p && p.r) setDesign(p.r); },
      },
    });
    S.chart_front = () => S.front.slice().sort((a, b) => a.x - b.x);
    $('#c-ramp').style.background = H.rampCss('heat');
    $('#c-range').textContent = M[ck].label + ': ' + fmt(M[ck].better === 'high' ? cmax : cmin, 1) + ' (better) → ' + fmt(M[ck].better === 'high' ? cmin : cmax, 1) + ' ' + M[ck].unit;
    $('#front-note').textContent = front.length + ' of ' + pts.length + ' designs are on the Pareto front for these two axes: none of them can improve one without losing on the other. Click any point to load it into the explorer.';
  }

  // ---------- 6. sensitivity ----------
  function renderSensitivity() {
    const mk = $('#sens-metric').value, m = S.metrics[mk], base = S.data.baseline.levers;
    const sens = H.sensitivity(S.sur, base, mk, m.get);
    const v0 = m.get(base, S.sur.predict(base));
    const oat = sens.oat.map((o) => ({ key: o.key, lo: Math.min(...o.vals.map((v) => v.value)), hi: Math.max(...o.vals.map((v) => v.value)) }))
      .sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo));
    chart('tornado', {
      type: 'bar',
      data: { labels: oat.map((o) => H.LEVER_META[o.key].label), datasets: [{ label: 'Range over the lever, others at baseline', data: oat.map((o) => [o.lo, o.hi]), backgroundColor: css('--accent') }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: m.label + ' (' + m.unit + ') · baseline ' + fmt(v0, 1) } }, y: { grid: { display: false } } } },
    });
    const box = $('#mains');
    box.innerHTML = sens.main.map((s) => '<div class="panel"><span class="eyebrow">' + H.LEVER_META[s.key].label + '</span><div class="chart-box"><canvas id="me-' + s.key + '"></canvas></div></div>').join('');
    sens.main.forEach((s, i) => chart('me-' + s.key, {
      type: 'line',
      data: { labels: s.vals.map((v) => H.LEVER_META[s.key].fmt(v.level)), datasets: [
        { label: 'average over all designs', data: s.vals.map((v) => v.value), borderColor: css('--cool'), pointRadius: 3 },
        { label: 'from the baseline', data: sens.oat[i].vals.map((v) => v.value), borderColor: css('--accent'), pointRadius: 3 }] },
      options: { maintainAspectRatio: false, animation: false, plugins: { legend: { display: i === 0, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } },
    }));
    // real interactions, measured from the grid: how one lever's effect changes behind a roof screen
    const effect = (lever, lo, hi, scr) => {
      const d1 = Object.assign({}, base, { screen_opacity: scr, [lever]: lo }), d2 = Object.assign({}, base, { screen_opacity: scr, [lever]: hi });
      return m.get(d2, S.sur.predict(d2)) - m.get(d1, S.sur.predict(d1));
    };
    const sign = (v) => (v > 0 ? '+' : '') + fmt(v, 1) + ' ' + m.unit;
    $('#interaction').innerHTML = '<b>Interaction checks.</b> Raising the glazing U-value from 1.0 to 5.8 changes ' + m.label.toLowerCase() + ' by ' +
      sign(effect('u', 1.0, 5.8, 0)) + ' with no screen, but ' + sign(effect('u', 1.0, 5.8, 0.9)) + ' behind a 90% screen. ' +
      'Raising day ventilation from 1 to 10 ACH changes it by ' + sign(effect('ach_day', 1, 10, 0)) + ' with no screen and ' +
      sign(effect('ach_day', 1, 10, 0.9)) + ' behind the screen. Levers do not add up independently: search combinations, not one lever at a time.';
  }

  // ---------- 7. assumptions ----------
  function renderAssumptions() {
    const P = H.PARAMS, box = $('#params');
    const labels = { lsg: 'Light-to-solar-gain ratio', vtMax: 'Max visible transmittance', frame: 'Frame factor', theta: 'Visible sky angle θ (°)',
      maintenance: 'Maintenance factor', reflectance: 'Mean reflectance', internalArea: 'Internal surface area (m²)', heatingBase: 'Heating base temp (°C)',
      stackHeight: 'Stack height (m)', stackDeltaT: 'Stack ΔT (K)', ventFreeArea: 'Installed vent free area (m²)', solarUtil: 'Winter solar utilisation',
      tm52Cat: 'TM52 category margin (K)', sfp: 'Fan power, night purge (W per l/s)', pvEff: 'PV yield per incident solar' };
    box.innerHTML = Object.keys(labels).map((k) => '<label for="p-' + k + '">' + labels[k] + '</label><input id="p-' + k + '" type="number" step="any" value="' + P[k] + '">').join('');
    box.querySelectorAll('input').forEach((el) => el.addEventListener('change', () => {
      const k = el.id.slice(2); if (!isNaN(+el.value)) P[k] = +el.value;
      S.hdh = H.heatingDegreeHours(S.data.climate.dry_bulb.present, P.heatingBase);
      S.metrics = buildMetrics(); S.tradeKey = null; renderDesign(); renderTradeoffs(); renderSensitivity();
    }));
    const v = S.val, sw = S.data.sweep;
    $('#validation').innerHTML = v ? 'Grid: <b>' + sw.grid.length + '</b> EnergyPlus runs (' + S.sur.keys.map((k, i) => S.sur.levels[i].length).join(' × ') +
      '). Validation: <b>' + v.n + '</b> extra runs at random off-grid designs. Interpolation error: RMSE <b>' + fmt(v.rmse, 1) + ' K·h</b>, worst <b>' + fmt(v.max, 1) +
      ' K·h</b>, bias ' + fmt(v.bias, 1) + ' K·h.' + (sw.errors && sw.errors.length ? ' ' + sw.errors.length + ' runs failed and are excluded.' : ' No failed runs.') : 'No validation runs in this data set.';
  }

  // ---------- boot ----------
  async function boot() {
    try {
      S.data = await H.load();
    } catch (e) {
      document.querySelectorAll('.loading').forEach((el) => (el.textContent = e.message + '. Serve this folder over http (see README) rather than opening the file directly.'));
      return;
    }
    const at = S.data.baseline.atrium || {};  // measured geometry (export_atrium_geometry.py) overrides the defaults
    [['glassArea', 'glass_m2'], ['floorArea', 'floor_m2'], ['volume', 'volume_m3'], ['internalArea', 'internal_area_m2']]
      .forEach(([p, k]) => { if (at[k] > 0) H.PARAMS[p] = at[k]; });
    S.sur = new H.Surrogate(S.data.sweep);
    S.val = S.sur.validate(S.data.sweep.validation || []);
    S.hdh = H.heatingDegreeHours(S.data.climate.dry_bulb.present, H.PARAMS.heatingBase);
    H.mechInit(S.data);
    S.extras = Object.assign({}, H.EXTRAS_DEFAULT);
    S.metrics = buildMetrics();
    document.querySelectorAll('.loading').forEach((el) => el.remove());

    renderSummary();
    renderClimate('future');
    $('#climate-mode').addEventListener('click', (e) => e.target.dataset.mode && renderClimate(e.target.dataset.mode));
    renderHotWeek();
    try { S.viewer = new H.Viewer($('#viewer'), S.data.radiation, S.data.context); } catch (e) { $('#viewer').textContent = '3D view failed: ' + e.message; }
    renderRadiation('hot_week');
    $('#rad-mode').addEventListener('click', (e) => e.target.dataset.key && renderRadiation(e.target.dataset.key));

    const opts = Object.keys(S.metrics).map((k) => '<option value="' + k + '">' + S.metrics[k].label + (S.metrics[k].source !== 'EnergyPlus' ? ' (' + S.metrics[k].source + ')' : '') + '</option>').join('');
    ['#ax-x', '#ax-y', '#ax-c', '#sens-metric'].forEach((s) => ($(s).innerHTML = opts));
    $('#ax-x').value = 'df'; $('#ax-y').value = 'score'; $('#ax-c').value = 'winter'; $('#sens-metric').value = 'score';
    ['#ax-x', '#ax-y', '#ax-c'].forEach((s) => $(s).addEventListener('change', () => renderTradeoffs()));
    $('#sens-metric').addEventListener('change', renderSensitivity);

    leverControls();
    extrasControls();
    $('#btn-base').addEventListener('click', () => setDesign(S.data.baseline.levers));
    $('#btn-snap').addEventListener('click', snap);
    $('#btn-best').addEventListener('click', () => {
      // lowest score among designs that keep the daylight proxy at or above 5 %
      const ok = S.data.sweep.grid.filter((r) => S.metrics.df.get(r) >= 5).sort((a, b) => a.score - b.score)[0];
      if (ok) setDesign(ok);
    });
    setDesign(S.data.baseline.levers);  // also draws the trade-off chart
    renderSensitivity();
    renderAssumptions();
    renderCatalogue();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { renderHotWeek(); renderRadiation('hot_week'); S.tradeKey = null; renderDesign(); renderSensitivity(); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})(window.HeatLab);

/* Diagrams for the home, introduction, context, scope and openness pages.
 * Uses the frame engine exposed by js/diagrams.js as window.HH, and the
 * generated data in js/data.js (FF) and js/sweep.js (SWEEP). */
(function () {
  "use strict";
  const H = window.HH;
  if (!H) return;
  const { reg, font, clamp, lerp, C, DISP, REDUCED } = H;
  const fmt = (v, dp) => v.toLocaleString("en-GB", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  const PAPER = "#F1F1EA", PINK = "#FF2E9A", CYAN = "#4FE3FF", RED = "#FF3B2F", BLUE = "#3D5BFF", LILAC = "#FF8FD0";
  const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

  // ---------- HOME: the design space as white linework ----------
  // Every design is a point: its direction comes from its levers, its distance
  // from the centre from its score, so the worst designs make the longest spikes.
  // Lines fan from 25 outer apexes (g-value × roof screen) and 25 inner hubs
  // (day × night ventilation) to their 125 designs each.
  const S = typeof SWEEP !== "undefined" ? SWEEP : null;
  if (S) reg("c-lines", function (c, W, Hh, t, p, st) {
    if (!st.pts) linesBuild(st);
    const wide = W > 760, cx = W * (wide ? 0.66 : 0.5), cy = Hh * 0.5, R = Math.min(W * (wide ? 0.22 : 0.26), Hh * 0.32);
    const a = REDUCED ? 0.6 : 0.6 + t * 0.012 + p * 0.5, ca = Math.cos(a), sa = Math.sin(a);
    const tl = -0.35, ct = Math.cos(tl), stl = Math.sin(tl);
    const proj = q => {
      const x = q[0] * ca + q[2] * sa, z0 = -q[0] * sa + q[2] * ca;
      const y = q[1] * ct - z0 * stl, z = q[1] * stl + z0 * ct;
      const k = 3 / (3 - z);  // gentle perspective
      return [cx + x * R * k, cy + y * R * k];
    };
    const P = st.pts.map(proj), A = st.apex.map(proj), Hb = st.hub.map(proj);
    c.strokeStyle = "#F1F1EA"; c.lineWidth = 0.5;
    c.globalAlpha = 0.16; c.beginPath();
    st.pts.forEach((q, i) => { const o = A[q[3]], d = P[i]; c.moveTo(o[0], o[1]); c.lineTo(d[0], d[1]); });
    c.stroke();
    c.globalAlpha = 0.09; c.beginPath();
    st.pts.forEach((q, i) => { const o = Hb[q[4]], d = P[i]; c.moveTo(o[0], o[1]); c.lineTo(d[0], d[1]); });
    c.stroke();
    c.globalAlpha = 1; c.fillStyle = "#F1F1EA";
    A.forEach(o => { c.beginPath(); c.arc(o[0], o[1], 1.4, 0, 7); c.fill(); });
    // a single long stray line, as in a drawing left mid-stroke
    const s0 = A[st.stray];
    c.globalAlpha = 0.6; c.beginPath(); c.moveTo(s0[0], s0[1]); c.lineTo(s0[0] - R * 0.9, s0[1] - R * 0.25); c.stroke();
    c.globalAlpha = 1;
  });

  function linesBuild(st) {
    const N = S.score.length, rnd = seeded(31), lmax = Math.log(Math.max(...S.score));
    const dir = (th, ph) => [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    const pts = [];
    const groupA = Array.from({ length: 25 }, () => [0, 0, 0, 0]);
    for (let i = 0; i < N; i++) {
      const g = Math.floor(i / 625) % 5, d = Math.floor(i / 25) % 5, n = Math.floor(i / 5) % 5, s = i % 5;
      const th = ((g * 5 + s) + rnd() * 0.9) / 25 * 2 * Math.PI;
      const ph = 0.25 + ((d * 5 + n) + rnd() * 0.9) / 25 * (Math.PI - 0.5);
      const r = 0.3 + 0.7 * Math.log(Math.max(1, S.score[i])) / lmax + (rnd() - .5) * 0.08;
      const v = dir(th, ph);
      const q = [v[0] * r, v[1] * r, v[2] * r, g * 5 + s, d * 5 + n];
      pts.push(q);
      const ga = groupA[q[3]]; ga[0] += q[0]; ga[1] += q[1]; ga[2] += q[2]; ga[3]++;
    }
    // apexes sit outside their fan, pushed out by a random spike length
    const apex = groupA.map(ga => {
      const m = [ga[0] / ga[3], ga[1] / ga[3], ga[2] / ga[3]], L = Math.hypot(...m) || 1, k = (1.05 + rnd() * 0.6) / L;
      return [m[0] * k + (rnd() - .5) * 0.3, m[1] * k + (rnd() - .5) * 0.3, m[2] * k + (rnd() - .5) * 0.3];
    });
    const hub = Array.from({ length: 25 }, () => { const v = dir(rnd() * 2 * Math.PI, 0.4 + rnd() * 2.3), r = 0.15 + rnd() * 0.25; return [v[0] * r, v[1] * r, v[2] * r]; });
    Object.assign(st, { pts, apex, hub, stray: Math.floor(rnd() * 25) });
  }

  // ---------- INTRO: one day in the atrium, an hour per step ----------
  if (typeof FF !== "undefined") reg("c-day", function (c, W, Hh, t) {
    const DAY = 3;  // 17 June 2050, the hottest day of the hot week
    const hour = REDUCED ? 14 : Math.floor(t / 3) % 24;
    const op = FF.op[DAY * 24 + hour], out = FF.out[DAY * 24 + hour];
    const occ = hour >= 8 && hour < 18;
    c.strokeStyle = C.k; c.fillStyle = C.k; c.lineWidth = 1.2;
    const fs = clamp(W / 52, 9, 12);
    // hour ruler
    const rx0 = 4, rx1 = W - 4, ry = 18, step = (rx1 - rx0) / 24;
    font(c, fs, 500);
    for (let h = 0; h < 24; h++) {
      const x = rx0 + h * step;
      c.beginPath(); c.moveTo(x, ry - 8); c.lineTo(x, ry + 8); c.stroke();
      if (h === hour) {
        c.fillRect(x + 1, ry - 12, step - 2, 26);
        c.fillStyle = C.y; c.fillText(String(h).padStart(2, "0"), x + (step - c.measureText("00").width) / 2, ry + 5); c.fillStyle = C.k;
      } else if (h % 3 === 0) c.fillText(String(h).padStart(2, "0"), x + 2, ry + 26);
    }
    // stack: one diamond per °C from 16 °C up to the atrium temperature
    const T0 = 16, T1 = 42, top = 74, bot = Hh - 74;
    const yT = T => bot - (T - T0) / (T1 - T0) * (bot - top);
    const sx = W * 0.27, hw = Math.min(W * 0.22, 150), hh = Math.min(hw * 0.3, (bot - top) / (T1 - T0) * 1.05);
    const diamond = (y, wavy, dashed, fill) => {
      c.beginPath();
      const pts = [[sx - hw, y], [sx, y - hh], [sx + hw, y], [sx, y + hh]];
      if (!wavy) { pts.forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.closePath(); }
      else {
        for (let e = 0; e < 4; e++) {
          const a = pts[e], b = pts[(e + 1) % 4];
          for (let k = 0; k <= 12; k++) {
            const f = k / 12, w = Math.sin(f * Math.PI * 4) * 2.4;
            const nx = -(b[1] - a[1]), ny = b[0] - a[0], L = Math.hypot(nx, ny);
            const x = lerp(a[0], b[0], f) + nx / L * w, y2 = lerp(a[1], b[1], f) + ny / L * w;
            e === 0 && k === 0 ? c.moveTo(x, y2) : c.lineTo(x, y2);
          }
        }
        c.closePath();
      }
      if (fill) { c.fillStyle = C.k; c.fill(); }
      c.setLineDash(dashed ? [4, 4] : []); c.stroke(); c.setLineDash([]);
    };
    for (let T = T0; T <= Math.floor(op); T++) diamond(yT(T), T > 26, false, false);
    diamond(yT(op), false, false, true);
    c.lineWidth = 1.6; diamond(yT(out), false, true, false); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(sx, yT(op) + hh); c.lineTo(sx, bot + hh + 14); c.stroke();
    c.beginPath(); c.arc(sx, bot + hh + 18, 4, 0, 7); c.stroke();
    // marker column with leader lines
    const mx = W * 0.72;
    c.beginPath(); c.moveTo(mx, top - 10); c.lineTo(mx, bot + 10); c.stroke();
    const used = [];
    const mark = (T, label, kind) => {
      const y = yT(T);
      // keep labels at least one line apart
      let ty = y + 4;
      used.forEach(u => { if (Math.abs(ty - u) < fs + 4) ty = u - fs - 4; });
      used.push(ty);
      c.setLineDash(kind === "out" ? [4, 4] : []);
      c.beginPath(); c.moveTo(sx + hw + 10, y); c.lineTo(mx - 12, y); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(mx, y - 9); c.lineTo(mx + 9, y); c.lineTo(mx, y + 9); c.lineTo(mx - 9, y); c.closePath();
      kind === "op" ? c.fill() : c.stroke();
      font(c, fs, 500); c.fillText(label, mx + 16, ty);
    };
    mark(26, "26.0° LIMIT", "lim");
    mark(out, out.toFixed(1) + "° OUTDOOR", "out");
    mark(op, op.toFixed(1) + "° ATRIUM", "op");
    // status banner
    const msg = op > 26 ? (occ ? "ATRIUM ABOVE 26 °C · OCCUPIED" : "ABOVE 26 °C · BUILDING EMPTY") : "ATRIUM WITHIN LIMIT";
    font(c, fs + 1, 500);
    const bw = c.measureText(msg).width + 56, bx = clamp(sx - bw / 2 + hw * 0.5, 4, W - bw - 4), by = yT(31) - 16;
    c.fillStyle = C.y; c.fillRect(bx, by, bw, 32); c.fillStyle = C.k;
    c.strokeRect(bx, by, bw, 32);
    for (const ex of [bx, bx + bw - 18]) {
      c.save(); c.beginPath(); c.rect(ex, by, 18, 32); c.clip();
      for (let k = -32; k < 40; k += 5) { c.beginPath(); c.moveTo(ex + k, by + 32); c.lineTo(ex + k + 32, by); c.stroke(); }
      c.restore(); c.strokeRect(ex, by, 18, 32);
    }
    c.fillText(msg, bx + 28, by + 20);
    // legend and clock
    font(c, fs, 400);
    const ly = Hh - 38;
    c.strokeRect(4, ly - 14, 170, 46);
    c.fillText("≤ 26 °C", 12, ly + 2); c.beginPath(); c.moveTo(80, ly - 2); c.lineTo(160, ly - 2); c.stroke();
    c.fillText("> 26 °C", 12, ly + 22);
    c.beginPath(); for (let k = 0; k <= 40; k++) c.lineTo(80 + k * 2, ly + 18 + Math.sin(k * 0.8) * 2.4); c.stroke();
    const clock = "17 JUN 2050 · " + String(hour).padStart(2, "0") + ":00";
    font(c, fs + 1, 500);
    const cw = c.measureText(clock).width + 24;
    c.fillRect(W - cw - 4, ly - 14, cw, 24); c.fillStyle = C.y; c.fillText(clock, W - cw + 8, ly + 3); c.fillStyle = C.k;
    c.strokeRect(W - cw - 4, ly + 12, cw, 22); font(c, fs, 400); c.fillText(occ ? "OCCUPIED 08–18" : "UNOCCUPIED", W - cw + 8, ly + 27);
  });

  // ---------- CONTEXT: every summer hour at the site, today and 2050 ----------
  if (typeof FF !== "undefined" && FF.summer) reg("c-year", function (c, W, Hh, t) {
    const Sm = FF.summer, days = Sm.pre.length / 24, L = 52, top = 26, gapY = 34;
    const ph = (Hh - top - gapY - 30) / 2, cw = (W - L - 4) / days, ch = ph / 24;
    const MONTHS = [["MAY", 0], ["JUN", 31], ["JUL", 61], ["AUG", 92], ["SEP", 123]];
    const scan = REDUCED ? 47 : (t * 2) % days;   // 47 = 17 June
    const panel = (arr, y0, name) => {
      font(c, 12, 800, DISP); c.fillStyle = PAPER; c.fillText(name, 0, y0 + 10);
      font(c, 9, 400); c.fillStyle = C.dim;
      [0, 8, 18, 23].forEach(h => c.fillText(String(h).padStart(2, "0"), 0, y0 + (h + 0.5) * ch + 3 + 14));
      c.strokeStyle = C.dim; c.lineWidth = 1;
      c.beginPath(); c.moveTo(L - 8, y0 + 8 * ch); c.lineTo(L - 8, y0 + 18 * ch); c.stroke();
      for (let d = 0; d < days; d++) for (let h = 0; h < 24; h++) {
        const T = arr[d * 24 + h], x = L + (d + .5) * cw, y = y0 + (h + .5) * ch;
        const m = Math.min(cw, ch) / 2, lit = d === scan;
        if (T < 20) { if (lit) { c.fillStyle = "rgba(241,241,234,.35)"; c.fillRect(x - .5, y - .5, 1, 1); } continue; }
        if (T <= 26) { c.fillStyle = lit ? PAPER : CYAN; c.globalAlpha = lit ? 1 : 0.25 + (T - 20) / 6 * 0.5; c.beginPath(); c.arc(x, y, m * (0.25 + (T - 20) / 6 * 0.35), 0, 7); c.fill(); c.globalAlpha = 1; continue; }
        if (T <= 30) {
          c.strokeStyle = PINK; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, m * 0.85, 0, 7); c.stroke();
          if (T > 28) { c.fillStyle = PINK; c.beginPath(); c.arc(x, y, m * 0.45, 0, 7); c.fill(); }
          continue;
        }
        c.fillStyle = C.y; c.beginPath(); c.arc(x, y, m * 0.95, 0, 7); c.fill();
      }
    };
    panel(Sm.pre, top, "TODAY");
    panel(Sm.fut, top + ph + gapY, "2050");
    font(c, 10, 400); c.fillStyle = C.dim;
    MONTHS.forEach(([m, d]) => c.fillText(m, L + d * cw, Hh - 8));
    // scanning day read-out
    const mx = (arr) => Math.max(...arr.slice(scan * 24, scan * 24 + 24));
    const date = new Date(Date.UTC(2050, 0, 1 + Sm.startDay + scan));
    const lbl = date.getUTCDate() + " " + date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase() +
      " · MAX " + mx(Sm.pre).toFixed(1) + " °C TODAY · " + mx(Sm.fut).toFixed(1) + " °C 2050";
    font(c, 11, 500); c.fillStyle = PAPER; c.textAlign = "right"; c.fillText(lbl, W - 4, 10); c.textAlign = "left";
  });

  // ---------- SCOPE: from the whole stock down to one atrium ----------
  const LAYERS = [
    { n: "England's existing buildings", v: "OUTSIDE PART O · NO OVERHEATING RULE", s: "wavy" },
    { n: "Change of use", v: "17,710 HOMES IN 2024–25 · NO OVERHEATING CHECK", s: "wavy" },
    { n: "Manchester M15", v: "HIGH-RISK POSTCODE · PART O APPENDIX C", s: "dash" },
    { n: "Geoffrey Manton, MMU", v: "TEACHING BUILDING WITH A GLAZED ATRIUM", s: "solid" },
    { n: "The atrium", v: "1,351 m² ROOF GLASS · 21,691 m³", s: "solid" },
    { n: "Hot week, 2050", v: "14–20 JUN · 70 OCCUPIED HOURS", s: "solid" },
    { n: "Design space", v: "5 LEVERS · 3,125 ENERGYPLUS RUNS", s: "fill" }
  ];
  reg("c-scope", function (c, W, Hh, t) {
    const n = LAYERS.length, top = 46, bot = Hh - 36, gy = (bot - top) / (n - 1);
    const sx = W * (W < 600 ? 0.17 : 0.2), maxW = Math.min(W * (W < 600 ? 0.15 : 0.19), 170);
    const cur = REDUCED ? n - 1 : Math.floor(t / 5) % n;
    const lx = W * (W < 600 ? 0.38 : 0.44);
    // shrink the label type until the longest line fits beside the stack
    let fs = 11;
    font(c, fs, 400);
    const longest = Math.max(...LAYERS.map(Lr => c.measureText(Lr.v).width));
    fs = clamp(Math.floor(11 * (W - lx - 12) / longest), 7, 11);
    c.strokeStyle = C.y; c.fillStyle = C.y; c.lineWidth = 1.2;
    font(c, fs, 500);
    c.fillRect(4, 4, 112, 20); c.fillStyle = "#3230FF"; c.fillText("SCOPE CONFIG", 12, 18); c.fillStyle = C.y;
    // spine
    c.beginPath(); c.moveTo(sx, top - 16); c.lineTo(sx, bot + 18); c.stroke();
    c.beginPath(); c.arc(sx, bot + 22, 4, 0, 7); c.stroke();
    LAYERS.forEach((Lr, i) => {
      const y = top + i * gy, hw = maxW * (1 - i / n * 0.86), hh = hw * 0.34, on = i === cur;
      const pts = [[sx - hw, y], [sx, y - hh], [sx + hw, y], [sx, y + hh]];
      c.beginPath();
      if (Lr.s === "wavy") {
        for (let e = 0; e < 4; e++) {
          const a = pts[e], b = pts[(e + 1) % 4], nx = -(b[1] - a[1]), ny = b[0] - a[0], Ln = Math.hypot(nx, ny);
          for (let k = 0; k <= 14; k++) {
            const f = k / 14, w = Math.sin(f * Math.PI * 5) * 2.2;
            const x = lerp(a[0], b[0], f) + nx / Ln * w, yy = lerp(a[1], b[1], f) + ny / Ln * w;
            e === 0 && k === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
          }
        }
      } else pts.forEach((q, k) => k ? c.lineTo(...q) : c.moveTo(...q));
      c.closePath();
      if (on || Lr.s === "fill") c.fill();
      c.setLineDash(Lr.s === "dash" ? [4, 4] : []); c.stroke(); c.setLineDash([]);
      // leader line and label
      c.beginPath(); c.moveTo(sx + hw + 8, y); c.lineTo(lx - 10, y); c.stroke();
      c.beginPath(); c.moveTo(lx - 6, y - 5); c.lineTo(lx, y); c.lineTo(lx - 6, y + 5); c.stroke();
      font(c, fs + 3, 800, DISP);
      const name = Lr.n.toUpperCase();
      if (on) { const w = c.measureText(name).width + 10; c.fillRect(lx + 2, y - fs - 6, w, fs + 10); c.fillStyle = "#3230FF"; }
      c.fillText(name, lx + 7, y - 2); c.fillStyle = C.y;
      font(c, fs, 400); c.fillStyle = PAPER; c.fillText(Lr.v, lx + 7, y + fs + 5); c.fillStyle = C.y;
    });
    font(c, fs, 400); c.fillStyle = PAPER;
    c.fillText(W < 600 ? "~~~ NO RULE  - - - HIGH RISK  ——— OUR STUDY" : "~~~ NO OVERHEATING RULE   - - - HIGH RISK   ——— IN OUR STUDY", 4, Hh - 6);
  });

  // ---------- SCOPE: homes from change of use, England ----------
  // gov.uk Housing supply: net additional dwellings. Gaps are years we have no checked figure for.
  const REUSE = [["15–16", 30600], ["16–17", null], ["17–18", 29720], ["18–19", 29260], ["19–20", null], ["20–21", null], ["21–22", 22770], ["22–23", null], ["23–24", null], ["24–25", 17710]];
  const reuse = reg("c-reuse", function (c, W, Hh) {
    const L = 44, B = 30, T = 18, max = 32000;
    const cw = (W - L - 4) / REUSE.length, y = v => T + (Hh - T - B) * (1 - v / max);
    font(c, 10, 400); c.fillStyle = PAPER; c.strokeStyle = "rgba(241,241,234,.25)"; c.lineWidth = 1;
    [0, 10000, 20000, 30000].forEach(v => {
      c.beginPath(); c.moveTo(L, y(v)); c.lineTo(W - 4, y(v)); c.stroke();
      c.fillText(v ? (v / 1000) + "k" : "0", 4, y(v) + 3);
    });
    const block = (Hh - T - B) / (max / 1000);
    const pts = [];
    REUSE.forEach(([yr, v], i) => {
      const x = L + i * cw + cw * 0.2, w = cw * 0.6;
      c.fillStyle = PAPER; font(c, 10, 400);
      c.fillText(yr, L + i * cw + (cw - c.measureText(yr).width) / 2, Hh - 10);
      if (v === null) {
        c.setLineDash([3, 3]); c.strokeStyle = "rgba(241,241,234,.5)";
        c.strokeRect(x, y(2000), w, y(0) - y(2000)); c.setLineDash([]);
        c.save(); c.translate(x + w / 2 + 3, y(2600)); c.rotate(-Math.PI / 2); font(c, 9, 400); c.fillText("NO FIGURE", 0, 0); c.restore();
        return;
      }
      c.fillStyle = i === REUSE.length - 1 ? PINK : C.y;
      const n = Math.round(v / 1000);
      for (let k = 0; k < n; k++) c.fillRect(x, y((k + 1) * 1000) + 1, w, block - 2);
      const tail = v / 1000 - n;
      if (tail > 0) c.fillRect(x, y(v) + 1, w, block * tail - 1);
      font(c, 12, 800, DISP); c.fillStyle = PAPER;
      const s = fmt(v);
      c.fillText(s, x + (w - c.measureText(s).width) / 2, y(v) - 6);
      pts.push([x + w / 2, y(v)]);
    });
    c.strokeStyle = PAPER; c.setLineDash([2, 4]); c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(...q) : c.moveTo(...q)); c.stroke(); c.setLineDash([]);
  });
  if (reuse) reuse.still = true;

  // ---------- OPENNESS: where the five levers meet ----------
  if (S) reg("c-open", function (c, W, Hh, t, p, st) {
    if (!st.lines || st.w !== W || st.h !== Hh) openBuild(st, W, Hh);
    c.lineWidth = 0.7;
    st.lines.forEach(l => {
      c.strokeStyle = l.col; c.globalAlpha = 0.5;
      c.beginPath(); c.moveTo(l.p0[0], l.p0[1]); c.bezierCurveTo(l.c1[0], l.c1[1], l.c2[0], l.c2[1], l.p1[0], l.p1[1]); c.stroke();
      c.globalAlpha = 1; c.fillStyle = l.col;
      c.beginPath(); c.arc(l.p1[0], l.p1[1], l.r, 0, 7); c.fill();
    });
    // pulses travel out along every fourth line, 20 frames
    const f = REDUCED ? -1 : (t % 20) / 20;
    if (f >= 0) st.lines.forEach((l, i) => {
      if (i % 4) return;
      const u = (f + (i % 7) / 7) % 1, v = 1 - u;
      const x = v * v * v * l.p0[0] + 3 * v * v * u * l.c1[0] + 3 * v * u * u * l.c2[0] + u * u * u * l.p1[0];
      const y = v * v * v * l.p0[1] + 3 * v * v * u * l.c1[1] + 3 * v * u * u * l.c2[1] + u * u * u * l.p1[1];
      c.fillStyle = PAPER; c.fillRect(x - 1.5, y - 1.5, 3, 3);
    });
    // labels
    st.factors.forEach(fa => {
      const lines = [[fa.name, 800, clamp(W / 46, 11, 15), DISP, fa.col], [fa.lever, 400, 10, null, PAPER], ["SPREAD " + fmt(fa.range, 0) + " K·h", 400, 10, null, PAPER]];
      let w = 0;
      lines.forEach(l => { font(c, l[2], l[1], l[3]); w = Math.max(w, c.measureText(l[0]).width); });
      // centre the block on its anchor, then pull it inside the canvas
      const x = clamp(fa.lx - w / 2, 4, W - w - 4);
      lines.forEach((l, k) => { font(c, l[2], l[1], l[3]); c.fillStyle = l[4]; c.fillText(l[0], x, fa.ly + k * 14); });
    });
    const cx = W / 2, cy = Hh / 2;
    font(c, 15, 900, DISP);
    const lab = "OPENNESS", w = c.measureText(lab).width + 20;
    c.fillStyle = C.y; c.fillRect(cx - w / 2, cy - 14, w, 28);
    c.fillStyle = C.k; c.fillText(lab, cx - w / 2 + 10, cy + 6);
  });

  function openBuild(st, W, Hh) {
    const keys = ["g", "screen_opacity", "ach_night", "ach_day", "u"];
    const META = {
      g: ["SOLAR GAIN", "GLAZING g-VALUE", C.y],
      screen_opacity: ["SHADING", "ROOF SCREEN", LILAC],
      ach_night: ["NIGHT PURGE", "NIGHT VENTILATION", CYAN],
      ach_day: ["DAY AIRFLOW", "DAY VENTILATION", BLUE],
      u: ["CONDUCTION", "GLAZING U-VALUE", RED]
    };
    const N = S.score.length, stride = [625, 125, 25, 5, 1];
    const effect = k => {
      const i = S.keys.indexOf(k), sums = [0, 0, 0, 0, 0];
      for (let d = 0; d < N; d++) sums[Math.floor(d / stride[i]) % 5] += S.score[d];
      const m = sums.map(s => s / (N / 5));
      return Math.max(...m) - Math.min(...m);
    };
    const rnd = seeded(23), cx = W / 2, cy = Hh / 2, R = Math.min(W * 0.36, Hh * 0.4);
    const lines = [], factors = [];
    keys.forEach((k, fi) => {
      const range = effect(k), [name, lever, col] = META[k];
      const a = -Math.PI / 2 + fi * 2 * Math.PI / keys.length;
      const tx = cx + Math.cos(a) * R, ty = cy + Math.sin(a) * R;
      const count = Math.round(range / 3);
      for (let j = 0; j < count; j++) {
        const spread = (rnd() - .5) * 1.1, rr = R * (0.75 + rnd() * 0.45);
        const p1 = [cx + Math.cos(a + spread * 0.5) * rr, cy + Math.sin(a + spread * 0.5) * rr];
        const p0 = [cx + (rnd() - .5) * 16, cy + (rnd() - .5) * 16];
        const c1 = [cx + Math.cos(a + spread * 0.2) * rr * 0.35 + (rnd() - .5) * 30, cy + Math.sin(a + spread * 0.2) * rr * 0.35 + (rnd() - .5) * 30];
        const c2 = [cx + Math.cos(a + spread) * rr * 0.7, cy + Math.sin(a + spread) * rr * 0.7];
        lines.push({ p0, c1, c2, p1, col, r: 1 + rnd() * 2 });
      }
      const lr = R * 1.18;
      factors.push({ name, lever, col, range, lx: clamp(cx + Math.cos(a) * lr, 8, W - 8), ly: clamp(cy + Math.sin(a) * lr, 18, Hh - 34) });
    });
    Object.assign(st, { lines, factors, w: W, h: Hh });
  }
})();

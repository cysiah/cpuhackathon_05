(function () {
  "use strict";
  const FPS = 12;                 // stepped like a GIF
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const C = { y: "#EEFF00", k: "#0B0B0A", w: "#F1F1EA", dim: "#6F7064" };
  const MONO = '"IBM Plex Mono", ui-monospace, monospace';
  const DISP = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  let tick = 0;
  const figs = [];

  function reg(id, draw, init) {
    const el = document.getElementById(id);
    if (!el) return;
    const f = { el, ctx: el.getContext("2d"), draw, sec: el.closest("section"), vis: true, w: 0, h: 0, state: init ? init() : {} };
    figs.push(f);
    new IntersectionObserver(es => { f.vis = es[0].isIntersecting; if (f.vis) paint(f); }, { rootMargin: "80px" }).observe(el);
    return f;
  }
  function size(f) {
    const r = f.el.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    if (!r.width) return false;
    if (f.w !== r.width || f.h !== r.height) {
      f.w = r.width; f.h = r.height;
      f.el.width = Math.round(r.width * d); f.el.height = Math.round(r.height * d);
      f.ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    return true;
  }
  // scroll progress of the section through the viewport, 0..1
  function prog(f) {
    const r = f.sec.getBoundingClientRect(), vh = innerHeight;
    return clamp((vh - r.top) / (vh * 0.6 + r.height * 0.6), 0, 1);
  }
  function paint(f) {
    if (!size(f)) return;
    const c = f.ctx; c.clearRect(0, 0, f.w, f.h);
    f.draw(c, f.w, f.h, REDUCED ? 0 : tick, REDUCED ? 1 : prog(f), f.state);
  }
  const paintAll = () => figs.forEach(f => f.vis && paint(f));

  // ---------- helpers ----------
  function font(c, px, w, fam) { c.font = `${w || 500} ${px}px ${fam || MONO}`; }
  function arrow(c, x1, y1, x2, y2, s) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - s * Math.cos(a - .45), y2 - s * Math.sin(a - .45));
    c.lineTo(x2 - s * Math.cos(a + .45), y2 - s * Math.sin(a + .45));
    c.closePath(); c.fill();
  }

  // ---------- CONTEXT: a dotted globe, land in yellow ----------
  reg("c-sphere", function (c, W, H, t, p, S) {
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    // starts with the UK facing the viewer and turns east to west
    const a = REDUCED ? 0 : -(t * 0.03 + p * 0.6), tilt = -0.42;  // north pole leans toward the viewer
    const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
    const proj = q => {
      const x = q[0] * ca + q[2] * sa, z0 = -q[0] * sa + q[2] * ca;
      const y = q[1] * ct - z0 * st, z = q[1] * st + z0 * ct;
      return [cx + x * R, cy + y * R, z];
    };
    c.strokeStyle = "rgba(241,241,234,.2)"; c.lineWidth = 1; c.setLineDash([1, 4]);
    for (let k = 0; k < 2; k++) { c.beginPath(); c.ellipse(cx, cy, R * (1.16 + k * .12), R * (0.3 + k * .22), -0.32 + k * 0.6, 0, 7); c.stroke(); }
    c.setLineDash([]);
    c.strokeStyle = "rgba(241,241,234,.25)"; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    const pts = S.pts;
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i], [x, y, z] = proj(q);
      if (z < 0) { if (q[3]) { c.fillStyle = "rgba(238,255,0,.08)"; c.fillRect(x - .5, y - .5, 1, 1); } continue; }
      const d = 0.35 + z * 0.65;
      if (q[3]) { c.fillStyle = `rgba(238,255,0,${d})`; c.beginPath(); c.arc(x, y, 0.6 + d * 1.3, 0, 7); c.fill(); }
      else { c.fillStyle = `rgba(241,241,234,${0.06 + z * 0.12})`; c.fillRect(x - .6, y - .6, 1.2, 1.2); }
    }
    // red pop-outs: each grows and falls back over 16 stepped frames
    S.spikes.forEach((q, i) => {
      const [x, y, z] = proj(q);
      if (z < 0.15) return;
      const f = REDUCED ? 0.5 : ((t + q[4]) % 16) / 16, L = q[5] * Math.sin(f * Math.PI);
      const ex = cx + (x - cx) * (1 + L), ey = cy + (y - cy) * (1 + L);
      c.strokeStyle = "rgba(255,59,47,.85)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
      c.fillStyle = "#FF3B2F"; c.beginPath(); c.arc(ex, ey, 1.6 + L * 6, 0, 7); c.fill();
    });
    // Manchester
    const [mx, my, mz] = proj(S.man);
    if (mz > 0) {
      c.strokeStyle = C.y; c.lineWidth = 1.4;
      c.beginPath(); c.arc(mx, my, 7, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(mx + 7, my - 7); c.lineTo(mx + 30, my - 30); c.lineTo(mx + 46, my - 30); c.stroke();
      font(c, 11, 500); c.fillStyle = C.y; c.fillText("MANCHESTER 53.5°N", mx + 50, my - 26);
    }
    font(c, 10, 400); c.fillStyle = C.dim;
    c.fillText("LAND · NATURAL EARTH 1:110M", 8, H - 10);
    c.textAlign = "right"; c.fillText("RED: ILLUSTRATIVE HEAT EVENTS", W - 8, H - 10); c.textAlign = "left";
  }, function () {
    const land = (() => {
      if (typeof LAND === "undefined") return () => 0;
      const raw = atob(LAND.bits);
      return (lat, lon) => {
        const x = clamp(Math.floor(lon + 180), 0, LAND.w - 1), y = clamp(Math.floor(90 - lat), 0, LAND.h - 1), i = y * LAND.w + x;
        return (raw.charCodeAt(i >> 3) >> (i & 7)) & 1;
      };
    })();
    const v = (lat, lon) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return [Math.cos(la) * Math.sin(lo), -Math.sin(la), Math.cos(la) * Math.cos(lo)]; };
    const n = 7000, pts = [], g = Math.PI * (3 - Math.sqrt(5));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const yy = 1 - (i / (n - 1)) * 2, lat = Math.asin(yy) * 180 / Math.PI;
      const lon = ((g * i * 180 / Math.PI) % 360) - 180;
      pts.push([...v(lat, lon), land(lat, lon)]);
    }
    const spikes = pts.filter(q => q[3] && rnd() < 0.035).map(q => [q[0], q[1], q[2], 1, Math.floor(rnd() * 16), 0.08 + rnd() * 0.22]);
    return { pts, spikes, man: v(53.48, -2.24) };
  });

  // ---------- BASELINE: hot week chart ----------
  reg("c-week", function (c, W, H, t, p) {
    const op = FF.op, out = FF.out, n = 168;
    const L = 34, Rm = 8, T = 30, B = 36;
    const x = i => L + (W - L - Rm) * i / (n - 1);
    const y = v => T + (H - T - B) * (1 - (v - 16) / (42 - 16));
    c.strokeStyle = C.k; c.fillStyle = C.k;
    font(c, 10, 400);
    // occupied bands
    for (let d = 0; d < 7; d++) {
      c.fillStyle = "rgba(11,11,10,.06)";
      c.fillRect(x(d * 24 + 8), T, x(d * 24 + 18) - x(d * 24 + 8), H - T - B);
      c.fillStyle = C.k;
      c.fillText(String(14 + d) + " JUN", x(d * 24 + 6), H - B + 18);
    }
    // grid
    [20, 26, 30, 35, 40].forEach(v => {
      c.lineWidth = v === 26 ? 1.4 : .5; c.setLineDash(v === 26 ? [] : [2, 4]);
      c.beginPath(); c.moveTo(L, y(v)); c.lineTo(W - Rm, y(v)); c.stroke();
      c.setLineDash([]); c.fillText(v + "°", 4, y(v) + 3);
    });
    c.fillText("26 °C LIMIT", W - Rm - 70, y(26) + 14);
    // excess hatch up to scroll cursor
    const cur = Math.floor(lerp(30, n - 1, clamp(p / 0.8, 0, 1)));
    let sum = 0;
    c.lineWidth = 1;
    for (let i = 0; i <= cur; i++) {
      const h = i % 24;
      if (h < 8 || h >= 18 || op[i] <= 26) continue;
      sum += op[i] - 26;
      const x0 = x(i), x1 = x(Math.min(i + 1, n - 1));
      c.save(); c.beginPath(); c.rect(x0, y(op[i]), x1 - x0, y(26) - y(op[i])); c.clip();
      for (let k = -40; k < 40; k += 4) { c.beginPath(); c.moveTo(x0 + k, y(26)); c.lineTo(x0 + k + 40, y(26) - 40 * 2); c.stroke(); }
      c.restore();
    }
    // lines
    c.lineWidth = 1.1; c.setLineDash([4, 4]);
    c.beginPath(); out.forEach((v, i) => c.lineTo(x(i), y(v))); c.stroke();
    c.setLineDash([]); c.lineWidth = 2.2;
    c.beginPath(); op.forEach((v, i) => c.lineTo(x(i), y(v))); c.stroke();
    // cursor
    c.lineWidth = 1; c.beginPath(); c.moveTo(x(cur), T - 6); c.lineTo(x(cur), H - B); c.stroke();
    font(c, 13, 800, DISP);
    const lbl = "Σ " + (cur === n - 1 ? "320.6" : sum.toFixed(1)) + " K·h";
    const lw = c.measureText(lbl).width;
    const lx = clamp(x(cur) - lw / 2, L, W - Rm - lw);
    c.fillText(lbl, lx, T - 12);
    // peak markers, blinking every other frame
    const pk = op.indexOf(Math.max(...op)), po = out.indexOf(Math.max(...out));
    if (t % 4 < 2 || REDUCED) { c.beginPath(); c.arc(x(pk), y(op[pk]), 4.5, 0, 7); c.fill(); }
    c.beginPath(); c.arc(x(po), y(out[po]), 3, 0, 7); c.stroke();
    font(c, 10, 500);
    c.fillText("ATRIUM 40.5 °C", x(pk) + 8, y(op[pk]) + 4);
    c.fillText("OUTDOOR 33.5 °C", x(po) + 8, y(out[po]) + 14);
    // legend
    font(c, 10, 400);
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(L, H - 8); c.lineTo(L + 22, H - 8); c.stroke();
    c.fillText("ATRIUM, OPERATIVE", L + 28, H - 5);
    c.lineWidth = 1.1; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(L + 160, H - 8); c.lineTo(L + 182, H - 8); c.stroke(); c.setLineDash([]);
    c.fillText("OUTDOOR AIR", L + 188, H - 5);
  });

  // ---------- OUTDOOR FLOOR: stacked dot terrains ----------
  reg("c-terrain", function (c, W, H, t, p) {
    const layers = [
      { d: FF.out.map(v => v + 2), n: "2050 +2 °C", v: "83 K·h" },
      { d: FF.out, n: "2050 FILE", v: "46.8 K·h" },
      { d: FF.pre, n: "TODAY", v: "3 K·h" }
    ];
    const NI = 48, NJ = 13;           // half-hours × interpolated days
    const A = Math.min(W * 0.4, H * 0.42), cx = W * 0.47;
    const gap = lerp(H * 0.17, H * 0.21, p);
    const top = H * 0.53 - gap;
    const scan = REDUCED ? -1 : (t % 24) * 2;  // sweeping hour line
    const sample = (d, i, j) => {
      const hr = i / 2, dy = j / 2;
      const h0 = Math.floor(hr), d0 = Math.floor(dy), h1 = Math.min(23, h0 + 1), d1 = Math.min(6, d0 + 1);
      const fh = hr - h0, fd = dy - d0;
      const v = (a, b) => d[a * 24 + b];
      return lerp(lerp(v(d0, h0), v(d0, h1), fh), lerp(v(d1, h0), v(d1, h1), fh), fd);
    };
    layers.forEach((Lr, k) => {
      const cy = top + k * gap;
      for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
        const u = i / (NI - 1) - .5, v = j / (NJ - 1) - .5;
        const T = sample(Lr.d, i, j);
        const z = clamp((T - 14) / 24, 0, 1);
        const px = cx + (u - v) * A, py = cy + (u + v) * A * 0.36 - z * H * 0.13;
        const hr = i / 2, hot = hr >= 8 && hr < 18 && T > 26;
        const lit = Math.abs(i - scan) < 1;
        c.fillStyle = hot ? C.y : `rgba(241,241,234,${0.25 + z * 0.6})`;
        const r = hot ? 1.2 + (T - 26) * 0.18 : 0.7 + z * 0.8;
        c.beginPath(); c.arc(px, py, lit ? r + 1 : r, 0, 7); c.fill();
      }
      // label at the right corner of the plane
      const lx = Math.min(cx + A * 0.62, W - 96), ly = cy + A * 0.02;
      c.fillStyle = C.w; font(c, 13, 800, DISP); c.fillText(Lr.n, lx, ly);
      font(c, 11, 400); c.fillStyle = k === 2 ? C.w : C.y; c.fillText(Lr.v, lx, ly + 16);
    });
    c.fillStyle = C.dim; font(c, 10, 400);
    c.fillText("+ PASS LIMIT 42 K·h", 6, 14);
    c.fillText("00:00 → 24:00 · 14 → 20 JUN", 6, H - 8);
  });

  // ---------- HEAT BALANCE: exploded isometric ----------
  reg("c-heat", function (c, W, H, t, p) {
    const s = Math.min(W, H) * 0.3, cx = W * 0.52, cy = H * 0.6;
    const ex = lerp(0.85, 1.25, p);  // explode with scroll
    const zRoof = 1.55 * ex, zTop = 2.9 * ex;
    const P = (x, y, z) => [cx + (x - y) * s * 0.87, cy + (x + y) * s * 0.5 - z * s * 0.55];
    c.strokeStyle = C.k; c.fillStyle = C.k;
    const ln = (a, b) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); };
    const quad = (z) => { c.beginPath(); [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(q => c.lineTo(...P(q[0], q[1], z))); c.closePath(); };
    // concrete: dot plane
    c.lineWidth = 1; quad(0); c.stroke();
    for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) {
      const q = P(-1 + (i + .5) / 10, -1 + (j + .5) / 10, 0);
      c.beginPath(); c.arc(q[0], q[1], .9, 0, 7); c.fill();
    }
    // air volume, dashed box
    c.setLineDash([3, 4]);
    quad(zRoof * 0.82); c.stroke();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(q => ln(P(q[0], q[1], 0), P(q[0], q[1], zRoof * 0.82)));
    c.setLineDash([]);
    // roof glass grid
    c.fillStyle = "rgba(238,255,0,.9)"; quad(zRoof); c.fill(); c.fillStyle = C.k;
    c.lineWidth = 1.3; quad(zRoof); c.stroke(); c.lineWidth = .7;
    for (let i = 1; i < 12; i++) {
      const v = -1 + i / 6;
      ln(P(v, -1, zRoof), P(v, 1, zRoof)); ln(P(-1, v, zRoof), P(1, v, zRoof));
    }
    // sun particles, 24-frame loop: 47% pass the glass (22,856 of 48,553 kWh)
    const N = 46;
    for (let k = 0; k < N; k++) {
      const ph = ((t + k * 5) % 24) / 24;
      const gx = -0.9 + ((k * 37) % 19) / 10, gy = -0.9 + ((k * 53) % 19) / 10;
      const through = (k * 7) % 100 < 47;
      let z;
      if (ph < 0.45) z = lerp(zTop, zRoof, ph / 0.45);
      else z = through ? lerp(zRoof, 0.02, (ph - 0.45) / 0.55) : zRoof + (ph - .45) * 1.2;
      if (!through && ph >= 0.45) { c.globalAlpha = 1 - (ph - .45) / .55; }
      const q = P(gx, gy, z);
      c.fillRect(q[0] - 2, q[1] - 2, 4, 4);
      c.globalAlpha = 1;
    }
    // vent arrows, day out of the side
    c.lineWidth = 1.1;
    const off = (t % 6) / 6 * 10;
    const a0 = P(1, 0, zRoof * 0.45), a1 = P(1.55, 0, zRoof * 0.45);
    c.setLineDash([4, 3]); c.lineDashOffset = -off; ln(a0, a1); c.setLineDash([]);
    arrow(c, a1[0] - 1, a1[1] - .5, a1[0] + 6, a1[1] + 3.5, 7);
    const b0 = P(0, 1, 0.25), b1 = P(0, 1.55, 0.25);
    c.setLineDash([4, 3]); ln(b0, b1); c.setLineDash([]);
    arrow(c, b1[0] + 1, b1[1] - .5, b1[0] - 6, b1[1] + 3.5, 7);
    c.lineDashOffset = 0;
    // labels
    const fs = clamp(W / 46, 10, 12);
    font(c, fs, 500);
    const t1 = P(-1, -1, zTop); c.fillText("SUN ON GLASS 48,553 kWh", 8, t1[1] - 4);
    const t2 = P(-1, 1, zRoof); c.fillText("ROOF GLASS 1,351 m²", 8, t2[1] + 4);
    c.fillText("THROUGH IT 22,856 kWh", 8, t2[1] + 4 + fs * 1.4);
    const t3 = P(-1, 1, zRoof * 0.4); c.fillText("AIR 21,691 m³", 8, t3[1]);
    const t4 = P(-1, 1, 0); c.fillText("CONCRETE ≈ 1,000 m²", 8, t4[1] + 20);
    c.textAlign = "right";
    c.fillText("DAY VENT 28.6 kW/K", W - 6, a1[1] - 12);
    c.fillText("NIGHT VENT 7.2 kW/K", W - 6, b1[1] + 26);
    c.textAlign = "left";
  });

  // ---------- DESIGN SPACE: 3,125 dots ----------
  // sweep order: g, u, ach_day, ach_night, screen (5 levels each)
  const IDX = (g, u, d, n, s) => (((g * 5 + u) * 5 + d) * 5 + n) * 5 + s;
  reg("c-space", function (c, W, H, t, p) {
    const sc = FF.scores, tall = W < H;
    const nr = tall ? 125 : 25, nc = tall ? 25 : 125;
    const top = tall ? 4 : 18, left = tall ? 4 : 4;
    const cw = (W - left - 4) / nc, ch = (H - top - (tall ? 4 : 22)) / nr;
    const fade = clamp((p - 0.25) / 0.5, 0, 1);  // failing designs drop away with scroll
    const scan = REDUCED ? -1 : (t * 3) % (tall ? nr : nc);
    let base = null;
    for (let g = 0; g < 5; g++) for (let u = 0; u < 5; u++) for (let d = 0; d < 5; d++) for (let n = 0; n < 5; n++) for (let s = 0; s < 5; s++) {
      const row = g * 5 + u, col = (d * 5 + n) * 5 + s;
      const r_ = tall ? col : row, c_ = tall ? row : col;
      const v = sc[IDX(g, u, d, n, s)] / 10;
      const x = left + (c_ + .5) * cw, y = top + (r_ + .5) * ch;
      const lit = (tall ? r_ : c_) === scan;
      if (v <= 42) {
        c.fillStyle = C.y;
        c.beginPath(); c.arc(x, y, Math.min(cw, ch) * (lit ? .5 : .38), 0, 7); c.fill();
      } else {
        const a = (0.14 + 0.5 * clamp(1 - Math.log(v / 42) / Math.log(60), 0, 1)) * (1 - fade * 0.85);
        c.fillStyle = `rgba(241,241,234,${lit ? Math.min(1, a + .4) : a})`;
        c.beginPath(); c.arc(x, y, Math.min(cw, ch) * .26, 0, 7); c.fill();
      }
      if (g === 3 && u === 2 && d === 2 && n === 1 && s === 0) base = [x, y];
    }
    // baseline design ring
    if (base) {
      c.strokeStyle = C.w; c.lineWidth = 1.2;
      c.beginPath(); c.arc(base[0], base[1], Math.max(6, Math.min(cw, ch) * 1.6), 0, 7); c.stroke();
      font(c, 11, 500); c.fillStyle = C.w;
      const lbl = "BASELINE · 320.6 K·h";
      const tw = c.measureText(lbl).width;
      c.fillText(lbl, clamp(base[0] + 12, 4, W - tw - 4), tall ? base[1] - 12 : H - 6);
    }
    if (!tall) {
      font(c, 10, 400); c.fillStyle = "rgba(241,241,234,.75)";
      c.fillText("PASS ≤ 42 K·h: 1,041 OF 3,125", 4, 11);
      c.textAlign = "right"; c.fillText("DAY VENT 1 → 10 ACH  ·  NIGHT VENT 0 → 10  ·  SCREEN 0 → 0.9", W - 4, 11); c.textAlign = "left";
    }
  });

  // ---------- HEADROOM: stacked planes ----------
  reg("c-planes", function (c, W, H, t, p, S) {
    const L = [0, 2, 4];
    const cells = [];
    for (const g of L) for (const u of L) for (const d of L) for (const n of L) for (const s of L)
      cells.push(FF.scores[IDX(g, u, d, n, s)] / 10);
    // bottom plane is real; upper planes scale the score as a placeholder
    const planes = [
      { n: "2050 FILE", m: 1, real: true },
      { n: "+0.5 °C", m: 1.25 },
      { n: "+1 °C", m: 1.6 },
      { n: "+2 °C", m: 2.4 }
    ];
    const NR = 9, NC = 27;
    // the stack (three gaps plus one plane's depth) always fits inside the canvas
    const A = Math.min(W * 0.48, H * 0.44);
    const cx = W * 0.58;
    const gap = Math.min(lerp(H * 0.12, H * 0.17, p), (H * 0.84 - A * 0.72) / 3);
    const baseY = (H + 3 * gap + A * 0.72) / 2;
    const P = (u, v, y0) => [cx + (u - v) * A * 0.86, y0 + (u + v) * A * 0.36];
    c.strokeStyle = C.k; c.fillStyle = C.k;
    planes.forEach((pl, k) => {
      const y0 = baseY - k * gap - A * 0.36;
      // plane outline
      c.lineWidth = 1.1;
      c.beginPath(); [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].forEach(q => c.lineTo(...P(q[0], q[1], y0))); c.closePath();
      c.fillStyle = "rgba(238,255,0,.85)"; c.fill(); c.stroke(); c.fillStyle = C.k;
      let pass = 0;
      for (let i = 0; i < 243; i++) {
        const r = Math.floor(i / NC), col = i % NC;
        const ok = cells[i] * pl.m <= 42; if (ok) pass++;
        const u0 = -.5 + col / NC, v0 = -.5 + r / NR, du = 1 / NC * .78, dv = 1 / NR * .78;
        c.beginPath();
        [[u0, v0], [u0 + du, v0], [u0 + du, v0 + dv], [u0, v0 + dv]].forEach(q => c.lineTo(...P(q[0] + .01, q[1] + .01, y0)));
        c.closePath();
        if (ok) c.fill(); else { c.lineWidth = .4; c.stroke(); }
      }
      const lp = P(-.5, .5, y0);
      c.fillStyle = C.w;
      font(c, 12, 800, DISP); c.fillText(pl.n, 6, lp[1] - 6);
      font(c, 10, 400); c.fillText(pass + " / 243 PASS" + (pl.real ? " · E+" : " · TBC"), 6, lp[1] + 8);
      c.fillStyle = C.k;
    });
    // brackets for the corners, like a section drawing
    c.lineWidth = 1; c.strokeStyle = C.w; c.fillStyle = C.y;
    const tl = P(.5, -.5, baseY - 3 * gap - A * 0.36), bl = P(.5, -.5, baseY - A * 0.36);
    c.beginPath(); c.moveTo(tl[0], tl[1]); c.lineTo(bl[0], bl[1]); c.stroke();
    // designs falling out between planes, 20-frame loop
    for (let k = 0; k < 9; k++) {
      const ph = ((t + k * 4) % 20) / 20;
      const lvl = 1 + (k % 3);
      const y0 = baseY - lvl * gap - A * 0.36;
      const q = P(-.35 + (k * .09) % .7, -.3 + ((k * 5) % 7) * .09, y0 + ph * gap * 0.9);
      c.globalAlpha = 1 - ph;
      c.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5);
      c.globalAlpha = 1;
    }
    font(c, 10, 400); c.fillStyle = C.dim;
    c.textAlign = "right"; c.fillText("ONE CELL = ONE DESIGN · FILLED = PASS ≤ 42 K·h", W - 4, H - 6); c.textAlign = "left";
  });

  // shared with js/explorer.js
  window.HH = { reg, paint, font, clamp, lerp, C, MONO, DISP, REDUCED };

  // ---------- loop ----------
  let last = 0;
  function loop(now) {
    // figures marked still only redraw on scroll, resize or when their own script asks
    if (now - last >= 1000 / FPS) { last = now; tick++; figs.forEach(f => f.vis && !f.still && paint(f)); }
    requestAnimationFrame(loop);
  }
  addEventListener("scroll", paintAll, { passive: true });
  addEventListener("resize", paintAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintAll);
  paintAll();
  if (!REDUCED) requestAnimationFrame(loop);
})();

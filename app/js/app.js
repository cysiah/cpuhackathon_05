/* Floorplate Heat Map: the views. All maths lives in model.js (window.FM). */
(function () {
  "use strict";
  var FM = window.FM;
  var $ = function (id) { return document.getElementById(id); };

  var RUNGS = ["Existing", "Keep heat out", "Store it, release it", "Ventilate passively", "Move the air", "Cool mechanically"];
  var LEDGER_LABELS = {
    daylight_pct: ["Atrium daylight factor", "%"],
    fan_kwh_wk: ["Fan energy if mechanical", "kWh/wk"],
    winter_mwh_yr: ["Winter glazing loss", "MWh/yr"],
    embodied_tco2e: ["Embodied carbon of the move", "tCO₂e"],
    cost_gbp: ["Capital cost", "£"],
    pv_mwh_yr: ["PV yield", "MWh/yr"]
  };
  var HEAT = ["#FBF3E4", "#F6D3A1", "#EE9A5B", "#D65A31", "#9E2A2B", "#5C1A1B"];
  var COOL = ["#F4F1EA", "#CFE0EC", "#93BDD9", "#4F8DBE", "#2A5F94", "#173A63"];
  var DIV = ["#1F5A96", "#6E9FCB", "#C9D9E8", "#F2EEE7", "#F2C3A8", "#DB7B52", "#A3301F"];
  var HOT = ["#E9E4DA", "#F3D27A", "#EE9A5B", "#D14B2F", "#7A1E1E"];
  var BIV = [["#e8e8e8", "#e4acac", "#c85a5a"], ["#b0d5df", "#ad9ea5", "#985356"], ["#64acbe", "#627f8c", "#574249"]];
  var FLOOR_COLORS = ["#2F6FB0", "#B83A14", "#2E7D4F", "#7A4FA0"];

  /* Two lenses on the same data (A25). Placeholder wording until the team answers. */
  var LENS = {
    architect: {
      question: "Where does the heat arrive on each floor, what decides it, and what does fixing it cost the daylight?",
      mode: "single", a: "kh", b: "sun_h", showScatter: true, showRank: false
    },
    estates: {
      question: "Which parts of GF and 5F fail, how much floor area is that, and which intervention fixes the most for the money?",
      mode: "grade", a: "kh", b: "df", showScatter: false, showRank: true
    }
  };

  var S = {
    meta: null, scenarios: [], floors: {}, assumptions: [],
    res: null, cmp: null, selected: null, view: {}, lens: "architect", rankKey: null, rankRows: null,
    grade: JSON.parse(JSON.stringify(FM.GRADE_DEFAULTS)), custom: null, lever: null, baseRes: null
  };

  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function fmt(v, dp) { return v === null || v === undefined || !isFinite(v) ? "–" : Number(v).toFixed(dp); }
  function lerpHex(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }
  function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    var x = t * (stops.length - 1), i = Math.min(Math.floor(x), stops.length - 2);
    return lerpHex(stops[i], stops[i + 1], x - i);
  }
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ": " + r.status);
      return r.json();
    });
  }

  /* ------------------------------------------------------------ state */
  function params() {
    return {
      stratKperM: +$("strat").value,
      enclosedOffsetK: +$("encOff").value,
      calibrate: $("calibrate").checked,
      hotKh: +$("hotKh").value,
      darkDf: +$("darkDf").value,
      grade: S.grade
    };
  }
  function mode() { return document.querySelector("input[name=mode]:checked").value; }
  function scenById(id) { return id === "custom" ? S.custom : S.scenarios.find(function (s) { return s.id === id; }); }
  function zoneShown(z) {
    if (z === FM.ZONE.ENCLOSED) return $("zEnclosed").checked;
    if (z === FM.ZONE.OPEN) return $("zOpen").checked;
    return false;
  }

  function recompute() {
    var p = params();
    S.res = FM.computeAll(S.floors, scenById($("scenario").value), S.meta, p);
    var c = $("compare").value, cur = $("scenario").value;
    S.cmp = c ? FM.computeAll(S.floors, scenById(c), S.meta, p) : null;
    S.baseRes = cur === "base" ? S.res : (c === "base" ? S.cmp : FM.computeAll(S.floors, S.scenarios[0], S.meta, p));
    render();
  }

  /* value of the active view at point i, for colouring */
  function valueAt(fid, i) {
    var m = mode(), a = $("layerA").value, b = $("layerB").value, r = S.res[fid];
    if (r.kh[i] === null) return null;
    if (m === "single") return r[a][i];
    if (m === "bivariate") return [r[a][i], r[b][i]];
    if (m === "hotspot") return FM.hotspot(r, i, params());
    if (m === "delta") return S.cmp ? r[a][i] - S.cmp[fid][a][i] : null;
    if (m === "grade") return r.grade[i];
  }

  function scales() {
    var a = $("layerA").value, b = $("layerB").value, all = S.meta.floors;
    var visA = [], visB = [], dA = [];
    all.forEach(function (fid) {
      var f = S.floors[fid], r = S.res[fid];
      var va = [], vb = [], dd = [];
      for (var i = 0; i < f.x.length; i++) {
        if (!zoneShown(f.zone[i]) || r.kh[i] === null) continue;
        va.push(r[a][i]); vb.push(r[b][i]);
        if (S.cmp) dd.push(r[a][i] - S.cmp[fid][a][i]);
      }
      visA.push(va); visB.push(vb); dA.push(dd);
    });
    var dr = FM.range(dA), dmax = Math.max(Math.abs(dr[0]), Math.abs(dr[1]), 1e-6);
    return { rangeA: FM.range(visA), cutsA: FM.tertiles(visA), cutsB: FM.tertiles(visB), dmax: dmax };
  }

  function colorFor(v, sc) {
    var m = mode(), a = $("layerA").value, L = FM.LAYERS[a];
    if (m === "single") {
      var t = (v - sc.rangeA[0]) / (sc.rangeA[1] - sc.rangeA[0]);
      return ramp(L.better === "higher" ? COOL : HEAT, t);
    }
    if (m === "bivariate") return BIV[FM.classOf(v[1], sc.cutsB)][FM.classOf(v[0], sc.cutsA)];
    if (m === "hotspot") return HOT[v.count];
    if (m === "grade") return BAND_COLORS[FM.gradeClass(v, S.grade)];
    if (m === "delta") {
      if (v === null) return css("--line");
      var worse = L.better === "higher" ? -v : v;
      return ramp(DIV, 0.5 + 0.5 * worse / sc.dmax);
    }
  }

  /* ------------------------------------------------------------ plans */
  function buildPlans() {
    var host = $("plans");
    host.innerHTML = "";
    S.meta.floors.forEach(function (fid) {
      var f = S.floors[fid];
      var xs = f.x, ys = f.y, g = f.grid_mm;
      var minX = Math.min.apply(null, xs) - g / 2, maxX = Math.max.apply(null, xs) + g / 2;
      var minY = Math.min.apply(null, ys) - g / 2, maxY = Math.max.apply(null, ys) + g / 2;
      f.outline_mm.forEach(function (p) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
      });
      var pad = 60, W = 680;
      var k = (W - 2 * pad) / (maxX - minX);
      var H = Math.round((maxY - minY) * k + 2 * pad);
      var lookup = {};
      for (var i = 0; i < xs.length; i++) lookup[Math.floor((xs[i] - minX) / g) + "," + Math.floor((ys[i] - minY) / g)] = i;
      var area = f.zone.filter(function (z) { return z !== FM.ZONE.VOID; }).length * Math.pow(g / 1000, 2);

      var div = document.createElement("div");
      div.className = "plan";
      div.innerHTML = "<h3>" + fid + "</h3><div class='meta'>Level +" + f.level_mm.toLocaleString() +
        " mm · floor area " + Math.round(area).toLocaleString() + " m² · grid " + g + " mm" +
        (/placeholder/.test(f.source) ? " · <span class='tag need'>A01 A03 A04 placeholder floor plate</span>" : " · <span class='tag sim'>E+ atrium floor</span>") + "</div>";
      var cv = document.createElement("canvas");
      var dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.aspectRatio = W + " / " + H;
      cv.setAttribute("aria-label", fid + " floor plan heat map");
      div.appendChild(cv);
      host.appendChild(div);
      S.view[fid] = { cv: cv, k: k, pad: pad, minX: minX, minY: minY, H: H, W: W, dpr: dpr, lookup: lookup };
      cv.addEventListener("mousemove", function (e) { hover(fid, e); });
      cv.addEventListener("mouseleave", function () { $("tip").hidden = true; });
    });
  }

  function toPx(v, x, y) { return [v.pad + (x - v.minX) * v.k, v.H - v.pad - (y - v.minY) * v.k]; }

  function drawPlans() {
    var sc = scales();
    S.meta.floors.forEach(function (fid) {
      var f = S.floors[fid], v = S.view[fid], ctx = v.cv.getContext("2d");
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.clearRect(0, 0, v.W, v.H);
      var cell = f.grid_mm * v.k, hatch = css("--hatch"), muted = css("--line");
      for (var i = 0; i < f.x.length; i++) {
        var p = toPx(v, f.x[i] - f.grid_mm / 2, f.y[i] + f.grid_mm / 2);
        if (f.zone[i] === FM.ZONE.VOID) {
          ctx.strokeStyle = hatch; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p[0], p[1] + cell); ctx.lineTo(p[0] + cell, p[1]); ctx.stroke();
          continue;
        }
        var val = valueAt(fid, i);
        ctx.fillStyle = zoneShown(f.zone[i]) && val !== null ? colorFor(val, sc) : muted;
        if (S.selected && !S.selected.has(fid + ":" + i)) ctx.globalAlpha = 0.18;
        ctx.fillRect(p[0], p[1], cell + 0.5, cell + 0.5);
        ctx.globalAlpha = 1;
      }
      // zone outlines
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = css("--ink");
      f.zones.forEach(function (z) {
        if (z.rect_mm) {
          var a = toPx(v, z.rect_mm[0], z.rect_mm[3]), b = toPx(v, z.rect_mm[2], z.rect_mm[1]);
          ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        } else if (z.polygon_mm) {
          ctx.beginPath();
          z.polygon_mm.forEach(function (q, j) { var pp = toPx(v, q[0], q[1]); j ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); });
          ctx.closePath(); ctx.stroke();
        }
      });
      ctx.setLineDash([]); ctx.lineWidth = 2;
      ctx.beginPath();
      f.outline_mm.forEach(function (q, j) { var pp = toPx(v, q[0], q[1]); j ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); });
      ctx.closePath(); ctx.stroke();
      // zone labels
      ctx.font = "600 12px system-ui, sans-serif"; ctx.fillStyle = css("--ink");
      f.zones.forEach(function (z) {
        if (!z.rect_mm) return;
        var c = toPx(v, (z.rect_mm[0] + z.rect_mm[2]) / 2, (z.rect_mm[1] + z.rect_mm[3]) / 2);
        ctx.textAlign = "center"; ctx.fillText(z.type.toUpperCase(), c[0], c[1] + 4);
      });
      drawNorth(ctx, v.W - 30, 32);
      drawScaleBar(ctx, v);
    });
  }

  function drawNorth(ctx, cx, cy) {
    var a = (90 + S.meta.north_angle_deg) * Math.PI / 180; // model angle of north
    var dx = Math.cos(a), dy = -Math.sin(a);
    ctx.strokeStyle = ctx.fillStyle = css("--ink"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - dx * 16, cy - dy * 16); ctx.lineTo(cx + dx * 16, cy + dy * 16); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + dx * 16, cy + dy * 16, 3.5, 0, 7); ctx.fill();
    ctx.font = "700 11px system-ui"; ctx.textAlign = "center"; ctx.fillText("N", cx + dx * 27, cy + dy * 27 + 4);
  }
  function drawScaleBar(ctx, v) {
    var len = 10000 * v.k, x = v.pad, y = v.H - 22;
    ctx.fillStyle = css("--ink"); ctx.fillRect(x, y, len, 4);
    ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText("10 m", x + len + 6, y + 5);
  }

  /* ------------------------------------------------------------ tooltip */
  function hover(fid, e) {
    var v = S.view[fid], f = S.floors[fid], rect = v.cv.getBoundingClientRect();
    var sx = (e.clientX - rect.left) * v.W / rect.width, sy = (e.clientY - rect.top) * v.H / rect.height;
    var mx = (sx - v.pad) / v.k + v.minX, my = (v.H - v.pad - sy) / v.k + v.minY;
    var i = v.lookup[Math.floor((mx - v.minX) / f.grid_mm) + "," + Math.floor((my - v.minY) / f.grid_mm)];
    var tip = $("tip");
    if (i === undefined) { tip.hidden = true; return; }
    var r = S.res[fid], z = FM.ZONE_NAMES[f.zone[i]];
    var html = "<b>" + fid + " · " + z + " · x " + Math.round(f.x[i]) + ", y " + Math.round(f.y[i]) + " mm</b>";
    if (r.kh[i] === null) html += "Void: no floor here.";
    else {
      html += "<table>";
      Object.keys(FM.LAYERS).forEach(function (key) {
        var L = FM.LAYERS[key], d = S.cmp ? " (" + signed(r[key][i] - S.cmp[fid][key][i], L.dp) + ")" : "";
        html += "<tr><td>" + L.label + "</td><td class='n'>" + fmt(r[key][i], L.dp) + d + " " + L.unit + "</td></tr>";
      });
      var hs = FM.hotspot(r, i, params());
      var on = Object.keys(hs.flags).filter(function (k) { return hs.flags[k]; });
      html += "</table>Grade class: <b>" + FM.GRADE_CLASSES[FM.gradeClass(r.grade[i], S.grade)] + "</b>. Hotspot flags: " + (on.length ? on.join(", ") : "none");
    }
    tip.innerHTML = html;
    tip.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + 300 > window.innerWidth) x = e.clientX - 310;
    if (y + tip.offsetHeight > window.innerHeight) y = e.clientY - tip.offsetHeight - 10;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function signed(v, dp) { return (v > 0 ? "+" : "") + fmt(v, dp); }

  /* ------------------------------------------------------------ legend */
  function drawLegend() {
    var m = mode(), a = $("layerA").value, b = $("layerB").value, LA = FM.LAYERS[a], LB = FM.LAYERS[b];
    var sc = scales(), host = $("legend"), tagA = "<span class='tag'>" + LA.source + "</span>";
    if (m === "single") {
      host.innerHTML = "<span><b>" + LA.label + "</b> (" + LA.unit + ") " + tagA + "</span>" +
        "<span>" + fmt(sc.rangeA[0], LA.dp) + " " + bar(LA.better === "higher" ? COOL : HEAT) + " " + fmt(sc.rangeA[1], LA.dp) + "</span>" +
        "<span>Colour scale is shared by both floors.</span>";
    } else if (m === "bivariate") {
      var g = "<span class='swatches' style='display:inline-grid;grid-template-columns:repeat(3,16px);gap:2px'>";
      for (var r = 2; r >= 0; r--) for (var c = 0; c < 3; c++) g += "<span class='sw' style='background:" + BIV[r][c] + "'></span>";
      host.innerHTML = g + "</span><span>→ <b>" + LA.label + "</b> low / mid / high (cuts " + fmt(sc.cutsA[0], LA.dp) + ", " + fmt(sc.cutsA[1], LA.dp) + " " + LA.unit +
        ")<br>↑ <b>" + LB.label + "</b> low / mid / high (cuts " + fmt(sc.cutsB[0], LB.dp) + ", " + fmt(sc.cutsB[1], LB.dp) + " " + LB.unit +
        ")<br>Thirds of the visible points, so each class covers about a third of the floor.</span>";
    } else if (m === "hotspot") {
      var p = params(), s = "<span class='swatches'>";
      HOT.forEach(function (c, i) { s += "<span class='sw' style='background:" + c + "'></span>" + i; });
      host.innerHTML = s + "</span><span>Number of flags per point: overheating &gt; " + p.hotKh + " K·h, TM52 fails ≥ 2 criteria, daylight &lt; " +
        p.darkDf + "%, sun &gt; " + FM.DEFAULT_PARAMS.sunnyH + " h. Hover for which ones. <span class='tag a'>A22</span></span>";
    } else if (m === "grade") {
      var on = Object.keys(S.grade.layers).filter(function (k) { return S.grade.layers[k].on && S.grade.layers[k].w > 0 && FM.LAYERS[k]; });
      var sw = "<span class='swatches'>";
      FM.GRADE_CLASSES.forEach(function (n, i) { sw += "<span class='sw' style='background:" + BAND_COLORS[i] + "'></span>" + n; });
      host.innerHTML = sw + "</span><span>Grade 0-100 (lower is better). Good ≤ " + S.grade.cuts[0] + ", Fair ≤ " + S.grade.cuts[1] + ", Poor ≤ " + S.grade.cuts[2] +
        ". Built from: " + (on.length ? on.map(function (k) { return FM.LAYERS[k].label + " ×" + S.grade.layers[k].w; }).join(", ") : "<b>nothing ticked</b>") +
        " <span class='tag a'>A30</span></span>";
    } else {
      host.innerHTML = S.cmp
        ? "<span><b>Change in " + LA.label + "</b> (" + LA.unit + "): this scenario minus “" + scenById($("compare").value).name + "”</span>" +
          "<span>better −" + fmt(sc.dmax, LA.dp) + " " + bar(DIV) + " +" + fmt(sc.dmax, LA.dp) + " worse</span>"
        : "<span><b>Pick a scenario under “Compare with” to see the change.</b></span>";
    }
  }
  function bar(stops) {
    return "<span style='display:inline-block;width:160px;height:12px;border-radius:3px;vertical-align:middle;background:linear-gradient(90deg," + stops.join(",") + ")'></span>";
  }

  /* ------------------------------------------------------------ scatter */
  var brush = null;
  function drawScatter() {
    var cv = $("scatter"), dpr = window.devicePixelRatio || 1, W = 460, H = 320;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.aspectRatio = W + " / " + H;
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var a = $("layerA").value, b = $("layerB").value, LA = FM.LAYERS[a], LB = FM.LAYERS[b];
    $("scatterTitle").textContent = LA.label + " vs " + LB.label;
    var xa = [], yb = [];
    S.meta.floors.forEach(function (fid) { xa.push(S.res[fid][a]); yb.push(S.res[fid][b]); });
    var rx = FM.range(xa), ry = FM.range(yb), L = 52, R = 12, T = 12, B = 40;
    var sx = function (v) { return L + (v - rx[0]) / (rx[1] - rx[0]) * (W - L - R); };
    var sy = function (v) { return H - B - (v - ry[0]) / (ry[1] - ry[0]) * (H - T - B); };
    S.scatter = { sx: sx, sy: sy, rx: rx, ry: ry, L: L, R: R, T: T, B: B, W: W, H: H };
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1; ctx.strokeRect(L, T, W - L - R, H - T - B);
    ctx.fillStyle = css("--muted"); ctx.font = "11px system-ui"; ctx.textAlign = "center";
    ctx.fillText(LA.label + " (" + LA.unit + ")", L + (W - L - R) / 2, H - 8);
    ctx.fillText(fmt(rx[0], LA.dp), L, H - B + 14); ctx.fillText(fmt(rx[1], LA.dp), W - R, H - B + 14);
    ctx.save(); ctx.translate(14, T + (H - T - B) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(LB.label + " (" + LB.unit + ")", 0, 0); ctx.restore();
    ctx.textAlign = "right"; ctx.fillText(fmt(ry[0], LB.dp), L - 4, H - B); ctx.fillText(fmt(ry[1], LB.dp), L - 4, T + 10);
    S.meta.floors.forEach(function (fid, fi) {
      var f = S.floors[fid], r = S.res[fid];
      for (var i = 0; i < f.x.length; i++) {
        if (r.kh[i] === null || !zoneShown(f.zone[i])) continue;
        var sel = !S.selected || S.selected.has(fid + ":" + i);
        ctx.globalAlpha = sel ? 0.55 : 0.08;
        ctx.fillStyle = FLOOR_COLORS[fi % FLOOR_COLORS.length];
        ctx.fillRect(sx(r[a][i]) - 1.5, sy(r[b][i]) - 1.5, 3, 3);
      }
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = "left"; ctx.font = "600 11px system-ui";
    S.meta.floors.forEach(function (fid, fi) {
      ctx.fillStyle = FLOOR_COLORS[fi % FLOOR_COLORS.length]; ctx.fillText("■ " + fid, L + 8 + fi * 44, T + 14);
    });
    if (brush) {
      ctx.strokeStyle = css("--ink"); ctx.setLineDash([4, 3]);
      ctx.strokeRect(brush.x0, brush.y0, brush.x1 - brush.x0, brush.y1 - brush.y0); ctx.setLineDash([]);
    }
  }
  function scatterPos(e) {
    var cv = $("scatter"), r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * S.scatter.W / r.width, (e.clientY - r.top) * S.scatter.H / r.height];
  }
  function wireScatter() {
    var cv = $("scatter"), down = null;
    cv.addEventListener("mousedown", function (e) { down = scatterPos(e); brush = null; });
    window.addEventListener("mousemove", function (e) {
      if (!down) return;
      var p = scatterPos(e);
      brush = { x0: Math.min(down[0], p[0]), y0: Math.min(down[1], p[1]), x1: Math.max(down[0], p[0]), y1: Math.max(down[1], p[1]) };
      drawScatter();
    });
    window.addEventListener("mouseup", function () {
      if (!down) return;
      down = null;
      if (!brush || brush.x1 - brush.x0 < 3 || brush.y1 - brush.y0 < 3) { brush = null; S.selected = null; render(); return; }
      var a = $("layerA").value, b = $("layerB").value, sel = new Set();
      S.meta.floors.forEach(function (fid) {
        var f = S.floors[fid], r = S.res[fid];
        for (var i = 0; i < f.x.length; i++) {
          if (r.kh[i] === null || !zoneShown(f.zone[i])) continue;
          var x = S.scatter.sx(r[a][i]), y = S.scatter.sy(r[b][i]);
          if (x >= brush.x0 && x <= brush.x1 && y >= brush.y0 && y <= brush.y1) sel.add(fid + ":" + i);
        }
      });
      S.selected = sel;
      render();
    });
  }

  /* ------------------------------------------------------------ tables */
  function drawZoneTable() {
    var p = params(), rows = "", head = "<tr><th>Floor</th><th>Zone</th><th class='n'>Area m²</th><th class='n'>Mean K·h</th>" +
      (S.cmp ? "<th class='n'>Δ K·h</th>" : "") + "<th class='n'>Area &gt; " + p.hotKh + " K·h</th><th class='n'>TM52 ≥ 2 fails</th><th class='n'>Mean DF %</th></tr>";
    S.meta.floors.forEach(function (fid) {
      var zs = FM.zoneSummary(S.floors[fid], S.res[fid], p);
      var zc = S.cmp ? FM.zoneSummary(S.floors[fid], S.cmp[fid], p) : null;
      ["enclosed", "open", "void"].forEach(function (z) {
        var r = zs[z];
        if (!r) return;
        var pct = function (x) { return r.n ? Math.round(100 * x / r.area) + "%" : "–"; };
        rows += "<tr><td>" + fid + "</td><td>" + z + "</td><td class='n'>" + Math.round(r.area) + "</td><td class='n'>" + fmt(r.kh, 0) + "</td>" +
          (S.cmp ? "<td class='n'>" + (r.kh === null ? "–" : signed(r.kh - zc[z].kh, 0)) + "</td>" : "") +
          "<td class='n'>" + pct(r.hotArea) + "</td><td class='n'>" + pct(r.tm52Area) + "</td><td class='n'>" + fmt(r.df, 1) + "</td></tr>";
      });
    });
    $("zoneTable").innerHTML = head + rows;

    // calibration note: GF atrium floor mean vs EnergyPlus score
    var f0 = S.meta.floors[0], f = S.floors[f0], r0 = S.res[f0], s = 0, n = 0;
    for (var i = 0; i < f.x.length; i++) if (f.in_atrium[i] && r0.kh[i] !== null) { s += r0.kh[i]; n++; }
    var sc = scenById($("scenario").value);
    $("calNote").innerHTML = "Check: " + f0 + " atrium floor averages <b>" + fmt(s / n, 0) + " K·h</b>; the atrium score is <b>" +
      fmt(sc.atrium_score_kh, 0) + " K·h</b> <span class='tag " + (sc.score_source === "EnergyPlus" ? "sim" : "prx") + "'>" + sc.score_source + "</span>." +
      (p.calibrate ? "" : " Re-centring is off, so these will differ.");
  }

  function drawLedger() {
    var sc = scenById($("scenario").value), cmp = S.cmp ? scenById($("compare").value) : null;
    var rows = "<tr><th>Account</th><th class='n'>" + (cmp ? "This" : "Value") + "</th>" + (cmp ? "<th class='n'>Compare</th>" : "") + "<th>Source</th></tr>";
    var cell = function (e, unit) {
      return !e || e.value === null ? "<span class='tag need'>needs input</span>" : e.value.toLocaleString() + " " + unit;
    };
    rows += "<tr><td>Atrium overheating</td><td class='n'>" + sc.atrium_score_kh + " K·h</td>" + (cmp ? "<td class='n'>" + cmp.atrium_score_kh + " K·h</td>" : "") +
      "<td><span class='tag " + (sc.score_source === "EnergyPlus" ? "sim" : "prx") + "'>" + sc.score_source + "</span>" +
      (sc.id === "lowg_night" ? " <span class='tag a'>A23</span>" : "") + "</td></tr>";
    Object.keys(LEDGER_LABELS).forEach(function (k) {
      var e = sc.ledger[k], c = cmp ? cmp.ledger[k] : null;
      if (!e && !c) return;
      var lab = LEDGER_LABELS[k];
      rows += "<tr><td>" + lab[0] + "</td><td class='n'>" + cell(e, lab[1]) + "</td>" + (cmp ? "<td class='n'>" + cell(c, lab[1]) + "</td>" : "") +
        "<td>" + (e && e.value !== null ? "<span class='tag " + (e.source === "proxy" ? "prx" : e.source === "assumed" ? "a" : "est") + "'>" + e.source + "</span>" : "<span class='tag a'>A24</span>") + "</td></tr>";
    });
    $("ledger").innerHTML = rows;
  }

  function zoneShownName(z) { return z === "enclosed" ? $("zEnclosed").checked : z === "open" ? $("zOpen").checked : false; }

  var BAND_COLORS = ["#2E7D4F", "#E0A526", "#D65A31", "#7A1E1E"];   // Good / Fair / Poor / Critical

  /* Floor area in each grade class, per scenario, for the estates lens. */
  function rankRows() {
    var p = params(), zk = [$("zEnclosed").checked, $("zOpen").checked].join(), cur = $("scenario").value;
    var key = JSON.stringify(p) + zk + (cur === "custom" ? JSON.stringify(S.lever) : "");
    if (S.rankKey === key) return S.rankRows;
    var rows = S.scenarios.concat(cur === "custom" ? [S.custom] : []).map(function (s) {
      var res = FM.computeAll(S.floors, s, S.meta, p), band = [0, 0, 0, 0], area = 0, wsum = 0;
      S.meta.floors.forEach(function (fid) {
        var f = S.floors[fid], r = res[fid], cell = Math.pow(f.grid_mm / 1000, 2);
        for (var i = 0; i < f.x.length; i++) {
          if (r.grade[i] === null || r.kh[i] === null || !zoneShown(f.zone[i])) continue;
          band[FM.gradeClass(r.grade[i], S.grade)] += cell;
          area += cell; wsum += r.grade[i] * cell;
        }
      });
      return { s: s, band: band, area: area, mean: area ? wsum / area : 0 };
    });
    S.rankKey = key; S.rankRows = rows;
    return rows;
  }

  function drawRanking() {
    var all = rankRows(), base = all[0], cur = $("scenario").value, rows = all.slice(), CN = FM.GRADE_CLASSES;
    rows.sort(function (a, b) { return b.band[0] - a.band[0] || a.mean - b.mean; });
    var html = "<tr><th>Intervention</th><th>Rung</th><th class='n'>Atrium K·h</th><th>Floor area by grade</th>" +
      "<th class='n'>Mean grade</th><th class='n'>Good floor gained</th><th class='n'>Cost</th><th class='n'>Carbon</th></tr>";
    var cell = function (e, unit) { return !e || e.value === null ? "<span class='tag need'>needs input</span>" : e.value.toLocaleString() + " " + unit; };
    rows.forEach(function (r) {
      var bar = "<div style='display:flex;height:12px;width:220px;border-radius:3px;overflow:hidden;border:1px solid var(--line)'>";
      r.band.forEach(function (m, i) {
        bar += "<span title='" + CN[i] + ": " + Math.round(m) + " m²' style='width:" + (r.area ? 100 * m / r.area : 0) + "%;background:" + BAND_COLORS[i] + "'></span>";
      });
      bar += "</div><div style='font-size:11.5px;color:var(--muted);margin-top:2px'>" +
        r.band.map(function (m, i) { return Math.round(m) + " " + CN[i].toLowerCase(); }).join(" · ") + "</div>";
      var gain = r.band[0] - base.band[0];
      html += "<tr class='rk" + (r.s.id === cur ? " cur" : "") + "' data-id='" + r.s.id + "'><td>" + r.s.name + "</td><td>" + RUNGS[r.s.rung] +
        "</td><td class='n'>" + r.s.atrium_score_kh + " <span class='tag " + (r.s.score_source === "EnergyPlus" ? "sim" : "prx") + "'>" + r.s.score_source + "</span></td>" +
        "<td>" + bar + "</td><td class='n'>" + Math.round(r.mean) + " / 100</td><td class='n'>" + (gain > 0 ? "+" + Math.round(gain) + " m²" : "–") + "</td>" +
        "<td class='n'>" + cell(r.s.ledger.cost_gbp, "£") + "</td><td class='n'>" + cell(r.s.ledger.embodied_tco2e, "tCO₂e") + "</td></tr>";
    });
    $("rankTable").innerHTML = html;
    $("rankSub").textContent = "most good floor first, using your grade";
    document.querySelectorAll("#rankTable tr.rk").forEach(function (tr) {
      tr.addEventListener("click", function () { $("scenario").value = tr.getAttribute("data-id"); recompute(); });
    });
  }

  /* Grade controls: one row per layer, so new layers appear without code changes. */
  function buildGradeRows() {
    var host = $("gradeRows"), html = "<span class='hd'></span><span class='hd'>Layer</span><span class='hd'>Weight</span><span class='hd'>Good</span><span class='hd'>Bad</span>";
    Object.keys(S.grade.layers).forEach(function (k) {
      var g = S.grade.layers[k], L = FM.LAYERS[k];
      if (!L) return;
      html += "<input type='checkbox' data-k='" + k + "' data-f='on' aria-label='Count " + L.label + "'" + (g.on ? " checked" : "") + ">" +
        "<label title='" + L.unit + "'>" + L.label + "</label>" +
        "<input type='number' step='0.5' min='0' max='9' data-k='" + k + "' data-f='w' value='" + g.w + "' aria-label='" + L.label + " weight'>" +
        "<input type='number' step='any' data-k='" + k + "' data-f='good' value='" + g.good + "' aria-label='" + L.label + " good limit'>" +
        "<input type='number' step='any' data-k='" + k + "' data-f='bad' value='" + g.bad + "' aria-label='" + L.label + " bad limit'>";
    });
    host.innerHTML = html;
    host.querySelectorAll("input").forEach(function (el) {
      el.addEventListener("input", function () {
        var g = S.grade.layers[el.getAttribute("data-k")], f = el.getAttribute("data-f");
        g[f] = f === "on" ? el.checked : +el.value;
        recompute();
      });
    });
    [0, 1, 2].forEach(function (i) {
      $("cut" + i).addEventListener("input", function () { S.grade.cuts[i] = +$("cut" + i).value; recompute(); });
    });
  }

  function setLens(id) {
    var L = LENS[id];
    S.lens = id; S.selected = null;
    $("question").textContent = L.question + " ";
    var tag = document.createElement("span"); tag.className = "tag a"; tag.textContent = "A25 placeholder";
    $("question").appendChild(tag);
    document.querySelector("input[name=mode][value=" + L.mode + "]").checked = true;
    $("layerA").value = L.a; $("layerB").value = L.b;
    $("scatterCard").hidden = !L.showScatter;
    $("rankCard").hidden = !L.showRank;
    $("compare").value = "";
    recompute();
  }

  function drawAssumptions() {
    var rows = "<tr><th>ID</th><th>What</th><th>Placeholder in use</th><th>Question for you</th><th>Status</th></tr>";
    S.assumptions.forEach(function (a) {
      rows += "<tr><td>" + a.id + "</td><td>" + a.what + "</td><td>" + a.placeholder + "</td><td class='q'>" + a.question +
        "</td><td><span class='tag " + (a.status === "answered" ? "sim" : "need") + "'>" + a.status + "</span></td></tr>";
    });
    $("assumpTable").innerHTML = rows;
    var open = S.assumptions.filter(function (a) { return a.status !== "answered"; }).length;
    $("assumpCount").textContent = open + " open of " + S.assumptions.length;
  }

  function leverText(d) {
    return SC.LEVER_KEYS.map(function (k) { return SC.LEVER_META[k].label.toLowerCase() + " " + Number(d[k]).toFixed(SC.LEVER_META[k].dp); }).join(", ");
  }

  function drawScenarioInfo() {
    var sc = scenById($("scenario").value), tag = sc.score_source === "EnergyPlus" ? "sim" : "prx";
    $("scenarioInfo").innerHTML = "Cooling rung: <b>" + (sc.rungs.length ? sc.rungs.map(function (r) { return RUNGS[r]; }).join(" + ") : RUNGS[0]) +
      "</b>. Atrium score <b>" + fmt(sc.atrium_score_kh, 1) + " K·h</b> <span class='tag " + tag + "'>" + sc.score_source + "</span>" +
      (sc.score_source === "interpolated" ? " (typically ±" + fmt(SC.VAL.rmse, 1) + ", worst seen ±" + fmt(SC.VAL.max, 1) + ")" : "") + ".";
  }

  /* Verdict: this design against the existing atrium, in the same three numbers every time. */
  function floorStats(res) {
    var p = params(), out = {};
    S.meta.floors.forEach(function (fid) {
      var f = S.floors[fid], r = res[fid], cell = Math.pow(f.grid_mm / 1000, 2), o = { n: 0, area: 0, kh: 0, g: 0, good: 0, tm: 0 };
      for (var i = 0; i < f.x.length; i++) {
        if (r.kh[i] === null || !zoneShown(f.zone[i])) continue;
        o.n++; o.area += cell; o.kh += r.kh[i]; o.g += r.grade[i];
        if (FM.gradeClass(r.grade[i], S.grade) === 0) o.good += cell;
        if (r.tm52[i] >= 2) o.tm += cell;
      }
      o.kh = o.n ? o.kh / o.n : 0; o.g = o.n ? o.g / o.n : 0;
      out[fid] = o;
    });
    return out;
  }

  function drawVerdict() {
    var sc = scenById($("scenario").value), b = S.scenarios[0], host = $("verdict");
    if (sc.id === "base") {
      host.innerHTML = "<p>This is the <b>existing atrium</b>, the benchmark. Choose an intervention (left) or move the levers, and this panel says how far it gets, what it costs the daylight and how sure we are.</p>";
      return;
    }
    var s1 = floorStats(S.res), s0 = floorStats(S.baseRes), pct = function (a, c) { return c ? Math.round(100 * (a - c) / c) : 0; };
    var d = function (x) { return (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(Math.round(x)); };
    var html = "<div class='vhead'><div><span class='vbig'>" + fmt(sc.atrium_score_kh, 0) + "</span> K·h <span class='vsub'>was " + fmt(b.atrium_score_kh, 0) +
      " · " + d(pct(sc.atrium_score_kh, b.atrium_score_kh)) + "%</span></div><div><span class='tag " + (sc.score_source === "EnergyPlus" ? "sim" : "prx") + "'>" + sc.score_source +
      "</span> " + (sc.atrium_score_kh <= 42 ? "<b class='ok'>passes</b> the official limit (≤ 42)" : "<b class='bad'>does not pass</b> the official limit (≤ 42)") + "</div></div>";
    html += "<table><tr><th>Floor</th><th class='n'>Mean K·h</th><th class='n'>Mean grade</th><th class='n'>Good floor, m²</th><th class='n'>TM52 ≥ 2 fails, m²</th></tr>";
    S.meta.floors.forEach(function (fid) {
      var x = s1[fid], y = s0[fid];
      html += "<tr><td>" + fid + "</td><td class='n'>" + Math.round(y.kh) + " → <b>" + Math.round(x.kh) + "</b></td><td class='n'>" + Math.round(y.g) + " → <b>" + Math.round(x.g) +
        "</b></td><td class='n'>" + Math.round(y.good) + " → <b>" + Math.round(x.good) + "</b></td><td class='n'>" + Math.round(y.tm) + " → <b>" + Math.round(x.tm) + "</b></td></tr>";
    });
    html += "</table><ul class='vlist'>";
    var dl0 = b.daylightPct, dl1 = sc.daylightPct;
    html += "<li><b>Daylight:</b> atrium average " + fmt(dl0, 1) + "% → " + fmt(dl1, 1) + "% (" + d(pct(dl1, dl0)) + "%) <span class='tag prx'>proxy</span></li>";
    if (dl1 < 5) html += "<li class='warn'>Below 5% daylight: expect electric light on by day.</li>";
    else if (dl1 < 0.5 * dl0) html += "<li class='warn'>This fix takes more than half of the daylight.</li>";
    var w0 = b.ledger.winter_mwh_yr.value, w1 = sc.ledger.winter_mwh_yr.value;
    if (w1 > w0 * 1.05) html += "<li class='warn'>Winter glazing loss rises " + fmt(w0, 0) + " → " + fmt(w1, 0) + " MWh/yr: a higher U-value lowers the summer score by letting heat out, and costs heating in winter <span class='tag prx'>proxy</span></li>";
    else if (w1 < w0 * 0.95) html += "<li>Winter glazing loss falls " + fmt(w0, 0) + " → " + fmt(w1, 0) + " MWh/yr <span class='tag prx'>proxy</span></li>";
    var f0 = b.ledger.fan_kwh_wk.value, f1 = sc.ledger.fan_kwh_wk.value;
    if (f1 > f0 * 1.5) html += "<li class='warn'>Night purge would need fans if it cannot run on stack and wind: " + fmt(f1, 0) + " kWh/week (was " + fmt(f0, 0) + ") <span class='tag prx'>proxy</span></li>";
    html += "<li><b>How sure:</b> " + (sc.score_source === "EnergyPlus" ? "a simulated design, so the atrium score is a direct EnergyPlus result."
      : "between simulated designs, so the atrium score is interpolated: typically ±" + fmt(SC.VAL.rmse, 1) + " K·h, worst seen ±" + fmt(SC.VAL.max, 1) + " K·h.") +
      " The spot-by-spot pattern is an estimate either way (sun on a person, SolarCal).</li></ul>";
    host.innerHTML = html;
  }

  function render() {
    $("layerBWrap").style.opacity = mode() === "bivariate" ? 1 : 0.7;
    drawScenarioInfo();
    drawPlans();
    drawLegend();
    drawScatter();
    drawZoneTable();
    drawLedger();
    drawVerdict();
    if (LENS[S.lens].showRank) drawRanking();
  }

  /* ------------------------------------------------------------ boot */
  function fillSelect(el, items, value) {
    el.innerHTML = items.map(function (it) { return "<option value='" + it[0] + "'>" + it[1] + "</option>"; }).join("");
    el.value = value;
  }

  /* Intervention levers: moving one switches the scenario to "Custom". */
  function buildLevers() {
    var host = $("levers"), L = SC.levels(), html = "";
    SC.LEVER_KEYS.forEach(function (k, n) {
      var m = SC.LEVER_META[k], lo = L[n][0], hi = L[n][L[n].length - 1];
      html += "<label>" + m.label + " <span class='ex'>existing " + Number(SC.BASE[k]).toFixed(m.dp) + "</span>" +
        "<input type='range' data-k='" + k + "' min='" + lo + "' max='" + hi + "' step='" + m.step + "' value='" + S.lever[k] + "' aria-label='" + m.label + "'>" +
        "<output id='lv_" + k + "'>" + Number(S.lever[k]).toFixed(m.dp) + "</output></label>";
    });
    host.innerHTML = html;
    host.querySelectorAll("input").forEach(function (el) {
      el.addEventListener("input", function () {
        S.lever[el.getAttribute("data-k")] = +el.value;
        S.custom = SC.build("custom", "Custom levers", S.lever, S.meta);
        $("scenario").value = "custom";
        syncLevers();
        recompute();
      });
    });
  }
  function syncLevers() {
    SC.LEVER_KEYS.forEach(function (k) {
      var el = document.querySelector("#levers input[data-k=" + k + "]");
      if (el) el.value = S.lever[k];
      $("lv_" + k).textContent = Number(S.lever[k]).toFixed(SC.LEVER_META[k].dp);
    });
  }
  function useScenario(id) {
    var sc = scenById(id);
    $("scenario").value = id;
    if (id !== "custom") { S.lever = Object.assign({}, sc.levers); S.custom = SC.build("custom", "Custom levers", S.lever, S.meta); syncLevers(); }
  }

  function loadData() {
    if (window.FM_DATA) return Promise.resolve(window.FM_DATA);        // bundled: works from file://
    return Promise.all([getJSON("data/meta.json"), getJSON("data/assumptions.json")]).then(function (r) {
      var out = { meta: r[0], assumptions: r[1], floors: {} };
      return Promise.all(r[0].floors.map(function (fid) { return getJSON("data/floors/" + fid + ".json").then(function (f) { out.floors[fid] = f; }); }))
        .then(function () { return out; });
    });
  }

  function boot() {
    loadData()
      .then(function (D) {
        if (typeof SWEEP === "undefined") throw new Error("../js/sweep.js did not load (the EnergyPlus sweep). Keep the app folder next to the js folder.");
        S.meta = D.meta; S.assumptions = D.assumptions; S.floors = D.floors;
        SC.init(SWEEP);
        SC.baseline = SC.build("base", "Existing atrium", {}, S.meta);
        S.scenarios = SC.PRESETS.map(function (p) { return SC.build(p.id, p.name, p.levers, S.meta); });
        var best = SC.bestWithDaylight(5);
        S.scenarios.push(SC.build("best5", "Lowest score keeping daylight ≥ 5% (search of 3,125)", best.levers, S.meta));
        S.lever = Object.assign({}, SC.BASE);
        S.custom = SC.build("custom", "Custom levers", S.lever, S.meta);
        var m = S.meta;
        $("demoFlag").hidden = !(m.demo || m.placeholder_geometry);
        $("demoFlag").innerHTML = m.demo ? "<b>DEMO DATA</b><span>Everything here is a placeholder.</span>" :
          "<b>REAL WEATHER, REAL E+ RESULTS, PLACEHOLDER FLOORS</b><span>Real: 2050 hot-week weather, the atrium geometry EnergyPlus sees, the 3,125 EnergyPlus runs, sun on every point. Placeholder: the 5F level and gallery width, glass transmittance, posture (A03, A04, A06, A11). Floorplate outlines and room zones wait for the Rhino model.</span>";
        var sc = S.scenarios.map(function (s) { return [s.id, s.name]; }).concat([["custom", "Custom levers (your own)"]]);
        fillSelect($("scenario"), sc, "base");
        fillSelect($("compare"), [["", "Nothing"]].concat(sc), "");
        buildLevers();
        var ly = Object.keys(FM.LAYERS).map(function (k) { return [k, FM.LAYERS[k].label]; });
        fillSelect($("layerA"), ly, "kh");
        fillSelect($("layerB"), ly, "df");
        buildPlans();
        drawAssumptions();
        [["strat", "stratOut", 1], ["encOff", "encOut", 1], ["hotKh", "hotOut", 0], ["darkDf", "darkOut", 1]].forEach(function (s) {
          var upd = function () { $(s[1]).textContent = (+$(s[0]).value).toFixed(s[2]); };
          upd();
          $(s[0]).addEventListener("input", function () { upd(); recompute(); });
        });
        $("scenario").addEventListener("change", function () { useScenario($("scenario").value); recompute(); });
        ["compare", "calibrate"].forEach(function (id) { $(id).addEventListener("change", recompute); });
        ["layerA", "layerB", "zEnclosed", "zOpen"].forEach(function (id) { $(id).addEventListener("change", function () { S.selected = null; render(); }); });
        document.querySelectorAll("input[name=mode]").forEach(function (el) {
          el.addEventListener("change", function () {
            if (mode() === "delta" && !$("compare").value) {
              if ($("scenario").value === "base") useScenario("screen50");
              $("compare").value = "base";
              recompute(); return;
            }
            render();
          });
        });
        wireScatter();
        buildGradeRows();
        document.querySelectorAll("input[name=lens]").forEach(function (el) {
          el.addEventListener("change", function () { if (el.checked) setLens(el.value); });
        });
        setLens("architect");
        if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
        if (window.parent !== window) {                                   // embedded in the site: tell it how tall we are
          var post = function () { window.parent.postMessage({ type: "floormap-height", h: Math.ceil(document.body.getBoundingClientRect().height) }, "*"); };
          if (window.ResizeObserver) new ResizeObserver(post).observe(document.body); post();
        }
      })
      .catch(function (err) {
        document.querySelector("main").innerHTML = "<div class='card'><h2>Could not load the data</h2><p>" + err.message +
          "</p><p>Serve the repo over HTTP (<code>python -m http.server 8000</code>) and open /app/, or open the site's index.html.</p></div>";
      });
  }
  boot();
})();

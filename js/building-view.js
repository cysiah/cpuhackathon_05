/* Building section: a rebuild of section 2 of the Atrium Heat Lab starter app.
 * three.js view of the Ladybug envelope radiation (js/building.js), coloured on a
 * blue-to-pink ramp on a black model space, plus solar energy by building element.
 * Uses the frame engine exposed by js/diagrams.js as window.HH. */
(function () {
  "use strict";
  const H = window.HH, B = typeof BLD !== "undefined" ? BLD : null;
  const root = document.getElementById("building");
  if (!H || !B || !root) return;
  const { clamp, lerp, font, REDUCED } = H;
  const $ = s => root.querySelector(s);
  const fmt = (v, dp) => v.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }).replace("-", "−");

  const STUDIES = {
    hot_week: { label: "Hot week incident radiation", short: "HOT_WEEK", ramp: "heat" },
    annual: { label: "Annual incident radiation", short: "ANNUAL", ramp: "heat" },
    benefit_present: { label: "Benefit / harm, today", short: "BENEFIT_TODAY", ramp: "diverge", sym: true },
    benefit_future: { label: "Benefit / harm, 2050", short: "BENEFIT_2050", ramp: "diverge", sym: true }
  };
  // colour ramps as [t, r, g, b]: electric blue to hot pink
  const RAMPS = {
    heat: [[0, 22, 26, 140], [0.3, 50, 48, 255], [0.62, 160, 46, 255], [0.85, 255, 46, 154], [1, 255, 170, 210]],
    diverge: [[0, 50, 48, 255], [0.5, 70, 70, 82], [1, 255, 46, 154]]
  };
  function rampColor(name, t) {
    const s = RAMPS[name];
    t = clamp(t, 0, 1);
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i][0]) {
        const a = s[i - 1], b = s[i], f = (t - a[0]) / (b[0] - a[0]);
        return [lerp(a[1], b[1], f), lerp(a[2], b[2], f), lerp(a[3], b[3], f)];
      }
    }
    const l = s[s.length - 1];
    return [l[1], l[2], l[3]];
  }
  const rampCss = name => "linear-gradient(90deg," + RAMPS[name].map(s => `rgb(${s[1]},${s[2]},${s[3]}) ${s[0] * 100}%`).join(",") + ")";
  const catName = i => B.cats[B.cat[i]].replace("_", " ").toUpperCase();
  const NF = B.cat.length;
  // mean height of a face's corners, metres
  const faceZ = i => {
    let z = 0, n = 0;
    for (let k = 0; k < 4; k++) { const v = B.f[i * 4 + k]; if (v >= 0) { z += B.v[v * 3 + 2]; n++; } }
    return z / n;
  };

  // per-study state shared by the viewer, readout and bar chart
  const state = { key: "hot_week", agg: [], hover: -1 };

  function aggregate(key) {
    const vals = B.results[key], agg = {};
    for (let i = 0; i < NF; i++) {
      const c = B.cats[B.cat[i]];
      agg[c] = agg[c] || { cat: c, kwh: 0, area: 0 };
      agg[c].kwh += vals[i] * B.area[i]; agg[c].area += B.area[i];
    }
    return Object.values(agg).sort((a, b) => b.kwh - a.kwh);
  }

  // ---------- readout ----------
  function readout() {
    const st = STUDIES[state.key], vals = B.results[state.key];
    let big, label, sub;
    if (state.hover >= 0) {
      const i = state.hover;
      big = vals[i]; label = "SURFACE_" + String(i).padStart(4, "0");
      sub = catName(i) + " · " + fmt(B.area[i], 1) + " m² · Z " + fmt(faceZ(i), 1) + " M";
    } else {
      const a = state.agg.find(x => x.cat === "atrium_roof");
      big = a ? a.kwh / a.area : 0; label = "ATRIUM_ROOF";
      sub = "AVERAGE · " + (a ? fmt(a.area, 0) : 0) + " m²";
    }
    $("#b-big").textContent = fmt(big, big >= 100 || big <= -100 ? 0 : 1);
    $("#b-label").textContent = label;
    $("#b-sub").textContent = sub + (st.sym ? (big >= 0 ? " · BENEFIT" : " · HARM") : "");
    $("#b-study").textContent = st.short;
  }

  function setStudy(key) {
    state.key = key;
    const st = STUDIES[key], vals = B.results[key];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (st.sym) { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
    state.agg = aggregate(key);
    if (view) view.colour(st.sym ? vals.map(v => -v) : vals, [lo, hi], st.ramp);
    $("#b-ramp").style.background = rampCss(st.ramp);
    $("#b-lo").textContent = st.sym ? "◀ BENEFIT " + fmt(hi, 0) : fmt(lo, 0);
    $("#b-hi").textContent = st.sym ? "HARM " + fmt(hi, 0) + " ▶" : fmt(hi, 0) + " kWh/m²";
    root.querySelectorAll(".seg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.key === key));

    const total = state.agg.reduce((a, c) => a + Math.max(0, c.kwh), 0);
    const totalA = state.agg.reduce((a, c) => a + c.area, 0);
    const at = state.agg.find(c => c.cat === "atrium_roof") || { kwh: 0, area: 0 };
    const cl = state.agg.find(c => c.cat === "atrium_clerestory") || { kwh: 0, area: 0 };
    $("#b-insight").textContent = st.sym
      ? "Benefit / harm weights each hour of sun by whether the outdoor air is above the balance temperature. Compare today and 2050: surfaces that turn pink are where warming flips useful solar gain into a problem."
      : `The atrium glazing is ${fmt(100 * (at.area + cl.area) / totalA, 0)}% of the analysed envelope but receives ${fmt(100 * (at.kwh + cl.kwh) / total, 0)}% of its solar energy in this period, at ${fmt(at.kwh / Math.max(1, at.area), 1)} kWh/m² on average.`;
    readout();
    if (bars) H.paint(bars);
  }
  root.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => setStudy(b.dataset.key)));

  // ---------- 3D viewer ----------
  let view = null;
  const host = $("#b-viewer");
  if (window.THREE && THREE.OrbitControls) view = makeViewer(host);
  else host.insertAdjacentHTML("beforeend", '<p class="b-fallback">3D view unavailable: three.js did not load. Check the internet connection.</p>');

  function makeViewer(el) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0a);
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 4000);
    camera.up.set(0, 0, 1);
    camera.position.set(-70, -95, 70);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(7.8, 3.7, 8);
    controls.enableDamping = true;
    controls.autoRotateSpeed = 0.5;
    // turn slowly until someone drags; pause while the pointer is over the model
    let dragged = false;
    controls.autoRotate = !REDUCED;
    controls.addEventListener("start", () => { dragged = true; controls.autoRotate = false; });
    renderer.domElement.addEventListener("pointerenter", () => { controls.autoRotate = false; });
    renderer.domElement.addEventListener("pointerleave", () => { controls.autoRotate = !REDUCED && !dragged; });

    // analysis mesh, one flat colour per face
    const pos = [], faceOf = [], edges = [];
    const V = i => [B.v[i * 3], B.v[i * 3 + 1], B.v[i * 3 + 2]];
    let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < NF; i++) {
      const f = B.f.slice(i * 4, i * 4 + 4).filter(x => x >= 0).map(V);
      const tris = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f];
      tris.forEach(t => { t.forEach(p => pos.push(...p)); faceOf.push(i); });
      f.forEach((p, k) => {
        edges.push(...p, ...f[(k + 1) % f.length]);
        zmin = Math.min(zmin, p[2]); zmax = Math.max(zmax, p[2]);
        xmin = Math.min(xmin, p[0]); xmax = Math.max(xmax, p[0]);
        ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]);
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    scene.add(mesh);
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
    scene.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })));

    // context massing: dark solids with grey edges
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(B.ctx.v, 3));
    cg.setIndex(B.ctx.t);
    scene.add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.DoubleSide })));
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(cg, 25), new THREE.LineBasicMaterial({ color: 0x4a4a46 })));

    // ground grid in the XY plane
    const grid = new THREE.GridHelper(240, 48, 0x2a2a28, 0x1c1c1b);
    grid.rotation.x = Math.PI / 2; grid.position.z = zmin - 0.05;
    scene.add(grid);
    // true north (north_deg counter-clockwise from +Y)
    const a = B.north * Math.PI / 180;
    scene.add(new THREE.ArrowHelper(new THREE.Vector3(-Math.sin(a), Math.cos(a), 0), new THREE.Vector3(-60, -50, zmin + 0.5), 25, 0xeeff00, 7, 4));

    // scan ring: rests at ground level and steps to the height of the hovered surface
    const pad = 3, ring = [[xmin - pad, ymin - pad], [xmax + pad, ymin - pad], [xmax + pad, ymax + pad], [xmin - pad, ymax + pad]];
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(ring.flatMap(p => [p[0], p[1], 0]), 3));
    const scan = new THREE.LineLoop(sg, new THREE.LineBasicMaterial({ color: 0xeeff00 }));
    scan.position.z = zmin;
    let scanTarget = zmin;
    scene.add(scan);

    // hovered face outline
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    const hl = new THREE.LineLoop(hg, new THREE.LineBasicMaterial({ color: 0xeeff00 }));
    hl.visible = false; scene.add(hl);

    const ray = new THREE.Raycaster();
    function pick(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, camera);
      const hit = ray.intersectObject(mesh)[0];
      const fi = hit ? faceOf[hit.faceIndex] : -1;
      if (fi === state.hover) return;
      state.hover = fi;
      if (fi >= 0) {
        const f = B.f.slice(fi * 4, fi * 4 + 4).map(x => x >= 0 ? x : B.f[fi * 4 + 2]);
        const p = hg.getAttribute("position");
        f.forEach((vi, k) => p.setXYZ(k, B.v[vi * 3], B.v[vi * 3 + 1], B.v[vi * 3 + 2] + 0.05));
        p.needsUpdate = true;
      }
      hl.visible = fi >= 0;
      if (fi >= 0) scanTarget = faceZ(fi);
      readout();
    }
    renderer.domElement.addEventListener("pointermove", pick);
    renderer.domElement.addEventListener("pointerdown", pick);
    renderer.domElement.addEventListener("pointerleave", () => { state.hover = -1; hl.visible = false; readout(); });

    function resize() {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(el);
    resize();

    let visible = false, frame = 0, last = 0;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) requestAnimationFrame(loop); }, { rootMargin: "100px" }).observe(el);
    function loop(now) {
      if (!visible) return;
      if (now - last > 1000 / 12) {
        last = now; frame++;
        // move in stepped frames, at most a twelfth of the building height per frame
        const dz = scanTarget - scan.position.z, stepZ = (zmax - zmin) / 12;
        scan.position.z = REDUCED || Math.abs(dz) <= stepZ ? scanTarget : scan.position.z + Math.sign(dz) * stepZ;
      }
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }

    return {
      colour(values, range, ramp) {
        const col = g.getAttribute("color");
        faceOf.forEach((fi, t) => {
          const c = rampColor(ramp, (values[fi] - range[0]) / (range[1] - range[0]));
          for (let k = 0; k < 3; k++) col.setXYZ(t * 3 + k, c[0] / 255, c[1] / 255, c[2] / 255);
        });
        col.needsUpdate = true;
      }
    };
  }

  // ---------- solar energy by building element: segmented bars ----------
  const PINK = "#FF2E9A", BLUE = "#3230FF", PAPER = "#F1F1EA", DIM = "#6F7064";
  // static: redrawn only when the study or the size changes
  const bars = H.reg("c-bars", function (c, W, Hh) {
    const rows = state.agg, st = STUDIES[state.key];
    const n = rows.length, top = 8, rowH = (Hh - top - 30) / n;
    const lab = Math.min(150, W * 0.34), right = 78;
    const mwh = rows.map(r => r.kwh / 1000);
    const mn = Math.min(0, ...mwh), mx = Math.max(0, ...mwh);
    const x = v => lab + (W - lab - right) * (v - mn) / (mx - mn || 1);
    const seg = 7, gap = 2;
    font(c, 11, 400);
    rows.forEach((r, i) => {
      const y = top + i * rowH, bh = Math.max(6, rowH * 0.5), cy = y + (rowH - bh) / 2;
      const atr = r.cat.startsWith("atrium");
      c.fillStyle = atr ? PAPER : DIM;
      c.fillText(r.cat.replace("_", " ").toUpperCase(), 0, cy + bh - 1);
      const x0 = x(0), x1 = x(mwh[i]);
      const dir = x1 >= x0 ? 1 : -1, len = Math.abs(x1 - x0), cnt = Math.floor(len / (seg + gap));
      c.fillStyle = atr ? PINK : BLUE;
      for (let k = 0; k < cnt; k++) {
        const sx = dir > 0 ? x0 + k * (seg + gap) : x0 - (k + 1) * (seg + gap) + gap;
        c.fillRect(sx, cy, seg, bh);
      }
      c.fillStyle = atr ? PAPER : DIM;
      const txt = fmt(mwh[i], Math.abs(mwh[i]) < 10 ? 1 : 0);
      c.fillText(txt, dir > 0 ? Math.max(x0, x1) + 6 : x0 + 6, cy + bh - 1);
    });
    c.strokeStyle = DIM; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x(0) - 0.5, top); c.lineTo(x(0) - 0.5, Hh - 24); c.stroke();
    c.fillStyle = DIM; font(c, 10, 400);
    c.fillText(st.sym ? "MWh OVER THE PERIOD · − HARM  /  + BENEFIT" : "MWh OVER THE PERIOD", lab, Hh - 6);
  });

  if (bars) bars.still = true;
  setStudy("hot_week");
})();

/* viewer3d.js - three.js view of the envelope radiation results (Rhino coordinates, Z up, metres). */
window.HeatLab = window.HeatLab || {};
(function (H) {
  'use strict';

  // colour ramps: stops as [t, r, g, b]
  H.RAMPS = {
    heat: [[0, 38, 70, 120], [0.25, 47, 132, 160], [0.5, 238, 205, 90], [0.75, 236, 128, 44], [1, 178, 34, 34]],
    diverge: [[0, 34, 94, 168], [0.5, 235, 235, 230], [1, 190, 30, 45]],
  };
  H.rampColor = function (ramp, t) {
    t = Math.max(0, Math.min(1, t));
    const s = H.RAMPS[ramp];
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i][0]) {
        const a = s[i - 1], b = s[i], f = (t - a[0]) / (b[0] - a[0]);
        return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])];
      }
    }
    const l = s[s.length - 1];
    return [l[1], l[2], l[3]];
  };
  H.rampCss = function (ramp) {
    return 'linear-gradient(90deg,' + H.RAMPS[ramp].map((s) => 'rgb(' + s.slice(1).join(',') + ') ' + s[0] * 100 + '%').join(',') + ')';
  };

  H.Viewer = function (el, rad, ctx) {
    if (!window.THREE) { el.textContent = '3D view unavailable (three.js did not load).'; return; }
    const css = getComputedStyle(document.documentElement);
    this.el = el; this.rad = rad;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 4000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(-70, -95, 70);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(this.renderer.domElement);
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(7.8, 3.7, 8);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 0.35); sun.position.set(-50, -80, 120); this.scene.add(sun);

    // analysis mesh: one colour per analysis face (non-indexed so faces do not blend)
    const pos = [], faceOf = [];
    rad.faces.forEach((f, i) => {
      const tris = f.length === 4 ? [[f[0], f[1], f[2]], [f[0], f[2], f[3]]] : [f];
      tris.forEach((t) => { t.forEach((vi) => pos.push(...rad.vertices[vi])); faceOf.push(i); });
    });
    this.faceOf = faceOf;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    g.computeVertexNormals();
    this.mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.scene.add(this.mesh);

    // context massing
    const cpos = [];
    ctx.meshes.forEach((m) => m.f.forEach((t) => t.forEach((vi) => cpos.push(...m.v[vi]))));
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
    cg.computeVertexNormals();
    const ctxCol = new THREE.Color(css.getPropertyValue('--line').trim() || '#cccccc');
    this.scene.add(new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: ctxCol, transparent: true, opacity: 0.85 })));

    // true north arrow on the ground (north is ctx.north_deg counter-clockwise from +Y)
    const a = (ctx.north_deg * Math.PI) / 180, nv = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    this.scene.add(new THREE.ArrowHelper(nv, new THREE.Vector3(-60, -50, 0.5), 25, new THREE.Color(css.getPropertyValue('--accent').trim()).getHex(), 7, 4));

    // hover read-out
    this.ray = new THREE.Raycaster();
    this.hint = el.querySelector('.hint');
    this.renderer.domElement.addEventListener('pointermove', (e) => this.hover(e));

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    loop();
  };
  H.Viewer.prototype.resize = function () {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };
  /** Colour the mesh by one result set. range = [min, max]; ramp = 'heat' | 'diverge'. */
  H.Viewer.prototype.setValues = function (values, range, ramp, unit, label) {
    if (!this.mesh) return;
    this.values = values; this.unit = unit; this.label = label;
    const col = this.mesh.geometry.getAttribute('color');
    this.faceOf.forEach((fi, t) => {
      const c = H.rampColor(ramp, (values[fi] - range[0]) / (range[1] - range[0]));
      for (let k = 0; k < 3; k++) col.setXYZ(t * 3 + k, c[0] / 255, c[1] / 255, c[2] / 255);
    });
    col.needsUpdate = true;
  };
  H.Viewer.prototype.hover = function (e) {
    if (!this.hint || !this.values) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, this.camera);
    const hit = this.ray.intersectObject(this.mesh)[0];
    if (!hit) { this.hint.textContent = 'Drag to orbit · scroll to zoom · hover a surface'; return; }
    const fi = this.faceOf[hit.faceIndex];
    this.hint.textContent = this.label + ': ' + this.values[fi].toFixed(1) + ' ' + this.unit +
      ' · ' + this.rad.category[fi].replace('_', ' ') + ' · ' + this.rad.area_m2[fi].toFixed(1) + ' m²';
  };
})(window.HeatLab);
